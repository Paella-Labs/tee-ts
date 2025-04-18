import { z } from "zod";
import { SignerService } from "./service";

const env = z
	.object({
		SENDGRID_API_KEY: z
			.string()
			.min(1, { message: "SendGrid API key is required" }),
		MOCK_TEE_SECRET: z.string().min(1, { message: "TEE_SECRET is required" }),
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
		.refine((val) => val.startsWith("EMAIL_OTP:"), {
			message: "Auth ID must start with EMAIL_OTP:",
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

	return new Response(
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
}

const signerService = new SignerService(
	env.SENDGRID_API_KEY,
	env.MOCK_TEE_SECRET,
);

const server = Bun.serve({
	port: env.PORT,
	routes: {
		"/signers": {
			async POST(req) {
				try {
					const body = await req.json();
					const { userId, projectId, authId } = validateRequest(
						SignerRequestSchema,
						body,
						"[DEBUG] /signers",
					);

					const requestId = await signerService.initiateSignerCreation(
						userId,
						projectId,
						authId,
					);

					const res = Response.json({
						requestId,
						message: "OTP sent successfully",
					});
					res.headers.set("Access-Control-Allow-Origin", "*");
					res.headers.set(
						"Access-Control-Allow-Methods",
						"GET, POST, PUT, DELETE, OPTIONS",
					);
					return res;
				} catch (error) {
					return handleError(error, "/signers");
				}
			},
		},

		"/requests/:requestId/auth": {
			async POST(req) {
				try {
					const { requestId } = req.params;

					if (!requestId) {
						throw new Response(
							JSON.stringify({ error: "Invalid request ID" }),
							{
								status: 400,
							},
						);
					}

					const body = await req.json();
					const { otp } = validateRequest(
						OTPVerificationSchema,
						body,
						"[DEBUG] /requests/auth",
					);

					const { device, auth, signerId } =
						await signerService.completeSignerCreation(requestId, otp);

					const res = Response.json({ shares: { device, auth }, signerId });
					res.headers.set("Access-Control-Allow-Origin", "*");
					res.headers.set(
						"Access-Control-Allow-Methods",
						"GET, POST, PUT, DELETE, OPTIONS",
					);
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
