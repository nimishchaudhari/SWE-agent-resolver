#!/bin/bash

# SWE-Agent Full Setup Validation Script
# Tests all components to ensure the GitHub Actions workflow will work correctly

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_LOG_FILE="test/results/full_validation_$(date +%Y%m%d_%H%M%S).txt"

# Create results directory if it doesn't exist
mkdir -p test/results

# Logging function
log() {
    echo -e "$1" | tee -a "$TEST_LOG_FILE"
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    log "${BLUE}🧪 Running test: $test_name${NC}"
    
    if $test_function; then
        log "${GREEN}✅ PASSED: $test_name${NC}"
        ((TESTS_PASSED++))
    else
        log "${RED}❌ FAILED: $test_name${NC}"
        ((TESTS_FAILED++))
    fi
    
    log ""
}

# Test 1: Verify all required files exist
test_file_structure() {
    local required_files=(
        "action.yml"
        "Dockerfile"
        "entrypoint.sh"
        ".github/workflows/build-docker-image.yml"
        ".github/workflows/swe-agent-aio.yml"
        "scripts/context-detection.sh"
        "scripts/handle-issue-context.sh"
        "scripts/handle-pr-context.sh"
        "src/utils.sh"
        "src/swe_agent.sh"
        "src/github.sh"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log "${RED}Missing required file: $file${NC}"
            return 1
        fi
    done
    
    return 0
}

# Test 2: Verify scripts are executable
test_script_permissions() {
    local scripts=(
        "scripts/context-detection.sh"
        "scripts/handle-issue-context.sh"
        "scripts/handle-pr-context.sh"
        "entrypoint.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ ! -x "$script" ]]; then
            log "${RED}Script not executable: $script${NC}"
            return 1
        fi
    done
    
    return 0
}

# Test 3: Test context detection script with mock data
test_context_detection() {
    log "${YELLOW}Testing context detection with mock issue comment...${NC}"
    
    export GITHUB_EVENT_NAME="issue_comment"
    export GITHUB_ACTOR="test-user"
    export PR_NUMBER=""
    export REVIEW_BODY=""
    export PR_TITLE=""
    export PR_BODY=""
    export REVIEW_ID=""
    export COMMENT_BODY="@swe-agent Please fix this issue"
    export COMMENT_ID="123456789"
    export ISSUE_PR_URL=""
    export ISSUE_NUMBER="42"
    export ISSUE_TITLE="Test Issue"
    export ISSUE_BODY="This is a test issue that needs fixing"
    
    if ./scripts/context-detection.sh &>/dev/null; then
        log "${GREEN}Context detection script executed successfully${NC}"
        return 0
    else
        log "${RED}Context detection script failed${NC}"
        return 1
    fi
}

# Test 4: Validate YAML syntax
test_yaml_syntax() {
    local yaml_files=(
        "action.yml"
        ".github/workflows/build-docker-image.yml"
        ".github/workflows/swe-agent-aio.yml"
    )
    
    for yaml_file in "${yaml_files[@]}"; do
        if command -v yq &> /dev/null; then
            if ! yq eval '.' "$yaml_file" &>/dev/null; then
                log "${RED}Invalid YAML syntax in: $yaml_file${NC}"
                return 1
            fi
        elif command -v python3 &> /dev/null; then
            if ! python3 -c "import yaml; yaml.safe_load(open('$yaml_file'))" &>/dev/null; then
                log "${RED}Invalid YAML syntax in: $yaml_file${NC}"
                return 1
            fi
        else
            log "${YELLOW}No YAML validator found, skipping syntax check for: $yaml_file${NC}"
        fi
    done
    
    return 0
}

# Test 5: Check Dockerfile syntax
test_dockerfile() {
    if command -v docker &> /dev/null; then
        if docker build --dry-run . &>/dev/null; then
            log "${GREEN}Dockerfile syntax is valid${NC}"
            return 0
        else
            log "${RED}Dockerfile has syntax errors${NC}"
            return 1
        fi
    else
        log "${YELLOW}Docker not available, skipping Dockerfile test${NC}"
        return 0
    fi
}

# Test 6: Verify GitHub Actions workflow structure
test_workflow_structure() {
    local workflow_file=".github/workflows/swe-agent-aio.yml"
    
    # Check if checkout happens before script execution
    if grep -A 10 "steps:" "$workflow_file" | grep -B 5 -A 5 "Checkout Repository" | grep -q "context-detection"; then
        log "${RED}Workflow error: Context detection runs before checkout${NC}"
        return 1
    fi
    
    # Verify trigger conditions exist
    if ! grep -q "@swe-agent" "$workflow_file"; then
        log "${RED}Workflow missing trigger phrase${NC}"
        return 1
    fi
    
    return 0
}

# Test 7: Check for environment variable consistency
test_env_consistency() {
    local action_file="action.yml"
    local workflow_file=".github/workflows/swe-agent-aio.yml"
    
    # Check timeout parameter consistency
    if grep -q "timeout_minutes" "$action_file" && grep -q "timeout_seconds" "$workflow_file"; then
        log "${RED}Inconsistent timeout parameters between action.yml and workflow${NC}"
        return 1
    fi
    
    return 0
}

# Test 8: Validate Docker image tagging strategy
test_docker_tagging() {
    local build_workflow=".github/workflows/build-docker-image.yml"
    
    # Check if proper tagging is configured
    if ! grep -q "type=ref,event=branch" "$build_workflow"; then
        log "${RED}Missing branch-based tagging in build workflow${NC}"
        return 1
    fi
    
    # Check if latest tag is configured for default branch
    if ! grep -q "type=raw,value=latest" "$build_workflow"; then
        log "${RED}Missing latest tag configuration${NC}"
        return 1
    fi
    
    return 0
}

# Test 9: Check script dependencies
test_script_dependencies() {
    local context_script="scripts/context-detection.sh"
    
    # Check if scripts source required utilities
    if grep -q "source.*utils.sh" "$context_script"; then
        if [[ ! -f "src/utils.sh" ]]; then
            log "${RED}Context detection script sources utils.sh but file doesn't exist${NC}"
            return 1
        fi
    fi
    
    return 0
}

# Test 10: Mock end-to-end workflow simulation
test_mock_workflow() {
    log "${YELLOW}Simulating GitHub Actions workflow steps...${NC}"
    
    # Step 1: Checkout (simulated)
    log "  1. Repository checkout: ✅"
    
    # Step 2: Context detection
    log "  2. Running context detection..."
    export GITHUB_EVENT_NAME="issue_comment"
    export COMMENT_BODY="@swe-agent Test the system"
    export ISSUE_NUMBER="999"
    export ISSUE_TITLE="Test Issue"
    export ISSUE_BODY="Test issue body"
    
    if ./scripts/context-detection.sh &>/dev/null; then
        log "     Context detection: ✅"
    else
        log "     Context detection: ❌"
        return 1
    fi
    
    # Step 3: Check if Docker image strategy would work
    log "  3. Docker image strategy check..."
    if grep -q "image-tag" action.yml; then
        log "     Branch-specific image logic: ✅"
    else
        log "     Branch-specific image logic: ❌"
        return 1
    fi
    
    log "  4. Mock workflow simulation: ✅"
    return 0
}

# Main test execution
main() {
    log "${BLUE}🚀 Starting SWE-Agent Full Setup Validation${NC}"
    log "================================================"
    log "Timestamp: $(date)"
    log "Working Directory: $(pwd)"
    log ""
    
    # Run all tests
    run_test "File Structure Check" test_file_structure
    run_test "Script Permissions Check" test_script_permissions
    run_test "Context Detection Functionality" test_context_detection
    run_test "YAML Syntax Validation" test_yaml_syntax
    run_test "Dockerfile Validation" test_dockerfile
    run_test "Workflow Structure Check" test_workflow_structure
    run_test "Environment Variable Consistency" test_env_consistency
    run_test "Docker Tagging Strategy" test_docker_tagging
    run_test "Script Dependencies Check" test_script_dependencies
    run_test "Mock End-to-End Workflow" test_mock_workflow
    
    # Final results
    log "================================================"
    log "${BLUE}🏁 Test Results Summary${NC}"
    log "✅ Tests Passed: $TESTS_PASSED"
    log "❌ Tests Failed: $TESTS_FAILED"
    log "📝 Full log saved to: $TEST_LOG_FILE"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log "${GREEN}🎉 ALL TESTS PASSED! Your SWE-Agent setup is ready!${NC}"
        exit 0
    else
        log "${RED}⚠️  Some tests failed. Please review the issues above.${NC}"
        exit 1
    fi
}

# Run the main function
main "$@"
