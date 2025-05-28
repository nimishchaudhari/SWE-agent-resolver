#!/bin/bash

# src/intent.sh - Intent detection and request routing
# Determines user intent and routes to appropriate handling

set -e

# --- Intent Detection ---
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

# --- Visual Content Generation ---
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

# --- Non-Patch Request Handler ---
handle_non_patch_request() {
    local intent="$1"
    local comment_body="$2"
    local issue_title="$3"
    local issue_body="$4"
    local issue_number="$5"
    local model_name="$6"
    
    # Source AI API functions
    source "$(dirname "${BASH_SOURCE[0]}")/ai_api.sh"
    
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
    
    # Try available API providers in order of preference
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
        log_error "No API keys available for lightweight AI processing"
        response_content="I apologize, but I don't have access to AI services to provide this type of response. Please ensure you have configured at least one API key (OpenAI, Anthropic, OpenRouter, or Gemini) in your repository secrets."
        return 1
    fi
    
    # Validate response
    if [ "$api_call_success" = true ] && [ -n "$response_content" ] && [ ${#response_content} -gt 10 ]; then
        log_success "Successfully generated $intent response (${#response_content} characters)"
        echo "$response_content"
        return 0
    else
        log_error "Failed to generate valid $intent response: $response_content"
        return 1
    fi
}

# --- Main Intent Detection Function ---
detect_intent_from_comment() {
    local comment_body="${GITHUB_EVENT_COMMENT_BODY:-}"
    
    if [ -z "$comment_body" ]; then
        echo "patch"  # default intent
        return
    fi
    
    detect_request_intent "$comment_body"
}

# --- Intent-Based Routing ---
route_request_by_intent() {
    local intent="$1"
    local comment_body="$2"
    local issue_title="$3"
    local issue_body="$4"
    local issue_number="$5"
    local model_name="$6"
    
    case "$intent" in
        "patch")
            log "🔧 Routing to full SWE-Agent patch generation..."
            return 0  # Continue with SWE-Agent execution
            ;;
        "opinion"|"analysis"|"visual"|"pr_review")
            log "🚀 Using lightweight processing for ${intent} request"
            
            # Handle non-patch requests with lightweight AI processing
            local result
            result=$(handle_non_patch_request "$intent" "$comment_body" "$issue_title" "$issue_body" "$issue_number" "$model_name")
            
            if [ $? -eq 0 ] && [ -n "$result" ]; then
                echo "$result"
                return 1  # Indicate lightweight processing was used
            else
                log_error "Failed to generate ${intent} response"
                return 2  # Indicate failure
            fi
            ;;
        *)
            log_warning "Unknown intent: $intent - defaulting to patch generation"
            return 0  # Continue with SWE-Agent execution
            ;;
    esac
}
