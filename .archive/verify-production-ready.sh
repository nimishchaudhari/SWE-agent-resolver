#!/bin/bash

# Production readiness verification script for Enhanced SWE-Agent
# This script performs comprehensive checks to ensure the system is ready for deployment

echo "🔍 Production Readiness Verification"
echo "===================================="

CHECKS_PASSED=0
TOTAL_CHECKS=0

# Function to run a check
run_check() {
    local check_name="$1"
    local check_command="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo ""
    echo "🔍 $check_name"
    echo "----------------------------------------"
    
    if eval "$check_command"; then
        echo "✅ PASSED: $check_name"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        echo "❌ FAILED: $check_name"
        return 1
    fi
}

# Check 1: Syntax validation
run_check "Shell Script Syntax" "bash -n entrypoint.sh"

# Check 2: YAML validation
run_check "Action YAML Syntax" "python3 -c 'import yaml; yaml.safe_load(open(\"action.yml\"))'"

# Check 3: Enhanced features test suite
run_check "Enhanced Features Test Suite" "./test-enhanced-features.sh > /dev/null 2>&1"

# Check 4: Required files exist
check_required_files() {
    local required_files=(
        "action.yml"
        "entrypoint.sh"
        "ENHANCED_FEATURES.md"
        "README.md"
        ".github/workflows/test-enhanced-features.yml"
        ".github/workflows/demo-enhanced-features.yml"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            echo "❌ Missing required file: $file"
            return 1
        fi
    done
    
    echo "📁 All required files present"
    return 0
}

run_check "Required Files Present" "check_required_files"

# Check 5: Verify action.yml inputs
check_action_inputs() {
    local required_inputs=(
        "github_token"
        "openai_api_key"
        "model_name"
        "response_mode"
        "enable_visual_content"
        "visual_content_format"
        "max_comment_length"
    )
    
    for input in "${required_inputs[@]}"; do
        if ! grep -q "^  $input:" action.yml; then
            echo "❌ Missing action input: $input"
            return 1
        fi
    done
    
    echo "⚙️ All action inputs defined"
    return 0
}

run_check "Action.yml Input Configuration" "check_action_inputs"

# Check 6: Verify entrypoint.sh functions
check_entrypoint_functions() {
    local required_functions=(
        "detect_request_intent"
        "handle_non_patch_request"
        "format_response_by_intent"
        "call_openai_api"
        "call_anthropic_api"
        "call_openrouter_api"
        "call_gemini_api"
    )
    
    for func in "${required_functions[@]}"; do
        if ! grep -q "^$func()" entrypoint.sh; then
            echo "❌ Missing function: $func"
            return 1
        fi
    done
    
    echo "🔧 All required functions present"
    return 0
}

run_check "Entrypoint Functions" "check_entrypoint_functions"

# Check 7: Verify workflows have proper triggers
check_workflow_triggers() {
    if ! grep -q "issue_comment:" .github/workflows/demo-enhanced-features.yml; then
        echo "❌ Demo workflow missing issue_comment trigger"
        return 1
    fi
    
    if ! grep -q "push:" .github/workflows/test-enhanced-features.yml; then
        echo "❌ Test workflow missing push trigger"
        return 1
    fi
    
    echo "🚀 Workflow triggers configured correctly"
    return 0
}

run_check "GitHub Workflow Triggers" "check_workflow_triggers"

# Check 8: Verify documentation completeness
check_documentation() {
    if [ ! -s "ENHANCED_FEATURES.md" ]; then
        echo "❌ ENHANCED_FEATURES.md is empty or missing"
        return 1
    fi
    
    if ! grep -q "## 🚀 Usage Examples" ENHANCED_FEATURES.md; then
        echo "❌ Missing usage examples in documentation"
        return 1
    fi
    
    if ! grep -q "response_mode" README.md; then
        echo "❌ README.md not updated with enhanced features"
        return 1
    fi
    
    echo "📚 Documentation is complete"
    return 0
}

run_check "Documentation Completeness" "check_documentation"

# Final report
echo ""
echo "🏁 Production Readiness Summary"
echo "==============================="
echo "Total Checks: $TOTAL_CHECKS"
echo "Passed: $CHECKS_PASSED"
echo "Failed: $((TOTAL_CHECKS - CHECKS_PASSED))"

if [ $CHECKS_PASSED -eq $TOTAL_CHECKS ]; then
    echo ""
    echo "🎉 PRODUCTION READY!"
    echo "✅ All checks passed - system is ready for deployment"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Commit and push changes to repository"
    echo "2. Tag release version"
    echo "3. Update GitHub Action marketplace (if applicable)"
    echo "4. Monitor initial deployments"
    echo ""
    echo "📊 Enhanced Features Available:"
    echo "• 💡 Opinion & Recommendations"
    echo "• 🔍 Technical Analysis"
    echo "• 📊 Visual Content Generation"
    echo "• 🔧 Traditional Code Patches"
    exit 0
else
    echo ""
    echo "❌ NOT READY FOR PRODUCTION"
    echo "🚨 Please fix the failed checks above before deploying"
    echo ""
    echo "🔧 Fix the issues and run this script again"
    exit 1
fi
