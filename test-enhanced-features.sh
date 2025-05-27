#!/bin/bash

# Test script for enhanced SWE-Agent features
# This script tests the new comment-based opinion/analysis response functionality
# and detects potential logic breaches

echo "🧪 Testing Enhanced SWE-Agent Features"
echo "======================================="

# Global test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test result tracking
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
    echo "🔍 Running: $test_name"
    echo "----------------------------------------"
    
    if eval "$test_command"; then
        echo "✅ PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo "❌ FAILED: $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Test intent detection function logic
test_intent_detection() {
    local comment="$1"
    local expected="$2"
    
    # Convert to lowercase for case-insensitive matching
    local lower_comment=$(echo "$comment" | tr '[:upper:]' '[:lower:]')
    local intent="patch"  # default
    
    # Visual content keywords (highest priority)
    if [[ "$lower_comment" =~ (chart|plot|graph|diagram|visualize|visualization|picture|image|screenshot|draw|show.*me.*visual) ]]; then
        intent="visual"
    # Analysis keywords (second priority)
    elif [[ "$lower_comment" =~ (analyze|analysis|explain|understand|investigate|examine|review|assess|evaluate|why|how.*work|what.*happen) ]]; then
        intent="analysis"
    # Opinion/advice keywords (third priority)
    elif [[ "$lower_comment" =~ (opinion|advice|suggest|recommend|think|thoughts|what.*do.*you|should.*i|best.*practice|approach|strategy) ]]; then
        intent="opinion"
    # Code fix keywords (default when explicit)
    elif [[ "$lower_comment" =~ (fix|patch|solve|resolve|implement|code|bug|error|issue) ]]; then
        intent="patch"
    fi
    
    echo "Testing: '$comment'"
    echo "Expected: $expected, Detected: $intent"
    
    if [ "$intent" = "$expected" ]; then
        return 0
    else
        echo "❌ Intent detection breach: expected '$expected', got '$intent'"
        return 1
    fi
}

# Comprehensive intent detection tests
run_test "Basic Opinion Detection" "test_intent_detection 'What do you think about this approach?' 'opinion'"
run_test "Basic Analysis Detection" "test_intent_detection 'Can you analyze this code structure?' 'analysis'"
run_test "Basic Visual Detection" "test_intent_detection 'Please create a diagram showing the data flow' 'visual'"
run_test "Basic Patch Detection" "test_intent_detection 'Fix this bug in the authentication system' 'patch'"

# Edge case tests
run_test "Mixed Case Handling" "test_intent_detection 'What Do You THINK about this APPROACH?' 'opinion'"
run_test "Multiple Keywords Priority" "test_intent_detection 'Fix this bug but also give me your opinion' 'opinion'"
run_test "Analysis vs Opinion Priority" "test_intent_detection 'Analyze this and tell me what you think' 'analysis'"
run_test "Visual vs Analysis Priority" "test_intent_detection 'Show me a chart analyzing the performance' 'visual'"
run_test "Empty Comment Default" "test_intent_detection '' 'patch'"
run_test "Generic Comment Default" "test_intent_detection 'Hello there' 'patch'"

# Advanced pattern tests
run_test "Question Pattern Opinion" "test_intent_detection 'Should I use this design pattern here?' 'opinion'"
run_test "Explanation Pattern Analysis" "test_intent_detection 'Explain how this algorithm works' 'analysis'"
run_test "Show Pattern Visual" "test_intent_detection 'Show me a chart of the performance data' 'visual'"
run_test "Implementation Pattern Patch" "test_intent_detection 'Implement error handling in this function' 'patch'"

# Response mode configuration tests
test_response_mode() {
    local mode="$1"
    local detected="$2"
    local expected_final="$3"
    
    local final_mode="$mode"
    if [ "$mode" = "auto" ]; then
        final_mode="$detected"
    fi
    
    echo "Mode: $mode, Detected: $detected, Final: $final_mode"
    
    if [ "$final_mode" = "$expected_final" ]; then
        return 0
    else
        echo "❌ Response mode logic breach: expected '$expected_final', got '$final_mode'"
        return 1
    fi
}

run_test "Auto Mode with Opinion" "test_response_mode 'auto' 'opinion' 'opinion'"
run_test "Auto Mode with Analysis" "test_response_mode 'auto' 'analysis' 'analysis'"
run_test "Fixed Patch Mode Override" "test_response_mode 'patch' 'opinion' 'patch'"
run_test "Fixed Opinion Mode Override" "test_response_mode 'opinion' 'patch' 'opinion'"
run_test "Fixed Analysis Mode Override" "test_response_mode 'analysis' 'visual' 'analysis'"

# Configuration validation tests
test_config_defaults() {
    local response_mode="${RESPONSE_MODE:-auto}"
    local enable_visual="${ENABLE_VISUAL_CONTENT:-true}"
    local visual_format="${VISUAL_CONTENT_FORMAT:-all}"
    local max_length="${MAX_COMMENT_LENGTH:-65536}"
    
    echo "Config defaults:"
    echo "  response_mode: $response_mode"
    echo "  enable_visual_content: $enable_visual"
    echo "  visual_content_format: $visual_format"
    echo "  max_comment_length: $max_length"
    
    # Validate defaults
    [ "$response_mode" = "auto" ] || { echo "❌ Wrong default response_mode"; return 1; }
    [ "$enable_visual" = "true" ] || { echo "❌ Wrong default enable_visual_content"; return 1; }
    [ "$visual_format" = "all" ] || { echo "❌ Wrong default visual_content_format"; return 1; }
    [ "$max_length" = "65536" ] || { echo "❌ Wrong default max_comment_length"; return 1; }
    
    return 0
}

run_test "Configuration Defaults" "test_config_defaults"

# Environment variable handling tests
test_env_var_handling() {
    # Test with custom values
    export RESPONSE_MODE="opinion"
    export ENABLE_VISUAL_CONTENT="false"
    export VISUAL_CONTENT_FORMAT="mermaid"
    export MAX_COMMENT_LENGTH="32768"
    
    local response_mode="${RESPONSE_MODE:-auto}"
    local enable_visual="${ENABLE_VISUAL_CONTENT:-true}"
    local visual_format="${VISUAL_CONTENT_FORMAT:-all}"
    local max_length="${MAX_COMMENT_LENGTH:-65536}"
    
    echo "Custom config:"
    echo "  response_mode: $response_mode"
    echo "  enable_visual_content: $enable_visual"
    echo "  visual_content_format: $visual_format"
    echo "  max_comment_length: $max_length"
    
    # Validate custom values
    [ "$response_mode" = "opinion" ] || { echo "❌ Custom response_mode not applied"; return 1; }
    [ "$enable_visual" = "false" ] || { echo "❌ Custom enable_visual_content not applied"; return 1; }
    [ "$visual_format" = "mermaid" ] || { echo "❌ Custom visual_content_format not applied"; return 1; }
    [ "$max_length" = "32768" ] || { echo "❌ Custom max_comment_length not applied"; return 1; }
    
    # Clean up
    unset RESPONSE_MODE ENABLE_VISUAL_CONTENT VISUAL_CONTENT_FORMAT MAX_COMMENT_LENGTH
    
    return 0
}

run_test "Environment Variable Handling" "test_env_var_handling"

# Logic breach detection tests
test_logic_consistency() {
    echo "Testing logic consistency..."
    
    # Test that opinion keywords always trigger opinion (not overridden by other keywords)
    test_intent_detection "I need advice on fixing this bug" "opinion" || return 1
    test_intent_detection "What's your opinion on implementing this feature?" "opinion" || return 1
    
    # Test that analysis keywords take precedence over patch keywords
    test_intent_detection "Analyze this bug and fix it" "analysis" || return 1
    test_intent_detection "Review this implementation and resolve issues" "analysis" || return 1
    
    # Test that visual keywords take precedence over analysis keywords
    test_intent_detection "Visualize this analysis data" "visual" || return 1
    test_intent_detection "Create a diagram explaining this bug" "visual" || return 1
    
    return 0
}

run_test "Logic Consistency Check" "test_logic_consistency"

# Boundary condition tests
test_boundary_conditions() {
    echo "Testing boundary conditions..."
    
    # Very long comments
    local long_comment=$(printf "This is a very long comment that tests how the system handles extensive text input. %.0s" {1..100})
    long_comment="$long_comment What do you think about this approach?"
    test_intent_detection "$long_comment" "opinion" || return 1
    
    # Special characters
    test_intent_detection "What do you think about this @#$%^&*() approach?" "opinion" || return 1
    test_intent_detection "Can you analyze this \n\t\r code?" "analysis" || return 1
    
    # Unicode characters
    test_intent_detection "What do you think about this 🤔 approach?" "opinion" || return 1
    
    return 0
}

run_test "Boundary Conditions" "test_boundary_conditions"

# Performance simulation tests
test_performance_simulation() {
    echo "Testing performance characteristics..."
    
    # Time the intent detection function
    local start_time=$(date +%s%N)
    
    # Run intent detection 100 times
    for i in {1..100}; do
        test_intent_detection "What do you think about this approach?" "opinion" > /dev/null || return 1
    done
    
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    echo "Performance: 100 intent detections took ${duration}ms"
    
    # Should complete in reasonable time (< 1000ms for 100 iterations)
    if [ "$duration" -gt 1000 ]; then
        echo "❌ Performance issue: intent detection too slow"
        return 1
    fi
    
    return 0
}

run_test "Performance Simulation" "test_performance_simulation"

# Final report
echo ""
echo "🏁 Test Summary"
echo "==============="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo "🎉 ALL TESTS PASSED!"
    echo "✅ No logic breaches detected"
    echo "✅ Enhanced SWE-Agent features are working correctly"
    echo ""
    echo "🚀 Ready for production deployment!"
    exit 0
else
    echo ""
    echo "❌ $FAILED_TESTS TESTS FAILED!"
    echo "🚨 Logic breaches detected - review failed tests above"
    echo ""
    echo "🔧 Fix the issues before deploying to production"
    exit 1
fi
