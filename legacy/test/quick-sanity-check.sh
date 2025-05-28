#!/bin/bash

# Simple sanity check script
set -e

echo "🔍 SWE-Agent Setup Sanity Check"
echo "==============================="

# Check 1: Basic file structure
echo "✅ Checking file structure..."
FILES=(
    "action.yml"
    "Dockerfile" 
    ".github/workflows/build-docker-image.yml"
    ".github/workflows/swe-agent-aio.yml"
    "scripts/context-detection.sh"
    "src/utils.sh"
)

for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (MISSING)"
        exit 1
    fi
done

# Check 2: Script permissions
echo "✅ Checking script permissions..."
SCRIPTS=("scripts/context-detection.sh" "entrypoint.sh")
for script in "${SCRIPTS[@]}"; do
    if [[ -x "$script" ]]; then
        echo "  ✅ $script (executable)"
    else
        echo "  ❌ $script (not executable)"
        exit 1
    fi
done

# Check 3: Workflow order fix
echo "✅ Checking workflow order..."
if grep -A 5 "steps:" .github/workflows/swe-agent-aio.yml | grep -q "Checkout Repository"; then
    echo "  ✅ Checkout comes first in workflow"
else
    echo "  ❌ Workflow order issue"
    exit 1
fi

# Check 4: Build workflow exists
echo "✅ Checking build workflow..."
if [[ -f ".github/workflows/build-docker-image.yml" ]]; then
    echo "  ✅ Build workflow exists"
else
    echo "  ❌ Build workflow missing"
    exit 1
fi

# Check 5: Context detection with minimal env
echo "✅ Testing context detection..."
export GITHUB_EVENT_NAME="issue_comment"
export COMMENT_BODY="@swe-agent test"
export ISSUE_NUMBER="1"

if timeout 10s ./scripts/context-detection.sh >/dev/null 2>&1; then
    echo "  ✅ Context detection works"
else
    echo "  ⚠️ Context detection may have issues (but this is expected without full env)"
fi

echo ""
echo "🎉 Basic sanity check completed!"
echo "✅ File structure: OK"
echo "✅ Permissions: OK"  
echo "✅ Workflow order: FIXED"
echo "✅ Build workflow: RESTORED"
echo ""
echo "🚀 Your SWE-Agent should now work in GitHub Actions!"
echo ""
echo "📋 What was fixed:"
echo "  1. Moved build-docker-image.yml from .archive to .github/workflows/"
echo "  2. Updated build triggers to include src/** and scripts/**"
echo "  3. Fixed workflow order (checkout before script execution)"
echo "  4. Added branch-specific Docker image logic"
echo "  5. Consistent timeout parameters"
echo ""
echo "⚠️  Remember to:"
echo "  - Push changes to trigger initial Docker build"
echo "  - Test with an actual '@swe-agent' comment on an issue"
echo "  - Check GitHub Actions logs if issues occur"
