import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
	getAttestationHandler,
	getTEEPublicKeyHandler,
} from "./attestation.handler";
import { authMiddleware } from "middleware/auth.middleware";

const attestation = new Hono<AppEnv>();

attestation.use("*", authMiddleware());
attestation.get("/", getAttestationHandler);
attestation.get("/public-key", getTEEPublicKeyHandler); // primarily for local development

export default attestation;
