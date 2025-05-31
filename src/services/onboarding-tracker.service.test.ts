import {
	describe,
	it,
	expect,
	beforeEach,
	mock,
	jest,
	afterEach,
} from "bun:test";
import { OnboardingTracker } from "./onboarding-tracker.service";

/**
 * TEST SUITE FOR ONBOARDING TRACKER
 *
 * Tests the core functionality of tracking device onboarding attempts
 * with configurable time windows and limits.
 */
describe("OnboardingTracker", () => {
	let tracker: OnboardingTracker;
	const originalNow = Date.now;

	// Test configuration - readable and clear
	const TEST_CONFIG = {
		WINDOW_HOURS: 6,
		MAX_DEVICES: 3,
		WINDOW_MS: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
	} as const;

	beforeEach(() => {
		tracker = new OnboardingTracker(
			TEST_CONFIG.WINDOW_MS,
			TEST_CONFIG.MAX_DEVICES,
		);

		// Mock console to keep test output clean
		console.log = mock(() => {});
		console.warn = mock(() => {});
		console.error = mock(() => {});
	});

	afterEach(() => {
		Date.now = originalNow;
		jest.restoreAllMocks();
	});

	describe("Basic Functionality", () => {
		it("should allow onboarding when no previous attempts exist", () => {
			expect(() => {
				tracker.trackAttempt("user1", "auth1");
			}).not.toThrow();
		});

		it("should allow multiple onboardings up to the configured limit", () => {
			const signerId = "user1";
			const authId = "auth1";

			// Should allow up to the max limit
			expect(() => {
				for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
					tracker.trackAttempt(signerId, authId);
				}
			}).not.toThrow();
		});

		it("should reject onboarding when limit is exceeded", async () => {
			const signerId = "user1";
			const authId = "auth1";

			// Fill up to the limit
			for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
				tracker.trackAttempt(signerId, authId);
			}

			// The next attempt should be rejected
			try {
				tracker.trackAttempt(signerId, authId);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);

				const data = await (error as Response).json();
				expect(data.error).toContain("Too many devices onboarded recently");
				expect(data.retryAfterHours).toBeGreaterThan(0);
			}
		});
	});

	describe("Time Window Behavior", () => {
		it("should reset limits after the time window expires", () => {
			const signerId = "user1";
			const authId = "auth1";

			// Fill up to the limit
			for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
				tracker.trackAttempt(signerId, authId);
			}

			// Move time forward beyond the window
			const futureTime =
				originalNow() + (TEST_CONFIG.WINDOW_HOURS + 1) * 60 * 60 * 1000;
			Date.now = mock(() => futureTime);

			// Should now allow new onboarding
			expect(() => {
				tracker.trackAttempt(signerId, authId);
			}).not.toThrow();
		});

		it("should count only recent onboardings within the time window", async () => {
			const signerId = "user1";
			const authId = "auth1";

			// Add one onboarding
			tracker.trackAttempt(signerId, authId);

			// Move time forward beyond the window
			Date.now = mock(
				() => originalNow() + (TEST_CONFIG.WINDOW_HOURS + 1) * 60 * 60 * 1000,
			);

			// Add more onboardings (should start fresh count)
			for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
				tracker.trackAttempt(signerId, authId);
			}

			// Should now be at limit again
			try {
				tracker.trackAttempt(signerId, authId);
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});
	});

	describe("User Isolation", () => {
		it("should track limits separately for different signer/auth combinations", () => {
			const user1 = { signerId: "user1", authId: "auth1" };
			const user2 = { signerId: "user2", authId: "auth2" };

			// Fill up user1's limit
			for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
				tracker.trackAttempt(user1.signerId, user1.authId);
			}

			// User2 should still be able to onboard
			expect(() => {
				tracker.trackAttempt(user2.signerId, user2.authId);
			}).not.toThrow();
		});

		it("should maintain separate counts for different auth methods of same user", async () => {
			const signerId = "user1";
			const auth1 = "email:user@example.com";
			const auth2 = "phone:+1234567890";

			// Fill up limit for first auth method
			for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
				tracker.trackAttempt(signerId, auth1);
			}

			// Second auth method should still work
			expect(() => {
				tracker.trackAttempt(signerId, auth2);
			}).not.toThrow();

			// But first auth method should be blocked
			try {
				tracker.trackAttempt(signerId, auth1);
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});
	});

	describe("Memory Management", () => {
		it("should clean up old records that are outside the tracking window", () => {
			const signerId = "user1";
			const authId = "auth1";

			// Create some onboarding records
			tracker.trackAttempt(signerId, authId);
			tracker.trackAttempt(signerId, authId);

			// Move time beyond the tracking window
			Date.now = mock(
				() => originalNow() + (TEST_CONFIG.WINDOW_HOURS + 1) * 60 * 60 * 1000,
			);

			// Run cleanup
			tracker.cleanupOldRecords();

			// Should now allow the full limit again since old records are cleaned
			expect(() => {
				for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
					tracker.trackAttempt(signerId, authId);
				}
			}).not.toThrow();
		});

		it("should not clean up recent records within the tracking window", async () => {
			const signerId = "user1";
			const authId = "auth1";

			// Fill up to the limit
			for (let i = 1; i <= TEST_CONFIG.MAX_DEVICES; i++) {
				tracker.trackAttempt(signerId, authId);
			}

			// Move time forward but stay within the window
			Date.now = mock(
				() => originalNow() + (TEST_CONFIG.WINDOW_HOURS - 1) * 60 * 60 * 1000,
			);

			// Run cleanup
			tracker.cleanupOldRecords();

			// Should still be at the limit
			try {
				tracker.trackAttempt(signerId, authId);
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});

		it("should handle cleanup when no records exist", () => {
			expect(() => {
				tracker.cleanupOldRecords();
			}).not.toThrow();
		});
	});

	describe("Configuration Flexibility", () => {
		it("should work with custom time windows and limits", async () => {
			// Create tracker with different configuration
			const customTracker = new OnboardingTracker(
				2 * 60 * 60 * 1000, // 2 hours
				5, // 5 max devices
			);

			const signerId = "user1";
			const authId = "auth1";

			// Should allow up to 5 devices
			expect(() => {
				for (let i = 1; i <= 5; i++) {
					customTracker.trackAttempt(signerId, authId);
				}
			}).not.toThrow();

			// 6th device should be rejected
			try {
				customTracker.trackAttempt(signerId, authId);
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(429);
			}
		});
	});
});
