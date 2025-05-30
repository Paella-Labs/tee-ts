import "./setup";
import { describe, expect, it, beforeEach, jest } from "bun:test";
import { InMemoryOTPService } from "../services/otp.service";
import {
	InMemoryOTPSecurityService,
	type OTPSecurityService,
} from "../services/otp-security.service";

// Helper to reset singleton instances
function resetSingletons() {
	// Reset OTP service singleton
	(
		InMemoryOTPService as unknown as { instance: InMemoryOTPService | null }
	).instance = null;
	// Reset security service singleton
	(
		InMemoryOTPSecurityService as unknown as {
			instance: InMemoryOTPSecurityService | null;
		}
	).instance = null;
}

describe("OTP Service", () => {
	let otpService: InMemoryOTPService;
	let securityService: InMemoryOTPSecurityService;

	beforeEach(() => {
		resetSingletons();
		securityService = InMemoryOTPSecurityService.getInstance();
		otpService = InMemoryOTPService.getInstance(securityService);
	});

	describe("OTP Generation", () => {
		it("should generate a 6-digit OTP", () => {
			const otp = otpService.generateOTP("signer1", "auth1", "device1");

			expect(otp).toMatch(/^\d{6}$/);
		});

		it("should generate different OTPs for each call", () => {
			const otp1 = otpService.generateOTP("signer1", "auth1", "device1");
			const otp2 = otpService.generateOTP("signer2", "auth2", "device2");

			expect(otp1).not.toBe(otp2);
		});

		it("should enforce device limits when generating OTP", () => {
			// First 3 devices should succeed - they just validate, don't record yet
			expect(() =>
				otpService.generateOTP("signer1", "auth1", "device1"),
			).not.toThrow();
			expect(() =>
				otpService.generateOTP("signer1", "auth1", "device2"),
			).not.toThrow();
			expect(() =>
				otpService.generateOTP("signer1", "auth1", "device3"),
			).not.toThrow();

			// Now verify the OTPs to record the onboardings
			const otp1 = otpService.generateOTP("signer1", "auth1", "device1");
			const otp2 = otpService.generateOTP("signer1", "auth1", "device2");
			const otp3 = otpService.generateOTP("signer1", "auth1", "device3");

			otpService.verifyOTP("device1", otp1);
			otpService.verifyOTP("device2", otp2);
			otpService.verifyOTP("device3", otp3);

			// 4th device should fail
			expect(() =>
				otpService.generateOTP("signer1", "auth1", "device4"),
			).toThrow();
		});

		it("should allow re-authentication for existing devices", () => {
			// Initial onboarding
			const otp1 = otpService.generateOTP("signer1", "auth1", "device1");
			otpService.verifyOTP("device1", otp1);

			// Re-authentication should work
			expect(() =>
				otpService.generateOTP("signer1", "auth1", "device1"),
			).not.toThrow();
		});
	});

	describe("OTP Verification", () => {
		it("should verify correct OTP", () => {
			const otp = otpService.generateOTP("signer1", "auth1", "device1");
			const result = otpService.verifyOTP("device1", otp);

			expect(result.signerId).toBe("signer1");
			expect(result.authId).toBe("auth1");
			expect(result.deviceId).toBe("device1");
			expect(result.otp).toBe(otp);
		});

		it("should throw error for non-existent device", () => {
			expect(() => otpService.verifyOTP("nonexistent", "123456")).toThrow();
		});

		it("should throw error for incorrect OTP", () => {
			otpService.generateOTP("signer1", "auth1", "device1");

			expect(() => otpService.verifyOTP("device1", "000000")).toThrow();
		});

		it("should track failed attempts and show progress", async () => {
			const otp = otpService.generateOTP("signer1", "auth1", "device1");

			// First failed attempt
			try {
				otpService.verifyOTP("device1", "000000");
			} catch (response) {
				const errorText = await (response as Response).text();
				const error = JSON.parse(errorText);
				expect(error.error).toContain("(1/3 attempts)");
			}

			// Second failed attempt
			try {
				otpService.verifyOTP("device1", "000000");
			} catch (response) {
				const errorText = await (response as Response).text();
				const error = JSON.parse(errorText);
				expect(error.error).toContain("(2/3 attempts)");
			}
		});

		it("should invalidate OTP after max failed attempts", () => {
			const otp = otpService.generateOTP("signer1", "auth1", "device1");

			// 3 failed attempts
			expect(() => otpService.verifyOTP("device1", "000000")).toThrow();
			expect(() => otpService.verifyOTP("device1", "000000")).toThrow();
			expect(() => otpService.verifyOTP("device1", "000000")).toThrow();

			// Now even the correct OTP should fail
			expect(() => otpService.verifyOTP("device1", otp)).toThrow();
		});

		it("should remove OTP after successful verification", () => {
			const otp = otpService.generateOTP("signer1", "auth1", "device1");
			otpService.verifyOTP("device1", otp);

			// Second verification should fail
			expect(() => otpService.verifyOTP("device1", otp)).toThrow();
		});
	});

	describe("OTP Expiration", () => {
		it("should reject expired OTP", () => {
			const originalNow = Date.now;
			const startTime = Date.now();
			Date.now = jest.fn(() => startTime);

			const otp = otpService.generateOTP("signer1", "auth1", "device1");

			// Fast forward past expiry time (5 minutes)
			Date.now = jest.fn(() => startTime + 6 * 60 * 1000);

			expect(() => otpService.verifyOTP("device1", otp)).toThrow();

			Date.now = originalNow;
		});
	});
});

describe("OTP Security Service", () => {
	let securityService: InMemoryOTPSecurityService;

	beforeEach(() => {
		resetSingletons();
		securityService = InMemoryOTPSecurityService.getInstance();
	});

	describe("Device Onboarding Limits", () => {
		it("should allow up to 3 devices per signerId/authId pair", () => {
			// These should just validate, not record
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device1"),
			).not.toThrow();
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device2"),
			).not.toThrow();
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device3"),
			).not.toThrow();
		});

		it("should reject 4th device onboarding", () => {
			// Onboard 3 devices by recording them
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

			// 4th device should fail validation
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device4"),
			).toThrow();
		});

		it("should allow re-authentication for existing devices", () => {
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");

			// Re-authentication should work
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device1"),
			).not.toThrow();
		});

		it("should track limits separately for different signerId/authId pairs", () => {
			// Onboard 3 devices for first pair
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

			// Should still allow devices for different pairs
			expect(() =>
				securityService.validateDeviceOnboarding("signer2", "auth1", "device4"),
			).not.toThrow();
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth2", "device5"),
			).not.toThrow();
		});

		it("should reset limits after time window", () => {
			const originalNow = Date.now;
			const startTime = Date.now();
			Date.now = jest.fn(() => startTime);

			// Onboard 3 devices
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

			// Fast forward past 6 hour window
			Date.now = jest.fn(() => startTime + 7 * 60 * 60 * 1000);

			// Should allow new device onboarding
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device4"),
			).not.toThrow();

			Date.now = originalNow;
		});
	});

	describe("Failed Attempt Tracking", () => {
		it("should track failed attempts", () => {
			expect(securityService.recordFailedAttempt("device1", 1)).toBe(false);
			expect(securityService.recordFailedAttempt("device1", 2)).toBe(false);
			expect(securityService.recordFailedAttempt("device1", 3)).toBe(true);
		});

		it("should return max failed attempts", () => {
			expect(securityService.getMaxFailedAttempts()).toBe(3);
		});
	});

	describe("Cleanup", () => {
		it("should clean up old onboarding records", () => {
			const originalNow = Date.now;
			const startTime = Date.now();
			Date.now = jest.fn(() => startTime);

			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");

			// Fast forward past cleanup window (12 hours = 2x the 6 hour tracking window)
			Date.now = jest.fn(() => startTime + 13 * 60 * 60 * 1000);

			securityService.cleanupOldRecords();

			// Should allow full 3 devices again since old records are cleaned up
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device2"),
			).not.toThrow();
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device3"),
			).not.toThrow();
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device4"),
			).not.toThrow();

			Date.now = originalNow;
		});
	});
});

describe("Dependency Injection", () => {
	beforeEach(() => {
		resetSingletons();
	});

	it("should use injected security service", () => {
		const mockSecurity: OTPSecurityService = {
			validateDeviceOnboarding: jest.fn(),
			recordDeviceOnboarding: jest.fn(),
			recordFailedAttempt: jest.fn(() => false),
			getMaxFailedAttempts: jest.fn(() => 5),
			cleanupOldRecords: jest.fn(),
		};

		const otpService = InMemoryOTPService.getInstance(mockSecurity);
		const otp = otpService.generateOTP("signer1", "auth1", "device1");

		expect(mockSecurity.validateDeviceOnboarding).toHaveBeenCalledWith(
			"signer1",
			"auth1",
			"device1",
		);

		otpService.verifyOTP("device1", otp);
		expect(mockSecurity.recordDeviceOnboarding).toHaveBeenCalledWith(
			"signer1",
			"auth1",
			"device1",
		);
	});
});
