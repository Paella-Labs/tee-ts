import winston, { log, Logger } from "winston";
import { env } from "../config";

const { combine, timestamp, json, errors, printf } = winston.format;

const isTTY = process.stdout.isTTY;

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    timestamp(),
    env.FORCE_JSON_LOGS === "true" || !isTTY
      ? json()
      : winston.format.prettyPrint({ colorize: true, depth: 3 })
  ),
  defaultMeta: {
    service: env.DD_SERVICE,
    env: env.DD_ENV,
    version: env.DD_VERSION,
  },
  transports: [new winston.transports.Console()],
});

export default logger;
