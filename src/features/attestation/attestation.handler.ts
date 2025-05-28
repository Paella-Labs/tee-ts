import { env } from "config";
import type { AppContext } from "../../types";
import { TappdClient } from "@phala/dstack-sdk";

export const attestationHandler = async (c: AppContext) => {
	const services = c.get("services");
	const pubKeyBuffer = await services.encryptionService.getPublicKey();

	return c.json({
		quote: await getQuote(pubKeyBuffer),
		publicKey: Buffer.from(pubKeyBuffer).toString("base64"),
	});
};

async function getQuote(publicKey: ArrayBuffer): Promise<string> {
	if (env.DEVELOPMENT_MODE) {
		return Buffer.from("mock-quote").toHex();
	}

	const result = await new TappdClient().tdxQuote(new Uint8Array(publicKey));
	return result.quote;
}
