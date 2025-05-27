# SWE-Agent AIO (All-In-One) Setup Guide

## 🚀 Quick Start

This repository provides a complete **All-In-One** GitHub Action for automated issue resolution using SWE-Agent with AI assistance. Everything is consolidated into a single workflow file for easy deployment.

## 📁 File Structure

```
/workspaces/swe-agent-resolver/
├── action.yml                           # Main action definition
├── .github/workflows/swe-agent-aio.yml  # 🎯 Main AIO workflow
├── entrypoint.sh                        # Action entrypoint script
├── Dockerfile                          # Container definition
└── README.md                           # Documentation
```

## 🔧 Installation

### Option 1: Copy the Workflow File (Recommended)

1. **Copy the AIO workflow file** to your repository:
   ```bash
   curl -o .github/workflows/swe-agent-aio.yml \
     https://raw.githubusercontent.com/nimishchaudhari/swe-agent-resolver/main/.github/workflows/swe-agent-aio.yml
   ```

2. **Update the action reference** in the workflow file:
   ```yaml
   # Change this line:
   uses: ./
   
   # To this:
   uses: nimishchaudhari/swe-agent-resolver@main
   ```

3. **Set up your secrets** in repository settings.

### Option 2: Fork This Repository

1. Fork this repository
2. The workflow will automatically work with `uses: ./`
3. Set up your secrets in the forked repository

## 🔑 Required Secrets

Add these secrets to your repository settings (`Settings > Secrets and variables > Actions`):

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | ✅ Primary |
| `ANTHROPIC_API_KEY` | Anthropic API key | ⚡ Fallback |
| `OPENROUTER_API_KEY` | OpenRouter API key | ⚡ Fallback |
| `GEMINI_API_KEY` | Google Gemini API key | ⚡ Fallback |

**Note**: You only need one API key, but having multiple provides fallback options.

## 🎯 Usage

### Trigger the Agent

Use the keyword `@swe-agent` in any of these contexts:

#### 1. Issue Comments
```
@swe-agent fix the authentication bug in login.py
```

#### 2. Pull Request Comments
```
@swe-agent review this code for security vulnerabilities
```

#### 3. Pull Request Reviews
```
@swe-agent analyze the performance impact of these changes
```

#### 4. Pull Request Descriptions
```
@swe-agent implement the missing unit tests for the new feature
```

### Response Modes

The agent automatically detects intent and responds accordingly:

| Intent | Trigger Keywords | Response Type |
|--------|------------------|---------------|
| 🔧 **Code Patches** | fix, implement, patch, resolve | Full code fixes with Git patches |
| 🔍 **PR Reviews** | review, lgtm, approve, merge | Comprehensive PR analysis |
| 📊 **Visual Content** | diagram, chart, visualize, graph | Mermaid diagrams and visual aids |
| 🔍 **Technical Analysis** | analyze, explain, investigate | Detailed technical explanations |
| 💡 **Opinions & Advice** | opinion, recommend, suggest, think | Expert recommendations |

### Examples

#### Code Fix Request
```
@swe-agent fix the SQL injection vulnerability in the user authentication endpoint
```
→ **Result**: Creates a new PR with security patches applied

#### PR Review Request
```
@swe-agent review this pull request for code quality and security
```
→ **Result**: Posts comprehensive review with merge recommendation

#### Analysis Request
```
@swe-agent analyze the performance bottlenecks in this database query optimization
```
→ **Result**: Detailed technical analysis with optimization suggestions

#### Visual Request
```
@swe-agent create a diagram showing the authentication flow architecture
```
→ **Result**: Mermaid diagrams and visual representations

## ⚙️ Configuration

### Environment Variables

Set these in your repository variables (`Settings > Secrets and variables > Actions > Variables`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SWE_AGENT_MODEL` | `gpt-4o` | AI model to use |

### Workflow Configuration

The AIO workflow supports these configurations:

```yaml
# Multi-context configuration
context_mode: 'auto'                    # Auto-detect context
pr_strategy: 'continue'                 # Continue existing PRs
git_reference_mode: 'auto'              # Context-based Git refs
enable_review_context: 'true'           # Handle review comments
target_branch_strategy: 'auto'          # Context-based branching

# Enhanced response modes
response_mode: 'auto'                   # Auto-detect intent
enable_visual_content: 'true'          # Enable visual responses
visual_content_format: 'all'           # All visual formats
max_comment_length: '65536'            # Maximum response length

# Performance tuning
timeout_seconds: '3000'                # 50 minutes max execution
```

## 🔄 How It Works

### Workflow Process

1. **Trigger Detection**: Monitors for `@swe-agent` in comments/descriptions
2. **Context Analysis**: Determines if it's an issue, PR comment, or review
3. **Intent Detection**: Analyzes request type (patch/review/analysis/opinion/visual)
4. **AI Processing**: Routes to appropriate AI provider with context
5. **Response Generation**: Creates formatted response based on intent
6. **Action Execution**: 
   - **For Issues**: Creates new PR with fixes
   - **For PRs**: Updates existing PR or posts analysis
   - **For Reviews**: Posts comprehensive review feedback

### Smart Context Handling

- **Issue Comments** → Creates new Pull Requests
- **PR Comments** → Updates existing Pull Requests  
- **PR Reviews** → Posts review analysis
- **PR Descriptions** → Enhances PR with fixes

## 🛠️ Troubleshooting

### Common Issues

#### 1. Workflow Not Triggering
- Ensure `@swe-agent` is in the comment/description
- Check repository permissions for GitHub Actions
- Verify the workflow file is in `.github/workflows/`

#### 2. API Key Errors
- Verify secrets are set correctly in repository settings
- Ensure at least one AI provider API key is configured
- Check API key validity and permissions

#### 3. Permission Errors
- Ensure `GITHUB_TOKEN` has necessary permissions
- Check repository settings for Actions permissions
- Verify workflow permissions in the YAML file

### Debug Mode

Enable debug logging by adding this to your workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

## 📊 Features Overview

### ✅ Implemented Features

- **Multi-Context Support**: Issues, PRs, Reviews, Comments
- **Intent Detection**: Automatic response mode selection
- **AI Provider Fallbacks**: OpenAI → Anthropic → OpenRouter → Gemini
- **Visual Content Generation**: Mermaid diagrams, ASCII art
- **PR Review Capabilities**: Comprehensive code analysis
- **Smart Git Handling**: Context-aware branching and commits
- **Real-time Updates**: Progress tracking with emoji reactions
- **Error Handling**: Graceful failures with user feedback

### 🔮 Supported AI Models

| Provider | Default Model | Alternatives |
|----------|---------------|--------------|
| OpenAI | `gpt-4o` | `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-3-5-sonnet-20241022` | `claude-3-opus`, `claude-3-haiku` |
| OpenRouter | `meta-llama/llama-3.1-8b-instruct` | Various models |
| Google | `gemini-1.5-pro` | `gemini-1.5-flash` |

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the provided test suite
5. Submit a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/nimishchaudhari/swe-agent-resolver/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nimishchaudhari/swe-agent-resolver/discussions)
- **Documentation**: [Enhanced Features Guide](ENHANCED_FEATURES.md)

---

🤖 **Ready to deploy!** Copy the workflow file and start using `@swe-agent` in your repository.
