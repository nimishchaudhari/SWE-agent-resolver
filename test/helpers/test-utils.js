const fs = require('fs').promises;
const path = require('path');

class TestUtils {
  static createMockContext(overrides = {}) {
    return {
      repository: 'test-owner/test-repo',
      eventName: 'issue_comment',
      eventPath: '/tmp/event.json',
      workspace: '/tmp/workspace',
      sha: 'abc123',
      ref: 'refs/heads/main',
      actor: 'test-user',
      ...overrides
    };
  }

  static createMockInputs(overrides = {}) {
    return {
      modelName: 'gpt-4o',
      triggerPhrase: '@swe-agent',
      maxCost: 5.00,
      allowedTools: ['str_replace_editor', 'bash', 'file_viewer'],
      deploymentType: 'local',
      customInstructions: '',
      fallbackModels: ['gpt-3.5-turbo'],
      workspaceTimeout: 1800,
      debugMode: false,
      ...overrides
    };
  }

  static createMockEvent(type, data = {}) {
    const events = {
      issue_comment: {
        action: 'created',
        issue: {
          number: 1,
          title: 'Test Issue',
          body: 'Test issue body',
          user: { login: 'test-author' },
          labels: []
        },
        comment: {
          id: 12345,
          body: '@swe-agent analyze this issue',
          user: { login: 'test-user' }
        },
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' }
        },
        ...data
      },
      pull_request: {
        action: 'opened',
        pull_request: {
          number: 2,
          title: 'Test PR',
          body: 'Test PR body',
          user: { login: 'test-author' },
          base: { ref: 'main' },
          head: { ref: 'feature-branch' },
          changed_files: 5
        },
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' }
        },
        ...data
      },
      issues: {
        action: 'opened',
        issue: {
          number: 3,
          title: 'New Test Issue',
          body: 'New test issue body',
          user: { login: 'test-author' },
          labels: [{ name: 'bug' }]
        },
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' }
        },
        ...data
      }
    };

    return events[type] || {};
  }

  static async createTempEventFile(eventData) {
    const tempPath = path.join('/tmp', `event-${Date.now()}.json`);
    await fs.writeFile(tempPath, JSON.stringify(eventData, null, 2));
    return tempPath;
  }

  static mockEnvironment(env = {}) {
    const originalEnv = { ...process.env };

    Object.assign(process.env, {
      GITHUB_TOKEN: 'test-token',
      GITHUB_REPOSITORY: 'test-owner/test-repo',
      GITHUB_EVENT_NAME: 'issue_comment',
      GITHUB_SHA: 'abc123',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_ACTOR: 'test-user',
      INPUT_MODEL_NAME: 'gpt-4o',
      INPUT_TRIGGER_PHRASE: '@swe-agent',
      INPUT_MAX_COST: '5.00',
      ...env
    });

    return () => {
      process.env = originalEnv;
    };
  }

  static createMockOctokit() {
    return {
      issues: {
        createComment: jest.fn().mockResolvedValue({
          data: { id: 123, html_url: 'https://github.com/test/comment' }
        }),
        updateComment: jest.fn().mockResolvedValue({ data: {} }),
        listComments: jest.fn().mockResolvedValue({ data: [] })
      },
      pulls: {
        createReviewComment: jest.fn().mockResolvedValue({
          data: { id: 456, html_url: 'https://github.com/test/pr-comment' }
        })
      },
      repos: {
        getContent: jest.fn().mockResolvedValue({ data: {} })
      }
    };
  }

  static async waitForCondition(conditionFn, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await conditionFn()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Condition timeout');
  }
}

module.exports = TestUtils;
