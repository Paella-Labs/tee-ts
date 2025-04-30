import {
	CipherSuite,
	HkdfSha384,
	Aes256Gcm,
	DhkemP384HkdfSha384,
} from "@hpke/core";

export class EncryptionService {
	private static instance: EncryptionService | null = null;

	private constructor(
		private readonly suite = new CipherSuite({
			kem: new DhkemP384HkdfSha384(),
			kdf: new HkdfSha384(),
			aead: new Aes256Gcm(),
		}),
		private ephemeralKeyPair: CryptoKeyPair | null = null,
	) {}

	public static getInstance(): EncryptionService {
		if (!EncryptionService.instance) {
			EncryptionService.instance = new EncryptionService();
		}
		return EncryptionService.instance;
	}

	async init() {
		this.ephemeralKeyPair = await this.suite.kem.generateKeyPair();
	}

	private assertInitialized() {
		if (!this.ephemeralKeyPair) {
			throw new Error("EncryptionService not initialized");
		}
		return {
			ephemeralKeyPair: this.ephemeralKeyPair,
		};
	}

	async encrypt<T extends Record<string, unknown>>(
		data: T,
		receiverPublicKey: ArrayBuffer,
	): Promise<{
		ciphertext: ArrayBuffer;
		encapsulatedKey: ArrayBuffer;
		publicKey: ArrayBuffer;
	}> {
		const { ephemeralKeyPair } = this.assertInitialized();
		const serializedPublicKey = await this.suite.kem.serializePublicKey(
			ephemeralKeyPair.publicKey,
		);
		const senderContextPromise = this.suite.createSenderContext({
			senderKey: ephemeralKeyPair,
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
				ephemeralKeyPair.publicKey,
			),
			encapsulatedKey: senderContext.enc,
		};
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

	async decrypt<T extends Record<string, unknown>>(
		ciphertext: ArrayBuffer,
		encapsulatedKey: ArrayBuffer,
	): Promise<T> {
		const { ephemeralKeyPair } = this.assertInitialized();
		const privKey = ephemeralKeyPair.privateKey;
		const recipientContextPromise = this.suite.createRecipientContext({
			recipientKey: privKey,
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
		const { ephemeralKeyPair } = this.assertInitialized();
		return this.suite.kem.serializePublicKey(ephemeralKeyPair.publicKey);
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		return btoa(String.fromCharCode(...new Uint8Array(buffer)));
	}

	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const buffer = Buffer.from(base64, "base64");
		return buffer.buffer;
	}
}
