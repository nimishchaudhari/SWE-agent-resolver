#!/bin/bash

set -e
set -o pipefail

# --- Configuration ---
GITHUB_TOKEN="${INPUT_GITHUB_TOKEN}"
TRIGGER_PHRASE="${INPUT_TRIGGER_PHRASE:-@swe-agent}"
LLM_API_KEY="${INPUT_LLM_API_KEY}"
OPENAI_API_KEY="${INPUT_OPENAI_API_KEY}"
ANTHROPIC_API_KEY="${INPUT_ANTHROPIC_API_KEY}"
DEEPSEEK_API_KEY="${INPUT_DEEPSEEK_API_KEY}"
OPENROUTER_API_KEY="${INPUT_OPENROUTER_API_KEY}"
GEMINI_API_KEY="${INPUT_GEMINI_API_KEY}"
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

# Enhanced reaction system with context-aware responses
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
        *)
            reaction="thinking_face"
            ;;
    esac
    
    add_reaction "$reaction"
}

# Function to update progress with enhanced tracking
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
    start_time_file="$TEMP_DIR/start_time"
    if [ -f "$start_time_file" ]; then
        start_time_val=$(cat "$start_time_file")
        current_time_val=$(date +%s)
        if [[ "$start_time_val" =~ ^[0-9]+$ ]] && [[ "$current_time_val" =~ ^[0-9]+$ ]]; then
            elapsed_seconds=$((current_time_val - start_time_val))
            elapsed_minutes=$((elapsed_seconds / 60))
            remaining_seconds=$((elapsed_seconds % 60))
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
    
    update_comment "$PROGRESS_COMMENT_ID" "$PROGRESS_MESSAGE"
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
add_contextual_reaction "processing"

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
# Export all API keys to environment - LiteLLM will automatically pick the right one based on model name
export OPENAI_API_KEY="${OPENAI_API_KEY:-${LLM_API_KEY}}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-${LLM_API_KEY}}"
export DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY}"
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY}"
export GEMINI_API_KEY="${GEMINI_API_KEY}"
# Gemini also needs GOOGLE_API_KEY for LiteLLM compatibility
export GOOGLE_API_KEY="${GEMINI_API_KEY}"

# Additional environment variables that some providers might need
export CLAUDE_API_KEY="${ANTHROPIC_API_KEY}"  # Some configurations use CLAUDE_API_KEY
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-}"  # For service account auth

# Additional LiteLLM compatibility environment variables
export VERTEX_AI_PROJECT="${VERTEX_AI_PROJECT:-}"
export VERTEX_AI_LOCATION="${VERTEX_AI_LOCATION:-}"
export COHERE_API_KEY="${COHERE_API_KEY:-}"
export REPLICATE_API_TOKEN="${REPLICATE_API_TOKEN:-}"

# Log which API keys are configured (without revealing the actual keys)
API_KEYS_CONFIGURED=()
[ -n "$OPENAI_API_KEY" ] && API_KEYS_CONFIGURED+=("OpenAI")
[ -n "$ANTHROPIC_API_KEY" ] && API_KEYS_CONFIGURED+=("Anthropic") 
[ -n "$DEEPSEEK_API_KEY" ] && API_KEYS_CONFIGURED+=("DeepSeek")
[ -n "$OPENROUTER_API_KEY" ] && API_KEYS_CONFIGURED+=("OpenRouter")
[ -n "$GEMINI_API_KEY" ] && API_KEYS_CONFIGURED+=("Gemini")

if [ ${#API_KEYS_CONFIGURED[@]} -eq 0 ]; then
    log "⚠️ No API keys detected in environment variables. SWE-Agent will attempt to proceed - LiteLLM may have other authentication methods."
else
    log "✅ API keys configured for: $(IFS=', '; echo "${API_KEYS_CONFIGURED[*]}")"
fi

# Create temporary directories
TEMP_DIR="/tmp/swe_agent_$(date +%s)"
REPO_DIR="$TEMP_DIR/repo"
OUTPUT_DIR="$TEMP_DIR/output"
mkdir -p "$REPO_DIR" "$OUTPUT_DIR"

# Track start time for progress calculations
echo "$(date +%s)" > "$TEMP_DIR/start_time"

# Update progress: Initializing
update_progress "initializing" "Setting up environment and cloning repository" "- Configuring API keys
- Creating temporary directories
- Preparing to clone repository"

# Clone repository
log "📥 Cloning repository..."
if ! git clone "$REPO_URL" "$REPO_DIR"; then
    log "❌ Failed to clone repository"
    post_comment "❌ Failed to clone repository. Please check permissions."
    add_reaction "confused"
    exit 1
fi

# Update progress: Analyzing
update_progress "analyzing" "Repository cloned, analyzing issue requirements" "- Repository: $(basename "$REPO_URL")
- Issue: $ISSUE_TITLE
- Preparing problem statement for SWE-Agent"

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

# Update progress: Planning
update_progress "planning" "Starting SWE-Agent analysis and solution planning" "- Model: $MODEL_NAME
- Configuration validated
- Ready to analyze issue and generate solution"

log "🤖 Running SWE-Agent with model: $MODEL_NAME"

# Prepare model-specific parameters
MODEL_PARAMS=()
if [[ "$MODEL_NAME" == "openai/o1" || "$MODEL_NAME" == "openai/o3" || "$MODEL_NAME" == "openai/o3-mini" || "$MODEL_NAME" == "openai/o4-mini" ]]; then
    MODEL_PARAMS+=("--agent.model.top_p" "null" "--agent.model.temperature" "1.0")
fi

# Update progress: Implementing
update_progress "implementing" "SWE-Agent is analyzing the codebase and implementing solution" "- Scanning repository structure
- Understanding issue context
- Generating and testing potential fixes"

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
    "${MODEL_PARAMS[@]}" \
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
        # Calculate patch statistics
        FILES_CHANGED=$(echo "$PATCH_CONTENT" | grep -c "^diff --git" || echo "0")
        LINES_ADDED=$(echo "$PATCH_CONTENT" | grep -c "^+" || echo "0")
        LINES_REMOVED=$(echo "$PATCH_CONTENT" | grep -c "^-" || echo "0")
        # Subtract the diff headers from line counts
        LINES_ADDED=$((LINES_ADDED - FILES_CHANGED))
        LINES_REMOVED=$((LINES_REMOVED - FILES_CHANGED))
        if [ $LINES_ADDED -lt 0 ]; then LINES_ADDED=0; fi
        if [ $LINES_REMOVED -lt 0 ]; then LINES_REMOVED=0; fi
        
        # Truncate patch if too long (GitHub comment limit)
        TRUNCATED=false
        if [ ${#PATCH_CONTENT} -gt 40000 ]; then
            PATCH_CONTENT="${PATCH_CONTENT:0:40000}
...
(Patch truncated - too long for comment)"
            TRUNCATED=true
        fi

        # Set action outputs
        echo "patch_generated=true" >> $GITHUB_OUTPUT
        echo "execution_time=${elapsed_minutes_str}" >> $GITHUB_OUTPUT
        
        # Write patch content to a file and set output
        PATCH_OUTPUT_FILE="$GITHUB_WORKSPACE/swe_agent_patch.txt"
        printf '%s\n' "$PATCH_CONTENT" > "$PATCH_OUTPUT_FILE"
        echo "patch_content<<EOF" >> $GITHUB_OUTPUT
        printf '%s\n' "$PATCH_CONTENT" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT
        
        log "✅ Patch generated and saved to outputs"
        
        # Generate statistics summary
        STATS_SUMMARY=""
        if [ "$FILES_CHANGED" -gt 0 ]; then
            STATS_SUMMARY="**📊 Patch Statistics:**
- 📁 Files changed: **${FILES_CHANGED}**
- ➕ Lines added: **${LINES_ADDED}**
- ➖ Lines removed: **${LINES_REMOVED}**
- 📏 Net change: **$((LINES_ADDED - LINES_REMOVED))** lines"
            if [ "$TRUNCATED" = true ]; then
                STATS_SUMMARY="$STATS_SUMMARY
- ⚠️ **Note:** Patch was truncated for display (see full patch in PR)"
            fi
        fi
        
        FINAL_MESSAGE="✅ **Solution Generated Successfully!**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Execution Time:** ${elapsed_minutes_str}

${STATS_SUMMARY}

## 🔧 Generated Patch

<details>
<summary>📄 Click to view generated patch (${FILES_CHANGED} files changed)</summary>

\`\`\`diff
${PATCH_CONTENT}
\`\`\`

</details>

## 🔄 Next Steps
✨ The patch is being processed and a Pull Request will be created shortly.

**What happens next:**
1. 🔄 Patch validation and testing
2. 📝 Pull Request creation with detailed description
3. ✅ Ready for review and merge

---
*✨ Generated by SWE-Agent using $MODEL_NAME • [View full patch in upcoming PR]*"
        
        # Update the progress comment with final results
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$FINAL_MESSAGE"
        else
            post_comment "$FINAL_MESSAGE"
        fi
        
        add_contextual_reaction "success_patch"
        
    else
        log "⚠️ No patch found in SWE-Agent output"
        
        # Set action outputs for no patch
        echo "patch_generated=false" >> $GITHUB_OUTPUT
        echo "execution_time=${elapsed_minutes_str}" >> $GITHUB_OUTPUT
        echo "patch_content=" >> $GITHUB_OUTPUT
        
        FINAL_MESSAGE="🔍 **Analysis Completed - No Code Changes Needed**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Result:** Analysis completed but no patch generated
**Execution Time:** ${elapsed_minutes_str}

## 🔍 Analysis Results
I've thoroughly analyzed the issue but didn't generate a code patch. This could mean:

### 🤔 Possible Reasons:
- 📋 **Investigation/Research needed** - Requires manual investigation
- ℹ️ **More information needed** - Additional details would help
- ✅ **Already resolved** - The problem may already be fixed
- 📝 **Documentation issue** - Related to docs rather than code
- 🏗️ **Architecture decision** - Requires design/architecture changes
- 🔧 **Configuration issue** - Settings or environment related

## 💡 How to Get Better Results

<details>
<summary>🎯 Tips for more specific requests</summary>

**Instead of:** \"Fix the login system\"
**Try:** \"Fix authentication error on line 45 in auth.py - users can't log in with valid credentials\"

**Include:**
- 📍 **Specific files/functions** affected
- 🐛 **Error messages** or logs
- 📋 **Steps to reproduce** the issue
- ✅ **Expected vs actual behavior**
- 🔗 **Related issue links** or context

</details>

## 🔄 Ready to Try Again?

**Option 1:** Comment `@swe-agent` with more specific details
**Option 2:** Try breaking down into smaller, focused requests
**Option 3:** Include error logs or specific examples

---
*🤖 Analysis by SWE-Agent using $MODEL_NAME • No code changes required*"
        
        # Update the progress comment with final results
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$FINAL_MESSAGE"
        else
            post_comment "$FINAL_MESSAGE"
        fi
        
        add_contextual_reaction "success_analysis"
    fi
    
else
    # SWE-Agent failed - determine the cause and update progress comment
    start_time_file="$TEMP_DIR/start_time"
    run_duration_str="N/A"
    if [ -f "$start_time_file" ]; then
        start_time_s=$(cat "$start_time_file")
        current_time_s=$(date +%s)
        if [[ "$start_time_s" =~ ^[0-9]+$ ]] && [[ "$current_time_s" =~ ^[0-9]+$ ]] && [ "$start_time_s" -le "$current_time_s" ]; then
            run_seconds=$((current_time_s - start_time_s))
            elapsed_minutes_val=$((run_seconds / 60))
            if [ "$elapsed_minutes_val" -gt 0 ]; then
                run_duration_str="${elapsed_minutes_val} minutes"
            elif [ "$run_seconds" -gt 0 ]; then
                run_duration_str="${run_seconds} seconds"
            else
                run_duration_str="< 1 second"
            fi
        fi
    fi
    
    if [ $SWE_EXIT_CODE -eq 124 ]; then
        log "⏰ SWE-Agent timed out"
        
        # Set action outputs for timeout
        echo "patch_generated=false" >> $GITHUB_OUTPUT
        echo "execution_time=${run_duration_str}" >> $GITHUB_OUTPUT
        echo "patch_content=" >> $GITHUB_OUTPUT
        
        TIMEOUT_MESSAGE="⏰ **Analysis Timeout - Let's Optimize the Request**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}  
**Model:** ${MODEL_NAME}
**Runtime:** ${run_duration_str} (exceeded expected completion time)

## ⏱️ What Happened
The analysis took longer than expected and was stopped as a safety measure.

## 🎯 Quick Fixes to Try

<details>
<summary>🚀 Make Your Request More Efficient</summary>

### ✅ **Effective Requests:**
- \"Fix TypeError on line 123 in utils.py\"
- \"Update deprecated API call in user_service.py\"
- \"Fix import error in main.py after recent changes\"

### ❌ **Requests That May Timeout:**
- \"Fix all bugs in the application\"
- \"Refactor the entire codebase\"
- \"Improve performance everywhere\"

### 📋 **Best Practices:**
1. **Focus on ONE specific issue**
2. **Include file names and line numbers**
3. **Provide error messages or stack traces**
4. **Describe expected vs actual behavior**

</details>

## 🔄 Ready to Try Again?
Comment `@swe-agent` with a **focused, specific request** - the more precise, the faster the results!

**Example:** `@swe-agent Fix the import error in auth.py line 15 - cannot import User from models`

---
*⏰ SWE-Agent using $MODEL_NAME • Runtime optimization needed*"
        
        # Update progress comment with timeout message
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$TIMEOUT_MESSAGE"
        else
            post_comment "$TIMEOUT_MESSAGE"
        fi
        
        add_contextual_reaction "timeout"
        
    elif [ $SWE_EXIT_CODE -eq 137 ]; then
        log "💀 SWE-Agent was killed (likely due to hanging or resource limits)"
        
        # Set action outputs for killed process
        echo "patch_generated=false" >> $GITHUB_OUTPUT
        echo "execution_time=${run_duration_str}" >> $GITHUB_OUTPUT
        echo "patch_content=" >> $GITHUB_OUTPUT
        
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
        
        add_contextual_reaction "killed"
        
    else
        log "❌ SWE-Agent execution failed with exit code: $SWE_EXIT_CODE"
        
        # Set action outputs for general failure
        echo "patch_generated=false" >> $GITHUB_OUTPUT
        echo "execution_time=${run_duration_str}" >> $GITHUB_OUTPUT
        echo "patch_content=" >> $GITHUB_OUTPUT
        
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
            FIRST_10_LINES=$(head -10 "$OUTPUT_DIR/swe_agent.log" 2>/dev/null || echo "Could not read log file")
            LAST_10_LINES=$(tail -10 "$OUTPUT_DIR/swe_agent.log" 2>/dev/null || echo "Could not read log file")
            
            LOG_PREVIEW="**First 10 lines of log:**
\`\`\`
${FIRST_10_LINES}
\`\`\`

**Last 10 lines of log:**
\`\`\`
${LAST_10_LINES}
\`\`\`"
        else
            log "  - No log file found at $OUTPUT_DIR/swe_agent.log"
            ERROR_INFO="No log file was created - SWE-Agent failed immediately"
        fi
        
        FAILURE_MESSAGE="❌ **Analysis Failed - Let's Diagnose and Fix This**

**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Model:** ${MODEL_NAME}
**Exit Code:** ${SWE_EXIT_CODE}
**Runtime:** ${run_duration_str}

## 🚨 What Happened
I encountered an error while analyzing this issue. Let's figure out what went wrong and how to fix it.

## 🔍 Diagnostic Summary
- **Model:** ${MODEL_NAME} $([ "$SWE_EXIT_CODE" -eq 1 ] && echo "(❌ Model access issue)" || echo "(✅ Model accessible)")
- **Exit Code:** ${SWE_EXIT_CODE} $([ "$SWE_EXIT_CODE" -eq 1 ] && echo "(API/Authentication error)" || echo "")
- **Repository:** ✅ Successfully cloned
- **Issue Processing:** ✅ Problem statement created

## 📋 Error Analysis
${ERROR_INFO}

<details>
<summary>🔍 Technical Details (Click to expand)</summary>

${LOG_PREVIEW}

</details>

## 🛠️ Smart Recovery Suggestions

<details>
<summary>🎯 Based on the error, try these solutions</summary>

### 🔧 **Immediate Actions:**
$(if [ "$SWE_EXIT_CODE" -eq 1 ]; then
    echo "- **API Issue Detected** - This looks like a model access problem
- Try using a different model (add model specification to your comment)
- Check if API rate limits were exceeded
- Example: \`@swe-agent using claude-3-5-sonnet\`"
else
    echo "- **Rephrase your request** with more specific details
- **Include error messages** if you have them
- **Specify file names** and locations if known
- **Break down complex requests** into smaller parts"
fi)

### 🎭 **Alternative Models to Try:**
- \`@swe-agent using gpt-4o\` - OpenAI's latest model
- \`@swe-agent using claude-3-5-sonnet\` - Anthropic's advanced model
- \`@swe-agent using deepseek/deepseek-coder\` - Specialized coding model

### 📝 **Request Optimization:**
- Be more specific about the problem location
- Include stack traces or error logs
- Describe what you've already tried
- Mention any recent changes that might be related

</details>

## 🔄 Ready to Try Again?
**Quick retry:** Comment \`@swe-agent\` with additional context or try a different model!

---
*❌ SWE-Agent using $MODEL_NAME • Error recovery assistance available*"
        
        # Update progress comment with failure message
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$FAILURE_MESSAGE"
        else
            post_comment "$FAILURE_MESSAGE"
        fi
        
        # Determine reaction type based on exit code
        if [ "$SWE_EXIT_CODE" -eq 1 ]; then
            add_contextual_reaction "api_error"
        else
            add_contextual_reaction "general_error"
        fi
    fi
fi

# Cleanup
log "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

log "🏁 SWE-Agent Issue Resolver finished"

exit $SWE_EXIT_CODE
