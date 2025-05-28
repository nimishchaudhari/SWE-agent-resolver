#!/bin/bash

# scripts/handle-issue-context.sh - Handle issue context operations
# Creates new PRs from issues, manages branch creation, and handles issue feedback

set -e

# Source required modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../src/utils.sh"
source "$SCRIPT_DIR/../src/github.sh"

# Configuration from environment
PATCH_CONTENT="${PATCH_CONTENT}"
ISSUE_NUMBER="${ISSUE_NUMBER}"
ISSUE_TITLE="${ISSUE_TITLE}"
MODEL_NAME="${MODEL_NAME:-gpt-4o}"
EXECUTION_TIME="${EXECUTION_TIME}"
COMMENT_ID="${COMMENT_ID}"
GITHUB_TOKEN="${GITHUB_TOKEN}"

# Validate required parameters
if [ -z "$PATCH_CONTENT" ]; then
    log "❌ No patch content provided"
    exit 1
fi

if [ -z "$ISSUE_NUMBER" ]; then
    log "❌ No issue number provided"
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    log "❌ No GitHub token provided"
    exit 1
fi

log "🆕 Creating new PR for issue #${ISSUE_NUMBER}..."

# Configure git with bot identity
git config --global user.name "swe-agent-bot[bot]"
git config --global user.email "swe-agent-bot[bot]@users.noreply.github.com"

# Create a unique branch name
BRANCH_NAME="swe-agent/fix-issue-${ISSUE_NUMBER}-$(date +%s)"
log "🌟 Creating branch: $BRANCH_NAME"

# Create and checkout new branch from main
git checkout main
git pull origin main
git checkout -b "$BRANCH_NAME"

# Create temporary patch file
PATCH_FILE="/tmp/swe_agent_fix.patch"
echo "$PATCH_CONTENT" > "$PATCH_FILE"

log "🔧 Applying SWE-Agent patch..."

if git apply --check /tmp/swe_agent_fix.patch; then
    git apply /tmp/swe_agent_fix.patch
    
    # Commit changes
    git add -A
    git commit -m "🤖 Fix: $ISSUE_TITLE - Resolves #${ISSUE_NUMBER} - Applied automated fixes using ${MODEL_NAME} - Execution time: ${EXECUTION_TIME} - Co-authored-by: swe-agent-bot[bot] <swe-agent-bot[bot]@users.noreply.github.com>"
    
    # Push branch
    echo "⬆️ Pushing new branch..."
    git push origin "$BRANCH_NAME"
    
    # Create PR
    DEFAULT_BRANCH=$(gh api repos/$GITHUB_REPOSITORY --jq .default_branch)
    PR_TITLE="🤖 Fix: $ISSUE_TITLE"
    PR_BODY="🤖 Automated Fix by SWE-Agent - This PR was automatically generated to resolve issue #${ISSUE_NUMBER}. Changes Made: Applied automated fixes using ${MODEL_NAME}, Execution time: ${EXECUTION_TIME}. Related Issue: Fixes #${ISSUE_NUMBER}. This PR was automatically created by SWE-Agent AIO Resolver."
    
    echo "🔗 Creating pull request..."
    PR_URL=$(gh pr create --title "$PR_TITLE" --body "$PR_BODY" --base "$DEFAULT_BRANCH" --head "$BRANCH_NAME")
    
    # Update issue comment
    echo "💬 Updating issue comment with PR link..."
    gh api repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID \
        --method PATCH \
        --field body="✅ **Solution Generated & Pull Request Created!** - 🆕 Created a new Pull Request to resolve this issue. **[View Pull Request](${PR_URL})** **Summary:** Branch: \`${BRANCH_NAME}\`, Model: ${MODEL_NAME}, Execution time: ${EXECUTION_TIME} - The PR is ready for review! 🚀"
    
    echo "✅ PR creation complete!"
    
else
    echo "❌ Patch could not be applied cleanly"
    
    # Update comment with error
    gh api repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID \
        --method PATCH \
        --field body="❌ **Patch Generation Failed** - SWE-Agent generated a fix but encountered conflicts when trying to apply it. Please review and apply the patch manually. View patch details in the workflow logs."
    
    exit 1
fi
