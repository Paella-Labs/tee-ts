import type { EnvConfig } from "../config";
import type { ServiceInstances } from "../types";
import { EncryptionService } from "./encryption.service";
import { TrustedService } from "./trusted.service";
import { InMemoryOTPService } from "./otp.service";
import { KeyService } from "./key.service";
import { SendgridEmailService } from "./email.service";
import { DatadogMetricsService } from "./metrics.service";

interface ServiceContainer {
	trustedService: TrustedService;
	encryptionService: EncryptionService;
	metricsService: DatadogMetricsService;
}

export async function initializeServices(
	env: EnvConfig,
): Promise<ServiceInstances> {
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

	// Initialize Metrics service
	const metricsService = DatadogMetricsService.getInstance(env);
	console.log("Metrics service initialized successfully");

	// Return all services in a container
	return {
		trustedService,
		encryptionService,
		metricsService,
	};
}
