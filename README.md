# SWE-Agent Issue Resolver

[![Docker Build](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/build-docker-image.yml/badge.svg)](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/build-docker-image.yml)
[![All-in-One Workflow](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/swe-agent-aio.yml/badge.svg)](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/swe-agent-aio.yml)

A sophisticated GitHub Action that leverages AI to automatically analyze and resolve software engineering issues. Built with a modular architecture for reliability, extensibility, and maintainability.

## 🚀 Quick Start

### Automatic Setup (Recommended)

Simply mention the agent in any issue comment, and it will automatically analyze and provide solutions:

```
@swe-agent Please fix this bug
@swe-agent Implement this feature  
@swe-agent Analyze this performance issue
@swe-agent Please comment today's date
```

### Manual Workflow Setup

Add this to your `.github/workflows/swe-agent.yml`:

```yaml
name: SWE-Agent Issue Resolution
on:
  issue_comment:
    types: [created]

jobs:
  resolve-issue:
    runs-on: ubuntu-latest
    if: contains(github.event.comment.body, '@swe-agent')
    steps:
      - uses: nimishchaudhari/swe-agent-resolver@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

## ✨ Features

### Core Capabilities
- **🤖 Smart AI Integration**: Supports multiple AI providers (OpenAI, Anthropic, Google Gemini, OpenRouter)
- **🔍 Automatic Context Detection**: Intelligently detects issue context, PR context, and review context
- **⚡ Instant Activation**: Just mention `@swe-agent` in any issue or PR comment
- **🎯 Intent Recognition**: Automatically determines whether to generate patches, provide analysis, or give advice
- **📊 Visual Content**: Generates charts, diagrams, and visual representations when helpful

### Multi-Context Support
- **📝 Issue Comments**: Analyzes issues and creates pull requests with fixes
- **🔄 PR Comments**: Updates existing pull requests with improvements
- **👁️ PR Reviews**: Responds to code review feedback with targeted fixes
- **🔀 PR Synchronization**: Handles pull request updates and conflicts

### Technical Excellence
- **🐳 Docker-Based**: Consistent execution environment with branch-specific image selection
- **⏱️ Smart Timeouts**: Configurable execution limits with intelligent wait logic
- **🔧 Modular Architecture**: Clean separation of concerns with reusable components
- **📈 Progress Tracking**: Real-time progress updates and detailed logging
- **🧪 Comprehensive Testing**: Extensive validation scripts and automated testing

## 🚀 Quick Start

### Advanced Configuration

```yaml
name: Advanced SWE-Agent Setup
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  pull_request_review:
    types: [submitted]
  pull_request:
    types: [opened, synchronize]

jobs:
  swe-agent:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    if: contains(github.event.comment.body, '@swe-agent') || contains(github.event.review.body, '@swe-agent') || contains(github.event.pull_request.body, '@swe-agent')
    
    steps:
      - uses: nimishchaudhari/swe-agent-resolver@main
        with:
          # Required Parameters
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          
          # Optional AI Provider Keys
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          openrouter_api_key: ${{ secrets.OPENROUTER_API_KEY }}
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          
          # Configuration
          model_name: ${{ vars.SWE_AGENT_MODEL || 'gpt-4o' }}
          timeout_minutes: '50'
          response_mode: 'auto'  # auto, patch, analysis, opinion
          enable_visual_content: 'true'
          
          # Multi-context settings
          context_mode: 'auto'
          pr_strategy: 'continue'
          enable_review_context: 'true'
```

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub API token with repo permissions | `${{ secrets.GITHUB_TOKEN }}` |
| `OPENAI_API_KEY` | OpenAI API key for AI processing | `${{ secrets.OPENAI_API_KEY }}` |

### Optional Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `timeout_minutes` | `20` | Maximum execution time in minutes |
| `max_iterations` | `5` | Maximum AI analysis iterations |
| `ai_model` | `"gpt-4"` | AI model to use for analysis |
| `analysis_depth` | `"standard"` | Analysis depth: `quick`, `standard`, `comprehensive` |
| `custom_instructions` | `""` | Additional instructions for the AI |

### Advanced Configuration

#### Multiple AI Providers
```yaml
- uses: your-org/swe-agent-resolver@main
  with:
    # Primary provider
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
    
    # Fallback providers
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    google_api_key: ${{ secrets.GOOGLE_API_KEY }}
```

#### Custom Docker Image
```yaml
- uses: your-org/swe-agent-resolver@main
  with:
    docker_image: "your-org/swe-agent-resolver:custom-tag"
```

## 🏗️ Architecture

### Modular Design

```
src/
├── utils.sh           # Core utilities and logging
├── config.sh          # Configuration management
├── github.sh          # GitHub API integration
├── intent.sh          # Issue analysis and intent detection
├── progress.sh        # Progress tracking and reporting
├── ai_api.sh          # AI provider abstraction
├── response_formatter.sh # Output formatting
└── swe_agent.sh       # Main orchestration logic
```

### Workflow Components

```
.github/workflows/
├── swe-agent-aio.yml       # Main issue resolution workflow
└── build-docker-image.yml  # Container build automation
```

### Testing Infrastructure

```
test/
├── validate-full-setup.sh    # Comprehensive validation
├── validate-docker-setup.sh  # Docker-specific tests
├── quick-sanity-check.sh     # Fast validation
└── final-status-report.sh    # Status reporting
```

## 🔧 Development

### Local Testing

```bash
# Quick validation
./test/quick-sanity-check.sh

# Comprehensive testing
./test/validate-full-setup.sh

# Docker validation
./test/validate-docker-setup.sh
```

### Building Locally

```bash
# Build Docker image
docker build -t swe-agent-resolver:local .

# Test locally
docker run --rm \
  -e GITHUB_TOKEN="your-token" \
  -e OPENAI_API_KEY="your-key" \
  swe-agent-resolver:local
```

### Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Run tests**: `./test/validate-full-setup.sh`
4. **Commit changes**: `git commit -am 'Add your feature'`
5. **Push to branch**: `git push origin feature/your-feature`
6. **Create Pull Request**

## 🐛 Troubleshooting

### Common Issues

#### "No such file or directory" Error
**Cause**: Script execution before repository checkout  
**Solution**: Ensure `actions/checkout` runs before SWE-Agent action

```yaml
steps:
  - name: Checkout Repository
    uses: actions/checkout@v4  # Must be first!
    
  - name: Run SWE-Agent
    uses: your-org/swe-agent-resolver@main
```

#### Docker Image Not Found
**Cause**: Branch-specific image doesn't exist  
**Solution**: The action automatically falls back to `:latest`. Check Docker build logs.

#### Timeout Issues
**Cause**: Complex issues exceeding time limits  
**Solution**: Increase `timeout_minutes` parameter

```yaml
- uses: your-org/swe-agent-resolver@main
  with:
    timeout_minutes: 45  # Increased from default 20
```

#### AI API Rate Limits
**Cause**: Exceeding API quotas  
**Solution**: Configure multiple providers or adjust iteration limits

```yaml
- uses: your-org/swe-agent-resolver@main
  with:
    max_iterations: 3  # Reduced from default 5
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}  # Fallback
```

### Debug Mode

Enable detailed logging:

```yaml
- uses: your-org/swe-agent-resolver@main
  with:
    debug: true
  env:
    ACTIONS_STEP_DEBUG: true
```

### Workflow Validation

Check workflow status:

```bash
# Validate workflow files
./test/validate-full-setup.sh

# Check Docker setup
./test/validate-docker-setup.sh

# Generate status report
./test/final-status-report.sh
```

## 📊 Monitoring

### Success Metrics
- Issue resolution rate
- Average processing time
- AI iteration efficiency
- Error recovery effectiveness

### Logs and Outputs
- Detailed progress logs in action output
- AI analysis summaries
- Code change proposals
- Error diagnostics and recovery steps

## 🔄 CI/CD Integration

### Automated Docker Builds
- Triggers on changes to `src/**` and `scripts/**`
- Branch-specific image tagging
- Automatic fallback to latest stable image

### Workflow Testing
- Pre-commit validation
- Integration testing
- Performance benchmarking

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Contributing**: See development section above

## 🏷️ Version History

- **v2.0.0**: Modular architecture rewrite with enhanced reliability
- **v1.5.0**: Added multi-AI provider support and branch-aware Docker images
- **v1.0.0**: Initial stable release with core functionality

---

Built with ❤️ for the developer community. Making software engineering more efficient, one issue at a time.