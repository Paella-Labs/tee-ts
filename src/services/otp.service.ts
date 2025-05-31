import { OnboardingTracker } from "./onboarding-tracker.service";

interface OTPRequest {
	otp: string;
	signerId: string;
	authId: string;
	createdAt: number;
	deviceId: string;
	failedAttempts: number;
}

/**
 * Security Configuration for OTP Service
 *
 * **OTP Brute Force Protection:**
 * - OTP space: 1,000,000 possible combinations (6-digit numeric)
 * - Attempts per day: With a window of 6 hours, 4 windows per day, 3 onboard attempts per window, and 3 OTP attempts per onboarding, an attacker gets 12 OTP generations per day.
 * - Expected brute force time: Using cumulative probability model 0.5 = 1 - (1 - 3/1,000,000)^n, it takes 231,049 OTP generations for 50% success probability.
 * - Time to brute force: 231,049 ÷ 12 OTP generations/day = ~19,254 days ≈ **53 years**.
 **/
const SECURITY_CONFIG = {
	MAX_FAILED_ATTEMPTS: 3,
	DEVICE_ONBOARDING_WINDOW_MS: 6 * 60 * 60 * 1000, // 6 hours
	MAX_DEVICE_ONBOARD_ATTEMPTS: 3,
	OTP_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
	OTP_CLEANUP_GRACE_PERIOD_MS: 60 * 60 * 1000, // 1 hour
} as const;

export interface OTPService {
	/**
	 * Generate a new OTP and store it
	 * @param signerId - Unique identifier for the signer
	 * @param authId - Authentication context identifier
	 * @param deviceId - Unique device identifier
	 * @returns 6-digit numeric OTP string
	 * @throws Response with 429 status if device onboarding rate limit exceeded
	 */
	generateOTP(signerId: string, authId: string, deviceId: string): string;

	/**
	 * Verify an OTP for a given device
	 * @param deviceId - Device identifier for which to verify OTP
	 * @param otpCode - The OTP code to verify
	 * @returns The OTP request if valid
	 * @throws Response error if OTP is invalid, expired, or max attempts exceeded
	 */
	verifyOTP(deviceId: string, otpCode: string): OTPRequest;
}

/**
 * In-memory implementation of OTP service with comprehensive security controls
 *
 * **Security Features:**
 * - **Rate Limiting**: Device onboarding attempts are limited per signerId+authId pair
 * - **Brute Force Protection**: OTPs invalidated after 3 failed attempts
 * - **Time-based Expiry**: OTPs expire after 5 minutes
 * - **Memory Management**: Automatic cleanup of expired OTPs and old records
 * - **Cryptographic Randomness**: Uses crypto.getRandomValues() for OTP generation
 */
export class InMemoryOTPService implements OTPService {
	private static instance: InMemoryOTPService | null = null;

	private pendingRequests = new Map<string, OTPRequest>();
	private cleanupInterval: NodeJS.Timeout | null = null;
	public constructor(private readonly securityService: OnboardingTracker) {
		this.startCleanupInterval();
	}

	/**
	 * Get singleton instance of InMemoryOTPService with default security configuration
	 * @returns Singleton OTP service instance
	 */
	public static getInstance(): InMemoryOTPService {
		if (!InMemoryOTPService.instance) {
			const security = new OnboardingTracker(
				SECURITY_CONFIG.DEVICE_ONBOARDING_WINDOW_MS,
				SECURITY_CONFIG.MAX_DEVICE_ONBOARD_ATTEMPTS,
			);
			InMemoryOTPService.instance = new InMemoryOTPService(security);
		}
		return InMemoryOTPService.instance;
	}

	/**
	 * Generate a new OTP and store it in memory
	 *
	 * **Security Flow:**
	 * 1. Enforces device onboarding limits per signerId/authId pair
	 * 2. Generates cryptographically secure 6-digit OTP
	 * 3. Stores OTP with metadata for verification tracking
	 *
	 * @param signerId - Unique identifier for the signer
	 * @param authId - Authentication context identifier
	 * @param deviceId - Unique device identifier
	 * @returns 6-digit numeric OTP string
	 * @throws Response with 429 status if rate limit exceeded
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
	 * Verify an OTP for a given device with comprehensive security checks
	 *
	 * **Security Validations:**
	 * 1. Checks if OTP request exists for device
	 * 2. Validates OTP hasn't expired (5-minute window)
	 * 3. Verifies OTP code matches
	 * 4. Tracks failed attempts and invalidates after 3 failures
	 * 5. Cleans up successful/failed requests from memory
	 *
	 * @param deviceId - Device identifier for which to verify OTP
	 * @param otpCode - The OTP code to verify
	 * @returns The OTP request if valid, containing authentication context
	 * @throws Response with 400 status if no pending authentication
	 * @throws Response with 401 status if OTP expired, invalid, or max attempts exceeded
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

		const currentTime = Date.now();
		if (currentTime - request.createdAt > SECURITY_CONFIG.OTP_EXPIRY_MS) {
			this.pendingRequests.delete(deviceId);
			throw new Response(JSON.stringify({ error: "OTP has expired" }), {
				status: 401,
			});
		}

		if (request.otp !== otpCode) {
			request.failedAttempts++;

			if (request.failedAttempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
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

		this.pendingRequests.delete(deviceId);
		return request;
	}

	public cleanup(): void {
		this.cleanupExpiredOTPs();
		this.securityService.cleanupOldRecords();
	}

	private startCleanupInterval(): void {
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, SECURITY_CONFIG.OTP_EXPIRY_MS);
	}

	private cleanupExpiredOTPs(): void {
		const currentTime = Date.now();
		let expiredCount = 0;

		const extendedExpiryTime =
			SECURITY_CONFIG.OTP_EXPIRY_MS +
			SECURITY_CONFIG.OTP_CLEANUP_GRACE_PERIOD_MS;

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

	/**
	 * Generate cryptographically secure 6-digit OTP
	 *
	 * **Security Implementation:**
	 * - Uses crypto.getRandomValues() for cryptographic randomness
	 * - Generates numbers in range 000000-999999 (1M possibilities)
	 * - Uniform distribution prevents bias in OTP generation
	 *
	 * @returns 6-digit zero-padded numeric string
	 * @private
	 */
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
