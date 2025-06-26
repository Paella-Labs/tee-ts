import { ECDH_KEY_SPEC } from "services/encryption/lib/encryption/encryption-consts";

import type { KeyPairProvider } from "../encryption/lib/key-management/provider";

export class TeeKeyService implements KeyPairProvider {
  private TEEEncryptionKey: CryptoKeyPair | null = null;

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
