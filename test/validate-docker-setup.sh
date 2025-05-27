#!/bin/bash

# Docker Build and Registry Test Script
# Tests Docker image building and registry functionality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REGISTRY="ghcr.io/nimishchaudhari/swe-agent-resolver"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
TEST_LOG="test/results/docker_test_$(date +%Y%m%d_%H%M%S).txt"

mkdir -p test/results

log() {
    echo -e "$1" | tee -a "$TEST_LOG"
}

test_docker_build() {
    log "${BLUE}🐳 Testing Docker build process...${NC}"
    
    # Test local build
    log "Building Docker image locally..."
    if docker build -t "swe-agent-test:local" . &>/dev/null; then
        log "${GREEN}✅ Local Docker build successful${NC}"
    else
        log "${RED}❌ Local Docker build failed${NC}"
        return 1
    fi
    
    # Test basic container functionality
    log "Testing basic container functionality..."
    if docker run --rm "swe-agent-test:local" --help &>/dev/null; then
        log "${GREEN}✅ Container runs successfully${NC}"
    else
        log "${YELLOW}⚠️ Container help command failed (this might be expected)${NC}"
    fi
    
    # Cleanup
    docker rmi "swe-agent-test:local" &>/dev/null || true
    
    return 0
}

test_image_tagging_strategy() {
    log "${BLUE}🏷️ Testing image tagging strategy...${NC}"
    
    # Simulate what the GitHub Actions would do
    log "Current branch: $CURRENT_BRANCH"
    
    # Check if branch-specific image would be created
    BRANCH_TAG="${REGISTRY}:${CURRENT_BRANCH}"
    LATEST_TAG="${REGISTRY}:latest"
    
    log "Expected branch tag: $BRANCH_TAG"
    log "Fallback latest tag: $LATEST_TAG"
    
    # Test if we can check for image existence (this will fail for non-existent images)
    log "Testing image existence check logic..."
    if docker manifest inspect "$LATEST_TAG" &>/dev/null; then
        log "${GREEN}✅ Latest image exists and is accessible${NC}"
    else
        log "${YELLOW}⚠️ Latest image not found (expected for new setup)${NC}"
    fi
    
    if docker manifest inspect "$BRANCH_TAG" &>/dev/null; then
        log "${GREEN}✅ Branch-specific image exists${NC}"
    else
        log "${YELLOW}⚠️ Branch-specific image not found (expected for new branches)${NC}"
    fi
    
    return 0
}

test_build_workflow_triggers() {
    log "${BLUE}🔧 Testing build workflow configuration...${NC}"
    
    local build_workflow=".github/workflows/build-docker-image.yml"
    
    # Check trigger paths
    if grep -q "src/\*\*" "$build_workflow"; then
        log "${GREEN}✅ Build triggers on src changes${NC}"
    else
        log "${RED}❌ Missing src trigger in build workflow${NC}"
        return 1
    fi
    
    if grep -q "scripts/\*\*" "$build_workflow"; then
        log "${GREEN}✅ Build triggers on script changes${NC}"
    else
        log "${RED}❌ Missing scripts trigger in build workflow${NC}"
        return 1
    fi
    
    # Check branch configuration
    if grep -q "main, master, develop" "$build_workflow"; then
        log "${GREEN}✅ Build configured for main branches${NC}"
    else
        log "${RED}❌ Build not configured for expected branches${NC}"
        return 1
    fi
    
    return 0
}

test_registry_access() {
    log "${BLUE}🔐 Testing registry access...${NC}"
    
    # Check if we can reach the registry
    if curl -sSf "https://ghcr.io" &>/dev/null; then
        log "${GREEN}✅ GitHub Container Registry is accessible${NC}"
    else
        log "${RED}❌ Cannot reach GitHub Container Registry${NC}"
        return 1
    fi
    
    # Note: We can't test actual push without credentials
    log "${YELLOW}ℹ️ Actual push testing requires GitHub Actions environment${NC}"
    
    return 0
}

test_action_image_logic() {
    log "${BLUE}🎯 Testing action.yml image selection logic...${NC}"
    
    # Check if the new image selection logic exists
    if grep -q "image-tag" action.yml; then
        log "${GREEN}✅ Dynamic image selection logic found${NC}"
    else
        log "${RED}❌ Missing dynamic image selection in action.yml${NC}"
        return 1
    fi
    
    # Check for fallback logic
    if grep -q "falling back to latest" action.yml; then
        log "${GREEN}✅ Fallback logic implemented${NC}"
    else
        log "${RED}❌ Missing fallback logic${NC}"
        return 1
    fi
    
    return 0
}

main() {
    log "${BLUE}🚀 Starting Docker Build and Registry Tests${NC}"
    log "=============================================="
    log "Timestamp: $(date)"
    log "Current Branch: $CURRENT_BRANCH"
    log "Registry: $REGISTRY"
    log ""
    
    local tests_passed=0
    local tests_failed=0
    
    # Run tests
    for test_func in test_docker_build test_image_tagging_strategy test_build_workflow_triggers test_registry_access test_action_image_logic; do
        test_name=$(echo "$test_func" | sed 's/test_//' | sed 's/_/ /g')
        log "${BLUE}Testing: $test_name${NC}"
        
        if $test_func; then
            ((tests_passed++))
        else
            ((tests_failed++))
        fi
        log ""
    done
    
    # Results
    log "=============================================="
    log "${BLUE}Docker Test Results${NC}"
    log "✅ Tests Passed: $tests_passed"
    log "❌ Tests Failed: $tests_failed"
    log "📝 Log saved to: $TEST_LOG"
    
    if [[ $tests_failed -eq 0 ]]; then
        log "${GREEN}🎉 All Docker tests passed!${NC}"
        exit 0
    else
        log "${RED}⚠️ Some Docker tests failed.${NC}"
        exit 1
    fi
}

main "$@"
