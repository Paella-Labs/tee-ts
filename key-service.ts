import { split } from "shamir-secret-sharing";
import { Keypair } from "@solana/web3.js";

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
		userId: string,
		projectId: string,
		authId: string,
	): Promise<string> {
		const masterSecret = await this.deriveMasterSecret(
			userId,
			projectId,
			authId,
		);
		const keypair = Keypair.fromSeed(masterSecret);
		return keypair.publicKey.toBuffer().toString(this.outputEncoding);
	}

	/**
	 * Generate and split a key into device and auth shares
	 */
	public async generateAndSplitKey(
		userId: string,
		projectId: string,
		authId: string,
	): Promise<{
		device: string;
		auth: string;
		deviceKeyShareHash: string;
	}> {
		const masterSecret = await this.deriveMasterSecret(
			userId,
			projectId,
			authId,
		);

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
		userId: string,
		projectId: string,
		authId: string,
	): Promise<Uint8Array> {
		const info = new TextEncoder().encode(
			JSON.stringify({
				user_id: userId,
				project_id: projectId,
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
