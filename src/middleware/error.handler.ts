import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { ErrorHandler } from "hono";
import type { AppEnv } from "../types";

export const globalErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
  console.error(`[ERROR] Request to ${c.req.path}:`, err);

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
