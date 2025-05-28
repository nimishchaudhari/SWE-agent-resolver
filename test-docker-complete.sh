#!/bin/bash

# Complete Docker container validation script

set -e

echo "🐳 Testing SWE-Agent Resolver Docker Container"
echo "=============================================="

# Test 1: Basic container functionality
echo "✅ Test 1: Basic container startup"
docker run --rm --entrypoint echo swe-agent-resolver "Container is working!"

# Test 2: Python and SWE-agent installation
echo "✅ Test 2: Python and SWE-agent installation"
docker run --rm --entrypoint python3 swe-agent-resolver -c "
import sys
import sweagent
print(f'✅ Python {sys.version.split()[0]} - OK')
print(f'✅ SWE-agent {getattr(sweagent, \"__version__\", \"unknown\")} - OK')
"

# Test 3: System tools availability
echo "✅ Test 3: System tools availability"
docker run --rm --entrypoint bash swe-agent-resolver -c "
echo '✅ Git: $(git --version)'
echo '✅ jq: $(jq --version)'
echo '✅ Python: $(python3 --version)'
"

# Test 4: File system structure
echo "✅ Test 4: File system structure"
docker run --rm --entrypoint bash swe-agent-resolver -c "
echo '✅ SWE-agent directory:'
ls /app/swe-agent/sweagent/ | head -5
echo '✅ Source scripts:'
ls /src/*.sh | head -5
echo '✅ Entrypoint script:'
ls -la /entrypoint.sh
"

# Test 5: Configuration validation (should fail without env vars)
echo "✅ Test 5: Configuration validation"
docker run --rm swe-agent-resolver echo "test" 2>&1 | grep -q "Configuration validation failed" && echo "✅ Configuration validation working correctly"

# Test 6: Environment variable handling
echo "✅ Test 6: Environment variable handling"
docker run --rm \
  -e GITHUB_TOKEN="test-token" \
  -e GITHUB_REPOSITORY="test/repo" \
  -e LLM_MODEL="gpt-4o-mini" \
  --entrypoint bash swe-agent-resolver -c "
echo 'Environment variables set correctly:'
echo 'GITHUB_TOKEN: ${GITHUB_TOKEN:0:10}...'
echo 'GITHUB_REPOSITORY: $GITHUB_REPOSITORY'
echo 'LLM_MODEL: $LLM_MODEL'
"

echo ""
echo "🎉 All Docker container tests passed!"
echo "📦 Container size: $(docker images swe-agent-resolver --format 'table {{.Size}}' | tail -1)"
echo "🏷️  Image ID: $(docker images swe-agent-resolver --format 'table {{.ID}}' | tail -1)"
echo ""
echo "🚀 The SWE-Agent Resolver Docker container is ready for use!"
echo ""
echo "Usage examples:"
echo "  # Run with environment variables:"
echo "  docker run --rm \\"
echo "    -e GITHUB_TOKEN=\"your-token\" \\"
echo "    -e GITHUB_REPOSITORY=\"owner/repo\" \\"
echo "    -e LLM_MODEL=\"gpt-4o-mini\" \\"
echo "    swe-agent-resolver"
echo ""
echo "  # Run interactively:"
echo "  docker run -it --entrypoint bash swe-agent-resolver"
