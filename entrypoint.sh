#!/bin/bash

set -e
set -o pipefail

# --- Configuration ---
GITHUB_TOKEN="${INPUT_GITHUB_TOKEN}"
TRIGGER_PHRASE="${INPUT_TRIGGER_PHRASE:-@swe-agent}"
LLM_API_KEY="${INPUT_LLM_API_KEY}"
MODEL_NAME="${INPUT_MODEL_NAME:-gpt-4o}"

# GitHub API URL
GITHUB_API_URL="${GITHUB_API_URL:-https://api.github.com}"

# --- Utility Functions ---
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

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
        log "⚠️ Failed to post comment to GitHub"
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
        log "⚠️ Failed to update comment on GitHub"
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

# Create initial progress comment
INITIAL_MESSAGE="🤖 **SWE-Agent is working on this issue...**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}

## 📊 Progress Status
⏳ **Starting up...** - Initializing SWE-Agent environment

---
*This comment will be updated with real-time progress. Please wait...*"

PROGRESS_COMMENT_ID=$(post_comment "$INITIAL_MESSAGE")

if [ -z "$PROGRESS_COMMENT_ID" ]; then
    log "⚠️ Could not create progress comment, continuing without real-time updates"
fi

# Set up API keys for SWE-Agent
export OPENAI_API_KEY="$LLM_API_KEY"
export ANTHROPIC_API_KEY="$LLM_API_KEY"

# Create temporary directories
TEMP_DIR="/tmp/swe_agent_$(date +%s)"
REPO_DIR="$TEMP_DIR/repo"
OUTPUT_DIR="$TEMP_DIR/output"
mkdir -p "$REPO_DIR" "$OUTPUT_DIR"

# Track start time for progress calculations
echo "$(date +%s)" > "$TEMP_DIR/start_time"

# Clone repository
log "📥 Cloning repository..."
if ! git clone "$REPO_URL" "$REPO_DIR"; then
    log "❌ Failed to clone repository"
    post_comment "❌ Failed to clone repository. Please check permissions."
    add_reaction "confused"
    exit 1
fi

# Change working directory to the PARENT of the cloned repo
cd "$TEMP_DIR"
log "ℹ️ Changed working directory to $TEMP_DIR"

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

# --- Diagnostic Checks ---
log "🔍 Checking for sweagent command..."
SWEAGENT_PATH=$(command -v sweagent)
if [ -z "$SWEAGENT_PATH" ] || ! command -v sweagent > /dev/null 2>&1; then
    log "❌ Critical Error: sweagent command not found in PATH."
    ERROR_MESSAGE="❌ Critical Error: \`sweagent\` command not found. Please check the Docker image setup or SWE-Agent installation."
    if [ -n "$PROGRESS_COMMENT_ID" ]; then
        update_comment "$PROGRESS_COMMENT_ID" "$ERROR_MESSAGE"
    else
        post_comment "$ERROR_MESSAGE"
    fi
    add_reaction "confused"
    exit 1
else
    log "✅ sweagent command found at: $SWEAGENT_PATH"
fi

if [ -r "/app/swe-agent/config/default.yaml" ]; then
    log "📄 Config file /app/swe-agent/config/default.yaml found and readable."
else
    log "⚠️ Config file /app/swe-agent/config/default.yaml not found or not readable."
fi

log "🩺 Attempting 'sweagent -h'..."
SWEAGENT_HELP_OUTPUT_FILE="$TEMP_DIR/sweagent_help_output.log"
if sweagent -h > "$SWEAGENT_HELP_OUTPUT_FILE" 2>&1; then
    log "✅ 'sweagent -h' succeeded."
    if [ -s "$SWEAGENT_HELP_OUTPUT_FILE" ]; then
        log "📋 Help command output (first 15 lines):"
        head -n 15 "$SWEAGENT_HELP_OUTPUT_FILE" | while IFS= read -r line; do log "  $line"; done
    else
        # This case should ideally not happen for a successful -h command
        log "ℹ️ 'sweagent -h' produced no output, but exited successfully."
    fi
else
    HELP_EXIT_CODE=$?
    log "❌ 'sweagent -h' failed with exit code $HELP_EXIT_CODE."
    HELP_OUTPUT_ON_FAILURE=""
    GITHUB_COMMENT_BODY_PREFIX="❌ **Critical Error:** \`sweagent -h\` failed with exit code ${HELP_EXIT_CODE}. SWE-Agent may not be installed correctly or the help command is malfunctioning."
    
    if [ -s "$SWEAGENT_HELP_OUTPUT_FILE" ]; then
        log "📋 Help command output on failure:"
        cat "$SWEAGENT_HELP_OUTPUT_FILE" | while IFS= read -r line; do log "  $line"; done
        HELP_OUTPUT_ON_FAILURE=$(cat "$SWEAGENT_HELP_OUTPUT_FILE")
        GITHUB_COMMENT_BODY_SUFFIX="<details><summary>Command Output</summary>

\`\`\`
${HELP_OUTPUT_ON_FAILURE}
\`\`\`

</details>"
        ERROR_MESSAGE="${GITHUB_COMMENT_BODY_PREFIX}

${GITHUB_COMMENT_BODY_SUFFIX}"
    else
        log "⚠️ 'sweagent -h' failed with no output."
        HELP_OUTPUT_ON_FAILURE="No output captured."
        ERROR_MESSAGE="${GITHUB_COMMENT_BODY_PREFIX} No output was captured."
    fi
    
    if [ -n "$PROGRESS_COMMENT_ID" ]; then
        update_comment "$PROGRESS_COMMENT_ID" "$ERROR_MESSAGE"
    else
        post_comment "$ERROR_MESSAGE"
    fi
    add_reaction "confused"
    exit 1
fi
# --- End Diagnostic Checks ---

log "🤖 Running SWE-Agent with model: $MODEL_NAME"

# Execute SWE-Agent with correct 1.0+ command format
sweagent run \
    --agent.model.name "$MODEL_NAME" \
    --agent.model.per_instance_cost_limit 2.0 \
    --env.repo.path "$REPO_DIR" \
    --env.deployment.type "local" \
    --problem_statement.path "$PROBLEM_STATEMENT_FILE" \
    --output_dir "$OUTPUT_DIR" \
    --config /app/swe-agent/config/default.yaml \
    --actions.apply_patch_locally false \
    2>&1 | tee "$OUTPUT_DIR/swe_agent.log"

SWE_EXIT_CODE=${PIPESTATUS[0]}

if [ $SWE_EXIT_CODE -eq 0 ]; then
    log "✅ SWE-Agent completed successfully"
    
    start_time_file="$TEMP_DIR/start_time"
    elapsed_minutes_str="N/A"
    if [ -f "$start_time_file" ]; then
        start_time_val=$(cat "$start_time_file")
        current_time_val=$(date +%s)
        if [[ "$start_time_val" =~ ^[0-9]+$ ]] && [[ "$current_time_val" =~ ^[0-9]+$ ]] && [ "$start_time_val" -le "$current_time_val" ]; then
            elapsed_seconds=$((current_time_val - start_time_val))
            elapsed_minutes=$((elapsed_seconds / 60))
            if [ "$elapsed_minutes" -gt 0 ]; then
                elapsed_minutes_str="${elapsed_minutes} minutes"
            elif [ "$elapsed_seconds" -gt 0 ]; then
                elapsed_minutes_str="${elapsed_seconds} seconds"
            else
                elapsed_minutes_str="< 1 second"
            fi
        fi
    fi
    
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
    
    # Generate final response and update the progress comment
    if [ "$PATCH_FOUND" = true ] && [ -n "$PATCH_CONTENT" ]; then
        # Truncate patch if too long (GitHub comment limit)
        if [ ${#PATCH_CONTENT} -gt 40000 ]; then
            PATCH_CONTENT="${PATCH_CONTENT:0:40000}
...
(Patch truncated - too long for comment)"
        fi

        # --- Apply patch, commit, and create PR ---
        log "⚙️ Applying patch and creating Pull Request..."
        cd "$REPO_DIR" # Ensure we are in the repository directory

        # Configure Git
        git config --global user.name "swe-agent-bot"
        git config --global user.email "swe-agent-bot@example.com"

        # Create a new branch
        BRANCH_NAME="swe-agent-fix-$(date +%s)"
        git checkout -b "$BRANCH_NAME"
        log "🌿 Created new branch: $BRANCH_NAME"

        # Save patch to a temporary file
        PATCH_FILE_TEMP="$TEMP_DIR/swe_agent_fix.patch"
        echo "$PATCH_CONTENT" > "$PATCH_FILE_TEMP"

        # Apply the patch
        if git apply --check "$PATCH_FILE_TEMP"; then
            if git apply "$PATCH_FILE_TEMP"; then
                log "✅ Patch applied successfully."
                rm "$PATCH_FILE_TEMP" # Clean up temp patch file

                # Commit the changes
                COMMIT_MESSAGE="Fix: Apply patch for issue #${ISSUE_NUMBER} by SWE-Agent

Issue: ${ISSUE_TITLE}
Model: ${MODEL_NAME}"
                git add .
                git commit -m "$COMMIT_MESSAGE"
                log "📝 Changes committed."

                # Push the branch
                if git push origin "$BRANCH_NAME"; then
                    log "🚀 Branch $BRANCH_NAME pushed to origin."

                    # Create Pull Request
                    PR_TITLE="SWE-Agent Fix for Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}"
                    PR_BODY="This Pull Request was automatically generated by SWE-Agent.

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Execution Time:** ${elapsed_minutes_str}

Please review the changes and merge if appropriate.

The following patch was applied:
\`\`\`diff
$PATCH_CONTENT
\`\`\`"
                    
                    # Get default branch of the repository
                    DEFAULT_BRANCH=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
                                     -H "Accept: application/vnd.github.v3+json" \
                                     "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}" | jq -r '.default_branch')

                    if [ -z "$DEFAULT_BRANCH" ] || [ "$DEFAULT_BRANCH" == "null" ]; then
                        log "⚠️ Could not determine default branch. Using 'main'."
                        DEFAULT_BRANCH="main" # Fallback, consider making this configurable
                    fi

                    PR_PAYLOAD=$(jq -n --arg title "$PR_TITLE" --arg head "$BRANCH_NAME" --arg base "$DEFAULT_BRANCH" --arg body "$PR_BODY" \
                                '{title: $title, head: $head, base: $base, body: $body}')

                    PR_RESPONSE=$(curl -s -X POST \
                        -H "Authorization: token ${GITHUB_TOKEN}" \
                        -H "Accept: application/vnd.github.v3+json" \
                        "${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls" \
                        -d "$PR_PAYLOAD")
                    
                    PR_URL=$(echo "$PR_RESPONSE" | jq -r '.html_url')

                    if [ -n "$PR_URL" ] && [ "$PR_URL" != "null" ]; then
                        log "✅ Pull Request created: $PR_URL"
                        FINAL_MESSAGE="✅ **Solution Generated & Pull Request Created!**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Execution Time:** ${elapsed_minutes_str}
**Pull Request:** [View PR](${PR_URL})

## 🔧 Generated Patch
\`\`\`diff
$PATCH_CONTENT
\`\`\`

## 📝 Next Steps
1. **Review** the Pull Request: [${PR_TITLE}](${PR_URL})
2. **Test** the changes in the PR.
3. **Merge** the PR if it resolves the issue.

---
*✨ Generated by SWE-Agent using $MODEL_NAME*"
                    else
                        log "❌ Failed to create Pull Request. Response: $(echo "$PR_RESPONSE" | jq -c .)"
                        FINAL_MESSAGE="✅ **Solution Generated, PR Creation Failed!**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Execution Time:** ${elapsed_minutes_str}

⚠️ **Could not automatically create a Pull Request.** Please find the patch below and create a PR manually from branch \`$BRANCH_NAME\`.

## 🔧 Generated Patch
\`\`\`diff
$PATCH_CONTENT
\`\`\`
---
*✨ Generated by SWE-Agent using $MODEL_NAME*"
                    fi
                else
                    log "❌ Failed to push branch $BRANCH_NAME."
                    FINAL_MESSAGE="✅ **Solution Generated, Branch Push Failed!**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Execution Time:** ${elapsed_minutes_str}

⚠️ **Could not push branch \`$BRANCH_NAME\` to the remote repository.** Please find the patch below. You may need to apply it manually.

## 🔧 Generated Patch
\`\`\`diff
$PATCH_CONTENT
\`\`\`
---
*✨ Generated by SWE-Agent using $MODEL_NAME*"
                fi
            else
                log "❌ Failed to apply patch. Please check the patch content and repository state."
                # Attempt to clean up the failed apply
                git apply --reject "$PATCH_FILE_TEMP" > /dev/null 2>&1 || true # Try to get .rej files
---
*⏰ SWE-Agent using $MODEL_NAME (runtime: ${run_duration_str})*"
        
        # Update progress comment with timeout message
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$TIMEOUT_MESSAGE"
        else
            post_comment "$TIMEOUT_MESSAGE"
        fi
        
        add_reaction "hourglass_flowing_sand"
        
    elif [ $SWE_EXIT_CODE -eq 137 ]; then
        log "💀 SWE-Agent was killed (likely due to hanging or resource limits)"
        
        KILLED_MESSAGE="💀 **SWE-Agent Process Terminated**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}  
**Result:** Process was terminated (likely due to hanging or resource limits, runtime: ${run_duration_str})

## ⚠️ What Happened
The analysis process was terminated because it appeared to be hanging or consuming too many resources.

## 🔍 Common Causes
- **Large repository** - Very large codebases can overwhelm the analysis
- **Complex issue** - Some problems require more resources than available
- **Network issues** - API connectivity problems with the AI model
- **Resource limits** - Memory or CPU exhaustion in the container
- **Infinite loops** - Rare cases where the AI gets stuck in reasoning loops

## 🛠️ What to Try
1. **Simplify the issue** - Focus on one specific problem at a time
2. **Provide clear context** - Include specific file names, line numbers, or error messages
3. **Check repository size** - Very large repos might need special handling
4. **Retry the request** - Sometimes it's just a temporary glitch
5. **Break down the problem** - Split complex issues into smaller parts

## 🔄 Ready to Try Again?
Comment \`@swe-agent\` with a more targeted, specific request!

---
*💀 SWE-Agent using $MODEL_NAME (runtime: ${run_duration_str})*"
        
        # Update progress comment with killed message
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$KILLED_MESSAGE"
        else
            post_comment "$KILLED_MESSAGE"
        fi
        
        add_reaction "skull"
        
    else
        log "❌ SWE-Agent execution failed with exit code: $SWE_EXIT_CODE"
        
        # Show diagnostic information
        log "🔍 Diagnostic Information:"
        log "  - Model: $MODEL_NAME"
        log "  - Repository: $REPO_DIR"
        log "  - Problem statement: $PROBLEM_STATEMENT_FILE"
        log "  - Output directory: $OUTPUT_DIR"
        
        # Extract error information and show first/last lines of log
        ERROR_INFO=""
        LOG_PREVIEW=""
        if [ -f "$OUTPUT_DIR/swe_agent.log" ]; then
            LOG_SIZE=$(wc -l < "$OUTPUT_DIR/swe_agent.log")
            log "  - Log file size: $LOG_SIZE lines"
            
            ERROR_INFO=$(tail -20 "$OUTPUT_DIR/swe_agent.log" 2>/dev/null | grep -E "(Error|Exception|Failed|Traceback)" | head -3 || echo "No specific errors found in log")
            
            # Show first 10 lines and last 10 lines of log for diagnosis
            LOG_PREVIEW="**First 10 lines of log:**
\`\`\`
$(head -10 "$OUTPUT_DIR/swe_agent.log" 2>/dev/null || echo "Could not read log file")
\`\`\`

**Last 10 lines of log:**
\`\`\`
$(tail -10 "$OUTPUT_DIR/swe_agent.log" 2>/dev/null || echo "Could not read log file")
\`\`\`"
        else
            log "  - No log file found at $OUTPUT_DIR/swe_agent.log"
            ERROR_INFO="No log file was created - SWE-Agent failed immediately"
        fi
        
        FAILURE_MESSAGE="❌ **SWE-Agent Execution Failed**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Exit Code:** ${SWE_EXIT_CODE}
**Runtime:** ${run_duration_str}

## 🚨 What Happened
I encountered an error while trying to analyze and fix this issue.

## 🔍 Diagnostic Information
- **Model:** ${MODEL_NAME}
- **Exit Code:** ${SWE_EXIT_CODE}
- **Repository:** Successfully cloned
- **Problem Statement:** Created successfully

## 📋 Error Details
${ERROR_INFO}

${LOG_PREVIEW}

## 🔍 Possible Causes
- **Issue complexity** - The problem might require human intervention
- **API limits** - Rate limiting or model constraints from the AI provider
- **Repository issues** - Access permissions or repository-specific limitations  
- **Service problems** - Temporary issues with SWE-Agent or AI model services
- **Configuration issues** - Problems with model setup or parameters
- **Installation issues** - SWE-Agent may not be properly installed

## 🛠️ What You Can Try
1. **Rephrase the request** - Provide more details or context about the issue
2. **Check the issue description** - Ensure it's clear and complete
3. **Try again later** - If this was a temporary API or service issue
4. **Simplify the request** - Focus on one specific aspect of the problem
5. **Use a different model** - Try switching between GPT-4o and Claude models
6. **Contact maintainers** - If this error persists, please report it

## 🔄 Ready to Try Again?  
Comment \`@swe-agent\` with additional context or a rephrased request!

---
*❌ SWE-Agent using $MODEL_NAME (runtime: ${run_duration_str})*"
        
        # Update progress comment with failure message
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$FAILURE_MESSAGE"
        else
            post_comment "$FAILURE_MESSAGE"
        fi
        
        add_reaction "confused"
    fi
fi

# Cleanup
log "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

log "🏁 SWE-Agent Issue Resolver finished"

exit $SWE_EXIT_CODE