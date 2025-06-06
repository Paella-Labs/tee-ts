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
	LOG_LEVEL: z.string().optional().default("info"),
	DD_SERVICE: z.string(),
	DD_ENV: z.string().default("production"),
	DD_VERSION: z.string().default("v1"),
	DATADOG_API_KEY: z
		.string()
		.min(1, { message: "DATADOG_API_KEY is required" }),
	DATADOG_METRICS_ENABLED: z
		.string()
		.default("true")
		.transform((val) => val === "true"),
	DSTACK_SIMULATOR_ENDPOINT: z.string().optional(),
});

export type EnvConfig = z.infer<typeof ENVSchema>;

export const env = ENVSchema.parse(process.env);
