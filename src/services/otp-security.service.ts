interface DeviceOnboardingRecord {
	signerId: string;
	authId: string;
	deviceId: string;
	onboardedAt: number;
}

interface OTPSecurityConfig {
	maxDevicesPerSignerProjectPair: number;
	deviceLimitWindowHours: number;
	maxFailedAttempts: number;
}

const OTP_SECURITY_CONFIG: OTPSecurityConfig = {
	maxDevicesPerSignerProjectPair: 3,
	deviceLimitWindowHours: 6,
	maxFailedAttempts: 3,
};

export interface OTPSecurityService {
	/**
	 * Check if a device can be onboarded for a signerId/authId pair
	 * @throws Response error if device limit exceeded
	 */
	validateDeviceOnboarding(
		signerId: string,
		authId: string,
		deviceId: string,
	): void;

	/**
	 * Record a successful device onboarding
	 */
	recordDeviceOnboarding(
		signerId: string,
		authId: string,
		deviceId: string,
	): void;

	/**
	 * Track a failed OTP attempt
	 * @returns true if OTP should be invalidated due to max attempts reached
	 */
	recordFailedAttempt(deviceId: string, currentAttempts: number): boolean;

	/**
	 * Get maximum allowed failed attempts
	 */
	getMaxFailedAttempts(): number;

	/**
	 * Clean up old onboarding records
	 */
	cleanupOldRecords(): void;
}

/**
 * In-memory implementation of OTP security service
 */
export class InMemoryOTPSecurityService implements OTPSecurityService {
	private static instance: InMemoryOTPSecurityService | null = null;
	private onboardingHistory = new Map<string, DeviceOnboardingRecord[]>();
	private readonly config: OTPSecurityConfig = OTP_SECURITY_CONFIG;

	private constructor() {
		console.log(
			"OTP security service configuration: ",
			"Maximum number of devices per signerId/authId pair: ",
			this.config.maxDevicesPerSignerProjectPair,
			"Device limit window hours: ",
			this.config.deviceLimitWindowHours,
			"Maximum number of failed attempts: ",
			this.config.maxFailedAttempts,
		);
	}

	public static getInstance(): InMemoryOTPSecurityService {
		if (!InMemoryOTPSecurityService.instance) {
			InMemoryOTPSecurityService.instance = new InMemoryOTPSecurityService();
		}
		return InMemoryOTPSecurityService.instance;
	}

	/**
	 * Check if a device can be onboarded for a signerId/authId pair
	 * @throws Response error if device limit exceeded
	 */
	public validateDeviceOnboarding(
		signerId: string,
		authId: string,
		deviceId: string,
	): void {
		const pairKey = `${signerId}:${authId}`;
		const currentTime = Date.now();
		const windowMs = this.config.deviceLimitWindowHours * 60 * 60 * 1000;

		const records = this.onboardingHistory.get(pairKey) || [];

		const recentOnboardings = records.filter(
			(record) => currentTime - record.onboardedAt < windowMs,
		);

		const existingDevice = recentOnboardings.find(
			(record) => record.deviceId === deviceId,
		);
		if (existingDevice) {
			return;
		}

		if (
			recentOnboardings.length >= this.config.maxDevicesPerSignerProjectPair
		) {
			const oldestOnboarding = Math.min(
				...recentOnboardings.map((r) => r.onboardedAt),
			);
			const timeUntilNextSlot = windowMs - (currentTime - oldestOnboarding);
			const hoursUntilNextSlot = Math.ceil(
				timeUntilNextSlot / (60 * 60 * 1000),
			);

			console.log(
				`[Security] Device limit exceeded for ${signerId}:${authId}. ${recentOnboardings.length}/${this.config.maxDevicesPerSignerProjectPair} devices in last ${this.config.deviceLimitWindowHours}h`,
			);

			throw new Response(
				JSON.stringify({
					error: `Too many devices onboarded recently. Maximum ${this.config.maxDevicesPerSignerProjectPair} devices per ${this.config.deviceLimitWindowHours} hours. Try again in ${hoursUntilNextSlot} hour(s).`,
					retryAfterHours: hoursUntilNextSlot,
				}),
				{
					status: 429,
				},
			);
		}
	}

	/**
	 * Record a successful device onboarding
	 */
	public recordDeviceOnboarding(
		signerId: string,
		authId: string,
		deviceId: string,
	): void {
		const pairKey = `${signerId}:${authId}`;
		const records = this.onboardingHistory.get(pairKey) || [];

		records.push({
			signerId,
			authId,
			deviceId,
			onboardedAt: Date.now(),
		});

		this.onboardingHistory.set(pairKey, records);
		console.log(
			`[Security] Recorded device onboarding: ${deviceId} for ${signerId}:${authId}`,
		);
	}

	/**
	 * Track a failed OTP attempt
	 * @returns true if OTP should be invalidated due to max attempts reached
	 */
	public recordFailedAttempt(
		deviceId: string,
		currentAttempts: number,
	): boolean {
		console.log(
			`[Security] Failed OTP attempt ${currentAttempts}/${this.config.maxFailedAttempts} for device ${deviceId}`,
		);

		if (currentAttempts >= this.config.maxFailedAttempts) {
			console.log(
				`[Security] OTP invalidated for device ${deviceId} after ${this.config.maxFailedAttempts} failed attempts`,
			);
			return true;
		}

		return false;
	}

	/**
	 * Get maximum allowed failed attempts
	 */
	public getMaxFailedAttempts(): number {
		return this.config.maxFailedAttempts;
	}

	/**
	 * Clean up old onboarding records that are outside the tracking window
	 */
	public cleanupOldRecords(): void {
		const currentTime = Date.now();
		const maxAge = this.config.deviceLimitWindowHours * 60 * 60 * 1000 * 2;
		let removedCount = 0;

		for (const [pairKey, records] of this.onboardingHistory.entries()) {
			const filteredRecords = records.filter(
				(record) => currentTime - record.onboardedAt < maxAge,
			);

			if (filteredRecords.length !== records.length) {
				removedCount += records.length - filteredRecords.length;
				if (filteredRecords.length === 0) {
					this.onboardingHistory.delete(pairKey);
				} else {
					this.onboardingHistory.set(pairKey, filteredRecords);
				}
			}
		}

		if (removedCount > 0) {
			console.log(`[Cleanup] Removed ${removedCount} old onboarding records`);
		}
	}

	private reset(): void {
		this.onboardingHistory.clear();
	}
}
