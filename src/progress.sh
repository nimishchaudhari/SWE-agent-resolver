#!/bin/bash

# src/progress.sh - Progress tracking and status updates
# Manages progress comments and status updates for long-running operations

set -e

# --- Progress Tracking Variables ---
export PROGRESS_COMMENT_ID=""
export PROGRESS_MESSAGE=""

# --- Progress Update Function ---
update_progress() {
    local stage="$1"
    local message="$2"
    local details="${3:-}"
    
    if [ -z "$PROGRESS_COMMENT_ID" ]; then
        return
    fi
    
    local progress_bar=""
    local stage_emoji=""
    local completion_percent=0
    
    case "$stage" in
        "initializing")
            progress_bar="▓░░░░░░░░░"
            stage_emoji="🔧"
            completion_percent=10
            ;;
        "analyzing")
            progress_bar="▓▓▓░░░░░░░"
            stage_emoji="🔍"
            completion_percent=30
            ;;
        "planning")
            progress_bar="▓▓▓▓▓░░░░░"
            stage_emoji="📋"
            completion_percent=50
            ;;
        "implementing")
            progress_bar="▓▓▓▓▓▓▓░░░"
            stage_emoji="⚙️"
            completion_percent=70
            ;;
        "testing")
            progress_bar="▓▓▓▓▓▓▓▓▓░"
            stage_emoji="🧪"
            completion_percent=90
            ;;
        "complete")
            progress_bar="▓▓▓▓▓▓▓▓▓▓"
            stage_emoji="✅"
            completion_percent=100
            ;;
        *)
            progress_bar="▓▓▓░░░░░░░"
            stage_emoji="⏳"
            completion_percent=25
            ;;
    esac
    
    local elapsed_time=""
    local start_time_file="$TEMP_DIR/start_time"
    if [ -f "$start_time_file" ]; then
        local start_time_val=$(cat "$start_time_file")
        local current_time_val=$(date +%s)
        if [[ "$start_time_val" =~ ^[0-9]+$ ]] && [[ "$current_time_val" =~ ^[0-9]+$ ]]; then
            local elapsed_seconds=$((current_time_val - start_time_val))
            local elapsed_minutes=$((elapsed_seconds / 60))
            local remaining_seconds=$((elapsed_seconds % 60))
            if [ "$elapsed_minutes" -gt 0 ]; then
                elapsed_time=" (${elapsed_minutes}m ${remaining_seconds}s)"
            else
                elapsed_time=" (${elapsed_seconds}s)"
            fi
        fi
    fi
    
    local details_section=""
    if [ -n "$details" ]; then
        details_section="

<details>
<summary>📋 Stage Details</summary>

${details}

</details>"
    fi
    
    PROGRESS_MESSAGE="🤖 **SWE-Agent is working on this issue...**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}

## 📊 Progress Status
${progress_bar} ${completion_percent}% Complete${elapsed_time}

${stage_emoji} **${message}**${details_section}

---
*Real-time progress updates • Last updated: $(date -u '+%H:%M:%S UTC')*"
    
    # Source GitHub functions to update comment
    source "$(dirname "${BASH_SOURCE[0]}")/github.sh"
    update_comment "$PROGRESS_COMMENT_ID" "$PROGRESS_MESSAGE"
}

# --- Initial Progress Comment ---
create_initial_progress_comment() {
    local context_emoji="$1"
    local context_description="$2"
    local final_context_mode="$3"
    local context_type="$4"
    local final_response_mode="$5"
    local model_name="$6"
    local git_reference="$7"
    local target_branch="$8"
    local issue_number="$9"
    local issue_title="${10}"
    
    # Source GitHub functions to post comment
    source "$(dirname "${BASH_SOURCE[0]}")/github.sh"
    
    PROGRESS_COMMENT_ID=$(post_comment "${context_emoji} **SWE-Agent is analyzing your request...**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${final_context_mode} (${context_type})
**Request Type:** ${final_response_mode}
**Model:** ${model_name}
**Git Reference:** ${git_reference:0:8}...
**Target Branch:** ${target_branch}

⏳ Setting up environment and determining the best approach...")
    
    log "📝 Created progress comment with ID: $PROGRESS_COMMENT_ID"
}

# --- Context-Aware Initial Reaction ---
add_initial_reaction() {
    local response_mode="$1"
    
    # Source GitHub functions to add reaction
    source "$(dirname "${BASH_SOURCE[0]}")/github.sh"
    
    case "$response_mode" in
        "opinion")
            add_contextual_reaction "success_opinion"
            ;;
        "analysis") 
            add_contextual_reaction "analyzing"
            ;;
        "visual")
            add_contextual_reaction "success_visual"
            ;;
        "pr_review")
            add_contextual_reaction "pr_reviewing"
            ;;
        *)
            add_contextual_reaction "processing"
            ;;
    esac
}

# --- Final Progress Update ---
update_final_progress() {
    local success="$1"
    local response_mode="$2"
    local formatted_response="$3"
    
    # Source GitHub functions
    source "$(dirname "${BASH_SOURCE[0]}")/github.sh"
    
    if [ "$success" = "true" ]; then
        # Update progress comment with final result
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$formatted_response"
        else
            post_comment "$formatted_response"
        fi
        
        # Add success reaction
        case "$response_mode" in
            "opinion")
                add_contextual_reaction "success_opinion"
                ;;
            "analysis")
                add_contextual_reaction "success_analysis"
                ;;
            "visual")
                add_contextual_reaction "success_visual"
                ;;
            "pr_review")
                add_contextual_reaction "success_pr_review"
                ;;
            "patch")
                add_contextual_reaction "success_patch"
                ;;
        esac
        
        log_success "${response_mode} response completed successfully"
    else
        # Update with error message
        local error_message="❌ Failed to generate ${response_mode} response. Please try again or rephrase your request."
        
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$error_message"
        else
            post_comment "$error_message"
        fi
        
        add_contextual_reaction "general_error"
        log_error "Failed to generate ${response_mode} response"
    fi
}

# --- Initialize Progress Tracking ---
initialize_progress_tracking() {
    local initial_message="🤖 **SWE-Agent Processing**

${PROGRESS_BAR} 🔧 Initializing...

**Status:** Starting analysis
**Model:** ${MODEL_NAME}
**Context:** ${FINAL_CONTEXT_MODE:-auto}

*This message will be updated with progress...*"
    
    PROGRESS_COMMENT_ID=$(post_comment "$initial_message")
    log "📊 Progress tracking initialized (Comment ID: $PROGRESS_COMMENT_ID)"
}

# --- Finalize Progress Tracking ---
finalize_progress_tracking() {
    local status="$1"
    local execution_time="$2"
    
    if [ -z "$PROGRESS_COMMENT_ID" ]; then
        return
    fi
    
    local final_message=""
    
    if [ "$status" = "success" ]; then
        final_message="✅ **SWE-Agent Complete**

**Status:** Successfully completed
**Model:** ${MODEL_NAME}
**Execution time:** ${execution_time}s
**Context:** ${FINAL_CONTEXT_MODE:-auto}

Solution has been generated and applied! 🚀"
    else
        final_message="❌ **SWE-Agent Failed**

**Status:** Execution failed
**Model:** ${MODEL_NAME}
**Execution time:** ${execution_time}s
**Context:** ${FINAL_CONTEXT_MODE:-auto}

Please check the workflow logs for error details."
    fi
    
    update_comment "$PROGRESS_COMMENT_ID" "$final_message"
}
