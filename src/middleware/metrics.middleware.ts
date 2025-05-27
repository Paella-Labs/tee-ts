import type { MiddlewareHandler } from "hono";
import type { AppContext } from "../types";

/**
 * Hono middleware to send HTTP request metrics to Datadog via the DatadogMetricsService.
 *
 * Metrics sent:
 * - `crossmint_tee.requests.count`: Counter for total requests.
 * Tags: `method`, `route`, `status_code`, `status_category`
 * - `crossmint_tee.requests.duration_ms`: Distribution of request durations.
 * Tags: `method`, `route`, `status_code`, `status_category`
 * - `crossmint_tee.requests.errors.count`: Counter for requests resulting in errors (4xx, 5xx).
 * Tags: `method`, `route`, `status_code`, `status_category`
 */
export const httpMetricsMiddleware = (): MiddlewareHandler => {
  return async (c: AppContext, next: () => Promise<void>) => {
    const startTime = Date.now();
    const method = c.req.method;

    let routePath = "unknown_route";
    // Attempt to get a matched route path. Hono stores it in c.req.routePath after matching.
    // If not available (e.g., 404 before matching), use the URL's pathname.
    if (c.req.routePath && c.req.routePath !== "*") {
      routePath = c.req.routePath;
    } else {
      try {
        routePath = new URL(c.req.url).pathname;
      } catch (e) {
        // Fallback if URL parsing fails for some reason
        routePath = c.req.path || "/unknown_path_format";
      }
    }

    try {
      await next(); // Execute downstream middleware and the route handler
    } catch (error: unknown) {
      // biome-ignore lint/complexity/noUselessCatch: <explanation>
      throw error;
    } finally {
      const durationMs = Date.now() - startTime;
      const statusCode = c.res.status; // Get status code from the response

      // Determine status category (2xx, 3xx, 4xx, 5xx)
      const statusCategory = `${Math.floor(statusCode / 100)}xx`;

      const commonTags = [
        `method:${method}`,
        `route:${routePath}`, // Use the determined routePath
        `status_code:${statusCode}`,
        `status_category:${statusCategory}`,
      ];

      // Get the metrics service from context
      const metricsService = c.get("services").metricsService;

      // Increment total requests count
      metricsService.increment("requests.count", 1, commonTags);

      // Send a simple test metric
      metricsService.increment("test.counter", 1, ["test:true"]);

      // Record request duration

      // Using distribution is generally preferred for latencies for more accurate global percentiles
      metricsService.distribution(
        "requests.duration_ms",
        durationMs,
        commonTags
      );
      // Alternatively, use histogram if you prefer agent-side aggregation for percentiles:
      // metricsService.histogram('requests.duration_ms', durationMs, commonTags);

      // Increment error count for 4xx and 5xx responses
      if (statusCode >= 400) {
        metricsService.increment("requests.errors.count", 1, commonTags);
      }
    }
  };
};
