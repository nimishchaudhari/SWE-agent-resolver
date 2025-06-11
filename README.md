# 🤖 SWE-Agent GitHub Action Wrapper

**Lightweight GitHub Action wrapper for seamless SWE-agent integration**

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-Lightweight%20Wrapper-brightgreen)](https://github.com/nimishchaudhari/swe-agent-resolver)
[![SWE-Agent](https://img.shields.io/badge/SWE--Agent-Native%20Integration-blue)](https://github.com/princeton-nlp/SWE-agent)
[![Tests](https://img.shields.io/badge/Tests-Reliable%20%26%20Simple-success)](./test/)
[![Multi-Provider](https://img.shields.io/badge/Providers-12%2B%20Supported-green)](https://docs.litellm.ai/docs/providers)

> The simplest way to connect GitHub issues and PRs to SWE-agent's powerful code analysis and fixing capabilities. Just comment `@swe-agent` and let SWE-agent do what it does best.

## ✨ Why This Wrapper?

🎯 **SWE-Agent Native** - Direct execution of SWE-agent CLI, not a replacement  
⚡ **Minimal Overhead** - Lightweight wrapper that does exactly one thing well  
🔧 **Zero Configuration** - Works out of the box with sensible defaults  
🛡️ **Reliable & Simple** - Robust error handling without complexity  
🚀 **GitHub Integration** - Perfect integration with GitHub workflows and events  

## 🚀 Quick Start

### 1. Add to Your Repository

Create `.github/workflows/swe-agent.yml`:

```yaml
name: SWE-Agent Assistant

on:
  issue_comment:
    types: [created]
  issues:
    types: [opened]
  pull_request:
    types: [opened]

jobs:
  swe-agent:
    runs-on: ubuntu-latest
    if: contains(github.event.comment.body, '@swe-agent') || github.event_name == 'issues' || github.event_name == 'pull_request'
    
    steps:
      - name: SWE-Agent Wrapper
        uses: nimishchaudhari/swe-agent-resolver@v1
        with:
          model_name: 'gpt-4o-mini'
          trigger_phrase: '@swe-agent'
          max_cost: '5.00'
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Add Your API Key

Go to **Settings → Secrets and variables → Actions** and add:

```
OPENAI_API_KEY: sk-proj-your-openai-key-here
```

### 3. Start Using

Comment on any issue or PR:
```
@swe-agent help with this bug
@swe-agent review this code
@swe-agent optimize this function
```

## 🌟 Key Features

### 🎯 Minimal Wrapper Design

- ✅ **SWE-Agent Native** - Direct CLI execution, no abstraction layers
- ✅ **Zero Configuration** - Works immediately with sensible defaults
- ✅ **Lightweight** - ~800 lines of focused code vs complex orchestration
- ✅ **Single Responsibility** - Does one thing exceptionally well
- ✅ **Fast Startup** - Minimal overhead for quick response times

### 🔌 Multi-Provider Support

| Provider | Example Model | Best For |
|----------|---------------|----------|
| **OpenAI** | `gpt-4o-mini` | General purpose, reliable |
| **Anthropic** | `claude-3-5-sonnet-latest` | Advanced reasoning |
| **DeepSeek** | `deepseek/deepseek-chat` | Cost-effective |
| **Groq** | `groq/llama2-70b-4096` | Fast inference |

**All providers supported**: OpenAI, Anthropic, DeepSeek, Groq, OpenRouter, Azure OpenAI, and more

### 🛡️ Reliable & Simple

- ✅ **Robust Error Handling** - Clear error messages without complexity
- ✅ **Graceful Degradation** - Fails safely with helpful feedback
- ✅ **Simple Configuration** - Minimal setup required
- ✅ **GitHub Native** - Perfect integration with GitHub workflows
- ✅ **Security First** - No API key exposure, proper input validation

## 📋 Configuration Options

### Basic Configuration

```yaml
with:
  model_name: 'gpt-4o-mini'          # AI model to use
  trigger_phrase: '@swe-agent'       # Comment trigger
  max_cost: '5.00'                   # Budget limit
  tools: 'str_replace_editor,bash'   # SWE-agent tools (optional)
```

### Provider Examples

```yaml
# OpenAI (default)
model_name: 'gpt-4o-mini'
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

# Anthropic Claude
model_name: 'claude-3-5-sonnet-latest'
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

# DeepSeek (cost-effective)
model_name: 'deepseek/deepseek-chat'
env:
  DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
```

## 🎯 Usage Examples

### Issue Analysis
```
@swe-agent analyze this authentication bug and provide a fix
```

### Code Review
```
@swe-agent review this PR for potential issues
```

### Performance Optimization
```
@swe-agent optimize this function for better performance
```

### Code Refactoring
```
@swe-agent refactor this function and add error handling
```

### Test Generation
```
@swe-agent generate unit tests for this module
```

## 🔧 Configuration Reference

```yaml
- name: SWE-Agent Wrapper
  uses: nimishchaudhari/swe-agent-resolver@v1
  with:
    # Required
    model_name: 'gpt-4o-mini'           # AI model to use
    
    # Optional
    trigger_phrase: '@swe-agent'        # Comment trigger (default: '@swe-agent')
    max_cost: '5.00'                    # Budget limit in USD (default: '5.00')
    tools: 'str_replace_editor,bash'    # SWE-agent tools (default: all available)
    debug_mode: 'false'                 # Enable debug logging (default: 'false')
    
  env:
    # GitHub (required)
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    
    # Provider API Key (one required based on model)
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
    GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
```

## 📊 Action Outputs

```yaml
- name: SWE-Agent Wrapper
  id: swe-agent
  uses: nimishchaudhari/swe-agent-resolver@v1
  # ... configuration

- name: Check Results
  run: |
    echo "Status: ${{ steps.swe-agent.outputs.status }}"
    echo "Cost: ${{ steps.swe-agent.outputs.cost_estimate }}"
    echo "Comment: ${{ steps.swe-agent.outputs.comment_url }}"
```

**Available Outputs**:
- `status`: success, failure, skipped
- `cost_estimate`: Estimated cost in USD
- `comment_url`: GitHub comment with results

## 🛠️ Development

### Local Development

```bash
# Clone and setup
git clone https://github.com/nimishchaudhari/swe-agent-resolver
cd swe-agent-resolver
npm install

# Run tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm test                   # All tests

# Build Docker image
docker build -t swe-agent-resolver .
```

## 🔐 Security

### API Key Setup

Add these secrets to your repository:

| Secret | Provider | Format |
|--------|----------|--------|
| `OPENAI_API_KEY` | OpenAI | `sk-*` or `sk-proj-*` |
| `ANTHROPIC_API_KEY` | Anthropic | `sk-ant-*` |
| `DEEPSEEK_API_KEY` | DeepSeek | `sk-*` |
| `GROQ_API_KEY` | Groq | `gsk_*` |

### Security Features

- ✅ **Secure API Keys** - No secrets in logs
- ✅ **Input Validation** - Safe parameter handling
- ✅ **Workspace Isolation** - Temporary directories
- ✅ **Cost Controls** - Budget limits

## 🗺️ Architecture

This wrapper follows the **Minimal Wrapper Pattern**:

```
GitHub Event → Event Handler → Config Builder → SWE-Agent CLI → Result Parser → GitHub Comment
```

### Why This Approach?

- **SWE-Agent Native**: Leverages SWE-agent's full capabilities without abstraction
- **Simple & Reliable**: ~800 lines of focused code vs complex orchestration
- **Fast Execution**: Minimal overhead for quick response times
- **Easy Maintenance**: Clear, linear flow that's easy to understand and debug

## 🤝 Contributing

We welcome contributions! 

```bash
git clone https://github.com/nimishchaudhari/swe-agent-resolver
cd swe-agent-resolver
npm install
npm test     # Run test suite
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **🐛 Issues**: [Report bugs or request features](https://github.com/nimishchaudhari/swe-agent-resolver/issues)
- **💬 Discussions**: [Community Q&A](https://github.com/nimishchaudhari/swe-agent-resolver/discussions)

---

## 🚀 Ready to Get Started?

1. **Add the workflow** to your repository
2. **Set up your API key** (any supported provider)
3. **Comment `@swe-agent`** on any issue or PR
4. **Let SWE-agent work its magic!**

**Simple, reliable, and ready to enhance your development workflow.** ✨