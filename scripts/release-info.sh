#!/bin/bash

# Script to query and display release information
# Usage: ./scripts/release-info.sh [command] [version]

set -e

RELEASES_DIR="releases"

show_help() {
    echo "Release Information Tool"
    echo ""
    echo "Usage: $0 [command] [version]"
    echo ""
    echo "Commands:"
    echo "  list                    List all available releases"
    echo "  info <version>          Show detailed information for a specific release"
    echo "  images <version>        Show Docker image information for a release"
    echo "  compose <version>       Show docker-compose file path for a release"
    echo "  app-compose <version>   Show app-compose file path and hash for a release"
    echo "  latest                  Show information for the latest release"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 info v1.0.0"
    echo "  $0 images v1.0.0"
    echo "  $0 latest"
}

list_releases() {
    echo "Available releases:"
    if [ -d "$RELEASES_DIR" ]; then
        ls -1 "$RELEASES_DIR"/*-release-info.json 2>/dev/null | sed 's|.*/||; s|-release-info.json||' | sort -V || echo "No releases found"
    else
        echo "No releases directory found"
    fi
}

get_latest_release() {
    if [ -d "$RELEASES_DIR" ]; then
        ls -1 "$RELEASES_DIR"/*-release-info.json 2>/dev/null | sed 's|.*/||; s|-release-info.json||' | sort -V | tail -1
    fi
}

show_release_info() {
    local version="$1"
    local info_file="$RELEASES_DIR/${version}-release-info.json"

    if [ ! -f "$info_file" ]; then
        echo "❌ Release $version not found"
        exit 1
    fi

    echo "📦 Release Information for $version"
    echo "=================================="

    jq -r '
        "📅 Release Date: " + .release_date,
        "🔗 Git Commit: " + .git_commit,
        "🏷️  Git Ref: " + .git_ref,
        "",
        "🐳 Docker Images:",
        "  TEE Image: " + .docker_images.tee.primary_tag,
        "  TEE Digest: " + .docker_images.tee.digest,
        "  Nginx Image: " + .docker_images.nginx.primary_tag,
        "  Nginx Digest: " + .docker_images.nginx.digest,
        "",
        "📄 Files:",
        "  App Compose: " + .app_compose.file + " (hash: " + .app_compose.hash + ")",
        "  Docker Compose: " + .docker_compose.file
    ' "$info_file"
}

show_images() {
    local version="$1"
    local info_file="$RELEASES_DIR/${version}-release-info.json"

    if [ ! -f "$info_file" ]; then
        echo "❌ Release $version not found"
        exit 1
    fi

    echo "🐳 Docker Images for $version"
    echo "============================="

    jq -r '
        "TEE Image:",
        "  Name: " + .docker_images.tee.name,
        "  Tag: " + .docker_images.tee.primary_tag,
        "  Digest: " + .docker_images.tee.digest,
        "",
        "Nginx Image:",
        "  Name: " + .docker_images.nginx.name,
        "  Tag: " + .docker_images.nginx.primary_tag,
        "  Digest: " + .docker_images.nginx.digest
    ' "$info_file"
}

show_compose_info() {
    local version="$1"
    local info_file="$RELEASES_DIR/${version}-release-info.json"

    if [ ! -f "$info_file" ]; then
        echo "❌ Release $version not found"
        exit 1
    fi

    local compose_file=$(jq -r '.docker_compose.file' "$info_file")
    echo "📄 Docker Compose file for $version: $RELEASES_DIR/$compose_file"

    if [ -f "$RELEASES_DIR/$compose_file" ]; then
        echo "✅ File exists and is ready to use"
        echo ""
        echo "To use this compose file:"
        echo "  docker-compose -f $RELEASES_DIR/$compose_file up -d"
    else
        echo "❌ File not found"
    fi
}

show_app_compose_info() {
    local version="$1"
    local info_file="$RELEASES_DIR/${version}-release-info.json"

    if [ ! -f "$info_file" ]; then
        echo "❌ Release $version not found"
        exit 1
    fi

    local app_compose_file=$(jq -r '.app_compose.file' "$info_file")
    local app_compose_hash=$(jq -r '.app_compose.hash' "$info_file")

    echo "📄 App Compose file for $version: $RELEASES_DIR/$app_compose_file"
    echo "🔐 Hash: $app_compose_hash"

    if [ -f "$RELEASES_DIR/$app_compose_file" ]; then
        echo "✅ File exists and is ready to use"

        # Verify hash
        local current_hash=$(sha256sum "$RELEASES_DIR/$app_compose_file" | cut -d' ' -f1)
        if [ "$current_hash" = "$app_compose_hash" ]; then
            echo "✅ Hash verification passed"
        else
            echo "❌ Hash verification failed! File may have been modified."
            echo "   Expected: $app_compose_hash"
            echo "   Current:  $current_hash"
        fi
    else
        echo "❌ File not found"
    fi
}

# Main script logic
case "${1:-help}" in
"list")
    list_releases
    ;;
"info")
    if [ -z "$2" ]; then
        echo "❌ Please specify a version"
        echo "Usage: $0 info <version>"
        exit 1
    fi
    show_release_info "$2"
    ;;
"images")
    if [ -z "$2" ]; then
        echo "❌ Please specify a version"
        echo "Usage: $0 images <version>"
        exit 1
    fi
    show_images "$2"
    ;;
"compose")
    if [ -z "$2" ]; then
        echo "❌ Please specify a version"
        echo "Usage: $0 compose <version>"
        exit 1
    fi
    show_compose_info "$2"
    ;;
"app-compose")
    if [ -z "$2" ]; then
        echo "❌ Please specify a version"
        echo "Usage: $0 app-compose <version>"
        exit 1
    fi
    show_app_compose_info "$2"
    ;;
"latest")
    latest=$(get_latest_release)
    if [ -n "$latest" ]; then
        show_release_info "$latest"
    else
        echo "❌ No releases found"
    fi
    ;;
"help" | *)
    show_help
    ;;
esac
