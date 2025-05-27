import type { MiddlewareHandler } from "hono";
import logger from "../logging/logger";

export const requestLogger = (): MiddlewareHandler => {
	return async (c, next) => {
		const startTime = Date.now();
		const requestUrl = c.req.url;
		const method = c.req.method;
		const customRequestId = c.get("requestId");

		logger.info(`--> ${method} ${requestUrl}`, {
			requestId: customRequestId,
			http: {
				method: method,
				url: requestUrl,
				client_ip:
					c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
					c.req.header("cf-connecting-ip") ||
					c.req.header("x-real-ip"),
			},
			network: {
				client: {
					ip:
						c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
						c.req.header("cf-connecting-ip") ||
						c.req.header("x-real-ip") ||
						c.env?.REMOTE_ADDR,
				},
			},
			// If you had a custom requestId:
			// requestId: c.get('requestId'),
		});

		try {
			await next();
			// biome-ignore lint/suspicious/noExplicitAny:
		} catch (error: any) {
			const durationMs = Date.now() - startTime;
			logger.error(
				`<-- ${method} ${requestUrl} - Unhandled Error after ${durationMs}ms`,
				{
					http: {
						method: method,
						url: requestUrl,
						status_code: 500,
						duration_ms: durationMs,
					},
					error: {
						message: error.message,
						stack: error.stack,
						kind: error.name,
					},
					requestId: c.get("requestId"),
				},
			);
			throw error;
		}

		const durationMs = Date.now() - startTime;
		const statusCode = c.res.status;

		const logDetails = {
			http: {
				method: method,
				url: requestUrl,
				status_code: statusCode,
				duration_ms: durationMs,
				response_content_length: c.res.headers.get("content-length"), // if available
			},
			requestId: c.get("requestId"), // if custom
		};

		if (statusCode >= 500) {
			logger.error(
				`<-- ${method} ${requestUrl} - ${statusCode} (${durationMs}ms)`,
				logDetails,
			);
		} else if (statusCode >= 400) {
			logger.warn(
				`<-- ${method} ${requestUrl} - ${statusCode} (${durationMs}ms)`,
				logDetails,
			);
		} else {
			logger.info(
				`<-- ${method} ${requestUrl} - ${statusCode} (${durationMs}ms)`,
				logDetails,
			);
		}
	};
};
