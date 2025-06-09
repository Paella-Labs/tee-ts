# TEE Service (Mock)

Mock TEE service for prototyping auth signers.

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Update `.env` with your credentials:
   - Set `SENDGRID_API_KEY` for email delivery

3. Install dependencies:

```bash
bun install
```

## Development

Simulate the Phala TEE (requires docker open):

```bash
bun start-dev-tee
```

Start the server:

```bash
bun dev
```

Spin down the Phala TEE simulation (requires docker open):

```bash
bun stop-dev-tee
```

The service will be available at http://localhost:3000 (or your configured PORT).

## Testing

Use the Bruno API client to test the endpoints:

1. Open Bruno collection located in `./bruno`
2. Test the signer flow:
   - Derive public key with `POST /v1/signers/derive-public-key`
   - Start onboarding with `POST /v1/signers/start-onboarding`
   - Complete onboarding with `POST /v1/signers/complete-onboarding`

## API Endpoints

### Health
- `GET /health` - Check service health status

### Attestation
- `GET /v1/attestation/public-key` - Get TEE public key
- `GET /v1/attestation/tdx-quote` - Get TDX quote for attestation

### Signers
- `POST /v1/signers/derive-public-key` - Derive a public key for a signer
- `POST /v1/signers/start-onboarding` - Start the signer onboarding process
- `POST /v1/signers/complete-onboarding` - Complete the signer onboarding process

This project was created using Bun. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Docker Setup

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server configuration
PORT=3000

# Security
ACCESS_SECRET=your_access_secret_here

# Services
SENDGRID_API_KEY=your_sendgrid_api_key_here

### Building and Running with Docker

Build and start the container:

```bash
docker-compose up --build
```

Run in detached mode:

```bash
docker-compose up -d
```

Stop the container:

```bash
docker-compose down
```

### Development Mode

For development with hot reloading:

```bash
docker-compose up
```

The code is mounted as a volume, so changes will be reflected immediately.

### Production Deployment

For production, edit the `docker-compose.yml` file to comment out the volume mounts:

```yaml
volumes:
  # Comment these lines for production
  # - ./:/app
  # - /app/node_modules
```

Then rebuild and deploy:

```bash
docker-compose up --build -d
```

## Phala Deployment

### CLI Script

This repository includes a CLI script for deploying and undeploying to Phala:

```bash
# Make the script executable if needed
chmod +x cli.sh

# View help
./cli.sh

# Deploy with default settings (will build and push Docker image first)
./cli.sh deploy

# Deploy with custom settings
./cli.sh deploy --vcpu 2 --memory 1024 --disk-size 4 --name "my-tee-project" --docker-image "myorg/myimage:latest"

# Skip Docker build step (if image already built and pushed)
./cli.sh deploy --skip-build

# Undeploy
./cli.sh undeploy --name "my-tee-project"
```

### Docker Image Building

By default, the script will:
1. Build a multi-architecture Docker image (linux/amd64, linux/arm64)
2. Tag it as `albgp22/tee-ts:latest` (configurable with `--docker-image`)
3. Push it to Docker Hub

Make sure you're logged in to Docker Hub before running the deployment:
```bash
docker login
```

### Requirements

The CLI script checks for:
- Phala CLI installation (or falls back to npx/bunx)
- Docker installation
- Authentication status with Phala

If you're not authenticated, you'll need to run:
```bash
phala auth login
```

Or if using npx/bunx:
```bash
npx phala auth login
# or
bunx phala auth login
```
