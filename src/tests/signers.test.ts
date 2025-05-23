import { describe, expect, it } from "bun:test";
import app from "../index";
import { env } from "../config";

describe("Signers", () => {
  describe("derive-public-key", () => {
    it("should properly handle a correct request", async () => {
      const req = new Request("http://localhost/v1/signers/derive-public-key", {
        headers: {
          authorization: env.ACCESS_SECRET,
          "content-type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          signerId: "user:project",
          authId: "email:user@example.com",
          signingAlgorithm: "ed25519",
        }),
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        publicKey: expect.any(String),
      });
      expect(data.publicKey.length).toBeGreaterThan(0);
    });
  });
});
