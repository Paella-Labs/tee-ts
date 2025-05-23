// src/features/attestation/attestation.controller.ts
import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
  getTDXQuoteHandler,
  getTEEPublicKeyHandler,
} from "./attestation.handler";

const attestation = new Hono<AppEnv>();

attestation.get("/", getTEEPublicKeyHandler); // Backwards compatibility TODO delete
attestation.get("/public-key", getTEEPublicKeyHandler);
attestation.get("/tdx-quote", getTDXQuoteHandler);

export default attestation;
