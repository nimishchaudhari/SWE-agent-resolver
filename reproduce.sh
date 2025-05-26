#!/bin/bash

# Set environment variables for testing
export INPUT_GITHUB_TOKEN="fake_token"
export GITHUB_REPOSITORY="owner/repo"
export GITHUB_EVENT_PATH="/repo/test_event.json"
export GITHUB_API_URL="https://api.github.com"
export GITHUB_WORKSPACE="/repo"
export INPUT_LLM_API_KEY="fake_llm_key"
export INPUT_MODEL_NAME="gpt-4o"
export INPUT_TRIGGER_PHRASE="@swe-agent"

# Create a fake GitHub event JSON
cat > /repo/test_event.json << EOL
{
  "comment": {
    "body": "@swe-agent please fix this",
    "id": 123456
  },
  "issue": {
    "number": 1,
    "title": "Test Issue",
    "body": "This is a test issue body."
  },
  "repository": {
    "clone_url": "https://github.com/owner/repo.git"
  }
}
EOL

# Run the entrypoint script
bash /repo/entrypoint.sh
