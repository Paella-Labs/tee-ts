import type { EnvConfig } from "../config";
import type { ServiceInstances } from "../types";
import { EncryptionService } from "./encryption/encryption.service";
import { TrustedService } from "./trusted.service";
import { InMemoryOTPService } from "./otp/otp.service";
import { KeyService } from "./keys/key.service";
import { SendgridEmailService } from "./email/email.service";
import { DatadogMetricsService } from "./metrics/metrics.service";
import { TeeKeyService } from "./keys/tee-key.service";
import { SymmetricEncryptionService } from "./encryption/symmetric-encryption.service";
import { FPEService } from "./encryption/fpe.service";
import { KeySerializer } from "./encryption/lib/key-management/key-serializer";

export async function initializeServices(
  env: EnvConfig,
  identityKey: CryptoKeyPair
): Promise<ServiceInstances> {
  console.log("Initializing services...");

  const keyPairProvider = new TeeKeyService();
  const encryptionService = EncryptionService.getInstance(keyPairProvider);
  const fpeService = new FPEService(keyPairProvider);
  const symmetricEncryptionService = new SymmetricEncryptionService(
    keyPairProvider
  );
  const keySerializer = new KeySerializer();
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
    fpeService,
    keySerializer
  );

  const metricsService = DatadogMetricsService.getInstance(env);
  console.log("Metrics service initialized successfully");

  return {
    teeKeyService: keyPairProvider,
    trustedService,
    symmetricEncryptionService,
    metricsService,
    encryptionService,
    keySerializer,
  };
}
