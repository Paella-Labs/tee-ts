import type { ENVSchema } from "../config";
import { EncryptionService } from "./encryption.service";
import { TrustedService } from "./trusted.service";
import { InMemoryOTPService } from "./otp.service";
import { KeyService } from "./key.service";
import { SendgridEmailService } from "./email.service";
import type { z } from "zod";

interface ServiceContainer {
  trustedService: TrustedService;
  encryptionService: EncryptionService;
}

export async function initializeServices(
  env: z.infer<typeof ENVSchema>,
): Promise<ServiceContainer> {
  console.log("Initializing services...");

  // Initialize encryption service
  const encryptionService = EncryptionService.getInstance();
  await encryptionService.init();
  console.log("Encryption service initialized successfully");

  // Initialize OTP service
  const otpService = InMemoryOTPService.getInstance();
  console.log("OTP service initialized successfully");

  // Initialize Email service
  const emailService = new SendgridEmailService(
    env.SENDGRID_API_KEY,
    env.SENDGRID_EMAIL_TEMPLATE_ID,
  );
  console.log("Email service initialized successfully");

  // Initialize Key service
  const keyService = new KeyService(env.MOCK_TEE_SECRET);
  console.log("Key service initialized successfully");

  // Create the TrustedService
  const trustedService = new TrustedService(
    otpService,
    emailService,
    keyService,
    encryptionService,
  );

  // Return all services in a container
  return {
    trustedService,
    encryptionService,
  };
}
