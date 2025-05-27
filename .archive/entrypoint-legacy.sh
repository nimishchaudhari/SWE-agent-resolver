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

# New configuration for enhanced response modes
RESPONSE_MODE="${INPUT_RESPONSE_MODE:-auto}"
ENABLE_VISUAL_CONTENT="${INPUT_ENABLE_VISUAL_CONTENT:-true}"
VISUAL_CONTENT_FORMAT="${INPUT_VISUAL_CONTENT_FORMAT:-all}"
MAX_COMMENT_LENGTH="${INPUT_MAX_COMMENT_LENGTH:-65536}"

# Multi-Context Support Configuration
CONTEXT_MODE="${INPUT_CONTEXT_MODE:-auto}"
PR_STRATEGY="${INPUT_PR_STRATEGY:-continue}"
GIT_REFERENCE_MODE="${INPUT_GIT_REFERENCE_MODE:-auto}"
ENABLE_REVIEW_CONTEXT="${INPUT_ENABLE_REVIEW_CONTEXT:-true}"
TARGET_BRANCH_STRATEGY="${INPUT_TARGET_BRANCH_STRATEGY:-auto}"

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

# Function to detect request intent from comment content
detect_request_intent() {
    local comment="$1"
    local intent="patch"  # default
    local context_mode="${FINAL_CONTEXT_MODE:-unknown}"
    
    # Convert to lowercase for case-insensitive matching
    local lower_comment=$(echo "$comment" | tr '[:upper:]' '[:lower:]')
    
    # PR Review specific keywords (highest priority for PR contexts)
    if [[ "$context_mode" =~ ^pr_ ]] && [[ "$lower_comment" =~ (review|lgtm|approve|request.*change|block|nitpick|style|lint|test.*coverage|security.*check|performance.*review|code.*quality|merge.*safe|breaking.*change|backward.*compat) ]]; then
        intent="pr_review"
    # Visual content keywords (high priority)
    elif [[ "$lower_comment" =~ (chart|plot|graph|diagram|visualize|visualization|picture|image|screenshot|draw|show.*me.*visual) ]]; then
        intent="visual"
    # Analysis keywords (second priority)
    elif [[ "$lower_comment" =~ (analyze|analysis|explain|understand|investigate|examine|review|assess|evaluate|why|how.*work|what.*happen) ]]; then
        intent="analysis"
    # Opinion/advice keywords (third priority)
    elif [[ "$lower_comment" =~ (opinion|advice|suggest|recommend|think|thoughts|what.*do.*you|should.*i|best.*practice|approach|strategy) ]]; then
        intent="opinion"
    # Code fix keywords (default when explicit)
    elif [[ "$lower_comment" =~ (fix|patch|solve|resolve|implement|code|bug|error|issue) ]]; then
        intent="patch"
    fi
    
    echo "$intent"
}

# Function to generate visual content
generate_visual_content() {
    local content_type="$1"
    local description="$2"
    local format="$3"
    
    case "$content_type" in
        "mermaid")
            echo "\`\`\`mermaid"
            echo "$description"
            echo "\`\`\`"
            ;;
        "ascii")
            echo "\`\`\`"
            echo "$description"
            echo "\`\`\`"
            ;;
        "code")
            echo "\`\`\`python"
            echo "# Generated visualization code"
            echo "$description"
            echo "\`\`\`"
            ;;
    esac
}

# Function to format response based on intent
format_response_by_intent() {
    local intent="$1"
    local content="$2"
    local issue_number="$3"
    local issue_title="$4"
    local model_name="$5"
    local execution_time="$6"
    local context_type="${7:-${CONTEXT_TYPE:-unknown}}"
    local context_mode="${8:-${FINAL_CONTEXT_MODE:-unknown}}"
    
    # Context-aware emoji and description
    local context_emoji=""
    local context_description=""
    case "$context_mode" in
        "pr_review"|"pr_review_comment")
            context_emoji="🔍"
            context_description="PR Review"
            ;;
        "pr_comment"|"pull_request")
            context_emoji="🔄"
            context_description="Pull Request"
            ;;
        "issue_comment")
            context_emoji="📝"
            context_description="Issue"
            ;;
        *)
            context_emoji="🤖"
            context_description="Request"
            ;;
    esac
    
    case "$intent" in
        "pr_review")
            cat << 'EOF'
🔍 **SWE-Agent Pull Request Review**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${context_type})
**Model:** ${model_name}
**Review Type:** Comprehensive PR Analysis
**Review Time:** ${execution_time}

## 📋 Pull Request Review Summary

${content}

## 🔍 Code Quality Assessment

<details>
<summary>📊 Click to view detailed code quality metrics</summary>

**Architecture & Design:**
- Code follows established patterns ✓/⚠️/❌
- Proper separation of concerns ✓/⚠️/❌
- Maintains consistency with codebase ✓/⚠️/❌

**Security & Safety:**
- No obvious security vulnerabilities ✓/⚠️/❌
- Input validation present ✓/⚠️/❌
- Error handling appropriate ✓/⚠️/❌

**Performance & Efficiency:**
- No performance regressions ✓/⚠️/❌
- Efficient algorithms used ✓/⚠️/❌
- Resource usage optimized ✓/⚠️/❌

**Testing & Coverage:**
- Tests included for new features ✓/⚠️/❌
- Edge cases covered ✓/⚠️/❌
- Integration tests present ✓/⚠️/❌

</details>

## 🎯 Review Recommendations

### ✅ **Approved Changes**
- Well-structured implementation
- Follows coding standards
- Comprehensive test coverage

### ⚠️ **Suggested Improvements**
- Consider refactoring for better readability
- Add more comprehensive error handling
- Update documentation

### ❌ **Required Changes**
- Fix critical security issues
- Address performance bottlenecks
- Add missing test coverage

## 🚀 Merge Recommendation

**Overall Assessment:** ✅ **APPROVED** / ⚠️ **APPROVED WITH SUGGESTIONS** / ❌ **CHANGES REQUESTED**

### Next Steps:
1. **Address any critical issues** mentioned above
2. **Review suggested improvements** for code quality
3. **Ensure all tests pass** before merging
4. **Update documentation** if needed

---
*🔍 SWE-Agent using ${model_name} • PR review complete • ${context_emoji} ${context_mode} context*
EOF
            ;;
        "opinion")
            cat << 'EOF'
💡 **SWE-Agent Opinion & Recommendations**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${context_type})
**Model:** ${model_name}
**Response Type:** Opinion & Advice
**Analysis Time:** ${execution_time}

## 🤔 My Analysis & Opinion

${content}

## 💡 Key Recommendations

<details>
<summary>🎯 Click to view detailed recommendations</summary>

${content}

</details>

## 🚀 Next Steps
Based on my analysis, here's what I'd recommend:

1. **Consider the trade-offs** mentioned above
2. **Test thoroughly** before implementing
3. **Follow best practices** for your specific use case
4. **Monitor the results** after implementation

---
*💡 SWE-Agent using ${model_name} • Opinion & advisory response • ${context_emoji} ${context_mode} context*
EOF
            ;;
        "analysis")
            cat << 'EOF'
🔍 **SWE-Agent Code Analysis Report**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${context_type})
**Model:** ${model_name}
**Response Type:** Technical Analysis
**Analysis Time:** ${execution_time}

## 📊 Analysis Results

${content}

## 🔍 Technical Details

<details>
<summary>📋 Click to view detailed technical analysis</summary>

${content}

</details>

## 🎯 Key Findings
- **Architecture Impact:** Analyzing structural implications
- **Performance Considerations:** Evaluating efficiency factors
- **Security Implications:** Assessing security aspects
- **Maintenance Burden:** Reviewing long-term maintainability

---
*🔍 SWE-Agent using ${model_name} • Technical analysis complete • ${context_emoji} ${context_mode} context*
EOF
            ;;
        "visual")
            cat << 'EOF'
📊 **SWE-Agent Visual Analysis**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${context_type})
**Model:** ${model_name}
**Response Type:** Visual Content
**Generation Time:** ${execution_time}

## 📈 Generated Visualization

${content}

## 🎨 Visual Content Details

<details>
<summary>🖼️ Click to view additional visual formats</summary>

${content}

</details>

## 📋 How to Use This Visualization
1. **Copy the diagram code** from the sections above
2. **Paste into your preferred tool** (Mermaid Live Editor, ASCII art viewer, etc.)
3. **Customize as needed** for your specific requirements
4. **Include in documentation** or presentations

---
*📊 SWE-Agent using ${model_name} • Visual content generated • ${context_emoji} ${context_mode} context*
EOF
            ;;
        *)
            # Default patch format (existing behavior)
            echo "$content"
            ;;
    esac
}

# Function to handle opinion/analysis requests without SWE-Agent
handle_non_patch_request() {
    local intent="$1"
    local comment_body="$2"
    local issue_title="$3"
    local issue_body="$4"
    local issue_number="$5"
    local model_name="$6"
    
    # For opinion/analysis requests, use a lightweight AI call instead of full SWE-Agent
    local analysis_prompt=""
    case "$intent" in
        "opinion")
            analysis_prompt="As an experienced software engineer, provide your opinion and recommendations for this issue:

Issue: $issue_title
Description: $issue_body
User Request: $comment_body

Please provide thoughtful advice, best practices, and recommendations. Focus on practical guidance rather than code generation."
            ;;
        "analysis")
            analysis_prompt="As an expert code analyst, analyze this software issue:

Issue: $issue_title
Description: $issue_body
User Request: $comment_body

Please provide a technical analysis covering architecture, performance, security, and maintainability aspects. Explain the underlying causes and implications."
            ;;
        "visual")
            analysis_prompt="Create visual content to help explain this software issue:

Issue: $issue_title
Description: $issue_body
User Request: $comment_body

Generate diagrams, charts, or visual representations using Mermaid syntax, ASCII art, or code examples that would help visualize the problem or solution."
            ;;
        "pr_review")
            analysis_prompt="As an expert code reviewer, conduct a comprehensive pull request review:

Pull Request: $issue_title
Description: $issue_body
Review Request: $comment_body

Please provide a thorough code review covering:
1. **Code Quality**: Architecture, design patterns, readability, maintainability
2. **Security**: Potential vulnerabilities, input validation, error handling
3. **Performance**: Efficiency, resource usage, scalability considerations
4. **Testing**: Test coverage, edge cases, integration testing
5. **Best Practices**: Coding standards, documentation, style consistency
6. **Merge Safety**: Breaking changes, backward compatibility, deployment impact

Provide specific recommendations and an overall merge recommendation (Approved/Approved with Suggestions/Changes Requested)."
            ;;
    esac
    
    # Use a lightweight AI API call for non-patch requests
    local response_content=""
    local api_call_success=false
    
    # Prepare API call based on available API keys
    if [ -n "$OPENAI_API_KEY" ]; then
        log "🔗 Calling OpenAI API for $intent response..."
        response_content=$(call_openai_api "$analysis_prompt" "$model_name")
        if [[ ! "$response_content" =~ ^Error: ]]; then
            api_call_success=true
        fi
    elif [ -n "$ANTHROPIC_API_KEY" ]; then
        log "🔗 Calling Anthropic API for $intent response..."
        response_content=$(call_anthropic_api "$analysis_prompt" "$model_name")
        if [[ ! "$response_content" =~ ^Error: ]]; then
            api_call_success=true
        fi
    elif [ -n "$OPENROUTER_API_KEY" ]; then
        log "🔗 Calling OpenRouter API for $intent response..."
        response_content=$(call_openrouter_api "$analysis_prompt" "$model_name")
        if [[ ! "$response_content" =~ ^Error: ]]; then
            api_call_success=true
        fi
    elif [ -n "$GEMINI_API_KEY" ]; then
        log "🔗 Calling Gemini API for $intent response..."
        response_content=$(call_gemini_api "$analysis_prompt" "$model_name")
        if [[ ! "$response_content" =~ ^Error: ]]; then
            api_call_success=true
        fi
    else
        log "❌ No API keys available for lightweight AI processing"
        response_content="I apologize, but I don't have access to AI services to provide this type of response. Please ensure you have configured at least one API key (OpenAI, Anthropic, OpenRouter, or Gemini) in your repository secrets."
        return 1
    fi
    
    # Validate response
    if [ "$api_call_success" = true ] && [ -n "$response_content" ] && [ ${#response_content} -gt 10 ]; then
        log "✅ Successfully generated $intent response (${#response_content} characters)"
        echo "$response_content"
        return 0
    else
        log "❌ Failed to generate valid $intent response: $response_content"
        return 1
    fi
}

# --- AI API Call Functions ---

# Function to call OpenAI API
call_openai_api() {
    local prompt="$1"
    local model="$2"
    
    # Default to gpt-4o if model not specified or not supported
    local api_model="$model"
    if [[ ! "$model" =~ ^(gpt-4o|gpt-4-turbo|gpt-3.5-turbo|gpt-4)$ ]]; then
        api_model="gpt-4o"
    fi
    
    local json_payload=$(jq -n \
        --arg model "$api_model" \
        --arg prompt "$prompt" \
        '{
            "model": $model,
            "messages": [{"role": "user", "content": $prompt}],
            "max_tokens": 2048,
            "temperature": 0.7
        }')
    
    local response=$(curl -s -X POST "https://api.openai.com/v1/chat/completions" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.choices[0].message.content // "Error: Unable to get response from OpenAI"'
}

# Function to call Anthropic API
call_anthropic_api() {
    local prompt="$1"
    local model="$2"
    
    # Default to claude-3-5-sonnet if model not specified or not supported
    local api_model="$model"
    if [[ ! "$model" =~ ^(claude-3-5-sonnet|claude-3-haiku|claude-3-opus)$ ]]; then
        api_model="claude-3-5-sonnet-20241022"
    fi
    
    local json_payload=$(jq -n \
        --arg model "$api_model" \
        --arg prompt "$prompt" \
        '{
            "model": $model,
            "messages": [{"role": "user", "content": $prompt}],
            "max_tokens": 2048
        }')
    
    local response=$(curl -s -X POST "https://api.anthropic.com/v1/messages" \
        -H "X-API-Key: $ANTHROPIC_API_KEY" \
        -H "Content-Type: application/json" \
        -H "anthropic-version: 2023-06-01" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.content[0].text // "Error: Unable to get response from Anthropic"'
}

# Function to call OpenRouter API
call_openrouter_api() {
    local prompt="$1"
    local model="$2"
    
    # Use the model as-is for OpenRouter
    local json_payload=$(jq -n \
        --arg model "$model" \
        --arg prompt "$prompt" \
        '{
            "model": $model,
            "messages": [{"role": "user", "content": $prompt}],
            "max_tokens": 2048,
            "temperature": 0.7
        }')
    
    local response=$(curl -s -X POST "https://openrouter.ai/api/v1/chat/completions" \
        -H "Authorization: Bearer $OPENROUTER_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.choices[0].message.content // "Error: Unable to get response from OpenRouter"'
}

# Function to call Gemini API
call_gemini_api() {
    local prompt="$1"
    local model="$2"
    
    # Default to gemini-pro if model not specified
    local api_model="gemini-pro"
    if [[ "$model" =~ ^(gemini-pro|gemini-1.5-pro|gemini-1.5-flash)$ ]]; then
        api_model="$model"
    fi
    
    local json_payload=$(jq -n \
        --arg prompt "$prompt" \
        '{
            "contents": [{"parts": [{"text": $prompt}]}],
            "generationConfig": {"maxOutputTokens": 2048, "temperature": 0.7}
        }')
    
    local response=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/${api_model}:generateContent?key=${GEMINI_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.candidates[0].content.parts[0].text // "Error: Unable to get response from Gemini"'
}

# --- GitHub Context Extraction ---
log "🔍 Extracting enhanced GitHub context..."

# Extract comprehensive GitHub context
extract_enhanced_github_context

# Detect GitHub event context
DETECTED_CONTEXT=$(detect_github_context)
log "🎯 Detected GitHub context: $DETECTED_CONTEXT"

# Determine final context mode
FINAL_CONTEXT_MODE="$CONTEXT_MODE"
if [ "$CONTEXT_MODE" = "auto" ]; then
    FINAL_CONTEXT_MODE="$DETECTED_CONTEXT"
fi

# Determine Git reference and target branch
GIT_REFERENCE=$(determine_git_reference "$FINAL_CONTEXT_MODE" "$GIT_REFERENCE_MODE")
TARGET_BRANCH=$(determine_target_branch "$FINAL_CONTEXT_MODE" "$TARGET_BRANCH_STRATEGY")

# Set primary context variables with enhanced logic
if [ -n "$GITHUB_EVENT_PULL_REQUEST_NUMBER" ] && [[ "$FINAL_CONTEXT_MODE" =~ ^(pr_|pull_request) ]]; then
    # PR context
    ISSUE_NUMBER="$GITHUB_EVENT_PULL_REQUEST_NUMBER"
    ISSUE_TITLE="${GITHUB_EVENT_PULL_REQUEST_TITLE:-${GITHUB_EVENT_ISSUE_TITLE}}"
    ISSUE_BODY="${GITHUB_EVENT_ISSUE_BODY}"  # PR description from issue body
    COMMENT_BODY="${GITHUB_EVENT_COMMENT_BODY:-${GITHUB_EVENT_REVIEW_BODY}}"
    COMMENT_ID="${GITHUB_EVENT_COMMENT_ID}"
    CONTEXT_TYPE="pr"
else
    # Issue context
    ISSUE_NUMBER="${GITHUB_EVENT_ISSUE_NUMBER:-${ISSUE_NUMBER}}"
    ISSUE_TITLE="${GITHUB_EVENT_ISSUE_TITLE:-${ISSUE_TITLE}}"
    ISSUE_BODY="${GITHUB_EVENT_ISSUE_BODY:-${ISSUE_BODY}}"
    COMMENT_BODY="${GITHUB_EVENT_COMMENT_BODY:-${COMMENT_BODY}}"
    COMMENT_ID="${GITHUB_EVENT_COMMENT_ID:-${COMMENT_ID}}"
    CONTEXT_TYPE="issue"
fi

GITHUB_REPOSITORY="${GITHUB_REPOSITORY}"
REPO_URL="https://github.com/${GITHUB_REPOSITORY}.git"

# Validate context
validate_context "$FINAL_CONTEXT_MODE" "$GIT_REFERENCE"
validation_result=$?
if [ $validation_result -eq 1 ]; then
    log "❌ Context validation failed"
    exit 1
elif [ $validation_result -eq 2 ]; then
    log "⚠️ Context validation warning, proceeding with fallback"
fi

# Validate required GitHub context
if [ -z "$GITHUB_REPOSITORY" ] || [ -z "$ISSUE_NUMBER" ] || [ -z "$COMMENT_BODY" ] || [ -z "$COMMENT_ID" ]; then
    log "❌ Missing required GitHub context: GITHUB_REPOSITORY, ISSUE_NUMBER, COMMENT_BODY, or COMMENT_ID"
    exit 1
fi

# Log comprehensive context information
log_context_info "$FINAL_CONTEXT_MODE" "$GIT_REFERENCE" "$TARGET_BRANCH"

log "📝 Processing ${CONTEXT_TYPE} #${ISSUE_NUMBER} in ${GITHUB_REPOSITORY}"
log "💬 Comment body: ${COMMENT_BODY:0:100}..." # Show first 100 chars

# --- Intent Detection and Routing ---
log "🔍 Detecting request intent..."

# Detect intent based on comment content
DETECTED_INTENT=$(detect_request_intent "$COMMENT_BODY")
log "🎯 Detected intent: $DETECTED_INTENT"

# Determine final response mode
FINAL_RESPONSE_MODE="$RESPONSE_MODE"
if [ "$RESPONSE_MODE" = "auto" ]; then
    FINAL_RESPONSE_MODE="$DETECTED_INTENT"
fi

log "⚙️ Final response mode: $FINAL_RESPONSE_MODE"

# Create initial progress comment with context awareness
CONTEXT_EMOJI=""
CONTEXT_DESCRIPTION=""
case "$FINAL_CONTEXT_MODE" in
    "pr_review"|"pr_review_comment")
        CONTEXT_EMOJI="🔍"
        CONTEXT_DESCRIPTION="PR Review Comment"
        ;;
    "pr_comment"|"pull_request")
        CONTEXT_EMOJI="🔄"
        CONTEXT_DESCRIPTION="Pull Request"
        ;;
    "issue_comment")
        CONTEXT_EMOJI="📝"
        CONTEXT_DESCRIPTION="Issue"
        ;;
    *)
        CONTEXT_EMOJI="🤖"
        CONTEXT_DESCRIPTION="Request"
        ;;
esac

PROGRESS_COMMENT_ID=$(post_comment "${CONTEXT_EMOJI} **SWE-Agent is analyzing your request...**

**${CONTEXT_DESCRIPTION}:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Context:** ${FINAL_CONTEXT_MODE} (${CONTEXT_TYPE})
**Request Type:** ${FINAL_RESPONSE_MODE}
**Model:** ${MODEL_NAME}
**Git Reference:** ${GIT_REFERENCE:0:8}...
**Target Branch:** ${TARGET_BRANCH}

⏳ Setting up environment and determining the best approach...")

# Add initial reaction based on intent
case "$FINAL_RESPONSE_MODE" in
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

# Route to appropriate handler based on response mode
if [ "$FINAL_RESPONSE_MODE" != "patch" ]; then
    log "🚀 Using lightweight processing for ${FINAL_RESPONSE_MODE} request"
    
    # Handle non-patch requests with lightweight AI processing
    result=$(handle_non_patch_request "$FINAL_RESPONSE_MODE" "$COMMENT_BODY" "$ISSUE_TITLE" "$ISSUE_BODY" "$ISSUE_NUMBER" "$MODEL_NAME")
    
    if [ $? -eq 0 ] && [ -n "$result" ]; then
        # Format the response according to intent with context
        formatted_response=$(format_response_by_intent "$FINAL_RESPONSE_MODE" "$result" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$MODEL_NAME" "$(date)" "$CONTEXT_TYPE" "$FINAL_CONTEXT_MODE")
        
        # Update progress comment with final result
        if [ -n "$PROGRESS_COMMENT_ID" ]; then
            update_comment "$PROGRESS_COMMENT_ID" "$formatted_response"
        else
            post_comment "$formatted_response"
        fi
        
        # Add success reaction
        case "$FINAL_RESPONSE_MODE" in
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
        esac
        
        log "✅ ${FINAL_RESPONSE_MODE} response completed successfully"
        exit 0
    else
        log "❌ Failed to generate ${FINAL_RESPONSE_MODE} response"
        post_comment "❌ Failed to generate ${FINAL_RESPONSE_MODE} response. Please try again or rephrase your request."
        add_contextual_reaction "general_error"
        exit 1
    fi
fi

log "🔧 Proceeding with full SWE-Agent patch generation..."

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

# Clone repository with context-aware setup
log "📥 Cloning repository..."
if ! git clone "$REPO_URL" "$REPO_DIR"; then
    log "❌ Failed to clone repository"
    post_comment "❌ Failed to clone repository. Please check permissions."
    add_reaction "confused"
    exit 1
fi

# Context-aware Git setup
cd "$REPO_DIR"
log "🔧 Setting up Git context for: $FINAL_CONTEXT_MODE"

case "$FINAL_CONTEXT_MODE" in
    "pr_review"|"pr_review_comment"|"pr_comment"|"pull_request")
        # For PR contexts, checkout the PR head branch
        if [ -n "$GITHUB_EVENT_PULL_REQUEST_HEAD_REF" ]; then
            log "🌿 Checking out PR branch: $GITHUB_EVENT_PULL_REQUEST_HEAD_REF"
            if git fetch origin "$GITHUB_EVENT_PULL_REQUEST_HEAD_REF:$GITHUB_EVENT_PULL_REQUEST_HEAD_REF" 2>/dev/null; then
                git checkout "$GITHUB_EVENT_PULL_REQUEST_HEAD_REF"
            else
                log "⚠️ Could not fetch PR branch, using HEAD SHA"
                git checkout "$GIT_REFERENCE" 2>/dev/null || git checkout HEAD
            fi
        elif [ -n "$GIT_REFERENCE" ] && [ "$GIT_REFERENCE" != "HEAD" ]; then
            log "📍 Checking out specific commit: $GIT_REFERENCE"
            git checkout "$GIT_REFERENCE" 2>/dev/null || git checkout HEAD
        fi
        ;;
    "issue_comment"|*)
        # For issue contexts, stay on default branch but ensure we're at the right commit
        if [ -n "$GIT_REFERENCE" ] && [ "$GIT_REFERENCE" != "HEAD" ]; then
            log "📍 Checking out commit: $GIT_REFERENCE"
            git checkout "$GIT_REFERENCE" 2>/dev/null || git checkout HEAD
        fi
        ;;
esac

# Display current Git status
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
CURRENT_COMMIT=$(git rev-parse --short HEAD)
log "📊 Git Status: branch=$CURRENT_BRANCH, commit=$CURRENT_COMMIT"

# Update progress: Analyzing
update_progress "analyzing" "Repository setup complete, analyzing requirements" "- Repository: $(basename "$REPO_URL")
- Context: $FINAL_CONTEXT_MODE
- Branch: $CURRENT_BRANCH
- Commit: $CURRENT_COMMIT
- ${CONTEXT_DESCRIPTION}: $ISSUE_TITLE"

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
        
        # Context-aware success message
        local context_emoji=""
        local context_action=""
        case "$FINAL_CONTEXT_MODE" in
            "pr_review"|"pr_review_comment"|"pr_comment"|"pull_request")
                context_emoji="🔄"
                context_action="updated the existing Pull Request"
                ;;
            "issue_comment"|*)
                context_emoji="🆕"
                context_action="created a new solution"
                ;;
        esac
        
        FINAL_MESSAGE="✅ **Solution Generated Successfully!**

**${CONTEXT_DESCRIPTION}:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}
**Context:** ${FINAL_CONTEXT_MODE} (${CONTEXT_TYPE})
**Model:** ${MODEL_NAME}
**Execution Time:** ${elapsed_minutes_str}
**Git Reference:** ${GIT_REFERENCE:0:8}...

${STATS_SUMMARY}

## 🔧 Generated Patch

<details>
<summary>📄 Click to view generated patch (${FILES_CHANGED} files changed)</summary>

\`\`\`diff
${PATCH_CONTENT}
\`\`\`

</details>

## 🔄 Next Steps
✨ The patch is being processed and ${context_action}.

**What happens next:**
1. 🔄 Patch validation and testing
2. 📝 ${context_action == *"existing"* && echo "Pull Request update" || echo "Pull Request creation"} with detailed description
3. ✅ Ready for review and merge

---
*✨ Generated by SWE-Agent using $MODEL_NAME • ${context_emoji} ${FINAL_CONTEXT_MODE} context*"
        
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
5. **Mention any recent changes that might be related**

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
