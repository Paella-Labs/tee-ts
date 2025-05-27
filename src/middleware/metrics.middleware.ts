import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types";

/**
 * Hono middleware to send HTTP request metrics to Datadog via the DatadogMetricsService.
 */
export const httpMetricsMiddleware = (): MiddlewareHandler => {
	return async (c: AppContext, next: () => Promise<void>) => {
		const startTime = Date.now();
		const method = c.req.method;

		let routePath = "unknown_route";
		if (c.req.routePath && c.req.routePath !== "*") {
			routePath = c.req.routePath;
		} else {
			try {
				routePath = new URL(c.req.url).pathname;
			} catch (e) {
				routePath = c.req.path || "/unknown_path_format";
			}
		}

		try {
			await next();
		} finally {
			const durationMs = Date.now() - startTime;
			const statusCode = c.res.status;
			const statusCategory = `${Math.floor(statusCode / 100)}xx`;
			const commonTags = [
				`method:${method}`,
				`route:${routePath}`,
				`status_code:${statusCode}`,
				`status_category:${statusCategory}`,
			];

			const metricsService = c.get("services").metricsService;
			metricsService.increment("requests.count", 1, commonTags);
			metricsService.distribution(
				"requests.duration_ms",
				durationMs,
				commonTags,
			);
			if (statusCode >= 400) {
				metricsService.increment("requests.errors.count", 1, commonTags);
			}
		}
	};
};
