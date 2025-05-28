import type { AppContext } from "../../types";
import { TappdClient } from "@phala/dstack-sdk";

export const getAttestationHandler = async (c: AppContext) => {
	const services = c.get("services");
	const pubKeyBuffer = await services.encryptionService.getPublicKey();
	const result = await new TappdClient().tdxQuote(new Uint8Array(pubKeyBuffer));

	return c.json({
		quote: result.quote,
		publicKey: Buffer.from(pubKeyBuffer).toString("base64"),
	});
};

export const getTEEPublicKeyHandler = async (c: AppContext) => {
	const services = c.get("services");
	const pubKeyBuffer = await services.encryptionService.getPublicKey();

	return c.json({
		publicKey: Buffer.from(pubKeyBuffer).toString("base64"),
	});
};
