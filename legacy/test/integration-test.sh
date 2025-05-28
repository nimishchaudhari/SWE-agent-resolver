#!/bin/bash

# test/integration-test.sh - Comprehensive integration test for SWE-Agent resolver
# This script validates all components work correctly before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$TEST_RESULTS_DIR/test_log_$TIMESTAMP.txt"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$TEST_RESULTS_DIR/test_log_$TIMESTAMP.txt"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}" | tee -a "$TEST_RESULTS_DIR/test_log_$TIMESTAMP.txt"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$TEST_RESULTS_DIR/test_log_$TIMESTAMP.txt"
}

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test execution wrapper
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log "Running test: $test_name"
    
    if $test_function; then
        log_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: File Structure Validation
test_file_structure() {
    local required_files=(
        "action.yml"
        "Dockerfile"
        "entrypoint.sh"
        "scripts/context-detection.sh"
        "scripts/handle-issue-context.sh"
        "scripts/handle-pr-context.sh"
        "src/utils.sh"
        "src/swe_agent.sh"
        ".github/workflows/build-docker-image.yml"
        ".github/workflows/swe-agent-aio.yml"
    )
    
    cd "$PROJECT_ROOT"
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Missing required file: $file"
            return 1
        fi
    done
    
    return 0
}

# Test 2: Script Syntax Validation
test_script_syntax() {
    cd "$PROJECT_ROOT"
    
    # Test bash scripts
    local bash_scripts=(
        "entrypoint.sh"
        "scripts/context-detection.sh"
        "scripts/handle-issue-context.sh"
        "scripts/handle-pr-context.sh"
        "src/utils.sh"
        "src/swe_agent.sh"
    )
    
    for script in "${bash_scripts[@]}"; do
        if ! bash -n "$script" 2>/dev/null; then
            log_error "Syntax error in script: $script"
            return 1
        fi
    done
    
    return 0
}

# Test 3: YAML Validation
test_yaml_syntax() {
    cd "$PROJECT_ROOT"
    
    local yaml_files=(
        "action.yml"
        ".github/workflows/build-docker-image.yml"
        ".github/workflows/swe-agent-aio.yml"
    )
    
    for yaml_file in "${yaml_files[@]}"; do
        # Basic YAML syntax check using Python
        if ! python3 -c "import yaml; yaml.safe_load(open('$yaml_file'))" 2>/dev/null; then
            log_error "YAML syntax error in: $yaml_file"
            return 1
        fi
    done
    
    return 0
}

# Test 4: Context Detection Script
test_context_detection() {
    cd "$PROJECT_ROOT"
    
    # Test with issue comment environment
    export GITHUB_EVENT_NAME="issue_comment"
    export GITHUB_ACTOR="test-user"
    export COMMENT_BODY="@swe-agent Please fix this issue"
    export COMMENT_ID="123456"
    export ISSUE_NUMBER="1"
    export ISSUE_TITLE="Test Issue"
    export ISSUE_BODY="This is a test issue"
    export ISSUE_PR_URL=""
    
    # Capture output and check for expected results
    if ! ./scripts/context-detection.sh &>/dev/null; then
        log_error "Context detection script failed with issue comment environment"
        return 1
    fi
    
    # Test with PR comment environment
    export GITHUB_EVENT_NAME="pull_request_review_comment"
    export PR_NUMBER="2"
    export ISSUE_PR_URL="https://api.github.com/repos/test/test/pulls/2"
    
    if ! ./scripts/context-detection.sh &>/dev/null; then
        log_error "Context detection script failed with PR comment environment"
        return 1
    fi
    
    # Clean up environment
    unset GITHUB_EVENT_NAME GITHUB_ACTOR COMMENT_BODY COMMENT_ID ISSUE_NUMBER ISSUE_TITLE ISSUE_BODY ISSUE_PR_URL PR_NUMBER
    
    return 0
}

# Test 5: Docker Configuration
test_docker_config() {
    cd "$PROJECT_ROOT"
    
    # Check if Dockerfile exists and has required components
    if ! grep -q "FROM" Dockerfile; then
        log_error "Dockerfile missing FROM instruction"
        return 1
    fi
    
    if ! grep -q "COPY.*entrypoint.sh" Dockerfile; then
        log_error "Dockerfile not copying entrypoint.sh"
        return 1
    fi
    
    if ! grep -q "ENTRYPOINT.*entrypoint.sh" Dockerfile; then
        log_error "Dockerfile missing proper ENTRYPOINT"
        return 1
    fi
    
    return 0
}

# Test 6: Action.yml Validation
test_action_configuration() {
    cd "$PROJECT_ROOT"
    
    # Check required fields in action.yml
    if ! grep -q "name:" action.yml; then
        log_error "action.yml missing name field"
        return 1
    fi
    
    if ! grep -q "description:" action.yml; then
        log_error "action.yml missing description field"
        return 1
    fi
    
    if ! grep -q "docker://ghcr.io/nimishchaudhari/swe-agent-resolver:latest" action.yml; then
        log_error "action.yml not using correct Docker image reference"
        return 1
    fi
    
    # Check for required inputs
    local required_inputs=("github_token" "timeout_minutes")
    for input in "${required_inputs[@]}"; do
        if ! grep -q "$input:" action.yml; then
            log_error "action.yml missing required input: $input"
            return 1
        fi
    done
    
    return 0
}

# Test 7: GitHub Workflows Validation
test_github_workflows() {
    cd "$PROJECT_ROOT"
    
    # Check build workflow
    if ! grep -q "name: Build and Cache Docker Image" .github/workflows/build-docker-image.yml; then
        log_error "Build workflow missing proper name"
        return 1
    fi
    
    if ! grep -q "branches: \[ main, master \]" .github/workflows/build-docker-image.yml; then
        log_error "Build workflow not configured for main/master branches"
        return 1
    fi
    
    # Check AIO workflow
    if ! grep -q "Checkout Repository" .github/workflows/swe-agent-aio.yml; then
        log_error "AIO workflow missing checkout step"
        return 1
    fi
    
    if ! grep -q "Detect Context and Initialize" .github/workflows/swe-agent-aio.yml; then
        log_error "AIO workflow missing context detection step"
        return 1
    fi
    
    # Verify checkout comes before context detection
    local checkout_line=$(grep -n "Checkout Repository" .github/workflows/swe-agent-aio.yml | cut -d: -f1)
    local context_line=$(grep -n "Detect Context and Initialize" .github/workflows/swe-agent-aio.yml | cut -d: -f1)
    
    if [[ $checkout_line -gt $context_line ]]; then
        log_error "AIO workflow has incorrect step order (checkout should come before context detection)"
        return 1
    fi
    
    return 0
}

# Test 8: Environment Variable Handling
test_environment_variables() {
    cd "$PROJECT_ROOT"
    
    # Check if scripts properly handle missing environment variables
    export GITHUB_ACTIONS="false"  # Simulate non-GitHub Actions environment
    
    if ! ./scripts/context-detection.sh &>/dev/null; then
        log_error "Context detection script should handle missing GitHub Actions environment gracefully"
        return 1
    fi
    
    unset GITHUB_ACTIONS
    return 0
}

# Test 9: Dependencies Check
test_dependencies() {
    # Check for required system tools
    local required_tools=("bash" "git" "python3" "curl")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &>/dev/null; then
            log_error "Missing required tool: $tool"
            return 1
        fi
    done
    
    return 0
}

# Test 10: Security Check
test_security() {
    cd "$PROJECT_ROOT"
    
    # Check for hardcoded secrets (basic check)
    if grep -r "sk-" . --exclude-dir=.git --exclude-dir=test 2>/dev/null | grep -v "example\|placeholder\|template"; then
        log_error "Potential hardcoded API keys found"
        return 1
    fi
    
    # Check file permissions
    if [[ $(stat -c %a entrypoint.sh) != "755" ]]; then
        log_warning "entrypoint.sh should have 755 permissions"
    fi
    
    return 0
}

# Test 11: Integration Simulation
test_integration_simulation() {
    cd "$PROJECT_ROOT"
    
    # Simulate a complete workflow run (without actual Docker execution)
    export GITHUB_EVENT_NAME="issue_comment"
    export GITHUB_ACTOR="test-user"
    export COMMENT_BODY="@swe-agent Please create a hello world program"
    export COMMENT_ID="123456"
    export ISSUE_NUMBER="1"
    export ISSUE_TITLE="Create hello world"
    export ISSUE_BODY="Create a hello world program in Python"
    export GITHUB_ACTIONS="true"
    export GITHUB_OUTPUT="/tmp/github_output_test_$TIMESTAMP"
    
    # Create temporary GitHub output file
    touch "$GITHUB_OUTPUT"
    
    # Run context detection
    if ! ./scripts/context-detection.sh; then
        log_error "Integration simulation failed at context detection"
        return 1
    fi
    
    # Check if outputs were generated
    if [[ ! -s "$GITHUB_OUTPUT" ]]; then
        log_error "Context detection did not generate GitHub outputs"
        return 1
    fi
    
    # Clean up
    rm -f "$GITHUB_OUTPUT"
    unset GITHUB_EVENT_NAME GITHUB_ACTOR COMMENT_BODY COMMENT_ID ISSUE_NUMBER ISSUE_TITLE ISSUE_BODY GITHUB_ACTIONS GITHUB_OUTPUT
    
    return 0
}

# Test 12: Docker Image Registry Check
test_docker_registry() {
    log "Checking Docker image availability..."
    
    # Check if the image exists in the registry
    if ! curl -s -f -o /dev/null "https://ghcr.io/v2/nimishchaudhari/swe-agent-resolver/manifests/latest"; then
        log_warning "Docker image may not be available in registry yet (this is expected for new setups)"
        return 0  # Don't fail the test for this
    fi
    
    return 0
}

# Main test execution
main() {
    log "🧪 Starting SWE-Agent Integration Tests"
    log "Project Root: $PROJECT_ROOT"
    log "Test Results: $TEST_RESULTS_DIR"
    log "Timestamp: $TIMESTAMP"
    echo ""
    
    # Run all tests
    run_test "File Structure Validation" test_file_structure
    run_test "Script Syntax Validation" test_script_syntax
    run_test "YAML Syntax Validation" test_yaml_syntax
    run_test "Context Detection Script" test_context_detection
    run_test "Docker Configuration" test_docker_config
    run_test "Action Configuration" test_action_configuration
    run_test "GitHub Workflows Validation" test_github_workflows
    run_test "Environment Variable Handling" test_environment_variables
    run_test "Dependencies Check" test_dependencies
    run_test "Security Check" test_security
    run_test "Integration Simulation" test_integration_simulation
    run_test "Docker Registry Check" test_docker_registry
    
    # Print summary
    echo ""
    log "🏁 Test Execution Complete"
    echo "================================="
    log_success "Tests Passed: $TESTS_PASSED"
    if [[ $TESTS_FAILED -gt 0 ]]; then
        log_error "Tests Failed: $TESTS_FAILED"
    else
        log_success "Tests Failed: $TESTS_FAILED"
    fi
    echo "Total Tests: $TESTS_TOTAL"
    echo ""
    
    # Generate summary report
    cat > "$TEST_RESULTS_DIR/summary_$TIMESTAMP.txt" << EOF
SWE-Agent Integration Test Summary
Generated: $(date)
Project: $PROJECT_ROOT

RESULTS:
- Total Tests: $TESTS_TOTAL
- Tests Passed: $TESTS_PASSED  
- Tests Failed: $TESTS_FAILED
- Success Rate: $(( (TESTS_PASSED * 100) / TESTS_TOTAL ))%

STATUS: $(if [[ $TESTS_FAILED -eq 0 ]]; then echo "✅ ALL TESTS PASSED"; else echo "❌ SOME TESTS FAILED"; fi)
EOF
    
    log "📄 Test summary saved to: $TEST_RESULTS_DIR/summary_$TIMESTAMP.txt"
    log "📄 Full test log saved to: $TEST_RESULTS_DIR/test_log_$TIMESTAMP.txt"
    
    # Exit with appropriate code
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 All tests passed! SWE-Agent is ready for deployment."
        exit 0
    else
        log_error "💥 Some tests failed. Please review and fix issues before deployment."
        exit 1
    fi
}

# Run main function
main "$@"
