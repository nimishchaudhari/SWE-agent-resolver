#!/bin/bash

# SWE-Agent Test Runner Script
# Comprehensive test execution with reporting and cleanup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$PROJECT_ROOT/test"
REPORTS_DIR="$TEST_ROOT/results"
COVERAGE_DIR="$TEST_ROOT/coverage"

# Default values
TEST_TYPE="all"
VERBOSE=false
CLEANUP=true
PARALLEL=true
TIMEOUT=300000
COVERAGE=false

# Functions
print_header() {
    echo -e "${BLUE}==================================${NC}"
    echo -e "${BLUE}   SWE-Agent Test Suite Runner    ${NC}"
    echo -e "${BLUE}==================================${NC}"
    echo ""
}

print_section() {
    echo -e "${YELLOW}📋 $1${NC}"
    echo "----------------------------------------"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

show_help() {
    cat << EOF
SWE-Agent Test Runner

Usage: $0 [OPTIONS] [TEST_TYPE]

TEST_TYPES:
    all           Run all tests (default)
    unit          Run unit tests only
    integration   Run integration tests only
    e2e           Run end-to-end tests only
    performance   Run performance benchmarks only
    webhooks      Run webhook-specific tests only

OPTIONS:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -c, --coverage  Generate coverage report
    -p, --parallel  Run tests in parallel (default)
    -s, --serial    Run tests serially
    --no-cleanup    Skip cleanup after tests
    --timeout N     Set timeout in milliseconds (default: 300000)
    --setup         Run setup only
    --cleanup       Run cleanup only

EXAMPLES:
    $0                          # Run all tests
    $0 integration              # Run integration tests
    $0 -c -v performance        # Run performance tests with coverage and verbose output
    $0 --setup                  # Setup test environment only
    $0 --cleanup                # Cleanup test environment only

EOF
}

setup_environment() {
    print_section "Setting up test environment"
    
    # Create directories
    mkdir -p "$REPORTS_DIR" "$COVERAGE_DIR"
    
    # Run setup script
    if [ -f "$TEST_ROOT/scripts/setup-tests.js" ]; then
        node "$TEST_ROOT/scripts/setup-tests.js"
    else
        print_warning "Setup script not found, using basic setup"
        export NODE_ENV=test
        export LOG_LEVEL=silent
    fi
    
    print_success "Environment setup completed"
}

cleanup_environment() {
    if [ "$CLEANUP" = true ]; then
        print_section "Cleaning up test environment"
        
        # Clean temp files
        if [ -d "$TEST_ROOT/temp" ]; then
            rm -rf "$TEST_ROOT/temp"
            print_info "Removed temp directory"
        fi
        
        # Clean old reports (keep last 5)
        if [ -d "$REPORTS_DIR" ]; then
            find "$REPORTS_DIR" -name "*.json" -type f | sort -r | tail -n +6 | xargs rm -f 2>/dev/null || true
            print_info "Cleaned old test reports"
        fi
        
        # Run cleanup script
        if [ -f "$TEST_ROOT/scripts/setup-tests.js" ]; then
            node "$TEST_ROOT/scripts/setup-tests.js" cleanup
        fi
        
        print_success "Cleanup completed"
    fi
}

run_jest_tests() {
    local test_pattern="$1"
    local test_name="$2"
    
    print_section "Running $test_name tests"
    
    local jest_args=""
    
    # Add coverage if requested
    if [ "$COVERAGE" = true ]; then
        jest_args="$jest_args --coverage --coverageDirectory=$COVERAGE_DIR"
    fi
    
    # Add parallel/serial execution
    if [ "$PARALLEL" = true ]; then
        jest_args="$jest_args --maxWorkers=4"
    else
        jest_args="$jest_args --runInBand"
    fi
    
    # Add verbose output
    if [ "$VERBOSE" = true ]; then
        jest_args="$jest_args --verbose"
    fi
    
    # Add timeout
    jest_args="$jest_args --testTimeout=$TIMEOUT"
    
    # Add test pattern
    if [ -n "$test_pattern" ]; then
        jest_args="$jest_args --testPathPattern=$test_pattern"
    fi
    
    # Generate unique report file
    local report_file="$REPORTS_DIR/test-results-$(date +%Y%m%d-%H%M%S)-$test_name.json"
    jest_args="$jest_args --outputFile=$report_file --json"
    
    # Run tests
    print_info "Jest command: npx jest $jest_args"
    
    if npx jest $jest_args; then
        print_success "$test_name tests passed"
        
        # Show summary if available
        if [ -f "$report_file" ] && command -v jq > /dev/null; then
            local total_tests=$(jq '.numTotalTests' "$report_file" 2>/dev/null || echo "unknown")
            local passed_tests=$(jq '.numPassedTests' "$report_file" 2>/dev/null || echo "unknown")
            local failed_tests=$(jq '.numFailedTests' "$report_file" 2>/dev/null || echo "unknown")
            print_info "Results: $passed_tests passed, $failed_tests failed, $total_tests total"
        fi
        
        return 0
    else
        print_error "$test_name tests failed"
        
        # Show failure summary if available
        if [ -f "$report_file" ] && command -v jq > /dev/null; then
            local failed_tests=$(jq '.numFailedTests' "$report_file" 2>/dev/null || echo "unknown")
            if [ "$failed_tests" != "0" ] && [ "$failed_tests" != "unknown" ]; then
                print_error "$failed_tests test(s) failed"
                
                # Show failed test names
                jq -r '.testResults[].assertionResults[] | select(.status == "failed") | .title' "$report_file" 2>/dev/null | while read -r test_title; do
                    print_error "  - $test_title"
                done
            fi
        fi
        
        return 1
    fi
}

run_performance_tests() {
    print_section "Running performance benchmarks"
    
    if [ -f "$TEST_ROOT/performance/benchmark-runner.js" ]; then
        if node "$TEST_ROOT/performance/benchmark-runner.js"; then
            print_success "Performance benchmarks completed"
            
            # Find the latest performance report
            local latest_report=$(find "$TEST_ROOT/performance" -name "performance-report-*.json" -type f | sort -r | head -n 1)
            if [ -n "$latest_report" ]; then
                print_info "Performance report: $latest_report"
                
                # Move to reports directory
                local report_name="performance-$(basename "$latest_report")"
                mv "$latest_report" "$REPORTS_DIR/$report_name"
                print_info "Report moved to: $REPORTS_DIR/$report_name"
            fi
            
            return 0
        else
            print_error "Performance benchmarks failed"
            return 1
        fi
    else
        print_error "Performance benchmark script not found"
        return 1
    fi
}

run_specific_tests() {
    local test_type="$1"
    local exit_code=0
    
    case "$test_type" in
        "unit")
            run_jest_tests "unit" "unit" || exit_code=1
            ;;
        "integration")
            run_jest_tests "integration" "integration" || exit_code=1
            ;;
        "e2e")
            run_jest_tests "e2e" "end-to-end" || exit_code=1
            ;;
        "webhooks")
            run_jest_tests "webhook" "webhook" || exit_code=1
            ;;
        "performance")
            run_performance_tests || exit_code=1
            ;;
        "all")
            run_jest_tests "unit" "unit" || exit_code=1
            run_jest_tests "integration" "integration" || exit_code=1
            run_performance_tests || exit_code=1
            ;;
        *)
            print_error "Unknown test type: $test_type"
            exit_code=1
            ;;
    esac
    
    return $exit_code
}

generate_summary_report() {
    print_section "Generating summary report"
    
    local summary_file="$REPORTS_DIR/test-summary-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$summary_file" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "test_type": "$TEST_TYPE",
    "environment": {
        "node_version": "$(node --version)",
        "platform": "$(uname -s)",
        "arch": "$(uname -m)",
        "ci": "${CI:-false}",
        "github_actions": "${GITHUB_ACTIONS:-false}"
    },
    "configuration": {
        "parallel": $PARALLEL,
        "coverage": $COVERAGE,
        "verbose": $VERBOSE,
        "timeout": $TIMEOUT
    },
    "reports_directory": "$REPORTS_DIR",
    "coverage_directory": "$COVERAGE_DIR"
}
EOF
    
    print_success "Summary report generated: $summary_file"
}

show_final_summary() {
    local exit_code="$1"
    
    echo ""
    print_section "Test Execution Summary"
    
    if [ $exit_code -eq 0 ]; then
        print_success "All tests completed successfully! 🎉"
    else
        print_error "Some tests failed! 😞"
    fi
    
    echo ""
    print_info "Test artifacts:"
    
    if [ -d "$REPORTS_DIR" ] && [ "$(ls -A "$REPORTS_DIR" 2>/dev/null)" ]; then
        print_info "  Test reports: $REPORTS_DIR"
        ls -la "$REPORTS_DIR" | tail -n +2 | while read -r line; do
            echo "    $line"
        done
    fi
    
    if [ "$COVERAGE" = true ] && [ -d "$COVERAGE_DIR" ] && [ "$(ls -A "$COVERAGE_DIR" 2>/dev/null)" ]; then
        print_info "  Coverage reports: $COVERAGE_DIR"
        
        # Show coverage summary if available
        local coverage_summary="$COVERAGE_DIR/lcov-report/index.html"
        if [ -f "$coverage_summary" ]; then
            print_info "  Coverage HTML report: $coverage_summary"
        fi
    fi
    
    echo ""
    
    if [ $exit_code -eq 0 ]; then
        print_success "Test execution completed successfully!"
    else
        print_error "Test execution failed with exit code $exit_code"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        -s|--serial)
            PARALLEL=false
            shift
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --setup)
            setup_environment
            exit 0
            ;;
        --cleanup)
            cleanup_environment
            exit 0
            ;;
        *)
            if [[ "$1" =~ ^(all|unit|integration|e2e|performance|webhooks)$ ]]; then
                TEST_TYPE="$1"
            else
                print_error "Unknown option: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# Main execution
main() {
    local exit_code=0
    
    # Trap to ensure cleanup runs
    trap cleanup_environment EXIT
    
    print_header
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Setup
    setup_environment || exit_code=1
    
    if [ $exit_code -eq 0 ]; then
        # Run tests
        run_specific_tests "$TEST_TYPE" || exit_code=1
        
        # Generate summary
        generate_summary_report
    fi
    
    # Show final summary
    show_final_summary $exit_code
    
    exit $exit_code
}

# Run main function
main "$@"