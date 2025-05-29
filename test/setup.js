const { jest } = require('@jest/globals');

// Global test setup
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Mock environment variables for tests
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.SWE_AGENT_PATH = '/usr/local/bin/swe-agent';
process.env.SWE_AGENT_TIMEOUT = '300000';
process.env.MAX_CONCURRENT_JOBS = '2';

// Global timeout for all tests
jest.setTimeout(30000);

// Suppress console output during tests unless explicitly needed
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Restore console for specific tests that need it
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Helper to restore console after each test
afterEach(() => {
  if (process.env.VERBOSE_TESTS !== 'true') {
    Object.keys(global.console).forEach(key => {
      if (typeof global.console[key] === 'function' && global.console[key].mockClear) {
        global.console[key].mockClear();
      }
    });
  }
});

// Clean up after all tests
afterAll(() => {
  global.console = originalConsole;
});