const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// E2E test configuration
const E2E_CONFIG = {
  testTimeout: 60000,
  dockerTimeout: 120000,
  testRepoPath: '/tmp/test-repo'
};

beforeAll(async () => {
  // Create test repository
  await fs.mkdir(E2E_CONFIG.testRepoPath, { recursive: true });

  // Initialize git repo for testing
  execSync('git init', { cwd: E2E_CONFIG.testRepoPath });
  execSync('git config user.email "test@example.com"', { cwd: E2E_CONFIG.testRepoPath });
  execSync('git config user.name "Test User"', { cwd: E2E_CONFIG.testRepoPath });

  // Create initial commit
  await fs.writeFile(
    path.join(E2E_CONFIG.testRepoPath, 'README.md'),
    '# Test Repository\n'
  );
  execSync('git add -A', { cwd: E2E_CONFIG.testRepoPath });
  execSync('git commit -m "Initial commit"', { cwd: E2E_CONFIG.testRepoPath });
});

afterAll(async () => {
  // Cleanup test repository
  try {
    await fs.rm(E2E_CONFIG.testRepoPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to cleanup test repo:', error);
  }
});

// Set longer timeout for E2E tests
jest.setTimeout(E2E_CONFIG.testTimeout);

// Export config for use in tests
global.E2E_CONFIG = E2E_CONFIG;
