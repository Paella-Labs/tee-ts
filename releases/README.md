# Release Tracking

This directory contains release artifacts and information for each published version of the TEE TypeScript application.

## Structure

For each release version `vX.Y.Z`, the following files are generated:

- `vX.Y.Z-release-info.json` - Complete release information including Docker image hashes, tags, and metadata
- `vX.Y.Z-app-compose.json` - The app-compose.json file used for deployment
- `vX.Y.Z-docker-compose.yml` - The docker-compose.yml file with specific image tags for this release

## Release Information Format

The release info JSON contains:
- Release version and timestamp
- Docker image information (names, tags, digests/hashes)
- App-compose configuration and hash
- Docker-compose configuration
- Git commit information

## Usage

These files can be used to:
- Track exactly which Docker images were published for each release
- Reproduce deployments with specific versions
- Audit release history and configurations
- Rollback to previous versions with confidence 