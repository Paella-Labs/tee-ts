import {
  ECDH_KEY_SPEC,
  type KeyPairProvider,
} from "@crossmint/client-signers-cryptography";

export class TeeKeyService implements KeyPairProvider {
  private static instance: TeeKeyService | null = null;
  private TEEEncryptionKey: CryptoKeyPair | null = null;

  private constructor() {}

  public static getInstance(): TeeKeyService {
    if (!TeeKeyService.instance) {
      TeeKeyService.instance = new TeeKeyService();
    }
    return TeeKeyService.instance;
  }

  async getKeyPair(): Promise<CryptoKeyPair> {
    if (!this.TEEEncryptionKey) {
      this.TEEEncryptionKey = await crypto.subtle.generateKey(
        ECDH_KEY_SPEC,
        true,
        ["deriveKey", "deriveBits"]
      );
    }
    return this.TEEEncryptionKey;
  }
}
