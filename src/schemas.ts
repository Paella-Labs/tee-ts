import { z } from "zod";
import { OTP_DIGITS } from "./services/otp.service";

const AuthMethod = {
	EMAIL: "email",
	PHONE: "phone",
} as const;

type AuthMethod = (typeof AuthMethod)[keyof typeof AuthMethod];

export const KeyType = {
	ED25519: "ed25519",
	SECP256K1: "secp256k1",
} as const;

export type KeyType = (typeof KeyType)[keyof typeof KeyType];

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
				AuthMethod,
			).join(", ")}:`,
		},
	)
	.refine(
		(val) => {
			const [method, rest] = val.split(":");
			if (method === AuthMethod.EMAIL) {
				return rest?.includes("@");
			}
			if (method === AuthMethod.PHONE) {
				return rest?.startsWith("+") && rest.length > 1;
			}
			return true; // For other methods, add more validation as needed
		},
		{
			message: "Auth ID must contain a valid email address or phone number",
		},
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
		otp: z
			.string()
			.length(OTP_DIGITS, { message: `OTP must be ${OTP_DIGITS} digits` }),
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
