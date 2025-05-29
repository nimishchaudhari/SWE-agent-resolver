module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000,
  verbose: true,
  collectCoverage: false,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],
  moduleDirectories: ['node_modules', 'src'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  transform: {},
  extensionsToTreatAsEsm: [],
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};