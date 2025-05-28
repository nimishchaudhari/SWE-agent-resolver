#!/bin/bash

# test/context-test.sh - Context detection testing script
# Specifically tests the context detection logic with various scenarios

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

# Test context detection scenarios
test_context_scenarios() {
    cd "$PROJECT_ROOT"
    
    local temp_output="/tmp/github_output_context_test_$$"
    local scenarios=(
        "issue_comment|Issue #1|@swe-agent fix this|123|1|Test Issue|Fix this bug"
        "pull_request_review_comment|PR #2|@swe-agent review this|456|2|Test PR|Review needed"
        "pull_request_review|PR #3|@swe-agent looks good|789|3|Another PR|Great work"
    )
    
    for scenario in "${scenarios[@]}"; do
        IFS='|' read -r event_name context_name comment_body comment_id number title body <<< "$scenario"
        
        log "Testing scenario: $context_name"
        
        # Set up environment
        export GITHUB_EVENT_NAME="$event_name"
        export GITHUB_ACTOR="test-user"
        export COMMENT_BODY="$comment_body"
        export COMMENT_ID="$comment_id"
        export GITHUB_ACTIONS="true"
        export GITHUB_OUTPUT="$temp_output"
        
        if [[ "$event_name" == "issue_comment" ]]; then
            export ISSUE_NUMBER="$number"
            export ISSUE_TITLE="$title"
            export ISSUE_BODY="$body"
            export ISSUE_PR_URL=""
        else
            export PR_NUMBER="$number"
            export PR_TITLE="$title"
            export PR_BODY="$body"
            export ISSUE_PR_URL="https://api.github.com/repos/test/test/pulls/$number"
        fi
        
        # Create output file
        touch "$temp_output"
        
        # Run context detection
        if ! ./scripts/context-detection.sh; then
            log_error "Context detection failed for: $context_name"
            rm -f "$temp_output"
            return 1
        fi
        
        # Check if appropriate outputs were generated
        if [[ ! -s "$temp_output" ]]; then
            log_error "No outputs generated for: $context_name"
            rm -f "$temp_output"
            return 1
        fi
        
        log_success "Context detection successful for: $context_name"
        
        # Clean up for next iteration
        rm -f "$temp_output"
        unset GITHUB_EVENT_NAME GITHUB_ACTOR COMMENT_BODY COMMENT_ID ISSUE_NUMBER ISSUE_TITLE ISSUE_BODY PR_NUMBER PR_TITLE PR_BODY ISSUE_PR_URL GITHUB_ACTIONS GITHUB_OUTPUT
    done
    
    return 0
}

# Test edge cases
test_edge_cases() {
    cd "$PROJECT_ROOT"
    
    log "Testing edge cases..."
    
    # Test with empty environment
    if ./scripts/context-detection.sh 2>/dev/null; then
        log_error "Script should fail with empty environment"
        return 1
    fi
    
    log_success "Empty environment handled correctly"
    
    # Test with unknown event type
    export GITHUB_EVENT_NAME="unknown_event"
    if ./scripts/context-detection.sh 2>/dev/null; then
        log_error "Script should fail with unknown event type"
        unset GITHUB_EVENT_NAME
        return 1
    fi
    
    log_success "Unknown event type handled correctly"
    unset GITHUB_EVENT_NAME
    
    return 0
}

main() {
    log "🔍 Starting Context Detection Tests"
    
    if test_context_scenarios && test_edge_cases; then
        log_success "🎉 All context detection tests passed!"
        exit 0
    else
        log_error "💥 Some context detection tests failed!"
        exit 1
    fi
}

main "$@"
