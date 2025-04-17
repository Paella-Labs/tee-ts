import sendgrid from "@sendgrid/mail";
import { split } from "shamir-secret-sharing";

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
		private readonly keyDerivationSecret: string,
	) {
		sendgrid.setApiKey(sendgridAPIKey);
	}

	/**
	 * Create a new signer and start OTP verification flow
	 */
	public async initiateSignerCreation(
		userId: string,
		projectId: string,
		authId: string,
	): Promise<string> {
		const emailPart = authId.split(":")[1];
		if (emailPart == null) {
			throw new Error("Invalid authId format");
		}

		const otp = this.generateOTP();
		console.log("[DEBUG] Generated OTP:", otp);

		const requestId = crypto.randomUUID();
		console.log("[DEBUG] Generated request ID:", requestId);

		this.pendingRequests.set(requestId, {
			otp,
			userId,
			projectId,
			authId,
			createdAt: Date.now(),
		});

		await this.sendEmail(
			"Your Crossmint verification code",
			`Your verification code is: ${otp}`,
			emailPart,
		);

		return requestId;
	}

	/**
	 * Verify OTP and generate key shares
	 */
	public async completeSignerCreation(
		requestId: string,
		otp: string,
	): Promise<{ device: string; auth: string }> {
		// Retrieve request from storage
		const request = this.pendingRequests.get(requestId);
		if (!request) {
			throw new Response(JSON.stringify({ error: "Invalid request ID" }), {
				status: 401,
			});
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

		this.pendingRequests.delete(requestId);

		return {
			device: Buffer.from(device).toString("hex"),
			auth: Buffer.from(auth).toString("hex"),
		};
	}

	private async sendEmail(
		subject: string,
		body: string,
		recipient: string,
	): Promise<void> {
		console.log("[DEBUG] Attempting to send email to:", recipient);

		const msg = {
			to: recipient,
			from: "hello@crossmint.io",
			subject: subject,
			text: body,
			html: `<div>${body}</div>`,
		};

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
