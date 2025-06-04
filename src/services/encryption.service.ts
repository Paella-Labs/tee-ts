import {
	CipherSuite,
	HkdfSha384,
	Aes256Gcm,
	DhkemP384HkdfSha384,
} from "@hpke/core";
import { FF1 } from "@noble/ciphers/ff1";
const OTP_RADIX = 10;

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
		private readonly suite = new CipherSuite({
			kem: new DhkemP384HkdfSha384(),
			kdf: new HkdfSha384(),
			aead: new Aes256Gcm(),
		}),
		private TEEInstanceKeyPair: CryptoKeyPair | null = null,
	) {}

	public static getInstance(): EncryptionService {
		if (!EncryptionService.instance) {
			EncryptionService.instance = new EncryptionService();
		}
		return EncryptionService.instance;
	}

	async init() {
		this.TEEInstanceKeyPair = await crypto.subtle.generateKey(
			{
				name: "ECDH" as const,
				namedCurve: "P-384" as const,
			},
			true,
			["deriveBits", "deriveKey"],
		);
	}

	private assertInitialized() {
		if (!this.TEEInstanceKeyPair) {
			throw new Error("EncryptionService not initialized");
		}
		return {
			TEEEncryptionKey: this.TEEInstanceKeyPair,
		};
	}

	/**
	 * Encrypts data for transmission FROM the TEE TO clients using HPKE Auth mode.
	 *
	 * **Authentication Flow:**
	 * - TEE authenticates itself using its static private key
	 * - Clients can cryptographically verify the message came from the genuine TEE (via attestation)
	 * - Prevents impersonation attacks where malicious actors send fake TEE responses
	 *
	 * **Security Properties:**
	 * - **Sender Authentication**: Recipients can verify TEE identity
	 * - **Forward Secrecy**: Compromise of long-term keys doesn't affect past sessions
	 * - **Confidentiality**: Only intended recipient can decrypt the message
	 * - **Integrity**: Any tampering will cause decryption to fail
	 *
	 * **Client-Side Verification:**
	 * The client must use Auth mode decryption with the TEE's attested public key:
	 * ```typescript
	 * await suite.createRecipientContext({
	 *   recipientKey: clientPrivateKey,
	 *   enc: encapsulatedKey,
	 *   senderPublicKey: attestedTeePublicKey // Verifies TEE identity
	 * })
	 * ```
	 *
	 * @param data - Data object to encrypt and send to client
	 * @param receiverPublicKey - Client's public key (from their ephemeral key pair)
	 * @returns Promise resolving to encryption result with ciphertext, encapsulated key, and TEE's public key
	 * @throws {Error} When encryption service is not initialized
	 * @throws {Error} When encryption operation fails
	 */
	async encrypt<T extends Record<string, unknown>>(
		data: T,
		receiverPublicKey: ArrayBuffer,
	): Promise<{
		ciphertext: ArrayBuffer;
		encapsulatedKey: ArrayBuffer;
		publicKey: ArrayBuffer;
	}> {
		const { TEEEncryptionKey } = this.assertInitialized();
		const serializedPublicKey = await this.suite.kem.serializePublicKey(
			TEEEncryptionKey.publicKey,
		);

		const senderContextPromise = this.suite.createSenderContext({
			senderKey: TEEEncryptionKey,
			recipientPublicKey:
				await this.suite.kem.deserializePublicKey(receiverPublicKey),
		});
		const senderContext = await senderContextPromise;

		const ciphertext = await senderContext.seal(
			this.serialize({
				data,
				encryptionContext: {
					senderPublicKey: this.arrayBufferToBase64(serializedPublicKey),
				},
			}),
		);

		return {
			ciphertext,
			publicKey: await this.suite.kem.serializePublicKey(
				TEEEncryptionKey.publicKey,
			),
			encapsulatedKey: senderContext.enc,
		};
	}

	/**
	 * Encrypts OTP codes using Format-Preserving Encryption (FPE) with ECDH-derived keys.
	 *
	 * **Security Design:**
	 * - Uses FF1 algorithm for format-preserving encryption of numeric data
	 * - Derives encryption key via ECDH between TEE's private key and recipient's public key
	 * - Maintains numeric format while providing cryptographic protection
	 * - Ensures OTP codes remain in valid numeric ranges after encryption
	 *
	 * **Key Derivation:**
	 * ```
	 * SharedSecret = ECDH(TEE_PrivateKey, Recipient_PublicKey)
	 * EncryptionKey = AES256(SharedSecret)
	 * EncryptedOTP = FF1(PlaintextOTP, EncryptionKey)
	 * ```
	 *
	 * @param data - Array of numeric digits to encrypt (e.g., [1,2,3,4,5,6] for OTP 123456)
	 * @param receiverPublicKeyBase64 - Recipient's public key in Base64 format
	 * @returns Promise resolving to array of encrypted numeric digits in same format
	 * @throws {Error} When encryption service is not initialized
	 * @throws {Error} When key derivation or encryption fails
	 */
	async encryptOTP(
		data: number[],
		receiverPublicKeyBase64: string,
	): Promise<number[]> {
		const { TEEEncryptionKey } = this.assertInitialized();
		const receiverPublicKey = this.base64ToArrayBuffer(receiverPublicKeyBase64);
		const encryptionKey = await crypto.subtle.deriveKey(
			{
				name: "ECDH",
				public: await this.suite.kem.deserializePublicKey(receiverPublicKey),
			},
			TEEEncryptionKey.privateKey,
			{
				name: "AES-GCM" as const,
				length: 256,
			},
			true,
			["wrapKey"],
		);
		const encryptionKeyBytes = new Uint8Array(
			await crypto.subtle.exportKey("raw", encryptionKey),
		);
		const f1 = FF1(OTP_RADIX, encryptionKeyBytes, undefined);
		const encryptedData = f1.encrypt(data);
		return encryptedData;
	}

	async encryptBase64<T extends Record<string, unknown>>(
		data: T,
		receiverPublicKey: string,
	): Promise<{
		ciphertext: string;
		encapsulatedKey: string;
		publicKey: string;
	}> {
		const { ciphertext, encapsulatedKey, publicKey } = await this.encrypt(
			data,
			this.base64ToArrayBuffer(receiverPublicKey),
		);
		return {
			ciphertext: this.arrayBufferToBase64(ciphertext),
			encapsulatedKey: this.arrayBufferToBase64(encapsulatedKey),
			publicKey: this.arrayBufferToBase64(publicKey),
		};
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
		encapsulatedKey: ArrayBuffer,
	): Promise<T> {
		const { TEEEncryptionKey } = this.assertInitialized();
		const recipientContextPromise = this.suite.createRecipientContext({
			recipientKey: TEEEncryptionKey.privateKey,
			enc: encapsulatedKey,
		});
		const recipient = await recipientContextPromise;
		const pt = await recipient.open(ciphertext);
		return this.deserialize<T>(pt);
	}

	async decryptBase64<T extends Record<string, unknown>>(
		ciphertext: string,
		encapsulatedKey: string,
	) {
		return this.decrypt<T>(
			this.base64ToArrayBuffer(ciphertext),
			this.base64ToArrayBuffer(encapsulatedKey),
		);
	}

	private serialize<T extends Record<string, unknown>>(data: T) {
		return new TextEncoder().encode(
			JSON.stringify(data),
		) as unknown as ArrayBuffer;
	}

	private deserialize<T extends Record<string, unknown>>(data: ArrayBuffer) {
		return JSON.parse(new TextDecoder().decode(data)) as T;
	}

	async getPublicKey() {
		const { TEEEncryptionKey } = this.assertInitialized();
		return this.suite.kem.serializePublicKey(TEEEncryptionKey.publicKey);
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		return btoa(String.fromCharCode(...new Uint8Array(buffer)));
	}

	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const buffer = Buffer.from(base64, "base64");
		return buffer.buffer;
	}
}
