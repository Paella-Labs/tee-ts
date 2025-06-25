import type { EncryptionService } from "./encryption.service";
import type { OTPService } from "./otp.service";
import type { EmailService } from "./email.service";
import type { KeyService } from "./key.service";
import type { KeyType } from "../schemas";
import type { PublicKeyResponse } from "types";

export class TrustedService {
	constructor(
		private readonly otpService: OTPService,
		private readonly emailService: EmailService,
		private readonly keyService: KeyService,
		private readonly encryptionService: EncryptionService,
	) {}

	public async derivePublicKey(
		signerId: string,
		authId: string,
		keyType: KeyType,
	): Promise<PublicKeyResponse> {
		return await this.keyService.derivePublicKey(signerId, authId, keyType);
	}

	/**
	 * Create a new signer and start OTP verification flow
	 */
	public async startOnboarding(
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
	 * Verify OTP and generate encrypted master key
	 */
	public async completeOnboarding(
		deviceId: string,
		otp: string,
		senderPublicKey: string,
	): Promise<{
		encryptedMasterKey: string;
		encryptedKeySha256Hash: string;
		signerId: string;
	}> {
		const request = this.otpService.verifyOTP(deviceId, otp);
		const keyMaterial = await this.keyService.generateAndEncryptMasterKey(
			request.signerId,
			request.authId,
			senderPublicKey,
			this.encryptionService,
		);
		return { ...keyMaterial, signerId: request.signerId };
	}
}
