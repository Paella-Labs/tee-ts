import { z } from "zod";

export const ENVSchema = z.object({
  PORT: z.coerce.number().default(3000),
  SENDGRID_API_KEY: z.string(),
  SENDGRID_EMAIL_TEMPLATE_ID: z.string(),
  MOCK_TEE_SECRET: z.string(),
  ACCESS_SECRET: z.string(),
});

export type EnvConfig = z.infer<typeof ENVSchema>;

export const env = ENVSchema.parse(process.env);
