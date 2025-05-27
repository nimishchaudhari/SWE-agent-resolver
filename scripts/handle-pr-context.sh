#!/bin/bash

# scripts/handle-pr-context.sh - Handle PR context operations
# Applies patches to existing PRs, manages branch updates, and handles PR feedback

set -e

# Source required modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../src/utils.sh"
source "$SCRIPT_DIR/../src/github.sh"

# Configuration from environment
PATCH_CONTENT="${PATCH_CONTENT}"
PR_NUMBER="${PR_NUMBER}"
MODEL_NAME="${MODEL_NAME:-gpt-4o}"
EXECUTION_TIME="${EXECUTION_TIME}"
COMMENT_ID="${COMMENT_ID}"
GITHUB_TOKEN="${GITHUB_TOKEN}"

# Validate required parameters
if [ -z "$PATCH_CONTENT" ]; then
    log "❌ No patch content provided"
    exit 1
fi

if [ -z "$PR_NUMBER" ]; then
    log "❌ No PR number provided"
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    log "❌ No GitHub token provided"
    exit 1
fi

log "🔄 Applying patch to existing PR #${PR_NUMBER}..."

# Get PR information using GitHub CLI
PR_DATA=$(gh api repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER})
PR_HEAD_REF=$(echo "$PR_DATA" | jq -r '.head.ref')
PR_TITLE=$(echo "$PR_DATA" | jq -r '.title')

log "📋 PR Info: $PR_TITLE (branch: $PR_HEAD_REF)"

# Configure git with bot identity
git config --global user.name "swe-agent-bot[bot]"
git config --global user.email "swe-agent-bot[bot]@users.noreply.github.com"

# Checkout PR branch
log "🔄 Switching to PR branch..."
git fetch origin "$PR_HEAD_REF:$PR_HEAD_REF" || {
    log "❌ Failed to fetch PR branch $PR_HEAD_REF"
    exit 1
}
git checkout "$PR_HEAD_REF" || {
    log "❌ Failed to checkout PR branch $PR_HEAD_REF"
    exit 1
}

# Create temporary patch file
PATCH_FILE="/tmp/swe_agent_fix.patch"
echo "$PATCH_CONTENT" > "$PATCH_FILE"

log "🔧 Applying SWE-Agent patch..."

# Check if patch can be applied cleanly
if git apply --check "$PATCH_FILE" 2>/dev/null; then
    # Apply the patch
    git apply "$PATCH_FILE"
    
    # Commit changes
    git add -A
    git commit -m "🤖 SWE-Agent: Enhance PR based on feedback - Applied fixes using ${MODEL_NAME} - Execution time: ${EXECUTION_TIME} - Co-authored-by: swe-agent-bot[bot] <swe-agent-bot[bot]@users.noreply.github.com>"
    
    # Push changes
    echo "⬆️ Pushing changes to PR branch..."
    git push origin "$PR_HEAD_REF"
    
    # Update comment if we have a comment ID
    if [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "" ]; then
        echo "💬 Updating comment with success message..."
        gh api repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID \
            --method PATCH \
            --field body="✅ **PR Enhanced Successfully!** - 🔄 Applied SWE-Agent fixes to this Pull Request. **Changes applied:** Enhanced based on review feedback, Used model: ${MODEL_NAME}, Execution time: ${EXECUTION_TIME} - The PR branch \`${PR_HEAD_REF}\` has been updated with the improvements. 🚀"
    else
        echo "💬 Posting success comment to PR..."
        gh api repos/$GITHUB_REPOSITORY/issues/${PR_NUMBER}/comments \
            --method POST \
            --field body="✅ **PR Enhanced by SWE-Agent!** - 🔄 Applied automated fixes to this Pull Request. **Changes applied:** Enhanced based on feedback, Used model: ${MODEL_NAME}, Execution time: ${EXECUTION_TIME} - The PR branch \`${PR_HEAD_REF}\` has been updated with the improvements. 🚀"
    fi
    
    echo "✅ PR enhancement complete!"
    
else
    echo "❌ Patch could not be applied cleanly - posting for manual review"
    
    # Post patch for manual review
    if [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "" ]; then
        gh api repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID \
            --method PATCH \
            --field body="⚠️ **Patch Generated but Requires Manual Application** - The SWE-Agent generated a fix, but it conflicts with recent changes in the PR. Please apply the patch manually or resolve conflicts before merging. View patch details in the workflow logs."
    else
        gh api repos/$GITHUB_REPOSITORY/issues/${PR_NUMBER}/comments \
            --method POST \
            --field body="⚠️ **Patch Generated but Requires Manual Application** - The SWE-Agent generated a fix, but it conflicts with recent changes. Please apply the patch manually or resolve conflicts. View patch details in the workflow logs."
    fi
    
    exit 1
fi
