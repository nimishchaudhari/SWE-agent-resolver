#!/bin/bash

# Manual Docker Build and Push Script
# This script allows you to manually build and push the Docker image

set -e

# Configuration
REGISTRY="ghcr.io"
IMAGE_NAME="nimishchaudhari/swe-agent-resolver"
TAG="${1:-latest}"

echo "🐳 Building Docker image: ${REGISTRY}/${IMAGE_NAME}:${TAG}"

# Check if user is logged in to GHCR
echo "Checking Docker login status..."
if ! docker system info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Build with BuildKit for better caching and multi-stage builds
export DOCKER_BUILDKIT=1

# Build the image with enhanced caching (single platform for local builds)
echo "🔧 Building with enhanced caching and multi-stage optimization..."
docker build \
    --tag "${REGISTRY}/${IMAGE_NAME}:${TAG}" \
    --tag "${REGISTRY}/${IMAGE_NAME}:$(git rev-parse --short HEAD)" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --build-arg DOCKER_BUILDKIT=1 \
    --target runtime \
    --cache-from "${REGISTRY}/${IMAGE_NAME}:cache" \
    .

# Push the image
echo "📤 Pushing image to registry..."
echo "Note: Make sure you're logged in to GHCR with:"
echo "echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
docker push "${REGISTRY}/${IMAGE_NAME}:${TAG}"
docker push "${REGISTRY}/${IMAGE_NAME}:$(git rev-parse --short HEAD)"

echo "✅ Successfully built and pushed: ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo "Image is now available for faster GitHub Actions execution!"
