import { z } from "zod";

const AuthMethod = {
  EMAIL: "email",
} as const;

type AuthMethod = (typeof AuthMethod)[keyof typeof AuthMethod];

export const SigningAlgorithm = {
  ED25519: "ed25519",
} as const;

export type SigningAlgorithm =
  (typeof SigningAlgorithm)[keyof typeof SigningAlgorithm];

const AuthIdSchema = z
  .string()
  .min(1, { message: "Auth ID is required" })
  .refine(
    (val) => {
      const methodKeys = Object.values(AuthMethod);
      return methodKeys.some((method) => val.startsWith(`${method}:`));
    },
    {
      message: `Auth ID must start with one of: ${Object.values(
        AuthMethod
      ).join(", ")}:`,
    }
  )
  .refine(
    (val) => {
      const [method, rest] = val.split(":");
      if (method === AuthMethod.EMAIL) {
        return rest?.includes("@");
      }
      return true; // For other methods, add more validation as needed
    },
    {
      message: "Auth ID must contain a valid email address",
    }
  );

// Zod schemas for request validation
export const EncryptedRequestSchema = z.object({
  ciphertext: z.string(),
  encapsulatedKey: z.string(),
});
export type EncryptedRequest = z.infer<typeof EncryptedRequestSchema>;
export function isEncryptedRequest(data: unknown): data is EncryptedRequest {
  const validationResult = EncryptedRequestSchema.safeParse(data);

  return validationResult.success;
}

export const StartOnboardingRequestSchema = z.object({
  deviceId: z.string().min(1, { message: "Device ID is required" }),
  signerId: z.string().min(1, { message: "Signer ID is required" }),
  projectName: z.string().min(1, { message: "Project name is required" }),
  projectLogo: z.string().optional(),
  authId: AuthIdSchema,
  encryptionContext: z.object({
    publicKey: z.string().min(1, { message: "Public key is required" }),
  }),
});
export type StartOnboardingRequest = z.infer<
  typeof StartOnboardingRequestSchema
>;

export const CompleteOnboardingRequestSchema = z.object({
  deviceId: z.string().min(1, { message: "Device ID is required" }),
  onboardingAuthentication: z.object({
    otp: z.string().length(6, { message: "OTP must be 6 digits" }),
  }),
});

export type CompleteOnboardingRequest = z.infer<
  typeof CompleteOnboardingRequestSchema
>;

export const SignerPreGenerationSchema = z.object({
  signerId: z.string().min(1, { message: "Signer ID is required" }),
  signingAlgorithm: z.nativeEnum(SigningAlgorithm),
  authId: AuthIdSchema,
});
export type SignerPreGenerationInput = z.infer<
  typeof SignerPreGenerationSchema
>;
