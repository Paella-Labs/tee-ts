import { FPEHandler } from "./lib/encryption/symmetric/fpe/handler";
import type { KeyPairProvider } from "./lib/key-management/provider";
import { ECDHKeyProvider } from "./lib/key-management/ecdh-key-provider";

export class FPEService {
	constructor(private readonly keyPairProvider: KeyPairProvider) {}

	async encryptOTP(
		data: number[],
		receiverPublicKey: CryptoKey,
	): Promise<number[]> {
		const handler = new FPEHandler();
		const key = await this.deriveEncryptionKey(receiverPublicKey);
		return await handler.encrypt(data, key);
	}

	private async deriveEncryptionKey(
		receiverPublicKey: CryptoKey,
	): Promise<CryptoKey> {
		const keyProvider = new ECDHKeyProvider(this.keyPairProvider, {
			getPublicKey: async () => receiverPublicKey,
		});
		return await keyProvider.getSymmetricKey();
	}
}
