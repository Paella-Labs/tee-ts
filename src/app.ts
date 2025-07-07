import { Hono } from "hono";
import signerController from "./features/signers/signers.controller";

import { env } from "./config";
import type { AppEnv, ServiceInstances } from "./types";
import { globalErrorHandler } from "./middleware/error.handler";

import attestationController from "./features/attestation/attestation.controller";
import healthController from "./features/health/health.controller";
import { requestLogger } from "middleware/logger.middleware";
import { httpMetricsMiddleware } from "middleware/metrics.middleware";
import { rateLimitMiddleware } from "./middleware/rate-limit.middleware";
import logger from "logging/logger";

export async function createApp(services: ServiceInstances) {
	const app = new Hono<AppEnv>();

	addMiddleware(app, services);
	addRoutes(app);
	addDefaultHandlers(app);

	return app;
}

function addMiddleware(app: Hono<AppEnv>, services: ServiceInstances) {
	app.use("*", rateLimitMiddleware);
	app.use("*", async (c, next) => {
		c.set("services", services);
		c.set("env", env);
		c.set("logger", logger);
		await next();
	});
	app.use("*", httpMetricsMiddleware());
	app.use("*", requestLogger());
}

function addRoutes(app: Hono<AppEnv>) {
	app.route("/health", healthController);
	app.route("/v1/signers", signerController);
	app.route("/v1/attestation", attestationController);
}

function addDefaultHandlers(app: Hono<AppEnv>) {
	app.notFound((c) => {
		return c.json(
			{
				error: "Not Found",
				message: `Route ${c.req.method} ${c.req.path} not found.`,
			},
			404,
		);
	});

	app.onError(globalErrorHandler);
}
