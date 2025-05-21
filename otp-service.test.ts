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

	it("should throw an error when OTP has expired", async () => {
		// Arrange
		const userId = "test-user-id";
		const projectId = "test-project-id";
		const authId = "email:test@example.com";
		const deviceId = "test-device-id";
		const otp = otpService.generateOTP(userId, projectId, authId, deviceId);

		// Mock Date.now to simulate time passing
		const originalNow = Date.now;
		const currentTime = Date.now();
		Date.now = mock(() => currentTime + 6 * 60 * 1000); // 6 minutes later (> 5 min expiry)

		// Act & Assert
		try {
			otpService.verifyOTP(deviceId, otp);
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(401);
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
});
