import type { EnvConfig } from "../config";
import type { ServiceInstances } from "../types";
import { EncryptionService } from "./encryption.service";
import { TrustedService } from "./trusted.service";
import { InMemoryOTPService } from "./otp.service";
import { KeyService } from "./key.service";
import { SendgridEmailService } from "./email.service";
import { TwilioSMSService } from "./sms.service";
import { DatadogMetricsService } from "./metrics.service";

export async function initializeServices(
	env: EnvConfig,
	identityKey: CryptoKeyPair,
): Promise<ServiceInstances> {
	console.log("Initializing services...");

	const encryptionService = EncryptionService.getInstance();
	await encryptionService.init(identityKey);
	console.log("Encryption service initialized successfully");

	const otpService = InMemoryOTPService.getInstance();
	console.log("OTP service initialized successfully");

	const emailService = new SendgridEmailService(
		env.SENDGRID_API_KEY,
		env.SENDGRID_EMAIL_TEMPLATE_ID,
	);
	console.log("Email service initialized successfully");

	const smsService = new TwilioSMSService(
		env.TWILIO_ACCOUNT_SID,
		env.TWILIO_AUTH_TOKEN,
		env.TWILIO_PHONE_NUMBER,
	);
	console.log("SMS service initialized successfully");

	const keyService = new KeyService(identityKey);
	console.log("Key service initialized successfully");

	const trustedService = new TrustedService(
		otpService,
		emailService,
		smsService,
		keyService,
		encryptionService,
	);

	const metricsService = DatadogMetricsService.getInstance(env);
	console.log("Metrics service initialized successfully");

	return {
		trustedService,
		encryptionService,
		metricsService,
	};
}
