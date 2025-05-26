import type { EnvConfig } from "config";
import type { Context } from "hono";
import type { EncryptionService } from "./services/encryption.service";
import type { TrustedService } from "services/trusted.service";

export interface ServiceInstances {
	trustedService: TrustedService;
	encryptionService: EncryptionService;
}

export type AppEnv = {
	Variables: {
		services: ServiceInstances;
		env: EnvConfig;
		encryption?: {
			decryptedBody: unknown;
			clientPublicKeyForResponse: string;
		};
	};
};

export type AppContext = Context<AppEnv>;

export type PublicKeyResponse = {
	publicKey: {
		bytes: string;
		encoding: "base64" | "hex" | "base58";
		keyType: "ed25519" | "secp256k1";
	};
};
