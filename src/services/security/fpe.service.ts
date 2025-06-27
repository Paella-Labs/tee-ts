import {
  FPE,
  type KeyPairProvider,
} from "@crossmint/client-signers-cryptography";
import { deriveSymmetricKey } from "@crossmint/client-signers-cryptography";

export class FPEService {
  constructor(private readonly keyPairProvider: KeyPairProvider) {}

  async encryptOTP(
    data: number[],
    receiverPublicKey: CryptoKey
  ): Promise<number[]> {
    const handler = new FPE();
    const key = await this.deriveEncryptionKey(receiverPublicKey);
    return await handler.encrypt(data, key);
  }

  private async deriveEncryptionKey(
    receiverPublicKey: CryptoKey
  ): Promise<CryptoKey> {
    const keyPair = await this.keyPairProvider.getKeyPair();
    return deriveSymmetricKey(keyPair.privateKey, receiverPublicKey);
  }
}
