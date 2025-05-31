import {
	describe,
	it,
	expect,
	beforeEach,
	mock,
	jest,
	afterEach,
} from "bun:test";
import { InMemoryOTPSecurityService } from "./otp-security.service";

describe("InMemoryOTPSecurityService", () => {
	let service: InMemoryOTPSecurityService;
	const originalNow = Date.now;

	beforeEach(() => {
		service = InMemoryOTPSecurityService.getInstance();
		// biome-ignore lint/suspicious/noExplicitAny:
		(service as any).onboardingHistory.clear();
		// Mock console to avoid test output noise
		console.log = mock(() => {});
		console.warn = mock(() => {});
		console.error = mock(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
		Date.now = originalNow;
	});

	describe("validateDeviceOnboarding", () => {
		it("should allow device onboarding when under limit", () => {
			expect(() => {
				service.validateDeviceOnboarding("signer1", "auth1");
			}).not.toThrow();
		});

		it("should throw error when device limit exceeded", async () => {
			// Record max devices (3)
			for (let i = 1; i <= 3; i++) {
				service.recordDeviceOnboarding("signer1", "auth1");
			}

			try {
				service.validateDeviceOnboarding("signer1", "auth1");
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
				const data = await (error as Response).json();
				expect(data.error).toContain("Too many devices onboarded recently");
				expect(data.retryAfterHours).toBeGreaterThan(0);
			}
		});

		it("should allow onboarding after time window expires", () => {
			// Record max devices
			for (let i = 1; i <= 3; i++) {
				service.recordDeviceOnboarding("signer1", "auth1");
			}

			// Mock time 7 hours later (beyond 6-hour window)
			Date.now = mock(() => originalNow() + 7 * 60 * 60 * 1000);

			expect(() => {
				service.validateDeviceOnboarding("signer1", "auth1");
			}).not.toThrow();
		});
	});

	describe("recordDeviceOnboarding", () => {
		it("should record device onboarding successfully", () => {
			expect(() => {
				service.recordDeviceOnboarding("signer1", "auth1");
			}).not.toThrow();
		});

		it("should handle multiple onboardings for different pairs", () => {
			service.recordDeviceOnboarding("signer1", "auth1");
			service.recordDeviceOnboarding("signer2", "auth2");

			// Both should be valid
			expect(() => {
				service.validateDeviceOnboarding("signer1", "auth1");
				service.validateDeviceOnboarding("signer2", "auth2");
			}).not.toThrow();
		});
	});

	describe("recordFailedAttempt", () => {
		it("should return false when under max attempts", () => {
			expect(service.validateFailedAttempt("device1", 1)).toBe(false);
			expect(service.validateFailedAttempt("device1", 2)).toBe(false);
		});

		it("should return true when max attempts reached", () => {
			expect(service.validateFailedAttempt("device1", 3)).toBe(true);
		});

		it("should return true when exceeding max attempts", () => {
			expect(service.validateFailedAttempt("device1", 4)).toBe(true);
		});
	});

	describe("getMaxFailedAttempts", () => {
		it("should return correct max failed attempts", () => {
			expect(service.getMaxFailedAttempts()).toBe(3);
		});
	});

	describe("cleanupOldRecords", () => {
		it("should remove old onboarding records", () => {
			// Record some devices
			service.recordDeviceOnboarding("signer1", "auth1");
			service.recordDeviceOnboarding("signer1", "auth1");

			// Mock time 13 hours later (beyond 2x window = 12 hours)
			Date.now = mock(() => originalNow() + 13 * 60 * 60 * 1000);

			service.cleanupOldRecords();

			// Should now allow 3 new devices since old records are cleaned
			expect(() => {
				for (let i = 1; i <= 3; i++) {
					service.validateDeviceOnboarding("signer1", "auth1");
				}
			}).not.toThrow();
		});

		it("should not remove recent records", () => {
			// Record max devices
			for (let i = 1; i <= 3; i++) {
				service.recordDeviceOnboarding("signer1", "auth1");
			}

			// Mock time 5 hours later (within cleanup threshold)
			Date.now = mock(() => originalNow() + 5 * 60 * 60 * 1000);

			service.cleanupOldRecords();

			// Should still be at limit
			try {
				service.validateDeviceOnboarding("signer1", "auth1");
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});
	});

	describe("singleton pattern", () => {
		it("should return same instance", () => {
			const instance1 = InMemoryOTPSecurityService.getInstance();
			const instance2 = InMemoryOTPSecurityService.getInstance();
			expect(instance1).toBe(instance2);
		});
	});
});
