import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
	getAttestationHandler,
	getTEEPublicKeyHandler,
} from "./attestation.handler";
import { authMiddleware } from "middleware/auth.middleware";

const attestation = new Hono<AppEnv>();

attestation.get("/", getAttestationHandler);
attestation.get("/public-key", getTEEPublicKeyHandler); // primarily for local development
attestation.use("*", authMiddleware());

export default attestation;
