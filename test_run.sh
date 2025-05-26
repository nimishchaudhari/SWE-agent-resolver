#!/bin/bash
echo "Starting test_run.sh"


# Set environment variables for testing
export INPUT_GITHUB_TOKEN="fake_token"
export INPUT_TRIGGER_PHRASE="@swe-agent"
export INPUT_LLM_API_KEY="fake_llm_api_key"
export INPUT_MODEL_NAME="gpt-4o"
export GITHUB_API_URL="https://api.github.com"
export GITHUB_REPOSITORY="user/repo"
export GITHUB_EVENT_PATH="/repo/test_event.json"
export GITHUB_WORKSPACE="/repo"

# Create a fake GitHub event JSON file
export DEBUG_MODE=1

cat > $GITHUB_EVENT_PATH << EOF
{
  "comment": {
    "body": "@swe-agent please fix this",
    "id": 123456
  },
  "issue": {
    "number": 1,
    "title": "Test issue",
    "body": "This is a test issue",
    "pull_request": null
  },
  "repository": {
    "clone_url": "https://github.com/user/repo.git"
  }
}
EOF

# Test shallow clone command
START_TIME=$(date +%s)
git clone --depth 1 https://github.com/user/repo.git /tmp/test_repo
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo "Shallow clone took $ELAPSED seconds"
