import { z } from "zod";

export const AuthMethod = {
	EMAIL: "email",
} as const;

export type AuthMethod = (typeof AuthMethod)[keyof typeof AuthMethod];

export const SigningAlgorithm = {
	ED25519: "EDDSA_ED25519",
} as const;

export type SigningAlgorithm =
	(typeof SigningAlgorithm)[keyof typeof SigningAlgorithm];

export const authIdSchema = z
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
			return true; // For other methods, add more validation as needed
		},
		{
			message: "Auth ID must contain a valid email address",
		},
	);

// Zod schemas for request validation
export const SignerRequestSchema = z.object({
	userId: z.string().min(1, { message: "User ID is required" }),
	projectId: z.string().min(1, { message: "Project ID is required" }),
	// projectName: z.string().min(1, { message: "Project name is required" }),
	// projectLogo: z.string().optional(),
	projectName: z.string().optional().default("Crossmint NCS Demo"),
	projectLogo: z
		.string()
		.optional()
		.default("https://www.crossmint.com/assets/crossmint/logo.png"),
	authId: authIdSchema,
	encryptionContext: z.object({
		publicKey: z.string().min(1, { message: "Public key is required" }),
	}),
});

export const SignerPreGenerationSchema = z.object({
	userId: z.string().min(1, { message: "User ID is required" }),
	projectId: z.string().min(1, { message: "Project ID is required" }),
	signingAlgorithm: z.nativeEnum(SigningAlgorithm),
	authId: authIdSchema,
});

export const OTPVerificationSchema = z.object({
	otp: z.string().length(6, { message: "OTP must be 6 digits" }),
});

export const ENVSchema = z.object({
	SENDGRID_API_KEY: z
		.string()
		.min(1, { message: "SendGrid API key is required" }),
	SENDGRID_EMAIL_TEMPLATE_ID: z
		.string()
		.min(1, { message: "SendGrid email template ID is required" }),
	MOCK_TEE_SECRET: z
		.string()
		.min(1, { message: "MOCK_TEE_SECRET is required" }),
	ACCESS_SECRET: z.string().min(1, { message: "ACCESS_SECRET is required" }),
	PORT: z
		.string()
		.optional()
		.transform((val) => (val ? Number.parseInt(val, 10) : 3000)),
});
