import "./setup";
import { describe, expect, it, beforeEach, jest } from "bun:test";
import { InMemoryOTPSecurityService } from "../services/otp-security.service";

// Helper to reset singleton instance
function resetSecurityServiceSingleton() {
	(
		InMemoryOTPSecurityService as unknown as {
			instance: InMemoryOTPSecurityService | null;
		}
	).instance = null;
}

describe("InMemoryOTPSecurityService", () => {
	let securityService: InMemoryOTPSecurityService;

	beforeEach(() => {
		resetSecurityServiceSingleton();
		securityService = InMemoryOTPSecurityService.getInstance();
	});

	describe("Singleton Pattern", () => {
		it("should return the same instance on multiple calls", () => {
			const instance1 = InMemoryOTPSecurityService.getInstance();
			const instance2 = InMemoryOTPSecurityService.getInstance();

			expect(instance1).toBe(instance2);
		});

		it("should maintain state across getInstance calls", () => {
			const instance1 = InMemoryOTPSecurityService.getInstance();
			instance1.recordDeviceOnboarding("signer1", "auth1", "device1");

			const instance2 = InMemoryOTPSecurityService.getInstance();

			// Should not throw since device1 is already recorded
			expect(() =>
				instance2.validateDeviceOnboarding("signer1", "auth1", "device1"),
			).not.toThrow();
		});
	});

	describe("Device Onboarding Validation", () => {
		describe("Basic Validation", () => {
			it("should allow onboarding when no devices exist", () => {
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device1",
					),
				).not.toThrow();
			});

			it("should allow up to 3 devices for the same signerId/authId pair", () => {
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device1",
					),
				).not.toThrow();
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device2",
					),
				).not.toThrow();
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device3",
					),
				).not.toThrow();
			});

			it("should reject 4th device for the same signerId/authId pair", () => {
				// Record 3 devices
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				// 4th device should fail
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device4",
					),
				).toThrow();
			});
		});

		describe("Re-authentication", () => {
			it("should allow re-authentication for existing devices", () => {
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");

				// Re-authentication should work
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device1",
					),
				).not.toThrow();
			});

			it("should allow re-authentication even when at device limit", () => {
				// Record 3 devices
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				// All existing devices should still be able to re-authenticate
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device1",
					),
				).not.toThrow();
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device2",
					),
				).not.toThrow();
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device3",
					),
				).not.toThrow();

				// But new device should fail
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device4",
					),
				).toThrow();
			});
		});

		describe("Pair Isolation", () => {
			it("should track limits separately for different signerId values", () => {
				// Max out devices for signer1
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				// signer2 should still be allowed
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer2",
						"auth1",
						"device4",
					),
				).not.toThrow();
			});

			it("should track limits separately for different authId values", () => {
				// Max out devices for auth1
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				// auth2 should still be allowed
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth2",
						"device4",
					),
				).not.toThrow();
			});

			it("should handle complex combinations of signerId/authId pairs", () => {
				// Create multiple pairs with different device counts
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");

				securityService.recordDeviceOnboarding("signer1", "auth2", "device3");

				securityService.recordDeviceOnboarding("signer2", "auth1", "device4");
				securityService.recordDeviceOnboarding("signer2", "auth1", "device5");
				securityService.recordDeviceOnboarding("signer2", "auth1", "device6");

				// signer1:auth1 should allow 1 more device
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device7",
					),
				).not.toThrow();

				// signer1:auth2 should allow 2 more devices
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth2",
						"device8",
					),
				).not.toThrow();
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth2",
						"device9",
					),
				).not.toThrow();

				// signer2:auth1 should be at limit
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer2",
						"auth1",
						"device10",
					),
				).toThrow();
			});
		});

		describe("Time Window Behavior", () => {
			it("should reset limits after 6 hour window expires", () => {
				const originalNow = Date.now;
				const startTime = Date.now();
				Date.now = jest.fn(() => startTime);

				// Record 3 devices
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				// Should be at limit
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device4",
					),
				).toThrow();

				// Fast forward past 6 hour window
				Date.now = jest.fn(() => startTime + 7 * 60 * 60 * 1000);

				// Should allow new device
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device4",
					),
				).not.toThrow();

				Date.now = originalNow;
			});

			it("should only count devices within the 6 hour window", () => {
				const originalNow = Date.now;
				const startTime = Date.now();
				Date.now = jest.fn(() => startTime);

				// Record 2 devices at start time
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");

				// Fast forward 4 hours
				Date.now = jest.fn(() => startTime + 4 * 60 * 60 * 1000);

				// Record 1 more device (should be allowed)
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				// Fast forward another 3 hours (7 hours total, first 2 devices should be outside window)
				Date.now = jest.fn(() => startTime + 7 * 60 * 60 * 1000);

				// Should allow 2 more devices since only device3 is in window
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device4",
					),
				).not.toThrow();
				expect(() =>
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device5",
					),
				).not.toThrow();

				Date.now = originalNow;
			});
		});

		describe("Error Response Details", () => {
			it("should provide detailed error message when limit exceeded", async () => {
				// Record 3 devices
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				try {
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device4",
					);
					expect.unreachable("Should have thrown an error");
				} catch (response) {
					expect(response).toBeInstanceOf(Response);
					expect((response as Response).status).toBe(429);

					const errorData = JSON.parse(await (response as Response).text());
					expect(errorData.error).toContain(
						"Too many devices onboarded recently",
					);
					expect(errorData.error).toContain("Maximum 3 devices per 6 hours");
					expect(errorData).toHaveProperty("retryAfterHours");
					expect(typeof errorData.retryAfterHours).toBe("number");
				}
			});

			it("should calculate correct retry time", async () => {
				const originalNow = Date.now;
				const startTime = Date.now();
				Date.now = jest.fn(() => startTime);

				// Record 3 devices
				securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
				securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

				// Fast forward 2 hours
				Date.now = jest.fn(() => startTime + 2 * 60 * 60 * 1000);

				try {
					securityService.validateDeviceOnboarding(
						"signer1",
						"auth1",
						"device4",
					);
					expect.unreachable("Should have thrown an error");
				} catch (response) {
					const errorData = JSON.parse(await (response as Response).text());
					// Should be 4 hours until oldest device expires (6 - 2 = 4)
					expect(errorData.retryAfterHours).toBe(4);
				}

				Date.now = originalNow;
			});
		});
	});

	describe("Device Onboarding Recording", () => {
		it("should record device onboarding with correct timestamp", () => {
			const originalNow = Date.now;
			const fixedTime = 1234567890000;
			Date.now = jest.fn(() => fixedTime);

			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");

			// Verify by checking that we can't add 3 more devices (would exceed limit)
			securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device3");
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device4"),
			).toThrow();

			Date.now = originalNow;
		});

		it("should handle duplicate device recordings gracefully", () => {
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");

			// Multiple recordings of the same device still count as separate entries
			// But validation should still allow the same device to re-authenticate
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device1"),
			).not.toThrow();

			// The duplicate recordings do take up slots, so fewer new devices are allowed
			// Since we have 3 device1 recordings, no new devices should be allowed
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device2"),
			).toThrow();
		});

		it("should keep records within 12 hour window", () => {
			const originalNow = Date.now;
			const startTime = Date.now();
			Date.now = jest.fn(() => startTime);

			// Record 3 devices
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device2");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

			// Fast forward 5 hours (within 6 hour validation window and 12 hour cleanup window)
			Date.now = jest.fn(() => startTime + 5 * 60 * 60 * 1000);

			// Run cleanup
			securityService.cleanupOldRecords();

			// Should still be at limit since records weren't cleaned up (still within 6h window too)
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device4"),
			).toThrow();

			Date.now = originalNow;
		});
	});

	describe("Failed Attempt Tracking", () => {
		it("should return false for attempts below limit", () => {
			expect(securityService.recordFailedAttempt("device1", 1)).toBe(false);
			expect(securityService.recordFailedAttempt("device1", 2)).toBe(false);
		});

		it("should return true when reaching max attempts", () => {
			expect(securityService.recordFailedAttempt("device1", 3)).toBe(true);
		});

		it("should return true for attempts exceeding limit", () => {
			expect(securityService.recordFailedAttempt("device1", 4)).toBe(true);
			expect(securityService.recordFailedAttempt("device1", 10)).toBe(true);
		});

		it("should track attempts independently per device", () => {
			expect(securityService.recordFailedAttempt("device1", 1)).toBe(false);
			expect(securityService.recordFailedAttempt("device2", 1)).toBe(false);
			expect(securityService.recordFailedAttempt("device1", 2)).toBe(false);
			expect(securityService.recordFailedAttempt("device2", 3)).toBe(true);
			expect(securityService.recordFailedAttempt("device1", 3)).toBe(true);
		});

		it("should return correct max failed attempts", () => {
			expect(securityService.getMaxFailedAttempts()).toBe(3);
		});
	});

	describe("Cleanup Functionality", () => {
		it("should clean up records older than 12 hours", () => {
			const originalNow = Date.now;
			const startTime = Date.now();
			Date.now = jest.fn(() => startTime);

			// Record device at start time
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");

			// Fast forward 13 hours (past 12 hour cleanup threshold)
			Date.now = jest.fn(() => startTime + 13 * 60 * 60 * 1000);

			// Run cleanup
			securityService.cleanupOldRecords();

			// Should now allow 3 devices since old record was cleaned up
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

		it("should handle mixed old and new records", () => {
			const originalNow = Date.now;
			const startTime = Date.now();
			Date.now = jest.fn(() => startTime);

			// Record 2 devices at start time
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device2");

			// Fast forward 13 hours and record 1 more device
			Date.now = jest.fn(() => startTime + 13 * 60 * 60 * 1000);
			securityService.recordDeviceOnboarding("signer1", "auth1", "device3");

			// Run cleanup
			securityService.cleanupOldRecords();

			// Should allow 2 more devices (only device3 should remain)
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device4"),
			).not.toThrow();
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device5"),
			).not.toThrow();

			// But 3rd new device should fail
			securityService.recordDeviceOnboarding("signer1", "auth1", "device4");
			securityService.recordDeviceOnboarding("signer1", "auth1", "device5");
			expect(() =>
				securityService.validateDeviceOnboarding("signer1", "auth1", "device6"),
			).toThrow();

			Date.now = originalNow;
		});

		it("should remove empty pair entries after cleanup", () => {
			const originalNow = Date.now;
			const startTime = Date.now();
			Date.now = jest.fn(() => startTime);

			// Record device
			securityService.recordDeviceOnboarding("signer1", "auth1", "device1");

			// Fast forward past cleanup window
			Date.now = jest.fn(() => startTime + 13 * 60 * 60 * 1000);

			// Run cleanup
			securityService.cleanupOldRecords();

			// The pair entry should be completely removed, allowing fresh start
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

	describe("Edge Cases", () => {
		it("should handle empty string parameters", () => {
			expect(() =>
				securityService.validateDeviceOnboarding("", "", ""),
			).not.toThrow();
			expect(() =>
				securityService.recordDeviceOnboarding("", "", ""),
			).not.toThrow();
			expect(securityService.recordFailedAttempt("", 1)).toBe(false);
		});

		it("should handle special characters in IDs", () => {
			const specialChars = "signer:with/special\\chars@#$%";
			const authId = "auth?id=123&type=test";
			const deviceId = "device[]{|}";

			expect(() =>
				securityService.validateDeviceOnboarding(
					specialChars,
					authId,
					deviceId,
				),
			).not.toThrow();
			expect(() =>
				securityService.recordDeviceOnboarding(specialChars, authId, deviceId),
			).not.toThrow();
		});

		it("should handle very long ID strings", () => {
			const longId = "a".repeat(1000);

			expect(() =>
				securityService.validateDeviceOnboarding(longId, longId, longId),
			).not.toThrow();
			expect(() =>
				securityService.recordDeviceOnboarding(longId, longId, longId),
			).not.toThrow();
		});

		it("should handle zero and negative failed attempts", () => {
			expect(securityService.recordFailedAttempt("device1", 0)).toBe(false);
			expect(securityService.recordFailedAttempt("device1", -1)).toBe(false);
			expect(securityService.recordFailedAttempt("device1", -100)).toBe(false);
		});
	});
});
