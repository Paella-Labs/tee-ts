import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types";
import customLogger from "../logging/logger";

export const authMiddleware = () => {
	return createMiddleware<AppEnv>(async (c, next) => {
		const accessSecret = c.get("env").ACCESS_SECRET;
		const authorizationHeader = c.req.header("authorization");
		const customRequestId = c.get("requestId");

		if (authorizationHeader !== accessSecret) {
			customLogger.warn("[Auth] Unauthorized attempt", {
				requestId: customRequestId, // <<< Add custom requestId
				url: c.req.url,
				client_ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
			});
			throw new HTTPException(401, { message: "Unauthorized" });
		}
		await next();
	});
};
