import type { AppContext } from "../../types";
import { TappdClient } from "@phala/dstack-sdk"; // Ensure this is installed

export const getTEEPublicKeyHandler = async (c: AppContext) => {
	const services = c.get("services");
	const pubKeyBuffer = await services.encryptionService.getPublicKey();
	const pubKeyBase64 = Buffer.from(pubKeyBuffer).toString("base64");
	return c.json({
		publicKey: pubKeyBase64,
	});
};

export const getTDXQuoteHandler = async (c: AppContext) => {
	const services = c.get("services");
	const pubKeyBuffer = await services.encryptionService.getPublicKey();
	const pubKeyBase64 = Buffer.from(pubKeyBuffer).toString("base64");

	const client = new TappdClient();
	try {
		const result = await client.tdxQuote("test");
		return c.json({
			...result,
			publicKey: pubKeyBase64,
		});
	} catch (error) {
		console.error("Failed to get TDX quote:", error);
		return c.json({ error: "Failed to retrieve TDX quote" }, 500);
	}
};
