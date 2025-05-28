#!/bin/bash

# Quick build test script for local development
# Use this for faster local testing (single platform)

set -e

echo "🚀 Quick Docker build (single platform for testing)"
echo "=================================================="

# Build for current architecture only (much faster)
PLATFORM=$(uname -m)
if [ "$PLATFORM" = "x86_64" ]; then
    DOCKER_PLATFORM="linux/amd64"
elif [ "$PLATFORM" = "aarch64" ] || [ "$PLATFORM" = "arm64" ]; then
    DOCKER_PLATFORM="linux/arm64"
else
    DOCKER_PLATFORM="linux/amd64"
fi

echo "Building for platform: $DOCKER_PLATFORM"

# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Build with cache and single platform
docker buildx build \
    --platform "$DOCKER_PLATFORM" \
    --tag "swe-agent-resolver:local-test" \
    --load \
    .

echo "✅ Local build complete!"
echo "🧪 Running quick test..."

# Quick test
if docker run --rm "swe-agent-resolver:local-test" echo "Container working!" >/dev/null 2>&1; then
    echo "✅ Container test passed!"
else
    echo "❌ Container test failed"
    exit 1
fi

echo ""
echo "📊 Image details:"
docker images "swe-agent-resolver:local-test" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "🚀 Ready for local testing!"
echo "Usage: docker run --rm swe-agent-resolver:local-test"
