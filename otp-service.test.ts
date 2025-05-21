import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	mock,
	jest,
} from "bun:test";
import { InMemoryOTPService } from "./otp-service";

describe("InMemoryOTPService", () => {
	let otpService: InMemoryOTPService;

	beforeEach(() => {
		// Get a fresh instance for each test
		otpService = InMemoryOTPService.getInstance();

		// Mock console methods to avoid cluttering test output
		console.log = mock(() => {});
		console.warn = mock(() => {});
		console.error = mock(() => {});
	});

	afterEach(() => {
		// Restore console functions
		jest.restoreAllMocks();
	});

	it("should generate and verify an OTP successfully", () => {
		// Arrange
		const userId = "test-user-id";
		const projectId = "test-project-id";
		const authId = "email:test@example.com";
		const deviceId = "test-device-id";

		// Act
		const otp = otpService.generateOTP(userId, projectId, authId, deviceId);
		const request = otpService.verifyOTP(deviceId, otp);

		// Assert
		expect(request).toBeDefined();
		expect(request.userId).toBe(userId);
		expect(request.projectId).toBe(projectId);
		expect(request.authId).toBe(authId);
		expect(request.deviceId).toBe(deviceId);
	});

	it("should not allow verification of expired OTPs", async () => {
		// Arrange
		const userId = "test-user-id";
		const projectId = "test-project-id";
		const authId = "email:test@example.com";
		const deviceId = "test-device-id";

		// Generate an OTP
		const otp = otpService.generateOTP(userId, projectId, authId, deviceId);

		// Mock Date.now to simulate time passing
		const originalNow = Date.now;
		const futureTime = originalNow() + 6 * 60 * 1000; // 6 minutes later (> 5 min expiry)
		Date.now = mock(() => futureTime);

		// Act & Assert - OTP should be expired but still in memory
		try {
			otpService.verifyOTP(deviceId, otp);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(401); // Should be 401 (expired)
			const errorData = await (error as Response).json();
			expect(errorData.error).toBe("OTP has expired");
		}

		// Cleanup
		Date.now = originalNow;
	});

	it("should throw an error when OTP is incorrect", async () => {
		// Arrange
		const userId = "test-user-id";
		const projectId = "test-project-id";
		const authId = "email:test@example.com";
		const deviceId = "test-device-id";

		otpService.generateOTP(userId, projectId, authId, deviceId);
		const incorrectOTP = "999999"; // Incorrect OTP

		// Act & Assert
		try {
			otpService.verifyOTP(deviceId, incorrectOTP);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(401);
			const errorData = await (error as Response).json();
			expect(errorData.error).toBe("Invalid OTP");
		}
	});

	it("should throw an error when authentication is not pending", async () => {
		// Arrange
		const nonExistentDeviceId = "non-existent-device-id";
		const someOTP = "123456";

		// Act & Assert
		try {
			otpService.verifyOTP(nonExistentDeviceId, someOTP);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(400);
			const errorData = await (error as Response).json();
			expect(errorData.error).toContain("Authentication for device");
			expect(errorData.error).toContain("is not pending");
		}
	});

	it("should ensure OTP cannot be verified twice", async () => {
		// Arrange
		const userId = "test-user-id";
		const projectId = "test-project-id";
		const authId = "email:test@example.com";
		const deviceId = "test-device-id";

		const otp = otpService.generateOTP(userId, projectId, authId, deviceId);

		// Act - First verification should succeed
		const request = otpService.verifyOTP(deviceId, otp);
		expect(request).toBeDefined();

		// Assert - Second verification should fail
		try {
			otpService.verifyOTP(deviceId, otp);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(400);
			const errorData = await (error as Response).json();
			expect(errorData.error).toContain("Authentication for device");
			expect(errorData.error).toContain("is not pending");
		}
	});

	it("should clean up expired OTPs through cleanup process", async () => {
		// Arrange
		const userId = "test-user-id";
		const projectId = "test-project-id";
		const authId = "email:test@example.com";
		const deviceId = "test-device-id";

		// Generate an OTP
		otpService.generateOTP(userId, projectId, authId, deviceId);

		// Mock Date.now to simulate time passing
		const originalNow = Date.now;
		const currentTime = Date.now();
		// Mock time to be 1 hour and 6 minutes later (past the extended expiry time)
		Date.now = mock(() => currentTime + 66 * 60 * 1000);

		// Manually trigger cleanup
		otpService.cleanupExpiredOTPs();

		// Act & Assert - OTP should have been removed from memory
		try {
			otpService.verifyOTP(deviceId, "any-otp");
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(400); // Should be 400 (not pending)
			const errorData = await (error as Response).json();
			// The error should indicate device not found (not pending), not OTP expired
			expect(errorData.error).toContain("Authentication for device");
			expect(errorData.error).toContain("is not pending");
			expect(errorData.error).not.toContain("OTP has expired");
		}

		// Cleanup
		Date.now = originalNow;
	});

	it("should only clean up OTPs that are at least one hour past their expiry", async () => {
		// Arrange
		const userId = "test-user-id";
		const projectId = "test-project-id";
		const authId = "email:test@example.com";
		const deviceId = "test-device-id";

		// Generate an OTP
		const otp = otpService.generateOTP(userId, projectId, authId, deviceId);

		// Store original Date.now
		const originalNow = Date.now;

		// PART 1: After 6 minutes (just after normal expiry of 5 minutes)
		// OTP should be expired for verification but NOT removed by cleanup
		try {
			// Mock time to 6 minutes later
			const sixMinutesLater = originalNow() + 6 * 60 * 1000;
			Date.now = mock(() => sixMinutesLater);

			// First, let's verify the OTP is expired for users
			try {
				otpService.verifyOTP(deviceId, otp);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(401); // Should be 401 (expired)
				const errorData = await (error as Response).json();
				expect(errorData.error).toBe("OTP has expired");
			}

			// Run cleanup process at 6 minutes mark
			otpService.cleanupExpiredOTPs();

			// OTP should still be in memory after cleanup (hasn't reached 1h5m yet)
			try {
				otpService.verifyOTP(deviceId, otp);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				// Should still be expired, not removed
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(401);
				const errorData = await (error as Response).json();
				expect(errorData.error).toBe("OTP has expired");
			}
		} finally {
			// PART 2: After 1 hour and 6 minutes (past the extended expiry time)
			// OTP should now be removed by cleanup
			try {
				// Mock time to 1 hour and 6 minutes later (past normal expiry + 1 hour grace period)
				const oneHourSixMinutesLater = originalNow() + 66 * 60 * 1000;
				Date.now = mock(() => oneHourSixMinutesLater);

				// The OTP should still be in memory before cleanup runs
				try {
					otpService.verifyOTP(deviceId, otp);
					expect(true).toBe(false); // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(Response);
					expect((error as Response).status).toBe(401); // Still expired
					const errorData = await (error as Response).json();
					expect(errorData.error).toBe("OTP has expired");
				}

				// Run cleanup process at 1h6m mark
				otpService.cleanupExpiredOTPs();

				// Now OTP should be removed by the cleanup process
				try {
					otpService.verifyOTP(deviceId, otp);
					expect(true).toBe(false); // Should not reach here
				} catch (error) {
					expect(error).toBeInstanceOf(Response);
					expect((error as Response).status).toBe(400); // Now 400 (not pending)
					const errorData = await (error as Response).json();
					expect(errorData.error).toContain("is not pending");
				}
			} finally {
				// Cleanup
				Date.now = originalNow;
			}
		}
	});
});
