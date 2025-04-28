import { SignerService } from "./service";
import {
	ENVSchema,
	OTPVerificationSchema,
	SignerPreGenerationSchema,
	SignerRequestSchema,
} from "./schema";
import type { z } from "zod";

const env = ENVSchema.parse(process.env);

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
	env.MOCK_TEE_SECRET,
);

const server = Bun.serve({
	port: env.PORT,
	routes: {
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
					const { userId, projectId, authId } = validateRequest(
						SignerRequestSchema,
						body,
						`[DEBUG] POST /signers/${deviceId}`,
					);

					await signerService.initiateSignerCreation(
						userId,
						projectId,
						authId,
						deviceId,
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
					const { otp } = validateRequest(
						OTPVerificationSchema,
						body,
						"[DEBUG] POST /requests/auth",
					);

					const { device, auth, signerId } =
						await signerService.completeSignerCreation(deviceId, otp);

					const res = Response.json({ shares: { device, auth }, signerId });
					return res;
				} catch (error) {
					return handleError(error, "POST /requests/:requestId/auth");
				}
			},
		},
	},
	development: true,
});

console.log(`Listening on http://localhost:${server.port} ...`);
