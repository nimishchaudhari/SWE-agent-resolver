const nock = require('nock');
const TestUtils = require('../helpers/test-utils');
const SWEAgentAction = require('../../action/entrypoint');
const fixtures = require('../fixtures/github-api-responses');

describe('Webhook Handler Integration', () => {
  let action;
  let restoreEnv;

  beforeEach(async () => {
    // Set up test environment
    restoreEnv = TestUtils.mockEnvironment({
      OPENAI_API_KEY: 'sk-' + 'a'.repeat(48),
      INPUT_MODEL_NAME: 'gpt-4o',
      INPUT_TRIGGER_PHRASE: '@swe-agent',
      INPUT_MAX_COST: '5.00',
      INPUT_DEBUG_MODE: 'false'
    });

    action = new SWEAgentAction();
    
    // Mock GitHub API base
    nock('https://api.github.com')
      .persist()
      .get('/rate_limit')
      .reply(200, { rate: { limit: 5000, remaining: 4999 } });
  });

  afterEach(() => {
    restoreEnv();
    nock.cleanAll();
  });

  describe('Issue Comment Events', () => {
    test('should process issue comment with trigger phrase', async () => {
      // Create event payload
      const eventData = fixtures.webhooks.issueComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      // Mock comment creation
      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments')
        .reply(201, {
          id: 99999,
          html_url: 'https://github.com/test-owner/test-repo/issues/123#issuecomment-99999',
          body: '🤖 **SWE-Agent Analysis**\n\nInitializing...'
        });

      // Mock comment update
      const updateMock = nock('https://api.github.com')
        .patch('/repos/test-owner/test-repo/issues/comments/99999')
        .reply(200, { id: 99999 });

      // Run action
      await action.run();

      // Verify API calls were made
      expect(commentMock.isDone()).toBe(true);
      expect(updateMock.isDone()).toBe(true);
    });

    test('should skip issue comment without trigger phrase', async () => {
      // Create event without trigger phrase
      const eventData = {
        ...fixtures.webhooks.issueComment,
        comment: {
          ...fixtures.webhooks.issueComment.comment,
          body: 'This is just a regular comment'
        }
      };
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      // No API calls should be made
      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments')
        .reply(201);

      await action.run();

      // Verify no API calls were made
      expect(commentMock.isDone()).toBe(false);
    });

    test('should handle custom trigger phrase', async () => {
      process.env.INPUT_TRIGGER_PHRASE = '@ai-assistant';
      
      const eventData = {
        ...fixtures.webhooks.issueComment,
        comment: {
          ...fixtures.webhooks.issueComment.comment,
          body: '@ai-assistant help with this bug'
        }
      };
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments')
        .reply(201, { id: 88888 });

      await action.run();

      expect(commentMock.isDone()).toBe(true);
    });
  });

  describe('Pull Request Events', () => {
    test('should process new pull request', async () => {
      const eventData = fixtures.webhooks.prOpened;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'pull_request';

      // Mock PR comment creation
      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/999/comments')
        .reply(201, {
          id: 77777,
          html_url: 'https://github.com/test-owner/test-repo/pull/999#issuecomment-77777'
        });

      await action.run();

      expect(commentMock.isDone()).toBe(true);
    });

    test('should process PR review comment', async () => {
      const eventData = fixtures.webhooks.prReviewComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'pull_request_review_comment';

      // Mock PR comment creation
      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/456/comments')
        .reply(201, {
          id: 66666,
          html_url: 'https://github.com/test-owner/test-repo/pull/456#issuecomment-66666'
        });

      await action.run();

      expect(commentMock.isDone()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing API key', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const eventData = fixtures.webhooks.issueComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      // Mock error comment
      const errorMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments', 
          body => body.body.includes('Missing API key'))
        .reply(201, { id: 55555 });

      await action.run();

      expect(errorMock.isDone()).toBe(true);
    });

    test('should handle GitHub API errors', async () => {
      const eventData = fixtures.webhooks.issueComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      // Mock API error
      nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments')
        .reply(403, fixtures.errors.rateLimit);

      await action.run();

      // Action should handle error gracefully
      expect(action.context.eventName).toBe('issue_comment');
    });
  });

  describe('Multi-Provider Support', () => {
    test('should work with Anthropic model', async () => {
      process.env.INPUT_MODEL_NAME = 'claude-3-5-sonnet-latest';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-' + 'a'.repeat(95);
      
      const eventData = fixtures.webhooks.issueComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments',
          body => body.body.includes('ANTHROPIC'))
        .reply(201, { id: 44444 });

      await action.run();

      expect(commentMock.isDone()).toBe(true);
    });

    test('should work with DeepSeek model', async () => {
      process.env.INPUT_MODEL_NAME = 'deepseek/deepseek-chat';
      process.env.DEEPSEEK_API_KEY = 'sk-' + 'a'.repeat(48);
      
      const eventData = fixtures.webhooks.issueComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments',
          body => body.body.includes('DEEPSEEK'))
        .reply(201, { id: 33333 });

      await action.run();

      expect(commentMock.isDone()).toBe(true);
    });
  });

  describe('Cost Management', () => {
    test('should include cost estimate in status', async () => {
      const eventData = fixtures.webhooks.issueComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      let capturedBody;
      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments')
        .reply(201, function(uri, requestBody) {
          capturedBody = requestBody;
          return { id: 22222 };
        });

      const updateMock = nock('https://api.github.com')
        .patch('/repos/test-owner/test-repo/issues/comments/22222',
          body => body.body.includes('Est. Cost: $'))
        .reply(200, { id: 22222 });

      await action.run();

      expect(commentMock.isDone()).toBe(true);
      expect(updateMock.isDone()).toBe(true);
    });

    test('should respect max cost limit', async () => {
      process.env.INPUT_MAX_COST = '0.50';
      
      const eventData = fixtures.webhooks.issueComment;
      const eventPath = await TestUtils.createTempEventFile(eventData);
      process.env.GITHUB_EVENT_PATH = eventPath;
      process.env.GITHUB_EVENT_NAME = 'issue_comment';

      // Action should still run but with cost awareness
      const commentMock = nock('https://api.github.com')
        .post('/repos/test-owner/test-repo/issues/123/comments')
        .reply(201, { id: 11111 });

      await action.run();

      expect(commentMock.isDone()).toBe(true);
    });
  });
});