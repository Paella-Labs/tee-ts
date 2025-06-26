import type { EnvConfig } from "config";
import type { Context } from "hono";
import type { TrustedService } from "./services/trusted.service";
import type { MetricsService } from "./services/metrics/metrics.service";
import type { Logger } from "winston";
import type { SymmetricEncryptionService } from "services/encryption/symmetric-encryption.service";
import type { KeySerializer } from "services/encryption/lib/key-management/key-serializer";
import type { EncryptionService } from "services/encryption/encryption.service";
import type { TeeKeyService } from "services/keys/tee-key.service";

export interface ServiceInstances {
  teeKeyService: TeeKeyService;
  trustedService: TrustedService;
  symmetricEncryptionService: SymmetricEncryptionService;
  metricsService: MetricsService;
  keySerializer: KeySerializer;
  encryptionService: EncryptionService;
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
