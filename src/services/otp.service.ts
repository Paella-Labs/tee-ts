import type { OTPSecurityService } from "./otp-security.service";
import { InMemoryOTPSecurityService } from "./otp-security.service";

interface OTPRequest {
  otp: string;
  signerId: string;
  authId: string;
  createdAt: number;
  deviceId: string;
  failedAttempts: number; // Track failed verification attempts
}

interface DeviceOnboardingRecord {
  signerId: string;
  authId: string;
  deviceId: string;
  onboardedAt: number;
}

interface OTPSecurityConfig {
  maxDevicesPerPair: number; // X - max devices per signerId/authId pair
  deviceLimitWindowHours: number; // Y - time window for device limit (in hours)
  maxFailedAttempts: number; // Z - max failed attempts before invalidating OTP
  otpLength: number; // 6 or 8 digits
}

const OTP_SECURITY_CONFIG: OTPSecurityConfig = {
  maxDevicesPerPair: 3,
  deviceLimitWindowHours: 6,
  maxFailedAttempts: 3,
  otpLength: 6,
};

const OTP_CONFIG = {
  otpLength: 6,
};

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
  private onboardingHistory = new Map<string, DeviceOnboardingRecord[]>(); // Key: signerId:authId
  private cleanupInterval: number | NodeJS.Timeout | null = null;
  private readonly otpExpiryTime = 5 * 60 * 1000;
  private readonly otpExpiryMessageGracePeriod = 60 * 60 * 1000;
  private readonly securityService: OTPSecurityService;

  private constructor(securityService: OTPSecurityService) {
    this.securityService = securityService;
    this.startCleanupInterval();
  }

  /**
   * Get singleton instance of InMemoryOTPService
   */
  public static getInstance(
    securityService?: OTPSecurityService
  ): InMemoryOTPService {
    if (!InMemoryOTPService.instance) {
      const security =
        securityService || InMemoryOTPSecurityService.getInstance();
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
    deviceId: string
  ): string {
    this.securityService.validateDeviceOnboarding(signerId, authId, deviceId);

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
        }
      );
    }

    const currentTime = Date.now();
    if (currentTime - request.createdAt > this.otpExpiryTime) {
      this.pendingRequests.delete(deviceId);
      throw new Response(JSON.stringify({ error: "OTP has expired" }), {
        status: 401,
      });
    }

    if (request.otp !== otpCode) {
      request.failedAttempts++;

      const shouldInvalidate = this.securityService.recordFailedAttempt(
        deviceId,
        request.failedAttempts
      );

      if (shouldInvalidate) {
        this.pendingRequests.delete(deviceId);
        throw new Response(
          JSON.stringify({
            error: `OTP invalidated after ${this.securityService.getMaxFailedAttempts()} failed attempts`,
          }),
          {
            status: 401,
          }
        );
      }

      this.pendingRequests.set(deviceId, request);

      throw new Response(
        JSON.stringify({
          error: `Invalid OTP (${
            request.failedAttempts
          }/${this.securityService.getMaxFailedAttempts()} attempts)`,
        }),
        {
          status: 401,
        }
      );
    }

    this.securityService.recordDeviceOnboarding(
      request.signerId,
      request.authId,
      deviceId
    );
    this.pendingRequests.delete(deviceId);

    return request;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredOTPs();
      this.securityService.cleanupOldRecords();
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
    const length = OTP_CONFIG.otpLength;
    const maxValue = 10 ** length - 1;

    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);

    const randomNumber =
      new DataView(randomBytes.buffer).getUint32(0) % (maxValue + 1);
    return randomNumber.toString().padStart(length, "0");
  }
}
