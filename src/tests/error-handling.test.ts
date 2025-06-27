import "./setup"; // Must be imported first to set up environment variables
import { describe, expect, it } from "bun:test";
import { createApp } from "../app";
import { devIdentityKey } from "../key";
import { initializeServices } from "../services";
import { env } from "../config";

describe("Error Handling", () => {
  describe("JSON Error Responses", () => {
    it("should return JSON error for invalid request format", async () => {
      const identityKey = await devIdentityKey();
      const services = await initializeServices(env, identityKey);
      const app = await createApp(services);

      const req = new Request("http://localhost/v1/signers/derive-public-key", {
        headers: {
          authorization: env.ACCESS_SECRET,
          "content-type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          // Missing required fields
          invalidField: "invalid",
        }),
      });

      const res = await app.fetch(req);

      // Check that we get a proper JSON error response
      expect(res.status).toBe(400);
      const contentType = res.headers.get("Content-Type");
      expect(contentType).not.toBeNull();
      expect(contentType).toMatch(/application\/json/);

      const errorData = await res.json();
      expect(errorData).toHaveProperty("error");
    });
  });
});
