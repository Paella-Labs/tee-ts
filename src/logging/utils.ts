import customLogger from "./logger";
import util from "node:util";

export function setupLogging() {
	// biome-ignore lint/suspicious/noExplicitAny:
	console.log = (...args: any[]) => {
		customLogger.info(util.format(...args));
	};

	// biome-ignore lint/suspicious/noExplicitAny:
	console.info = (...args: any[]) => {
		customLogger.info(util.format(...args));
	};

	// biome-ignore lint/suspicious/noExplicitAny:
	console.warn = (...args: any[]) => {
		customLogger.warn(util.format(...args));
	};

	// biome-ignore lint/suspicious/noExplicitAny:
	console.error = (...args: any[]) => {
		// If the first argument is an Error, pass it directly to preserve stack traces etc.
		// Winston's `errors({ stack: true })` format will handle it.
		if (args[0] instanceof Error) {
			const additionalArgs = args.slice(1).reduce(
				(obj, item, index) => {
					obj[`arg${index + 1}`] = item;
					return obj;
				},
				{} as Record<string, unknown>,
			);
			customLogger.error(args[0].message, {
				error: args[0],
				...additionalArgs,
			});
		} else {
			customLogger.error(util.format(...args));
		}
	};

	// biome-ignore lint/suspicious/noExplicitAny:
	console.debug = (...args: any[]) => {
		customLogger.debug(util.format(...args));
	};
}
