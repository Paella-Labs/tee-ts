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

	const { signerId, authId, keyType } = body;

	console.log("[DEBUG] POST /v1/signers/derive-public-key - Body:", body);

	const publicKey = await services.trustedService.derivePublicKey(
		signerId,
		authId,
		keyType,
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

	await services.trustedService.startOnboarding(
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

	const { masterUserKey, signerId, teepublicKey } =
		await services.trustedService.completeOnboarding(deviceId, otp);

	const encryptedUserKey = await services.symmetricEncryptionService.encrypt(
		masterUserKey,
		await services.keySerializer.deserializePublicKey(senderPublicKey),
	);

	return c.json({
		encryptedUserKey: {
			bytes: Buffer.from(encryptedUserKey).toString("base64"),
			encoding: "base64",
			encryptionPublicKey: teepublicKey,
		},
		userKeyHash: {
			bytes: Buffer.from(
				await crypto.subtle.digest("SHA-256", masterUserKey),
			).toString("base64"),
			encoding: "base64",
			algorithm: "SHA-256",
		},
		signature: {
			bytes: "",
			encoding: "base64",
			algorithm: "ECDSA",
			signingPublicKey: await services.keySerializer.serializePublicKey(
				(await services.teeKeyService.getKeyPair()).publicKey,
			),
		},
		deviceId,
		signerId,
	});
};
