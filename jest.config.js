module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'action/**/*.js',
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/test/**',
    '!**/coverage/**'
  ],
  testMatch: [
    '<rootDir>/test/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 10000  // 10 seconds for unit tests
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/test/helpers/integration-setup.js'],
      testTimeout: 30000  // 30 seconds for integration tests
    },
    {
      displayName: 'real',
      testMatch: ['<rootDir>/test/real/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 60000  // 60 seconds for real API tests
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/test/helpers/e2e-setup.js'],
      testTimeout: 120000  // 2 minutes for e2e tests
    }
  ],
  verbose: true
};