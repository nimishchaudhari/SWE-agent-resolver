#!/bin/bash

# test/docker-test.sh - Docker-specific testing script
# Tests Docker image building and basic functionality

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test Docker build
test_docker_build() {
    log "Testing Docker image build..."
    cd "$PROJECT_ROOT"
    
    if ! docker build -t swe-agent-resolver-test:local .; then
        log_error "Docker build failed"
        return 1
    fi
    
    log_success "Docker build completed successfully"
    return 0
}

# Test Docker run
test_docker_run() {
    log "Testing Docker container run..."
    
    # Test basic container execution
    if ! docker run --rm swe-agent-resolver-test:local --help 2>/dev/null; then
        log_error "Docker container failed to run"
        return 1
    fi
    
    log_success "Docker container runs successfully"
    return 0
}

# Test environment variables
test_docker_env() {
    log "Testing Docker environment variable handling..."
    
    # Test with minimal environment
    if ! docker run --rm \
        -e INPUT_GITHUB_TOKEN="test" \
        -e INPUT_MODEL_NAME="gpt-4o" \
        swe-agent-resolver-test:local \
        echo "Environment test" 2>/dev/null; then
        log_error "Docker environment variable handling failed"
        return 1
    fi
    
    log_success "Docker environment variables handled correctly"
    return 0
}

# Cleanup
cleanup() {
    log "Cleaning up Docker test images..."
    docker rmi swe-agent-resolver-test:local 2>/dev/null || true
}

main() {
    log "🐳 Starting Docker Tests"
    
    # Check if Docker is available
    if ! command -v docker &>/dev/null; then
        log_error "Docker is not installed or not available"
        exit 1
    fi
    
    # Run tests
    if test_docker_build && test_docker_run && test_docker_env; then
        log_success "🎉 All Docker tests passed!"
        cleanup
        exit 0
    else
        log_error "💥 Some Docker tests failed!"
        cleanup
        exit 1
    fi
}

main "$@"
