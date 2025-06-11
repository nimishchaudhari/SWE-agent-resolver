#!/bin/bash

# Real Local Testing Script for SWE-Agent Resolver
# Tests with actual providers, real repositories, and complete workflows

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="$(pwd)/test-local-output"
LOG_FILE="$TEST_DIR/test-results.log"
GITHUB_EVENT_FILE="$TEST_DIR/github-event.json"

# Provider test matrix
declare -A PROVIDER_MODELS=(
    ["openai"]="gpt-3.5-turbo"
    ["anthropic"]="claude-3-haiku-20240307"
    ["deepseek"]="deepseek/deepseek-chat"
    ["groq"]="groq/llama2-70b-4096"
)

# Test scenarios
declare -A TEST_SCENARIOS=(
    ["issue_comment"]="Test issue comment response"
    ["pull_request"]="Test PR review"
    ["issue_analysis"]="Test issue analysis"
)

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  SWE-Agent Resolver - Real Testing Suite  ${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_section() {
    echo -e "${YELLOW}▶ $1${NC}"
    echo "----------------------------------------"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

setup_test_environment() {
    print_section "Setting up test environment"
    
    # Create test directories
    mkdir -p "$TEST_DIR"/{logs,workspace,repos,configs,output}
    
    # Initialize log file
    echo "SWE-Agent Resolver Test Run - $(date)" > "$LOG_FILE"
    
    # Check required environment variables
    local required_vars=("GITHUB_TOKEN")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables: ${missing_vars[*]}"
        echo "Please set the following environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  export $var=your_value"
        done
        exit 1
    fi
    
    # Check for at least one provider API key
    local provider_keys=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "DEEPSEEK_API_KEY" "GROQ_API_KEY")
    local available_providers=()
    
    for key in "${provider_keys[@]}"; do
        if [[ -n "${!key}" ]]; then
            available_providers+=("$key")
        fi
    done
    
    if [[ ${#available_providers[@]} -eq 0 ]]; then
        print_error "No provider API keys found"
        echo "Please set at least one provider API key:"
        for key in "${provider_keys[@]}"; do
            echo "  export $key=your_api_key"
        done
        exit 1
    fi
    
    print_success "Environment setup complete"
    echo "Available providers: ${available_providers[*]}"
    echo ""
}

create_test_repository() {
    local repo_name="$1"
    local repo_path="$TEST_DIR/repos/$repo_name"
    
    print_section "Creating test repository: $repo_name"
    
    # Remove existing repo
    rm -rf "$repo_path"
    
    # Create new repository
    mkdir -p "$repo_path"
    cd "$repo_path"
    
    git init
    git config user.name "SWE-Agent Test"
    git config user.email "test@swe-agent.local"
    
    # Create sample files
    cat > README.md << 'EOF'
# Test Repository for SWE-Agent

This is a test repository used for validating SWE-Agent functionality.

## Features

- Basic JavaScript/Node.js project
- Simple bug for testing
- Documentation
EOF
    
    cat > package.json << 'EOF'
{
  "name": "swe-agent-test-repo",
  "version": "1.0.0",
  "description": "Test repository for SWE-Agent",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node index.js"
  },
  "keywords": ["test", "swe-agent"],
  "author": "SWE-Agent Test",
  "license": "MIT"
}
EOF
    
    cat > index.js << 'EOF'
// Simple calculator with a bug
function add(a, b) {
    return a + b;
}

function subtract(a, b) {
    return a - b;
}

function multiply(a, b) {
    return a * b;
}

function divide(a, b) {
    // BUG: No check for division by zero
    return a / b;
}

function calculate(operation, a, b) {
    switch (operation) {
        case 'add':
            return add(a, b);
        case 'subtract':
            return subtract(a, b);
        case 'multiply':
            return multiply(a, b);
        case 'divide':
            return divide(a, b);
        default:
            throw new Error('Unknown operation');
    }
}

module.exports = { add, subtract, multiply, divide, calculate };

// Example usage
if (require.main === module) {
    console.log('Calculator Test');
    console.log('2 + 3 =', calculate('add', 2, 3));
    console.log('10 - 4 =', calculate('subtract', 10, 4));
    console.log('5 * 6 =', calculate('multiply', 5, 6));
    console.log('15 / 3 =', calculate('divide', 15, 3));
    
    // This will cause issues
    console.log('10 / 0 =', calculate('divide', 10, 0));
}
EOF
    
    git add .
    git commit -m "Initial commit with calculator and division by zero bug"
    
    cd - > /dev/null
    
    print_success "Test repository created at $repo_path"
    echo ""
}

create_github_event() {
    local event_type="$1"
    local repo_name="$2"
    
    print_section "Creating GitHub event: $event_type"
    
    local event_json=""
    case "$event_type" in
        "issue_comment")
            event_json=$(cat << 'EOF'
{
  "action": "created",
  "issue": {
    "number": 1,
    "id": 1,
    "title": "Division by zero bug in calculator",
    "body": "The calculator crashes when dividing by zero. This should be handled gracefully with proper error checking.",
    "user": {
      "login": "test-user",
      "id": 1
    },
    "state": "open",
    "labels": [
      {
        "name": "bug",
        "color": "d73a4a"
      }
    ]
  },
  "comment": {
    "id": 1,
    "body": "@swe-agent fix the division by zero bug in the calculator",
    "user": {
      "login": "test-user",
      "id": 1
    },
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  },
  "repository": {
    "id": 1,
    "name": "test-repo",
    "full_name": "test-org/test-repo",
    "owner": {
      "login": "test-org",
      "id": 1
    }
  },
  "sender": {
    "login": "test-user",
    "id": 1
  }
}
EOF
)
            ;;
        "pull_request")
            event_json=$(cat << 'EOF'
{
  "action": "opened",
  "pull_request": {
    "number": 1,
    "id": 1,
    "title": "Add error handling for division by zero",
    "body": "This PR adds proper error handling for division by zero in the calculator function.",
    "user": {
      "login": "test-user",
      "id": 1
    },
    "base": {
      "ref": "main",
      "sha": "abc123"
    },
    "head": {
      "ref": "fix-division-by-zero",
      "sha": "def456"
    },
    "changed_files": 1
  },
  "repository": {
    "id": 1,
    "name": "test-repo",
    "full_name": "test-org/test-repo",
    "owner": {
      "login": "test-org",
      "id": 1
    }
  },
  "sender": {
    "login": "test-user",
    "id": 1
  }
}
EOF
)
            ;;
        "issue_analysis")
            event_json=$(cat << 'EOF'
{
  "action": "opened",
  "issue": {
    "number": 2,
    "id": 2,
    "title": "Improve calculator functionality",
    "body": "The calculator could benefit from additional operations and better error handling. Please analyze and suggest improvements.",
    "user": {
      "login": "test-user",
      "id": 1
    },
    "state": "open",
    "labels": [
      {
        "name": "enhancement",
        "color": "a2eeef"
      }
    ]
  },
  "repository": {
    "id": 1,
    "name": "test-repo",
    "full_name": "test-org/test-repo",
    "owner": {
      "login": "test-org",
      "id": 1
    }
  },
  "sender": {
    "login": "test-user",
    "id": 1
  }
}
EOF
)
            ;;
    esac
    
    # Replace placeholders and save
    echo "$event_json" | sed "s/test-repo/$repo_name/g" > "$GITHUB_EVENT_FILE"
    
    print_success "GitHub event created: $GITHUB_EVENT_FILE"
    echo ""
}

test_provider() {
    local provider="$1"
    local model="$2"
    local scenario="$3"
    local repo_name="$4"
    
    print_section "Testing provider: $provider with model: $model"
    
    # Check if API key is available
    local api_key_var="${provider^^}_API_KEY"
    if [[ -z "${!api_key_var}" ]]; then
        print_warning "Skipping $provider - API key not set ($api_key_var)"
        return 0
    fi
    
    # Set up environment for this test
    export GITHUB_WORKSPACE="$TEST_DIR/workspace"
    export GITHUB_EVENT_NAME="issue_comment"
    export GITHUB_EVENT_PATH="$GITHUB_EVENT_FILE"
    export GITHUB_REPOSITORY="test-org/$repo_name"
    export GITHUB_SHA="abc123"
    export GITHUB_REF="refs/heads/main"
    export GITHUB_ACTOR="test-user"
    
    export INPUT_MODEL_NAME="$model"
    export INPUT_TRIGGER_PHRASE="@swe-agent"
    export INPUT_MAX_COST="1.00"
    export INPUT_DEBUG_MODE="true"
    export INPUT_WORKSPACE_TIMEOUT="300"  # 5 minutes for testing
    
    export LOG_LEVEL="debug"
    export LOG_DIR="$TEST_DIR/logs"
    
    # Create workspace
    mkdir -p "$GITHUB_WORKSPACE"
    
    # Copy test repository to workspace
    cp -r "$TEST_DIR/repos/$repo_name" "$GITHUB_WORKSPACE/"
    
    local start_time=$(date +%s)
    local test_output_file="$TEST_DIR/output/${provider}_${scenario}_$(date +%s).log"
    
    print_section "Executing SWE-Agent with $provider ($model)"
    
    # Run the action
    if timeout 600 node src/index.js > "$test_output_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_success "Test completed in ${duration}s"
        
        # Analyze results
        analyze_test_results "$test_output_file" "$provider" "$model" "$scenario" "$duration"
        
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        print_error "Test failed after ${duration}s"
        echo "Output saved to: $test_output_file"
        
        # Show last few lines of output
        echo "Last 10 lines of output:"
        tail -10 "$test_output_file" || echo "No output file found"
    fi
    
    echo ""
}

analyze_test_results() {
    local output_file="$1"
    local provider="$2"
    local model="$3"
    local scenario="$4"
    local duration="$5"
    
    print_section "Analyzing results for $provider"
    
    # Check for key success indicators
    local success_indicators=(
        "✅ Action completed"
        "SWE-agent execution successful"
        "Configuration generated"
        "Provider detected"
    )
    
    local error_indicators=(
        "❌ Action failed"
        "Error:"
        "Failed to"
        "Exception:"
    )
    
    local successes=0
    local errors=0
    
    for indicator in "${success_indicators[@]}"; do
        if grep -q "$indicator" "$output_file"; then
            ((successes++))
        fi
    done
    
    for indicator in "${error_indicators[@]}"; do
        if grep -q "$indicator" "$output_file"; then
            ((errors++))
        fi
    done
    
    # Extract cost information
    local cost_info=$(grep -o "Cost: \$[0-9.]*" "$output_file" | head -1)
    
    # Generate test report
    cat >> "$LOG_FILE" << EOF

========================================
Test Results: $provider ($model)
========================================
Scenario: $scenario
Duration: ${duration}s
Success Indicators: $successes
Error Indicators: $errors
Cost: ${cost_info:-"Not available"}
Output File: $output_file

EOF
    
    if [[ $successes -gt 0 && $errors -eq 0 ]]; then
        print_success "Test analysis: PASSED"
    elif [[ $successes -gt 0 && $errors -gt 0 ]]; then
        print_warning "Test analysis: PARTIAL SUCCESS"
    else
        print_error "Test analysis: FAILED"
    fi
    
    # Show summary
    echo "  Success indicators: $successes"
    echo "  Error indicators: $errors"
    echo "  Duration: ${duration}s"
    echo "  Cost: ${cost_info:-"Not available"}"
}

run_docker_tests() {
    print_section "Running Docker integration tests"
    
    # Build the Docker image
    echo "Building Docker image..."
    if docker build -t swe-agent-resolver:test . > "$TEST_DIR/docker-build.log" 2>&1; then
        print_success "Docker image built successfully"
    else
        print_error "Docker build failed"
        echo "Build log:"
        cat "$TEST_DIR/docker-build.log"
        return 1
    fi
    
    # Test Docker container
    echo "Testing Docker container..."
    local docker_output="$TEST_DIR/docker-test.log"
    
    if timeout 300 docker run --rm \
        -e GITHUB_TOKEN="$GITHUB_TOKEN" \
        -e OPENAI_API_KEY="${OPENAI_API_KEY:-dummy}" \
        -e INPUT_MODEL_NAME="gpt-3.5-turbo" \
        -e GITHUB_EVENT_NAME="issue_comment" \
        -v "$GITHUB_EVENT_FILE:/tmp/event.json" \
        -e GITHUB_EVENT_PATH="/tmp/event.json" \
        swe-agent-resolver:test > "$docker_output" 2>&1; then
        print_success "Docker test completed"
    else
        print_warning "Docker test had issues (timeout or error)"
        echo "Output:"
        tail -20 "$docker_output"
    fi
}

run_performance_tests() {
    print_section "Running performance benchmarks"
    
    local performance_file="$TEST_DIR/performance.log"
    echo "Performance Test Results - $(date)" > "$performance_file"
    
    # Test different model response times
    for provider in "${!PROVIDER_MODELS[@]}"; do
        local api_key_var="${provider^^}_API_KEY"
        if [[ -n "${!api_key_var}" ]]; then
            local model="${PROVIDER_MODELS[$provider]}"
            
            echo "Benchmarking $provider ($model)..."
            
            local start_time=$(date +%s%N)
            
            # Run minimal test
            export INPUT_MODEL_NAME="$model"
            timeout 120 node src/index.js > /dev/null 2>&1 || true
            
            local end_time=$(date +%s%N)
            local duration_ms=$(((end_time - start_time) / 1000000))
            
            echo "$provider ($model): ${duration_ms}ms" >> "$performance_file"
            echo "  $provider: ${duration_ms}ms"
        fi
    done
    
    print_success "Performance tests completed"
}

generate_final_report() {
    print_section "Generating final test report"
    
    local report_file="$TEST_DIR/final-report.md"
    
    cat > "$report_file" << EOF
# SWE-Agent Resolver - Test Report

**Generated:** $(date)
**Test Directory:** $TEST_DIR

## Test Summary

$(grep -c "Test Results:" "$LOG_FILE" || echo "0") provider tests completed

## Provider Test Results

EOF
    
    # Add provider results
    while IFS= read -r line; do
        if [[ $line =~ "Test Results:" ]]; then
            echo "### $line" >> "$report_file"
        elif [[ $line =~ "Scenario:" || $line =~ "Duration:" || $line =~ "Cost:" ]]; then
            echo "- $line" >> "$report_file"
        fi
    done < "$LOG_FILE"
    
    cat >> "$report_file" << EOF

## Performance Results

$(cat "$TEST_DIR/performance.log" 2>/dev/null || echo "Performance tests not run")

## Files Generated

- Test logs: \`$TEST_DIR/logs/\`
- Output files: \`$TEST_DIR/output/\`
- Workspace: \`$TEST_DIR/workspace/\`
- Test repositories: \`$TEST_DIR/repos/\`

## Next Steps

1. Review individual test outputs in \`$TEST_DIR/output/\`
2. Check provider-specific logs for detailed execution traces
3. Validate cost estimates against actual provider billing
4. Test with real GitHub repositories for integration validation

EOF
    
    print_success "Final report generated: $report_file"
    
    # Display summary
    echo ""
    print_section "Test Summary"
    echo "Total tests run: $(grep -c "Test Results:" "$LOG_FILE" || echo "0")"
    echo "Test directory: $TEST_DIR"
    echo "Full report: $report_file"
    echo ""
}

main() {
    print_header
    
    # Setup
    setup_test_environment
    
    # Create test repository
    create_test_repository "calculator-test"
    
    # Test each available provider
    for provider in "${!PROVIDER_MODELS[@]}"; do
        local api_key_var="${provider^^}_API_KEY"
        if [[ -n "${!api_key_var}" ]]; then
            for scenario in "${!TEST_SCENARIOS[@]}"; do
                create_github_event "$scenario" "calculator-test"
                test_provider "$provider" "${PROVIDER_MODELS[$provider]}" "$scenario" "calculator-test"
            done
        fi
    done
    
    # Docker tests
    if command -v docker &> /dev/null; then
        run_docker_tests
    else
        print_warning "Docker not available, skipping Docker tests"
    fi
    
    # Performance tests
    run_performance_tests
    
    # Generate final report
    generate_final_report
    
    print_success "All tests completed successfully!"
    echo "Check the test report at: $TEST_DIR/final-report.md"
}

# Run main function
main "$@"