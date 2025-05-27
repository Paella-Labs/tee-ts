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
  FORCE_JSON_LOGS: z.string().optional().default("false"),
  DD_SERVICE: z.string(),
  DD_ENV: z.string().default("production"),
  DD_VERSION: z.string().default("v1"),
  DATADOG_API_KEY: z
    .string()
    .min(1, { message: "DATADOG_API_KEY is required" }),
  DATADOG_METRICS_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val === "true"),
});

export type EnvConfig = z.infer<typeof ENVSchema>;

export const env = ENVSchema.parse(process.env);
