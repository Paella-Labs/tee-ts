import type { KeyType } from "schemas";
import type { PublicKeyResponse } from "types";
import {
  type KeyDerivationStrategy,
  Ed25519Strategy,
  Secp256k1Strategy,
} from "./key-derivation-strategies";

/**
 * Service for key derivation and management
 */
export class KeyService {
  private readonly HASH_ALGORITHM = "SHA-256";
  private readonly strategies: Map<KeyType, KeyDerivationStrategy>;

  constructor(private readonly identityKey: CryptoKeyPair) {
    this.strategies = new Map([
      ["ed25519", new Ed25519Strategy()],
      ["secp256k1", new Secp256k1Strategy()],
    ]);
  }

  /**
   * Generate a key pair from user and project information
   */
  public async derivePublicKey(
    signerId: string,
    authId: string,
    keyType: KeyType
  ): Promise<PublicKeyResponse> {
    const strategy = this.strategies.get(keyType);
    if (!strategy) {
      throw new Error(`Key type ${keyType} not supported`);
    }

    const masterSecret = await this.deriveMasterSecret(signerId, authId);
    return strategy.derivePublicKey(masterSecret);
  }

  /**
   * Generate and split a key into device and auth shares
   */
  public async generateKey(
    signerId: string,
    authId: string
  ): Promise<{
    masterUserKey: Uint8Array;
  }> {
    const masterSecret = await this.deriveMasterSecret(signerId, authId);

    return {
      masterUserKey: masterSecret,
    };
  }

  /**
   * Derives a deterministic master secret using HKDF from TEE identity key.
   *
   * **Security Design:**
   * - Uses TEE identity key's private key as cryptographic entropy source
   * - HKDF ensures domain separation between different signer/auth combinations
   * - Deterministic: same inputs always produce same 256-bit master secret
   *
   * @param signerId - Unique identifier for the signing entity
   * @param authId - Unique identifier for the authentication context
   * @returns Promise resolving to 32-byte Uint8Array master secret
   * @throws {Error} When key derivation or import operations fail
   */
  private async deriveMasterSecret(
    signerId: string,
    authId: string
  ): Promise<Uint8Array> {
    const info = new TextEncoder().encode(
      JSON.stringify({
        signer_id: signerId,
        auth_id: authId,
        version: "1",
      })
    );

    const derivationSecret = await crypto.subtle.exportKey(
      "pkcs8",
      this.identityKey.privateKey
    );

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      derivationSecret,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: this.HASH_ALGORITHM,
        salt: new Uint8Array(32),
        info,
      },
      keyMaterial,
      256
    );

    return new Uint8Array(derivedBits);
  }
}
