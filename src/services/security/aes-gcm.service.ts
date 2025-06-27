import {
  AesGcm,
  type KeyPairProvider,
  deriveSymmetricKey,
} from "@crossmint/client-signers-cryptography";

export class AesGcmService {
  constructor(private readonly keyPairProvider: KeyPairProvider) {}

  async encrypt(
    data: Uint8Array,
    receiverPublicKey: CryptoKey
  ): Promise<Uint8Array> {
    const result = await new AesGcm().encrypt(
      data.buffer as ArrayBuffer,
      await this.deriveEncryptionKey(receiverPublicKey)
    );
    return new Uint8Array(result);
  }

  async decrypt(
    data: Uint8Array,
    senderPublicKey: CryptoKey
  ): Promise<Uint8Array> {
    const result = await new AesGcm().decrypt(
      data.buffer as ArrayBuffer,
      await this.deriveEncryptionKey(senderPublicKey)
    );
    return new Uint8Array(result);
  }

  private async deriveEncryptionKey(
    receiverPublicKey: CryptoKey
  ): Promise<CryptoKey> {
    const keyPair = await this.keyPairProvider.getKeyPair();
    return deriveSymmetricKey(keyPair.privateKey, receiverPublicKey);
  }
}
