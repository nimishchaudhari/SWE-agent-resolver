#!/bin/bash

set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # Causes a pipeline to return the exit status of the last command in the pipe that failed.

echo "SWE-Agent Resolver Action :: Started (UTC 2025-05-26)"
echo "User: nimishchaudhari"

# --- 0. Environment & Input Validation ---
if [ -z "$INPUT_GITHUB_TOKEN" ]; then echo "Error: github_token input is required."; exit 1; fi
if [ -z "$INPUT_LLM_API_KEY" ]; then echo "Error: llm_api_key input is required."; exit 1; fi
if [ -z "$INPUT_MODEL_NAME" ]; then echo "Error: model_name input is required."; exit 1; fi

# Set LLM API Key for SWE-agent (assuming OpenAI, adjust if SWE-agent uses other env var names)
export OPENAI_API_KEY="$INPUT_LLM_API_KEY"
# export ANTHROPIC_API_KEY="$INPUT_LLM_API_KEY" # If using Claude and SWE-agent supports it this way

TRIGGER_PHRASE="${INPUT_TRIGGER_PHRASE:-@swe-agent}"
GH_REPO="${GITHUB_REPOSITORY}"
GH_API_URL="${GITHUB_API_URL:-https://api.github.com}"
EVENT_PATH="${GITHUB_EVENT_PATH}"

echo "Trigger Phrase: '${TRIGGER_PHRASE}'"
echo "Target Repository: '${GH_REPO}'"
echo "Event Path: '${EVENT_PATH}'"
echo "Model Name: '${INPUT_MODEL_NAME}'"

# --- 1. Parse Event Payload (Focus: issue_comment) ---
EVENT_TYPE="${GITHUB_EVENT_NAME}"
echo "Event Type: '${EVENT_TYPE}'"

if [ "$EVENT_TYPE" != "issue_comment" ]; then
  echo "This action is designed for 'issue_comment' events. Skipping for '${EVENT_TYPE}'."
  exit 0
fi

if [ ! -f "$EVENT_PATH" ]; then echo "Error: GitHub event payload file not found at '$EVENT_PATH'"; exit 1; fi

COMMENT_BODY=$(jq -r '.comment.body' "$EVENT_PATH")
COMMENT_URL=$(jq -r '.comment.html_url' "$EVENT_PATH")
ISSUE_NUMBER=$(jq -r '.issue.number' "$EVENT_PATH")
REPO_FULL_NAME=$(jq -r '.repository.full_name' "$EVENT_PATH") # Should be same as GITHUB_REPOSITORY
USER_LOGIN=$(jq -r '.comment.user.login' "$EVENT_PATH")

if [ -z "$COMMENT_BODY" ] || [ "$COMMENT_BODY" == "null" ]; then echo "Error: Could not extract comment body."; exit 1; fi
if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" == "null" ]; then echo "Error: Could not extract issue number."; exit 1; fi

echo "Issue Number: ${ISSUE_NUMBER}"
echo "Commenter: ${USER_LOGIN}"
echo "Comment URL: ${COMMENT_URL}"

# --- 2. Check for Trigger Phrase & Extract Task ---
if ! echo "$COMMENT_BODY" | grep -Fq "$TRIGGER_PHRASE"; then
  echo "Trigger phrase '${TRIGGER_PHRASE}' not found in comment. Exiting."
  exit 0
fi
echo "Trigger phrase found!"

TASK_DESCRIPTION=$(echo "$COMMENT_BODY" | sed -n "s/.*${TRIGGER_PHRASE}//p" | sed 's/^[ \t]*//;s/[ \t]*$//')

if [ -z "$TASK_DESCRIPTION" ]; then
  echo "Warning: Trigger phrase found, but no subsequent text for task description."
  TASK_DESCRIPTION="Please address the issue." # Default task if nothing specific follows
fi
echo "Extracted Task: '${TASK_DESCRIPTION}'"

# --- 3. Fetch Issue Details & Create Problem Description File ---
TEMP_DIR="/tmp/swe_agent_run_$$" # Unique temp dir for this run
mkdir -p "$TEMP_DIR"
PROBLEM_FILE_PATH="${TEMP_DIR}/problem_description.md"
TARGET_REPO_CLONE_PATH="${TEMP_DIR}/repo"
# Define PROBLEM_ID based on the problem description file name
PROBLEM_ID=$(basename "${PROBLEM_FILE_PATH}" .md)
# Define the expected path for the output patch file
SWE_AGENT_OUTPUT_PATCH="${TEMP_DIR}/${PROBLEM_ID}/${PROBLEM_ID}.patch"

echo "Fetching issue details from GitHub API..."
ISSUE_API_URL="${GH_API_URL}/repos/${REPO_FULL_NAME}/issues/${ISSUE_NUMBER}"
ISSUE_DATA_JSON=$(curl -s -H "Authorization: token ${INPUT_GITHUB_TOKEN}" -H "Accept: application/vnd.github.v3+json" "$ISSUE_API_URL")

ISSUE_TITLE=$(echo "$ISSUE_DATA_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_DATA_JSON" | jq -r '.body') # Might be null
if [ "$ISSUE_BODY" == "null" ]; then ISSUE_BODY="No description provided for this issue."; fi

cat << EOF > "$PROBLEM_FILE_PATH"
Issue Title: ${ISSUE_TITLE}
Issue Number: ${ISSUE_NUMBER}
Repository: ${REPO_FULL_NAME}
User Request (from comment by @${USER_LOGIN}): ${TASK_DESCRIPTION}

--- Original Issue Body ---
${ISSUE_BODY}
EOF

echo "Problem Description File created at '${PROBLEM_FILE_PATH}' with content:"
cat "${PROBLEM_FILE_PATH}"
echo "--- End of Problem Description File ---"

# --- 4. Checkout Target Repository ---
echo "Cloning target repository '${REPO_FULL_NAME}' into '${TARGET_REPO_CLONE_PATH}'..."
git clone --depth 1 "https://x-access-token:${INPUT_GITHUB_TOKEN}@github.com/${REPO_FULL_NAME}.git" "$TARGET_REPO_CLONE_PATH"
echo "Repository cloned."

# --- 5. Run SWE-agent ---
echo "Preparing to run SWE-agent..."

SWE_AGENT_COMMAND=(
    "python" "-m" "sweagent" "run"
    "--agent.model.name" "${INPUT_MODEL_NAME}"
    "--problem_statement.path" "${PROBLEM_FILE_PATH}"  # Corrected from .file_path to .path
    "--env.repo.path" "${TARGET_REPO_CLONE_PATH}"
    "--output_dir" "${TEMP_DIR}" # Use --output_dir instead of --output_patch_file
    "--env.deployment.type=local" # Force local execution for testing
    # Potentially add: --config config/default.yaml if needed and available
)

# Append additional user-provided arguments, if any
if [ -n "$INPUT_SWE_AGENT_ARGS" ]; then
    # shellcheck disable=SC2206 # Word splitting is intended here
    SWE_AGENT_COMMAND+=($INPUT_SWE_AGENT_ARGS)
fi

echo "Executing SWE-agent command: ${SWE_AGENT_COMMAND[*]}"

SWE_AGENT_LOG_FILE="${TEMP_DIR}/swe_agent_run.log"
AGENT_EXIT_CODE=0
# Execute the command, tee its output to the log file and stdout/stderr, then capture exit status
# shellcheck disable=SC2260 # We do want to expand SWE_AGENT_COMMAND here
eval "${SWE_AGENT_COMMAND[*]}" 2>&1 | tee "$SWE_AGENT_LOG_FILE"; AGENT_EXIT_CODE=${PIPESTATUS[0]}

echo "SWE-agent execution finished with exit code: ${AGENT_EXIT_CODE}."
# The log is now streamed, but we can keep this for a final full log record if desired,
# or remove the cat block if the streamed output is sufficient.
echo "--- SWE-agent Log (also streamed during execution) ---"
cat "$SWE_AGENT_LOG_FILE"
echo "--- End of SWE-agent Log ---"

# --- 6. Process SWE-agent Output & Post Results to GitHub ---
RESULT_MESSAGE=""
SUCCESS=false

if [ "$AGENT_EXIT_CODE" -eq 0 ]; then
    if [ -s "$SWE_AGENT_OUTPUT_PATCH" ]; then
        echo "Patch file found at '${SWE_AGENT_OUTPUT_PATCH}'."
        PATCH_CONTENT=$(cat "$SWE_AGENT_OUTPUT_PATCH")
        MAX_PATCH_DISPLAY_LENGTH=60000
        if [ ${#PATCH_CONTENT} -gt $MAX_PATCH_DISPLAY_LENGTH ]; then
            PATCH_CONTENT_DISPLAY="$(echo "$PATCH_CONTENT" | head -c $MAX_PATCH_DISPLAY_LENGTH)\n\n... (patch truncated)"
        else
            PATCH_CONTENT_DISPLAY="$PATCH_CONTENT"
        fi
        RESULT_MESSAGE="✅ SWE-agent completed successfully and generated the following patch:\n\n\`\`\`diff\n${PATCH_CONTENT_DISPLAY}\n\`\`\`\n\n"
        SUCCESS=true
    else
        echo "SWE-agent completed successfully, but no patch file was found or it was empty at '${SWE_AGENT_OUTPUT_PATCH}'."
        RESULT_MESSAGE="✅ SWE-agent completed successfully, but did not produce a patch file. See logs for details.\n\n"
        SUCCESS=true
    fi
else
    echo "SWE-agent failed with exit code ${AGENT_EXIT_CODE}."
    RESULT_MESSAGE="❌ SWE-agent encountered an error (exit code: ${AGENT_EXIT_CODE}). Please see the logs below for details.\n\n"
fi

LOG_CONTENT=$(cat "$SWE_AGENT_LOG_FILE")
MAX_LOG_DISPLAY_LENGTH=30000
if [ ${#LOG_CONTENT} -gt $MAX_LOG_DISPLAY_LENGTH ]; then
    LOG_CONTENT_DISPLAY="$(echo "$LOG_CONTENT" | head -c $MAX_LOG_DISPLAY_LENGTH)\n\n... (log truncated)"
else
    LOG_CONTENT_DISPLAY="$LOG_CONTENT"
fi

RESULT_MESSAGE="${RESULT_MESSAGE}**SWE-agent Log:**\n\`\`\`\n${LOG_CONTENT_DISPLAY}\n\`\`\`"

echo "Posting results back to GitHub issue ${ISSUE_NUMBER}..."
JSON_PAYLOAD=$(jq -n --arg body "$RESULT_MESSAGE" '{body: $body}')
COMMENT_POST_URL="${GH_API_URL}/repos/${REPO_FULL_NAME}/issues/${ISSUE_NUMBER}/comments"

RESPONSE_CODE=$(curl -s -w "%{http_code}" -X POST \
  -H "Authorization: token ${INPUT_GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "$COMMENT_POST_URL" \
  -d "$JSON_PAYLOAD" -o "${TEMP_DIR}/curl_response.txt")

if [ "$RESPONSE_CODE" -ge 200 ] && [ "$RESPONSE_CODE" -lt 300 ]; then
  echo "Successfully posted comment. Response code: $RESPONSE_CODE"
else
  echo "Error posting comment. GitHub API responded with ${RESPONSE_CODE}."
  echo "Response body:"
  cat "${TEMP_DIR}/curl_response.txt"
  echo "Intended comment message was:"
  echo "$RESULT_MESSAGE"
  exit 1
fi

# --- 7. Cleanup ---
echo "Cleaning up temporary directory '${TEMP_DIR}'..."
rm -rf "$TEMP_DIR"

echo "SWE-Agent Resolver Action :: Finished."
if [ "$SUCCESS" = true ] && [ "$AGENT_EXIT_CODE" -eq 0 ]; then
    exit 0
else
    exit 1
fi