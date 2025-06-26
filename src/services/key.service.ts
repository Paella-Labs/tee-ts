import { split } from "shamir-secret-sharing";
import { Keypair } from "@solana/web3.js";
import type { KeyType } from "schemas";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { sha256 } from "ethereum-cryptography/sha256.js";
import { toHex } from "ethereum-cryptography/utils";
import type { PublicKeyResponse } from "types";
const SECP256K1_DERIVATION_PATH = new Uint8Array([
  0x73, 0x65, 0x63, 0x70, 0x32, 0x35, 0x36, 0x6b, 0x31, 0x2d, 0x64, 0x65, 0x72,
  0x69, 0x76, 0x61, 0x74, 0x69, 0x6f, 0x6e, 0x2d, 0x70, 0x61, 0x74, 0x68,
]);

/**
 * Service for key derivation and management
 */
export class KeyService {
  private readonly HASH_ALGORITHM = "SHA-256";

  constructor(
    private readonly identityKey: CryptoKeyPair,
    private readonly outputEncoding: BufferEncoding = "base64"
  ) {}

  /**
   * Generate a key pair from user and project information
   */
  public async derivePublicKey(
    signerId: string,
    authId: string,
    keyType: KeyType
  ): Promise<PublicKeyResponse> {
    const masterSecret = await this.deriveMasterSecret(signerId, authId);
    switch (keyType) {
      case "ed25519": {
        const keypair = Keypair.fromSeed(masterSecret);
        return {
          bytes: keypair.publicKey.toBase58(),
          encoding: "base58",
          keyType: "ed25519",
        };
      }
      case "secp256k1": {
        const privateKeyFromSeed = async (
          seed: Uint8Array
        ): Promise<Uint8Array> => {
          const secp256k1DerivationSeed = new Uint8Array(
            seed.length + SECP256K1_DERIVATION_PATH.length
          );
          secp256k1DerivationSeed.set(seed, 0);
          secp256k1DerivationSeed.set(SECP256K1_DERIVATION_PATH, seed.length);
          const privateKey = sha256(secp256k1DerivationSeed);
          if (!secp256k1.utils.isValidPrivateKey(privateKey)) {
            return privateKeyFromSeed(privateKey);
          }
          return privateKey;
        };
        const privateKey = await privateKeyFromSeed(masterSecret);
        const isCompressed = false;
        const publicKey = secp256k1.getPublicKey(privateKey, isCompressed);

        return {
          bytes: toHex(publicKey),
          encoding: "hex",
          keyType: "secp256k1",
        };
      }
      default: {
        throw new Error(`Key type ${keyType} not supported`);
      }
    }
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
