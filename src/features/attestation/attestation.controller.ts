import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { attestationHandler } from "./attestation.handler";
import { authMiddleware } from "middleware/auth.middleware";

const attestation = new Hono<AppEnv>();

attestation.get("/", attestationHandler);
attestation.use("*", authMiddleware());

export default attestation;
