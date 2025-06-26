import { encodeBytes, decodeBytes } from "../../utils";
import { type EncryptionResult, createHpkeSuite } from "../encryption-consts";
import type { CipherSuite } from "@hpke/core";

type EncryptablePayload = Record<string, unknown>;

export class AsymmetricEncryptionHandler {
  constructor(private readonly hpkeSuite: CipherSuite = createHpkeSuite()) {}

  async encrypt<T extends EncryptablePayload>(
    data: T,
    recipientPublicKey: CryptoKey,
    senderKeyPair: CryptoKeyPair
  ): Promise<EncryptionResult<ArrayBuffer>> {
    const serializedPublicKey = await this.hpkeSuite.kem.serializePublicKey(
      senderKeyPair.publicKey
    );
    return this.encryptRaw(
      this.serialize({
        data,
        encryptionContext: {
          senderPublicKey: this.bufferToBase64(serializedPublicKey),
        },
      }),
      recipientPublicKey
    );
  }

  async encryptRaw(
    data: ArrayBuffer,
    recipientPublicKey: CryptoKey
  ): Promise<EncryptionResult<ArrayBuffer>> {
    try {
      const senderContext = await this.hpkeSuite.createSenderContext({
        recipientPublicKey,
      });
      const ciphertext = await senderContext.seal(data);

      return {
        ciphertext,
        encapsulatedKey: senderContext.enc,
      };
    } catch (error) {
      console.error(`[EncryptionHandler] Encryption failed: ${error}`);
      throw new Error("Failed to encrypt data");
    }
  }

  async encryptBase64<T extends Record<string, unknown>>(
    data: T,
    recipientPublicKey: CryptoKey,
    senderKeyPair: CryptoKeyPair
  ): Promise<EncryptionResult<string>> {
    const { ciphertext, encapsulatedKey } = await this.encrypt(
      data,
      recipientPublicKey,
      senderKeyPair
    );

    return {
      ciphertext: this.bufferToBase64(ciphertext),
      encapsulatedKey: this.bufferToBase64(encapsulatedKey),
    };
  }

  async decrypt<T extends EncryptablePayload, U extends string | ArrayBuffer>(
    ciphertextInput: U,
    encapsulatedKeyInput: U,
    recipientKeyPair: CryptoKeyPair,
    senderPublicKey?: CryptoKey
  ): Promise<T> {
    try {
      const recipient = await this.hpkeSuite.createRecipientContext({
        recipientKey: recipientKeyPair.privateKey,
        enc: this.bufferOrStringToBuffer(encapsulatedKeyInput),
        senderPublicKey,
      });

      const plaintext = await recipient.open(
        this.bufferOrStringToBuffer(ciphertextInput)
      );
      return this.deserialize<T>(plaintext);
    } catch (error) {
      console.error(`[EncryptionHandler] Decryption failed: ${error}`);
      throw new Error("Failed to decrypt data");
    }
  }

  private serialize<T extends EncryptablePayload>(data: T): ArrayBuffer {
    return new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer;
  }

  private deserialize<T extends EncryptablePayload>(data: ArrayBuffer): T {
    return JSON.parse(new TextDecoder().decode(data)) as T;
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    return encodeBytes(new Uint8Array(buffer), "base64");
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    return decodeBytes(base64, "base64").buffer as ArrayBuffer;
  }

  private bufferOrStringToBuffer(value: string | ArrayBuffer): ArrayBuffer {
    return typeof value === "string" ? this.base64ToBuffer(value) : value;
  }
}
