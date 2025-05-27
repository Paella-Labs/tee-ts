#!/bin/bash

# CrossmintAppAuth CLI
# Comprehensive CLI for deploying and managing CrossmintAppAuth contracts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
COMMAND=""
NETWORK="localhost"
BROADCAST=false
VERIFY=false
DRY_RUN=false

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    echo "CrossmintAppAuth CLI - Deploy and manage CrossmintAppAuth contracts"
    echo ""
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy              Deploy a new CrossmintAppAuth contract"
    echo "  add-hash            Add a compose hash to an existing contract"
    echo "  add-device          Add a device to an existing contract"
    echo "  upgrade             Upgrade an existing contract"
    echo ""
    echo "Options:"
    echo "  -n, --network NETWORK    Network to use (default: localhost)"
    echo "  -b, --broadcast          Broadcast transactions (default: false)"
    echo "  -v, --verify             Verify contracts on block explorer (default: false)"
    echo "  -d, --dry-run           Simulate without broadcasting (default: false)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment Variables:"
    echo ""
    echo "For deployment:"
    echo "  APP_ID                  The application ID (40-character hex string) [REQUIRED]"
    echo "  INITIAL_ADMIN           Initial admin address (defaults to deployer)"
    echo "  DISABLE_UPGRADES        Set to 'true' to disable upgrades (default: false)"
    echo "  ALLOW_ANY_DEVICE        Set to 'false' to restrict devices (default: true)"
    echo "  TEST_COMPOSE_HASH       Test compose hash to add after deployment"
    echo "  TEST_COMPOSE_REASON     Reason for test compose hash"
    echo ""
    echo "For management operations:"
    echo "  PROXY_ADDRESS           Address of deployed proxy contract [REQUIRED]"
    echo "  COMPOSE_HASH            Compose hash to add (for add-hash command) [REQUIRED]"
    echo "  DEVICE_ID               Device ID to add (for add-device command) [REQUIRED]"
    echo "  TAG                     Repository version tag for adding compose hash [REQUIRED]"
    echo ""
    echo "Authentication (choose one):"
    echo "  PRIVATE_KEY             Private key for deployment account"
    echo "  MNEMONIC                12-word mnemonic phrase"
    echo ""
    echo "Examples:"
    echo "  # Deploy contract"
    echo "  APP_ID=0x1234... PRIVATE_KEY=0x... $0 deploy --network sepolia --broadcast"
    echo ""
    echo "  # Add compose hash"
    echo "  PROXY_ADDRESS=0x1234... COMPOSE_HASH=0x5678... TAG=\"v1.2.3\" \\"
    echo "  $0 add-hash --network sepolia --broadcast"
    echo ""
    echo "  # Add device"
    echo "  PROXY_ADDRESS=0x1234... DEVICE_ID=0x5678... \\"
    echo "  $0 add-device --network sepolia --broadcast"
    echo ""
    echo "  # Upgrade contract"
    echo "  PROXY_ADDRESS=0x1234... $0 upgrade --network sepolia --broadcast"
}

# Parse command line arguments
if [[ $# -eq 0 ]]; then
    show_usage
    exit 1
fi

# Handle help as first argument
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_usage
    exit 0
fi

# First argument should be the command
COMMAND="$1"
shift

# Parse remaining arguments
while [[ $# -gt 0 ]]; do
    case $1 in
    -n | --network)
        NETWORK="$2"
        shift 2
        ;;
    -b | --broadcast)
        BROADCAST=true
        shift
        ;;
    -v | --verify)
        VERIFY=true
        shift
        ;;
    -d | --dry-run)
        DRY_RUN=true
        shift
        ;;
    -h | --help)
        show_usage
        exit 0
        ;;
    *)
        print_error "Unknown option: $1"
        show_usage
        exit 1
        ;;
    esac
done

# Validate command
case $COMMAND in
deploy | add-hash | add-device | upgrade)
    # Valid commands
    ;;
*)
    print_error "Unknown command: $COMMAND"
    echo "Valid commands: deploy, add-hash, add-device, upgrade"
    show_usage
    exit 1
    ;;
esac

# Validate required environment variables based on command
case $COMMAND in
deploy)
    if [[ -z "$APP_ID" ]]; then
        print_error "APP_ID environment variable is required for deployment"
        echo "Example: APP_ID=0x1234567890123456789012345678901234567890"
        exit 1
    fi

    # Validate APP_ID format
    if [[ ! "$APP_ID" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "APP_ID must be a valid 40-character hex string starting with 0x"
        exit 1
    fi
    ;;

add-hash)
    if [[ -z "$PROXY_ADDRESS" ]]; then
        print_error "PROXY_ADDRESS environment variable is required for add-hash command"
        exit 1
    fi

    if [[ -z "$COMPOSE_HASH" ]]; then
        print_error "COMPOSE_HASH environment variable is required for add-hash command"
        exit 1
    fi

    if [[ -z "$TAG" ]]; then
        print_error "TAG environment variable is required for add-hash command"
        exit 1
    fi

    # Validate address formats
    if [[ ! "$PROXY_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "PROXY_ADDRESS must be a valid 40-character hex string starting with 0x"
        exit 1
    fi

    if [[ ! "$COMPOSE_HASH" =~ ^0x[a-fA-F0-9]{64}$ ]]; then
        print_error "COMPOSE_HASH must be a valid 64-character hex string starting with 0x"
        exit 1
    fi
    ;;

add-device)
    if [[ -z "$PROXY_ADDRESS" ]]; then
        print_error "PROXY_ADDRESS environment variable is required for add-device command"
        exit 1
    fi

    if [[ -z "$DEVICE_ID" ]]; then
        print_error "DEVICE_ID environment variable is required for add-device command"
        exit 1
    fi

    # Validate address formats
    if [[ ! "$PROXY_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "PROXY_ADDRESS must be a valid 40-character hex string starting with 0x"
        exit 1
    fi

    if [[ ! "$DEVICE_ID" =~ ^0x[a-fA-F0-9]{64}$ ]]; then
        print_error "DEVICE_ID must be a valid 64-character hex string starting with 0x"
        exit 1
    fi
    ;;

upgrade)
    if [[ -z "$PROXY_ADDRESS" ]]; then
        print_error "PROXY_ADDRESS environment variable is required for upgrade command"
        exit 1
    fi

    # Validate address format
    if [[ ! "$PROXY_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "PROXY_ADDRESS must be a valid 40-character hex string starting with 0x"
        exit 1
    fi
    ;;
esac

# Check for private key or mnemonic if broadcasting
if [[ "$BROADCAST" == true && "$DRY_RUN" == false ]]; then
    if [[ -z "$PRIVATE_KEY" && -z "$MNEMONIC" ]]; then
        print_error "PRIVATE_KEY or MNEMONIC environment variable is required for broadcasting"
        exit 1
    fi
fi

# Set RPC URL based on network
case $NETWORK in
localhost)
    RPC_URL="http://localhost:8545"
    ;;
base)
    RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
    ;;
*)
    print_error "Unsupported network: $NETWORK"
    echo "Supported networks: localhost, sepolia, mainnet, base, arbitrum, optimism, polygon"
    exit 1
    ;;
esac

# Print configuration based on command
echo ""
case $COMMAND in
deploy)
    print_info "CrossmintAppAuth Deployment Configuration"
    echo "========================================"
    echo "Command: Deploy"
    echo "Network: $NETWORK"
    echo "RPC URL: $RPC_URL"
    echo "Broadcast: $BROADCAST"
    echo "Verify: $VERIFY"
    echo "Dry Run: $DRY_RUN"
    echo ""
    echo "App ID: $APP_ID"
    echo "Initial Admin: ${INITIAL_ADMIN:-deployer}"
    echo "Disable Upgrades: ${DISABLE_UPGRADES:-false}"
    echo "Allow Any Device: ${ALLOW_ANY_DEVICE:-true}"
    if [[ -n "$TEST_COMPOSE_HASH" ]]; then
        echo "Test Compose Hash: $TEST_COMPOSE_HASH"
        echo "Test Compose Reason: ${TEST_COMPOSE_REASON:-Initial test compose hash}"
    fi
    ;;

add-hash)
    print_info "CrossmintAppAuth Add Compose Hash Configuration"
    echo "=============================================="
    echo "Command: Add Compose Hash"
    echo "Network: $NETWORK"
    echo "RPC URL: $RPC_URL"
    echo "Broadcast: $BROADCAST"
    echo "Dry Run: $DRY_RUN"
    echo ""
    echo "Proxy Address: $PROXY_ADDRESS"
    echo "Compose Hash: $COMPOSE_HASH"
    echo "Tag: $TAG"
    ;;

add-device)
    print_info "CrossmintAppAuth Add Device Configuration"
    echo "========================================"
    echo "Command: Add Device"
    echo "Network: $NETWORK"
    echo "RPC URL: $RPC_URL"
    echo "Broadcast: $BROADCAST"
    echo "Dry Run: $DRY_RUN"
    echo ""
    echo "Proxy Address: $PROXY_ADDRESS"
    echo "Device ID: $DEVICE_ID"
    ;;

upgrade)
    print_info "CrossmintAppAuth Upgrade Configuration"
    echo "====================================="
    echo "Command: Upgrade Contract"
    echo "Network: $NETWORK"
    echo "RPC URL: $RPC_URL"
    echo "Broadcast: $BROADCAST"
    echo "Dry Run: $DRY_RUN"
    echo ""
    echo "Proxy Address: $PROXY_ADDRESS"
    ;;
esac
echo ""

# Confirm operation (unless in CI or auto-confirm mode)
if [[ "$CI" != "true" && "$AUTO_CONFIRM" != "true" && "$DRY_RUN" == false ]]; then
    case $COMMAND in
    deploy)
        read -p "Do you want to proceed with deployment? (y/N): " -n 1 -r
        ;;
    add-hash)
        read -p "Do you want to add this compose hash? (y/N): " -n 1 -r
        ;;
    add-device)
        read -p "Do you want to add this device? (y/N): " -n 1 -r
        ;;
    upgrade)
        read -p "Do you want to upgrade this contract? (y/N): " -n 1 -r
        ;;
    esac
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Operation cancelled"
        exit 0
    fi
fi

# Build and execute the appropriate forge command based on command
case $COMMAND in
deploy)
    # Build the forge command for deployment
    FORGE_CMD="forge script script/DeployCrossmintAppAuth.s.sol"
    FORGE_CMD="$FORGE_CMD --rpc-url $RPC_URL"

    # Export environment variables for deployment script
    export APP_ID
    export INITIAL_ADMIN
    export DISABLE_UPGRADES="${DISABLE_UPGRADES:-false}"
    export ALLOW_ANY_DEVICE="${ALLOW_ANY_DEVICE:-true}"
    export TEST_COMPOSE_HASH
    export TEST_COMPOSE_REASON
    ;;

add-hash)
    # Build the forge command for adding compose hash
    FORGE_CMD="forge script script/AddComposeHash.s.sol"
    FORGE_CMD="$FORGE_CMD --rpc-url $RPC_URL"

    # Export environment variables for add compose hash script
    export PROXY_ADDRESS
    export COMPOSE_HASH
    export TAG
    ;;

add-device)
    # Build the forge command for adding device
    FORGE_CMD="forge script script/AddDevice.s.sol"
    FORGE_CMD="$FORGE_CMD --rpc-url $RPC_URL"

    # Export environment variables for add device script
    export PROXY_ADDRESS
    export DEVICE_ID
    ;;

upgrade)
    # Build the forge command for upgrading
    FORGE_CMD="forge script script/UpgradeCrossmintAppAuth.s.sol"
    FORGE_CMD="$FORGE_CMD --rpc-url $RPC_URL"

    # Export environment variables for upgrade script
    export PROXY_ADDRESS
    ;;
esac

# Add broadcast flag if not dry run
if [[ "$BROADCAST" == true && "$DRY_RUN" == false ]]; then
    FORGE_CMD="$FORGE_CMD --broadcast"
fi

# Add verification if requested (only for deployment)
if [[ "$VERIFY" == true && "$DRY_RUN" == false && "$COMMAND" == "deploy" ]]; then
    case $NETWORK in
    mainnet | sepolia)
        if [[ -n "$ETHERSCAN_API_KEY" ]]; then
            FORGE_CMD="$FORGE_CMD --verify --etherscan-api-key $ETHERSCAN_API_KEY"
        else
            print_warning "ETHERSCAN_API_KEY not set, skipping verification"
        fi
        ;;
    base)
        if [[ -n "$BASESCAN_API_KEY" ]]; then
            FORGE_CMD="$FORGE_CMD --verify --etherscan-api-key $BASESCAN_API_KEY"
        else
            print_warning "BASESCAN_API_KEY not set, skipping verification"
        fi
        ;;
    arbitrum)
        if [[ -n "$ARBISCAN_API_KEY" ]]; then
            FORGE_CMD="$FORGE_CMD --verify --etherscan-api-key $ARBISCAN_API_KEY"
        else
            print_warning "ARBISCAN_API_KEY not set, skipping verification"
        fi
        ;;
    optimism)
        if [[ -n "$OPTIMISM_API_KEY" ]]; then
            FORGE_CMD="$FORGE_CMD --verify --etherscan-api-key $OPTIMISM_API_KEY"
        else
            print_warning "OPTIMISM_API_KEY not set, skipping verification"
        fi
        ;;
    polygon)
        if [[ -n "$POLYGONSCAN_API_KEY" ]]; then
            FORGE_CMD="$FORGE_CMD --verify --etherscan-api-key $POLYGONSCAN_API_KEY"
        else
            print_warning "POLYGONSCAN_API_KEY not set, skipping verification"
        fi
        ;;
    esac
fi

# Add verbosity
FORGE_CMD="$FORGE_CMD -vvv"

# Print command and execute
if [[ "$DRY_RUN" == true ]]; then
    print_info "DRY RUN MODE - No transactions will be broadcast"
fi

print_info "Executing: $FORGE_CMD"
echo ""

# Execute the command
if eval "$FORGE_CMD"; then
    echo ""
    if [[ "$DRY_RUN" == true ]]; then
        print_success "Dry run completed successfully!"
    else
        case $COMMAND in
        deploy)
            print_success "Deployment completed successfully!"

            # Save deployment info (basic version)
            if [[ "$BROADCAST" == true ]]; then
                DEPLOYMENT_DIR="deployments/$NETWORK"
                mkdir -p "$DEPLOYMENT_DIR"

                # Create a basic deployment record
                cat >"$DEPLOYMENT_DIR/deployment.env" <<EOF
# Deployment completed on $(date)
NETWORK=$NETWORK
APP_ID=$APP_ID
INITIAL_ADMIN=${INITIAL_ADMIN:-}
DISABLE_UPGRADES=${DISABLE_UPGRADES:-false}
ALLOW_ANY_DEVICE=${ALLOW_ANY_DEVICE:-true}
EOF
                print_info "Basic deployment info saved to $DEPLOYMENT_DIR/deployment.env"
            fi
            ;;
        add-hash)
            print_success "Compose hash added successfully!"
            ;;
        add-device)
            print_success "Device added successfully!"
            ;;
        upgrade)
            print_success "Contract upgraded successfully!"
            ;;
        esac
    fi
else
    case $COMMAND in
    deploy)
        print_error "Deployment failed!"
        ;;
    add-hash)
        print_error "Adding compose hash failed!"
        ;;
    add-device)
        print_error "Adding device failed!"
        ;;
    upgrade)
        print_error "Contract upgrade failed!"
        ;;
    esac
    exit 1
fi
