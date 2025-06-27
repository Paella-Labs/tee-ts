import {
  ECDH_KEY_SPEC,
  type KeyPairProvider,
} from "@crossmint/client-signers-cryptography";

/**
 * Service for managing TEE (Trusted Execution Environment) encryption keys.
 * Implements a singleton pattern to ensure only one instance exists throughout the application.
 * Provides cryptographic key pair generation and management capabilities using ECDH algorithm.
 */
export class TeeKeyService implements KeyPairProvider {
  /** The singleton instance of TeeKeyService */
  private static instance: TeeKeyService | null = null;

  /** The cached TEE encryption key pair used for cryptographic operations */
  private TEEEncryptionKey: CryptoKeyPair | null = null;

  /**
   * Private constructor to prevent direct instantiation.
   * Use getInstance() to get the singleton instance.
   */
  private constructor() {}

  /**
   * Gets the singleton instance of TeeKeyService.
   * Creates a new instance if one doesn't exist.
   *
   * @returns The singleton TeeKeyService instance
   */
  public static getInstance(): TeeKeyService {
    if (!TeeKeyService.instance) {
      TeeKeyService.instance = new TeeKeyService();
    }
    return TeeKeyService.instance;
  }

  /**
   * Gets or generates a cryptographic key pair for TEE operations.
   * If a key pair doesn't exist, generates a new ECDH key pair with the specified algorithm.
   * The generated key pair is cached for subsequent calls.
   *
   * @returns A Promise that resolves to the CryptoKeyPair used for TEE encryption
   * @throws {Error} If key generation fails
   */
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
