import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getHealthStatus } from "./health.handler";

const health = new Hono<AppEnv>();

health.get("/", getHealthStatus);

export default health;
