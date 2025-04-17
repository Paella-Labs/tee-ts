import { split, combine } from "shamir-secret-sharing";

const server = Bun.serve({
	port: 3000,
	routes: {
		"/keys": {
			async POST(req) {
				const secretKey = process.env.TEE_SECRET;
				if (secretKey == null) {
					throw new Error("Invalid env");
				}

				const info = new TextEncoder().encode(
					JSON.stringify({
						user_id: "devlyn",
						project_id: "test_project",
						auth_id: "EMAIL_OTP:devlyndorfer@gmail.com",
						version: "1",
					}),
				);

				// Import the secret key as raw key material
				const keyMaterial = await crypto.subtle.importKey(
					"raw",
					new TextEncoder().encode(secretKey),
					{ name: "HKDF" },
					false,
					["deriveBits"],
				);

				const derivedBits = await crypto.subtle.deriveBits(
					{
						name: "HKDF",
						hash: "SHA-256",
						salt: new Uint8Array(32),
						info,
					},
					keyMaterial,
					256,
				);

				const masterSecret = new Uint8Array(derivedBits);

				const [device, auth] = await split(masterSecret, 2, 2);
				if (device == null || auth == null) {
					throw new Error("shamir secret split failed");
				}

				return Response.json({
					master: Buffer.from(masterSecret).toString("hex"),
					shares: {
						device: Buffer.from(device).toString("hex"),
						auth: Buffer.from(auth).toString("hex"),
					},
				});
			},
		},
		"/combine": {
			async POST(req) {
				const body = await req.json();
				const { device, auth } = body;

				if (!device || !auth) {
					return new Response(
						JSON.stringify({ error: "Missing device or auth share" }),
						{ status: 400 },
					);
				}

				try {
					const deviceBytes = Uint8Array.from(Buffer.from(device, "hex"));
					const authBytes = Uint8Array.from(Buffer.from(auth, "hex"));

					const masterSecret = await combine([deviceBytes, authBytes]);

					return Response.json({
						masterSecret: Buffer.from(masterSecret).toString("hex"),
					});
				} catch (error) {
					return new Response(
						JSON.stringify({ error: "Failed to combine shares" }),
						{ status: 400 },
					);
				}
			},
		},
	},
	development: true,
});

console.log(`Listening on http://localhost:${server.port} ...`);
