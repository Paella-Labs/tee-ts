import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	mock,
	jest,
} from "bun:test";
import { InMemoryOTPService } from "./otp.service";
import { OnboardingTracker } from "./onboarding-tracker.service";

/**
 * SECURITY AUDIT TEST SUITE FOR OTP SERVICE
 *
 * This test suite covers all critical security scenarios for the OTP service
 * using real instances of security components for audit verification.
 *
 * SECURITY PARAMETERS:
 * - OTP Expiry: 5 minutes
 * - OTP Cleanup Grace Period: 1 hour after expiry
 * - Max Failed Attempts: 3 per device
 * - Device Onboarding Window: 6 hours
 * - Max Devices Per Window: 3 per signerId/authId combination
 */
describe("InMemoryOTPService - Security Audit", () => {
	let otpService: InMemoryOTPService;
	let securityService: OnboardingTracker;
	let originalDateNow: typeof Date.now;

	// Security configuration constants for audit visibility
	const SECURITY_CONFIG = {
		OTP_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
		OTP_CLEANUP_GRACE_PERIOD_MS: 60 * 60 * 1000, // 1 hour
		MAX_FAILED_ATTEMPTS: 3,
		DEVICE_ONBOARDING_WINDOW_MS: 6 * 60 * 60 * 1000, // 6 hours
		MAX_DEVICES_PER_WINDOW: 3,
	} as const;

	beforeEach(() => {
		// Store original Date.now for cleanup
		originalDateNow = Date.now;

		// Create real security service instance for audit verification
		securityService = new OnboardingTracker(
			SECURITY_CONFIG.DEVICE_ONBOARDING_WINDOW_MS,
			SECURITY_CONFIG.MAX_DEVICES_PER_WINDOW,
		);

		// Create OTP service with real security service
		otpService = new InMemoryOTPService(securityService);

		// Mock console to avoid test output noise while preserving audit trail
		console.log = mock(() => {});
		console.warn = mock(() => {});
		console.error = mock(() => {});
	});

	afterEach(() => {
		// Restore original Date.now to prevent test interference
		Date.now = originalDateNow;
		jest.restoreAllMocks();
	});

	describe("SECURITY TEST: Device Onboarding Limits", () => {
		it("AUDIT: Should allow OTP generation when device onboarding is within limits", () => {
			// SECURITY SCENARIO: Normal operation within device limits
			const signerId = "audit-signer-1";
			const authId = "email:audit1@example.com";
			const deviceId = "device-1";

			// ACT: Generate OTP within security limits
			expect(() => {
				const otp = otpService.generateOTP(signerId, authId, deviceId);
				expect(otp).toMatch(/^\d{6}$/); // Verify OTP format
			}).not.toThrow();
		});

		it("AUDIT: Should block OTP generation when device onboarding limit exceeded", async () => {
			// SECURITY SCENARIO: Device onboarding rate limiting enforcement
			const signerId = "audit-signer-limit";
			const authId = "email:limit@example.com";

			// SETUP: Reach maximum device onboarding limit (3 devices)
			for (let i = 1; i <= SECURITY_CONFIG.MAX_DEVICES_PER_WINDOW; i++) {
				otpService.generateOTP(signerId, authId, `device-${i}`);
			}

			// ACT & ASSERT: Fourth device should be blocked
			try {
				otpService.generateOTP(signerId, authId, "device-4-blocked");
				expect(true).toBe(false); // Should never reach here
			} catch (error) {
				// SECURITY VALIDATION: Verify rate limiting error
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);

				const errorData = await (error as Response).json();
				expect(errorData.error).toContain(
					"Too many devices onboarded recently",
				);
				expect(errorData.retryAfterHours).toBeGreaterThan(0);
			}
		});

		it("AUDIT: Should allow device onboarding after security window expires", () => {
			// SECURITY SCENARIO: Time-based security window reset
			const signerId = "audit-signer-window";
			const authId = "email:window@example.com";

			// SETUP: Reach device limit
			for (let i = 1; i <= SECURITY_CONFIG.MAX_DEVICES_PER_WINDOW; i++) {
				otpService.generateOTP(signerId, authId, `device-${i}`);
			}

			// ACT: Simulate time passing beyond security window (7 hours)
			const futureTime = originalDateNow() + 7 * 60 * 60 * 1000;
			Date.now = mock(() => futureTime);

			// ASSERT: Should allow new device onboarding after window expires
			expect(() => {
				otpService.generateOTP(signerId, authId, "device-after-window");
			}).not.toThrow();
		});

		it("AUDIT: Should isolate device limits between different signerId/authId pairs", async () => {
			// SECURITY SCENARIO: Isolation between different user contexts
			const signer1 = "audit-signer-1";
			const auth1 = "email:user1@example.com";
			const signer2 = "audit-signer-2";
			const auth2 = "email:user2@example.com";

			// SETUP: Max out first user's device limit
			for (let i = 1; i <= SECURITY_CONFIG.MAX_DEVICES_PER_WINDOW; i++) {
				otpService.generateOTP(signer1, auth1, `user1-device-${i}`);
			}

			// ACT & ASSERT: Second user should not be affected
			expect(() => {
				otpService.generateOTP(signer2, auth2, "user2-device-1");
			}).not.toThrow();

			// VERIFY: First user is still blocked
			try {
				otpService.generateOTP(signer1, auth1, "user1-blocked");
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});
	});

	describe("SECURITY TEST: OTP Expiration", () => {
		it("AUDIT: Should reject expired OTP", async () => {
			// SECURITY SCENARIO: Time-based OTP expiration enforcement
			const signerId = "audit-signer-expiry";
			const authId = "email:expiry@example.com";
			const deviceId = "device-expiry";

			// SETUP: Generate OTP
			const otp = otpService.generateOTP(signerId, authId, deviceId);

			// ACT: Simulate time passing beyond OTP expiry (6 minutes > 5 minute limit)
			const expiredTime = originalDateNow() + 6 * 60 * 1000;
			Date.now = mock(() => expiredTime);

			// ASSERT: Expired OTP should be rejected
			try {
				otpService.verifyOTP(deviceId, otp);
				expect(true).toBe(false); // Should never reach here
			} catch (error) {
				// SECURITY VALIDATION: Verify expiration error
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(401);

				const errorData = await (error as Response).json();
				expect(errorData.error).toBe("OTP has expired");
			}
		});

		it("AUDIT: Should accept valid OTP within expiry window", () => {
			// SECURITY SCENARIO: Valid OTP within time limits
			const signerId = "audit-signer-valid";
			const authId = "email:valid@example.com";
			const deviceId = "device-valid";

			// ACT: Generate and immediately verify OTP
			const otp = otpService.generateOTP(signerId, authId, deviceId);
			const result = otpService.verifyOTP(deviceId, otp);

			// ASSERT: Valid verification
			expect(result).toBeDefined();
			expect(result.signerId).toBe(signerId);
			expect(result.authId).toBe(authId);
			expect(result.deviceId).toBe(deviceId);
		});
	});

	describe("SECURITY TEST: Failed OTP Attempts", () => {
		it("AUDIT: Should track failed attempts but allow retry when under limit", async () => {
			// SECURITY SCENARIO: Failed attempt tracking with retry allowance
			const signerId = "audit-signer-retry";
			const authId = "email:retry@example.com";
			const deviceId = "device-retry";

			// SETUP: Generate OTP
			otpService.generateOTP(signerId, authId, deviceId);

			// ACT: Submit incorrect OTP (attempt 1 of 3)
			try {
				otpService.verifyOTP(deviceId, "000000");
				expect(true).toBe(false);
			} catch (error) {
				// SECURITY VALIDATION: Verify failed attempt tracking
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(401);

				const errorData = await (error as Response).json();
				expect(errorData.error).toBe("Invalid OTP (1/3 attempts)");
			}

			// ASSERT: Should still allow another attempt
			try {
				otpService.verifyOTP(deviceId, "111111");
				expect(true).toBe(false);
			} catch (error) {
				const errorData = await (error as Response).json();
				expect(errorData.error).toBe("Invalid OTP (2/3 attempts)");
			}
		});

		it("AUDIT: Should invalidate OTP after maximum failed attempts", async () => {
			// SECURITY SCENARIO: OTP invalidation after max failed attempts
			const signerId = "audit-signer-maxfail";
			const authId = "email:maxfail@example.com";
			const deviceId = "device-maxfail";

			// SETUP: Generate OTP
			const validOtp = otpService.generateOTP(signerId, authId, deviceId);

			// ACT: Make 2 failed attempts (which should still allow the OTP to exist)
			for (
				let attempt = 1;
				attempt < SECURITY_CONFIG.MAX_FAILED_ATTEMPTS;
				attempt++
			) {
				try {
					otpService.verifyOTP(deviceId, "000000");
					expect(true).toBe(false);
				} catch (error) {
					expect(error).toBeInstanceOf(Response);
					expect((error as Response).status).toBe(401);
				}
			}

			// ASSERT: Third failed attempt should invalidate the OTP completely
			try {
				otpService.verifyOTP(deviceId, "111111"); // 3rd failed attempt should invalidate
				expect(true).toBe(false);
			} catch (error) {
				// SECURITY VALIDATION: OTP should be invalidated after reaching max attempts
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(401);

				const errorData = await (error as Response).json();
				expect(errorData.error).toContain(
					"OTP invalidated after 3 failed attempts",
				);
			}

			// VERIFY: Even correct OTP should now be rejected (OTP was deleted)
			try {
				otpService.verifyOTP(deviceId, validOtp);
				expect(true).toBe(false);
			} catch (error) {
				// SECURITY VALIDATION: OTP should be completely removed
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(400); // Not pending anymore

				const errorData = await (error as Response).json();
				expect(errorData.error).toContain("is not pending");
			}
		});
	});

	describe("SECURITY TEST: Replay Attack Protection", () => {
		it("AUDIT: Should prevent OTP reuse (replay attack protection)", async () => {
			// SECURITY SCENARIO: Prevent replay attacks with used OTPs
			const signerId = "audit-signer-replay";
			const authId = "email:replay@example.com";
			const deviceId = "device-replay";

			// SETUP: Generate and successfully verify OTP
			const otp = otpService.generateOTP(signerId, authId, deviceId);
			const firstResult = otpService.verifyOTP(deviceId, otp);
			expect(firstResult).toBeDefined();

			// ACT & ASSERT: Attempt to reuse the same OTP
			try {
				otpService.verifyOTP(deviceId, otp);
				expect(true).toBe(false); // Should never reach here
			} catch (error) {
				// SECURITY VALIDATION: Replay protection
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(400);

				const errorData = await (error as Response).json();
				expect(errorData.error).toContain("is not pending");
			}
		});
	});

	describe("SECURITY TEST: Invalid Device Context", () => {
		it("AUDIT: Should reject OTP verification for non-existent device", async () => {
			// SECURITY SCENARIO: Protection against device spoofing
			const nonExistentDevice = "non-existent-device";

			// ACT & ASSERT: Attempt to verify OTP for device without pending authentication
			try {
				otpService.verifyOTP(nonExistentDevice, "123456");
				expect(true).toBe(false);
			} catch (error) {
				// SECURITY VALIDATION: Device validation
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(400);

				const errorData = await (error as Response).json();
				expect(errorData.error).toContain("Authentication for device");
				expect(errorData.error).toContain("is not pending");
			}
		});
	});

	describe("SECURITY TEST: Cleanup and Memory Management", () => {
		it("AUDIT: Should clean up expired OTPs after grace period", async () => {
			// SECURITY SCENARIO: Secure cleanup of expired authentication data
			const signerId = "audit-signer-cleanup";
			const authId = "email:cleanup@example.com";
			const deviceId = "device-cleanup";

			// SETUP: Generate OTP
			const otp = otpService.generateOTP(signerId, authId, deviceId);

			// ACT: Simulate time passing beyond cleanup grace period (1 hour 6 minutes)
			const cleanupTime = originalDateNow() + 66 * 60 * 1000;
			Date.now = mock(() => cleanupTime);

			// Trigger cleanup
			otpService.cleanup();

			// ASSERT: OTP should be completely removed from memory
			try {
				otpService.verifyOTP(deviceId, otp);
				expect(true).toBe(false);
			} catch (error) {
				// SECURITY VALIDATION: Data cleanup verification
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(400);

				const errorData = await (error as Response).json();
				expect(errorData.error).toContain("is not pending");
				expect(errorData.error).not.toContain("OTP has expired");
			}
		});
	});

	describe("SECURITY TEST: Concurrent Operations", () => {
		it("AUDIT: Should handle multiple concurrent OTP operations safely", () => {
			// SECURITY SCENARIO: Concurrent access safety
			const signerId = "audit-signer-concurrent";
			const authId = "email:concurrent@example.com";

			// ACT: Generate multiple OTPs for different devices simultaneously
			const results: string[] = [];
			for (let i = 1; i <= 3; i++) {
				const otp = otpService.generateOTP(
					signerId,
					authId,
					`concurrent-device-${i}`,
				);
				results.push(otp);
			}

			// ASSERT: All OTPs should be unique and valid
			const uniqueOtps = new Set(results);
			expect(uniqueOtps.size).toBe(3); // All OTPs should be unique

			// Verify each OTP works for its respective device
			for (let i = 0; i < 3; i++) {
				const otp = results[i];
				expect(otp).toBeDefined();
				if (otp) {
					const result = otpService.verifyOTP(
						`concurrent-device-${i + 1}`,
						otp,
					);
					expect(result.deviceId).toBe(`concurrent-device-${i + 1}`);
				}
			}
		});
	});
});
