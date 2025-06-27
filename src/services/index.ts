import type { EnvConfig } from "../config";
import type { ServiceInstances } from "../types";
import { HPKEService } from "./security/hpke.service";
import { TrustedService } from "./security/trusted.service";
import { InMemoryOTPService } from "./security/otp/otp.service";
import { KeyService } from "./user/key.service";
import { SendgridEmailService } from "./communication/email.service";
import { DatadogMetricsService } from "./metrics.service";
import { TeeKeyService } from "./security/tee-key.service";
import { AesGcmService } from "./security/aes-gcm.service";
import { FPEService } from "./security/fpe.service";

export async function initializeServices(
  env: EnvConfig,
  identityKey: CryptoKeyPair
): Promise<ServiceInstances> {
  console.log("Initializing services...");

  const keyPairProvider = TeeKeyService.getInstance();
  const encryptionService = new HPKEService(keyPairProvider);
  const fpeService = new FPEService(keyPairProvider);
  const symmetricEncryptionService = new AesGcmService(keyPairProvider);
  console.log("Encryption service initialized successfully");

  const otpService = InMemoryOTPService.getInstance();
  console.log("OTP service initialized successfully");

  const emailService = new SendgridEmailService(
    env.SENDGRID_API_KEY,
    env.SENDGRID_EMAIL_TEMPLATE_ID
  );
  console.log("Email service initialized successfully");

  const keyService = new KeyService(identityKey);
  console.log("Key service initialized successfully");

  const trustedService = new TrustedService(
    otpService,
    emailService,
    keyService,
    encryptionService,
    fpeService
  );

  const metricsService = DatadogMetricsService.getInstance(env);
  console.log("Metrics service initialized successfully");

  return {
    teeKeyService: keyPairProvider,
    trustedService,
    symmetricEncryptionService,
    metricsService,
    encryptionService,
  };
}
