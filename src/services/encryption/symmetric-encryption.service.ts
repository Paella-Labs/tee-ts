import { SymmetricEncryptionHandler } from "./lib/encryption/symmetric/standard/handler";
import type { KeyPairProvider } from "./lib/key-management/provider";
import { ECDHKeyProvider } from "./lib/key-management/ecdh-key-provider";

export class SymmetricEncryptionService {
  constructor(private readonly keyPairProvider: KeyPairProvider) {}

  async encrypt(
    data: Uint8Array,
    receiverPublicKey: CryptoKey
  ): Promise<Uint8Array> {
    const handler = new SymmetricEncryptionHandler();
    return handler.encrypt(
      data,
      await this.deriveEncryptionKey(receiverPublicKey)
    );
  }

  async decrypt(
    data: Uint8Array,
    senderPublicKey: CryptoKey
  ): Promise<Uint8Array> {
    const handler = new SymmetricEncryptionHandler();
    return handler.decrypt(
      data,
      await this.deriveEncryptionKey(senderPublicKey)
    );
  }

  private async deriveEncryptionKey(
    receiverPublicKey: CryptoKey
  ): Promise<CryptoKey> {
    const keyProvider = new ECDHKeyProvider(this.keyPairProvider, {
      getPublicKey: async () => receiverPublicKey,
    });
    return await keyProvider.getSymmetricKey();
  }
}
