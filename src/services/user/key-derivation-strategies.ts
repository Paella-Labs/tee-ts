import { Keypair } from "@solana/web3.js";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { sha256 } from "ethereum-cryptography/sha256.js";
import { toHex } from "ethereum-cryptography/utils";
import type { PublicKeyResponse } from "types";

const SECP256K1_DERIVATION_PATH = new Uint8Array([
	0x73, 0x65, 0x63, 0x70, 0x32, 0x35, 0x36, 0x6b, 0x31, 0x2d, 0x64, 0x65, 0x72,
	0x69, 0x76, 0x61, 0x74, 0x69, 0x6f, 0x6e, 0x2d, 0x70, 0x61, 0x74, 0x68,
]);

/**
 * Strategy interface for key derivation
 */
export interface KeyDerivationStrategy {
	derivePublicKey(masterSecret: Uint8Array): Promise<PublicKeyResponse>;
}

/**
 * Ed25519 key derivation strategy
 */
export class Ed25519Strategy implements KeyDerivationStrategy {
	async derivePublicKey(masterSecret: Uint8Array): Promise<PublicKeyResponse> {
		const keypair = Keypair.fromSeed(masterSecret);
		return {
			bytes: keypair.publicKey.toBase58(),
			encoding: "base58",
			keyType: "ed25519",
		};
	}
}

/**
 * Secp256k1 key derivation strategy
 */
export class Secp256k1Strategy implements KeyDerivationStrategy {
	async derivePublicKey(masterSecret: Uint8Array): Promise<PublicKeyResponse> {
		const privateKeyFromSeed = async (
			seed: Uint8Array,
		): Promise<Uint8Array> => {
			const secp256k1DerivationSeed = new Uint8Array(
				seed.length + SECP256K1_DERIVATION_PATH.length,
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
}
