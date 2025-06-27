import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { ErrorHandler } from "hono";
import type { AppEnv } from "../types";

export const globalErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
	const logger = c.get("logger");
	logger.error(
		`[ERROR] Request to ${c.req.method} ${c.req.path} failed: ${err.message}`,
		{
			error: {
				message: err.message,
				stack: err.stack,
				name: err.name,
			},
			url: c.req.url,
			method: c.req.method,
		},
	);

	if (err instanceof HTTPException) {
		return err.getResponse();
	}

	if (err instanceof ZodError) {
		return c.json(
			{
				error: "Validation failed",
				details: err.format(),
			},
			400,
		);
	}

	if (err instanceof Response) {
		// Ensure the Response has the correct Content-Type header for JSON responses
		if (!err.headers.get("Content-Type")) {
			const headers = new Headers(err.headers);
			headers.set("Content-Type", "application/json");
			return new Response(err.body, {
				status: err.status,
				statusText: err.statusText,
				headers,
			});
		}
		return err;
	}

	return c.json(
		{
			error: "Request failed",
			message: err instanceof Error ? err.message : String(err),
			code: "INTERNAL_SERVER_ERROR",
		},
		500,
	);
};
