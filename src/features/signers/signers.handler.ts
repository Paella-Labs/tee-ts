import type { AppContext } from "../../types";
import {
	type CompleteOnboardingRequest,
	type EncryptedRequest,
	type SignerPreGenerationInput,
	type StartOnboardingRequestSchema,
	CompleteOnboardingRequestSchema,
	isEncryptedRequest,
} from "../../schemas";
import type { z } from "zod";
import { HTTPException } from "hono/http-exception";

export const derivePublicKeyHandler = async (c: AppContext) => {
	const services = c.get("services");
	const body = await c.req.json<SignerPreGenerationInput>();

	const { signerId, authId, signingAlgorithm } = body;

	console.log("[DEBUG] PUT /v1/signers/derive-public-key - Body:", body);

	const publicKey = await services.trustedService.preGenerateSigner(
		signerId,
		authId,
		signingAlgorithm,
	);

	return c.json({ publicKey });
};

export const startOnboardingHandler = async (c: AppContext) => {
	const services = c.get("services");
	const body = await c.req.json<z.infer<typeof StartOnboardingRequestSchema>>();
	const {
		projectName,
		projectLogo,
		authId,
		deviceId,
		encryptionContext,
		signerId,
	} = body;

	await services.trustedService.initiateSignerCreation(
		signerId,
		projectName,
		authId,
		deviceId,
		encryptionContext,
		projectLogo,
	);
	return c.json({ message: "OTP sent successfully" });
};

export const completeOnboardingHandler = async (c: AppContext) => {
	const services = c.get("services");
	const encryptedBody = await c.req.json<EncryptedRequest>();
	// TODO: Extract encryption to a middleware
	if (!isEncryptedRequest(encryptedBody)) {
		throw new HTTPException(400, {
			message: "Invalid request. Encrypted request expected.",
		});
	}

	const { ciphertext, encapsulatedKey } = encryptedBody;
	let decryptedBody: CompleteOnboardingRequest;
	let senderPublicKey: string;
	try {
		const decryptedPayload = await services.encryptionService.decryptBase64<{
			data: CompleteOnboardingRequest;
			encryptionContext: { senderPublicKey: string };
		}>(ciphertext, encapsulatedKey);
		decryptedBody = CompleteOnboardingRequestSchema.parse(
			decryptedPayload.data,
		);
		senderPublicKey = decryptedPayload.encryptionContext.senderPublicKey;
	} catch (error) {
		console.error(error);
		throw new HTTPException(400, {
			message: "Invalid request. Decryption failed.",
		});
	}

	const {
		deviceId,
		onboardingAuthentication: { otp },
	} = decryptedBody;

	const { device, auth, deviceKeyShareHash } =
		await services.trustedService.completeSignerCreation(deviceId, otp);

	const unencryptedResponse = {
		shares: { device, auth },
	};

	const encryptedResponse = await services.encryptionService.encryptBase64(
		unencryptedResponse,
		senderPublicKey,
	);
	return c.json({
		...encryptedResponse,
		shares: {
			auth: unencryptedResponse.shares.auth,
		},
		deviceKeyShareHash,
	});
};
