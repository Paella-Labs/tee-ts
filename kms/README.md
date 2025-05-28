# CrossmintAppAuth - Foundry Project

This project contains the CrossmintAppAuth smart contract migrated from Hardhat to Foundry. The contract implements an upgradeable authorization system for TEE (Trusted Execution Environment) applications.

## Overview

The `CrossmintAppAuth` contract is a UUPS upgradeable contract that manages authorization for applications running in TEE environments. It controls which compose hashes and devices are allowed to boot specific applications.

### Key Features

- **UUPS Upgradeable**: Uses OpenZeppelin's UUPS proxy pattern for upgradeability
- **Role-based Access Control**: Implements admin, manager, and upgrader roles
- **Compose Hash Management**: Controls which application compose hashes are allowed
- **Device Management**: Controls which devices can run the application
- **Flexible Device Policy**: Can allow any device or restrict to specific devices
- **Comprehensive CLI**: All-in-one CLI for deployment and contract management

## Project Structure

```
├── src/
│   ├── CrossmintAppAuth.sol    # Main contract implementation
│   └── IAppAuth.sol           # Interface definition
├── tests/
│   └── CrossmintAppAuth.t.sol # Comprehensive unit tests
├── script/
│   ├── Base.s.sol                      # Base script for common functionality
│   ├── DeployCrossmintAppAuth.s.sol    # Deployment script
│   ├── AddComposeHash.s.sol            # Script to add compose hashes
│   ├── AddDevice.s.sol                 # Script to add devices
│   └── UpgradeCrossmintAppAuth.s.sol   # Upgrade script
├── crossmint-cli.sh           # CLI for deployment and management
├── foundry.toml               # Foundry configuration
└── env.example                # Environment variables example
```

## Installation

1. Install dependencies using bun:
```bash
bun install
```

2. Install Foundry if you haven't already:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

3. Copy and configure environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

## Usage

### Building

```bash
forge build
```

### Testing

Run all tests:
```bash
forge test
```

Run tests with verbosity:
```bash
forge test -vvv
```

Run specific test:
```bash
forge test --match-test test_Initialize
```

### CrossmintAppAuth CLI (Recommended)

The project includes a comprehensive CLI that handles deployment and all post-deployment management operations with validation, error handling, and support for multiple networks.

#### Environment Setup

Configure your `.env` file with the required variables:

```bash
# Required
APP_ID=0x1234567890123456789012345678901234567890
PRIVATE_KEY=your_private_key_here

# Optional
INITIAL_ADMIN=0x1234567890123456789012345678901234567890
DISABLE_UPGRADES=false
ALLOW_ANY_DEVICE=true
TEST_COMPOSE_HASH=0x1234567890123456789012345678901234567890123456789012345678901234
TEST_COMPOSE_REASON="Initial test compose hash"

# Network RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_api_key
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_api_key

# Verification API keys
ETHERSCAN_API_KEY=your_etherscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
```

#### CLI Commands

The CLI supports four main commands: `deploy`, `add-hash`, `add-device`, and `upgrade`.

**Show help:**
```bash
./crossmint-cli.sh --help
```

**Deploy contracts:**
```bash
# Dry run (simulation only)
APP_ID=0x1234567890123456789012345678901234567890 \
./crossmint-cli.sh deploy --network sepolia --dry-run

# Deploy to Sepolia testnet
APP_ID=0x1234567890123456789012345678901234567890 \
PRIVATE_KEY=0x... \
./crossmint-cli.sh deploy --network sepolia --broadcast

# Deploy to mainnet with verification
APP_ID=0x1234567890123456789012345678901234567890 \
PRIVATE_KEY=0x... \
ETHERSCAN_API_KEY=your_key \
./crossmint-cli.sh deploy --network mainnet --broadcast --verify
```

**Manage contracts:**
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

**Using bun scripts (shorthand):**
```bash
# Deployment
bun run deploy:sepolia
bun run deploy:mainnet
bun run deploy:base
bun run deploy:base-sepolia

# Management (requires environment variables)
bun run add-hash --network sepolia
bun run add-device --network sepolia
bun run upgrade --network sepolia
```

### Direct Forge Scripts (Alternative)

You can also use the Solidity scripts directly:

```bash
# Deploy
APP_ID=0x1234567890123456789012345678901234567890 \
forge script script/DeployCrossmintAppAuth.s.sol \
--rpc-url $RPC_URL --broadcast --verify

# Add compose hash
PROXY_ADDRESS=0xYourProxyAddress \
COMPOSE_HASH=0xYourComposeHash \
REASON="Your reason" \
forge script script/AddComposeHash.s.sol \
--rpc-url $RPC_URL --broadcast

# Add device
PROXY_ADDRESS=0xYourProxyAddress \
DEVICE_ID=0xYourDeviceId \
REASON="Your reason" \
forge script script/AddDevice.s.sol \
--rpc-url $RPC_URL --broadcast

# Upgrade
PROXY_ADDRESS=0xYourProxyAddress \
forge script script/UpgradeCrossmintAppAuth.s.sol \
--rpc-url $RPC_URL --broadcast
```

## Supported Networks

The CrossmintAppAuth CLI supports the following networks out of the box:

- **localhost** (for local development)
- **sepolia** (Ethereum testnet)
- **mainnet** (Ethereum mainnet)
- **base** (Base L2)
- **base-sepolia** (Base Sepolia testnet)
- **arbitrum** (Arbitrum One)
- **optimism** (Optimism)
- **polygon** (Polygon PoS)

## Contract Interface

### Roles

- **DEFAULT_ADMIN_ROLE**: Can grant/revoke roles and disable upgrades permanently
- **MANAGER_ROLE**: Can manage compose hashes and devices
- **UPGRADER_ROLE**: Can upgrade the contract implementation

### Key Functions

#### Management Functions

- `addComposeHash(bytes32 composeHash, string tag)`: Add an allowed compose hash
- `removeComposeHash(bytes32 composeHash)`: Remove a compose hash
- `addDevice(bytes32 deviceId)`: Add an allowed device
- `removeDevice(bytes32 deviceId)`: Remove a device
- `setAllowAnyDevice(bool allowAny)`: Set device restriction policy

#### Authorization Function

- `isAppAllowed(AppBootInfo bootInfo)`: Check if an app is allowed to boot

#### Admin Functions

- `disableUpgrades()`: Permanently disable contract upgrades
- `upgradeToAndCall(address newImplementation, bytes data)`: Upgrade the contract

## Testing

The project includes comprehensive unit tests covering:

- Contract initialization
- Role-based access control
- Compose hash management
- Device management
- Authorization logic
- Upgrade functionality
- Fuzz testing for edge cases

### Test Coverage

Run test coverage:
```bash
forge coverage
```

Generate coverage report:
```bash
forge coverage --report lcov
genhtml lcov.info --branch-coverage --output-dir coverage
```

## Deployment Artifacts

Deployment results are automatically saved to `deployments/{network}/deployment.env` with basic deployment information:

```bash
# Deployment completed on Mon Jan 1 12:00:00 UTC 2024
NETWORK=sepolia
APP_ID=0x1234567890123456789012345678901234567890
INITIAL_ADMIN=0x1234567890123456789012345678901234567890
DISABLE_UPGRADES=false
ALLOW_ANY_DEVICE=true
```

## Security Considerations

1. **Upgrade Safety**: The contract can permanently disable upgrades for immutability
2. **Role Management**: Carefully manage role assignments, especially DEFAULT_ADMIN_ROLE
3. **Device Policy**: Consider the security implications of allowing any device vs. restricted devices
4. **Compose Hash Validation**: Ensure compose hashes are properly validated before adding
5. **Private Key Security**: Never commit private keys or mnemonics to version control

## Development

### Linting

```bash
bun run lint
```

### Formatting

```bash
forge fmt
```



## Migration from Hardhat

This project was migrated from Hardhat with the following improvements:

1. **Dependencies**: Switched from npm/pnpm to bun
2. **Testing Framework**: Migrated from Hardhat tests to Foundry tests
3. **Deployment Scripts**: Added comprehensive shell script deployment alongside Solidity scripts
4. **Configuration**: Replaced `hardhat.config.ts` with `foundry.toml`
5. **Network Management**: Centralized network configuration with environment variable support
6. **Validation**: Added input validation and error handling in deployment scripts

The contract functionality remains identical to the original Hardhat implementation.

## License

MIT 