import type { MiddlewareHandler } from "hono";

interface RateLimitStore {
	[key: string]: {
		count: number;
		resetTime: number;
	};
}

const store: RateLimitStore = {};

export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
	const ip =
		c.req.header("x-forwarded-for") ||
		c.req.header("x-real-ip") ||
		"unknown-ip";

	const now = Date.now();
	const windowMs = 60_000; // 1 minute
	const limit = 100; // max 100 requests per minute per IP

	if (!store[ip] || now > store[ip].resetTime) {
		store[ip] = {
			count: 0,
			resetTime: now + windowMs,
		};
	}

	if (store[ip].count >= limit) {
		const retryAfter = Math.ceil((store[ip].resetTime - now) / 1000);
		return c.json(
			{ error: "Too many requests, please try again later." },
			429,
			{
				"Retry-After": retryAfter.toString(),
				"X-RateLimit-Limit": limit.toString(),
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": Math.ceil(store[ip].resetTime / 1000).toString(),
			},
		);
	}

	store[ip].count++;

	c.header("X-RateLimit-Limit", limit.toString());
	c.header(
		"X-RateLimit-Remaining",
		Math.max(0, limit - store[ip].count).toString(),
	);
	c.header("X-RateLimit-Reset", Math.ceil(store[ip].resetTime / 1000).toString());

	await next();
};
