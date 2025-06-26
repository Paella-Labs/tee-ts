import type { EnvConfig } from "../config";
import type { ServiceInstances } from "../types";
import { AsymmetricEncryptionService } from "./security/asymmetric-encryption.service";
import { TrustedService } from "./security/trusted.service";
import { InMemoryOTPService } from "./security/otp/otp.service";
import { KeyService } from "./security/key.service";
import { SendgridEmailService } from "./communication/email.service";
import { DatadogMetricsService } from "./metrics.service";
import { TeeKeyService } from "./security/tee-key.service";
import { SymmetricEncryptionService } from "./security/symmetric-encryption.service";
import { FPEService } from "./security/fpe.service";
import { KeySerializer } from "./security/lib/key-management/key-serializer";

export async function initializeServices(
  env: EnvConfig,
  identityKey: CryptoKeyPair
): Promise<ServiceInstances> {
  console.log("Initializing services...");

  const keyPairProvider = new TeeKeyService();
  const encryptionService =
    AsymmetricEncryptionService.getInstance(keyPairProvider);
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
