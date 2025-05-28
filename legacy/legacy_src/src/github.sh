#!/bin/bash

# src/github.sh - GitHub API and context management
# Handles GitHub API interactions, context detection, and comment management

set -e

# --- GitHub API Functions ---
post_comment() {
    local message="$1"
    local json_payload=$(jq -n --arg body "$message" '{body: $body}')
    
    local response=$(curl -s -X POST \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER}/comments" \
        -d "$json_payload")
    
    if [ $? -eq 0 ]; then
        # Extract comment ID for future updates
        echo "$response" | jq -r '.id'
    else
        log_error "Failed to post comment to GitHub"
        echo ""
    fi
}

update_comment() {
    local comment_id="$1"
    local message="$2"
    local json_payload=$(jq -n --arg body "$message" '{body: $body}')
    
    curl -s -X PATCH \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/issues/comments/${comment_id}" \
        -d "$json_payload" > /dev/null
    
    if [ $? -ne 0 ]; then
        log_warning "Failed to update comment on GitHub"
    fi
}

add_reaction() {
    local reaction="$1"
    
    curl -s -X POST \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/issues/comments/${COMMENT_ID}/reactions" \
        -d "{\"content\": \"$reaction\"}" > /dev/null
    
    if [ $? -ne 0 ]; then
        log_warning "Failed to add reaction to GitHub comment"
    fi
}

# --- Enhanced Reaction System ---
add_contextual_reaction() {
    local context="$1"
    local reaction=""
    
    case "$context" in
        "success_patch")
            reaction="rocket"
            ;;
        "success_analysis")
            reaction="mag"
            ;;
        "success_opinion")
            reaction="bulb"
            ;;
        "success_visual")
            reaction="chart_with_upwards_trend"
            ;;
        "success_pr_review")
            reaction="white_check_mark"
            ;;
        "pr_review_approved")
            reaction="heavy_check_mark"
            ;;
        "pr_review_changes_requested")
            reaction="x"
            ;;
        "pr_review_suggestions")
            reaction="eyes"
            ;;
        "timeout")
            reaction="hourglass_flowing_sand"
            ;;
        "killed")
            reaction="skull_and_crossbones"
            ;;
        "api_error")
            reaction="warning"
            ;;
        "general_error")
            reaction="confused"
            ;;
        "processing")
            reaction="eyes"
            ;;
        "analyzing")
            reaction="mag"
            ;;
        "pr_reviewing")
            reaction="mag_right"
            ;;
        *)
            reaction="thinking_face"
            ;;
    esac
    
    add_reaction "$reaction"
}

# --- Context Detection Functions ---

# Extract comprehensive GitHub context from environment
extract_enhanced_github_context() {
    # Source the context detection script for detailed logic
    source "$(dirname "${BASH_SOURCE[0]}")/../scripts/context-detection.sh"
    
    # Call the main context extraction function
    extract_github_context
}

# Detect GitHub event context
detect_github_context() {
    # Determine context based on available GitHub event data
    if [ -n "$GITHUB_EVENT_PULL_REQUEST_NUMBER" ]; then
        if [ -n "$GITHUB_EVENT_REVIEW_BODY" ]; then
            echo "pr_review_comment"
        elif [ -n "$GITHUB_EVENT_COMMENT_BODY" ]; then
            echo "pr_comment"
        else
            echo "pull_request"
        fi
    elif [ -n "$GITHUB_EVENT_ISSUE_NUMBER" ]; then
        echo "issue_comment"
    else
        echo "unknown"
    fi
}

# Determine Git reference based on context
determine_git_reference() {
    local context_mode="$1"
    local reference_mode="$2"
    local git_ref="HEAD"
    
    case "$reference_mode" in
        "auto")
            case "$context_mode" in
                "pr_review"|"pr_review_comment"|"pr_comment"|"pull_request")
                    git_ref="${GITHUB_EVENT_PULL_REQUEST_HEAD_SHA:-HEAD}"
                    ;;
                *)
                    git_ref="${GITHUB_SHA:-HEAD}"
                    ;;
            esac
            ;;
        "pr_head")
            git_ref="${GITHUB_EVENT_PULL_REQUEST_HEAD_SHA:-HEAD}"
            ;;
        "pr_base")
            git_ref="${GITHUB_EVENT_PULL_REQUEST_BASE_SHA:-HEAD}"
            ;;
        "latest")
            git_ref="HEAD"
            ;;
        *)
            git_ref="$reference_mode"  # Custom reference
            ;;
    esac
    
    echo "$git_ref"
}

# Determine target branch for operations
determine_target_branch() {
    local context_mode="$1"
    local branch_strategy="$2"
    local target_branch="main"
    
    case "$branch_strategy" in
        "auto")
            case "$context_mode" in
                "pr_review"|"pr_review_comment"|"pr_comment"|"pull_request")
                    target_branch="${GITHUB_EVENT_PULL_REQUEST_BASE_REF:-main}"
                    ;;
                *)
                    target_branch="${GITHUB_BASE_REF:-main}"
                    ;;
            esac
            ;;
        "pr_base")
            target_branch="${GITHUB_EVENT_PULL_REQUEST_BASE_REF:-main}"
            ;;
        "default")
            target_branch="main"
            ;;
        *)
            target_branch="$branch_strategy"  # Custom branch
            ;;
    esac
    
    echo "$target_branch"
}

# Validate context configuration
validate_context() {
    local context_mode="$1"
    local git_reference="$2"
    
    # Check for required context variables
    local validation_warnings=()
    local validation_errors=()
    
    case "$context_mode" in
        "pr_review"|"pr_review_comment"|"pr_comment"|"pull_request")
            if [ -z "$GITHUB_EVENT_PULL_REQUEST_NUMBER" ]; then
                validation_warnings+=("PR context detected but no PR number available")
            fi
            ;;
        "issue_comment")
            if [ -z "$GITHUB_EVENT_ISSUE_NUMBER" ]; then
                validation_warnings+=("Issue context detected but no issue number available")
            fi
            ;;
        "unknown")
            validation_warnings+=("Unknown context mode - proceeding with defaults")
            ;;
    esac
    
    # Validate Git reference
    if [ -z "$git_reference" ] || [ "$git_reference" = "null" ]; then
        validation_warnings+=("No Git reference specified - using HEAD")
    fi
    
    # Report results
    if [ ${#validation_errors[@]} -gt 0 ]; then
        log_error "Context validation failed:"
        for error in "${validation_errors[@]}"; do
            log_error "  - $error"
        done
        return 1
    fi
    
    if [ ${#validation_warnings[@]} -gt 0 ]; then
        log_warning "Context validation warnings:"
        for warning in "${validation_warnings[@]}"; do
            log_warning "  - $warning"
        done
        return 2
    fi
    
    return 0
}

# Log comprehensive context information
log_context_info() {
    local context_mode="$1"
    local git_reference="$2"
    local target_branch="$3"
    
    log "📊 GitHub Context Information:"
    log "  - Context Mode: $context_mode"
    log "  - Git Reference: ${git_reference:0:8}..."
    log "  - Target Branch: $target_branch"
    log "  - Repository: $GITHUB_REPOSITORY"
    
    if [ -n "$GITHUB_EVENT_PULL_REQUEST_NUMBER" ]; then
        log "  - PR Number: $GITHUB_EVENT_PULL_REQUEST_NUMBER"
    fi
    
    if [ -n "$GITHUB_EVENT_ISSUE_NUMBER" ]; then
        log "  - Issue Number: $GITHUB_EVENT_ISSUE_NUMBER"
    fi
}

# --- Repository Operations ---
clone_repository() {
    local repo_url="$1"
    local repo_dir="$2"
    
    log "📥 Cloning repository..."
    if ! git clone "$repo_url" "$repo_dir"; then
        log_error "Failed to clone repository"
        return 1
    fi
    
    log_success "Repository cloned to $repo_dir"
    return 0
}

setup_git_context() {
    local repo_dir="$1"
    local context_mode="$2"
    local git_reference="$3"
    
    cd "$repo_dir"
    log "🔧 Setting up Git context for: $context_mode"
    
    case "$context_mode" in
        "pr_review"|"pr_review_comment"|"pr_comment"|"pull_request")
            # For PR contexts, checkout the PR head branch
            if [ -n "$GITHUB_EVENT_PULL_REQUEST_HEAD_REF" ]; then
                log "🌿 Checking out PR branch: $GITHUB_EVENT_PULL_REQUEST_HEAD_REF"
                if git fetch origin "$GITHUB_EVENT_PULL_REQUEST_HEAD_REF:$GITHUB_EVENT_PULL_REQUEST_HEAD_REF" 2>/dev/null; then
                    git checkout "$GITHUB_EVENT_PULL_REQUEST_HEAD_REF"
                else
                    log_warning "Could not fetch PR branch, using HEAD SHA"
                    git checkout "$git_reference" 2>/dev/null || git checkout HEAD
                fi
            elif [ -n "$git_reference" ] && [ "$git_reference" != "HEAD" ]; then
                log "📍 Checking out specific commit: $git_reference"
                git checkout "$git_reference" 2>/dev/null || git checkout HEAD
            fi
            ;;
        "issue_comment"|*)
            # For issue contexts, stay on default branch but ensure we're at the right commit
            if [ -n "$git_reference" ] && [ "$git_reference" != "HEAD" ]; then
                log "📍 Checking out commit: $git_reference"
                git checkout "$git_reference" 2>/dev/null || git checkout HEAD
            fi
            ;;
    esac
    
    # Display current Git status
    local current_branch=$(git branch --show-current 2>/dev/null || echo "detached")
    local current_commit=$(git rev-parse --short HEAD)
    log "📊 Git Status: branch=$current_branch, commit=$current_commit"
    
    # Export for use by other modules
    export CURRENT_BRANCH="$current_branch"
    export CURRENT_COMMIT="$current_commit"
}
