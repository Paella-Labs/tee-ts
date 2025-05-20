import sendgrid from "@sendgrid/mail";
import { Keypair } from "@solana/web3.js";
import { split } from "shamir-secret-sharing";
import type { SigningAlgorithm } from "./schema";
import { EncryptionService } from "./encryption";

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
		private readonly sendgridEmailTemplateId: string,
		private readonly keyDerivationSecret: string,
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
		projectName: string,
		authId: string,
		deviceId: string,
		projectLogo?: string,
		encryptionContext?: { publicKey: string },
	): Promise<void> {
		const encryptionService = EncryptionService.getInstance();
		const recipient = authId.split(":")[1];
		if (recipient == null) {
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

		await this.sendEmail(otp, recipient, projectName, projectLogo);
	}

	/**
	 * Verify OTP and generate key shares
	 */
	public async completeSignerCreation(
		deviceId: string,
		otp: string,
	): Promise<{ device: string; auth: string; deviceKeyShareHash: string }> {
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
			deviceKeyShareHash: Buffer.from(
				await crypto.subtle.digest("SHA-256", device),
			).toString("base64"),
		};
	}

	private async sendEmail(otp: string, recipient: string, projectName: string, projectLogo?: string): Promise<void> {
		const sendGridData = {
			to: recipient,
			from: "hello@crossmint.io",
			templateId: this.sendgridEmailTemplateId,
			dynamicTemplateData: {
				otp_code: otp,
				otp_code_expiration_minutes: "10 minutes",
				user: {
					trusted_metadata: {
						project_name: projectName,
						project_logo: projectLogo,
					},
				},
			},
		}
		console.log("[DEBUG] Attempting to send email to:", recipient);
		console.log(sendGridData);

		await sendgrid.send(sendGridData)
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

		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(this.keyDerivationSecret),
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
