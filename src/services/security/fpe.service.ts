import {
  FPE,
  type KeyPairProvider,
} from "@crossmint/client-signers-cryptography";
import { deriveSymmetricKey } from "@crossmint/client-signers-cryptography";

/**
 * Service for encrypting OTP (One-Time Password) requests using Format Preserving Encryption (FPE).
 *
 * This service provides secure encryption of OTP data while maintaining the format of the original data.
 * It uses ECDH key exchange to derive a shared symmetric key between the sender and receiver,
 * ensuring that only the intended recipient can decrypt the OTP request.
 */
export class FPEService {
  /**
   * Creates an instance of FPEService.
   * @param keyPairProvider - Provider for cryptographic key pairs used in ECDH key exchange
   */
  constructor(private readonly keyPairProvider: KeyPairProvider) {}

  /**
   * Encrypts data using Format Preserving Encryption.
   *
   * This method encrypts the data while preserving its numeric format.
   * The encryption uses a symmetric key derived from ECDH key exchange between
   * the service's private key and the receiver's public key.
   *
   * @param data - Array of numbers representing the OTP data to encrypt
   * @param receiverPublicKey - Public key of the intended recipient for key derivation
   * @returns Promise resolving to encrypted data as an array of numbers
   */
  async encrypt(
    data: number[],
    receiverPublicKey: CryptoKey
  ): Promise<number[]> {
    const handler = new FPE();
    const key = await this.deriveEncryptionKey(receiverPublicKey);
    return await handler.encrypt(data, key);
  }

  /**
   * Derives a symmetric encryption key using ECDH key exchange.
   *
   * This method performs an ECDH key exchange between the service's private key
   * and the receiver's public key to derive a shared symmetric key for encryption.
   *
   * @param receiverPublicKey - Public key of the intended recipient
   * @returns Promise resolving to the derived symmetric encryption key
   * @private
   */
  private async deriveEncryptionKey(
    receiverPublicKey: CryptoKey
  ): Promise<CryptoKey> {
    const keyPair = await this.keyPairProvider.getKeyPair();
    return deriveSymmetricKey(keyPair.privateKey, receiverPublicKey);
  }
}
