import sendgrid from "@sendgrid/mail";
import { Keypair } from "@solana/web3.js";
import { split } from "shamir-secret-sharing";
import type { SigningAlgorithm } from "./schema";
import { EncryptionService } from "./encryption";
import { TappdClient } from "@phala/dstack-sdk";

interface Request {
	otp: string;
	userId: string;
	projectId: string;
	authId: string;
	createdAt: number;
}

export class SignerService {
	private pendingRequests = new Map<string, Request>(); // TODO expiry

	constructor(
		sendgridAPIKey: string,
		private readonly client = new TappdClient(),
	) {
		sendgrid.setApiKey(sendgridAPIKey);
	}

	public async preGenerateSigner(
		userId: string,
		projectId: string,
		authId: string,
		signingAlgorithm: SigningAlgorithm,
	): Promise<string> {
		if (signingAlgorithm !== "EDDSA_ED25519") {
			throw new Response(
				JSON.stringify({
					error: `signingAlgorithm ${signingAlgorithm} not yet supported`,
				}),
				{
					status: 400,
				},
			);
		}

		const masterSecret = await this.deriveMasterSecret(
			userId,
			projectId,
			authId,
		);
		const keypair = Keypair.fromSeed(masterSecret);
		return keypair.publicKey.toBuffer().toString("base64");
	}

	/**
	 * Create a new signer and start OTP verification flow
	 */
	public async initiateSignerCreation(
		userId: string,
		projectId: string,
		authId: string,
		deviceId: string,
		encryptionContext?: { publicKey: string },
	): Promise<void> {
		const encryptionService = EncryptionService.getInstance();
		const emailPart = authId.split(":")[1];
		if (emailPart == null) {
			throw new Error("Invalid authId format");
		}

		let otp = this.generateOTP();
		console.log("[DEBUG] Generated OTP:", otp);

		this.pendingRequests.set(deviceId, {
			otp,
			userId,
			projectId,
			authId,
			createdAt: Date.now(),
		});

		if (encryptionContext) {
			otp = (
				await encryptionService.encryptOTP(
					otp.split("").map(Number),
					encryptionContext.publicKey,
				)
			).join("");
		}

		await this.sendEmail(
			"Your Crossmint verification code",
			`Your verification code is: ${otp}`,
			emailPart,
		);
	}

	/**
	 * Verify OTP and generate key shares
	 */
	public async completeSignerCreation(
		deviceId: string,
		otp: string,
	): Promise<{ device: string; auth: string; signerId: string }> {
		// Retrieve request from storage
		const request = this.pendingRequests.get(deviceId);
		if (!request) {
			throw new Response(
				JSON.stringify({
					error: `Authentication for device ${deviceId} is not pending`,
				}),
				{
					status: 400,
				},
			);
		}

		if (request.otp !== otp) {
			throw new Response(JSON.stringify({ error: "Invalid OTP" }), {
				status: 401,
			});
		}

		// Derive the master secret
		const masterSecret = await this.deriveMasterSecret(
			request.userId,
			request.projectId,
			request.authId,
		);

		const [device, auth] = await split(masterSecret, 2, 2);
		if (device == null || auth == null) {
			throw new Error("shamir secret split failed");
		}

		this.pendingRequests.delete(deviceId);

		return {
			device: Buffer.from(device).toString("base64"),
			auth: Buffer.from(auth).toString("base64"),
			signerId: Buffer.from(
				await crypto.subtle.digest("SHA-256", masterSecret),
			).toString("base64"),
		};
	}

	private async sendEmail(
		subject: string,
		body: string,
		recipient: string,
	): Promise<void> {
		const msg = {
			to: recipient,
			from: "hello@crossmint.io",
			subject: subject,
			text: body,
			html: `<div>${body}</div>`,
		};
		console.log("[DEBUG] Attempting to send email to:", recipient);
		console.log(msg);

		await sendgrid.send(msg);
	}

	private generateOTP(): string {
		const randomBytes = new Uint8Array(4);
		crypto.getRandomValues(randomBytes);

		const randomNumber =
			new DataView(randomBytes.buffer).getUint32(0) % 1000000;
		return randomNumber.toString().padStart(6, "0");
	}

	private async deriveMasterSecret(
		userId: string,
		projectId: string,
		authId: string,
	): Promise<Uint8Array> {
		const info = new TextEncoder().encode(
			JSON.stringify({
				user_id: userId,
				project_id: projectId,
				auth_id: authId,
				version: "1",
			}),
		);

		const keyResult = await this.client.deriveKey("crossmint-tee");
		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(keyResult.key),
			{ name: "HKDF" },
			false,
			["deriveBits"],
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: "HKDF",
				hash: "SHA-256",
				salt: new Uint8Array(32),
				info,
			},
			keyMaterial,
			256,
		);

		return new Uint8Array(derivedBits);
	}
}
