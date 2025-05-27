#!/bin/bash

# src/ai_api.sh - AI API client functions
# Handles interactions with various AI service providers

set -e

# --- OpenAI API ---
call_openai_api() {
    local prompt="$1"
    local model="$2"
    
    # Default to gpt-4o if model not specified or not supported
    local api_model="$model"
    if [[ ! "$model" =~ ^(gpt-4o|gpt-4-turbo|gpt-3.5-turbo|gpt-4|o3|o3-mini|o4-mini)$ ]]; then
        api_model="gpt-4o"
    fi
    
    # Special handling for o3/o4 models - set temperature=1 and top_p=0
    local json_payload
    if [[ "$api_model" =~ ^(o3|o3-mini|o4-mini)$ ]]; then
        json_payload=$(jq -n \
            --arg model "$api_model" \
            --arg prompt "$prompt" \
            '{
                "model": $model,
                "messages": [{"role": "user", "content": $prompt}],
                "temperature": 1,
                "top_p": 0
            }')
    else
        # Use OpenAI defaults for all other models
        json_payload=$(jq -n \
            --arg model "$api_model" \
            --arg prompt "$prompt" \
            '{
                "model": $model,
                "messages": [{"role": "user", "content": $prompt}]
            }')
    fi
    
    local response=$(curl -s -X POST "https://api.openai.com/v1/chat/completions" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.choices[0].message.content // "Error: Unable to get response from OpenAI"'
}

# --- Anthropic API ---
call_anthropic_api() {
    local prompt="$1"
    local model="$2"
    
    # Default to claude-3-5-sonnet if model not specified or not supported
    local api_model="$model"
    if [[ ! "$model" =~ ^(claude-3-5-sonnet|claude-3-haiku|claude-3-opus)$ ]]; then
        api_model="claude-3-5-sonnet-20241022"
    fi
    
    # Use Anthropic defaults - no max_tokens or temperature override
    local json_payload=$(jq -n \
        --arg model "$api_model" \
        --arg prompt "$prompt" \
        '{
            "model": $model,
            "messages": [{"role": "user", "content": $prompt}]
        }')
    
    local response=$(curl -s -X POST "https://api.anthropic.com/v1/messages" \
        -H "X-API-Key: $ANTHROPIC_API_KEY" \
        -H "Content-Type: application/json" \
        -H "anthropic-version: 2023-06-01" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.content[0].text // "Error: Unable to get response from Anthropic"'
}

# --- OpenRouter API ---
call_openrouter_api() {
    local prompt="$1"
    local model="$2"
    
    # Use OpenRouter defaults - no parameter overrides
    local json_payload=$(jq -n \
        --arg model "$model" \
        --arg prompt "$prompt" \
        '{
            "model": $model,
            "messages": [{"role": "user", "content": $prompt}]
        }')
    
    local response=$(curl -s -X POST "https://openrouter.ai/api/v1/chat/completions" \
        -H "Authorization: Bearer $OPENROUTER_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.choices[0].message.content // "Error: Unable to get response from OpenRouter"'
}

# --- Gemini API ---
call_gemini_api() {
    local prompt="$1"
    local model="$2"
    
    # Default to gemini-pro if model not specified
    local api_model="gemini-pro"
    if [[ "$model" =~ ^(gemini-pro|gemini-1.5-pro|gemini-1.5-flash)$ ]]; then
        api_model="$model"
    fi
    
    # Use Gemini defaults - no parameter overrides
    local json_payload=$(jq -n \
        --arg prompt "$prompt" \
        '{
            "contents": [{"parts": [{"text": $prompt}]}]
        }')
    
    local response=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/${api_model}:generateContent?key=${GEMINI_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.candidates[0].content.parts[0].text // "Error: Unable to get response from Gemini"'
}

# --- DeepSeek API ---
call_deepseek_api() {
    local prompt="$1"
    local model="$2"
    
    # Default to deepseek-coder if model not specified
    local api_model="$model"
    if [[ ! "$model" =~ ^(deepseek-coder|deepseek-chat)$ ]]; then
        api_model="deepseek-coder"
    fi
    
    # Use DeepSeek defaults - no parameter overrides
    local json_payload=$(jq -n \
        --arg model "$api_model" \
        --arg prompt "$prompt" \
        '{
            "model": $model,
            "messages": [{"role": "user", "content": $prompt}]
        }')
    
    local response=$(curl -s -X POST "https://api.deepseek.com/v1/chat/completions" \
        -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    echo "$response" | jq -r '.choices[0].message.content // "Error: Unable to get response from DeepSeek"'
}

# --- API Provider Selection ---
get_available_api_providers() {
    local providers=()
    
    [ -n "$OPENAI_API_KEY" ] && providers+=("openai")
    [ -n "$ANTHROPIC_API_KEY" ] && providers+=("anthropic")
    [ -n "$DEEPSEEK_API_KEY" ] && providers+=("deepseek")
    [ -n "$OPENROUTER_API_KEY" ] && providers+=("openrouter")
    [ -n "$GEMINI_API_KEY" ] && providers+=("gemini")
    
    printf '%s\n' "${providers[@]}"
}

# Auto-select best API provider for a given model
select_api_provider_for_model() {
    local model="$1"
    local provider=""
    
    # Model-specific provider mapping
    if [[ "$model" =~ ^(gpt-4|gpt-3.5|gpt-4o) ]]; then
        provider="openai"
    elif [[ "$model" =~ ^(claude-3) ]]; then
        provider="anthropic"
    elif [[ "$model" =~ ^(deepseek) ]]; then
        provider="deepseek"
    elif [[ "$model" =~ ^(gemini) ]]; then
        provider="gemini"
    else
        # Default to first available provider
        local available_providers=($(get_available_api_providers))
        if [ ${#available_providers[@]} -gt 0 ]; then
            provider="${available_providers[0]}"
        fi
    fi
    
    echo "$provider"
}

# --- High-Level AI Functions ---
get_repository_analysis() {
    local prompt="Analyze this repository structure and provide insights about its architecture, technologies used, and potential improvements."
    
    call_ai_api "$prompt" "$MODEL_NAME"
}

get_ai_opinion() {
    local comment="$1"
    local prompt="Provide an expert opinion and recommendations for: $comment"
    
    call_ai_api "$prompt" "$MODEL_NAME"
}

generate_visual_content() {
    local request="$1"
    local prompt="Create visual content (mermaid diagram, ASCII art, or markdown visualization) for: $request"
    
    call_ai_api "$prompt" "$MODEL_NAME"
}

get_pr_diff() {
    local pr_number="$1"
    
    # Use GitHub API to get PR diff
    curl -s -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3.diff" \
        "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/pulls/$pr_number"
}

generate_pr_review() {
    local diff_content="$1"
    local review_request="$2"
    
    local prompt="Review this pull request diff and provide feedback:

Diff:
$diff_content

Review request: $review_request

Please provide a thorough code review with specific suggestions."
    
    call_ai_api "$prompt" "$MODEL_NAME"
}

# --- Universal AI API Caller ---
call_ai_api() {
    local prompt="$1"
    local model="$2"
    
    # Determine which API to use based on model name and available keys
    if [[ "$model" =~ ^(gpt-|o1-) ]] && [ -n "$OPENAI_API_KEY" ]; then
        call_openai_api "$prompt" "$model"
    elif [[ "$model" =~ ^claude- ]] && [ -n "$ANTHROPIC_API_KEY" ]; then
        call_anthropic_api "$prompt" "$model"
    elif [[ "$model" =~ ^(deepseek|coder) ]] && [ -n "$DEEPSEEK_API_KEY" ]; then
        call_deepseek_api "$prompt" "$model"
    elif [ -n "$OPENROUTER_API_KEY" ]; then
        call_openrouter_api "$prompt" "$model"
    elif [ -n "$OPENAI_API_KEY" ]; then
        call_openai_api "$prompt" "gpt-4o"
    else
        echo "Error: No valid AI API key found"
        return 1
    fi
}

# Call appropriate API based on model or provider preference
call_ai_api() {
    local prompt="$1"
    local model="$2"
    local preferred_provider="$3"
    
    local provider="$preferred_provider"
    if [ -z "$provider" ]; then
        provider=$(select_api_provider_for_model "$model")
    fi
    
    case "$provider" in
        "openai")
            call_openai_api "$prompt" "$model"
            ;;
        "anthropic")
            call_anthropic_api "$prompt" "$model"
            ;;
        "deepseek")
            call_deepseek_api "$prompt" "$model"
            ;;
        "openrouter")
            call_openrouter_api "$prompt" "$model"
            ;;
        "gemini")
            call_gemini_api "$prompt" "$model"
            ;;
        *)
            echo "Error: No suitable API provider found for model: $model"
            return 1
            ;;
    esac
}

# Test API connectivity
test_api_connectivity() {
    local providers=($(get_available_api_providers))
    local test_prompt="Hello, this is a connectivity test."
    local working_providers=()
    
    log "🔍 Testing API connectivity..."
    
    for provider in "${providers[@]}"; do
        log "  Testing $provider..."
        local response=$(call_ai_api "$test_prompt" "default" "$provider" 2>/dev/null)
        
        if [[ ! "$response" =~ ^Error: ]] && [ -n "$response" ]; then
            working_providers+=("$provider")
            log "  ✅ $provider: Connected"
        else
            log "  ❌ $provider: Failed"
        fi
    done
    
    if [ ${#working_providers[@]} -gt 0 ]; then
        log "✅ Working API providers: $(IFS=', '; echo "${working_providers[*]}")"
        return 0
    else
        log_error "No working API providers found"
        return 1
    fi
}
