const nock = require('nock');

beforeAll(() => {
  // Disable real HTTP requests during tests
  nock.disableNetConnect();

  // Allow localhost for test servers
  nock.enableNetConnect('localhost');
  nock.enableNetConnect('127.0.0.1');

  // Allow GitHub API for testing
  nock.enableNetConnect('api.github.com');
});

beforeEach(() => {
  // Ensure clean state for each test
  nock.cleanAll();
});

afterEach(() => {
  // Clean up any pending mocks and log unmatched requests
  const pendingMocks = nock.pendingMocks();
  if (pendingMocks.length > 0) {
    console.warn('Pending HTTP mocks:', pendingMocks);
  }
  nock.cleanAll();
});

afterAll(() => {
  // Re-enable HTTP requests
  nock.enableNetConnect();
  nock.restore();
});
