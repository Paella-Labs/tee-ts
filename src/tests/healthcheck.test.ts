import "./setup"; // Must be imported first to set up environment variables
import { describe, expect, it } from "bun:test";
import { createApp } from "../app";
import { env } from "../config";

describe("Healthcheck", () => {
	it("should return 200", async () => {
		const app = await createApp();

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
