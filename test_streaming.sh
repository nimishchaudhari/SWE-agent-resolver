#!/bin/bash

# Simulate streaming output from sweagent run

update_comment() {
    local comment_id="$1"
    local message="$2"
    echo "Updating comment $comment_id with message length: ${#message}"
}

PROGRESS_COMMENT_ID=12345

OUTPUT=""

for i in {1..20}; do
    OUTPUT+="Line $i: This is a simulated output line from sweagent run.\n"
    if (( i % 5 == 0 )); then
        # Simulate updating comment every 5 lines
        update_comment "$PROGRESS_COMMENT_ID" "$OUTPUT"
    fi
    sleep 1
 done

# Final update
update_comment "$PROGRESS_COMMENT_ID" "$OUTPUT"
