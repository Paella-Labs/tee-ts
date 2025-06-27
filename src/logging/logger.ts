import winston from "winston";
import { env } from "../config";

const { combine, timestamp, errors, prettyPrint } = winston.format;

const logger = winston.createLogger({
	level: env.LOG_LEVEL,
	format: combine(errors({ stack: true }), timestamp(), prettyPrint()),
	transports: [new winston.transports.Console()],
});

export default logger;
