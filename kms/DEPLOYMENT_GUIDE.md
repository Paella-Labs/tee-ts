# CrossmintAppAuth CLI Guide

This guide covers how to deploy and manage CrossmintAppAuth contracts using the comprehensive CLI tool.

## Quick Start

1. **Set up environment variables**:
```bash
cp env.example .env
# Edit .env with your configuration
```

2. **Deploy to testnet**:
```bash
APP_ID=0x1234567890123456789012345678901234567890 \
PRIVATE_KEY=0x... \
./crossmint-cli.sh deploy --network sepolia --broadcast
```

3. **Verify deployment**:
```bash
# Check deployment artifacts
cat deployments/sepolia/deployment.env
```

## CLI Features

The `crossmint-cli.sh` provides:

- ✅ **Input validation** for addresses and environment variables
- ✅ **Multi-network support** (localhost, sepolia, mainnet, base, arbitrum, optimism, polygon)
- ✅ **Multiple commands** (deploy, add-hash, add-device, upgrade)
- ✅ **Dry-run mode** for testing without broadcasting
- ✅ **Contract verification** on block explorers
- ✅ **Colored output** for better readability
- ✅ **Error handling** with descriptive messages
- ✅ **Deployment artifacts** saved automatically

## Environment Variables

### Required
- `APP_ID`: The application ID (40-character hex address)

### Authentication (choose one)
- `PRIVATE_KEY`: Private key for deployment account
- `MNEMONIC`: 12-word mnemonic phrase

### Optional Configuration
- `INITIAL_ADMIN`: Initial admin address (defaults to deployer)
- `DISABLE_UPGRADES`: Set to 'true' to disable upgrades (default: false)
- `ALLOW_ANY_DEVICE`: Set to 'false' to restrict devices (default: true)
- `TEST_COMPOSE_HASH`: Test compose hash to add after deployment
- `TEST_COMPOSE_REASON`: Reason for test compose hash

### Network RPC URLs (optional, defaults provided)
- `SEPOLIA_RPC_URL`: Sepolia testnet RPC URL
- `MAINNET_RPC_URL`: Ethereum mainnet RPC URL
- `BASE_RPC_URL`: Base L2 RPC URL
- `ARBITRUM_RPC_URL`: Arbitrum One RPC URL
- `OPTIMISM_RPC_URL`: Optimism RPC URL
- `POLYGON_RPC_URL`: Polygon PoS RPC URL

### Verification API Keys
- `ETHERSCAN_API_KEY`: For Ethereum mainnet/sepolia verification
- `BASESCAN_API_KEY`: For Base network verification
- `ARBISCAN_API_KEY`: For Arbitrum verification
- `OPTIMISM_API_KEY`: For Optimism verification
- `POLYGONSCAN_API_KEY`: For Polygon verification

### Automation
- `AUTO_CONFIRM`: Set to 'true' to skip confirmation prompts
- `CI`: Set to 'true' in CI environments

## Usage Examples

### 1. Dry Run (Simulation)

Test deployment without broadcasting transactions:

```bash
APP_ID=0x1234567890123456789012345678901234567890 \
./crossmint-cli.sh deploy --network sepolia --dry-run
```

### 2. Testnet Deployment

Deploy to Sepolia testnet:

```bash
APP_ID=0x1234567890123456789012345678901234567890 \
PRIVATE_KEY=0x... \
./crossmint-cli.sh deploy --network sepolia --broadcast
```

### 3. Mainnet Deployment with Verification

Deploy to Ethereum mainnet with contract verification:

```bash
APP_ID=0x1234567890123456789012345678901234567890 \
PRIVATE_KEY=0x... \
ETHERSCAN_API_KEY=your_api_key \
./crossmint-cli.sh deploy --network mainnet --broadcast --verify
```

### 4. Base L2 Deployment

Deploy to Base network:

```bash
APP_ID=0x1234567890123456789012345678901234567890 \
PRIVATE_KEY=0x... \
BASESCAN_API_KEY=your_api_key \
./crossmint-cli.sh deploy --network base --broadcast --verify
```

### 5. Using Environment File

Create a `.env` file:

```bash
APP_ID=0x1234567890123456789012345678901234567890
PRIVATE_KEY=0x...
INITIAL_ADMIN=0x...
ETHERSCAN_API_KEY=your_api_key
```

Then deploy:

```bash
source .env
./crossmint-cli.sh deploy --network sepolia --broadcast --verify
```

### 6. Using Bun Scripts

Use the predefined bun scripts for common deployments:

```bash
# Deploy to localhost (requires local node)
bun run deploy:localhost

# Deploy to Sepolia
bun run deploy:sepolia

# Deploy to mainnet
bun run deploy:mainnet

# Deploy to Base
bun run deploy:base
```

## Post-Deployment Management

After deployment, you can use the CLI for management operations or the Foundry scripts directly.

### Using the CLI (Recommended)

```bash
# Add compose hash
PROXY_ADDRESS=0x1234567890123456789012345678901234567890 \
COMPOSE_HASH=0x1234567890123456789012345678901234567890123456789012345678901234 \
TAG="v1.2.3" \
PRIVATE_KEY=0x... \
./crossmint-cli.sh add-hash --network sepolia --broadcast

# Add device
PROXY_ADDRESS=0x1234567890123456789012345678901234567890 \
DEVICE_ID=0x1234567890123456789012345678901234567890123456789012345678901234 \
PRIVATE_KEY=0x... \
./crossmint-cli.sh add-device --network sepolia --broadcast

# Upgrade contract
PROXY_ADDRESS=0x1234567890123456789012345678901234567890 \
PRIVATE_KEY=0x... \
./crossmint-cli.sh upgrade --network sepolia --broadcast
```

### Using Foundry Scripts Directly

### Add Compose Hash

```bash
PROXY_ADDRESS=0xYourProxyAddress \
COMPOSE_HASH=0x... \
TAG="v1.2.3" \
forge script script/AddComposeHash.s.sol \
--rpc-url $RPC_URL --broadcast
```

### Add Device

```bash
PROXY_ADDRESS=0xYourProxyAddress \
DEVICE_ID=0x... \
forge script script/AddDevice.s.sol \
--rpc-url $RPC_URL --broadcast
```

### Upgrade Contract

```bash
PROXY_ADDRESS=0xYourProxyAddress \
forge script script/UpgradeCrossmintAppAuth.s.sol \
--rpc-url $RPC_URL --broadcast
```

## Troubleshooting

### Common Issues

1. **"APP_ID environment variable is required"**
   - Ensure APP_ID is set and is a valid 40-character hex address

2. **"PRIVATE_KEY or MNEMONIC environment variable is required"**
   - Set either PRIVATE_KEY or MNEMONIC for transaction signing

3. **"Connection refused"**
   - Check RPC URL is correct and accessible
   - For localhost, ensure local node is running

4. **"Verification failed"**
   - Ensure correct API key is set for the network
   - Check if the block explorer supports the network

5. **"Insufficient funds"**
   - Ensure deployment account has enough ETH for gas fees

### Getting Help

1. **Show script help**:
   ```bash
   ./crossmint-cli.sh --help
   ```

2. **Test with dry run**:
   ```bash
   APP_ID=0x... ./crossmint-cli.sh deploy --network sepolia --dry-run
   ```

3. **Check deployment artifacts**:
   ```bash
   ls -la deployments/
   cat deployments/sepolia/deployment.env
   ```

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use environment files** that are gitignored
3. **Test on testnets** before mainnet deployment
4. **Verify contracts** on block explorers
5. **Use hardware wallets** for mainnet deployments
6. **Double-check addresses** before deployment
7. **Consider upgrade policies** carefully

## Network Information

| Network | Chain ID | Block Explorer | Verification |
|---------|----------|----------------|--------------|
| Localhost | 31337 | N/A | N/A |
| Sepolia | 11155111 | sepolia.etherscan.io | ETHERSCAN_API_KEY |
| Mainnet | 1 | etherscan.io | ETHERSCAN_API_KEY |
| Base | 8453 | basescan.org | BASESCAN_API_KEY |
| Arbitrum | 42161 | arbiscan.io | ARBISCAN_API_KEY |
| Optimism | 10 | optimistic.etherscan.io | OPTIMISM_API_KEY |
| Polygon | 137 | polygonscan.com | POLYGONSCAN_API_KEY |

## Example Deployment Flow

Here's a complete example of deploying to Sepolia testnet:

```bash
# 1. Set up environment
export APP_ID=0x1234567890123456789012345678901234567890
export PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=your_api_key

# 2. Test with dry run
./crossmint-cli.sh deploy --network sepolia --dry-run

# 3. Deploy for real
./crossmint-cli.sh deploy --network sepolia --broadcast --verify

# 4. Check deployment
cat deployments/sepolia/deployment.env

# 5. Add a test compose hash using CLI
export PROXY_ADDRESS=$(grep -o '0x[a-fA-F0-9]\{40\}' broadcast/DeployCrossmintAppAuth.s.sol/11155111/run-latest.json | head -1)
export COMPOSE_HASH=0x1234567890123456789012345678901234567890123456789012345678901234
export TAG="v0.1.0-test"

./crossmint-cli.sh add-hash --network sepolia --broadcast
```

This completes the deployment process with a fully functional CrossmintAppAuth contract! 