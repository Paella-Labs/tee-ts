import "./setup";
import { describe, expect, it } from "bun:test";
import { createApp } from "../app";
import { devIdentityKey } from "../key";
import { env } from "../config";
import type { ServiceInstances } from "../types";
import { EncryptionService } from "../services/encryption.service";
import { TrustedService } from "../services/trusted.service";
import { InMemoryOTPService } from "../services/otp.service";
import { KeyService } from "../services/key.service";
import type { EmailService } from "../services/email.service";
import type { MetricsService } from "../services/metrics.service";

// Mock email service that doesn't actually send emails
class MockEmailService implements EmailService {
	async sendOTPEmail(
		otp: string,
		recipient: string,
		projectName: string,
		expiryMinutes?: string,
		projectLogo?: string,
	): Promise<void> {
		return Promise.resolve();
	}
}

// Mock metrics service that doesn't actually send metrics
class MockMetricsService implements MetricsService {
	gauge(name: string, value: number, tags?: string[]): void {}
	distribution(name: string, value: number, tags?: string[]): void {}
	histogram(name: string, value: number, tags?: string[]): void {}
	increment(name: string, value = 1, tags?: string[]): void {}

	async flush(): Promise<void> {
		return Promise.resolve();
	}
}

async function initializeServicesWithMockEmail(
	identityKey: CryptoKeyPair,
): Promise<ServiceInstances> {
	const encryptionService = EncryptionService.getInstance();
	await encryptionService.init(identityKey);
	const otpService = InMemoryOTPService.getInstance();
	const emailService = new MockEmailService();
	const keyService = new KeyService(identityKey);
	const trustedService = new TrustedService(
		otpService,
		emailService,
		keyService,
		encryptionService,
	);
	const metricsService = new MockMetricsService();

	return {
		trustedService,
		encryptionService,
		metricsService,
	};
}

describe("Rate Limiting Integration", () => {
	it("should allow 3 onboarding requests but return 429 on the 4th", async () => {
		const identityKey = await devIdentityKey();
		const services = await initializeServicesWithMockEmail(identityKey);
		const app = await createApp(services);

		// Test data - using same signerId and authId for all requests to trigger rate limiting
		const testData = {
			deviceId: "test-device-123",
			signerId: "test-signer-123",
			projectName: "Test Project",
			authId: "email:test@example.com",
			encryptionContext: {
				publicKey:
					"BMxzex+oSRC3yiAPhYmIHrZ1iuVLmDO05O6x6+Q8oCO4Vi1Gd7NnOSyCpv6MwA6bZo4pR9ky4tEsRdKsVrR6eas=",
			},
		};

		// First 3 requests should succeed (200 status)
		for (let i = 1; i <= 3; i++) {
			const req = new Request("http://localhost/v1/signers/start-onboarding", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authorization: env.ACCESS_SECRET,
				},
				body: JSON.stringify({
					...testData,
					deviceId: `${testData.deviceId}-${i}`, // Different device IDs
				}),
			});

			const res = await app.fetch(req);
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toEqual({ message: "OTP sent successfully" });
		}

		// 4th request should be rate limited (429 status)
		const req4 = new Request("http://localhost/v1/signers/start-onboarding", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				authorization: env.ACCESS_SECRET,
			},
			body: JSON.stringify({
				...testData,
				deviceId: `${testData.deviceId}-4`,
			}),
		});

		let res4: Response;
		try {
			res4 = await app.fetch(req4);
		} catch (error) {
			// In the test environment, the Response might be thrown
			if (error instanceof Response) {
				res4 = error;
			} else {
				throw error;
			}
		}

		expect(res4.status).toBe(429);

		const data4 = await res4.json();
		expect(data4.error).toContain("Too many devices onboarded recently");
		expect(data4.retryAfterHours).toBeGreaterThan(0);
	});
});
