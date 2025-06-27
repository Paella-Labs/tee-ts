import type { EnvConfig } from "config";
import type { Context } from "hono";
import type { TrustedService } from "./services/security/trusted.service";
import type { MetricsService } from "./services/metrics.service";
import type { Logger } from "winston";
import type { AesGcmService } from "./services/security/aes-gcm.service";
import type { HPKEService } from "./services/security/hpke.service";
import type { TeeKeyService } from "./services/security/tee-key.service";

export interface ServiceInstances {
	teeKeyService: TeeKeyService;
	trustedService: TrustedService;
	symmetricEncryptionService: AesGcmService;
	metricsService: MetricsService;
	encryptionService: HPKEService;
}

export type AppEnv = {
	Variables: {
		services: ServiceInstances;
		env: EnvConfig;
		logger: Logger;
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
