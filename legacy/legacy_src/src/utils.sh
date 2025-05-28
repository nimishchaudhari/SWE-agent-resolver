#!/bin/bash

# src/utils.sh - Core utility functions for SWE-Agent
# Common logging, error handling, and helper functions

set -e

# --- Logging Functions ---
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

log_warning() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*" >&2
}

log_success() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $*"
}

# --- File and Directory Utilities ---
create_temp_directory() {
    local temp_dir="/tmp/swe_agent_$(date +%s)"
    mkdir -p "$temp_dir"
    echo "$temp_dir"
}

setup_workspace_directories() {
    local base_dir="$1"
    local repo_dir="$base_dir/repo"
    local output_dir="$base_dir/output"
    
    mkdir -p "$repo_dir" "$output_dir"
    
    # Export for use by other modules
    export TEMP_DIR="$base_dir"
    export REPO_DIR="$repo_dir"
    export OUTPUT_DIR="$output_dir"
    
    log "📁 Workspace directories created:"
    log "  - Base: $base_dir"
    log "  - Repository: $repo_dir"
    log "  - Output: $output_dir"
}

# --- Time Tracking ---
start_timer() {
    local timer_file="$1/start_time"
    echo "$(date +%s)" > "$timer_file"
    log "⏱️ Timer started"
}

get_elapsed_time() {
    local timer_file="$1/start_time"
    local elapsed_str="N/A"
    
    if [ -f "$timer_file" ]; then
        local start_time_val=$(cat "$timer_file")
        local current_time_val=$(date +%s)
        
        if [[ "$start_time_val" =~ ^[0-9]+$ ]] && [[ "$current_time_val" =~ ^[0-9]+$ ]] && [ "$start_time_val" -le "$current_time_val" ]; then
            local elapsed_seconds=$((current_time_val - start_time_val))
            local elapsed_minutes=$((elapsed_seconds / 60))
            
            if [ "$elapsed_minutes" -gt 0 ]; then
                elapsed_str="${elapsed_minutes} minutes"
            elif [ "$elapsed_seconds" -gt 0 ]; then
                elapsed_str="${elapsed_seconds} seconds"
            else
                elapsed_str="< 1 second"
            fi
        fi
    fi
    
    echo "$elapsed_str"
}

# --- Patch Processing ---
find_patch_in_output() {
    local output_dir="$1"
    local patch_content=""
    local patch_found=false
    
    # Check for .patch files
    for patch_file in $(find "$output_dir" -name "*.patch" 2>/dev/null || true); do
        if [ -s "$patch_file" ]; then
            patch_content=$(cat "$patch_file")
            patch_found=true
            log "📄 Found patch file: $patch_file"
            break
        fi
    done
    
    # Check for trajectory files with patches
    if [ "$patch_found" = false ]; then
        for traj_file in $(find "$output_dir" -name "*.traj" 2>/dev/null || true); do
            if [ -s "$traj_file" ]; then
                # Extract patch from trajectory file if present
                patch_content=$(grep -A 1000 "diff --git" "$traj_file" | head -n 500 || true)
                if [ -n "$patch_content" ] && [[ "$patch_content" == *"diff --git"* ]]; then
                    patch_found=true
                    log "📄 Found patch in trajectory file: $traj_file"
                    break
                fi
            fi
        done
    fi
    
    # Check for any diff output in logs
    if [ "$patch_found" = false ]; then
        patch_content=$(grep -A 100 "diff --git" "$output_dir/swe_agent.log" 2>/dev/null || true)
        if [ -n "$patch_content" ] && [[ "$patch_content" == *"diff --git"* ]]; then
            patch_found=true
            log "📄 Found patch in SWE-Agent logs"
        fi
    fi
    
    if [ "$patch_found" = true ]; then
        echo "$patch_content"
        return 0
    else
        return 1
    fi
}

calculate_patch_statistics() {
    local patch_content="$1"
    local files_changed=0
    local lines_added=0
    local lines_removed=0
    
    if [ -n "$patch_content" ]; then
        files_changed=$(echo "$patch_content" | grep -c "^diff --git" || echo "0")
        lines_added=$(echo "$patch_content" | grep -c "^+" || echo "0")
        lines_removed=$(echo "$patch_content" | grep -c "^-" || echo "0")
        
        # Subtract the diff headers from line counts
        lines_added=$((lines_added - files_changed))
        lines_removed=$((lines_removed - files_changed))
        
        if [ $lines_added -lt 0 ]; then lines_added=0; fi
        if [ $lines_removed -lt 0 ]; then lines_removed=0; fi
    fi
    
    echo "$files_changed:$lines_added:$lines_removed"
}

truncate_patch_if_needed() {
    local patch_content="$1"
    local max_length="${2:-40000}"
    local truncated=false
    
    if [ ${#patch_content} -gt $max_length ]; then
        patch_content="${patch_content:0:$max_length}
...
(Patch truncated - too long for comment)"
        truncated=true
    fi
    
    echo "$patch_content"
    if [ "$truncated" = true ]; then
        return 1
    else
        return 0
    fi
}

# --- Error Analysis ---
extract_error_info() {
    local log_file="$1"
    local error_info=""
    
    if [ -f "$log_file" ]; then
        error_info=$(tail -20 "$log_file" 2>/dev/null | grep -E "(Error|Exception|Failed|Traceback)" | head -3 || echo "No specific errors found in log")
    else
        error_info="No log file was created - SWE-Agent failed immediately"
    fi
    
    echo "$error_info"
}

get_log_preview() {
    local log_file="$1"
    local preview=""
    
    if [ -f "$log_file" ]; then
        local first_10_lines=$(head -10 "$log_file" 2>/dev/null || echo "Could not read log file")
        local last_10_lines=$(tail -10 "$log_file" 2>/dev/null || echo "Could not read log file")
        
        preview="**First 10 lines of log:**
\`\`\`
${first_10_lines}
\`\`\`

**Last 10 lines of log:**
\`\`\`
${last_10_lines}
\`\`\`"
    else
        preview="No log file found at $log_file"
    fi
    
    echo "$preview"
}

# --- GitHub Action Outputs ---
set_action_output() {
    local key="$1"
    local value="$2"
    
    echo "${key}=${value}" >> $GITHUB_OUTPUT
}

set_patch_outputs() {
    local patch_generated="$1"
    local execution_time="$2"
    local patch_content="$3"
    
    set_action_output "patch_generated" "$patch_generated"
    set_action_output "execution_time" "$execution_time"
    
    if [ "$patch_generated" = "true" ] && [ -n "$patch_content" ]; then
        # Write patch content to a file and set output
        local patch_output_file="$GITHUB_WORKSPACE/swe_agent_patch.txt"
        printf '%s\n' "$patch_content" > "$patch_output_file"
        
        echo "patch_content<<EOF" >> $GITHUB_OUTPUT
        printf '%s\n' "$patch_content" >> $GITHUB_OUTPUT
        echo "EOF" >> $GITHUB_OUTPUT
        
        log "✅ Patch generated and saved to outputs"
    else
        set_action_output "patch_content" ""
    fi
}

# --- Cleanup ---
cleanup_temp_files() {
    local temp_dir="$1"
    
    if [ -n "$temp_dir" ] && [ -d "$temp_dir" ]; then
        log "🧹 Cleaning up temporary files..."
        rm -rf "$temp_dir"
        log "✅ Cleanup completed"
    fi
}
