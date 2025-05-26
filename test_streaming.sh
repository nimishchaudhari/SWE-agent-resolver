#!/bin/bash

# Dummy values for environment variables
PROGRESS_COMMENT_ID=12345
ISSUE_NUMBER=1
ISSUE_TITLE="Test Issue"
MODEL_NAME="test-model"

# Dummy update_comment function to simulate comment update
update_comment() {
    echo "Updating comment $1 with logs:"
    echo "$2"
}

# Insert the stream_to_comment function here
stream_to_comment() {
    local comment_id="$1"
    local log_buffer=""
    local line_count=0
    local update_interval=10  # Update every 10 lines
    
    while IFS= read -r line; do
        # Print to console (existing behavior)
        echo "$line"
        
        # Add to buffer
        log_buffer+="$line"$'\n'
        line_count=$((line_count + 1))
        
        # Update comment every N lines or if buffer is getting large
        if [ $((line_count % update_interval)) -eq 0 ] || [ ${#log_buffer} -gt 30000 ]; then
            update_streaming_comment "$comment_id" "$log_buffer"
            line_count=0
        fi
    done
    
    # Final update with remaining buffer
    if [ -n "$log_buffer" ]; then
        update_streaming_comment "$comment_id" "$log_buffer"
    fi
}

update_streaming_comment() {
    local comment_id="$1"
    local new_logs="$2"
    
    # Truncate if too long (GitHub comment limit ~65k chars)
    if [ ${#new_logs} -gt 50000 ]; then
        new_logs="${new_logs:0:50000}\n... (output truncated)"
    fi
    
    local streaming_message="🤖 **SWE-Agent is working on this issue...**\n\n**Issue:** #${ISSUE_NUMBER} - ${ISSUE_TITLE}\n**Model:** ${MODEL_NAME}\n\n## 📊 Live Progress Stream\n\`\`\`\n$new_logs\n\`\`\`\n\n---\n*🔄 This comment updates automatically with live progress...*"
    
    update_comment "$comment_id" "$streaming_message"
}

# Simulate streaming input
seq 1 25 | stream_to_comment "$PROGRESS_COMMENT_ID"
