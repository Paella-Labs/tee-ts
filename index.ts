import { TrustedService } from "./service";
import { EncryptionService } from "./encryption";
import { InMemoryOTPService } from "./otp-service";
import { SendgridEmailService } from "./email-service";
import { KeyService } from "./key-service";

import {
	ENVSchema,
	OTPVerificationSchema,
	SignerPreGenerationSchema,
	SignerRequestSchema,
} from "./schema";
import { z } from "zod";
import { TappdClient } from "@phala/dstack-sdk";

/**
 * Service container that holds all service instances
 */
interface ServiceContainer {
	trustedService: TrustedService;
	encryptionService: EncryptionService;
}

/**
 * Initialize all services and return a service container
 */
async function initializeServices(
	env: z.infer<typeof ENVSchema>,
): Promise<ServiceContainer> {
	console.log("Initializing services...");

	// Initialize encryption service
	const encryptionService = EncryptionService.getInstance();
	await encryptionService.init();
	console.log("Encryption service initialized successfully");

	// Initialize OTP service
	const otpService = InMemoryOTPService.getInstance();
	console.log("OTP service initialized successfully");

	// Initialize Email service
	const emailService = new SendgridEmailService(
		env.SENDGRID_API_KEY,
		env.SENDGRID_EMAIL_TEMPLATE_ID,
	);
	console.log("Email service initialized successfully");

	// Initialize Key service
	const keyService = new KeyService(env.MOCK_TEE_SECRET);
	console.log("Key service initialized successfully");

	// Create the TrustedService
	const trustedService = new TrustedService(
		otpService,
		emailService,
		keyService,
		encryptionService,
	);

	// Return all services in a container
	return {
		trustedService,
		encryptionService,
	};
}

const env = ENVSchema.parse(process.env);
const services = await initializeServices(env);
console.log("All services initialized successfully");

// Start the server
const server = Bun.serve({
	port: env.PORT,
	routes: {
		"/health": {
			async GET() {
				console.log("[Health] OK");
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

					await services.trustedService.initiateSignerCreation(
						userId,
						projectId,
						projectName,
						authId,
						deviceId,
						encryptionContext,
						projectLogo,
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

					const publicKey = await services.trustedService.preGenerateSigner(
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
					if (!isEncryptedRequest(body)) {
						throw new Response(
							JSON.stringify({ error: "Request must be encrypted" }),
							{ status: 400 },
						);
					}

					const decryptedPayload =
						await services.encryptionService.decryptBase64<{
							data: z.infer<typeof OTPVerificationSchema>;
							encryptionContext: { senderPublicKey: string };
						}>(body.ciphertext, body.encapsulatedKey);
					const unencryptedBody = decryptedPayload.data;
					const senderPublicKey =
						decryptedPayload.encryptionContext.senderPublicKey;

					console.log("Unencrypted payload", unencryptedBody);

					const { otp } = validateRequest(
						OTPVerificationSchema,
						unencryptedBody,
						"[DEBUG] /signers/:deviceId/auth",
					);

					const { device, auth, deviceKeyShareHash } =
						await services.trustedService.completeSignerCreation(deviceId, otp);

					const unencryptedResponse = {
						shares: { device, auth },
					};

					const encryptedResponse = await generateEncryptedResponse(
						services.encryptionService,
						unencryptedResponse,
						senderPublicKey,
					);

					const res = Response.json({
						...encryptedResponse,
						shares: {
							auth: unencryptedResponse.shares.auth,
						},
						deviceKeyShareHash,
					});

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
				const pubKeyBuffer = await services.encryptionService.getPublicKey();
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

async function generateEncryptedResponse<T extends z.ZodType>(
	encryptionService: EncryptionService,
	data: z.infer<T>,
	receiverPublicKey: string,
) {
	return encryptionService.encryptBase64(data, receiverPublicKey);
}
