import {
	AesGcm,
	type KeyPairProvider,
	deriveSymmetricKey,
} from "@crossmint/client-signers-cryptography";

/**
 * Service for encrypting sensitive data using AES-GCM encryption.
 * Primarily used for encrypting the user master secret to ensure secure storage
 * and transmission of cryptographic keys within the TEE environment.
 */
export class AesGcmService {
	/**
	 * Creates an instance of AesGcmService.
	 * @param keyPairProvider Provider for cryptographic key pairs used in encryption operations
	 */
	constructor(private readonly keyPairProvider: KeyPairProvider) {}

	/**
	 * Encrypts data using AES-GCM encryption with a derived symmetric key.
	 * This method is primarily used to encrypt the user master secret before storage.
	 *
	 * @param data The data to encrypt (typically the user master secret)
	 * @param receiverPublicKey The public key of the intended recipient
	 * @returns Promise that resolves to the encrypted data as a Uint8Array
	 */
	async encrypt(
		data: Uint8Array,
		receiverPublicKey: CryptoKey,
	): Promise<Uint8Array> {
		const result = await new AesGcm().encrypt(
			data.buffer as ArrayBuffer,
			await this.deriveEncryptionKey(receiverPublicKey),
		);
		return new Uint8Array(result);
	}

	/**
	 * Derives a symmetric encryption key using ECDH key agreement.
	 * Combines the service's private key with the receiver's public key
	 * to create a shared secret for encryption.
	 *
	 * @param receiverPublicKey The public key to derive the shared secret with
	 * @returns Promise that resolves to the derived symmetric encryption key
	 */
	private async deriveEncryptionKey(
		receiverPublicKey: CryptoKey,
	): Promise<CryptoKey> {
		const keyPair = await this.keyPairProvider.getKeyPair();
		return deriveSymmetricKey(keyPair.privateKey, receiverPublicKey);
	}
}
