interface DeviceOnboardingRecord {
	signerId: string;
	authId: string;
	onboardedAt: number;
}
export class OnboardingTracker {
	private onboardingHistory = new Map<string, DeviceOnboardingRecord[]>();

	constructor(
		private readonly onboardingRestrictionWindow: number,
		private readonly maxOnboardsPerWindow: number,
	) {}

	/**
	 * Check if a device can be onboarded for a signerId/authId pair
	 * @throws Response error if attempt limit exceeded
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
				},
			);
		}

		// TODO fix potential timing attack
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
