import type { HPKEService } from "./hpke.service";
import type { OTPService } from "./otp/otp.service";
import type { EmailService } from "../communication/email.service";
import type { UserSecretService } from "../user/user-secret.service";
import type { KeyType } from "../../schemas";
import type { PublicKeyResponse } from "types";
import type { FPEService } from "./fpe.service";
import { PublicKeySerializer } from "@crossmint/client-signers-cryptography";

export class TrustedService {
	constructor(
		private readonly otpService: OTPService,
		private readonly emailService: EmailService,
		private readonly userSecretService: UserSecretService,
		private readonly encryptionService: HPKEService,
		private readonly fpeService: FPEService,
	) {}

	public async derivePublicKey(
		signerId: string,
		authId: string,
		keyType: KeyType,
	): Promise<PublicKeyResponse> {
		return await this.userSecretService.derivePublicKey(
			signerId,
			authId,
			keyType,
		);
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
		const publicKey = await PublicKeySerializer.deserialize(
			encryptionContext.publicKey,
			"base64",
		);

		otp = (
			await this.fpeService.encrypt(otp.split("").map(Number), publicKey)
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
	 * Verify OTP and generate master user key
	 */
	public async completeOnboarding(
		deviceId: string,
		otp: string,
	): Promise<{
		masterUserKey: Uint8Array;
		signerId: string;
		teepublicKey: string;
	}> {
		const request = this.otpService.verifyOTP(deviceId, otp);
		const { masterUserSecret: masterUserKey } =
			await this.userSecretService.generateMasterSecret(
				request.signerId,
				request.authId,
			);
		return {
			masterUserKey,
			signerId: request.signerId,
			teepublicKey: Buffer.from(
				await this.encryptionService.getPublicKey(),
			).toString("base64"),
		};
	}
}
