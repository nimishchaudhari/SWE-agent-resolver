# SWE-Agent Resolver Test Suite

This directory contains the comprehensive test suite for the SWE-Agent Resolver GitHub Action.

## 📁 Test Structure

```
test/
├── unit/                     # Unit tests for individual modules
│   ├── provider-manager.test.js
│   └── swe-agent-config-generator.test.js
├── integration/              # Integration tests for API interactions
│   └── webhook-handler.test.js
├── e2e/                     # End-to-end tests (future)
├── fixtures/                # Mock data and API responses
│   └── github-api-responses.js
├── helpers/                 # Test utilities and setup
│   ├── test-utils.js
│   ├── integration-setup.js
│   └── e2e-setup.js
├── performance/             # Performance benchmarks (future)
└── run-local-tests.js       # Local test runner
```

## 🚀 Quick Start

### 1. Initial Setup

```bash
# Install dependencies
npm install

# Create local test environment
./test-local.sh
```

This will create `.env.test.local` from the template. Edit it to add your API keys:

```bash
# Required
GITHUB_TOKEN=your-github-token

# Add at least one AI provider key
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
# or
DEEPSEEK_API_KEY=sk-...
```

### 2. Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # With coverage report

# Run local action test
./test-local.sh local issue_comment
```

## 🧪 Test Types

### Unit Tests
- Test individual modules in isolation
- Mock all external dependencies
- Fast execution (< 5 seconds)
- Examples: provider detection, config generation

### Integration Tests
- Test interactions with external APIs
- Use nock for API mocking
- Medium execution time (5-30 seconds)
- Examples: webhook handling, GitHub API calls

### E2E Tests (Future)
- Test complete action workflow
- May use Docker containers
- Slower execution (30+ seconds)
- Examples: full issue analysis, PR review

## 📝 Writing Tests

### Unit Test Example

```javascript
describe('ProviderManager', () => {
  test('should detect OpenAI provider', () => {
    const manager = new ProviderManager();
    const result = manager.detectProvider('gpt-4o');
    expect(result.provider).toBe('openai');
  });
});
```

### Integration Test Example

```javascript
describe('Webhook Handler', () => {
  test('should process issue comment', async () => {
    // Mock GitHub API
    nock('https://api.github.com')
      .post('/repos/owner/repo/issues/1/comments')
      .reply(201, { id: 123 });
    
    // Run action
    await action.run();
    
    // Verify API was called
    expect(nock.isDone()).toBe(true);
  });
});
```

## 🛠️ Test Utilities

### TestUtils

Provides helper functions for:
- Creating mock contexts
- Generating test events
- Setting up environments
- Creating mock API clients

```javascript
const TestUtils = require('./helpers/test-utils');

// Create mock GitHub event
const event = TestUtils.createMockEvent('issue_comment', {
  comment: { body: '@swe-agent help' }
});

// Mock environment
const restore = TestUtils.mockEnvironment({
  OPENAI_API_KEY: 'test-key'
});
```

## 🔧 Local Testing

The local test runner simulates GitHub Actions environment:

```bash
# Test issue comment scenario
node test/run-local-tests.js issue_comment

# Test PR review scenario
node test/run-local-tests.js pr_review

# Test new issue scenario
node test/run-local-tests.js issue_opened
```

## 🐛 Debugging

### Enable Debug Mode

```bash
# In .env.test.local
INPUT_DEBUG_MODE=true
```

### Run Single Test

```bash
# Run specific test file
npm test -- provider-manager.test.js

# Run specific test
npm test -- -t "should detect OpenAI provider"
```

### View Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

## 📊 Performance Testing

Future addition for benchmarking:
- Provider response times
- Configuration generation speed
- API call optimization

## 🔄 CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Release creation

See `.github/workflows/test.yml` for CI configuration.

## 🤝 Contributing

1. Write tests for new features
2. Ensure all tests pass locally
3. Maintain test coverage above 80%
4. Update fixtures for API changes
5. Document complex test scenarios

## 🆘 Troubleshooting

### Common Issues

1. **Missing API Keys**
   - Ensure `.env.test.local` has required keys
   - Check key format matches provider requirements

2. **Test Timeouts**
   - Increase Jest timeout in `jest.config.js`
   - Check for hanging API mocks

3. **Nock Errors**
   - Ensure all mocked endpoints match exactly
   - Check request headers and body

### Getting Help

- Check test output for detailed errors
- Enable debug mode for more information
- Review mock fixtures for accuracy