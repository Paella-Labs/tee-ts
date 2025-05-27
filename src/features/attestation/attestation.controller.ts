import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
	getTDXQuoteHandler,
	getTEEPublicKeyHandler,
} from "./attestation.handler";
import { authMiddleware } from "middleware/auth.middleware";

const attestation = new Hono<AppEnv>();

attestation.get("/", getTEEPublicKeyHandler); // Backwards compatibility TODO delete
attestation.get("/public-key", getTEEPublicKeyHandler);
attestation.get("/tdx-quote", getTDXQuoteHandler);
attestation.use("*", authMiddleware());

export default attestation;
