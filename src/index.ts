import { env } from "./config";
import { createApp } from "./app";
import { TEEIdentityKey } from "./key";
import { initializeServices } from "./services";

async function main() {
	const identifyKey = await TEEIdentityKey();
	console.log("Encryption key derived successfully");

	const services = await initializeServices(env, identifyKey);
	const app = await createApp(services);

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
