# Local Development Guide

This guide covers setting up a complete local development environment for SWE-Agent Resolver with real testing capabilities.

## Quick Start

1. **Run the setup script:**
   ```bash
   ./setup-dev-environment.sh
   ```

2. **Configure API keys in `.env`:**
   ```bash
   nano .env
   # Add your provider API keys
   ```

3. **Start testing:**
   ```bash
   ./dev-test-quick.sh  # Quick tests (no API calls)
   ./dev-test-full.sh   # Full tests (requires API keys)
   ```

## Development Environment

### Prerequisites

- **Node.js v18+** - JavaScript runtime
- **Python 3.8+** - For SWE-agent CLI
- **Git** - Version control
- **Docker** (optional) - For containerized testing

### Project Structure

```
swe-agent-resolver/
├── src/                    # Core source code
│   ├── index.js           # Main entry point
│   ├── swe-agent-cli.js   # Real SWE-agent integration
│   ├── workspace-manager.js # Git operations and patches
│   └── utils/             # Utility modules
├── action/                # GitHub Action components
│   ├── entrypoint.js      # Action orchestrator
│   ├── provider-manager.js # AI provider management
│   ├── comment-handler.js  # GitHub comment management
│   └── error-handler.js   # Error handling and fallbacks
├── test/                  # Test suites
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   ├── real/             # Real provider tests
│   └── e2e/              # End-to-end tests
├── docs/                 # Documentation
└── example-workflows/    # GitHub workflow examples
```

## Configuration

### Environment Variables

Create a `.env` file with your configuration:

```bash
# GitHub Configuration
GITHUB_TOKEN=your_github_token

# AI Provider API Keys (set at least one)
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
DEEPSEEK_API_KEY=sk-your_deepseek_key
GROQ_API_KEY=gsk_your_groq_key

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=swe-agent:*
```

### Provider Setup

#### OpenAI
```bash
export OPENAI_API_KEY=sk-your-key-here
```
- Models: `gpt-4o`, `gpt-4`, `gpt-3.5-turbo`
- Cost: $1.50-$15.00 per 1M tokens

#### Anthropic Claude
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```
- Models: `claude-3-5-sonnet-latest`, `claude-3-haiku-20240307`
- Cost: $3.00-$15.00 per 1M tokens

#### DeepSeek (Most Cost-Effective)
```bash
export DEEPSEEK_API_KEY=sk-your-key-here
```
- Models: `deepseek/deepseek-chat`, `deepseek/deepseek-coder`
- Cost: $0.14-$0.28 per 1M tokens

#### Groq (Fastest)
```bash
export GROQ_API_KEY=gsk_your-key-here
```
- Models: `groq/llama2-70b-4096`, `groq/mixtral-8x7b-32768`
- Cost: $0.27 per 1M tokens

## Testing

### Test Categories

1. **Unit Tests** - Fast, isolated component tests
2. **Integration Tests** - Component interaction tests
3. **Real Provider Tests** - Actual API connectivity tests
4. **End-to-End Tests** - Complete workflow tests

### Running Tests

```bash
# Quick tests (no API calls)
npm run test:unit
./dev-test-quick.sh

# Real provider tests (requires API keys)
npm run test:real
export OPENAI_API_KEY=sk-your-key
npm run test:real

# End-to-end tests
npm run test:e2e

# Full test suite
npm test
./dev-test-full.sh

# Local integration tests with real repos
./test-local-real.sh
```

### Test Configuration

Control test execution with environment variables:

```bash
# Skip expensive real API tests
export SKIP_REAL_TESTS=true

# Skip long-running E2E tests
export SKIP_E2E_TESTS=true

# Enable debug logging in tests
export LOG_LEVEL=debug
export DEBUG=swe-agent:*
```

## Local Development Workflows

### 1. Feature Development

```bash
# Start development environment
./dev-server.sh

# In another terminal, run tests
npm run test:watch

# Make changes, tests auto-run
# Commit when ready
git commit -m "feat: add new feature"
```

### 2. Provider Testing

```bash
# Test specific provider
export OPENAI_API_KEY=sk-your-key
npm run test:real -- --provider=openai

# Test fallback mechanisms
export ANTHROPIC_API_KEY=sk-invalid-key
npm run test:real  # Should fallback to other providers
```

### 3. Issue Debugging

```bash
# Enable debug logging
export LOG_LEVEL=debug
export DEBUG=swe-agent:*

# Run specific test
npm run test:unit -- --grep "CommentHandler"

# Run with real GitHub event
./test-local-real.sh
```

## Docker Development

### Build and Test

```bash
# Build development image
docker build -f Dockerfile.dev -t swe-agent-resolver:dev .

# Run development container
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Test Docker build
docker build -t swe-agent-resolver:test .
```

### Development Services

The Docker Compose setup includes:

- **swe-agent-resolver** - Main service with hot reloading
- **webhook-simulator** - GitHub webhook simulation
- **test-repo-server** - Git repository server
- **cost-tracker** - Provider cost monitoring
- **redis** - Caching (optional)

## Debugging

### Logging

```javascript
const logger = require('./src/utils/logger');

logger.info('Information message');
logger.error('Error message', error);
logger.debug('Debug message');
logger.logCost(costEstimate);
logger.logProvider(provider, model, status);
```

### Debugging SWE-Agent CLI

```bash
# Enable SWE-agent debug output
export SWE_AGENT_LOG_LEVEL=DEBUG

# Run with timeout for debugging
export INPUT_WORKSPACE_TIMEOUT=3600  # 1 hour

# Check SWE-agent installation
python -c "import sweagent; print('SWE-Agent available')"
```

### Debugging GitHub Integration

```bash
# Test with real GitHub webhook
curl -X POST http://localhost:3003/trigger/issue \
  -H "Content-Type: application/json"

# Check GitHub token permissions
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user
```

## Performance Testing

### Benchmarking Providers

```bash
# Run performance tests
npm run test:performance

# Compare provider response times
./test-local-real.sh  # Includes performance benchmarks
```

### Memory Monitoring

```bash
# Monitor memory usage during tests
npm run test:memory

# Profile Node.js application
node --inspect src/index.js
# Open chrome://inspect in Chrome
```

## Troubleshooting

### Common Issues

1. **SWE-agent import fails**
   ```bash
   # Install in virtual environment
   source venv/bin/activate
   pip install swe-agent
   ```

2. **API key validation fails**
   ```bash
   # Check key format
   echo $OPENAI_API_KEY | grep -E '^sk-[a-zA-Z0-9]{48,}$'
   ```

3. **Docker build fails**
   ```bash
   # Clean Docker cache
   docker system prune -f
   docker build --no-cache -t swe-agent-resolver .
   ```

4. **Tests timeout**
   ```bash
   # Increase timeout
   export INPUT_WORKSPACE_TIMEOUT=3600
   npm run test:e2e -- --timeout=300000
   ```

### Debug Commands

```bash
# Check all dependencies
./setup-dev-environment.sh

# Validate configuration
npm run config:validate

# Test provider connectivity
npm run test:connectivity

# Check log files
tail -f test-logs/*.log
```

## Contributing

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format code
npm run format

# Run pre-commit checks
git add . && git commit -m "test"  # Triggers pre-commit hook
```

### Testing New Features

1. **Write unit tests first**
2. **Add integration tests**
3. **Test with real providers**
4. **Verify E2E workflows**
5. **Update documentation**

### Release Process

```bash
# Run full test suite
./dev-test-full.sh

# Build Docker image
docker build -t swe-agent-resolver:latest .

# Test Docker image
docker run --rm -e GITHUB_TOKEN=$GITHUB_TOKEN swe-agent-resolver:latest

# Tag release
git tag v1.x.x
git push origin v1.x.x
```

## Advanced Features

### Custom Providers

Add new AI providers by extending `ProviderManager`:

```javascript
// In provider-manager.js
const customProvider = {
  'custom-model': { 
    provider: 'custom', 
    apiKey: 'CUSTOM_API_KEY',
    baseUrl: 'https://api.custom-provider.com/v1'
  }
};
```

### Workspace Customization

Modify workspace behavior in `WorkspaceManager`:

```javascript
// Custom git operations
await workspaceManager.execGit(repoPath, 'config --global user.name "SWE-Agent"');
```

### Error Handling

Add custom error patterns in `ErrorHandler`:

```javascript
// Custom error classification
const customErrors = {
  'custom_error': [/custom error pattern/i]
};
```

## Resources

- **Main Documentation**: [README.md](../README.md)
- **Testing Guide**: [test/README.md](../test/README.md)
- **GitHub Workflows**: [example-workflows/](../example-workflows/)
- **SWE-Agent Docs**: [SWE-Agent GitHub](https://github.com/princeton-nlp/SWE-agent)
- **LiteLLM Docs**: [LiteLLM Documentation](https://docs.litellm.ai/)

## Support

- **Issues**: [GitHub Issues](https://github.com/nimishchaudhari/swe-agent-resolver/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nimishchaudhari/swe-agent-resolver/discussions)
- **Discord**: [Community Discord](https://discord.gg/swe-agent-resolver)

---

**Happy developing! 🚀**