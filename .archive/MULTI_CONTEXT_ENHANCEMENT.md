# Enhanced SWE-Agent: Multi-Context Support (PRs, Issues, Comments)

## Overview

This document details the enhancement to support SWE-Agent calls across different GitHub contexts:

1. **Pull Request Comments** - Continue work on existing PRs
2. **Issue Comments** - Work from the latest commit
3. **Review Comments** - Handle PR review-specific requests
4. **Different Reference Points** - Proper Git context handling

## 🎯 Enhanced Context Support

### 1. **Pull Request Context**
When SWE-Agent is called on a Pull Request:
- **Base Branch**: Uses the PR's base branch as the starting point
- **Head Branch**: Applies changes to the PR's head branch
- **Commit Reference**: Uses the latest commit in the PR branch
- **Workflow**: Continues the existing PR instead of creating a new one

### 2. **Issue Context** 
When SWE-Agent is called on an Issue:
- **Base Branch**: Uses the repository's default branch
- **Reference Point**: Uses the latest commit of the default branch
- **Workflow**: Creates a new branch and PR for the fix

### 3. **Review Context**
When SWE-Agent is called in a PR review:
- **Specific File Context**: Focus on the files being reviewed
- **Review Comments**: Address specific review feedback
- **Targeted Changes**: Make changes relevant to the review

### 4. **Direct Comment Context**
When SWE-Agent is called in any comment:
- **Event Detection**: Automatically detect the context type
- **Smart Reference**: Use appropriate Git reference based on context
- **Proper Routing**: Route to the correct workflow

## 🔧 Technical Implementation

### Enhanced Event Detection

```yaml
# Support multiple event types
on:
  issue_comment:
    types: [created]
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created]
```

### Context-Aware Git Handling

```bash
# Detect context type
detect_github_context() {
    if [ -n "$GITHUB_EVENT_PULL_REQUEST_NUMBER" ]; then
        echo "pull_request"
    elif [ -n "$GITHUB_EVENT_ISSUE_PULL_REQUEST" ]; then
        echo "pull_request_comment"
    elif [ -n "$GITHUB_EVENT_ISSUE_NUMBER" ]; then
        echo "issue"
    else
        echo "unknown"
    fi
}

# Get appropriate Git reference
get_git_reference() {
    local context="$1"
    case "$context" in
        "pull_request"|"pull_request_comment")
            echo "${GITHUB_EVENT_PULL_REQUEST_HEAD_SHA}"
            ;;
        "issue")
            echo "${GITHUB_SHA}"
            ;;
        *)
            echo "HEAD"
            ;;
    esac
}
```

### Enhanced Workflow Logic

```bash
# Handle different contexts appropriately
handle_context_specific_workflow() {
    local context="$1"
    local git_ref="$2"
    
    case "$context" in
        "pull_request"|"pull_request_comment")
            handle_pull_request_context "$git_ref"
            ;;
        "issue")
            handle_issue_context "$git_ref"
            ;;
        *)
            handle_default_context "$git_ref"
            ;;
    esac
}
```

## 📋 Configuration Changes

### New Input Parameters

```yaml
inputs:
  context_mode:
    description: 'Context handling mode: "auto" (detect), "pr" (force PR), "issue" (force issue)'
    required: false
    default: 'auto'
  
  pr_strategy:
    description: 'PR handling strategy: "continue" (update existing), "new" (create new)'
    required: false
    default: 'continue'
    
  git_reference_mode:
    description: 'Git reference mode: "auto" (context-based), "head" (latest), "base" (base branch)'
    required: false
    default: 'auto'
    
  enable_review_context:
    description: 'Enable special handling for PR review comments'
    required: false
    default: 'true'
```

### Environment Variable Enhancement

```bash
# Enhanced environment detection
GITHUB_CONTEXT_TYPE="${INPUT_CONTEXT_MODE:-auto}"
PR_STRATEGY="${INPUT_PR_STRATEGY:-continue}"
GIT_REFERENCE_MODE="${INPUT_GIT_REFERENCE_MODE:-auto}"
ENABLE_REVIEW_CONTEXT="${INPUT_ENABLE_REVIEW_CONTEXT:-true}"

# GitHub event context variables
GITHUB_EVENT_TYPE="${GITHUB_EVENT_NAME}"
GITHUB_EVENT_ISSUE_NUMBER="${GITHUB_EVENT_PATH:+$(jq -r '.issue.number // empty' "$GITHUB_EVENT_PATH")}"
GITHUB_EVENT_PULL_REQUEST_NUMBER="${GITHUB_EVENT_PATH:+$(jq -r '.pull_request.number // empty' "$GITHUB_EVENT_PATH")}"
GITHUB_EVENT_PULL_REQUEST_HEAD_SHA="${GITHUB_EVENT_PATH:+$(jq -r '.pull_request.head.sha // empty' "$GITHUB_EVENT_PATH")}"
GITHUB_EVENT_PULL_REQUEST_BASE_REF="${GITHUB_EVENT_PATH:+$(jq -r '.pull_request.base.ref // empty' "$GITHUB_EVENT_PATH")}"
```

## 🎮 Usage Examples

### 1. Pull Request Comment

```bash
# On a PR, comment:
@swe-agent Fix the linting errors in this PR

# Result: SWE-Agent will:
# - Checkout the PR's head branch
# - Apply fixes to the existing PR
# - Push changes to the same branch
# - Update the PR with the fixes
```

### 2. Issue Comment

```bash
# On an issue, comment:
@swe-agent Implement the user authentication feature

# Result: SWE-Agent will:
# - Start from the latest commit on main/default branch
# - Create a new feature branch
# - Implement the feature
# - Create a new PR linking to the issue
```

### 3. PR Review Comment

```bash
# On a PR review, comment:
@swe-agent Address the security concerns mentioned in the review

# Result: SWE-Agent will:
# - Focus on the specific files in the review
# - Address review feedback
# - Update the PR with targeted fixes
```

## 🚀 Enhanced Workflow Examples

### Complete Multi-Context Workflow

```yaml
name: Enhanced SWE-Agent (Multi-Context)

on:
  issue_comment:
    types: [created]
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created]

permissions:
  issues: write
  contents: write
  pull-requests: write

jobs:
  swe-agent-resolver:
    name: SWE-Agent Multi-Context Resolver
    runs-on: ubuntu-latest
    if: |
      contains(github.event.comment.body, '@swe-agent') ||
      contains(github.event.review.body, '@swe-agent')
    
    steps:
      - name: Enhanced SWE-Agent Resolver
        uses: nimishchaudhari/swe-agent-resolver@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          model_name: 'gpt-4o'
          context_mode: 'auto'              # Auto-detect context
          pr_strategy: 'continue'           # Continue existing PRs
          git_reference_mode: 'auto'        # Context-based Git refs
          enable_review_context: 'true'     # Handle review comments
```

### PR-Specific Workflow

```yaml
name: SWE-Agent PR Enhancement

on:
  issue_comment:
    types: [created]

jobs:
  pr-enhancement:
    if: |
      github.event.issue.pull_request != null && 
      contains(github.event.comment.body, '@swe-agent')
    runs-on: ubuntu-latest
    
    steps:
      - name: Enhance Pull Request
        uses: nimishchaudhari/swe-agent-resolver@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          context_mode: 'pr'
          pr_strategy: 'continue'
```

## 📊 Context Detection Logic

### Event Type Detection

```bash
detect_event_context() {
    local context_type="unknown"
    
    # Check for PR review events
    if [ "$GITHUB_EVENT_NAME" = "pull_request_review" ] || [ "$GITHUB_EVENT_NAME" = "pull_request_review_comment" ]; then
        context_type="pr_review"
    # Check for PR comment (issue comment on a PR)
    elif [ "$GITHUB_EVENT_NAME" = "issue_comment" ] && [ -n "$GITHUB_EVENT_PULL_REQUEST_NUMBER" ]; then
        context_type="pr_comment"
    # Check for issue comment
    elif [ "$GITHUB_EVENT_NAME" = "issue_comment" ] && [ -n "$GITHUB_EVENT_ISSUE_NUMBER" ]; then
        context_type="issue_comment"
    fi
    
    echo "$context_type"
}
```

### Reference Point Selection

```bash
determine_git_reference() {
    local context="$1"
    local reference_mode="$2"
    
    case "$reference_mode" in
        "auto")
            case "$context" in
                "pr_review"|"pr_comment")
                    echo "${GITHUB_EVENT_PULL_REQUEST_HEAD_SHA}"
                    ;;
                "issue_comment")
                    echo "${GITHUB_SHA}"
                    ;;
                *)
                    echo "HEAD"
                    ;;
            esac
            ;;
        "head")
            echo "${GITHUB_SHA}"
            ;;
        "base")
            echo "${GITHUB_EVENT_PULL_REQUEST_BASE_REF:-main}"
            ;;
        *)
            echo "HEAD"
            ;;
    esac
}
```

## 🔄 Enhanced Response Templates

### PR Context Response

```markdown
🔄 **SWE-Agent PR Enhancement Complete**

**Pull Request:** #123 - Fix authentication issues
**Context:** Pull Request Comment
**Model:** gpt-4o
**Strategy:** Continue existing PR

## 🎯 Changes Applied

Applied fixes directly to the existing pull request:
- Fixed authentication logic in `auth.py`
- Updated tests for new auth flow
- Resolved linting issues

## 📋 What Changed

[Detailed change summary]

## 🔄 Next Steps

✅ Changes have been pushed to the PR branch
✅ PR is ready for continued review
✅ No new PR created (updated existing)

---
*🔄 Enhanced by SWE-Agent using gpt-4o • PR context mode*
```

### Issue Context Response

```markdown
🆕 **SWE-Agent Issue Resolution Complete**

**Issue:** #456 - Add user profile feature
**Context:** Issue Comment
**Model:** gpt-4o
**Strategy:** New feature branch

## 🎯 Implementation Created

Created a new implementation for the requested feature:
- New user profile component
- Database migrations
- API endpoints

## 📋 Pull Request Created

[Link to new PR] - Ready for review

## 🔄 Next Steps

✅ Feature branch created: `swe-agent-feature-456`
✅ Pull request created and linked to issue
✅ Ready for code review

---
*🆕 Implemented by SWE-Agent using gpt-4o • Issue context mode*
```

## 🛡️ Safety & Validation

### Context Validation

```bash
validate_context() {
    local context="$1"
    
    case "$context" in
        "pr_review"|"pr_comment")
            if [ -z "$GITHUB_EVENT_PULL_REQUEST_NUMBER" ]; then
                log "❌ PR context detected but no PR number found"
                return 1
            fi
            ;;
        "issue_comment")
            if [ -z "$GITHUB_EVENT_ISSUE_NUMBER" ]; then
                log "❌ Issue context detected but no issue number found"
                return 1
            fi
            ;;
    esac
    
    return 0
}
```

### Reference Validation

```bash
validate_git_reference() {
    local ref="$1"
    
    if ! git rev-parse --verify "$ref" >/dev/null 2>&1; then
        log "❌ Invalid Git reference: $ref"
        return 1
    fi
    
    return 0
}
```

## 📈 Monitoring & Analytics

### Context Metrics

- **Context Distribution**: Track usage across PR vs Issue contexts
- **Success Rates**: Compare success rates by context type
- **Response Times**: Monitor performance across different contexts
- **User Satisfaction**: Track feedback for different context types

### Enhanced Logging

```bash
log_context_info() {
    local context="$1"
    local reference="$2"
    
    log "📊 Context Analysis:"
    log "  🎯 Detected Context: $context"
    log "  📍 Git Reference: $reference"
    log "  🔗 Event Type: $GITHUB_EVENT_NAME"
    log "  📋 PR Number: ${GITHUB_EVENT_PULL_REQUEST_NUMBER:-N/A}"
    log "  📋 Issue Number: ${GITHUB_EVENT_ISSUE_NUMBER:-N/A}"
}
```

## 🔮 Future Enhancements

### Advanced Context Features

1. **Multi-PR Coordination**: Handle changes across multiple related PRs
2. **Branch Strategies**: Support different Git workflow patterns
3. **Conflict Resolution**: Smart handling of merge conflicts
4. **Context Memory**: Remember previous interactions in the same context

### Integration Opportunities

1. **CI/CD Integration**: Trigger builds/tests based on context
2. **Review Automation**: Automatic review request based on changes
3. **Deployment Hooks**: Context-aware deployment triggers
4. **Documentation Updates**: Auto-update docs based on context

## 📋 Migration Guide

### From Current Implementation

1. **Backward Compatibility**: All existing workflows continue to work
2. **Gradual Adoption**: New features are opt-in via configuration
3. **Enhanced Defaults**: Improved behavior with no configuration changes required

### Configuration Updates

```yaml
# Before (still works)
- uses: nimishchaudhari/swe-agent-resolver@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}

# After (enhanced)
- uses: nimishchaudhari/swe-agent-resolver@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
    context_mode: 'auto'              # New: Auto-detect context
    pr_strategy: 'continue'           # New: PR handling strategy
    git_reference_mode: 'auto'        # New: Git reference strategy
```

## ✅ Implementation Checklist

- [ ] Enhanced event detection for multiple GitHub event types
- [ ] Context-aware Git reference handling
- [ ] PR continuation vs new PR creation logic
- [ ] Review comment specific handling
- [ ] Enhanced response templates for different contexts
- [ ] Comprehensive error handling for new contexts
- [ ] Updated documentation and examples
- [ ] Backward compatibility testing
- [ ] Performance validation across contexts

---

**This enhancement provides comprehensive multi-context support while maintaining full backward compatibility with existing workflows.**
