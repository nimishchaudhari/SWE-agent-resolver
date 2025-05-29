const nock = require('nock');

beforeAll(() => {
  // Disable real HTTP requests during tests
  nock.disableNetConnect();
  
  // Allow localhost for test servers
  nock.enableNetConnect('localhost');
  nock.enableNetConnect('127.0.0.1');
});

afterEach(() => {
  // Clean up any pending mocks
  nock.cleanAll();
});

afterAll(() => {
  // Re-enable HTTP requests
  nock.enableNetConnect();
});

// Global test timeout for integration tests
jest.setTimeout(30000);