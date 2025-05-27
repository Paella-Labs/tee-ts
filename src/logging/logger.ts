import winston, { log, Logger } from "winston";
import { env } from "../config";

const { combine, timestamp, json, errors, printf } = winston.format;

const isTTY = process.stdout.isTTY;

const logger = winston.createLogger({
	level: env.LOG_LEVEL,
	format: combine(errors({ stack: true }), timestamp(), json()),
	transports: [new winston.transports.Console()],
});

export default logger;
