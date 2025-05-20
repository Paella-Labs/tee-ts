#!/usr/bin/env bash

set -e

# Default values
VCPU=1
MEMORY=512
DISK_SIZE=2
NAME="tee-ts"
ENV_FILE=".env"
COMPOSE_FILE="docker-compose.yml"
IMAGE="dstack-dev-0.3.5"
DOCKER_IMAGE="xmregistry/crossmint-ts-tee:latest"
NGINX_DOCKER_IMAGE="xmregistry/crossmint-ts-tee-nginx:latest"
SKIP_BUILD=false
APP_ID="83cf10f9c5a3fa6c2948c0220080c0b3cebfdcbd"
DOCKER_USERNAME="xmregistry"
DOCKER_TOKEN=""
RANDOM_HASH=""
DOCKER_CMD="docker"

print_usage() {
    echo "Usage: $0 [deploy|undeploy|build-and-push|upgrade] [options]"
    echo ""
    echo "Commands:"
    echo "  deploy         Deploy TEE-TS to Phala"
    echo "  undeploy       Undeploy TEE-TS from Phala"
    echo "  build-and-push Build and push Docker images without deployment"
    echo "  upgrade        Build images and upgrade an existing Phala app"
    echo ""
    echo "Options for deploy:"
    echo "  --vcpu VALUE       Number of vCPUs (default: $VCPU)"
    echo "  --memory VALUE     Memory in MB (default: $MEMORY)"
    echo "  --disk-size VALUE  Disk size in GB (default: $DISK_SIZE)"
    echo "  --name VALUE       Deployment name (default: $NAME)"
    echo "  --env-file PATH    Path to env file (default: $ENV_FILE)"
    echo "  --image VALUE      Phala image to use (default: $IMAGE)"
    echo "  --docker-image VALUE Docker image name (will be tagged with random hash)"
    echo "  --nginx-image VALUE Nginx Docker image name (will be tagged with random hash)"
    echo "  --docker-username VALUE Docker username (default: $DOCKER_USERNAME)"
    echo "  --docker-token VALUE Docker token (will prompt if not provided)"
    echo "  --skip-build       Skip Docker image building step"
    echo "  --docker-cmd PATH  Path to Docker executable (default: $DOCKER_CMD)"
    echo "  --help             Display this help message"
    echo ""
    echo "Options for build-and-push:"
    echo "  --docker-image VALUE Docker image name (will be tagged with random hash)"
    echo "  --nginx-image VALUE Nginx Docker image name (will be tagged with random hash)"
    echo "  --docker-username VALUE Docker username (default: $DOCKER_USERNAME)"
    echo "  --docker-token VALUE Docker token (will prompt if not provided)"
    echo "  --docker-cmd PATH  Path to Docker executable (default: $DOCKER_CMD)"
    echo "  --help             Display this help message"
    echo ""
    echo "Options for upgrade:"
    echo "  --app-id VALUE     Phala app ID to upgrade"
    echo "  --env-file PATH    Path to env file (default: $ENV_FILE)"
    echo "  --compose-file PATH Path to docker-compose file (default: $COMPOSE_FILE)"
    echo "  --docker-image VALUE Docker image name (will be tagged with random hash)"
    echo "  --nginx-image VALUE Nginx Docker image name (will be tagged with random hash)"
    echo "  --docker-username VALUE Docker username (default: $DOCKER_USERNAME)"
    echo "  --docker-token VALUE Docker token (will prompt if not provided)"
    echo "  --docker-cmd PATH  Path to Docker executable (default: $DOCKER_CMD)"
    echo "  --skip-build       Skip Docker image building step"
    echo "  --help             Display this help message"
    exit 1
}

generate_hash() {
    # Generate a random hash (12 characters)
    RANDOM_HASH=$(openssl rand -hex 6)
    echo "Generated random hash for image tagging: $RANDOM_HASH"

    # Append the hash to the Docker image tags
    # First, check if the images already have a tag
    if [[ "$DOCKER_IMAGE" == *":"* ]]; then
        # Split the image name and tag
        local base_name=$(echo "$DOCKER_IMAGE" | cut -d':' -f1)
        DOCKER_IMAGE="${base_name}:${RANDOM_HASH}"
    else
        # No tag present, just append it
        DOCKER_IMAGE="${DOCKER_IMAGE}:${RANDOM_HASH}"
    fi

    if [[ "$NGINX_DOCKER_IMAGE" == *":"* ]]; then
        # Split the image name and tag
        local base_name=$(echo "$NGINX_DOCKER_IMAGE" | cut -d':' -f1)
        NGINX_DOCKER_IMAGE="${base_name}:${RANDOM_HASH}"
    else
        # No tag present, just append it
        NGINX_DOCKER_IMAGE="${NGINX_DOCKER_IMAGE}:${RANDOM_HASH}"
    fi

    echo "Docker image set to: $DOCKER_IMAGE"
    echo "Nginx Docker image set to: $NGINX_DOCKER_IMAGE"
}

setup_docker_auth() {
    # Check if already logged in by inspecting Docker config
    if [ -f "$HOME/.docker/config.json" ] && grep -q "$DOCKER_USERNAME" "$HOME/.docker/config.json"; then
        echo "Already logged in as $DOCKER_USERNAME"
        return
    fi

    # If token is not provided, prompt for it
    if [ -z "$DOCKER_TOKEN" ]; then
        read -s -p "Enter Crossmint Docker Hub Token: " DOCKER_TOKEN
        echo
        if [ -z "$DOCKER_TOKEN" ]; then
            echo "Error: Docker token is required for pushing images."
            exit 1
        fi
    fi

    # Login to Docker
    echo "Logging in to Docker Hub..."
    echo "$DOCKER_TOKEN" | $DOCKER_CMD login --username "$DOCKER_USERNAME" --password-stdin

    if [ $? -ne 0 ]; then
        echo "Error: Docker login failed."
        exit 1
    fi
}

cleanup_docker_auth() {
    # We don't logout automatically now, since we want to preserve the login state
    # if the user was already logged in
    :
}

check_requirements() {
    # Check for Docker
    if ! command -v $DOCKER_CMD &>/dev/null; then
        echo "Error: Docker not installed or not found at $DOCKER_CMD. Please install Docker or set DOCKER_CMD correctly."
        exit 1
    fi

    # Check for Phala CLI
    if command -v phala &>/dev/null; then
        PHALA_CMD="phala"
        echo "Using Phala CLI from system installation"
    else
        echo "Phala CLI not found in system path"

        # Check for NPX or BUNX
        if command -v bunx &>/dev/null; then
            PHALA_CMD="bunx phala"
            echo "Using Phala CLI via bunx"
        elif command -v npx &>/dev/null; then
            PHALA_CMD="npx phala"
            echo "Using Phala CLI via npx"
        else
            echo "Error: Neither Phala CLI nor npx/bunx found. Please install Phala CLI or npm/bun."
            exit 1
        fi
    fi

    # Check if authenticated with Phala
    if ! $PHALA_CMD auth status | grep -q "Authenticated as"; then
        echo "Error: Not authenticated with Phala."
        echo "Please run '$PHALA_CMD auth login' first."
        exit 1
    fi
}

update_env_file() {
    echo "Updating $ENV_FILE with Docker image variables..."

    # Check if .env file exists, create if not
    if [ ! -f "$ENV_FILE" ]; then
        touch "$ENV_FILE"
    fi

    # Update or add DOCKER_IMAGE
    if grep -q "^DOCKER_IMAGE=" "$ENV_FILE"; then
        # Replace existing entry
        sed -i '' "s|^DOCKER_IMAGE=.*|DOCKER_IMAGE=$DOCKER_IMAGE|" "$ENV_FILE"
    else
        # Add new entry
        echo "DOCKER_IMAGE=$DOCKER_IMAGE" >>"$ENV_FILE"
    fi

    # Update or add NGINX_DOCKER_IMAGE
    if grep -q "^NGINX_DOCKER_IMAGE=" "$ENV_FILE"; then
        # Replace existing entry
        sed -i '' "s|^NGINX_DOCKER_IMAGE=.*|NGINX_DOCKER_IMAGE=$NGINX_DOCKER_IMAGE|" "$ENV_FILE"
    else
        # Add new entry
        echo "NGINX_DOCKER_IMAGE=$NGINX_DOCKER_IMAGE" >>"$ENV_FILE"
    fi

    echo "✅ Environment file updated successfully!"
}

build_image() {
    if [ "$SKIP_BUILD" = true ]; then
        echo "Skipping build step as requested..."
        return
    fi

    # Generate a random hash for image tagging
    generate_hash

    # Setup Docker authentication
    setup_docker_auth

    # Build Docker images with live logs
    echo "Building tee-ts Docker image: $DOCKER_IMAGE"
    $DOCKER_CMD buildx build --platform linux/amd64,linux/arm64 . -t "$DOCKER_IMAGE" --push

    if [ $? -ne 0 ]; then
        echo "Error: tee-ts Docker build failed."
        exit 1
    fi

    echo "Building nginx Docker image: $NGINX_DOCKER_IMAGE"
    $DOCKER_CMD buildx build --platform linux/amd64,linux/arm64 -f nginx.Dockerfile . -t "$NGINX_DOCKER_IMAGE" --push

    if [ $? -ne 0 ]; then
        echo "Error: nginx Docker build failed."
        exit 1
    fi

    echo "✅ Docker images built and pushed successfully!"

    # Update .env file with Docker image variables
    update_env_file
}

deploy() {
    build_image

    echo "Deploying TEE-TS to Phala..."
    $PHALA_CMD cvms create \
        --vcpu "$VCPU" \
        --memory "$MEMORY" \
        --disk-size "$DISK_SIZE" \
        -n "$NAME" \
        --env-file "$ENV_FILE" \
        -c "$COMPOSE_FILE" \
        --image "$IMAGE" \
        --debug

    echo "✅ Deployment successful!"
}

undeploy() {
    if [ -z "$NAME" ]; then
        echo "Error: Deployment name is required for undeploy."
        exit 1
    fi

    echo "Undeploying $NAME from Phala..."
    $PHALA_CMD cvms delete "$NAME"

    echo "✅ Undeployment successful!"
}

upgrade() {
    if [ "$SKIP_BUILD" = false ]; then
        build_image
    else
        # Even if we skip build, we should update the .env file
        update_env_file
    fi

    if [ -z "$APP_ID" ]; then
        read -p "Enter the Phala app ID to upgrade: " APP_ID
        if [ -z "$APP_ID" ]; then
            echo "Error: App ID is required for upgrade."
            exit 1
        fi
    fi

    echo "Upgrading Phala app $APP_ID..."
    $PHALA_CMD cvms upgrade "$APP_ID" -c "$COMPOSE_FILE" -e "$ENV_FILE"

    echo "✅ Upgrade successful!"
}

main() {
    if [ $# -eq 0 ]; then
        print_usage
    fi

    COMMAND=$1
    shift

    case $COMMAND in
    deploy)
        check_requirements

        # Parse parameters
        while [[ $# -gt 0 ]]; do
            case "$1" in
            --vcpu)
                VCPU="$2"
                shift 2
                ;;
            --memory)
                MEMORY="$2"
                shift 2
                ;;
            --disk-size)
                DISK_SIZE="$2"
                shift 2
                ;;
            --name)
                NAME="$2"
                shift 2
                ;;
            --env-file)
                ENV_FILE="$2"
                shift 2
                ;;
            --image)
                IMAGE="$2"
                shift 2
                ;;
            --docker-image)
                DOCKER_IMAGE="$2"
                shift 2
                ;;
            --nginx-image)
                NGINX_DOCKER_IMAGE="$2"
                shift 2
                ;;
            --docker-username)
                DOCKER_USERNAME="$2"
                shift 2
                ;;
            --docker-token)
                DOCKER_TOKEN="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --docker-cmd)
                DOCKER_CMD="$2"
                shift 2
                ;;
            --help)
                print_usage
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                ;;
            esac
        done

        deploy
        ;;
    build-and-push)
        # Check for Docker
        if ! command -v $DOCKER_CMD &>/dev/null; then
            echo "Error: Docker not installed or not found at $DOCKER_CMD. Please install Docker or set DOCKER_CMD correctly."
            exit 1
        fi

        # Parse parameters for build-and-push
        while [[ $# -gt 0 ]]; do
            case "$1" in
            --docker-image)
                DOCKER_IMAGE="$2"
                shift 2
                ;;
            --nginx-image)
                NGINX_DOCKER_IMAGE="$2"
                shift 2
                ;;
            --docker-username)
                DOCKER_USERNAME="$2"
                shift 2
                ;;
            --docker-token)
                DOCKER_TOKEN="$2"
                shift 2
                ;;
            --docker-cmd)
                DOCKER_CMD="$2"
                shift 2
                ;;
            --help)
                print_usage
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                ;;
            esac
        done

        build_image
        ;;
    upgrade)
        check_requirements

        # Parse parameters for upgrade
        while [[ $# -gt 0 ]]; do
            case "$1" in
            --app-id)
                APP_ID="$2"
                shift 2
                ;;
            --env-file)
                ENV_FILE="$2"
                shift 2
                ;;
            --compose-file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            --docker-image)
                DOCKER_IMAGE="$2"
                shift 2
                ;;
            --nginx-image)
                NGINX_DOCKER_IMAGE="$2"
                shift 2
                ;;
            --docker-username)
                DOCKER_USERNAME="$2"
                shift 2
                ;;
            --docker-token)
                DOCKER_TOKEN="$2"
                shift 2
                ;;
            --docker-cmd)
                DOCKER_CMD="$2"
                shift 2
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --help)
                print_usage
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                ;;
            esac
        done

        upgrade
        ;;
    undeploy)
        check_requirements

        # Parse parameters for undeploy
        while [[ $# -gt 0 ]]; do
            case "$1" in
            --name)
                NAME="$2"
                shift 2
                ;;
            --help)
                print_usage
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                ;;
            esac
        done

        undeploy
        ;;
    *)
        echo "Unknown command: $COMMAND"
        print_usage
        ;;
    esac
}

main "$@"
