import { SignerService } from "./service";
import { EncryptionService } from "./encryption";

import {
	ENVSchema,
	OTPVerificationSchema,
	SignerPreGenerationSchema,
	SignerRequestSchema,
} from "./schema";
import { z } from "zod";
import { TappdClient } from "@phala/dstack-sdk";

const env = ENVSchema.parse(process.env);

// Initialize encryption service singleton
const encryptionService = EncryptionService.getInstance();
await encryptionService.init();
console.log("Encryption service initialized successfully");

function validateRequest<T extends z.ZodType>(
	schema: T,
	data: unknown,
	logPrefix = "",
): z.infer<T> {
	const validationResult = schema.safeParse(data);

	if (!validationResult.success) {
		if (logPrefix) {
			console.log(
				`${logPrefix}: Validation failed`,
				validationResult.error.format(),
			);
		}

		throw new Response(
			JSON.stringify({
				error: "Validation failed",
				details: validationResult.error.format(),
			}),
			{ status: 400 },
		);
	}

	return validationResult.data;
}

const EncryptedRequestSchema = z.object({
	ciphertext: z.string(),
	encapsulatedKey: z.string(),
});

// Response type definition
type UnencryptedOtpResponse = {
	shares: {
		device: string;
		auth: string;
	};
};
// We also return, alongside the encrypted response, the Auth share (unencrypted), so the crossmint middleware can store it
type EncryptedOtpResponse = z.infer<typeof EncryptedRequestSchema> & {
	shares: {
		auth: string;
	};
	deviceKeyShareHash: string;
};
type OtpResponse = UnencryptedOtpResponse | EncryptedOtpResponse;

function isEncryptedRequest(
	data: unknown,
): data is z.infer<typeof EncryptedRequestSchema> {
	const validationResult = EncryptedRequestSchema.safeParse(data);

	return validationResult.success;
}

function handleError(error: unknown, logPrefix = ""): Response {
	if (error instanceof Response) {
		return error;
	}

	if (logPrefix) {
		console.error(`[ERROR] ${logPrefix}:`, error);
	} else {
		console.error("[ERROR] Unhandled route error:", error);
	}

	const res = new Response(
		JSON.stringify({
			error: "Request failed",
			message: error instanceof Error ? error.message : String(error),
			code: "INTERNAL_SERVER_ERROR",
		}),
		{
			status: 500,
			headers: { "Content-Type": "application/json" },
		},
	);
	return res;
}

function authenticate(req: Request) {
	if (req.headers.get("authorization") !== `${env.ACCESS_SECRET}`) {
		throw new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
		});
	}
}

const signerService = new SignerService(
	env.SENDGRID_API_KEY,
	env.SENDGRID_EMAIL_TEMPLATE_ID,
	env.MOCK_TEE_SECRET,
);

async function generateEncryptedResponse<T extends z.ZodType>(
	data: z.infer<T>,
	receiverPublicKey: string,
) {
	return encryptionService.encryptBase64(data, receiverPublicKey);
}

const server = Bun.serve({
	port: env.PORT,
	routes: {
		"/health": {
			async GET() {
				return new Response(JSON.stringify({ status: "healthy" }), {
					headers: { "Content-Type": "application/json" },
				});
			},
		},
		"/signers/:deviceId": {
			async POST(req) {
				try {
					authenticate(req);
					const { deviceId } = req.params;

					if (!deviceId) {
						throw new Response(JSON.stringify({ error: "Invalid deviceId" }), {
							status: 400,
						});
					}

					const body = await req.json();
					const {
						userId,
						projectId,
						projectName,
						projectLogo,
						authId,
						encryptionContext,
					} = validateRequest(
						SignerRequestSchema,
						body,
						`[DEBUG] POST /signers/${deviceId}`,
					);

					await signerService.initiateSignerCreation(
						userId,
						projectId,
						projectName,
						authId,
						deviceId,
						projectLogo,
						encryptionContext,
					);

					const res = Response.json({
						message: "OTP sent successfully",
					});
					return res;
				} catch (error) {
					return handleError(error, "POST /signers/:deviceId");
				}
			},
		},
		"/signers/public-key": {
			async PUT(req) {
				try {
					authenticate(req);
					const body = await req.json();
					const { userId, projectId, authId, signingAlgorithm } =
						validateRequest(
							SignerPreGenerationSchema,
							body,
							"[DEBUG] PUT /signers/public-key",
						);

					const publicKey = await signerService.preGenerateSigner(
						userId,
						projectId,
						authId,
						signingAlgorithm,
					);

					const res = Response.json({ publicKey });
					return res;
				} catch (error) {
					return handleError(error, "PUT /signers/public-key");
				}
			},
		},

		"/signers/:deviceId/auth": {
			async POST(req) {
				try {
					authenticate(req);
					const { deviceId } = req.params;

					if (!deviceId) {
						throw new Response(JSON.stringify({ error: "Invalid deviceId" }), {
							status: 400,
						});
					}

					const body = await req.json();
					const isEncrypted = isEncryptedRequest(body);

					let unencryptedBody: z.infer<typeof OTPVerificationSchema>;
					let senderPublicKey: string | null = null;

					if (isEncrypted) {
						const decryptedPayload = await encryptionService.decryptBase64<{
							data: z.infer<typeof OTPVerificationSchema>;
							encryptionContext: { senderPublicKey: string };
						}>(body.ciphertext, body.encapsulatedKey);
						unencryptedBody = decryptedPayload.data;
						senderPublicKey = decryptedPayload.encryptionContext.senderPublicKey;
					} else {
						unencryptedBody = body;
					}
					console.log("Unencrypted payload", unencryptedBody);	
					
					const { otp } = validateRequest(
						OTPVerificationSchema,
						unencryptedBody,
						"[DEBUG] /signers/:deviceId/auth",
					);

					const { device, auth, deviceKeyShareHash } =
						await signerService.completeSignerCreation(deviceId, otp);

					const unencryptedResponse = {
						shares: { device, auth },
					};

					let response: EncryptedOtpResponse | OtpResponse;
					if (isEncrypted) {
						const encryptedResponse = await generateEncryptedResponse(
							unencryptedResponse,
							senderPublicKey as NonNullable<typeof senderPublicKey>,
						);
						response = {
							...encryptedResponse,
							shares: {
								auth: unencryptedResponse.shares.auth,
							},
							deviceKeyShareHash,
						};
					} else {
						response = unencryptedResponse;
					}

					const res = Response.json(response);

					res.headers.set("Access-Control-Allow-Origin", "*"); // TODO: restrict to xm
					res.headers.set(
						"Access-Control-Allow-Methods",
						"GET, POST, PUT, DELETE, OPTIONS",
					);
					return res;
				} catch (error) {
					return handleError(error, "POST /requests/:requestId/auth");
				}
			},
		},
		"/attestation": {
			async GET(req) {
				const pubKeyBuffer = await encryptionService.getPublicKey();
				const pubKeyBase64 = Buffer.from(pubKeyBuffer).toString("base64");
				const res = Response.json({
					publicKey: pubKeyBase64,
				});
				res.headers.set("Access-Control-Allow-Origin", "*"); // TODO: restrict to iframe
				res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
				return res;
			},
		},

		"/attestation/tdx_quote": async (req) => {
			const client = new TappdClient();
			const result = await client.tdxQuote("test");
			return new Response(JSON.stringify(result));
		},
	},
	development: true,
});

console.log(`Listening on http://localhost:${server.port} ...`);
