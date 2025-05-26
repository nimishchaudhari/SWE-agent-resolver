# SWE-Agent GitHub Actions Resolver - Sophisticated Features Guide

## Overview

This GitHub Action provides a sophisticated AI-powered issue resolver using SWE-Agent. It intelligently handles different types of requests and contexts, making it suitable for enterprise-level automation.

## Sophisticated Scenarios Handled

### 1. Context-Aware Processing

#### Issue Comments vs PR Comments
- **Issue Comments**: Works on the main/default branch of the repository
- **PR Comments**: Automatically detects PR context and works on the PR's latest commit
- **Branch Targeting**: For PR comments, analyzes the PR's head commit and base branch

```yaml
# Automatically detects context:
# - @swe-agent fix this bug          (on issue -> works on main branch)
# - @swe-agent review this change    (on PR -> works on PR's head commit)
```

### 2. Intent Analysis & Response Types

#### Analysis-Only Requests
Triggered by keywords: `analyze`, `review`, `opinion`, `explain`, `help`, `question`, `discuss`, `thoughts`

```yaml
# Examples:
# @swe-agent analyze this code structure
# @swe-agent help me understand this issue
# @swe-agent what's your opinion on this approach?
```

**Response**: Provides detailed analysis without generating patches or PRs.

#### Patch Generation Requests
Triggered by keywords: `fix`, `solve`, `implement`, `create`, `build`, `patch`, `code`

```yaml
# Examples:
# @swe-agent fix this bug
# @swe-agent implement the requested feature
# @swe-agent create a solution for this
```

**Response**: Generates code patches and optionally creates pull requests.

### 3. Automated Pull Request Creation

#### When PRs are Created
- Request intent is "patch" (fix/solve/implement keywords)
- `auto_pr` is enabled (default: true)
- SWE-Agent successfully generates a patch
- Proper permissions are available

#### PR Features
- **Smart Branch Naming**: `swe-agent-fix-{issue-number}-{timestamp}`
- **Comprehensive PR Description**: Includes issue reference, analysis summary, and instructions
- **Proper Git Attribution**: Uses SWE-Agent bot identity
- **Base Branch Detection**: For PR comments, targets the correct base branch

#### PR Creation Flow
```bash
1. Generate patch from SWE-Agent
2. Create new branch from target commit
3. Apply patch to new branch
4. Commit with descriptive message
5. Push branch to remote
6. Create PR via GitHub API
7. Link PR in response comment
```

### 4. Branch and Commit Targeting

#### For Issues
- Clones from `HEAD` of default branch
- Uses `pr_target_branch` input (default: main)

#### For PR Comments
- Automatically fetches PR information
- Clones at PR's head commit (`pr.head.sha`)
- Targets PR's base branch for new PRs
- Preserves PR context and diff

### 5. Error Handling & Fallbacks

#### Repository Cloning
- Handles permission issues
- Supports private repositories with proper tokens
- Fallback strategies for deleted branches
- Clear error messages to users

#### Patch Generation
- Multiple patch format detection (`.patch`, `.pred` files)
- JSON extraction from SWE-Agent output
- Graceful handling of no-patch scenarios
- Size limits and truncation for large patches

#### PR Creation
- Falls back to patch display if PR creation fails
- Handles permission issues gracefully
- Provides alternative manual application instructions

## Configuration Options

### Request Intent Keywords

```yaml
analysis_only_keywords: 'analyze,review,opinion,explain,help,question,discuss,thoughts'
force_patch_keywords: 'fix,solve,implement,create,build,patch,code'
```

### Automation Controls

```yaml
auto_pr: 'true'              # Enable automatic PR creation
pr_target_branch: 'main'     # Default target branch
max_patch_size: '50000'      # Max patch size in comments
```

### Timeout and Performance

```yaml
timeout_minutes: '30'        # Max execution time
swe_agent_args: ''          # Additional SWE-Agent arguments
```

## Usage Examples

### 1. Simple Bug Fix (Issue Comment)
```
@swe-agent fix the memory leak in the upload handler
```
- **Result**: Analyzes code, generates patch, creates PR

### 2. Code Review (PR Comment)
```
@swe-agent review this implementation and suggest improvements
```
- **Result**: Provides analysis of PR changes, no patch/PR created

### 3. Feature Implementation (Issue Comment)
```
@swe-agent implement user authentication using JWT tokens
```
- **Result**: Analyzes requirements, implements feature, creates PR

### 4. Analysis Request (Any Context)
```
@swe-agent help me understand why this test is failing
```
- **Result**: Analyzes test failure, provides explanation and suggestions

## Response Types

### 1. Patch + PR Creation
```markdown
✅ **Solution Generated & Pull Request Created!**

🔗 **Pull Request:** https://github.com/user/repo/pull/123

## 🔧 **Generated Patch Preview**
[patch content]

## 📝 **Next Steps**
1. ✅ Pull request has been created automatically
2. 👀 Review the changes in the PR
3. 🧪 Test the solution if needed
4. ✅ Merge when you're satisfied with the fix
```

### 2. Patch Only (No PR)
```markdown
✅ **Solution Generated Successfully!**

## 🔧 **Generated Patch**
[patch content]

## 📝 **Next Steps**
1. Review the proposed changes carefully
2. Test the solution in your development environment
3. Apply the patch: `git apply <patch_file>`
```

### 3. Analysis Only
```markdown
✅ **Analysis Complete**

## 🔍 **My Analysis**
[detailed analysis]

## 💡 **Recommendations**
[specific recommendations]

## 📝 **Next Steps**
[suggested actions]
```

## Security & Permissions

### Required Permissions
```yaml
permissions:
  issues: write          # Post comments and reactions
  contents: read         # Read repository content
  pull-requests: write   # Create PRs and PR comments
```

### Access Control
- Only repository collaborators can trigger the agent
- Automatic permission checking before execution
- Secure token handling for repository access

### Privacy & Safety
- Works on public and private repositories
- Respects repository access controls
- No data leakage between repositories
- Audit trail through GitHub Actions logs

## Advanced Customization

### Custom SWE-Agent Configuration
```yaml
swe_agent_args: '--config custom.yaml --max-iterations 50'
```

### Environment Variables
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Multiple Model Support
```yaml
model_name: 'gpt-4o'           # OpenAI GPT-4
model_name: 'claude-3.5-sonnet' # Anthropic Claude
model_name: 'gpt-4-turbo'     # OpenAI GPT-4 Turbo
```

## Monitoring & Debugging

### Reaction System
- 👀 Eyes: Processing started
- ✅ Thumbs up: Success with patch/PR
- 🤔 Thinking: Success with analysis only
- 👎 Thumbs down: Repository/permission error
- 😕 Confused: SWE-Agent execution failed

### Log Analysis
- Comprehensive logging throughout execution
- Error extraction and user-friendly display
- Performance monitoring and timeout handling
- Audit trail for debugging issues

This sophisticated setup ensures that your SWE-Agent resolver can handle enterprise-level scenarios while providing a smooth user experience across different types of requests and repository contexts.
