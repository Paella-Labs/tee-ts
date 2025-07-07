import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { timingSafeEqual } from "node:crypto";
import type { AppEnv } from "../types";

export const authMiddleware = () => {
	return createMiddleware<AppEnv>(async (c, next) => {
		const accessSecret = c.get("env").ACCESS_SECRET;
		const logger = c.get("logger");
		const authorizationHeader = c.req.header("authorization");

		const a = Buffer.from(authorizationHeader || "");
		const b = Buffer.from(accessSecret);

		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			logger.warn("[Auth] Unauthorized attempt", {
				url: c.req.url,
				client_ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
			});
			throw new HTTPException(401, { message: "Unauthorized" });
		}
		await next();
	});
};
