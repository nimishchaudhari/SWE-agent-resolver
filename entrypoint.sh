#!/bin/bash

set -e

# --- Configuration ---
GITHUB_TOKEN="${INPUT_GITHUB_TOKEN}"
TRIGGER_PHRASE="${INPUT_TRIGGER_PHRASE:-@swe-agent}"
LLM_API_KEY="${INPUT_LLM_API_KEY}"
MODEL_NAME="${INPUT_MODEL_NAME:-gpt-4o}"
TIMEOUT_MINUTES="${INPUT_TIMEOUT_MINUTES:-30}"

# GitHub API URL
GITHUB_API_URL="${GITHUB_API_URL:-https://api.github.com}"

# --- Utility Functions ---
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

post_comment() {
    local message="$1"
    local json_payload=$(jq -n --arg body "$message" '{body: $body}')
    
    curl -s -X POST \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER}/comments" \
        -d "$json_payload" > /dev/null
    
    if [ $? -ne 0 ]; then
        log "⚠️ Failed to post comment to GitHub"
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
        log "⚠️ Failed to add reaction to GitHub comment"
    fi
}

# --- Main Execution ---
log "🚀 SWE-Agent Issue Resolver started"

# Parse GitHub event
EVENT_PATH="${GITHUB_EVENT_PATH}"
if [ ! -f "$EVENT_PATH" ]; then
    log "❌ GitHub event file not found"
    exit 1
fi

# Extract comment details
COMMENT_BODY=$(jq -r '.comment.body' "$EVENT_PATH")
COMMENT_ID=$(jq -r '.comment.id' "$EVENT_PATH")
ISSUE_NUMBER=$(jq -r '.issue.number' "$EVENT_PATH")
ISSUE_TITLE=$(jq -r '.issue.title' "$EVENT_PATH")
ISSUE_BODY=$(jq -r '.issue.body // ""' "$EVENT_PATH")
REPO_URL=$(jq -r '.repository.clone_url' "$EVENT_PATH")

# Validate extracted data
if [ -z "$COMMENT_BODY" ] || [ "$COMMENT_BODY" == "null" ]; then
    log "❌ Could not extract comment body"
    exit 1
fi

if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" == "null" ]; then
    log "❌ Could not extract issue number"
    exit 1
fi

# Check if comment contains trigger phrase
if [[ "$COMMENT_BODY" != *"$TRIGGER_PHRASE"* ]]; then
    log "🔍 Comment doesn't contain trigger phrase '$TRIGGER_PHRASE'"
    exit 0
fi

log "✅ Trigger phrase found. Processing issue #$ISSUE_NUMBER"
log "📋 Issue: $ISSUE_TITLE"

# Add eyes reaction to show we're processing
add_reaction "eyes"

# Set up API keys for SWE-Agent
export OPENAI_API_KEY="$LLM_API_KEY"
export ANTHROPIC_API_KEY="$LLM_API_KEY"

# Create temporary directories
TEMP_DIR="/tmp/swe_agent_$(date +%s)"
REPO_DIR="$TEMP_DIR/repo"
OUTPUT_DIR="$TEMP_DIR/output"
mkdir -p "$REPO_DIR" "$OUTPUT_DIR"

# Clone repository
log "📥 Cloning repository..."
if ! git clone "$REPO_URL" "$REPO_DIR"; then
    log "❌ Failed to clone repository"
    post_comment "❌ Failed to clone repository. Please check permissions."
    add_reaction "confused"
    exit 1
fi

cd "$REPO_DIR"

# Create problem statement file
PROBLEM_STATEMENT_FILE="$OUTPUT_DIR/problem_statement.md"
cat > "$PROBLEM_STATEMENT_FILE" << EOF
# Issue: $ISSUE_TITLE

## Problem Description
$ISSUE_BODY

## User Request
$COMMENT_BODY

## Task
Please analyze and fix this issue in the repository.
EOF

log "🤖 Running SWE-Agent with model: $MODEL_NAME"

# Validate timeout (minimum 5 minutes for SWE-Agent to work effectively)
if [ "$TIMEOUT_MINUTES" -lt 5 ]; then
    log "⚠️ Timeout too short ($TIMEOUT_MINUTES min), setting to 5 minutes minimum"
    TIMEOUT_MINUTES=5
fi

# Execute SWE-Agent with correct 1.0+ command format
timeout "${TIMEOUT_MINUTES}m" sweagent run \
    --agent.model.name "$MODEL_NAME" \
    --agent.model.per_instance_cost_limit 2.0 \
    --env.repo.path "$REPO_DIR" \
    --problem_statement.path "$PROBLEM_STATEMENT_FILE" \
    --output_dir "$OUTPUT_DIR" \
    --config /app/swe-agent/config/default.yaml \
    > "$OUTPUT_DIR/swe_agent.log" 2>&1

SWE_EXIT_CODE=$?

if [ $SWE_EXIT_CODE -eq 0 ]; then
    log "✅ SWE-Agent completed successfully"
    
    # Look for patches in SWE-Agent 1.0 output format
    PATCH_FOUND=false
    PATCH_CONTENT=""
    
    # Check for .patch files
    for patch_file in $(find "$OUTPUT_DIR" -name "*.patch" 2>/dev/null || true); do
        if [ -s "$patch_file" ]; then
            PATCH_CONTENT=$(cat "$patch_file")
            PATCH_FOUND=true
            log "📄 Found patch file: $patch_file"
            break
        fi
    done
    
    # Check for trajectory files with patches
    if [ "$PATCH_FOUND" = false ]; then
        for traj_file in $(find "$OUTPUT_DIR" -name "*.traj" 2>/dev/null || true); do
            if [ -s "$traj_file" ]; then
                # Extract patch from trajectory file if present
                PATCH_CONTENT=$(grep -A 1000 "diff --git" "$traj_file" | head -n 500 || true)
                if [ -n "$PATCH_CONTENT" ] && [[ "$PATCH_CONTENT" == *"diff --git"* ]]; then
                    PATCH_FOUND=true
                    log "📄 Found patch in trajectory file: $traj_file"
                    break
                fi
            fi
        done
    fi
    
    # Check for any diff output in logs
    if [ "$PATCH_FOUND" = false ]; then
        PATCH_CONTENT=$(grep -A 100 "diff --git" "$OUTPUT_DIR/swe_agent.log" 2>/dev/null || true)
        if [ -n "$PATCH_CONTENT" ] && [[ "$PATCH_CONTENT" == *"diff --git"* ]]; then
            PATCH_FOUND=true
            log "📄 Found patch in SWE-Agent logs"
        fi
    fi
    
    # Generate response based on results
    if [ "$PATCH_FOUND" = true ] && [ -n "$PATCH_CONTENT" ]; then
        # Truncate patch if too long (GitHub comment limit)
        if [ ${#PATCH_CONTENT} -gt 50000 ]; then
            PATCH_CONTENT="${PATCH_CONTENT:0:50000}
...
(Patch truncated - too long for comment)"
        fi
        
        SUCCESS_MESSAGE="✅ **Solution Generated Successfully!**

## 🔧 Generated Patch
\`\`\`diff
$PATCH_CONTENT
\`\`\`

## 📝 Next Steps
1. Review the proposed changes carefully
2. Test the solution in your development environment  
3. Apply the patch manually if it looks good: \`git apply <patch_file>\`

*Generated by SWE-Agent using $MODEL_NAME*"
        
        post_comment "$SUCCESS_MESSAGE"
        add_reaction "thumbsup"
        
    else
        log "⚠️ No patch found in SWE-Agent output"
        
        NO_PATCH_MESSAGE="✅ **SWE-Agent Analysis Complete**

I've analyzed the issue but didn't generate a code patch. This might mean:
- The issue requires manual investigation
- More information is needed to provide a solution
- The problem may already be resolved
- The issue is not code-related

Feel free to provide more context or ask specific questions!

*Analysis by SWE-Agent using $MODEL_NAME*"
        
        post_comment "$NO_PATCH_MESSAGE"
        add_reaction "thinking_face"
    fi
    
else
    log "❌ SWE-Agent execution failed with exit code: $SWE_EXIT_CODE"
    
    # Extract error information
    ERROR_INFO=""
    if [ -f "$OUTPUT_DIR/swe_agent.log" ]; then
        ERROR_INFO=$(tail -20 "$OUTPUT_DIR/swe_agent.log" 2>/dev/null | grep -E "(Error|Exception|Failed)" | head -3 || echo "Check logs for details")
    fi
    
    FAILURE_MESSAGE="❌ **SWE-Agent execution failed**

I encountered an error while trying to analyze and fix this issue.

## Possible causes:
- Issue complexity requiring human intervention
- API rate limits or model constraints  
- Repository-specific limitations
- Temporary service issues

$(if [ -n "$ERROR_INFO" ] && [ "$ERROR_INFO" != "Check logs for details" ]; then echo "**Error details:**"; echo "\`\`\`"; echo "$ERROR_INFO"; echo "\`\`\`"; fi)

Please try:
1. Rephrasing the request or providing more details
2. Ensuring the issue description is clear
3. Trying again later if this was a temporary problem

*SWE-Agent using $MODEL_NAME*"
    
    post_comment "$FAILURE_MESSAGE"
    add_reaction "confused"
fi

# Cleanup
log "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

log "🏁 SWE-Agent Issue Resolver finished"

exit $SWE_EXIT_CODE