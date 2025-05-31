import { OnboardingTracker } from "./onboarding-tracker.service";

interface OTPRequest {
	otp: string;
	signerId: string;
	authId: string;
	createdAt: number;
	deviceId: string;
	failedAttempts: number;
}

const SECURITY_CONFIG = {
	MAX_FAILED_ATTEMPTS: 3,
	DEVICE_ONBOARDING_WINDOW_MS: 6 * 60 * 60 * 1000, // 6 hours
	MAX_DEVICES_PER_WINDOW: 3,
	OTP_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
	OTP_CLEANUP_GRACE_PERIOD_MS: 60 * 60 * 1000, // 1 hour
} as const;

export interface OTPService {
	/**
	 * Generate a new OTP and store it
	 */
	generateOTP(signerId: string, authId: string, deviceId: string): string;

	/**
	 * Verify an OTP for a given device
	 * @returns The OTP request if valid
	 * @throws Response error if OTP is invalid or expired
	 */
	verifyOTP(deviceId: string, otpCode: string): OTPRequest;
}

/**
 * In-memory implementation of OTP service with injected security service
 */
export class InMemoryOTPService implements OTPService {
	private static instance: InMemoryOTPService | null = null;
	private pendingRequests = new Map<string, OTPRequest>();
	private cleanupInterval: NodeJS.Timeout | null = null;
	private readonly otpExpiryTime = 5 * 60 * 1000;
	private readonly otpExpiryMessageGracePeriod = 60 * 60 * 1000;

	public constructor(private readonly securityService: OnboardingTracker) {
		this.startCleanupInterval();
	}

	/**
	 * Get singleton instance of InMemoryOTPService
	 */
	public static getInstance(): InMemoryOTPService {
		if (!InMemoryOTPService.instance) {
			const security = new OnboardingTracker(
				SECURITY_CONFIG.DEVICE_ONBOARDING_WINDOW_MS,
				SECURITY_CONFIG.MAX_DEVICES_PER_WINDOW,
			);
			InMemoryOTPService.instance = new InMemoryOTPService(security);
		}
		return InMemoryOTPService.instance;
	}

	/**
	 * Generate a new OTP and store it in memory
	 * Enforces device onboarding limits per signerId/authId pair
	 */
	public generateOTP(
		signerId: string,
		authId: string,
		deviceId: string,
	): string {
		this.securityService.trackAttempt(signerId, authId);

		const otp = this.createRandomOTP();
		console.log("[DEBUG] Generated OTP:", otp);

		this.pendingRequests.set(deviceId, {
			otp,
			signerId,
			authId,
			createdAt: Date.now(),
			deviceId,
			failedAttempts: 0,
		});

		return otp;
	}

	/**
	 * Verify an OTP for a given device
	 * Tracks failed attempts and invalidates OTP after max attempts
	 * @returns The OTP request if valid
	 * @throws Response error if OTP is invalid or expired
	 */
	public verifyOTP(deviceId: string, otpCode: string): OTPRequest {
		const request = this.pendingRequests.get(deviceId);
		if (!request) {
			throw new Response(
				JSON.stringify({
					error: `Authentication for device ${deviceId} is not pending`,
				}),
				{
					status: 400,
				},
			);
		}

		// Check OTP is not expired
		const currentTime = Date.now();
		if (currentTime - request.createdAt > this.otpExpiryTime) {
			this.pendingRequests.delete(deviceId);
			throw new Response(JSON.stringify({ error: "OTP has expired" }), {
				status: 401,
			});
		}

		// Handle incorrect OTP
		if (request.otp !== otpCode) {
			request.failedAttempts++;

			if (request.failedAttempts > SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
				this.pendingRequests.delete(deviceId);
				throw new Response(
					JSON.stringify({
						error: `OTP invalidated after ${SECURITY_CONFIG.MAX_FAILED_ATTEMPTS} failed attempts`,
					}),
					{
						status: 401,
					},
				);
			}

			this.pendingRequests.set(deviceId, request);

			throw new Response(
				JSON.stringify({
					error: `Invalid OTP (${
						request.failedAttempts
					}/${SECURITY_CONFIG.MAX_FAILED_ATTEMPTS} attempts)`,
				}),
				{
					status: 401,
				},
			);
		}

		// On success
		this.pendingRequests.delete(deviceId);
		return request;
	}

	private startCleanupInterval(): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, this.otpExpiryTime);
	}

	public cleanup(): void {
		this.cleanupExpiredOTPs();
		this.securityService.cleanupOldRecords();
	}

	private cleanupExpiredOTPs(): void {
		const currentTime = Date.now();
		let expiredCount = 0;

		const extendedExpiryTime =
			this.otpExpiryTime + this.otpExpiryMessageGracePeriod;

		for (const [deviceId, request] of this.pendingRequests.entries()) {
			if (currentTime - request.createdAt > extendedExpiryTime) {
				this.pendingRequests.delete(deviceId);
				expiredCount++;
			}
		}

		if (expiredCount > 0) {
			console.log(`[Cleanup] Removed ${expiredCount} expired OTPs from memory`);
		}
	}

	private createRandomOTP(): string {
		const length = 6;
		const maxValue = 10 ** length - 1;

		const randomBytes = new Uint8Array(4);
		crypto.getRandomValues(randomBytes);

		const randomNumber =
			new DataView(randomBytes.buffer).getUint32(0) % (maxValue + 1);
		return randomNumber.toString().padStart(length, "0");
	}
}
