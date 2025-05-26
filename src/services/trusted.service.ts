import type { EncryptionService } from "./encryption.service";
import type { OTPService } from "./otp.service";
import type { EmailService } from "./email.service";
import type { KeyService } from "./key.service";
import type { SigningAlgorithm } from "../schemas";

export class TrustedService {
	constructor(
		private readonly otpService: OTPService,
		private readonly emailService: EmailService,
		private readonly keyService: KeyService,
		private readonly encryptionService: EncryptionService,
	) {}

	public async preGenerateSigner(
		signerId: string,
		authId: string,
		signingAlgorithm: SigningAlgorithm,
	): Promise<string> {
		if (signingAlgorithm !== "ed25519") {
			throw new Response(
				JSON.stringify({
					error: `signingAlgorithm ${signingAlgorithm} not yet supported`,
				}),
				{
					status: 400,
				},
			);
		}

		return await this.keyService.derivePublicKey(signerId, authId);
	}

	/**
	 * Create a new signer and start OTP verification flow
	 */
	public async initiateSignerCreation(
		signerId: string,
		projectName: string,
		authId: string,
		deviceId: string,
		encryptionContext: { publicKey: string },
		projectLogo?: string,
	): Promise<void> {
		const recipient = authId.split(":")[1];
		if (recipient == null) {
			throw new Error("Invalid authId format");
		}

		let otp = this.otpService.generateOTP(signerId, authId, deviceId);

		otp = (
			await this.encryptionService.encryptOTP(
				otp.split("").map(Number),
				encryptionContext.publicKey,
			)
		).join("");

		await this.emailService.sendOTPEmail(
			otp,
			recipient,
			projectName,
			"5 minutes",
			projectLogo,
		);
	}

	/**
	 * Verify OTP and generate key shares
	 */
	public async completeSignerCreation(
		deviceId: string,
		otp: string,
	): Promise<{ device: string; auth: string; deviceKeyShareHash: string }> {
		const request = this.otpService.verifyOTP(deviceId, otp);
		return this.keyService.generateAndSplitKey(
			request.signerId,
			request.authId,
		);
	}
}
