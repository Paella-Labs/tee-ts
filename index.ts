import { split } from "shamir-secret-sharing";
import { randomUUID } from "node:crypto";
import sendgrid from "@sendgrid/mail";
import { z } from "zod";

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY == null) {
	throw new Error("Ahhh");
}

sendgrid.setApiKey(process.env.SENDGRID_API_KEY as string);

// Simple in-memory storage for OTP requests
interface OTPRequest {
	otp: string;
	userId: string;
	projectId: string;
	authId: string;
	createdAt: number;
}

const otpRequests = new Map<string, OTPRequest>();

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

// Send email using SendGrid
async function sendEmail(subject: string, body: string, recipient: string) {
	try {
		console.log("[DEBUG] Attempting to send email to:", recipient);

		// Check if SendGrid API key is set
		if (!process.env.SENDGRID_API_KEY) {
			console.warn(
				"[WARN] SENDGRID_API_KEY not set, falling back to console logging",
			);
			console.log("\n=== EMAIL (MOCK) ===");
			console.log("To:", recipient);
			console.log("Subject:", subject);
			console.log("Body:", body);
			console.log("==================\n");
			return;
		}

		const msg = {
			to: recipient,
			from: "hello@crossmint.io",
			subject: subject,
			text: body,
			html: `<div>${body}</div>`,
		};

		await sendgrid.send(msg);
		console.log("[DEBUG] Email successfully sent to", recipient);
	} catch (error) {
		console.error("[ERROR] Error sending email:", error);
		// Log the OTP anyway for testing purposes
		console.log("\n=== EMAIL ERROR - OTP LOGGING FALLBACK ===");
		console.log("To:", recipient);
		console.log("Subject:", subject);
		console.log("Body:", body);
		console.log("==================\n");

		// Don't throw, just log
		console.error("[ERROR] Will continue despite email error");
	}
}

// Generate a cryptographically secure random OTP
function generateOTP(): string {
	// Generate 4 bytes of random data (32 bits)
	const randomBytes = new Uint8Array(4);
	crypto.getRandomValues(randomBytes);

	// Convert to a number and ensure it's 6 digits by modulo and padding
	const randomNumber = new DataView(randomBytes.buffer).getUint32(0) % 1000000;
	return randomNumber.toString().padStart(6, "0");
}

/**
 * Derives a master secret using HKDF based on user-specific identifiers
 * @param userId - The user identifier
 * @param projectId - The project identifier
 * @param authId - The authentication method identifier
 * @returns A Uint8Array containing the derived master secret
 */
async function deriveMasterSecret(
	userId: string,
	projectId: string,
	authId: string,
): Promise<Uint8Array> {
	// Get the TEE secret
	const secretKey = process.env.TEE_SECRET;
	if (secretKey == null) {
		throw new Error("TEE_SECRET not set in environment");
	}

	// Prepare info for key derivation
	const info = new TextEncoder().encode(
		JSON.stringify({
			user_id: userId,
			project_id: projectId,
			auth_id: authId,
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

	// Derive bits using HKDF
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

	return new Uint8Array(derivedBits);
}

const server = Bun.serve({
	port: 3000,
	routes: {
		"/signers": {
			async POST(req) {
				console.log("[DEBUG] /signers: Received request");
				try {
					const body = await req.json();
					console.log("[DEBUG] /signers: Request body:", body);

					// Validate the request body using Zod
					const validationResult = SignerRequestSchema.safeParse(body);
					if (!validationResult.success) {
						console.log(
							"[DEBUG] /signers: Validation failed",
							validationResult.error.format(),
						);
						return new Response(
							JSON.stringify({
								error: "Validation failed",
								details: validationResult.error.format(),
							}),
							{ status: 400 },
						);
					}

					const { userId, projectId, authId } = validationResult.data;
					// Extract email - our validation ensures this exists
					const emailPart = authId.split(":")[1];
					if (!emailPart) {
						return new Response(
							JSON.stringify({ error: "Invalid authId format" }),
							{ status: 400 },
						);
					}
					const email = emailPart;
					console.log("[DEBUG] /signers: Extracted email:", email);

					// Generate OTP
					const otp = generateOTP();
					console.log("[DEBUG] /signers: Generated OTP:", otp);
					const requestId = randomUUID();
					console.log("[DEBUG] /signers: Generated request ID:", requestId);

					// Store request details
					otpRequests.set(requestId, {
						otp,
						userId,
						projectId,
						authId,
						createdAt: Date.now(),
					});
					console.log("[DEBUG] /signers: Stored request in memory map");

					// Send email with OTP
					console.log("[DEBUG] /signers: Attempting to send email");
					try {
						await sendEmail(
							"Your Crossmint verification code",
							`Your verification code is: ${otp}`,
							email,
						);
						console.log("[DEBUG] /signers: Email sent or logged successfully");
					} catch (emailError) {
						console.error(
							"[ERROR] /signers: Failed to send email:",
							emailError,
						);
						// We don't throw here anymore since sendEmail handles errors internally
					}

					console.log("[DEBUG] /signers: Returning success response");
					return Response.json({
						requestId,
						message: "OTP sent successfully",
					});
				} catch (error) {
					console.error("[ERROR] /signers: Error processing request:", error);
					return new Response(
						JSON.stringify({
							error: "Failed to process request",
							details: error instanceof Error ? error.message : String(error),
						}),
						{ status: 500 },
					);
				}
			},
		},
		"/requests/:requestId/auth": {
			async POST(req) {
				console.log("[DEBUG] /requests/auth: Received request");
				try {
					const url = new URL(req.url);
					console.log("[DEBUG] /requests/auth: URL:", url.toString());

					const pathParts = url.pathname.split("/");
					console.log("[DEBUG] /requests/auth: Path parts:", pathParts);

					const requestId = pathParts[2];
					console.log(
						"[DEBUG] /requests/auth: Extracted request ID:",
						requestId,
					);

					if (!requestId) {
						console.log("[DEBUG] /requests/auth: Missing request ID");
						return new Response(
							JSON.stringify({ error: "Invalid request ID" }),
							{ status: 400 },
						);
					}

					const body = await req.json();
					console.log("[DEBUG] /requests/auth: Request body:", body);

					// Validate OTP using Zod
					const validationResult = OTPVerificationSchema.safeParse(body);
					if (!validationResult.success) {
						console.log(
							"[DEBUG] /requests/auth: Validation failed",
							validationResult.error.format(),
						);
						return new Response(
							JSON.stringify({
								error: "Validation failed",
								details: validationResult.error.format(),
							}),
							{ status: 400 },
						);
					}

					const { otp } = validationResult.data;

					// Retrieve request from storage
					const request = otpRequests.get(requestId);
					if (!request) {
						console.log(
							"[DEBUG] /requests/auth: Request ID not found:",
							requestId,
						);
						return new Response(
							JSON.stringify({ error: "Invalid request ID" }),
							{ status: 401 },
						);
					}
					console.log(
						"[DEBUG] /requests/auth: Found request in memory map:",
						request,
					);

					// Verify OTP
					console.log(
						`[DEBUG] /requests/auth: Comparing OTPs: ${otp} vs ${request.otp}`,
					);
					if (request.otp !== otp) {
						console.log("[DEBUG] /requests/auth: OTP mismatch");
						return new Response(JSON.stringify({ error: "Invalid OTP" }), {
							status: 401,
						});
					}
					console.log("[DEBUG] /requests/auth: OTP verified successfully");

					// Derive the master secret using the request data
					console.log("[DEBUG] /requests/auth: Deriving master secret");
					const masterSecret = await deriveMasterSecret(
						request.userId,
						request.projectId,
						request.authId,
					);
					console.log(
						"[DEBUG] /requests/auth: Master secret derived successfully",
					);

					// Split the master secret into device and auth shares
					console.log("[DEBUG] /requests/auth: Splitting master secret");
					const [device, auth] = await split(masterSecret, 2, 2);
					if (device == null || auth == null) {
						console.error("[ERROR] /requests/auth: Failed to split secret");
						throw new Error("shamir secret split failed");
					}
					console.log("[DEBUG] /requests/auth: Secret split successfully");

					// Clean up request from storage
					otpRequests.delete(requestId);
					console.log(
						"[DEBUG] /requests/auth: Removed request from memory map",
					);

					console.log("[DEBUG] /requests/auth: Returning key shares");
					return Response.json({
						shares: {
							device: Buffer.from(device).toString("hex"),
							auth: Buffer.from(auth).toString("hex"),
						},
					});
				} catch (error) {
					console.error(
						"[ERROR] /requests/auth: Error processing request:",
						error,
					);
					return new Response(
						JSON.stringify({
							error: "Failed to authenticate",
							details: error instanceof Error ? error.message : String(error),
						}),
						{ status: 500 },
					);
				}
			},
		},
	},
	development: true,
});

console.log(`Listening on http://localhost:${server.port} ...`);
