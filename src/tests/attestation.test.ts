import "./setup"; // Must be imported first to set up environment variables
import { describe, expect, it } from "bun:test";
import { createApp } from "../app";
import { devIdentityKey } from "../key";
import { initializeServices } from "../services";
import { env } from "../config";

describe("Attestation", () => {
	it("should return 200 and a public key", async () => {
		const identityKey = await devIdentityKey();
		const services = await initializeServices(env, identityKey);
		const app = await createApp(services);

		const req = new Request("http://localhost/v1/attestation/public-key", {
			headers: {
				authorization: env.ACCESS_SECRET,
			},
		});
		const res = await app.fetch(req);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toEqual({ publicKey: expect.any(String) });
		expect(data.publicKey.length).toBeGreaterThan(0);
	});
});
