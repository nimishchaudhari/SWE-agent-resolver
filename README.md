# 🤖 SWE-Agent Resolver

**AI-powered GitHub Action for automated code assistance using SWE-agent with LiteLLM multi-provider support**

[![GitHub Action](https://img.shields.io/badge/GitHub%20Action-available-blue)](https://github.com/marketplace/actions/swe-agent-resolver)
[![Docker](https://img.shields.io/badge/Docker-supported-blue)](https://hub.docker.com/r/nimishchaudhari/swe-agent-resolver)
[![LiteLLM](https://img.shields.io/badge/LiteLLM-integrated-green)](https://github.com/BerriAI/litellm)

Transform your repository into an AI-powered development environment where you can simply comment `@swe-agent fix this bug` and get intelligent code assistance from multiple AI providers.

## ✨ Features

### 🔌 Universal AI Provider Support
- **OpenAI**: GPT-4, GPT-3.5-turbo, GPT-4-turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus
- **Azure OpenAI**: Enterprise-grade deployment
- **DeepSeek**: Cost-effective coding models
- **OpenRouter**: Access to 100+ models including Llama, Qwen
- **Groq**: Ultra-fast inference
- **Together AI**: Open-source model hosting
- **Mistral**: European AI models
- **Custom/Local**: Your own LLM endpoints

### 🎯 Smart Trigger System
- Comment-based activation: `@swe-agent analyze this issue`
- Model override: `@swe-agent using deepseek/deepseek-chat fix this`
- Automatic issue and PR analysis
- Context-aware responses

### 💰 Cost Management
- Real-time cost estimation per provider
- Configurable spending limits
- Automatic fallback to cheaper models
- Provider-specific optimization

### 🔄 Intelligent Fallbacks
- Multi-provider redundancy
- Automatic model switching on failures
- Rate limit handling
- Cost-based provider selection

## 🚀 Quick Start

### 1. Add to Your Repository

Create `.github/workflows/swe-agent.yml`:

```yaml
name: SWE-Agent Assistant

on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, edited, synchronize]
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  swe-agent:
    runs-on: ubuntu-latest
    steps:
      - name: AI Code Assistant
        uses: nimishchaudhari/swe-agent-resolver@v1
        with:
          model_name: 'gpt-4o'
          trigger_phrase: '@swe-agent'
          max_cost: '5.00'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

### 2. Configure Your Secrets

Add to repository secrets (Settings → Secrets and variables → Actions):

```bash
# Required
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Automatically available

# Choose your AI provider (add one or more)
OPENAI_API_KEY: sk-...                     # OpenAI API key
ANTHROPIC_API_KEY: sk-ant-...              # Anthropic API key
DEEPSEEK_API_KEY: sk-...                   # DeepSeek API key
OPENROUTER_API_KEY: sk-or-...              # OpenRouter API key
```

### 3. Start Using

Comment on any issue or PR:
```
@swe-agent analyze this bug and suggest a fix
@swe-agent review this code for security issues
@swe-agent using claude-3-5-sonnet-latest refactor this function
```

## 📊 Provider Comparison

| Provider | Models | Cost (per 1M tokens) | Speed | Best For |
|----------|---------|---------------------|-------|----------|
| **OpenAI** | GPT-4o, GPT-4, GPT-3.5 | $1.50-$15.00 | Fast | General purpose, coding |
| **Anthropic** | Claude 3.5 Sonnet | $3.00-$15.00 | Medium | Code analysis, reasoning |
| **DeepSeek** | DeepSeek-Chat, DeepSeek-Coder | $0.14-$0.28 | Fast | 🏆 **Most cost-effective** |
| **OpenRouter** | 100+ models | $0.50-$10.00 | Varies | Model diversity |
| **Groq** | Llama, Mixtral | $0.27 | ⚡ **Fastest** | Quick responses |
| **Azure** | GPT-4, GPT-3.5 | Custom | Fast | 🏢 **Enterprise** |

## 🔧 Configuration

### Basic Configuration

```yaml
- name: SWE-Agent Resolver
  uses: nimishchaudhari/swe-agent-resolver@v1
  with:
    model_name: 'gpt-4o'                    # AI model to use
    trigger_phrase: '@swe-agent'            # Trigger phrase in comments
    max_cost: '5.00'                        # Maximum cost per execution ($)
    allowed_tools: 'str_replace_editor,bash,file_viewer,python_executor'
    custom_instructions: 'Follow our coding standards'
```

### Advanced Configuration

```yaml
- name: SWE-Agent Resolver
  uses: nimishchaudhari/swe-agent-resolver@v1
  with:
    model_name: 'claude-3-5-sonnet-latest'
    trigger_phrase: '@swe-agent'
    max_cost: '8.00'
    allowed_tools: 'str_replace_editor,bash,file_viewer,python_executor,git_tool'
    deployment_type: 'local'
    custom_instructions: 'Follow TDD practices and include comprehensive tests'
    fallback_models: 'gpt-4o,deepseek/deepseek-chat'
    workspace_timeout: '2400'               # 40 minutes
    debug_mode: 'true'
```

## 🔑 Provider Setup Guides

### OpenAI Setup

1. **Get API Key**: Visit [OpenAI API](https://platform.openai.com/api-keys)
2. **Add to Secrets**: `OPENAI_API_KEY`
3. **Models**: `gpt-4o`, `gpt-4`, `gpt-3.5-turbo`

```yaml
with:
  openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

**Cost**: $1.50-$15.00 per 1M tokens

### Anthropic Claude Setup

1. **Get API Key**: Visit [Anthropic Console](https://console.anthropic.com/)
2. **Add to Secrets**: `ANTHROPIC_API_KEY`
3. **Models**: `claude-3-5-sonnet-latest`, `claude-3-haiku-20240307`

```yaml
with:
  model_name: 'claude-3-5-sonnet-latest'
  anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Cost**: $3.00-$15.00 per 1M tokens

### DeepSeek Setup (Most Cost-Effective)

1. **Get API Key**: Visit [DeepSeek API](https://platform.deepseek.com/)
2. **Add to Secrets**: `DEEPSEEK_API_KEY`
3. **Models**: `deepseek/deepseek-chat`, `deepseek/deepseek-coder`

```yaml
with:
  model_name: 'deepseek/deepseek-chat'
  max_cost: '2.00'  # Lower cost needed
  deepseek_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
```

**Cost**: $0.14-$0.28 per 1M tokens ⭐ **Best value**

### OpenRouter Setup (100+ Models)

1. **Get API Key**: Visit [OpenRouter](https://openrouter.ai/keys)
2. **Add to Secrets**: `OPENROUTER_API_KEY`
3. **Models**: `openrouter/anthropic/claude-3.5-sonnet`, `openrouter/qwen/qwen-32b`

```yaml
with:
  model_name: 'openrouter/anthropic/claude-3.5-sonnet'
  openrouter_api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

**Cost**: Varies by model ($0.50-$10.00 per 1M tokens)

### Azure OpenAI Setup (Enterprise)

1. **Create Azure OpenAI Resource**
2. **Deploy Model** (e.g., GPT-4)
3. **Add Secrets**:
   - `AZURE_OPENAI_API_KEY`
   - `AZURE_OPENAI_ENDPOINT` (as repository variable)
   - `AZURE_OPENAI_API_VERSION` (as repository variable)

```yaml
with:
  model_name: 'azure/gpt-4'  # Must match deployment name
  azure_openai_api_key: ${{ secrets.AZURE_OPENAI_API_KEY }}
  azure_openai_endpoint: ${{ vars.AZURE_OPENAI_ENDPOINT }}
  azure_openai_api_version: ${{ vars.AZURE_OPENAI_API_VERSION }}
```

### Groq Setup (Fastest)

1. **Get API Key**: Visit [Groq Console](https://console.groq.com/keys)
2. **Add to Secrets**: `GROQ_API_KEY`
3. **Models**: `groq/llama2-70b-4096`, `groq/mixtral-8x7b-32768`

```yaml
with:
  model_name: 'groq/llama2-70b-4096'
  groq_api_key: ${{ secrets.GROQ_API_KEY }}
```

**Cost**: $0.27 per 1M tokens ⚡ **Fastest inference**

## 🎯 Usage Examples

### Issue Analysis
```
@swe-agent analyze this authentication bug
```

### Pull Request Review
```
@swe-agent review this PR for security vulnerabilities
```

### Code Improvement
```
@swe-agent refactor this function to improve performance
```

### Model-Specific Requests
```
@swe-agent using deepseek/deepseek-coder optimize this algorithm
@swe-agent using claude-3-5-sonnet-latest provide detailed code review
```

### Custom Instructions
```
@swe-agent fix this bug and include unit tests following our TDD practices
```

## 🔄 Multi-Provider Fallback Example

```yaml
name: Robust AI Assistant

jobs:
  swe-agent:
    runs-on: ubuntu-latest
    steps:
      - name: AI Assistant with Fallbacks
        uses: nimishchaudhari/swe-agent-resolver@v1
        with:
          model_name: 'claude-3-5-sonnet-latest'     # Primary (best quality)
          fallback_models: 'gpt-4o,deepseek/deepseek-chat,groq/llama2-70b-4096'
          max_cost: '6.00'
          github_token: ${{ secrets.GITHUB_TOKEN }}
          # Multiple providers for redundancy
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          deepseek_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
          groq_api_key: ${{ secrets.GROQ_API_KEY }}
```

**Fallback Strategy**:
1. Try Claude 3.5 Sonnet (best quality)
2. Fallback to GPT-4o if Claude fails
3. Fallback to DeepSeek (cost-effective)
4. Final fallback to Groq (fastest)

## 💡 Cost Optimization Tips

### Budget-Friendly Setup
```yaml
with:
  model_name: 'deepseek/deepseek-chat'  # $0.14 per 1M tokens
  max_cost: '1.00'                      # $1 limit
  fallback_models: 'groq/llama2-70b-4096,gpt-3.5-turbo'
```

### High-Quality Setup
```yaml
with:
  model_name: 'claude-3-5-sonnet-latest'  # Best reasoning
  max_cost: '10.00'                       # Higher budget
  fallback_models: 'gpt-4o,claude-3-haiku-20240307'
```

### Balanced Setup
```yaml
with:
  model_name: 'gpt-4o'                 # Good balance
  max_cost: '5.00'                     # Moderate budget
  fallback_models: 'deepseek/deepseek-chat,groq/llama2-70b-4096'
```

## 🛠️ Development

### Local Development

```bash
# Clone repository
git clone https://github.com/nimishchaudhari/swe-agent-resolver
cd swe-agent-resolver

# Install dependencies
npm install

# Build Docker image
docker build -t swe-agent-resolver .

# Test locally
docker run -e GITHUB_TOKEN=... -e OPENAI_API_KEY=... swe-agent-resolver
```

### Testing

```bash
# Run tests
npm test

# Run integration tests
npm run test:integration

# Test specific provider
npm run test:provider -- --provider=openai
```

## 📚 Advanced Features

### Custom Tools Configuration

```yaml
with:
  allowed_tools: 'str_replace_editor,bash,file_viewer,python_executor,git_tool,node_executor'
```

Available tools:
- `str_replace_editor` - Code editing
- `bash` - Shell commands
- `file_viewer` - File reading
- `python_executor` - Python code execution
- `node_executor` - Node.js execution
- `git_tool` - Git operations

### Deployment Types

```yaml
with:
  deployment_type: 'local'    # Default: local execution
  # deployment_type: 'modal'  # Future: Modal serverless
  # deployment_type: 'docker' # Future: Docker containers
```

### Debug Mode

```yaml
with:
  debug_mode: 'true'  # Enable detailed logging
```

## 🔐 Security

### Repository Secrets Management

| Secret Name | Provider | Required | Example |
|-------------|----------|----------|---------|
| `OPENAI_API_KEY` | OpenAI | For OpenAI models | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic | For Claude models | `sk-ant-...` |
| `DEEPSEEK_API_KEY` | DeepSeek | For DeepSeek models | `sk-...` |
| `OPENROUTER_API_KEY` | OpenRouter | For OpenRouter models | `sk-or-...` |
| `GROQ_API_KEY` | Groq | For Groq models | `gsk_...` |
| `AZURE_OPENAI_API_KEY` | Azure | For Azure OpenAI | `...` |

### Repository Variables (Optional)

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint | `https://your-resource.openai.azure.com/` |
| `AZURE_OPENAI_API_VERSION` | Azure API version | `2024-02-15-preview` |
| `CUSTOM_LLM_BASE_URL` | Custom LLM endpoint | `http://localhost:8080/v1` |

### Best Practices

1. **Use organization-level secrets** for shared API keys
2. **Set spending limits** on provider accounts
3. **Monitor costs** regularly through provider dashboards
4. **Use least-privilege** GitHub tokens
5. **Rotate API keys** periodically

## 📈 Monitoring & Analytics

### Action Outputs

```yaml
- name: SWE-Agent Resolver
  id: swe-agent
  uses: nimishchaudhari/swe-agent-resolver@v1
  # ... configuration

- name: Report Results
  run: |
    echo "Status: ${{ steps.swe-agent.outputs.execution_status }}"
    echo "Provider: ${{ steps.swe-agent.outputs.provider_used }}"
    echo "Cost: ${{ steps.swe-agent.outputs.cost_estimate }}"
    echo "Patch Applied: ${{ steps.swe-agent.outputs.patch_applied }}"
```

### Cost Tracking

```yaml
- name: Cost Tracking
  if: always()
  run: |
    echo "Daily cost: ${{ steps.swe-agent.outputs.cost_estimate }}"
    # Add to your cost tracking system
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/nimishchaudhari/swe-agent-resolver
cd swe-agent-resolver
npm install
npm run dev
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [GitHub Wiki](https://github.com/nimishchaudhari/swe-agent-resolver/wiki)
- **Issues**: [GitHub Issues](https://github.com/nimishchaudhari/swe-agent-resolver/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nimishchaudhari/swe-agent-resolver/discussions)
- **Discord**: [Join our community](https://discord.gg/swe-agent-resolver)

## 🗺️ Roadmap

- [x] Multi-provider LiteLLM integration
- [x] Cost management and optimization
- [x] Smart fallback system
- [ ] Web dashboard for analytics
- [ ] Custom workflow templates
- [ ] Integration with more AI providers
- [ ] Enterprise SSO support
- [ ] Advanced code analysis tools

---

**Ready to supercharge your repository with AI?** 

Add the action and start commenting `@swe-agent` on your issues! 🚀