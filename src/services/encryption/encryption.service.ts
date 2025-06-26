import {
  CipherSuite,
  Aes256Gcm,
  DhkemP256HkdfSha256,
  HkdfSha256,
} from "@hpke/core";
import { decodeBytes } from "./lib/utils";
import type { KeyPairProvider } from "./lib/key-management/provider";
import { AsymmetricEncryptionHandler } from "./lib/encryption/asymmetric/handler";

/**
 * EncryptionService implements HPKE with a specific Auth/Base mode pattern for TEE operations:
 *
 * **ENCRYPTION (Auth Mode):**
 * - Uses the TEE's static key pair for authentication
 * - Provides sender authenticity and forward secrecy
 * - Recipients can cryptographically verify the TEE's identity
 * - Complements client-side Base mode decryption with sender verification
 *
 * **DECRYPTION (Base Mode):**
 * - Does not require sender verification during decryption
 * - Allows for asymmetric verification patterns
 * - Complements client-side Base mode encryption (no sender authentication)
 * - Authentication context is handled at application layer via OTP/device verification
 *
 * **Communication Pattern:**
 * ```
 * Client → TEE: Base mode encryption (no client auth needed)
 * TEE → Client: Auth mode encryption (TEE proves identity)
 * ```
 *
 * This pattern ensures:
 * 1. Clients can send data without cryptographic authentication (handled via OTP)
 * 2. TEE responses are cryptographically authenticated and verifiable
 * 3. Hardware attestation provides root of trust for TEE's public key
 */
export class EncryptionService {
  private static instance: EncryptionService | null = null;

  private constructor(
    private readonly keyPairProvider: KeyPairProvider,
    private readonly suite: CipherSuite = new CipherSuite({
      kem: new DhkemP256HkdfSha256(),
      kdf: new HkdfSha256(),
      aead: new Aes256Gcm(),
    })
  ) {}

  public static getInstance(
    keyPairProvider: KeyPairProvider
  ): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService(keyPairProvider);
    }
    return EncryptionService.instance;
  }

  /**
   * Decrypts messages received FROM clients using HPKE Base mode.
   *
   * **Authentication Strategy:**
   * - Uses Base mode (no cryptographic sender verification at HPKE layer)
   * - Client authentication is handled at application layer via OTP verification
   * - Focuses on confidentiality rather than sender authenticity
   * - Complements client-side Base mode encryption pattern
   *
   * **Client-Side Encryption:**
   * Clients use Base mode encryption when sending to TEE:
   * ```typescript
   * await suite.createSenderContext({
   *   recipientPublicKey: teePublicKey // No senderKey = Base mode
   * })
   * ```
   *
   * @param ciphertext - Encrypted message data from client
   * @param encapsulatedKey - HPKE encapsulated key from client's encryption
   * @returns Promise resolving to decrypted data object
   * @throws {Error} When encryption service is not initialized
   * @throws {Error} When decryption operation fails (invalid ciphertext/key)
   */
  async decrypt<T extends Record<string, unknown>>(
    ciphertext: ArrayBuffer,
    encapsulatedKey: ArrayBuffer
  ): Promise<T> {
    const teeKeyPair = await this.keyPairProvider.getKeyPair();
    const handler = new AsymmetricEncryptionHandler(this.suite);
    return handler.decrypt(ciphertext, encapsulatedKey, teeKeyPair);
  }

  async decryptBase64<T extends Record<string, unknown>>(
    ciphertext: string,
    encapsulatedKey: string
  ) {
    return this.decrypt<T>(
      decodeBytes(ciphertext, "base64").buffer as ArrayBuffer,
      decodeBytes(encapsulatedKey, "base64").buffer as ArrayBuffer
    );
  }

  async getPublicKey(): Promise<ArrayBuffer> {
    const teeKey = await this.keyPairProvider.getKeyPair();
    return this.suite.kem.serializePublicKey(teeKey.publicKey);
  }
}
