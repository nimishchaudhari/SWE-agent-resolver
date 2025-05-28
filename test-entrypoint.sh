#!/bin/bash

# Test script to validate entrypoint and module loading
set -e

echo "🧪 Testing entrypoint and module loading..."

# Set minimal required environment variables for testing
export GITHUB_TOKEN="test-token"
export GITHUB_REPOSITORY="test/repo"
export GITHUB_EVENT_ISSUE_TITLE="Test Issue"
export GITHUB_EVENT_ISSUE_BODY="Test issue body"
export GITHUB_EVENT_COMMENT_BODY="Please analyze this code"
export MODEL_NAME="gpt-3.5-turbo"

# Test loading modules individually
SCRIPT_DIR="/workspaces/swe-agent-resolver"

echo "📦 Testing module loading..."

# Test utils.sh
echo "  - Loading utils.sh..."
source "$SCRIPT_DIR/src/utils.sh"
echo "    ✅ utils.sh loaded successfully"

# Test config.sh
echo "  - Loading config.sh..."
source "$SCRIPT_DIR/src/config.sh"
echo "    ✅ config.sh loaded successfully"

# Test github.sh
echo "  - Loading github.sh..."
source "$SCRIPT_DIR/src/github.sh"
echo "    ✅ github.sh loaded successfully"

# Test intent.sh
echo "  - Loading intent.sh..."
source "$SCRIPT_DIR/src/intent.sh"
echo "    ✅ intent.sh loaded successfully"

# Test progress.sh
echo "  - Loading progress.sh..."
source "$SCRIPT_DIR/src/progress.sh"
echo "    ✅ progress.sh loaded successfully"

# Test ai_api.sh
echo "  - Loading ai_api.sh..."
source "$SCRIPT_DIR/src/ai_api.sh"
echo "    ✅ ai_api.sh loaded successfully"

# Test response_formatter.sh
echo "  - Loading response_formatter.sh..."
source "$SCRIPT_DIR/src/response_formatter.sh"
echo "    ✅ response_formatter.sh loaded successfully"

# Test swe_agent.sh
echo "  - Loading swe_agent.sh..."
source "$SCRIPT_DIR/src/swe_agent.sh"
echo "    ✅ swe_agent.sh loaded successfully"

echo ""
echo "🔧 Testing key functions..."

# Test utility functions
echo "  - Testing log function..."
log "This is a test log message"
echo "    ✅ log function works"

# Test configuration setup
echo "  - Testing configuration setup..."
setup_configuration
echo "    ✅ setup_configuration works"

# Test intent detection
echo "  - Testing intent detection..."
intent=$(detect_intent_from_comment)
echo "    ✅ Detected intent: $intent"

# Test temp directory creation
echo "  - Testing temp directory creation..."
temp_dir=$(create_temp_directory)
echo "    ✅ Created temp directory: $temp_dir"
rm -rf "$temp_dir"

echo ""
echo "✅ All module loading and basic function tests passed!"
echo "🎉 Entrypoint script components are working correctly!"
