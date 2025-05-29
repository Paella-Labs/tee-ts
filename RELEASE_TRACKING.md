# Release Tracking System

This repository now includes a comprehensive release tracking system that automatically captures and stores information about published Docker images, their hashes, and deployment configurations for each release.

## Overview

When you publish a new release by pushing a tag (e.g., `v1.0.0`), the GitHub Actions release workflow will:

1. **Build and push Docker images** to the registry with proper tags and digests
2. **Generate release artifacts** including:
   - `app-compose.json` with the exact docker-compose configuration
   - Version-specific `docker-compose.yml` with pinned image tags
   - Comprehensive release information JSON with all metadata
3. **Store artifacts** in the `releases/` directory and attach them to the GitHub release
4. **Commit artifacts** back to the repository for version control

## Generated Files

For each release version `vX.Y.Z`, the following files are automatically generated:

### `releases/vX.Y.Z-release-info.json`
Complete release metadata including:
- Release version and timestamp
- Git commit and reference information
- Docker image names, tags, and SHA256 digests
- App-compose and docker-compose file references and hashes

### `releases/vX.Y.Z-app-compose.json`
The dstack app-compose configuration file containing:
- Manifest version and application metadata
- Embedded docker-compose configuration as a JSON string
- Runtime configuration (KMS, gateway, logging settings)
- **SHA256 hash** for integrity verification

### `releases/vX.Y.Z-docker-compose.yml`
Docker Compose file with:
- Specific image tags for the release (no `latest` tags)
- All service configurations
- Ready to use for deployment

## Usage

### Automatic Release Process

1. **Create a release tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Actions will automatically:**
   - Run tests
   - Build and push Docker images
   - Generate release artifacts
   - Create GitHub release with attached files
   - Commit artifacts to the repository

### Manual Release Artifacts (for testing)

Generate release artifacts locally for testing:

```bash
# Generate artifacts for version 1.0.0
./scripts/generate-release-artifacts.sh 1.0.0

# Generate with custom image tags
./scripts/generate-release-artifacts.sh 1.0.0 \
  xmregistry/crossmint-ts-tee:1.0.0 \
  xmregistry/crossmint-ts-tee-nginx:1.0.0
```

### Query Release Information

Use the release info script to explore releases:

```bash
# List all available releases
./scripts/release-info.sh list

# Show detailed info for a specific release
./scripts/release-info.sh info v1.0.0

# Show Docker image information
./scripts/release-info.sh images v1.0.0

# Show app-compose file info and verify hash
./scripts/release-info.sh app-compose v1.0.0

# Show docker-compose file location
./scripts/release-info.sh compose v1.0.0

# Show latest release information
./scripts/release-info.sh latest
```

## Deployment with Release Artifacts

### Using Docker Compose
```bash
# Deploy a specific release
docker-compose -f releases/v1.0.0-docker-compose.yml up -d

# Stop the deployment
docker-compose -f releases/v1.0.0-docker-compose.yml down
```

### Using App Compose
The `app-compose.json` file can be used with dstack or other container orchestration systems that support this format.

## Security and Integrity

### Docker Image Verification
Each release tracks the exact SHA256 digest of published Docker images, allowing you to:
- Verify image integrity
- Ensure reproducible deployments
- Audit what was actually deployed

### App Compose Hash Verification
The `app-compose.json` file includes a SHA256 hash that can be verified:
```bash
# Verify hash manually
sha256sum releases/v1.0.0-app-compose.json

# Or use the script (includes automatic verification)
./scripts/release-info.sh app-compose v1.0.0
```

## File Structure

```
releases/
├── README.md                           # Documentation
├── v1.0.0-release-info.json           # Complete release metadata
├── v1.0.0-app-compose.json            # dstack app configuration
├── v1.0.0-docker-compose.yml          # Docker Compose with pinned tags
├── v1.1.0-release-info.json           # Next release...
├── v1.1.0-app-compose.json
└── v1.1.0-docker-compose.yml
```

## Benefits

1. **Reproducible Deployments**: Exact image versions and configurations for each release
2. **Audit Trail**: Complete history of what was deployed and when
3. **Rollback Capability**: Easy rollback to previous versions with confidence
4. **Security**: Hash verification ensures file integrity
5. **Automation**: No manual steps required for release tracking
6. **Transparency**: All release information is version controlled and publicly available

## Integration with CI/CD

The release tracking system integrates seamlessly with your existing CI/CD pipeline:

- **GitHub Actions**: Automatically triggered on tag push
- **Docker Registry**: Images are pushed with proper tags and digests are captured
- **Version Control**: All artifacts are committed back to the repository
- **GitHub Releases**: Files are attached to GitHub releases for easy access

This system ensures that every release is fully documented, traceable, and reproducible. 