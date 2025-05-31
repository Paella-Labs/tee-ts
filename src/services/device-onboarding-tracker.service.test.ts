import {
	describe,
	it,
	expect,
	beforeEach,
	mock,
	jest,
	afterEach,
} from "bun:test";
import { DeviceOnboardingTracker } from "./device-onboarding-tracker.service";

describe("DeviceOnboardingTracker", () => {
	let tracker: DeviceOnboardingTracker;
	const originalNow = Date.now;
	const WINDOW_HOURS = 6;
	const MAX_ONBOARDS = 3;

	beforeEach(() => {
		tracker = new DeviceOnboardingTracker(
			WINDOW_HOURS * 60 * 60 * 1000, // Convert hours to milliseconds
			MAX_ONBOARDS,
		);
		// Mock console to avoid test output noise
		console.log = mock(() => {});
		console.warn = mock(() => {});
		console.error = mock(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
		Date.now = originalNow;
	});

	describe("trackDeviceOnboardingAttempt", () => {
		it("should allow device onboarding when under limit", () => {
			expect(() => {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			}).not.toThrow();
		});

		it("should allow multiple onboardings up to the limit", () => {
			expect(() => {
				for (let i = 1; i <= MAX_ONBOARDS; i++) {
					tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				}
			}).not.toThrow();
		});

		it("should throw error when device limit exceeded", async () => {
			// Record max devices first
			for (let i = 1; i <= MAX_ONBOARDS; i++) {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			}

			try {
				// This should exceed the limit
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				expect(true).toBe(false); // Should not reach here
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
			for (let i = 1; i <= MAX_ONBOARDS; i++) {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			}

			// Mock time 7 hours later (beyond 6-hour window)
			Date.now = mock(() => originalNow() + 7 * 60 * 60 * 1000);

			expect(() => {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			}).not.toThrow();
		});

		it("should handle multiple onboardings for different signer/auth pairs", () => {
			tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			tracker.trackDeviceOnboardingAttempt("signer2", "auth2");

			// Both should be valid - different pairs have separate limits
			expect(() => {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				tracker.trackDeviceOnboardingAttempt("signer2", "auth2");
			}).not.toThrow();
		});

		it("should track limits separately for different pairs", async () => {
			// Max out signer1:auth1
			for (let i = 1; i <= MAX_ONBOARDS; i++) {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			}

			// signer2:auth2 should still work
			expect(() => {
				tracker.trackDeviceOnboardingAttempt("signer2", "auth2");
			}).not.toThrow();

			// But signer1:auth1 should be blocked
			try {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});
	});

	describe("cleanupOldRecords", () => {
		it("should remove old onboarding records", () => {
			// Record some devices
			tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			tracker.trackDeviceOnboardingAttempt("signer1", "auth1");

			// Mock time beyond window (should trigger cleanup)
			Date.now = mock(
				() => originalNow() + (WINDOW_HOURS + 1) * 60 * 60 * 1000,
			);

			tracker.cleanupOldRecords();

			// Should now allow MAX_ONBOARDS new devices since old records are cleaned
			expect(() => {
				for (let i = 1; i <= MAX_ONBOARDS; i++) {
					tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				}
			}).not.toThrow();
		});

		it("should not remove recent records", async () => {
			// Record max devices
			for (let i = 1; i <= MAX_ONBOARDS; i++) {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
			}

			// Mock time within the window (records should not be cleaned)
			Date.now = mock(
				() => originalNow() + (WINDOW_HOURS - 1) * 60 * 60 * 1000,
			);

			tracker.cleanupOldRecords();

			// Should still be at limit
			try {
				tracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});

		it("should handle cleanup with no records", () => {
			expect(() => {
				tracker.cleanupOldRecords();
			}).not.toThrow();
		});
	});

	describe("constructor", () => {
		it("should create tracker with custom parameters", () => {
			const customTracker = new DeviceOnboardingTracker(
				2 * 60 * 60 * 1000, // 2 hours
				5, // 5 max onboards
			);

			expect(() => {
				for (let i = 1; i <= 5; i++) {
					customTracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				}
			}).not.toThrow();

			// 6th attempt should fail
			try {
				customTracker.trackDeviceOnboardingAttempt("signer1", "auth1");
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
			}
		});
	});
});
