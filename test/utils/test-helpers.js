const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Collection of utility functions for testing
 */
class TestHelpers {
  /**
   * Create a temporary directory for test files
   */
  static async createTempDir(prefix = 'test-') {
    const tempDir = path.join(__dirname, '..', 'temp', `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  static async cleanupTempDir(tempDir) {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Create a mock file with specified content
   */
  static async createMockFile(filePath, content = '') {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Wait for a specified amount of time
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for a condition to become true
   */
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await this.sleep(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Generate a random string
   */
  static randomString(length = 10, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  static randomInt(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate a mock GitHub user object
   */
  static createMockUser(overrides = {}) {
    return {
      id: this.randomInt(1000000, 9999999),
      login: this.randomString(8),
      avatar_url: `https://avatars.githubusercontent.com/${this.randomString(8)}`,
      type: 'User',
      site_admin: false,
      ...overrides
    };
  }

  /**
   * Generate a mock GitHub repository object
   */
  static createMockRepository(owner = null, overrides = {}) {
    const repoOwner = owner || this.createMockUser();
    const repoName = this.randomString(12);
    
    return {
      id: this.randomInt(100000000, 999999999),
      name: repoName,
      full_name: `${repoOwner.login}/${repoName}`,
      owner: repoOwner,
      private: false,
      html_url: `https://github.com/${repoOwner.login}/${repoName}`,
      description: `Test repository ${repoName}`,
      fork: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pushed_at: new Date().toISOString(),
      clone_url: `https://github.com/${repoOwner.login}/${repoName}.git`,
      ssh_url: `git@github.com:${repoOwner.login}/${repoName}.git`,
      size: this.randomInt(100, 50000),
      stargazers_count: this.randomInt(0, 1000),
      watchers_count: this.randomInt(0, 100),
      forks_count: this.randomInt(0, 50),
      language: ['JavaScript', 'Python', 'Java', 'TypeScript'][this.randomInt(0, 3)],
      has_issues: true,
      has_projects: true,
      has_wiki: false,
      has_pages: false,
      archived: false,
      disabled: false,
      open_issues_count: this.randomInt(0, 20),
      topics: [`topic-${this.randomString(5)}`, `topic-${this.randomString(5)}`],
      visibility: 'public',
      default_branch: 'main',
      ...overrides
    };
  }

  /**
   * Generate a mock GitHub issue object
   */
  static createMockIssue(repository = null, user = null, overrides = {}) {
    const issueRepo = repository || this.createMockRepository();
    const issueUser = user || this.createMockUser();
    const issueNumber = this.randomInt(1, 1000);
    
    return {
      id: this.randomInt(1000000000, 9999999999),
      number: issueNumber,
      title: `Test Issue ${issueNumber}`,
      body: `This is a test issue created for testing purposes.\n\n## Problem\nDescribe the problem here.\n\n## Expected Behavior\nWhat should happen.\n\n## Actual Behavior\nWhat actually happens.`,
      user: issueUser,
      labels: [
        { id: this.randomInt(1000000, 9999999), name: 'bug', color: 'red', default: true },
        { id: this.randomInt(1000000, 9999999), name: 'help wanted', color: 'green', default: false }
      ],
      state: 'open',
      locked: false,
      assignee: null,
      assignees: [],
      milestone: null,
      comments: this.randomInt(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
      author_association: 'CONTRIBUTOR',
      active_lock_reason: null,
      html_url: `https://github.com/${issueRepo.full_name}/issues/${issueNumber}`,
      repository_url: `https://api.github.com/repos/${issueRepo.full_name}`,
      ...overrides
    };
  }

  /**
   * Generate a mock GitHub pull request object
   */
  static createMockPullRequest(repository = null, user = null, overrides = {}) {
    const prRepo = repository || this.createMockRepository();
    const prUser = user || this.createMockUser();
    const prNumber = this.randomInt(1, 1000);
    
    return {
      id: this.randomInt(1000000000, 9999999999),
      number: prNumber,
      title: `Test PR ${prNumber}`,
      body: `This is a test pull request.\n\n## Changes\n- Added new feature\n- Fixed bug\n- Updated documentation\n\n## Testing\n- [ ] Unit tests pass\n- [ ] Integration tests pass\n- [ ] Manual testing completed`,
      user: prUser,
      state: 'open',
      locked: false,
      assignee: null,
      assignees: [],
      requested_reviewers: [],
      requested_teams: [],
      labels: [],
      milestone: null,
      draft: false,
      commits_url: `https://api.github.com/repos/${prRepo.full_name}/pulls/${prNumber}/commits`,
      review_comments_url: `https://api.github.com/repos/${prRepo.full_name}/pulls/${prNumber}/comments`,
      review_comment_url: `https://api.github.com/repos/${prRepo.full_name}/pulls/comments{/number}`,
      comments_url: `https://api.github.com/repos/${prRepo.full_name}/issues/${prNumber}/comments`,
      statuses_url: `https://api.github.com/repos/${prRepo.full_name}/statuses/{sha}`,
      head: {
        label: `${prUser.login}:feature-branch`,
        ref: 'feature-branch',
        sha: this.randomString(40, 'abcdef0123456789'),
        user: prUser,
        repo: prRepo
      },
      base: {
        label: `${prRepo.owner.login}:main`,
        ref: 'main',
        sha: this.randomString(40, 'abcdef0123456789'),
        user: prRepo.owner,
        repo: prRepo
      },
      merged: false,
      mergeable: true,
      rebaseable: true,
      mergeable_state: 'clean',
      merged_by: null,
      comments: this.randomInt(0, 5),
      review_comments: this.randomInt(0, 10),
      maintainer_can_modify: false,
      commits: this.randomInt(1, 10),
      additions: this.randomInt(10, 500),
      deletions: this.randomInt(5, 200),
      changed_files: this.randomInt(1, 20),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
      merged_at: null,
      html_url: `https://github.com/${prRepo.full_name}/pull/${prNumber}`,
      ...overrides
    };
  }

  /**
   * Generate a mock commit object
   */
  static createMockCommit(author = null, overrides = {}) {
    const commitAuthor = author || this.createMockUser();
    const commitSha = this.randomString(40, 'abcdef0123456789');
    
    return {
      id: commitSha,
      tree_id: this.randomString(40, 'abcdef0123456789'),
      distinct: true,
      message: `Fix: ${this.randomString(20)} issue\n\nThis commit addresses the issue by implementing proper\nerror handling and validation.`,
      timestamp: new Date().toISOString(),
      url: `https://github.com/test-user/test-repo/commit/${commitSha}`,
      author: {
        name: commitAuthor.login,
        email: `${commitAuthor.login}@example.com`,
        username: commitAuthor.login
      },
      committer: {
        name: commitAuthor.login,
        email: `${commitAuthor.login}@example.com`,
        username: commitAuthor.login
      },
      added: [`src/new-file-${this.randomString(5)}.js`],
      removed: [`src/old-file-${this.randomString(5)}.js`],
      modified: [
        `src/main-${this.randomString(5)}.js`,
        `test/test-${this.randomString(5)}.js`,
        'README.md'
      ],
      ...overrides
    };
  }

  /**
   * Mock environment variables for testing
   */
  static mockEnvironment(env = {}) {
    const originalEnv = { ...process.env };
    
    // Set test environment variables
    Object.assign(process.env, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
      GITHUB_TOKEN: 'test-github-token',
      SWE_AGENT_PATH: '/usr/local/bin/swe-agent',
      SWE_AGENT_TIMEOUT: '30000',
      MAX_CONCURRENT_JOBS: '2',
      ...env
    });
    
    // Return cleanup function
    return () => {
      process.env = originalEnv;
    };
  }

  /**
   * Create a test server instance
   */
  static createTestServer(port = 0) {
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    app.use(express.raw({ type: 'application/json' }));
    
    return new Promise((resolve) => {
      const server = app.listen(port, () => {
        const actualPort = server.address().port;
        resolve({
          app,
          server,
          port: actualPort,
          url: `http://localhost:${actualPort}`,
          close: () => new Promise(closeResolve => server.close(closeResolve))
        });
      });
    });
  }

  /**
   * Mock console methods and capture output
   */
  static mockConsole() {
    const originalConsole = { ...console };
    const logs = { log: [], info: [], warn: [], error: [], debug: [] };
    
    ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
      console[method] = (...args) => {
        logs[method].push(args);
      };
    });
    
    return {
      logs,
      restore: () => {
        Object.assign(console, originalConsole);
      },
      clear: () => {
        Object.keys(logs).forEach(key => logs[key] = []);
      }
    };
  }

  /**
   * Assert that a condition becomes true within a timeout
   */
  static async assertEventually(condition, timeout = 5000, message = 'Condition not met') {
    try {
      await this.waitFor(condition, timeout);
    } catch (error) {
      throw new Error(message);
    }
  }

  /**
   * Create a mock response object for testing HTTP handlers
   */
  static createMockResponse() {
    const response = {
      statusCode: 200,
      headers: {},
      body: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        this.headers['Content-Type'] = 'application/json';
        return this;
      },
      send: function(data) {
        this.body = data;
        return this;
      },
      set: function(header, value) {
        if (typeof header === 'object') {
          Object.assign(this.headers, header);
        } else {
          this.headers[header] = value;
        }
        return this;
      },
      end: function() {
        return this;
      }
    };
    
    return response;
  }

  /**
   * Create a mock request object for testing HTTP handlers
   */
  static createMockRequest(options = {}) {
    return {
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'issues',
        'x-github-delivery': crypto.randomUUID(),
        'x-hub-signature-256': 'sha256=test-signature',
        ...options.headers
      },
      body: options.body || '{"test": "payload"}',
      query: options.query || {},
      params: options.params || {},
      ...options
    };
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    return { result, duration };
  }

  /**
   * Run a function multiple times and collect statistics
   */
  static async runMultipleTimes(fn, iterations = 10) {
    const results = [];
    const durations = [];
    
    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measureTime(fn);
      results.push(result);
      durations.push(duration);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    return {
      results,
      durations,
      statistics: {
        average: avgDuration,
        min: minDuration,
        max: maxDuration,
        total: durations.reduce((a, b) => a + b, 0),
        iterations
      }
    };
  }

  /**
   * Create a delay function that can be controlled
   */
  static createControllableDelay() {
    let resolveCurrentDelay = null;
    let delayPromise = null;
    
    return {
      wait: () => {
        if (!delayPromise) {
          delayPromise = new Promise(resolve => {
            resolveCurrentDelay = resolve;
          });
        }
        return delayPromise;
      },
      resolve: () => {
        if (resolveCurrentDelay) {
          resolveCurrentDelay();
          resolveCurrentDelay = null;
          delayPromise = null;
        }
      },
      isWaiting: () => delayPromise !== null
    };
  }

  /**
   * Validate JSON schema
   */
  static validateSchema(data, schema) {
    // Simple schema validation - can be extended with Joi or other libraries
    const errors = [];
    
    const validateProperty = (value, schemaProperty, path = '') => {
      if (schemaProperty.required && (value === undefined || value === null)) {
        errors.push(`${path} is required`);
        return;
      }
      
      if (value === undefined || value === null) return;
      
      if (schemaProperty.type && typeof value !== schemaProperty.type) {
        errors.push(`${path} should be of type ${schemaProperty.type}, got ${typeof value}`);
      }
      
      if (schemaProperty.enum && !schemaProperty.enum.includes(value)) {
        errors.push(`${path} should be one of [${schemaProperty.enum.join(', ')}], got ${value}`);
      }
      
      if (schemaProperty.properties && typeof value === 'object') {
        Object.keys(schemaProperty.properties).forEach(key => {
          validateProperty(value[key], schemaProperty.properties[key], `${path}.${key}`);
        });
      }
    };
    
    validateProperty(data, schema);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate test data for load testing
   */
  static generateTestData(type, count = 100) {
    const data = [];
    
    for (let i = 0; i < count; i++) {
      switch (type) {
        case 'users':
          data.push(this.createMockUser({ id: i + 1 }));
          break;
        case 'repositories':
          data.push(this.createMockRepository(null, { id: i + 1 }));
          break;
        case 'issues':
          data.push(this.createMockIssue(null, null, { number: i + 1 }));
          break;
        case 'pull_requests':
          data.push(this.createMockPullRequest(null, null, { number: i + 1 }));
          break;
        case 'commits':
          data.push(this.createMockCommit());
          break;
        default:
          throw new Error(`Unknown test data type: ${type}`);
      }
    }
    
    return data;
  }
}

module.exports = TestHelpers;