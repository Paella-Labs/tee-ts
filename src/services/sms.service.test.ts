import { describe, it, expect, mock, beforeEach } from "bun:test";
import { TwilioSMSService } from "./sms.service";

// Mock twilio
const mockTwilioClient = {
	messages: {
		create: mock(() => Promise.resolve({ sid: "test_sid" })),
	},
};

const mockTwilio = mock(() => mockTwilioClient);

// Mock the twilio module
mock.module("twilio", () => ({
	default: mockTwilio,
}));

describe("TwilioSMSService", () => {
	let smsService: TwilioSMSService;

	beforeEach(() => {
		mock.restore();
		
		smsService = new TwilioSMSService(
			"test_account_sid",
			"test_auth_token",
			"+1234567890"
		);
	});

	describe("sendOTPSMS", () => {
		it("should send SMS successfully", async () => {
			await smsService.sendOTPSMS(
				"123456",
				"+1987654321",
				"Test Project",
				"5 minutes"
			);

			expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
				body: "Your Test Project verification code is: 123456. This code expires in 5 minutes.",
				from: "+1234567890",
				to: "+1987654321",
			});
		});

		it("should use default expiry time when not provided", async () => {
			await smsService.sendOTPSMS(
				"123456",
				"+1987654321",
				"Test Project"
			);

			expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
				body: "Your Test Project verification code is: 123456. This code expires in 5 minutes.",
				from: "+1234567890",
				to: "+1987654321",
			});
		});

		it("should throw error when SMS sending fails", async () => {
			const mockError = new Error("Twilio API error");
			mockTwilioClient.messages.create = mock(() => Promise.reject(mockError));

			await expect(
				smsService.sendOTPSMS(
					"123456",
					"+1987654321",
					"Test Project"
				)
			).rejects.toThrow("Failed to send SMS: Twilio API error");
		});
	});
}); 