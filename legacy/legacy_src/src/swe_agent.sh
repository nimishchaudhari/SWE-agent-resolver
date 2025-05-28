#!/bin/bash

# src/swe_agent.sh - SWE-Agent execution and orchestration
# Manages SWE-Agent execution, diagnostics, and error handling

set -e

# --- SWE-Agent Diagnostics ---
run_swe_agent_diagnostics() {
    log "🔍 Checking for sweagent command..."
    local sweagent_path=$(command -v sweagent)
    
    if [ -z "$sweagent_path" ] || ! command -v sweagent > /dev/null 2>&1; then
        log_error "Critical Error: sweagent command not found in PATH."
        return 1
    else
        log_success "sweagent command found at: $sweagent_path"
    fi
    
    # Check config file
    if [ -r "/app/swe-agent/config/default.yaml" ]; then
        log "📄 Config file /app/swe-agent/config/default.yaml found and readable."
    else
        log_warning "Config file /app/swe-agent/config/default.yaml not found or not readable."
    fi
    
    # Test help command
    log "🩺 Attempting 'sweagent -h'..."
    local help_output_file="$TEMP_DIR/sweagent_help_output.log"
    
    if sweagent -h > "$help_output_file" 2>&1; then
        log_success "'sweagent -h' succeeded."
        if [ -s "$help_output_file" ]; then
            log "📋 Help command output (first 15 lines):"
            head -n 15 "$help_output_file" | while IFS= read -r line; do log "  $line"; done
        else
            log "ℹ️ 'sweagent -h' produced no output, but exited successfully."
        fi
    else
        local help_exit_code=$?
        log_error "'sweagent -h' failed with exit code $help_exit_code."
        return 2
    fi
    
    return 0
}

# --- Enhanced SWE-Agent Execution ---
execute_swe_agent_with_context() {
    local output_dir="$1"
    local problem_statement_file="$2"
    local model_name="$3"
    
    log "🤖 Executing SWE-Agent with context..."
    log "  Model: $model_name"
    log "  Problem statement: $problem_statement_file"
    log "  Output directory: $output_dir"
    
    # Validate inputs
    if [ ! -f "$problem_statement_file" ]; then
        log_error "Problem statement file not found: $problem_statement_file"
        return 1
    fi
    
    # Create output directory if it doesn't exist
    mkdir -p "$output_dir"
    
    # Execute SWE-Agent with the current repository as context
    local repo_dir="$(pwd)"
    execute_swe_agent "$model_name" "$repo_dir" "$problem_statement_file" "$output_dir"
    
    return $?
}

# --- Problem Statement Creation ---
create_problem_statement_with_context() {
    local output_dir="$1"
    local issue_title="$2"
    local issue_body="$3"
    local comment_body="$4"
    
    local problem_statement_file="$output_dir/problem_statement.md"
    
    # Enhanced problem statement with more context
    cat > "$problem_statement_file" << EOF
# GitHub Issue: $issue_title

## Original Issue Description
$issue_body

## User Comment/Request
$comment_body

## Repository Context
This is a GitHub repository issue that needs to be resolved. Please analyze the codebase, understand the problem, and provide a complete solution.

## Instructions
1. Analyze the repository structure and understand the codebase
2. Identify the root cause of the issue
3. Implement a comprehensive fix
4. Ensure the solution follows best practices
5. Test the changes if possible

## Expected Output
Please provide a working solution that addresses the issue described above.
EOF
    
    log "📝 Created problem statement: $problem_statement_file"
    echo "$problem_statement_file"
}

# Backward compatibility alias
create_problem_statement() {
    create_problem_statement_with_context "$@"
}

# --- SWE-Agent Execution ---
execute_swe_agent() {
    local model_name="$1"
    local repo_dir="$2"
    local problem_statement_file="$3"
    local output_dir="$4"
    
    log "🤖 Running SWE-Agent with model: $model_name"
    
    # Get model-specific parameters
    source "$(dirname "${BASH_SOURCE[0]}")/config.sh"
    local model_params=($(get_model_parameters "$model_name"))
    
    # Execute SWE-Agent with correct 1.0+ command format
    sweagent run \
        --agent.model.name "$model_name" \
        --agent.model.per_instance_cost_limit 2.0 \
        --env.repo.path "$repo_dir" \
        --env.deployment.type "local" \
        --problem_statement.path "$problem_statement_file" \
        --output_dir "$output_dir" \
        --config /app/swe-agent/config/default.yaml \
        --actions.apply_patch_locally false \
        "${model_params[@]}" \
        2>&1 | tee "$output_dir/swe_agent.log"
    
    return ${PIPESTATUS[0]}
}

# --- Result Processing ---
process_swe_agent_results() {
    local exit_code="$1"
    local output_dir="$2"
    local execution_time="$3"
    
    # Source utility functions
    source "$(dirname "${BASH_SOURCE[0]}")/utils.sh"
    source "$(dirname "${BASH_SOURCE[0]}")/response_formatter.sh"
    source "$(dirname "${BASH_SOURCE[0]}")/github.sh"
    
    if [ $exit_code -eq 0 ]; then
        log_success "SWE-Agent completed successfully"
        
        # Look for patches in output
        local patch_content
        if patch_content=$(find_patch_in_output "$output_dir"); then
            log_success "Patch found and processed"
            
            # Set action outputs
            set_patch_outputs "true" "$execution_time" "$patch_content"
            
            # Generate and return success message
            local success_message
            success_message=$(format_success_message "$patch_content" "$ISSUE_NUMBER" "$ISSUE_TITLE" "$MODEL_NAME" "$execution_time" "$GIT_REFERENCE" "$FINAL_CONTEXT_MODE" "$CONTEXT_TYPE")
            
            echo "$success_message"
            return 0
        else
            log_warning "No patch found in SWE-Agent output"
            
            # Set action outputs for no patch
            set_patch_outputs "false" "$execution_time" ""
            
            # Generate and return no-patch message
            local no_patch_message
            no_patch_message=$(format_no_patch_message "$ISSUE_NUMBER" "$ISSUE_TITLE" "$MODEL_NAME" "$execution_time")
            
            echo "$no_patch_message"
            return 1
        fi
    else
        log_error "SWE-Agent execution failed with exit code: $exit_code"
        
        # Set action outputs for failure
        set_patch_outputs "false" "$execution_time" ""
        
        # Generate appropriate error message based on exit code
        local error_message
        case $exit_code in
            124)
                error_message=$(format_timeout_message "$ISSUE_NUMBER" "$ISSUE_TITLE" "$MODEL_NAME" "$execution_time")
                add_contextual_reaction "timeout"
                ;;
            137)
                error_message=$(format_killed_message "$ISSUE_NUMBER" "$ISSUE_TITLE" "$MODEL_NAME" "$execution_time")
                add_contextual_reaction "killed"
                ;;
            *)
                error_message=$(format_failure_message "$ISSUE_NUMBER" "$ISSUE_TITLE" "$MODEL_NAME" "$execution_time" "$exit_code" "$output_dir")
                if [ "$exit_code" -eq 1 ]; then
                    add_contextual_reaction "api_error"
                else
                    add_contextual_reaction "general_error"
                fi
                ;;
        esac
        
        echo "$error_message"
        return $exit_code
    fi
}

# --- Result Processing (Updated) ---
process_swe_agent_output() {
    local output_dir="$1"
    
    log "📊 Processing SWE-Agent output from: $output_dir"
    
    # Look for patch files in various locations
    local patch_files=(
        "$output_dir/patch.patch"
        "$output_dir/patches/patch.patch"
        "$output_dir/trajectory.json"
        "$output_dir/run_instance.json"
    )
    
    local found_patch=""
    for patch_file in "${patch_files[@]}"; do
        if [ -f "$patch_file" ] && [ -s "$patch_file" ]; then
            found_patch="$patch_file"
            log "✅ Found output file: $patch_file"
            break
        fi
    done
    
    if [ -n "$found_patch" ]; then
        # Extract patch content based on file type
        if [[ "$found_patch" == *.patch ]]; then
            cat "$found_patch"
        elif [[ "$found_patch" == *.json ]]; then
            # Extract patch from JSON trajectory
            jq -r '.patch // .final_patch // ""' "$found_patch" 2>/dev/null || cat "$found_patch"
        fi
        return 0
    else
        log "⚠️ No patch files found in output directory"
        return 1
    fi
}

# --- Error Message Formatting ---
format_timeout_message() {
    local issue_number="$1"
    local issue_title="$2"
    local model_name="$3"
    local execution_time="$4"
    
    cat << EOF
⏰ **Analysis Timeout - Let's Optimize the Request**

**Issue:** #${issue_number} - ${issue_title}  
**Model:** ${model_name}
**Runtime:** ${execution_time} (exceeded expected completion time)

## ⏱️ What Happened
The analysis took longer than expected and was stopped as a safety measure.

## 🎯 Quick Fixes to Try

<details>
<summary>🚀 Make Your Request More Efficient</summary>

### ✅ **Effective Requests:**
- "Fix TypeError on line 123 in utils.py"
- "Update deprecated API call in user_service.py"
- "Fix import error in main.py after recent changes"

### ❌ **Requests That May Timeout:**
- "Fix all bugs in the application"
- "Refactor the entire codebase"
- "Improve performance everywhere"

### 📋 **Best Practices:**
1. **Focus on ONE specific issue**
2. **Include file names and line numbers**
3. **Provide error messages or stack traces**
4. **Describe expected vs actual behavior**
5. **Mention any recent changes that might be related**

</details>

## 🔄 Ready to Try Again?
Comment \`@swe-agent\` with a **focused, specific request** - the more precise, the faster the results!

**Example:** \`@swe-agent Fix the import error in auth.py line 15 - cannot import User from models\`

---
*⏰ SWE-Agent using $model_name • Runtime optimization needed*
EOF
}

format_killed_message() {
    local issue_number="$1"
    local issue_title="$2"
    local model_name="$3"
    local execution_time="$4"
    
    cat << EOF
💀 **SWE-Agent Process Terminated**

**Issue:** #${issue_number} - ${issue_title}
**Model:** ${model_name}  
**Result:** Process was terminated (likely due to hanging or resource limits, runtime: ${execution_time})

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
*💀 SWE-Agent using $model_name (runtime: ${execution_time})*
EOF
}

format_failure_message() {
    local issue_number="$1"
    local issue_title="$2"
    local model_name="$3"
    local execution_time="$4"
    local exit_code="$5"
    local output_dir="$6"
    
    # Source utility functions for error analysis
    source "$(dirname "${BASH_SOURCE[0]}")/utils.sh"
    
    # Extract error information
    local error_info=$(extract_error_info "$output_dir/swe_agent.log")
    local log_preview=$(get_log_preview "$output_dir/swe_agent.log")
    
    # Show diagnostic information
    log "🔍 Diagnostic Information:"
    log "  - Model: $model_name"
    log "  - Repository: $REPO_DIR"
    log "  - Problem statement: $output_dir/problem_statement.md"
    log "  - Output directory: $output_dir"
    
    if [ -f "$output_dir/swe_agent.log" ]; then
        local log_size=$(wc -l < "$output_dir/swe_agent.log")
        log "  - Log file size: $log_size lines"
    else
        log "  - No log file found at $output_dir/swe_agent.log"
    fi
    
    cat << EOF
❌ **Analysis Failed - Let's Diagnose and Fix This**

**Issue:** #${issue_number} - ${issue_title}
**Model:** ${model_name}
**Exit Code:** ${exit_code}
**Runtime:** ${execution_time}

## 🚨 What Happened
I encountered an error while analyzing this issue. Let's figure out what went wrong and how to fix it.

## 🔍 Diagnostic Summary
- **Model:** ${model_name} $([ "$exit_code" -eq 1 ] && echo "(❌ Model access issue)" || echo "(✅ Model accessible)")
- **Exit Code:** ${exit_code} $([ "$exit_code" -eq 1 ] && echo "(API/Authentication error)" || echo "")
- **Repository:** ✅ Successfully cloned
- **Issue Processing:** ✅ Problem statement created

## 📋 Error Analysis
${error_info}

<details>
<summary>🔍 Technical Details (Click to expand)</summary>

${log_preview}

</details>

## 🛠️ Smart Recovery Suggestions

<details>
<summary>🎯 Based on the error, try these solutions</summary>

### 🔧 **Immediate Actions:**
$(if [ "$exit_code" -eq 1 ]; then
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
*❌ SWE-Agent using $model_name • Error recovery assistance available*
EOF
}
