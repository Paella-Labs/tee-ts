import { describe, expect, it } from "bun:test";
import app from "../index";
import { env } from "../config";

describe("Healthcheck", () => {
	it("should return 200", async () => {
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
