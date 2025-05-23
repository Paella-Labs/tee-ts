import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types";

export const authMiddleware = () => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const accessSecret = c.get("env").ACCESS_SECRET;
    const authorizationHeader = c.req.header("authorization");

    if (authorizationHeader !== accessSecret) {
      console.warn("[Auth] Unauthorized attempt");
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    await next();
  });
};
