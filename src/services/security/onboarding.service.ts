interface DeviceOnboardingRecord {
	signerId: string;
	authId: string;
	onboardedAt: number;
}

/**
 * OnboardingTracker provides rate limiting for device onboarding attempts
 * - Tracks onboarding attempts per signerId+authId pair within sliding time windows
 * - Enforces maximum number of device onboardings per time period
 * - Prevents rapid-fire OTP generation attacks by limiting onboarding frequency
 */
export class OnboardingTracker {
	private onboardingHistory = new Map<string, DeviceOnboardingRecord[]>();

	constructor(
		private readonly onboardingRestrictionWindow: number,
		private readonly maxOnboardsPerWindow: number,
	) {}

	/**
	 * Track and validate a device onboarding attempt for rate limiting
	 *
	 * **Security Flow:**
	 * 1. Retrieves existing onboarding history for signerId+authId pair
	 * 2. Filters to only recent attempts within the time window
	 * 3. Checks if attempt count exceeds configured maximum
	 * 4. If limit exceeded, throws 429 error with retry timing
	 * 5. If allowed, records the new attempt with current timestamp
	 *
	 * **Rate Limiting Logic:**
	 * - Uses sliding window: only counts attempts within onboardingRestrictionWindow
	 * - Calculates exact retry time based on oldest qualifying attempt
	 * - Provides user-friendly error messages with retry guidance
	 *
	 * @param signerId - Unique identifier for the signer
	 * @param authId - Authentication context identifier
	 *
	 * @throws Response with 429 status if rate limit exceeded, includes:
	 *   - Clear error message explaining the limit
	 *   - retryAfterHours field indicating when to retry
	 *   - Current attempt count vs maximum allowed
	 */
	public trackAttempt(signerId: string, authId: string): void {
		const pairKey = `${signerId}:${authId}`;
		const currentTime = Date.now();

		const records = this.onboardingHistory.get(pairKey) || [];
		const recentOnboardings = records.filter((record) => {
			const age = currentTime - record.onboardedAt;
			return age < this.onboardingRestrictionWindow;
		});

		if (recentOnboardings.length >= this.maxOnboardsPerWindow) {
			const oldestOnboarding = Math.min(
				...recentOnboardings.map((r) => r.onboardedAt),
			);
			const timeUntilNextSlot =
				this.onboardingRestrictionWindow - (currentTime - oldestOnboarding);
			const hoursUntilNextSlot = Math.ceil(
				timeUntilNextSlot / (60 * 60 * 1000),
			);

			console.log(
				`[Security] Device limit exceeded for ${signerId}:${authId}. ${recentOnboardings.length}/${this.maxOnboardsPerWindow} devices in last ${this.onboardingRestrictionWindow}h`,
			);

			throw new Response(
				JSON.stringify({
					error: `Too many devices onboarded recently. Maximum ${this.maxOnboardsPerWindow} devices per ${this.onboardingRestrictionWindow} hours. Try again in ${hoursUntilNextSlot} hour(s).`,
					retryAfterHours: hoursUntilNextSlot,
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}

		records.push({
			signerId,
			authId,
			onboardedAt: Date.now(),
		});
		this.onboardingHistory.set(pairKey, records);
		console.log(
			`[Security] Recorded device onboarding for ${signerId}:${authId}`,
		);
	}

	/**
	 * Clean up old onboarding records that are outside the tracking window
	 *
	 * **Cleanup Strategy:**
	 * - Removes records older than onboardingRestrictionWindow
	 * - Deletes entire Map entries when no records remain
	 * - Provides metrics on cleanup operations for monitoring
	 */
	public cleanupOldRecords(): void {
		const currentTime = Date.now();
		let removedCount = 0;

		for (const [pairKey, records] of this.onboardingHistory.entries()) {
			const filteredRecords = records.filter(
				(record) =>
					currentTime - record.onboardedAt < this.onboardingRestrictionWindow,
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
}
