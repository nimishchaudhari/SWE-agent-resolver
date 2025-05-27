#!/bin/bash

# entrypoint-modular.sh - New modular orchestrator for SWE-Agent
# This replaces the monolithic entrypoint.sh with a clean modular architecture

set -e
set -o pipefail

# --- Module Loading ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load all modules in dependency order
source "$SCRIPT_DIR/src/utils.sh"
source "$SCRIPT_DIR/src/config.sh"
source "$SCRIPT_DIR/src/github.sh"
source "$SCRIPT_DIR/src/intent.sh"
source "$SCRIPT_DIR/src/progress.sh"
source "$SCRIPT_DIR/src/ai_api.sh"
source "$SCRIPT_DIR/src/response_formatter.sh"
source "$SCRIPT_DIR/src/swe_agent.sh"

# --- Main Orchestration ---
main() {
    local start_time=$(date +%s)
    local SWE_EXIT_CODE=0
    
    log "🚀 SWE-Agent Issue Resolver (Modular) - Starting..."
    
    # 1. Setup Configuration
    log "⚙️ Setting up configuration..."
    setup_configuration
    validate_configuration || {
        log "❌ Configuration validation failed"
        exit 1
    }
    
    # 2. Initialize Progress Tracking
    log "📊 Initializing progress tracking..."
    initialize_progress_tracking
    
    # 3. Detect Intent and Context
    log "🔍 Detecting intent and context..."
    local intent=$(detect_intent_from_comment)
    log "🎯 Detected intent: $intent"
    
    # 4. Add Initial Reaction
    add_contextual_reaction "processing"
    
    # 5. Create Working Directory
    export TEMP_DIR=$(create_temp_directory)
    log "📁 Working directory: $TEMP_DIR"
    
    # 6. Process Based on Intent
    case "$intent" in
        "patch")
            process_patch_intent
            ;;
        "analysis")
            process_analysis_intent
            ;;
        "opinion")
            process_opinion_intent
            ;;
        "visual")
            process_visual_intent
            ;;
        "pr_review")
            process_pr_review_intent
            ;;
        *)
            log "🤔 Unknown intent: $intent, defaulting to patch mode"
            process_patch_intent
            ;;
    esac
    
    SWE_EXIT_CODE=$?
    
    # 7. Handle Results
    local end_time=$(date +%s)
    local execution_time=$((end_time - start_time))
    
    if [ $SWE_EXIT_CODE -eq 0 ]; then
        handle_success_completion "$execution_time"
    else
        handle_failure_completion "$execution_time" "$SWE_EXIT_CODE"
    fi
    
    # 8. Cleanup
    log "🧹 Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
    
    log "🏁 SWE-Agent Issue Resolver finished"
    exit $SWE_EXIT_CODE
}

# --- Intent Processing Functions ---

process_patch_intent() {
    log "🔧 Processing patch intent..."
    
    # Create problem statement
    local problem_statement_file="$TEMP_DIR/problem_statement.md"
    create_problem_statement "$TEMP_DIR" "$GITHUB_EVENT_ISSUE_TITLE" "$GITHUB_EVENT_ISSUE_BODY" "$GITHUB_EVENT_COMMENT_BODY"
    
    # Run SWE-Agent diagnostics
    run_swe_agent_diagnostics || {
        log "❌ SWE-Agent diagnostics failed"
        return 1
    }
    
    # Execute SWE-Agent
    log "🤖 Executing SWE-Agent..."
    local repo_dir="${GITHUB_WORKSPACE:-/github/workspace}"
    log "📁 Using repository directory: $repo_dir"
    
    # Execute SWE-Agent and capture exit code
    local start_time=$(date +%s)
    execute_swe_agent "$MODEL_NAME" "$repo_dir" "$problem_statement_file" "$TEMP_DIR"
    local swe_exit_code=$?
    local end_time=$(date +%s)
    local execution_time=$((end_time - start_time))
    
    # Process results using the comprehensive function from swe_agent.sh
    local result_message=$(process_swe_agent_results "$swe_exit_code" "$TEMP_DIR" "$execution_time")
    if [ $swe_exit_code -eq 0 ]; then
        post_comment "$result_message"
        add_contextual_reaction "success_patch"
    else
        post_comment "$result_message"
        add_contextual_reaction "general_error"
    fi
    
    return $swe_exit_code
}

process_analysis_intent() {
    log "🔍 Processing analysis intent..."
    
    # Get repository analysis
    local analysis_result=$(get_repository_analysis)
    
    # Format response
    local formatted_response=$(format_analysis_response "$analysis_result")
    
    # Post response
    post_comment "$formatted_response"
    add_contextual_reaction "success_analysis"
    
    return 0
}

process_opinion_intent() {
    log "💭 Processing opinion intent..."
    
    # Get AI opinion
    local opinion_result=$(get_ai_opinion "$GITHUB_EVENT_COMMENT_BODY")
    
    # Format response
    local formatted_response=$(format_opinion_response "$opinion_result")
    
    # Post response
    post_comment "$formatted_response"
    add_contextual_reaction "success_opinion"
    
    return 0
}

process_visual_intent() {
    log "🎨 Processing visual content intent..."
    
    # Generate visual content
    local visual_content=$(generate_visual_content "$GITHUB_EVENT_COMMENT_BODY")
    
    # Format response
    local formatted_response=$(format_visual_response "$visual_content")
    
    # Post response
    post_comment "$formatted_response"
    add_contextual_reaction "success_visual"
    
    return 0
}

process_pr_review_intent() {
    log "📝 Processing PR review intent..."
    
    # Get PR diff and context
    local pr_diff=$(get_pr_diff "$GITHUB_EVENT_NUMBER")
    
    # Generate review
    local review_result=$(generate_pr_review "$pr_diff" "$GITHUB_EVENT_COMMENT_BODY")
    
    # Format response
    local formatted_response=$(format_pr_review_response "$review_result")
    
    # Post response
    post_comment "$formatted_response"
    add_contextual_reaction "success_review"
    
    return 0
}

# --- Result Processing ---
# Using process_swe_agent_results from swe_agent.sh module

handle_success_completion() {
    local execution_time="$1"
    
    log "✅ SWE-Agent completed successfully"
    
    # Set GitHub Actions output
    if [ "$GITHUB_ACTIONS" = "true" ]; then
        echo "execution_time=${execution_time}s" >> $GITHUB_OUTPUT
        echo "status=success" >> $GITHUB_OUTPUT
    fi
    
    # Update progress
    finalize_progress_tracking "success" "$execution_time"
}

handle_failure_completion() {
    local execution_time="$1"
    local exit_code="$2"
    
    log "❌ SWE-Agent failed with exit code: $exit_code"
    
    # Set GitHub Actions output
    if [ "$GITHUB_ACTIONS" = "true" ]; then
        echo "execution_time=${execution_time}s" >> $GITHUB_OUTPUT
        echo "status=failure" >> $GITHUB_OUTPUT
    fi
    
    # Post failure message
    local failure_message="❌ **SWE-Agent Execution Failed**

The SWE-Agent encountered an error during execution.

**Details:**
- Exit code: $exit_code
- Execution time: ${execution_time}s
- Model used: $MODEL_NAME

Please check the workflow logs for detailed error information."
    
    post_comment "$failure_message"
    add_contextual_reaction "general_error"
    
    # Update progress
    finalize_progress_tracking "failure" "$execution_time"
}

# --- Entry Point ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
