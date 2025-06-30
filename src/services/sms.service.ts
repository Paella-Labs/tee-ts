import twilio from "twilio";

/**
 * Interface for SMS service implementations
 */
export interface SMSService {
	/**
	 * Send an OTP SMS to the recipient
	 */
	sendOTPSMS(
		otp: string,
		recipient: string,
		projectName: string,
		expiryMinutes?: string,
	): Promise<void>;
}

/**
 * Twilio implementation of SMS service
 */
export class TwilioSMSService implements SMSService {
	private client: twilio.Twilio;

	constructor(
		private readonly accountSid: string,
		private readonly authToken: string,
		private readonly fromPhoneNumber: string,
	) {
		this.client = twilio(accountSid, authToken);
	}

	/**
	 * Send an OTP SMS to the recipient via Twilio
	 */
	public async sendOTPSMS(
		otp: string,
		recipient: string,
		projectName: string,
		expiryMinutes = "5 minutes",
	): Promise<void> {
		const message = `Your ${projectName} verification code is: ${otp}. This code expires in ${expiryMinutes}.`;

		console.log("[DEBUG] Attempting to send SMS to:", recipient);
		console.log("[DEBUG] Message:", message);

		try {
			await this.client.messages.create({
				body: message,
				from: this.fromPhoneNumber,
				to: recipient,
			});

			console.log("[DEBUG] SMS sent successfully to:", recipient);
		} catch (error) {
			console.error("[ERROR] Failed to send SMS:", error);
			throw new Error(`Failed to send SMS: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
} 