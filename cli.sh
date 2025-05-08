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
DOCKER_IMAGE="albgp22/tee-ts:latest"
NGINX_DOCKER_IMAGE="albgp22/tee-ts-nginx:latest"
SKIP_BUILD=false

print_usage() {
    echo "Usage: $0 [deploy|undeploy] [options]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy TEE-TS to Phala"
    echo "  undeploy  Undeploy TEE-TS from Phala"
    echo ""
    echo "Options for deploy:"
    echo "  --vcpu VALUE       Number of vCPUs (default: $VCPU)"
    echo "  --memory VALUE     Memory in MB (default: $MEMORY)"
    echo "  --disk-size VALUE  Disk size in GB (default: $DISK_SIZE)"
    echo "  --name VALUE       Deployment name (default: $NAME)"
    echo "  --env-file PATH    Path to env file (default: $ENV_FILE)"
    echo "  --image VALUE      Phala image to use (default: $IMAGE)"
    echo "  --docker-image VALUE Docker image name (default: $DOCKER_IMAGE)"
    echo "  --nginx-image VALUE Nginx Docker image name (default: $NGINX_DOCKER_IMAGE)"
    echo "  --skip-build       Skip Docker image building step"
    echo "  --help             Display this help message"
    exit 1
}

check_requirements() {
    # Check for Docker
    if ! command -v docker &>/dev/null; then
        echo "Error: Docker not installed. Please install Docker first."
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

build_image() {
    if [ "$SKIP_BUILD" = true ]; then
        echo "Skipping build step as requested..."
        return
    fi

    echo "Building tee-ts Docker image: $DOCKER_IMAGE"
    docker buildx build --platform linux/amd64,linux/arm64 . -t "$DOCKER_IMAGE" --push

    if [ $? -ne 0 ]; then
        echo "Error: tee-ts Docker build failed."
        exit 1
    fi

    echo "Building nginx Docker image: $NGINX_DOCKER_IMAGE"
    docker buildx build --platform linux/amd64,linux/arm64 -f nginx.Dockerfile . -t "$NGINX_DOCKER_IMAGE" --push

    if [ $? -ne 0 ]; then
        echo "Error: nginx Docker build failed."
        exit 1
    fi

    echo "✅ Docker images built and pushed successfully!"
}

deploy() {
    build_image

    echo "Deploying TEE-TS to Phala..."
    export DOCKER_IMAGE="$DOCKER_IMAGE"
    export NGINX_DOCKER_IMAGE="$NGINX_DOCKER_IMAGE"
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

        deploy
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
