import "./setup"; // Must be imported first to set up environment variables
import { describe, expect, it } from "bun:test";
import { createApp } from "../app";
import { deriveDevEncryptionKey } from "../key";
import { initializeServices } from "../services";
import { env } from "../config";

describe("Healthcheck", () => {
	it("should return 200", async () => {
		const encryptionKey = await deriveDevEncryptionKey();
		const services = await initializeServices(env, encryptionKey);
		const app = await createApp(services);

		const req = new Request("http://localhost/health", {
			headers: {
				authorization: env.ACCESS_SECRET,
			},
		});
		const res = await app.fetch(req);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toEqual({ status: "healthy" });
	});
});
