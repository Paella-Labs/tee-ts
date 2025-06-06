import { env } from "./config";
import { createApp } from "./app";

async function main() {
	const app = await createApp();

	const server = {
		port: env.PORT,
		fetch: app.fetch,
	};

	console.log(`Server listening on http://localhost:${env.PORT} ...`);

	return server;
}

// Start the server
const serverOptions = await main();

export default serverOptions; // Export for Bun's runtime
