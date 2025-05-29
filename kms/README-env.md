# Environment Configuration Guide

This guide explains how to use environment files with the CrossmintAppAuth CLI to manage different configurations for different networks and use cases.

## Quick Start

1. **Copy an example environment file:**
   ```bash
   cp env.base-sepolia .env.base-sepolia
   ```

2. **Edit the file with your values:**
   ```bash
   nano .env.base-sepolia
   ```

3. **Use the environment file with the CLI:**
   ```bash
   ./crossmint-cli.sh deploy --network base-sepolia --broadcast --env-file .env.base-sepolia
   ```

## Available Environment Files

### Example Files (Templates)
- `env.example` - Complete template with all possible variables
- `env.base-sepolia` - Base Sepolia testnet configuration
- `env.base-mainnet` - Base mainnet production configuration  
- `env.localhost` - Local development configuration

### Your Environment Files (Create These)
- `.env.base-sepolia` - Your Base Sepolia configuration
- `.env.base-mainnet` - Your Base mainnet configuration
- `.env.localhost` - Your localhost configuration
- `.env.{custom}` - Any custom environment you need

> **Note:** Files starting with `.env` are gitignored for security.

## Environment File Structure

### Required Variables

#### For Deployment
```bash
# KMS contract address (required)
KMS_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# Authentication (choose one)
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234
# OR for production
VAULT_ACCOUNT_ID=123
VAULT_ADDRESS=0x1234567890123456789012345678901234567890
```

#### For Management Operations
```bash
# Proxy address of deployed contract
PROXY_ADDRESS=0x1234567890123456789012345678901234567890

# For add-hash command
COMPOSE_HASH=0x1234567890123456789012345678901234567890123456789012345678901234
TAG=v1.0.0

# For add-device command  
DEVICE_ID=0x1234567890123456789012345678901234567890123456789012345678901234
```

#### For Verification
```bash
# For verify-registration command
KMS_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
APP_ID=0x1234567890123456789012345678901234567890
```

### Optional Variables

```bash
# Deployment options
INITIAL_ADMIN=0x1234567890123456789012345678901234567890
DISABLE_UPGRADES=false
ALLOW_ANY_DEVICE=true

# Test data
TEST_COMPOSE_HASH=0x1234567890123456789012345678901234567890123456789012345678901234
TEST_COMPOSE_REASON="Initial test compose hash"

# Network configuration
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Block explorer API keys
BASESCAN_API_KEY=your_api_key_here
```

## Usage Examples

### Deployment Examples

```bash
# Deploy to Base Sepolia testnet
./crossmint-cli.sh deploy --network base-sepolia --broadcast --env-file .env.base-sepolia

# Deploy to Base mainnet with Fireblocks
./crossmint-cli.sh deploy --network base --broadcast --fireblocks --env-file .env.base-mainnet

# Deploy locally for development
./crossmint-cli.sh deploy --network localhost --broadcast --env-file .env.localhost

# Dry run deployment (no actual transactions)
./crossmint-cli.sh deploy --network base-sepolia --dry-run --env-file .env.base-sepolia
```

### Management Examples

```bash
# Add compose hash
./crossmint-cli.sh add-hash --network base-sepolia --broadcast --env-file .env.management

# Add device
./crossmint-cli.sh add-device --network base-sepolia --broadcast --env-file .env.management

# Upgrade contract
./crossmint-cli.sh upgrade --network base-sepolia --broadcast --env-file .env.management
```

### Verification Examples

```bash
# Verify app registration
./crossmint-cli.sh verify-registration --network base-sepolia --env-file .env.verification
```

## Security Best Practices

### For Development
- Use testnet private keys only
- Never commit private keys to version control
- Use `.env.*` files (they are gitignored)

### For Production
- **Use Fireblocks** instead of private keys
- Set `DISABLE_UPGRADES=true` if upgrades are not needed
- Set `ALLOW_ANY_DEVICE=false` for better security
- Use a dedicated admin address for `INITIAL_ADMIN`
- Store API keys securely

### Environment File Security
```bash
# Set proper permissions on environment files
chmod 600 .env.*

# Verify files are gitignored
git status  # Should not show .env.* files
```

## Troubleshooting

### Common Issues

1. **Environment file not found**
   ```
   ❌ Environment file not found: .env.base-sepolia
   ```
   - Make sure the file exists and path is correct
   - Check file permissions

2. **Invalid address format**
   ```
   ❌ KMS_CONTRACT_ADDRESS must be a valid 40-character hex string starting with 0x
   ```
   - Ensure addresses are properly formatted (0x + 40 hex characters)
   - Remove any extra spaces or characters

3. **Missing required variables**
   ```
   ❌ KMS_CONTRACT_ADDRESS environment variable is required for deployment
   ```
   - Check that all required variables are set in your environment file
   - Ensure variables are not commented out

### Debugging

```bash
# Check what variables are loaded
./crossmint-cli.sh deploy --dry-run --env-file .env.base-sepolia

# Test environment file loading
source .env.base-sepolia
echo $KMS_CONTRACT_ADDRESS
```

## Advanced Usage

### Multiple Environment Files
You can combine multiple environment files:

```bash
# Load base configuration, then override with specific settings
source .env.base
source .env.production-overrides
./crossmint-cli.sh deploy --network base --broadcast
```

### Environment Variables Override
Command-line environment variables override file variables:

```bash
# Override KMS_CONTRACT_ADDRESS from file
KMS_CONTRACT_ADDRESS=0xnew... ./crossmint-cli.sh deploy --env-file .env.base-sepolia
```

### CI/CD Integration
```bash
# Use in CI/CD with secrets
echo "KMS_CONTRACT_ADDRESS=$KMS_ADDRESS" > .env.ci
echo "PRIVATE_KEY=$DEPLOY_KEY" >> .env.ci
./crossmint-cli.sh deploy --network base-sepolia --broadcast --env-file .env.ci
``` 