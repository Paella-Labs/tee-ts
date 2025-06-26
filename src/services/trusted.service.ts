import type { EncryptionService } from "./encryption/encryption.service";
import type { OTPService } from "./otp/otp.service";
import type { EmailService } from "./email/email.service";
import type { KeyService } from "./keys/key.service";
import type { KeyType } from "../schemas";
import type { PublicKeyResponse } from "types";
import type { FPEService } from "./encryption/fpe.service";
import type { SymmetricEncryptionService } from "./encryption/symmetric-encryption.service";
import type { KeySerializer } from "./encryption/lib/key-management/key-serializer";

export class TrustedService {
  constructor(
    private readonly otpService: OTPService,
    private readonly emailService: EmailService,
    private readonly keyService: KeyService,
    private readonly encryptionService: EncryptionService,
    private readonly fpeService: FPEService,
    private readonly keySerializer: KeySerializer
  ) {}

  public async derivePublicKey(
    signerId: string,
    authId: string,
    keyType: KeyType
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
    projectLogo?: string
  ): Promise<void> {
    const recipient = authId.split(":")[1];
    if (recipient == null) {
      throw new Error("Invalid authId format");
    }

    let otp = this.otpService.generateOTP(signerId, authId, deviceId);

    otp = (
      await this.fpeService.encryptOTP(
        otp.split("").map(Number),
        await this.keySerializer.deserializePublicKey(
          encryptionContext.publicKey
        )
      )
    ).join("");

    await this.emailService.sendOTPEmail(
      otp,
      recipient,
      projectName,
      "5 minutes",
      projectLogo
    );
  }

  /**
   * Verify OTP and generate key shares
   */
  public async completeOnboarding(
    deviceId: string,
    otp: string
  ): Promise<{
    masterUserKey: Uint8Array;
    signerId: string;
    teepublicKey: string;
  }> {
    const request = this.otpService.verifyOTP(deviceId, otp);
    const { masterUserKey } = await this.keyService.generateKey(
      request.signerId,
      request.authId
    );
    return {
      masterUserKey,
      signerId: request.signerId,
      teepublicKey: Buffer.from(
        await this.encryptionService.getPublicKey()
      ).toString("base64"),
    };
  }
}
