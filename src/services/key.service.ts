import { split } from "shamir-secret-sharing";
import { Keypair } from "@solana/web3.js";
import type { KeyType } from "schemas";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { sha256 } from "ethereum-cryptography/sha256.js";
import { toHex } from "ethereum-cryptography/utils";
import type { PublicKeyResponse } from "types";

/**
 * Service for key derivation and management
 */
export class KeyService {
	private readonly HASH_ALGORITHM = "SHA-256";

	constructor(
		private readonly keyDerivationSecret: string,
		private readonly outputEncoding: BufferEncoding = "base64",
	) {}

	/**
	 * Generate a key pair from user and project information
	 */
	public async derivePublicKey(
		signerId: string,
		authId: string,
		keyType: KeyType,
	): Promise<PublicKeyResponse> {
		const masterSecret = await this.deriveMasterSecret(signerId, authId);
		switch (keyType) {
			case "ed25519": {
				const keypair = Keypair.fromSeed(masterSecret);
				return {
					publicKey: {
						bytes: keypair.publicKey.toBase58(),
						encoding: "base58",
						keyType: "ed25519",
					},
				};
			}
			case "secp256k1": {
				const privateKeyFromSeed = async (
					seed: Uint8Array,
				): Promise<Uint8Array> => {
					const privateKey = sha256(seed);
					if (!secp256k1.utils.isValidPrivateKey(privateKey)) {
						return privateKeyFromSeed(privateKey);
					}
					return privateKey;
				};
				const privateKey = await privateKeyFromSeed(masterSecret);
				const isCompressed = false;
				const publicKey = secp256k1.getPublicKey(privateKey, isCompressed);

				return {
					publicKey: {
						bytes: toHex(publicKey),
						encoding: "hex",
						keyType: "secp256k1",
					},
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
	public async generateAndSplitKey(
		signerId: string,
		authId: string,
	): Promise<{
		device: string;
		auth: string;
		deviceKeyShareHash: string;
	}> {
		const masterSecret = await this.deriveMasterSecret(signerId, authId);

		const [device, auth] = await split(masterSecret, 2, 2);
		if (device == null || auth == null) {
			throw new Error("shamir secret split failed");
		}

		const deviceKeyShareHash = Buffer.from(
			await crypto.subtle.digest(this.HASH_ALGORITHM, device),
		).toString(this.outputEncoding);

		return {
			device: Buffer.from(device).toString(this.outputEncoding),
			auth: Buffer.from(auth).toString(this.outputEncoding),
			deviceKeyShareHash,
		};
	}

	/**
	 * Derive a master secret from user and project information
	 */
	private async deriveMasterSecret(
		signerId: string,
		authId: string,
	): Promise<Uint8Array> {
		const info = new TextEncoder().encode(
			JSON.stringify({
				signer_id: signerId,
				auth_id: authId,
				version: "1",
			}),
		);

		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(this.keyDerivationSecret),
			{ name: "HKDF" },
			false,
			["deriveBits"],
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: "HKDF",
				hash: this.HASH_ALGORITHM,
				salt: new Uint8Array(32),
				info,
			},
			keyMaterial,
			256,
		);

		return new Uint8Array(derivedBits);
	}
}
