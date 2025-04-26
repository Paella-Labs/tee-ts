import { z } from "zod";
import { SignerService } from "./service";

const env = z
	.object({
		SENDGRID_API_KEY: z
			.string()
			.min(1, { message: "SendGrid API key is required" }),
		MOCK_TEE_SECRET: z
			.string()
			.min(1, { message: "MOCK_TEE_SECRET is required" }),
		ACCESS_SECRET: z.string().min(1, { message: "ACCESS_SECRET is required" }),
		PORT: z
			.string()
			.optional()
			.transform((val) => (val ? Number.parseInt(val, 10) : 3000)),
	})
	.parse(process.env);

// Zod schemas for request validation
const SignerRequestSchema = z.object({
	userId: z.string().min(1, { message: "User ID is required" }),
	projectId: z.string().min(1, { message: "Project ID is required" }),
	authId: z
		.string()
		.min(1, { message: "Auth ID is required" })
		.refine((val) => val.startsWith("email:"), {
			message: "Auth ID must start with email:",
		})
		.refine(
			(val) => {
				const email = val.split(":")[1];
				return email?.includes("@");
			},
			{
				message: "Auth ID must contain a valid email address",
			},
		),
});

const OTPVerificationSchema = z.object({
	otp: z.string().length(6, { message: "OTP must be 6 digits" }),
});

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
						`[DEBUG] /signers${deviceId}`,
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
					return handleError(error, "/signers");
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
						"[DEBUG] /requests/auth",
					);

					const { device, auth, signerId } =
						await signerService.completeSignerCreation(deviceId, otp);

					const res = Response.json({ shares: { device, auth }, signerId });
					return res;
				} catch (error) {
					return handleError(error, "/requests/:requestId/auth");
				}
			},
		},
	},
	development: true,
});

console.log(`Listening on http://localhost:${server.port} ...`);
