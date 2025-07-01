import type { EncryptionService } from "./encryption.service";
import type { OTPService } from "./otp.service";
import type { EmailService } from "./email.service";
import type { SMSService } from "./sms.service";
import type { KeyService } from "./key.service";
import type { KeyType } from "../schemas";
import type { PublicKeyResponse } from "types";

export class TrustedService {
	constructor(
		private readonly otpService: OTPService,
		private readonly emailService: EmailService,
		private readonly smsService: SMSService,
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
	 * Supports both email and SMS based on authId format:
	 * - email:<email> for email delivery
	 * - phone:<phoneNumber> for SMS delivery
	 */
	public async startOnboarding(
		signerId: string,
		projectName: string,
		authId: string,
		deviceId: string,
		encryptionContext: { publicKey: string },
		projectLogo?: string,
	): Promise<void> {
		const [type, recipient] = authId.split(":");
		if (recipient == null) {
			throw new Error("Invalid authId format. Expected 'email:<email>' or 'phone:<phoneNumber>'");
		}

		let otp = this.otpService.generateOTP(signerId, authId, deviceId);

		otp = (
			await this.encryptionService.encryptOTP(
				otp.split("").map(Number),
				encryptionContext.publicKey,
			)
		).join("");

		switch (type) {
			case "email":
				await this.emailService.sendOTPEmail(
					otp,
					recipient,
					projectName,
					"5 minutes",
					projectLogo,
				);
				break;
			case "phone":
				await this.smsService.sendOTPSMS(
					otp,
					recipient,
					projectName,
					"5 minutes",
				);
				break;
			default:
				throw new Error(`Unsupported authId type: ${type}. Expected 'email' or 'phone'`);
		}
	}

	/**
	 * Verify OTP and generate key shares
	 */
	public async completeOnboarding(
		deviceId: string,
		otp: string,
	): Promise<{
		device: string;
		auth: string;
		deviceKeyShareHash: string;
		signerId: string;
	}> {
		const request = this.otpService.verifyOTP(deviceId, otp);
		const keyMaterial = await this.keyService.generateAndSplitKey(
			request.signerId,
			request.authId,
		);
		return { ...keyMaterial, signerId: request.signerId };
	}
}
