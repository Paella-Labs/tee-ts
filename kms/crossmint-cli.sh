#!/bin/bash

# CrossmintAppAuth CLI
# Comprehensive CLI for deploying and managing CrossmintAppAuth contracts

set -e

# Load environment file if specified
load_env_file() {
    local env_file="$1"
    if [[ -f "$env_file" ]]; then
        print_info "Loading environment from: $env_file"
        # Export variables from the env file
        set -a
        source "$env_file"
        set +a
    else
        print_error "Environment file not found: $env_file"
        exit 1
    fi
}

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
USE_FIREBLOCKS=false
ENV_FILE=""

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

# Network configuration function
get_network_config() {
    local network="$1"
    case $network in
    localhost)
        echo "rpc_url=http://localhost:8545"
        echo "explorer_name=localhost"
        echo "explorer_api_key_env="
        echo "supported=true"
        ;;
    base)
        echo "rpc_url=${BASE_RPC_URL:-https://mainnet.base.org}"
        echo "explorer_name=basescan"
        echo "explorer_api_key_env=BASESCAN_API_KEY"
        echo "supported=true"
        ;;
    base-sepolia)
        echo "rpc_url=${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
        echo "explorer_name=basescan"
        echo "explorer_api_key_env=BASESCAN_API_KEY"
        echo "supported=true"
        ;;
    *)
        echo "supported=false"
        ;;
    esac
}

# Function to print common configuration
print_common_config() {
    echo "Network: $NETWORK"
    echo "RPC URL: $RPC_URL"
    echo "Broadcast: $BROADCAST"
    echo "Verify: $VERIFY"
    echo "Dry Run: $DRY_RUN"
    echo "Use Fireblocks: $USE_FIREBLOCKS"
    if [[ "$USE_FIREBLOCKS" == true ]]; then
        echo "Vault Account ID: $VAULT_ACCOUNT_ID"
        echo "Vault Address: $VAULT_ADDRESS"
    fi
}

# Function to build forge command for each operation
build_forge_command() {
    local command="$1"
    local forge_cmd=""

    case $command in
    deploy)
        forge_cmd="forge script script/DeployCrossmintAppAuth.s.sol"
        # Export environment variables for deployment script
        export KMS_CONTRACT_ADDRESS
        export INITIAL_ADMIN
        export DISABLE_UPGRADES="${DISABLE_UPGRADES:-false}"
        export ALLOW_ANY_DEVICE="${ALLOW_ANY_DEVICE:-true}"
        export TEST_COMPOSE_HASH
        export TEST_COMPOSE_REASON
        ;;
    add-hash)
        forge_cmd="forge script script/AddComposeHash.s.sol"
        # Export environment variables for add compose hash script
        export PROXY_ADDRESS
        export COMPOSE_HASH
        export TAG
        ;;
    add-device)
        forge_cmd="forge script script/AddDevice.s.sol"
        # Export environment variables for add device script
        export PROXY_ADDRESS
        export DEVICE_ID
        ;;
    upgrade)
        forge_cmd="forge script script/UpgradeCrossmintAppAuth.s.sol"
        # Export environment variables for upgrade script
        export PROXY_ADDRESS
        ;;
    verify-registration)
        forge_cmd="forge script script/VerifyAppRegistration.s.sol"
        # Export environment variables for verify registration script
        export KMS_CONTRACT_ADDRESS
        export APP_ID
        ;;
    *)
        print_error "Unknown command: $command"
        exit 1
        ;;
    esac

    # Add RPC URL
    forge_cmd="$forge_cmd --rpc-url $RPC_URL"

    # Add broadcast flag if not dry run
    if [[ "$BROADCAST" == true && "$DRY_RUN" == false ]]; then
        forge_cmd="$forge_cmd --broadcast"
    fi

    echo "$forge_cmd"
}

# Function to add verification flags based on network
add_verification_flags() {
    local forge_cmd="$1"

    if [[ "$VERIFY" == true && "$DRY_RUN" == false && "$COMMAND" == "deploy" ]]; then
        local config
        config=$(get_network_config "$NETWORK")
        local explorer_api_key_env
        explorer_api_key_env=$(echo "$config" | grep "explorer_api_key_env=" | cut -d'=' -f2)

        if [[ -n "$explorer_api_key_env" ]]; then
            local api_key_value="${!explorer_api_key_env}"
            if [[ -n "$api_key_value" ]]; then
                forge_cmd="$forge_cmd --verify --etherscan-api-key $api_key_value"
            else
                local explorer_name
                explorer_name=$(echo "$config" | grep "explorer_name=" | cut -d'=' -f2)
                print_warning "${explorer_api_key_env} not set, skipping verification for ${explorer_name}"
            fi
        fi
    fi

    echo "$forge_cmd"
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
    echo "  verify-registration Verify app registration in KMS contract"
    echo "  get-config          Show configuration for a specific network"
    echo ""
    echo "Options:"
    echo "  -n, --network NETWORK    Network to use (default: localhost)"
    echo "  -b, --broadcast          Broadcast transactions (default: false)"
    echo "  -v, --verify             Verify contracts on block explorer (default: false)"
    echo "  -d, --dry-run           Simulate without broadcasting (default: false)"
    echo "  --fireblocks            Use Fireblocks vault for signing (default: false)"
    echo "  --env-file FILE         Load environment variables from file"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment Variables:"
    echo ""
    echo "You can provide environment variables directly or use --env-file to load from a file."
    echo "See README-env.md for detailed environment file configuration guide."
    echo ""
    echo "For deployment:"
    echo "  KMS_CONTRACT_ADDRESS    Address of the KMS contract to register with [REQUIRED]"
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
    echo "For verification:"
    echo "  KMS_CONTRACT_ADDRESS    Address of the KMS contract (for verify-registration) [REQUIRED]"
    echo "  APP_ID                  App ID to verify (for verify-registration) [REQUIRED]"
    echo ""
    echo "Authentication (choose one):"
    echo "  PRIVATE_KEY             Private key for deployment account"
    echo ""
    echo "For Fireblocks (when using --fireblocks):"
    echo "  VAULT_ACCOUNT_ID        Fireblocks vault account ID [REQUIRED]"
    echo "  VAULT_ADDRESS           Fireblocks vault address [REQUIRED]"
    echo ""
    echo "Examples:"
    echo "  # Deploy contract with private key"
    echo "  KMS_CONTRACT_ADDRESS=0x1234... PRIVATE_KEY=0x... $0 deploy --network base-sepolia --broadcast"
    echo ""
    echo "  # Deploy contract using environment file"
    echo "  $0 deploy --network base-sepolia --broadcast --env-file .env.base-sepolia"
    echo ""
    echo "  # Deploy contract with Fireblocks"
    echo "  KMS_CONTRACT_ADDRESS=0x1234... VAULT_ACCOUNT_ID=123 VAULT_ADDRESS=0x... \\"
    echo "  $0 deploy --network base-sepolia --broadcast --fireblocks"
    echo ""
    echo "  # Add compose hash"
    echo "  PROXY_ADDRESS=0x1234... COMPOSE_HASH=0x5678... TAG=\"v1.2.3\" \\"
    echo "  $0 add-hash --network base-sepolia --broadcast"
    echo ""
    echo "  # Add device"
    echo "  PROXY_ADDRESS=0x1234... DEVICE_ID=0x5678... \\"
    echo "  $0 add-device --network base-sepolia --broadcast"
    echo ""
    echo "  # Upgrade contract"
    echo "  PROXY_ADDRESS=0x1234... $0 upgrade --network base-sepolia --broadcast"
    echo ""
    echo "  # Verify app registration"
    echo "  KMS_CONTRACT_ADDRESS=0x1234... APP_ID=0x5678... \\"
    echo "  $0 verify-registration --network base-sepolia"
    echo ""
    echo "  # Get network configuration"
    echo "  $0 get-config --network base-sepolia"
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
    --fireblocks)
        USE_FIREBLOCKS=true
        shift
        ;;
    --env-file)
        ENV_FILE="$2"
        shift 2
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
deploy | add-hash | add-device | upgrade | verify-registration | get-config)
    # Valid commands
    ;;
*)
    print_error "Unknown command: $COMMAND"
    echo "Valid commands: deploy, add-hash, add-device, upgrade, verify-registration, get-config"
    show_usage
    exit 1
    ;;
esac

# Load environment file if specified
if [[ -n "$ENV_FILE" ]]; then
    load_env_file "$ENV_FILE"
fi

# Validate required environment variables based on command
case $COMMAND in
deploy)
    if [[ -z "$KMS_CONTRACT_ADDRESS" ]]; then
        print_error "KMS_CONTRACT_ADDRESS environment variable is required for deployment"
        exit 1
    fi

    # Validate KMS_CONTRACT_ADDRESS format
    if [[ ! "$KMS_CONTRACT_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "KMS_CONTRACT_ADDRESS must be a valid 40-character hex string starting with 0x"
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

verify-registration)
    if [[ -z "$KMS_CONTRACT_ADDRESS" ]]; then
        print_error "KMS_CONTRACT_ADDRESS environment variable is required for verify-registration command"
        exit 1
    fi

    if [[ -z "$APP_ID" ]]; then
        print_error "APP_ID environment variable is required for verify-registration command"
        exit 1
    fi

    # Validate address formats
    if [[ ! "$KMS_CONTRACT_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "KMS_CONTRACT_ADDRESS must be a valid 40-character hex string starting with 0x"
        exit 1
    fi

    if [[ ! "$APP_ID" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        print_error "APP_ID must be a valid 40-character hex string starting with 0x"
        exit 1
    fi
    ;;
esac

# Check for authentication if broadcasting
if [[ "$BROADCAST" == true && "$DRY_RUN" == false ]]; then
    if [[ "$USE_FIREBLOCKS" == true ]]; then
        if [[ -z "$VAULT_ACCOUNT_ID" ]]; then
            print_error "VAULT_ACCOUNT_ID environment variable is required when using --fireblocks"
            exit 1
        fi
        if [[ -z "$VAULT_ADDRESS" ]]; then
            print_error "VAULT_ADDRESS environment variable is required when using --fireblocks"
            exit 1
        fi
        # Validate vault address format
        if [[ ! "$VAULT_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
            print_error "VAULT_ADDRESS must be a valid 40-character hex string starting with 0x"
            exit 1
        fi
    else
        if [[ -z "$PRIVATE_KEY" ]]; then
            print_error "PRIVATE_KEY environment variable is required for broadcasting (or use --fireblocks)"
            exit 1
        fi
    fi
fi

# Get network configuration
NETWORK_CONFIG=$(get_network_config "$NETWORK")
NETWORK_SUPPORTED=$(echo "$NETWORK_CONFIG" | grep "supported=" | cut -d'=' -f2)

if [[ "$NETWORK_SUPPORTED" != "true" ]]; then
    print_error "Unsupported network: $NETWORK"
    echo "Supported networks: localhost, base, base-sepolia"
    exit 1
fi

# Extract RPC URL from network configuration
RPC_URL=$(echo "$NETWORK_CONFIG" | grep "rpc_url=" | cut -d'=' -f2-)

# Handle get-config command
if [[ "$COMMAND" == "get-config" ]]; then
    print_info "Network Configuration for $NETWORK"
    echo "=================================="

    CONFIG_RPC_URL=$(echo "$NETWORK_CONFIG" | grep "rpc_url=" | cut -d'=' -f2-)
    CONFIG_EXPLORER_NAME=$(echo "$NETWORK_CONFIG" | grep "explorer_name=" | cut -d'=' -f2)
    CONFIG_EXPLORER_API_KEY_ENV=$(echo "$NETWORK_CONFIG" | grep "explorer_api_key_env=" | cut -d'=' -f2)

    echo "RPC URL: $CONFIG_RPC_URL"
    echo "Explorer: $CONFIG_EXPLORER_NAME"
    if [[ -n "$CONFIG_EXPLORER_API_KEY_ENV" ]]; then
        echo "Explorer API Key Env: $CONFIG_EXPLORER_API_KEY_ENV"
        CONFIG_API_KEY_VALUE="${!CONFIG_EXPLORER_API_KEY_ENV}"
        if [[ -n "$CONFIG_API_KEY_VALUE" ]]; then
            echo "Explorer API Key: [SET]"
        else
            echo "Explorer API Key: [NOT SET]"
        fi
    else
        echo "Explorer API Key Env: [NOT REQUIRED]"
    fi
    echo ""
    exit 0
fi

# Print configuration based on command
echo ""
case $COMMAND in
deploy)
    print_info "CrossmintAppAuth Deployment Configuration"
    echo "========================================"
    echo "Command: Deploy"
    print_common_config
    echo ""
    echo "KMS Contract Address: $KMS_CONTRACT_ADDRESS"
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
    print_common_config
    echo ""
    echo "Proxy Address: $PROXY_ADDRESS"
    echo "Compose Hash: $COMPOSE_HASH"
    echo "Tag: $TAG"
    ;;

add-device)
    print_info "CrossmintAppAuth Add Device Configuration"
    echo "========================================"
    echo "Command: Add Device"
    print_common_config
    echo ""
    echo "Proxy Address: $PROXY_ADDRESS"
    echo "Device ID: $DEVICE_ID"
    ;;

upgrade)
    print_info "CrossmintAppAuth Upgrade Configuration"
    echo "====================================="
    echo "Command: Upgrade Contract"
    print_common_config
    echo ""
    echo "Proxy Address: $PROXY_ADDRESS"
    ;;

verify-registration)
    print_info "CrossmintAppAuth Registration Verification Configuration"
    echo "======================================================"
    echo "Command: Verify App Registration"
    print_common_config
    echo ""
    echo "KMS Contract Address: $KMS_CONTRACT_ADDRESS"
    echo "App ID: $APP_ID"
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
    verify-registration)
        read -p "Do you want to verify app registration? (y/N): " -n 1 -r
        ;;
    esac
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Operation cancelled"
        exit 0
    fi
fi

# Build and execute the appropriate forge command
FORGE_CMD=$(build_forge_command "$COMMAND")

# Handle authentication and set ETH_FROM
if [[ "$USE_FIREBLOCKS" == true ]]; then
    # Check if fireblocks-json-rpc is available
    if ! command -v fireblocks-json-rpc &>/dev/null; then
        print_error "fireblocks-json-rpc command not found"
        echo "Please install fireblocks-json-rpc to use the --fireblocks option"
        echo "See: https://github.com/fireblocks/fireblocks-json-rpc"
        exit 1
    fi

    # Set ETH_FROM for Fireblocks vault address
    export ETH_FROM="$VAULT_ADDRESS"
    print_info "Setting ETH_FROM to Fireblocks vault address: $ETH_FROM"

    # Wrap the forge command with fireblocks-json-rpc
    FIREBLOCKS_CMD="fireblocks-json-rpc -v --http --vaultAccountIds $VAULT_ACCOUNT_ID --"
    FORGE_CMD="$FIREBLOCKS_CMD $FORGE_CMD"

    # Add Fireblocks-specific flags
    FORGE_CMD="$FORGE_CMD --sender $VAULT_ADDRESS --unlocked --legacy --slow"
elif [[ -n "$PRIVATE_KEY" ]]; then
    FORGE_CMD="$FORGE_CMD --private-key $PRIVATE_KEY"
    # Derive the address from the private key and set ETH_FROM so BaseScript uses the correct broadcaster
    DERIVED_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY")
    export ETH_FROM="$DERIVED_ADDRESS"
    print_info "Setting ETH_FROM to derived address: $ETH_FROM"
fi

FORGE_CMD=$(add_verification_flags "$FORGE_CMD")

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
KMS_CONTRACT_ADDRESS=$KMS_CONTRACT_ADDRESS
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
        verify-registration)
            print_success "App registration verified successfully!"
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
    verify-registration)
        print_error "App registration verification failed!"
        ;;
    esac
    exit 1
fi
