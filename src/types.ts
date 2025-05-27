import type { EnvConfig } from "config";
import type { Context } from "hono";
import type { EncryptionService } from "./services/encryption.service";
import type { TrustedService } from "services/trusted.service";
import type { DatadogMetricsService } from "./services/metrics.service";

export interface ServiceInstances {
	trustedService: TrustedService;
	encryptionService: EncryptionService;
	metricsService: DatadogMetricsService;
}

export type AppEnv = {
	Variables: {
		services: ServiceInstances;
		env: EnvConfig;
		requestId: string;
		encryption?: {
			decryptedBody: unknown;
			clientPublicKeyForResponse: string;
		};
	};
};

export type AppContext = Context<AppEnv>;

export type PublicKeyResponse = {
	bytes: string;
	encoding: "base64" | "hex" | "base58";
	keyType: "ed25519" | "secp256k1";
};
