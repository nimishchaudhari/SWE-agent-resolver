const { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');
const supertest = require('supertest');
const express = require('express');
const WebhookSimulator = require('../utils/webhook-simulator');
const SWEAgentMock = require('../utils/swe-agent-mock');

// Import the application components
const { getConfig } = require('../../src/config');
const githubHandler = require('../../src/github/handler');

describe('Webhook to SWE-Agent Integration Tests', () => {
  let app;
  let request;
  let webhookSimulator;
  let sweAgentMock;
  let config;

  beforeAll(async () => {
    // Initialize configuration for testing
    config = await getConfig();
    
    // Setup test Express app
    app = express();
    app.use(express.json());
    app.use(express.raw({ type: 'application/json' }));
    
    // Initialize test utilities
    webhookSimulator = new WebhookSimulator({
      webhookSecret: config.github.webhookSecret,
      defaultUser: 'testuser',
      defaultRepo: 'test-repo'
    });

    sweAgentMock = new SWEAgentMock({
      responseDelay: 500, // Faster for tests
      successRate: 1.0, // Always succeed in basic tests
      workspaceDir: '/tmp/test-swe-agent'
    });

    // Setup webhook endpoint
    app.post('/webhook', async (req, res) => {
      try {
        const result = await githubHandler.handleWebhook(req, sweAgentMock);
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    request = supertest(app);
  });

  beforeEach(() => {
    sweAgentMock.reset();
  });

  afterEach(() => {
    // Clean up any listeners
    webhookSimulator.removeAllListeners();
    sweAgentMock.removeAllListeners();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Issue Workflow Integration', () => {
    test('should handle issue opened webhook and trigger SWE-agent', async () => {
      // Create issue webhook
      const { payload, headers, rawPayload } = webhookSimulator.createIssuesWebhook('opened', {
        title: 'Bug: Application crashes on startup',
        body: 'The application crashes with a null pointer exception when starting up.'
      });

      // Mock SWE-agent response
      sweAgentMock.setPredefinedResponse('swe-agent', ['--fix', '--issue', '1'], {
        status: 'success',
        task: 'fix_issue',
        summary: 'Successfully fixed null pointer exception',
        details: {
          files_modified: ['src/app.js'],
          issue_type: 'null_pointer_exception',
          confidence: 0.95
        }
      });

      // Send webhook
      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(200);

      // Verify response
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('issueNumber', 1);

      // Verify SWE-agent was called
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(1);
      expect(execHistory[0].command).toBe('swe-agent');
      expect(execHistory[0].args).toContain('--fix');
    });

    test('should handle issue with SWE-agent mention in comment', async () => {
      // Create issue comment webhook
      const { payload, headers, rawPayload } = webhookSimulator.createIssueCommentWebhook('created', {
        body: '@swe-agent please analyze this performance issue and suggest optimizations'
      }, {
        title: 'Performance: Slow database queries',
        number: 42
      });

      // Mock SWE-agent response
      sweAgentMock.setPredefinedResponse('swe-agent', ['--analyze', '--issue', '42'], {
        status: 'success',
        task: 'analyze_code',
        summary: 'Performance analysis completed',
        details: {
          issues_found: { performance: 3 },
          suggestions: ['Add database indexes', 'Optimize query structure']
        }
      });

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('issueNumber', 42);

      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(1);
      expect(execHistory[0].args).toContain('--analyze');
    });

    test('should handle invalid webhook signature', async () => {
      const { payload, headers, rawPayload } = webhookSimulator.createInvalidSignatureWebhook('issues');

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('signature');

      // Verify SWE-agent was NOT called
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(0);
    });
  });

  describe('Pull Request Workflow Integration', () => {
    test('should handle PR opened webhook and trigger code review', async () => {
      const { payload, headers, rawPayload } = webhookSimulator.createPullRequestWebhook('opened', {
        title: 'feat: Add new user authentication system',
        head: { ref: 'feature/auth-system' },
        base: { ref: 'main' }
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--review', '--pr', '1'], {
        status: 'success',
        task: 'review_pr',
        summary: 'PR review completed',
        details: {
          overall_score: 85,
          review_comments: 5,
          approval_status: 'approved'
        }
      });

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('prNumber', 1);

      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(1);
      expect(execHistory[0].args).toContain('--review');
    });

    test('should handle PR with changes requested', async () => {
      const { payload, headers, rawPayload } = webhookSimulator.createPullRequestWebhook('synchronize', {
        number: 15,
        title: 'fix: Critical security vulnerability'
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--review', '--pr', '15'], {
        status: 'success',
        task: 'review_pr',
        summary: 'Security review completed',
        details: {
          overall_score: 65,
          review_comments: 8,
          approval_status: 'changes_requested',
          security_issues: 2
        }
      });

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.details.approval_status).toBe('changes_requested');
    });
  });

  describe('Push Workflow Integration', () => {
    test('should handle push webhook and trigger analysis', async () => {
      const commits = [{
        id: 'abc123',
        message: 'refactor: Improve code structure',
        added: ['src/utils/helpers.js'],
        modified: ['src/app.js', 'package.json'],
        removed: ['src/legacy/old-utils.js']
      }];

      const { payload, headers, rawPayload } = webhookSimulator.createPushWebhook(commits);

      sweAgentMock.setPredefinedResponse('swe-agent', ['--analyze', '--commit', 'abc123'], {
        status: 'success',
        task: 'analyze_code',
        summary: 'Push analysis completed',
        details: {
          commits_analyzed: 1,
          quality_score: 88,
          issues_found: { minor: 2 }
        }
      });

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('commitsAnalyzed', 1);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle SWE-agent execution failure gracefully', async () => {
      const { payload, headers, rawPayload } = webhookSimulator.createIssuesWebhook('opened', {
        title: 'Complex issue that might fail'
      });

      // Configure SWE-agent to fail
      sweAgentMock.options.successRate = 0; // Always fail

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(1);
      expect(execHistory[0]).toHaveProperty('error');
    });

    test('should handle malformed webhook payload', async () => {
      const { headers, rawPayload } = webhookSimulator.createMalformedWebhook();

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('malformed');

      // SWE-agent should not be called for malformed payloads
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(0);
    });

    test('should handle SWE-agent timeout', async () => {
      const { payload, headers, rawPayload } = webhookSimulator.createIssuesWebhook('opened');

      // Configure very long delay to simulate timeout
      sweAgentMock.options.responseDelay = 35000; // Longer than Jest timeout

      const response = await request
        .post('/webhook')
        .set(headers)
        .send(rawPayload)
        .expect(408); // Request timeout

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('timeout');
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple simultaneous webhooks', async () => {
      const webhooks = webhookSimulator.createBulkWebhooks(5, 'issues');
      
      // Setup responses for all webhooks
      webhooks.forEach((webhook, index) => {
        sweAgentMock.setPredefinedResponse('swe-agent', ['--fix', '--issue', (index + 1).toString()], {
          status: 'success',
          task: 'fix_issue',
          issue_number: index + 1
        });
      });

      // Send all webhooks simultaneously
      const promises = webhooks.map(webhook => 
        request
          .post('/webhook')
          .set(webhook.headers)
          .send(webhook.rawPayload)
      );

      const responses = await Promise.all(promises);

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('issueNumber', index + 1);
      });

      // Verify all SWE-agent executions occurred
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(5);
    });

    test('should respect concurrency limits', async () => {
      // This test would verify that the system respects MAX_CONCURRENT_JOBS
      // Implementation depends on the actual concurrency handling in the system
      const webhooks = webhookSimulator.createBulkWebhooks(10, 'issues');
      
      const startTime = Date.now();
      
      const promises = webhooks.map(webhook => 
        request
          .post('/webhook')
          .set(webhook.headers)
          .send(webhook.rawPayload)
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // With concurrency limits, this should take longer than if all ran in parallel
      // Exact timing depends on the configured limits and SWE-agent response time
      expect(totalTime).toBeGreaterThan(1000); // At least 1 second for 10 requests
    });
  });

  describe('Webhook Sequence Integration', () => {
    test('should handle complete issue lifecycle', async () => {
      let issueNumber = 1;

      // 1. Issue opened
      const openedWebhook = webhookSimulator.createIssuesWebhook('opened', {
        number: issueNumber,
        title: 'Bug: Memory leak in data processing'
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--fix', '--issue', issueNumber.toString()], {
        status: 'success',
        task: 'fix_issue',
        summary: 'Memory leak fixed',
        details: { files_modified: ['src/processor.js'] }
      });

      let response = await request
        .post('/webhook')
        .set(openedWebhook.headers)
        .send(openedWebhook.rawPayload)
        .expect(200);

      expect(response.body.status).toBe('success');

      // 2. Comment added requesting analysis
      const commentWebhook = webhookSimulator.createIssueCommentWebhook('created', {
        body: '@swe-agent please analyze the fix and generate tests'
      }, {
        number: issueNumber
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--test', '--issue', issueNumber.toString()], {
        status: 'success',
        task: 'generate_tests',
        summary: 'Tests generated for memory leak fix',
        details: { tests_generated: 5 }
      });

      response = await request
        .post('/webhook')
        .set(commentWebhook.headers)
        .send(commentWebhook.rawPayload)
        .expect(200);

      expect(response.body.status).toBe('success');

      // 3. Issue closed
      const closedWebhook = webhookSimulator.createIssuesWebhook('closed', {
        number: issueNumber,
        state: 'closed'
      });

      response = await request
        .post('/webhook')
        .set(closedWebhook.headers)
        .send(closedWebhook.rawPayload)
        .expect(200);

      // Verify complete workflow execution
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(2); // Fix and test generation
      expect(execHistory[0].args).toContain('--fix');
      expect(execHistory[1].args).toContain('--test');
    });
  });
});