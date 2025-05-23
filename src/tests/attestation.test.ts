import { describe, expect, it } from "bun:test";
import app from "../index";
import { env } from "../config";

describe("Attestation", () => {
	it("should return 200 and a public key", async () => {
		const req = new Request("http://localhost/attestation/public-key", {
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
