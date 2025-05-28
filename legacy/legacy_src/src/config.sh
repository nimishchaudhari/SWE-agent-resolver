#!/bin/bash

# src/config.sh - Configuration management for SWE-Agent
# Handles environment variables, API keys, and configuration validation

set -e

# --- Configuration Variables ---
setup_configuration() {
    # GitHub and Repository Configuration
    export GITHUB_TOKEN="${INPUT_GITHUB_TOKEN}"
    export TRIGGER_PHRASE="${INPUT_TRIGGER_PHRASE:-@swe-agent}"
    export GITHUB_API_URL="${GITHUB_API_URL:-https://api.github.com}"
    export GITHUB_REPOSITORY="${GITHUB_REPOSITORY}"
    
    # AI Model Configuration
    export LLM_API_KEY="${INPUT_LLM_API_KEY}"
    export OPENAI_API_KEY="${INPUT_OPENAI_API_KEY}"
    export ANTHROPIC_API_KEY="${INPUT_ANTHROPIC_API_KEY}"
    export DEEPSEEK_API_KEY="${INPUT_DEEPSEEK_API_KEY}"
    export OPENROUTER_API_KEY="${INPUT_OPENROUTER_API_KEY}"
    export GEMINI_API_KEY="${INPUT_GEMINI_API_KEY}"
    export MODEL_NAME="${INPUT_MODEL_NAME:-gpt-4o}"
    
    # Enhanced Response Mode Configuration
    export RESPONSE_MODE="${INPUT_RESPONSE_MODE:-auto}"
    export ENABLE_VISUAL_CONTENT="${INPUT_ENABLE_VISUAL_CONTENT:-true}"
    export VISUAL_CONTENT_FORMAT="${INPUT_VISUAL_CONTENT_FORMAT:-all}"
    export MAX_COMMENT_LENGTH="${INPUT_MAX_COMMENT_LENGTH:-65536}"
    
    # Multi-Context Support Configuration
    export CONTEXT_MODE="${INPUT_CONTEXT_MODE:-auto}"
    export PR_STRATEGY="${INPUT_PR_STRATEGY:-continue}"
    export GIT_REFERENCE_MODE="${INPUT_GIT_REFERENCE_MODE:-auto}"
    export ENABLE_REVIEW_CONTEXT="${INPUT_ENABLE_REVIEW_CONTEXT:-true}"
    export TARGET_BRANCH_STRATEGY="${INPUT_TARGET_BRANCH_STRATEGY:-auto}"
}

# Validate required configuration
validate_configuration() {
    local validation_errors=()
    
    # Check required GitHub configuration
    if [ -z "$GITHUB_TOKEN" ]; then
        validation_errors+=("GITHUB_TOKEN is required")
    fi
    
    if [ -z "$GITHUB_REPOSITORY" ]; then
        validation_errors+=("GITHUB_REPOSITORY is required")
    fi
    
    # Check for at least one API key
    local api_keys_configured=()
    [ -n "$OPENAI_API_KEY" ] && api_keys_configured+=("OpenAI")
    [ -n "$ANTHROPIC_API_KEY" ] && api_keys_configured+=("Anthropic") 
    [ -n "$DEEPSEEK_API_KEY" ] && api_keys_configured+=("DeepSeek")
    [ -n "$OPENROUTER_API_KEY" ] && api_keys_configured+=("OpenRouter")
    [ -n "$GEMINI_API_KEY" ] && api_keys_configured+=("Gemini")
    
    if [ ${#api_keys_configured[@]} -eq 0 ]; then
        log "⚠️ No API keys detected in environment variables. SWE-Agent will attempt to proceed - LiteLLM may have other authentication methods."
    else
        log "✅ API keys configured for: $(IFS=', '; echo "${api_keys_configured[*]}")"
    fi
    
    # Report validation errors
    if [ ${#validation_errors[@]} -gt 0 ]; then
        log "❌ Configuration validation failed:"
        for error in "${validation_errors[@]}"; do
            log "  - $error"
        done
        return 1
    fi
    
    log "✅ Configuration validation passed"
    return 0
}

# Get model-specific parameters for SWE-Agent execution
get_model_parameters() {
    local model_name="$1"
    local params=()
    
    # Special handling for reasoning models
    if [[ "$model_name" == "openai/o1" || "$model_name" == "openai/o3" || "$model_name" == "openai/o3-mini" || "$model_name" == "openai/o4-mini" ]]; then
        params+=("--agent.model.top_p" "null" "--agent.model.temperature" "1.0")
    fi
    
    printf '%s\n' "${params[@]}"
}

# Display configuration summary
display_configuration_summary() {
    log "📋 Configuration Summary:"
    log "  - Model: $MODEL_NAME"
    log "  - Response Mode: $RESPONSE_MODE"
    log "  - Context Mode: $CONTEXT_MODE"
    log "  - Visual Content: $ENABLE_VISUAL_CONTENT"
    log "  - Repository: $GITHUB_REPOSITORY"
    log "  - Trigger Phrase: $TRIGGER_PHRASE"
}
