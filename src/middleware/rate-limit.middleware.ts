import { rateLimiter } from "hono-rate-limiter";

export const rateLimitMiddleware = rateLimiter({
	windowMs: 60_000, // 1 minute
	limit: 100, // max 100 requests per minute per IP
	message: "Too many requests, please try again later.",
	keyGenerator: (c) =>
		c.req.header("x-forwarded-for") ||
		c.req.header("x-real-ip") ||
		"unknown-ip",
});
