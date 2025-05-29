# SWE-Agent Resolver

An intelligent GitHub webhook resolver that provides automated software engineering assistance with comprehensive error recovery and user guidance.

## ⚡ Quick Start

Get up and running in 3 simple steps:

```bash
# 1. Clone and install
git clone https://github.com/your-org/swe-agent-resolver.git
cd swe-agent-resolver
npm install

# 2. Setup configuration (interactive)
npm run config:setup

# 3. Start the server
npm start
```

**That's it!** The system will guide you through LLM selection, generate the configuration files, and provide clear next steps for GitHub webhook setup.

### 🚀 Even Faster: One-Command Setup

For the most common use case (GitHub integration with Claude):

```bash
npm run config:github  # Generates optimized config for GitHub + Claude 3.5 Sonnet
cp .env.example .env    # Copy environment template
# Edit .env with your API keys, then:
npm start
```

## 🌟 Features

### Core Capabilities
- **Issue Analysis**: Automatically analyzes GitHub issues and provides insights and recommendations
- **PR Review**: Reviews pull requests and suggests improvements with contextual feedback
- **Command Processing**: Responds to @swe-agent mentions in comments with intelligent triggers
- **Dynamic Configuration**: Generates optimized SWE-Agent configurations based on repository context
- **Multi-Platform Support**: Docker, Modal, and local execution environments

### Advanced Pipeline Management
- **Comprehensive Pipeline Orchestration**: Complete end-to-end workflow management
- **Intelligent Error Recovery**: Automatic error classification and recovery strategies
- **Progressive Communication**: Real-time status updates and detailed error reporting
- **State Management**: Handles long-running processes with proper resource cleanup
- **Resource Monitoring**: Tracks memory, CPU, and disk usage across executions

### Error Recovery & User Guidance
- **Error Classification**: Categorizes errors (configuration, resource limits, API limits, timeouts)
- **Recovery Strategies**: Intelligent retry mechanisms with fallback configurations
- **Actionable Feedback**: Provides clear troubleshooting steps and escalation paths
- **Debug Information**: Comprehensive debugging data for issue resolution

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub        │    │   Enhanced      │    │   Pipeline      │
│   Webhooks      │───▶│   Handler       │───▶│   Orchestrator  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Context       │    │   Config        │
                       │   Extractor     │    │   Generator     │
                       └─────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────┐
                                              │   SWE-Agent     │
                                              │   Orchestrator  │
                                              └─────────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────┐
                                              │   Result        │
                                              │   Processor     │
                                              └─────────────────┘
```

## 🚀 Setup

### 1. Quick Configuration Setup (Recommended)

The easiest way to get started is using our configuration CLI:

```bash
# Interactive setup - walks you through all options
npm run config:setup

# Quick setup for GitHub integration (recommended for most users)
npm run config:github

# Quick setup for pull request reviews
npm run config:pr

# Quick setup for local development
npm run config:local

# See all available LLM presets
npm run config:list
```

This will generate:
- `swe-agent-config.yaml` - Complete SWE-agent configuration
- `.env.example` - Environment template with all required variables

### 2. Manual Configuration

If you prefer manual setup:

#### Step 2a: Install Dependencies
```bash
npm install
```

#### Step 2b: Generate Configuration
```bash
# Generate configuration for Claude 3.5 Sonnet (recommended)
npm run config:quick github-integration

# Or use the CLI directly for more options
node scripts/setup-config.js generate --preset claude-3-5-sonnet --type issue_analysis
```

#### Step 2c: Configure Environment Variables
```bash
# Copy the generated template
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### 3. Configure GitHub Webhook

1. Go to your repository settings
2. Navigate to "Webhooks"
3. Add a new webhook with:
   - **Payload URL**: Your server endpoint + `/webhook`
   - **Content type**: `application/json`
   - **Secret**: A secure random string (use the one in your .env)
   - **Events**: Issues, Pull requests, Issue comments, Pull request review comments

### 4. Docker Deployment

```bash
# Using Docker Compose (Recommended)
docker-compose up -d

# Monitor logs
docker-compose logs -f

# Manual Docker build
docker build -t swe-agent-resolver .
docker run -p 3000:3000 --env-file .env swe-agent-resolver
```

### 5. Modal Deployment

For serverless deployment on Modal:

```bash
# Install Modal CLI
pip install modal

# Deploy to Modal
modal deploy src/config/templates/modal.config.js
```

## 📖 Usage

### GitHub Integration

Once deployed, the system automatically responds to:

1. **New Issues**: Analyzes issue content and provides initial assessment
2. **New Pull Requests**: Reviews PR changes and suggests improvements
3. **Issue Comments**: Responds to trigger phrases like:
   - `@swe-agent fix this`
   - `@swe-agent analyze the bug`
   - `@swe-agent test this code`
   - `@swe-agent refactor this function`

### Command Triggers

The system recognizes various command patterns:

```bash
# Code fixes
@swe-agent fix this bug
@swe-agent fix the authentication issue

# Code analysis
@swe-agent analyze this function
@swe-agent explain how this works

# Testing
@swe-agent test this component
@swe-agent generate tests for this file

# Refactoring
@swe-agent refactor this code
@swe-agent optimize this function
```

### GitHub Action Workflow

#### Simple Setup (Recommended)

```yaml
name: SWE-Agent Resolver
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
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install SWE-Agent Resolver
        run: |
          git clone https://github.com/your-org/swe-agent-resolver.git
          cd swe-agent-resolver
          npm install
          
      - name: Generate Configuration
        run: |
          cd swe-agent-resolver
          npm run config:github
          cp .env.example .env
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          
      - name: Start SWE-Agent Resolver
        run: |
          cd swe-agent-resolver
          npm start
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

#### Advanced Setup with Custom Configuration

```yaml
name: SWE-Agent Resolver (Custom)
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
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install SWE-Agent Resolver
        run: |
          git clone https://github.com/your-org/swe-agent-resolver.git
          cd swe-agent-resolver
          npm install
          
      - name: Generate Custom Configuration
        run: |
          cd swe-agent-resolver
          node scripts/setup-config.js generate \
            --preset claude-3-5-sonnet \
            --type issue_analysis \
            --workspace /tmp/swe-workspace \
            --repository ${{ github.repository }} \
            --output swe-config.yaml
            
      - name: Setup Environment
        run: |
          cd swe-agent-resolver
          cat > .env << EOF
          GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
          GITHUB_WEBHOOK_SECRET=${{ secrets.WEBHOOK_SECRET }}
          ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
          SWE_AGENT_PATH=/usr/local/bin/swe-agent
          LOG_LEVEL=info
          EOF
          
      - name: Validate Configuration
        run: |
          cd swe-agent-resolver
          npm run config:validate swe-config.yaml
          
      - name: Start SWE-Agent Resolver
        run: |
          cd swe-agent-resolver
          npm start
```

#### Enterprise Setup with Azure OpenAI

```yaml
name: SWE-Agent Resolver (Enterprise)
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
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install SWE-Agent Resolver
        run: |
          git clone https://github.com/your-org/swe-agent-resolver.git
          cd swe-agent-resolver
          npm install
          
      - name: Generate Enterprise Configuration
        run: |
          cd swe-agent-resolver
          npm run config:enterprise
          
      - name: Setup Enterprise Environment
        run: |
          cd swe-agent-resolver
          cat > .env << EOF
          GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
          GITHUB_WEBHOOK_SECRET=${{ secrets.WEBHOOK_SECRET }}
          AZURE_OPENAI_API_KEY=${{ secrets.AZURE_OPENAI_API_KEY }}
          AZURE_OPENAI_ENDPOINT=${{ secrets.AZURE_OPENAI_ENDPOINT }}
          AZURE_OPENAI_API_VERSION=2024-02-15-preview
          SWE_AGENT_PATH=/usr/local/bin/swe-agent
          LOG_LEVEL=info
          DEPLOYMENT_PLATFORM=docker
          EOF
          
      - name: Start SWE-Agent Resolver
        run: |
          cd swe-agent-resolver
          npm start
```

#### Required GitHub Secrets

Add these secrets to your repository settings:

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `GITHUB_TOKEN` | GitHub API token with repo permissions | All setups |
| `WEBHOOK_SECRET` | Webhook verification secret | All setups |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Claude models |
| `OPENAI_API_KEY` | OpenAI API key | OpenAI models |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | Azure models |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | Azure models |

## 📊 Monitoring & Status

### Health Endpoints

```bash
# Overall system health
GET /health

# Detailed status including active pipelines
GET /status

# Pipeline-specific status
GET /pipeline/{pipelineId}/status

# Metrics and performance data
GET /metrics
```

### Response Format

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "activePipelines": 2,
  "metrics": {
    "totalPipelines": 150,
    "successfulPipelines": 142,
    "recoveredPipelines": 5,
    "failedPipelines": 3,
    "avgProcessingTime": 45000
  },
  "resourceUsage": {
    "memory": "2.1GB",
    "cpu": "65%",
    "disk": "15.2GB"
  }
}
```

## 🛠️ Development

### Project Structure

```
src/
├── config/                 # Configuration management
│   ├── config-manager.js           # Main configuration handler
│   ├── swe-agent-config-generator.js # Dynamic SWE-Agent configs
│   ├── github-env-mapper.js        # GitHub environment mapping
│   └── templates/                  # Deployment templates
├── github/                 # GitHub integration
│   ├── enhanced-handler.js         # Main webhook handler
│   ├── context-extractor.js        # Issue/PR context extraction
│   ├── trigger-detector.js         # Command trigger detection
│   └── webhook-parser.js           # Webhook payload parsing
├── swe-agent/             # SWE-Agent orchestration
│   ├── pipeline-orchestrator.js    # Complete pipeline management
│   ├── enhanced-orchestrator.js    # SWE-Agent job orchestration
│   ├── process-manager.js          # Process lifecycle management
│   └── filesystem-manager.js       # Workspace management
├── result-processor/       # Output processing
│   └── index.js                    # Result formatting
└── utils/                 # Utilities
    └── logger.js                   # Structured logging
```

### Development Workflow

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run comprehensive tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance

# Code quality
npm run lint
npm run format
npm run type-check

# Build for production
npm run build
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests with webhook simulation
npm run test:integration

# Performance benchmarks
npm run test:performance

# End-to-end workflow tests
npm run test:e2e
```

## 🔧 Configuration Reference

### Easy Configuration Management

Our configuration system is designed to be as simple as possible while being fully compatible with SWE-agent's configuration format.

#### Available Configuration Commands

```bash
# Interactive configuration builder
npm run config:setup

# Quick presets for common scenarios
npm run config:github      # GitHub integration (Claude 3.5 Sonnet)
npm run config:pr          # Pull request reviews (GPT-4)
npm run config:local       # Local development (Local LLM)
npm run config:enterprise  # Enterprise (Azure OpenAI)

# Utility commands
npm run config:list         # List all available LLM presets
npm run config:validate swe-agent-config.yaml  # Validate configuration
npm run config:env claude-3-5-sonnet          # Generate .env template
```

#### Available LLM Presets

| Preset | Provider | Model | Context | Function Calling | Best For |
|--------|----------|-------|---------|------------------|----------|
| `claude-3-5-sonnet` | Anthropic | claude-3-5-sonnet-20241022 | 200K | ✅ | **Recommended** - Best overall performance |
| `claude-3-haiku` | Anthropic | claude-3-haiku-20240307 | 200K | ✅ | Fast responses, cost-effective |
| `gpt-4` | OpenAI | gpt-4 | 128K | ✅ | High-quality analysis |
| `gpt-4-turbo` | OpenAI | gpt-4-turbo-preview | 128K | ✅ | Latest GPT-4 features |
| `gpt-3.5-turbo` | OpenAI | gpt-3.5-turbo | 16K | ✅ | Budget-friendly option |
| `azure-gpt-4` | Azure | gpt-4 | 128K | ✅ | Enterprise deployments |
| `local-llama` | Local | llama-2-7b-chat | 4K | ❌ | Local/private deployment |
| `local-codellama` | Local | codellama-7b-instruct | 4K | ❌ | Code-focused local model |

#### Custom Configuration Generation

For advanced users who need custom configurations:

```bash
# Generate custom configuration
node scripts/setup-config.js generate \
  --preset claude-3-5-sonnet \
  --type pr_review \
  --workspace /custom/workspace \
  --repository https://github.com/user/repo \
  --output custom-config.yaml
```

### Environment Variables Reference

The system uses SWE-agent's standard environment variable format with `$VARIABLE_NAME` syntax:

#### Required Variables
```bash
# GitHub Integration
GITHUB_TOKEN=ghp_xxxxxxxxxxxx              # GitHub API token with repo access
GITHUB_WEBHOOK_SECRET=your_webhook_secret   # Webhook verification secret

# LLM API Keys (choose one or more)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx      # For Claude models
OPENAI_API_KEY=sk-xxxxxxxxxxxx             # For OpenAI models
AZURE_OPENAI_API_KEY=xxxxxxxxxxxx          # For Azure OpenAI
```

#### Optional Variables
```bash
# Azure OpenAI (if using azure-gpt-4 preset)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Local LLM (if using local presets)
LOCAL_LLM_URL=http://localhost:8080/v1
LOCAL_LLM_API_KEY=optional_api_key

# SWE-Agent Configuration
SWE_AGENT_PATH=/usr/local/bin/swe-agent     # Path to SWE-agent executable
SWE_AGENT_TIMEOUT=600000                    # Timeout in milliseconds (10 minutes)
MAX_CONCURRENT_JOBS=3                       # Maximum concurrent pipeline executions

# System Configuration
LOG_LEVEL=info                              # Logging level (debug, info, warn, error)
DEPLOYMENT_PLATFORM=docker                  # Deployment platform (docker, modal, local)
```

### SWE-Agent Configuration Format

Our generated configurations follow SWE-agent's standard format with proper environment variable references:

```yaml
# Example generated configuration
agent:
  model:
    name: claude-3-5-sonnet-20241022
    api_base: https://api.anthropic.com
    api_key: $ANTHROPIC_API_KEY              # Environment variable reference
    temperature: 0.0
    max_tokens: 200000
  parser:
    name: ToolCallingParser
    function_calling: true
  tools:
    - name: str_replace_editor
    - name: bash
    - name: file_viewer
env:
  repo:
    github_url: $GITHUB_REPOSITORY_URL       # Automatically populated
    base_commit: HEAD
  workspace:
    mount_path: /tmp/swe-agent-workspace
```

### GitHub Context Mapping

The system automatically maps GitHub environment variables to SWE-Agent configuration:

| GitHub Variable | SWE-Agent Config Path | Description |
|----------------|----------------------|-------------|
| `GITHUB_REPOSITORY` | `env.repo.github_url` | Repository URL |
| `GITHUB_SHA` | `env.repo.base_commit` | Commit SHA |
| `GITHUB_REF` | `env.repo.branch` | Branch reference |
| `GITHUB_ACTOR` | `metadata.actor` | User who triggered action |

### Deployment Platforms

#### Docker Configuration
```bash
DEPLOYMENT_PLATFORM=docker
DOCKER_IMAGE=sweagent/swe-agent:latest
DOCKER_MEMORY_LIMIT=4GB
DOCKER_CPU_LIMIT=2
```

#### Modal Configuration
```bash
DEPLOYMENT_PLATFORM=modal
MODAL_ENVIRONMENT=production
MODAL_CPU_COUNT=2
MODAL_MEMORY_MB=4096
MODAL_TIMEOUT=3600
```

## 🔍 Error Recovery

### Error Classification

The system automatically classifies errors into categories:

1. **Configuration Errors**: Token issues, permission problems
2. **Resource Limits**: Memory, CPU, or disk exhaustion
3. **API Limits**: Rate limiting, quota exceeded
4. **Timeout Errors**: Long-running operations
5. **Network Errors**: Connectivity issues

### Recovery Strategies

For each error type, the system applies appropriate recovery strategies:

- **Configuration Errors**: Fallback configurations, permission checks
- **Resource Limits**: Process optimization, resource cleanup
- **API Limits**: Rate limiting, request queuing
- **Timeout Errors**: Increased timeouts, simplified analysis
- **Network Errors**: Exponential backoff, alternative endpoints

### User Guidance

When errors occur, users receive detailed feedback including:

- Clear error description and classification
- Possible causes and troubleshooting steps
- Actionable recommendations
- Debug information for support escalation

## 📈 Performance Optimization

### Resource Management
- Automatic workspace cleanup
- Process lifecycle management
- Memory and CPU monitoring
- Disk usage optimization

### Concurrency Control
- Pipeline-level job queuing
- Resource-aware scheduling
- Graceful degradation under load

### Caching Strategies
- Configuration caching
- Context extraction optimization
- Result memoization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Add tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Ensure backwards compatibility

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs or request features on GitHub Issues
- **Discussions**: Community discussions on GitHub Discussions
- **Security**: Report security issues privately to the maintainers

## 🗺️ Roadmap

- [ ] Advanced code analysis with dependency tracking
- [ ] Multi-repository coordination
- [ ] Custom workflow templates
- [ ] Advanced analytics and reporting
- [ ] Integration with more AI model providers
- [ ] Enterprise SSO integration