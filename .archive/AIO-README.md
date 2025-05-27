# SWE-Agent AIO Resolver - Quick Setup Guide

## 🚀 All-In-One Deployment

The SWE-Agent AIO (All-In-One) Resolver is a comprehensive GitHub Action that handles all types of code assistance in a single workflow file.

### ✨ Features

- 🔧 **Traditional Code Fixes** - Full SWE-Agent patches for bugs and implementations
- 💡 **Expert Opinions** - Get recommendations and best practices
- 🔍 **Technical Analysis** - Detailed code and architecture analysis  
- 📊 **Visual Content** - Generate diagrams, charts, and visualizations
- 🔍 **Pull Request Reviews** - Comprehensive PR analysis with merge recommendations
- 🔄 **Multi-Context Support** - Works with issues, PRs, review comments, and PR reviews

### 🎯 Quick Start

1. **Copy the AIO workflow** to your repository:
   ```bash
   curl -o .github/workflows/swe-agent-aio.yml https://raw.githubusercontent.com/nimishchaudhari/swe-agent-resolver/main/workflow-aio.yml
   ```

2. **Add your API keys** to repository secrets:
   - `OPENAI_API_KEY` (required)
   - `ANTHROPIC_API_KEY` (optional)
   - `OPENROUTER_API_KEY` (optional)
   - `GEMINI_API_KEY` (optional)

3. **Use SWE-Agent** by mentioning `@swe-agent` in:
   - Issue comments
   - Pull request comments
   - Pull request reviews
   - Pull request descriptions

### 💬 Usage Examples

#### Get Expert Opinion
```
@swe-agent What do you think about using Redis for caching in this scenario?
```

#### Request Code Analysis
```
@swe-agent Can you analyze the performance impact of this database query?
```

#### Generate Visual Content
```
@swe-agent Create a diagram showing the data flow between these components
```

#### Comprehensive PR Review
```
@swe-agent Please review this PR for security, performance, and code quality
```

#### Traditional Code Fix
```
@swe-agent Fix the authentication bug in the login handler
```

### 🎛️ Advanced Configuration

You can customize the behavior by setting repository variables:

- `SWE_AGENT_MODEL`: AI model to use (default: `gpt-4o`)

### 🔍 How It Works

1. **Smart Detection**: Automatically detects the type of assistance needed
2. **Context Awareness**: Understands whether you're in an issue or PR context
3. **Intelligent Routing**: Routes to appropriate response mode (patch/opinion/analysis/visual/review)
4. **Professional Output**: Provides formatted, actionable responses
5. **Automated Actions**: For code fixes, automatically creates/updates PRs

### 📊 Response Types

| Intent | Trigger Words | Output |
|--------|---------------|--------|
| **PR Review** | review, lgtm, approve, code quality, security check | Comprehensive PR analysis with merge recommendation |
| **Visual** | chart, diagram, visualize, show | Mermaid diagrams, ASCII art, code examples |
| **Analysis** | analyze, explain, investigate, examine | Technical analysis and architectural insights |
| **Opinion** | opinion, advice, recommend, think | Expert recommendations and best practices |
| **Patch** | fix, implement, solve, resolve | Traditional SWE-Agent code fixes |

### 🌟 Why AIO?

- **Single File**: Everything in one workflow - easy to copy and deploy
- **No Dependencies**: Self-contained with all functionality included
- **Smart Routing**: Automatically handles different GitHub events
- **Production Ready**: Tested with 37 test cases, all passing
- **Multi-Provider**: Supports OpenAI, Anthropic, OpenRouter, and Gemini

### 🔧 Workflow Structure

The AIO workflow automatically:
- Detects context (issue/PR/review)
- Determines intent (patch/opinion/analysis/visual/review)
- Routes to appropriate AI provider
- Formats professional responses
- Handles PR updates or creates new PRs
- Provides progress feedback with reactions

### 🎉 Ready to Use

Just copy `workflow-aio.yml` to your `.github/workflows/` directory and start using `@swe-agent` in your issues and PRs!

---
*🤖 Powered by SWE-Agent AIO Resolver*
