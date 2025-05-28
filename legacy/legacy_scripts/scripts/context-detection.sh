#!/bin/bash

# scripts/context-detection.sh - Context detection and initialization for GitHub events
# Detects whether we're in PR, issue, review context and extracts relevant information

set -e

# Source utility functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../src/utils.sh"

# Initialize variables
CONTEXT_TYPE=""
COMMENT_BODY=""
COMMENT_ID=""
ISSUE_NUMBER=""
ISSUE_TITLE=""
ISSUE_BODY=""
PR_NUMBER=""

log "🔍 Detecting GitHub event context..."
log "Event name: $GITHUB_EVENT_NAME"

# Detect context based on GitHub event
case "$GITHUB_EVENT_NAME" in
    "issue_comment")
        if [ -n "$ISSUE_PR_URL" ] && [ "$ISSUE_PR_URL" != "null" ]; then
            # This is a comment on a PR issue
            CONTEXT_TYPE="pr_comment"
            PR_NUMBER=$(echo "$ISSUE_PR_URL" | grep -o '[0-9]*$')
            log "📋 Detected: PR comment context (PR #$PR_NUMBER)"
        else
            # This is a regular issue comment
            CONTEXT_TYPE="issue_comment"
            ISSUE_NUMBER="$ISSUE_NUMBER"
            log "📋 Detected: Issue comment context (Issue #$ISSUE_NUMBER)"
        fi
        COMMENT_BODY="$COMMENT_BODY"
        COMMENT_ID="$COMMENT_ID"
        ISSUE_TITLE="$ISSUE_TITLE"
        ISSUE_BODY="$ISSUE_BODY"
        ;;
    "pull_request_review_comment")
        CONTEXT_TYPE="pr_review_comment"
        PR_NUMBER="$PR_NUMBER"
        COMMENT_BODY="$COMMENT_BODY"
        COMMENT_ID="$COMMENT_ID"
        log "📋 Detected: PR review comment context (PR #$PR_NUMBER)"
        ;;
    "pull_request_review")
        CONTEXT_TYPE="pr_review"
        PR_NUMBER="$PR_NUMBER"
        COMMENT_BODY="$REVIEW_BODY"
        COMMENT_ID="$REVIEW_ID"
        log "📋 Detected: PR review context (PR #$PR_NUMBER)"
        ;;
    "pull_request")
        CONTEXT_TYPE="pr_description"
        PR_NUMBER="$PR_NUMBER"
        COMMENT_BODY="$PR_BODY"
        ISSUE_TITLE="$PR_TITLE"
        ISSUE_BODY="$PR_BODY"
        log "📋 Detected: PR description context (PR #$PR_NUMBER)"
        ;;
    *)
        log "❌ Unknown event type: $GITHUB_EVENT_NAME"
        exit 1
        ;;
esac

# Set GitHub Actions outputs
if [ "$GITHUB_ACTIONS" = "true" ]; then
    echo "context_type=$CONTEXT_TYPE" >> $GITHUB_OUTPUT
    echo "comment_body=$COMMENT_BODY" >> $GITHUB_OUTPUT
    echo "comment_id=$COMMENT_ID" >> $GITHUB_OUTPUT
    echo "issue_number=$ISSUE_NUMBER" >> $GITHUB_OUTPUT
    echo "issue_title=$ISSUE_TITLE" >> $GITHUB_OUTPUT
    echo "issue_body=$ISSUE_BODY" >> $GITHUB_OUTPUT
    echo "pr_number=$PR_NUMBER" >> $GITHUB_OUTPUT
fi

# Export for use by other scripts
export DETECTED_CONTEXT_TYPE="$CONTEXT_TYPE"
export DETECTED_COMMENT_BODY="$COMMENT_BODY"
export DETECTED_COMMENT_ID="$COMMENT_ID"
export DETECTED_ISSUE_NUMBER="$ISSUE_NUMBER"
export DETECTED_ISSUE_TITLE="$ISSUE_TITLE"
export DETECTED_ISSUE_BODY="$ISSUE_BODY"
export DETECTED_PR_NUMBER="$PR_NUMBER"

log "✅ Context detection complete: $CONTEXT_TYPE"
