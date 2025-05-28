#!/bin/bash

# PR Operations Helper Script for SWE-Agent AIO
# This script handles PR-related operations like applying patches and updating comments

set -e

# Configuration
SCRIPT_NAME="$(basename "$0")"

# Functions
log() {
    echo "[$SCRIPT_NAME] $1"
}

error() {
    echo "[$SCRIPT_NAME] ERROR: $1" >&2
    exit 1
}

apply_patch_to_pr() {
    local patch_content="$1"
    local pr_number="$2"
    local model_name="$3"
    local execution_time="$4"
    local comment_id="$5"
    local repository="$6"
    
    log "🔄 Applying patch to existing PR #${pr_number}..."
    
    # Get PR information
    local pr_data
    pr_data=$(gh api "repos/${repository}/pulls/${pr_number}")
    local pr_head_ref
    pr_head_ref=$(echo "$pr_data" | jq -r '.head.ref')
    local pr_title
    pr_title=$(echo "$pr_data" | jq -r '.title')
    
    log "📋 PR Info: $pr_title (branch: $pr_head_ref)"
    
    # Configure git
    git config --global user.name "swe-agent-bot[bot]"
    git config --global user.email "swe-agent-bot[bot]@users.noreply.github.com"
    
    # Checkout PR branch
    log "🔄 Switching to PR branch..."
    git fetch origin "$pr_head_ref:$pr_head_ref"
    git checkout "$pr_head_ref"
    
    # Apply patch
    log "🔧 Applying SWE-Agent patch..."
    echo "$patch_content" > /tmp/swe_agent_fix.patch
    
    if git apply --check /tmp/swe_agent_fix.patch; then
        git apply /tmp/swe_agent_fix.patch
        
        # Commit changes
        git add -A
        git commit -m "🤖 SWE-Agent: Enhance PR based on feedback - Applied fixes using ${model_name} - Execution time: ${execution_time} - Co-authored-by: swe-agent-bot[bot] <swe-agent-bot[bot]@users.noreply.github.com>"
        
        # Push changes
        log "⬆️ Pushing changes to PR branch..."
        git push origin "$pr_head_ref"
        
        # Update comment if we have a comment ID
        if [ -n "$comment_id" ] && [ "$comment_id" != "" ]; then
            log "💬 Updating comment with success message..."
            gh api "repos/${repository}/issues/comments/${comment_id}" \
                --method PATCH \
                --field body="✅ **PR Enhanced Successfully!** - 🔄 Applied SWE-Agent fixes to this Pull Request. **Changes applied:** Enhanced based on review feedback, Used model: ${model_name}, Execution time: ${execution_time} - The PR branch \`${pr_head_ref}\` has been updated with the improvements. 🚀"
        else
            log "💬 Posting success comment to PR..."
            gh api "repos/${repository}/issues/${pr_number}/comments" \
                --method POST \
                --field body="✅ **PR Enhanced by SWE-Agent!** - 🔄 Applied automated fixes to this Pull Request. **Changes applied:** Enhanced based on feedback, Used model: ${model_name}, Execution time: ${execution_time} - The PR branch \`${pr_head_ref}\` has been updated with the improvements. 🚀"
        fi
        
        log "✅ PR enhancement complete!"
        return 0
        
    else
        log "❌ Patch could not be applied cleanly - posting for manual review"
        
        # Post patch for manual review
        if [ -n "$comment_id" ] && [ "$comment_id" != "" ]; then
            gh api "repos/${repository}/issues/comments/${comment_id}" \
                --method PATCH \
                --field body="⚠️ **Patch Generated but Requires Manual Application** - The SWE-Agent generated a fix, but it conflicts with recent changes in the PR. Please apply the patch manually or resolve conflicts before merging. View patch details in the workflow logs."
        else
            gh api "repos/${repository}/issues/${pr_number}/comments" \
                --method POST \
                --field body="⚠️ **Patch Generated but Requires Manual Application** - The SWE-Agent generated a fix, but it conflicts with recent changes. Please apply the patch manually or resolve conflicts. View patch details in the workflow logs."
        fi
        
        return 1
    fi
}

create_new_pr() {
    local patch_content="$1"
    local issue_number="$2"
    local issue_title="$3"
    local model_name="$4"
    local execution_time="$5"
    local comment_id="$6"
    local repository="$7"
    
    log "🆕 Creating new PR for issue #${issue_number}..."
    
    # Configure git
    git config --global user.name "swe-agent-bot[bot]"
    git config --global user.email "swe-agent-bot[bot]@users.noreply.github.com"
    
    # Create new branch
    local branch_name="swe-agent-fix-issue-${issue_number}-$(date +%s)"
    log "🌿 Creating branch: $branch_name"
    git checkout -b "$branch_name"
    
    # Apply patch
    log "🔧 Applying SWE-Agent patch..."
    echo "$patch_content" > /tmp/swe_agent_fix.patch
    
    if git apply --check /tmp/swe_agent_fix.patch; then
        git apply /tmp/swe_agent_fix.patch
        
        # Commit changes
        git add -A
        git commit -m "🤖 Fix: $issue_title - Resolves #${issue_number} - Applied automated fixes using ${model_name} - Execution time: ${execution_time} - Co-authored-by: swe-agent-bot[bot] <swe-agent-bot[bot]@users.noreply.github.com>"
        
        # Push branch
        log "⬆️ Pushing new branch..."
        git push origin "$branch_name"
        
        # Create PR
        local default_branch
        default_branch=$(gh api "repos/${repository}" --jq .default_branch)
        local pr_title="🤖 Fix: $issue_title"
        local pr_body="🤖 Automated Fix by SWE-Agent - This PR was automatically generated to resolve issue #${issue_number}. Changes Made: Applied automated fixes using ${model_name}, Execution time: ${execution_time}. Related Issue: Fixes #${issue_number}. This PR was automatically created by SWE-Agent AIO Resolver."
        
        log "🔗 Creating pull request..."
        local pr_url
        pr_url=$(gh pr create --title "$pr_title" --body "$pr_body" --base "$default_branch" --head "$branch_name")
        
        # Update issue comment
        log "💬 Updating issue comment with PR link..."
        gh api "repos/${repository}/issues/comments/${comment_id}" \
            --method PATCH \
            --field body="✅ **Solution Generated & Pull Request Created!** - 🆕 Created a new Pull Request to resolve this issue. **[View Pull Request](${pr_url})** **Summary:** Branch: \`${branch_name}\`, Model: ${model_name}, Execution time: ${execution_time} - The PR is ready for review! 🚀"
        
        log "✅ PR creation complete!"
        return 0
        
    else
        log "❌ Patch could not be applied cleanly"
        
        # Update comment with error
        gh api "repos/${repository}/issues/comments/${comment_id}" \
            --method PATCH \
            --field body="❌ **Patch Generation Failed** - SWE-Agent generated a fix but encountered conflicts when trying to apply it. Please review and apply the patch manually. View patch details in the workflow logs."
        
        return 1
    fi
}

# Main execution
case "${1:-}" in
    "apply-patch")
        apply_patch_to_pr "$2" "$3" "$4" "$5" "$6" "$7"
        ;;
    "create-pr")
        create_new_pr "$2" "$3" "$4" "$5" "$6" "$7" "$8"
        ;;
    *)
        echo "Usage: $0 {apply-patch|create-pr} [arguments...]"
        echo ""
        echo "Commands:"
        echo "  apply-patch <patch_content> <pr_number> <model_name> <execution_time> <comment_id> <repository>"
        echo "  create-pr <patch_content> <issue_number> <issue_title> <model_name> <execution_time> <comment_id> <repository>"
        exit 1
        ;;
esac
