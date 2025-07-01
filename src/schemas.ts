import { z } from "zod/v4";

export const KeyType = {
	ED25519: "ed25519",
	SECP256K1: "secp256k1",
} as const;

export type KeyType = (typeof KeyType)[keyof typeof KeyType];

const phoneSchema = z.templateLiteral([z.literal("phone"), ":", z.e164()]);
const emailSchema = z.templateLiteral([z.literal("email"), ":", z.email()]);
const AuthIdSchema = z.union([phoneSchema, emailSchema]);

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
	keyType: z.nativeEnum(KeyType),
	authId: AuthIdSchema,
});
export type SignerPreGenerationInput = z.infer<
	typeof SignerPreGenerationSchema
>;
