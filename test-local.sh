#!/bin/bash

# Quick local test script for SWE-Agent Resolver

echo "🧪 SWE-Agent Resolver Quick Test"
echo "================================"
echo ""

# Check if .env.test.local exists
if [ ! -f ".env.test.local" ]; then
    echo "⚠️  Creating .env.test.local from template..."
    cp .env.test .env.test.local
    echo "✅ Created .env.test.local"
    echo ""
    echo "Please edit .env.test.local and add your API keys:"
    echo "  - GITHUB_TOKEN (required)"
    echo "  - At least one AI provider key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)"
    echo ""
    echo "Then run this script again."
    exit 0
fi

# Source environment variables
set -a
source .env.test.local
set +a

# Run tests based on argument
case "$1" in
    "unit")
        echo "Running unit tests..."
        npm test -- --selectProjects=unit
        ;;
    "integration")
        echo "Running integration tests..."
        npm test -- --selectProjects=integration
        ;;
    "all")
        echo "Running all tests..."
        npm test
        ;;
    "coverage")
        echo "Running tests with coverage..."
        npm run test:coverage
        ;;
    "local")
        echo "Running local action test..."
        node test/run-local-tests.js ${2:-issue_comment}
        ;;
    *)
        echo "Usage: ./test-local.sh [unit|integration|all|coverage|local [scenario]]"
        echo ""
        echo "Options:"
        echo "  unit         - Run unit tests only"
        echo "  integration  - Run integration tests only"
        echo "  all          - Run all tests"
        echo "  coverage     - Run tests with coverage report"
        echo "  local        - Run local action test with optional scenario:"
        echo "                 - issue_comment (default)"
        echo "                 - pr_review"
        echo "                 - issue_opened"
        echo ""
        echo "Examples:"
        echo "  ./test-local.sh unit"
        echo "  ./test-local.sh local issue_comment"
        echo "  ./test-local.sh coverage"
        ;;
esac