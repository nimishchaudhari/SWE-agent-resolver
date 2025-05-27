#!/bin/bash

# test/run-all-tests.sh - Master test runner
# Runs all tests in sequence and provides comprehensive reporting

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
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ $1${NC}"
}

# Test suite definitions
declare -A TEST_SUITES=(
    ["context"]="Context Detection Tests"
    ["docker"]="Docker Build Tests"
    ["integration"]="Integration Tests"
    ["validation"]="Full Setup Validation"
    ["docker-setup"]="Docker Setup Validation"
)

# Available test scripts
TEST_SCRIPTS=(
    "context-test.sh:Context Detection Tests"
    "docker-test.sh:Docker Build Tests"  
    "integration-test.sh:Integration Tests"
    "validate-full-setup.sh:Full Setup Validation"
    "validate-docker-setup.sh:Docker Setup Validation"
)
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Test suites
TESTS=(
    "integration-test.sh|Integration Tests"
    "context-test.sh|Context Detection Tests"
)

# Conditional tests (only if Docker is available)
if command -v docker &>/dev/null; then
    TESTS+=("docker-test.sh|Docker Tests")
else
    log_warning "Docker not available, skipping Docker tests"
fi

main() {
    log "🚀 Starting Complete SWE-Agent Test Suite"
    echo "=========================================="
    
    local total_suites=0
    local passed_suites=0
    local failed_suites=0
    
    cd "$SCRIPT_DIR"
    
    for test_entry in "${TESTS[@]}"; do
        IFS='|' read -r test_script test_name <<< "$test_entry"
        
        total_suites=$((total_suites + 1))
        
        log "Running $test_name ($test_script)..."
        echo ""
        
        if ./"$test_script"; then
            log_success "$test_name completed successfully"
            passed_suites=$((passed_suites + 1))
        else
            log_error "$test_name failed"
            failed_suites=$((failed_suites + 1))
        fi
        
        echo ""
        echo "===========================================" 
        echo ""
    done
    
    # Final summary
    log "🏁 Complete Test Suite Results"
    echo "=========================================="
    echo "Total Test Suites: $total_suites"
    log_success "Passed: $passed_suites"
    
    if [[ $failed_suites -gt 0 ]]; then
        log_error "Failed: $failed_suites"
        echo ""
        log_error "💥 Some test suites failed. Please review and fix issues."
        echo ""
        echo "Next steps:"
        echo "1. Review individual test outputs above"
        echo "2. Fix any identified issues"
        echo "3. Re-run tests: ./test/run-all-tests.sh"
        echo "4. Once all tests pass, you can deploy to GitHub"
        exit 1
    else
        log_success "Failed: $failed_suites"
        echo ""
        log_success "🎉 ALL TESTS PASSED!"
        echo ""
        echo "✅ Your SWE-Agent is ready for deployment!"
        echo ""
        echo "Next steps:"
        echo "1. Commit your changes: git add . && git commit -m 'Fix SWE-Agent configuration'"
        echo "2. Push to GitHub: git push origin main"
        echo "3. The build workflow will automatically create Docker images"
        echo "4. Test with a real issue comment: @swe-agent <your request>"
        exit 0
    fi
}

main "$@"
