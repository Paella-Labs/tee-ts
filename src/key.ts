import { TappdClient } from "@phala/dstack-sdk";
import { env } from "./config";

const ALGORITHM: EcKeyImportParams = {
	name: "ECDH" as const,
	namedCurve: "P-256" as const, // secp256r1 - matches TEE hardware curve
};
const PERMISSIONS: KeyUsage[] = ["deriveBits", "deriveKey"]; // Required for ECDH operations
const EXTRACTABLE = true;
const TEE_IDENTITY_DERIVATION_PATH = "TEE-identity";

/**
 * Derives a deterministic P-256 ECDH key pair from Phala's KMS
 *
 * **Security Design:**
 * - Uses TEE (Trusted Execution Environment) hardware attestation as root of trust
 * - Ensures same TEE instance always produces same ECDH key pair
 * - Provides cryptographic binding between TEE identity and encryption keys
 *
 * @returns Promise resolving to CryptoKeyPair containing P-256 ECDH private/public keys
 * @throws {Error} When TEE key derivation fails or key import is invalid
 * @throws {Error} When PKCS#8 format is malformed or unsupported
 */
export async function TEEIdentityKey(): Promise<CryptoKeyPair> {
	// fetch deterministic key material from Dstack
	const client = new TappdClient(env.DSTACK_SIMULATOR_ENDPOINT);
	const key = await client.deriveKey(TEE_IDENTITY_DERIVATION_PATH); // X.509 private key in PEM format

	const privateKey = await crypto.subtle.importKey(
		"pkcs8", // PKCS#8 DER format (standard for X.509 private keys)
		key.asUint8Array(),
		ALGORITHM,
		EXTRACTABLE,
		PERMISSIONS,
	);

	// Export private key as JWK to extract public key coordinates
	// This allows us to derive the corresponding public key from the private key
	const privateKeyJWK = await crypto.subtle.exportKey("jwk", privateKey);

	// Create public key JWK by extracting only the public components
	// Removes the private key component ('d') while preserving public coordinates ('x', 'y')
	const publicKey = await crypto.subtle.importKey(
		"jwk",
		{
			kty: privateKeyJWK.kty, // Key type: "EC" for elliptic curve
			crv: privateKeyJWK.crv, // Curve: "P-256"
			x: privateKeyJWK.x, // Public key X coordinate (base64url)
			y: privateKeyJWK.y, // Public key Y coordinate (base64url)
			ext: true, // Extractable for serialization
		},
		ALGORITHM,
		true, // extractable: true (needed for HPKE serialization)
		[], // No key operations (public keys don't perform crypto directly)
	);

	return {
		privateKey, // Used for: ECDH derivation, Auth mode signing
		publicKey, // Used for: Client verification, key exchange setup
	};
}

/**
 * Generates a development encryption key pair for testing purposes.
 * Uses P-256 curve to match production keys but generates fresh keys each time.
 *
 * @returns Promise resolving to CryptoKeyPair for development/testing use
 */
async function devIdentityKey(): Promise<CryptoKeyPair> {
	return await crypto.subtle.generateKey(ALGORITHM, EXTRACTABLE, PERMISSIONS);
}
