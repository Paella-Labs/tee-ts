import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../../types";
import {
	EncryptedRequestSchema,
	SignerPreGenerationSchema,
	StartOnboardingRequestSchema,
} from "../../schemas";
import {
	completeOnboardingHandler,
	derivePublicKeyHandler,
	startOnboardingHandler,
} from "./signers.handler";
import { authMiddleware } from "middleware/auth.middleware";
const signer = new Hono<AppEnv>();

signer.post(
	"/derive-public-key",
	zValidator("json", SignerPreGenerationSchema, (result, c) => {
		if (!result.success) {
			console.log(
				"[DEBUG] POST /v1/signers/derive-public-key - Validation failed",
				result.error.format(),
			);
			return c.json(
				{ error: "Validation failed", details: result.error.format() },
				400,
			);
		}
	}),
	derivePublicKeyHandler,
);

signer.post(
	"/start-onboarding",
	zValidator("json", StartOnboardingRequestSchema, (result, c) => {
		if (!result.success) {
			console.log(
				"[DEBUG] POST /v1/signers/start-onboarding - Validation failed",
				result.error.format(),
			);
			return c.json(
				{ error: "Validation failed", details: result.error.format() },
				400,
			);
		}
	}),
	startOnboardingHandler,
);

signer.post(
	"/complete-onboarding",
	zValidator("json", EncryptedRequestSchema, (result, c) => {
		if (!result.success) {
			console.log(
				"[DEBUG] POST /v1/signers/complete-onboarding - Validation failed",
				result.error.format(),
			);
		}
	}),
	completeOnboardingHandler,
);

signer.use("*", authMiddleware());

export default signer;
