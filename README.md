# TEE Service

A secure signer service with OTP verification for crossmint wallets.

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Update `.env` with your credentials:
   - Set `SENDGRID_API_KEY` for email delivery
   - Configure `MOCK_TEE_SECRET` for key derivation

3. Install dependencies:

```bash
bun install
```

## Running the Service

Start the server:

```bash
bun start
```

The service will be available at http://localhost:3000 (or your configured PORT).

## Testing

Use the Bruno API client to test the endpoints:

1. Open Bruno collection located in `./bruno`
2. Test the signer flow:
   - Create signer with `POST /signers` - sends OTP email
   - Verify OTP with `POST /requests/:requestId/auth`

## API Endpoints

- `POST /signers` - Start signer creation flow
- `POST /requests/:requestId/auth` - Authenticate and complete signer creation OTP

This project was created using Bun. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
