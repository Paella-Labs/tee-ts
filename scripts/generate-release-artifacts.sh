#!/bin/bash

# Script to generate release artifacts locally for testing
# Usage: ./scripts/generate-release-artifacts.sh <version> [tee-image-tag] [nginx-image-tag]

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <version> [tee-image-tag] [nginx-image-tag]"
    echo "Example: $0 1.0.0"
    echo "Example: $0 1.0.0 xmregistry/crossmint-ts-tee:1.0.0 xmregistry/crossmint-ts-tee-nginx:1.0.0"
    exit 1
fi

VERSION="$1"
TEE_TAG="${2:-xmregistry/crossmint-ts-tee:${VERSION}}"
NGINX_TAG="${3:-xmregistry/crossmint-ts-tee-nginx:${VERSION}}"

echo "Generating release artifacts for version: v${VERSION}"
echo "TEE image tag: ${TEE_TAG}"
echo "Nginx image tag: ${NGINX_TAG}"

# Create releases directory if it doesn't exist
mkdir -p releases

# Create docker-compose.yml with specific version tags
# Replace the entire image line for both services
sed -E "
    s|image: \\\$\{DOCKER_IMAGE:-[^}]*\}|image: ${TEE_TAG}|g;
    s|image: \\\$\{NGINX_DOCKER_IMAGE:-[^}]*\}|image: ${NGINX_TAG}|g
" docker-compose.yml >"releases/v${VERSION}-docker-compose.yml"

# Generate app-compose.json
cat >"releases/v${VERSION}-app-compose.json" <<EOF
{
    "manifest_version": 2,
    "name": "dstack-attestation-example",
    "runner": "docker-compose",
    "docker_compose_file": $(jq -Rs . <"releases/v${VERSION}-docker-compose.yml"),
    "kms_enabled": true,
    "gateway_enabled": true,
    "local_key_provider_enabled": false,
    "key_provider_id": "",
    "public_logs": true,
    "public_sysinfo": true,
    "allowed_envs": [],
    "no_instance_id": false,
    "secure_time": false
}
EOF

# Calculate app-compose hash
COMPOSE_HASH=$(sha256sum "releases/v${VERSION}-app-compose.json" | cut -d' ' -f1)

# Generate release information (without Docker digests since we're not building)
cat >"releases/v${VERSION}-release-info.json" <<EOF
{
    "version": "v${VERSION}",
    "release_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_ref": "refs/tags/v${VERSION}",
    "docker_images": {
        "tee": {
            "name": "xmregistry/crossmint-ts-tee",
            "primary_tag": "${TEE_TAG}",
            "all_tags": ["${TEE_TAG}"],
            "digest": "local-build-no-digest",
            "labels": {}
        },
        "nginx": {
            "name": "xmregistry/crossmint-ts-tee-nginx",
            "primary_tag": "${NGINX_TAG}",
            "all_tags": ["${NGINX_TAG}"],
            "digest": "local-build-no-digest",
            "labels": {}
        }
    },
    "app_compose": {
        "file": "v${VERSION}-app-compose.json",
        "hash": "${COMPOSE_HASH}"
    },
    "docker_compose": {
        "file": "v${VERSION}-docker-compose.yml"
    }
}
EOF

echo ""
echo "✅ Release artifacts generated successfully:"
echo "   📄 releases/v${VERSION}-release-info.json"
echo "   📄 releases/v${VERSION}-app-compose.json (hash: ${COMPOSE_HASH})"
echo "   📄 releases/v${VERSION}-docker-compose.yml"
echo ""
echo "App-compose hash: ${COMPOSE_HASH}"
