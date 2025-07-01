# TEE Service (Mock)

Mock TEE service for prototyping auth signers.

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Update `.env` with your credentials:
   - Set `SENDGRID_API_KEY` for email delivery
   - Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` for SMS delivery

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
   - Start onboarding with `POST /v1/signers/start-onboarding` (supports both email and SMS)
   - Complete onboarding with `POST /v1/signers/complete-onboarding`

## API Endpoints

### Health
- `GET /health` - Check service health status

### Attestation
- `GET /v1/attestation/public-key` - Get TEE public key
- `GET /v1/attestation/tdx-quote` - Get TDX quote for attestation

### Signers
- `POST /v1/signers/derive-public-key` - Derive a public key for a signer
- `POST /v1/signers/start-onboarding` - Start the signer onboarding process (supports email and SMS OTP)
- `POST /v1/signers/complete-onboarding` - Complete the signer onboarding process

## SMS Integration

The service now supports SMS-based OTP delivery using Twilio. To use SMS functionality:

1. **Setup Twilio Account:**
   - Create a Twilio account at https://www.twilio.com
   - Get your Account SID and Auth Token from the Twilio Console
   - Purchase a phone number for sending SMS

2. **Environment Variables:**
   ```bash
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
   ```

3. **Usage:**
   - Use the `/v1/signers/start-onboarding` endpoint with `authId` in format `phone:+1234567890` for SMS delivery
   - Use the `/v1/signers/start-onboarding` endpoint with `authId` in format `email:user@example.com` for email delivery
   - The service automatically detects the delivery method based on the `authId` format

4. **Example Request for SMS:**
   ```json
   {
     "deviceId": "device-123",
     "signerId": "signer-123",
     "projectName": "My Project",
     "authId": "phone:+1234567890",
     "keyType": "secp256k1",
     "encryptionContext": {
       "publicKey": "your_public_key_here"
     }
   }
   ```

5. **Example Request for Email:**
   ```json
   {
     "deviceId": "device-123",
     "signerId": "signer-123",
     "projectName": "My Project",
     "authId": "email:user@example.com",
     "keyType": "secp256k1",
     "encryptionContext": {
       "publicKey": "your_public_key_here"
     }
   }
   ```

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
SENDGRID_EMAIL_TEMPLATE_ID=your_email_template_id_here

# Twilio SMS Service
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

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
