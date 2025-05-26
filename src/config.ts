import { z } from "zod";

export const ENVSchema = z.object({
	PORT: z
		.string()
		.optional()
		.transform((val) => (val ? Number.parseInt(val, 10) : 3000)),
	SENDGRID_API_KEY: z
		.string()
		.min(1, { message: "SendGrid API key is required" }),
	SENDGRID_EMAIL_TEMPLATE_ID: z
		.string()
		.min(1, { message: "SendGrid email template ID is required" }),
	MOCK_TEE_SECRET: z.string(),
	ACCESS_SECRET: z.string().min(1, { message: "ACCESS_SECRET is required" }),
});

export type EnvConfig = z.infer<typeof ENVSchema>;

export const env = ENVSchema.parse(process.env);
