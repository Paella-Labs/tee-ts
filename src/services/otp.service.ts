interface OTPRequest {
  otp: string;
  signerId: string;
  authId: string;
  createdAt: number;
  deviceId: string;
}
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
 * In-memory implementation of OTP service
 */
export class InMemoryOTPService implements OTPService {
  private static instance: InMemoryOTPService | null = null;
  private pendingRequests = new Map<string, OTPRequest>();
  private cleanupInterval: number | NodeJS.Timeout | null = null;
  private readonly otpExpiryTime = 5 * 60 * 1000;
  private readonly otpExpiryMessageGracePeriod = 60 * 60 * 1000;

  private constructor() {
    this.startCleanupInterval();
  }

  /**
   * Get singleton instance of InMemoryOTPService
   */
  public static getInstance(): InMemoryOTPService {
    if (!InMemoryOTPService.instance) {
      InMemoryOTPService.instance = new InMemoryOTPService();
    }
    return InMemoryOTPService.instance;
  }

  /**
   * Generate a new OTP and store it in memory
   */
  public generateOTP(
    signerId: string,
    authId: string,
    deviceId: string,
  ): string {
    const otp = this.createRandomOTP();
    console.log("[DEBUG] Generated OTP:", otp);

    this.pendingRequests.set(deviceId, {
      otp,
      signerId,
      authId,
      createdAt: Date.now(),
      deviceId,
    });

    return otp;
  }

  /**
   * Verify an OTP for a given device
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

    // Check if OTP has expired
    const currentTime = Date.now();
    if (currentTime - request.createdAt > this.otpExpiryTime) {
      throw new Response(JSON.stringify({ error: "OTP has expired" }), {
        status: 401,
      });
    }

    if (request.otp !== otpCode) {
      throw new Response(JSON.stringify({ error: "Invalid OTP" }), {
        status: 401,
      });
    }

    // Remove the OTP after successful verification
    this.pendingRequests.delete(deviceId);

    return request;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredOTPs();
    }, this.otpExpiryTime);
  }

  public cleanupExpiredOTPs(): void {
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
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);

    const randomNumber =
      new DataView(randomBytes.buffer).getUint32(0) % 1000000;
    return randomNumber.toString().padStart(6, "0");
  }
}
