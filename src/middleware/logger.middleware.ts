import type { MiddlewareHandler } from "hono";

export const requestLogger = (): MiddlewareHandler => {
	return async (c, next) => {
		const startTime = Date.now();
		const requestUrl = c.req.url;
		const method = c.req.method;
		const logger = c.get("logger");

		logger.info(`--> ${method} ${requestUrl}`, {
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
		});

		try {
			await next();
			// biome-ignore lint/suspicious/noExplicitAny:
		} catch (error: any) {
			const durationMs = Date.now() - startTime;

			if (error instanceof Response) {
				const statusCode = error.status;
				const logLevel =
					statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

				logger[logLevel](
					`<-- ${method} ${requestUrl} - ${statusCode} (${durationMs}ms)`,
					{
						http: {
							method: method,
							url: requestUrl,
							status_code: statusCode,
							duration_ms: durationMs,
						},
					},
				);
				throw error;
			}

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
