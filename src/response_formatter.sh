#!/bin/bash

# src/response_formatter.sh - Response formatting based on intent
# Formats responses appropriately for different request types

set -e

# --- Response Formatting Functions ---
format_response_by_intent() {
    local intent="$1"
    local content="$2"
    local issue_number="$3"
    local issue_title="$4"
    local model_name="$5"
    local execution_time="$6"
    local context_type="${7:-${CONTEXT_TYPE:-unknown}}"
    local context_mode="${8:-${FINAL_CONTEXT_MODE:-unknown}}"
    
    # Context-aware emoji and description
    local context_emoji=""
    local context_description=""
    case "$context_mode" in
        "pr_review"|"pr_review_comment")
            context_emoji="🔍"
            context_description="PR Review"
            ;;
        "pr_comment"|"pull_request")
            context_emoji="🔄"
            context_description="Pull Request"
            ;;
        "issue_comment")
            context_emoji="📝"
            context_description="Issue"
            ;;
        *)
            context_emoji="🤖"
            context_description="Request"
            ;;
    esac
    
    case "$intent" in
        "pr_review")
            format_pr_review_response "$content" "$issue_number" "$issue_title" "$model_name" "$execution_time" "$context_emoji" "$context_description" "$context_mode"
            ;;
        "opinion")
            format_opinion_response "$content" "$issue_number" "$issue_title" "$model_name" "$execution_time" "$context_emoji" "$context_description" "$context_mode"
            ;;
        "analysis")
            format_analysis_response "$content" "$issue_number" "$issue_title" "$model_name" "$execution_time" "$context_emoji" "$context_description" "$context_mode"
            ;;
        "visual")
            format_visual_response "$content" "$issue_number" "$issue_title" "$model_name" "$execution_time" "$context_emoji" "$context_description" "$context_mode"
            ;;
        *)
            # Default patch format (existing behavior)
            echo "$content"
            ;;
    esac
}

# --- PR Review Response Format ---
format_pr_review_response() {
    local content="$1"
    local issue_number="$2"
    local issue_title="$3"
    local model_name="$4"
    local execution_time="$5"
    local context_emoji="$6"
    local context_description="$7"
    local context_mode="$8"
    
    cat << EOF
🔍 **SWE-Agent Pull Request Review**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${CONTEXT_TYPE:-pr})
**Model:** ${model_name}
**Review Type:** Comprehensive PR Analysis
**Review Time:** ${execution_time}

## 📋 Pull Request Review Summary

${content}

## 🔍 Code Quality Assessment

<details>
<summary>📊 Click to view detailed code quality metrics</summary>

**Architecture & Design:**
- Code follows established patterns ✓/⚠️/❌
- Proper separation of concerns ✓/⚠️/❌
- Maintains consistency with codebase ✓/⚠️/❌

**Security & Safety:**
- No obvious security vulnerabilities ✓/⚠️/❌
- Input validation present ✓/⚠️/❌
- Error handling appropriate ✓/⚠️/❌

**Performance & Efficiency:**
- No performance regressions ✓/⚠️/❌
- Efficient algorithms used ✓/⚠️/❌
- Resource usage optimized ✓/⚠️/❌

**Testing & Coverage:**
- Tests included for new features ✓/⚠️/❌
- Edge cases covered ✓/⚠️/❌
- Integration tests present ✓/⚠️/❌

</details>

## 🎯 Review Recommendations

### ✅ **Approved Changes**
- Well-structured implementation
- Follows coding standards
- Comprehensive test coverage

### ⚠️ **Suggested Improvements**
- Consider refactoring for better readability
- Add more comprehensive error handling
- Update documentation

### ❌ **Required Changes**
- Fix critical security issues
- Address performance bottlenecks
- Add missing test coverage

## 🚀 Merge Recommendation

**Overall Assessment:** ✅ **APPROVED** / ⚠️ **APPROVED WITH SUGGESTIONS** / ❌ **CHANGES REQUESTED**

### Next Steps:
1. **Address any critical issues** mentioned above
2. **Review suggested improvements** for code quality
3. **Ensure all tests pass** before merging
4. **Update documentation** if needed

---
*🔍 SWE-Agent using ${model_name} • PR review complete • ${context_emoji} ${context_mode} context*
EOF
}

# --- Opinion Response Format ---
format_opinion_response() {
    local content="$1"
    local issue_number="$2"
    local issue_title="$3"
    local model_name="$4"
    local execution_time="$5"
    local context_emoji="$6"
    local context_description="$7"
    local context_mode="$8"
    
    cat << EOF
💡 **SWE-Agent Opinion & Recommendations**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${CONTEXT_TYPE:-issue})
**Model:** ${model_name}
**Response Type:** Opinion & Advice
**Analysis Time:** ${execution_time}

## 🤔 My Analysis & Opinion

${content}

## 💡 Key Recommendations

<details>
<summary>🎯 Click to view detailed recommendations</summary>

${content}

</details>

## 🚀 Next Steps
Based on my analysis, here's what I'd recommend:

1. **Consider the trade-offs** mentioned above
2. **Test thoroughly** before implementing
3. **Follow best practices** for your specific use case
4. **Monitor the results** after implementation

---
*💡 SWE-Agent using ${model_name} • Opinion & advisory response • ${context_emoji} ${context_mode} context*
EOF
}

# --- Analysis Response Format ---
format_analysis_response() {
    local content="$1"
    local issue_number="$2"
    local issue_title="$3"
    local model_name="$4"
    local execution_time="$5"
    local context_emoji="$6"
    local context_description="$7"
    local context_mode="$8"
    
    cat << EOF
🔍 **SWE-Agent Code Analysis Report**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${CONTEXT_TYPE:-issue})
**Model:** ${model_name}
**Response Type:** Technical Analysis
**Analysis Time:** ${execution_time}

## 📊 Analysis Results

${content}

## 🔍 Technical Details

<details>
<summary>📋 Click to view detailed technical analysis</summary>

${content}

</details>

## 🎯 Key Findings
- **Architecture Impact:** Analyzing structural implications
- **Performance Considerations:** Evaluating efficiency factors
- **Security Implications:** Assessing security aspects
- **Maintenance Burden:** Reviewing long-term maintainability

---
*🔍 SWE-Agent using ${model_name} • Technical analysis complete • ${context_emoji} ${context_mode} context*
EOF
}

# --- Visual Response Format ---
format_visual_response() {
    local content="$1"
    local issue_number="$2"
    local issue_title="$3"
    local model_name="$4"
    local execution_time="$5"
    local context_emoji="$6"
    local context_description="$7"
    local context_mode="$8"
    
    cat << EOF
📊 **SWE-Agent Visual Analysis**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${context_mode} (${CONTEXT_TYPE:-issue})
**Model:** ${model_name}
**Response Type:** Visual Content
**Generation Time:** ${execution_time}

## 📈 Generated Visualization

${content}

## 🎨 Visual Content Details

<details>
<summary>🖼️ Click to view additional visual formats</summary>

${content}

</details>

## 📋 How to Use This Visualization
1. **Copy the diagram code** from the sections above
2. **Paste into your preferred tool** (Mermaid Live Editor, ASCII art viewer, etc.)
3. **Customize as needed** for your specific requirements
4. **Include in documentation** or presentations

---
*📊 SWE-Agent using ${model_name} • Visual content generated • ${context_emoji} ${context_mode} context*
EOF
}

# --- Success Message Formatting ---
format_success_message() {
    local patch_content="$1"
    local issue_number="$2"
    local issue_title="$3"
    local model_name="$4"
    local execution_time="$5"
    local git_reference="$6"
    local final_context_mode="$7"
    local context_type="$8"
    
    # Calculate patch statistics
    local stats=$(calculate_patch_statistics "$patch_content")
    IFS=':' read -r files_changed lines_added lines_removed <<< "$stats"
    
    # Truncate patch if too long
    local truncated_patch
    truncated_patch=$(truncate_patch_if_needed "$patch_content")
    local truncated=$?
    
    # Context-aware success message
    local context_emoji=""
    local context_action=""
    local context_description=""
    
    case "$final_context_mode" in
        "pr_review"|"pr_review_comment"|"pr_comment"|"pull_request")
            context_emoji="🔄"
            context_action="updated the existing Pull Request"
            context_description="Pull Request"
            ;;
        "issue_comment"|*)
            context_emoji="🆕"
            context_action="created a new solution"
            context_description="Issue"
            ;;
    esac
    
    # Generate statistics summary
    local stats_summary=""
    if [ "$files_changed" -gt 0 ]; then
        stats_summary="**📊 Patch Statistics:**
- 📁 Files changed: **${files_changed}**
- ➕ Lines added: **${lines_added}**
- ➖ Lines removed: **${lines_removed}**
- 📏 Net change: **$((lines_added - lines_removed))** lines"
        if [ "$truncated" -eq 1 ]; then
            stats_summary="$stats_summary
- ⚠️ **Note:** Patch was truncated for display (see full patch in PR)"
        fi
    fi
    
    cat << EOF
✅ **Solution Generated Successfully!**

**${context_description}:** #${issue_number} - ${issue_title}
**Context:** ${final_context_mode} (${context_type})
**Model:** ${model_name}
**Execution Time:** ${execution_time}
**Git Reference:** ${git_reference:0:8}...

${stats_summary}

## 🔧 Generated Patch

<details>
<summary>📄 Click to view generated patch (${files_changed} files changed)</summary>

\`\`\`diff
${truncated_patch}
\`\`\`

</details>

## 🔄 Next Steps
✨ The patch is being processed and ${context_action}.

**What happens next:**
1. 🔄 Patch validation and testing
2. 📝 $([ "$context_action" = *"existing"* ] && echo "Pull Request update" || echo "Pull Request creation") with detailed description
3. ✅ Ready for review and merge

---
*✨ Generated by SWE-Agent using $model_name • ${context_emoji} ${final_context_mode} context*
EOF
}

# --- No Patch Message ---
format_no_patch_message() {
    local issue_number="$1"
    local issue_title="$2"
    local model_name="$3"
    local execution_time="$4"
    
    cat << EOF
🔍 **Analysis Completed - No Code Changes Needed**

**Issue:** #${issue_number} - ${issue_title}
**Model:** ${model_name}
**Result:** Analysis completed but no patch generated
**Execution Time:** ${execution_time}

## 🔍 Analysis Results
I've thoroughly analyzed the issue but didn't generate a code patch. This could mean:

### 🤔 Possible Reasons:
- 📋 **Investigation/Research needed** - Requires manual investigation
- ℹ️ **More information needed** - Additional details would help
- ✅ **Already resolved** - The problem may already be fixed
- 📝 **Documentation issue** - Related to docs rather than code
- 🏗️ **Architecture decision** - Requires design/architecture changes
- 🔧 **Configuration issue** - Settings or environment related

## 💡 How to Get Better Results

<details>
<summary>🎯 Tips for more specific requests</summary>

**Instead of:** "Fix the login system"
**Try:** "Fix authentication error on line 45 in auth.py - users can't log in with valid credentials"

**Include:**
- 📍 **Specific files/functions** affected
- 🐛 **Error messages** or logs
- 📋 **Steps to reproduce** the issue
- ✅ **Expected vs actual behavior**
- 🔗 **Related issue links** or context

</details>

## 🔄 Ready to Try Again?

**Option 1:** Comment \`@swe-agent\` with more specific details
**Option 2:** Try breaking down into smaller, focused requests
**Option 3:** Include error logs or specific examples

---
*🤖 Analysis by SWE-Agent using $model_name • No code changes required*
EOF
}

# --- Simple Response Formatters (Backwards Compatibility) ---
# These provide simple signatures for the entrypoint to use

format_patch_response() {
    local patch_content="$1"
    
    format_response_by_intent "patch" "$patch_content" \
        "${GITHUB_EVENT_NUMBER:-unknown}" \
        "${GITHUB_EVENT_ISSUE_TITLE:-Patch Request}" \
        "${MODEL_NAME:-unknown}" \
        "${EXECUTION_TIME:-unknown}"
}

format_analysis_response() {
    local analysis_content="$1"
    
    format_response_by_intent "analysis" "$analysis_content" \
        "${GITHUB_EVENT_NUMBER:-unknown}" \
        "${GITHUB_EVENT_ISSUE_TITLE:-Analysis Request}" \
        "${MODEL_NAME:-unknown}" \
        "${EXECUTION_TIME:-unknown}"
}

format_opinion_response() {
    local opinion_content="$1"
    
    format_response_by_intent "opinion" "$opinion_content" \
        "${GITHUB_EVENT_NUMBER:-unknown}" \
        "${GITHUB_EVENT_ISSUE_TITLE:-Opinion Request}" \
        "${MODEL_NAME:-unknown}" \
        "${EXECUTION_TIME:-unknown}"
}

format_visual_response() {
    local visual_content="$1"
    
    format_response_by_intent "visual" "$visual_content" \
        "${GITHUB_EVENT_NUMBER:-unknown}" \
        "${GITHUB_EVENT_ISSUE_TITLE:-Visual Content Request}" \
        "${MODEL_NAME:-unknown}" \
        "${EXECUTION_TIME:-unknown}"
}

format_pr_review_response() {
    local review_content="$1"
    
    format_response_by_intent "pr_review" "$review_content" \
        "${GITHUB_EVENT_NUMBER:-unknown}" \
        "${GITHUB_EVENT_ISSUE_TITLE:-PR Review}" \
        "${MODEL_NAME:-unknown}" \
        "${EXECUTION_TIME:-unknown}"
}
