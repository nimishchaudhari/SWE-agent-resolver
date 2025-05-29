const { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');
const supertest = require('supertest');
const express = require('express');
const WebhookSimulator = require('../utils/webhook-simulator');
const SWEAgentMock = require('../utils/swe-agent-mock');
const { getConfig } = require('../../src/config');

describe('End-to-End Workflow Tests', () => {
  let app;
  let request;
  let webhookSimulator;
  let sweAgentMock;
  let config;

  beforeAll(async () => {
    config = await getConfig();
    
    app = express();
    app.use(express.json());
    app.use(express.raw({ type: 'application/json' }));
    
    webhookSimulator = new WebhookSimulator({
      webhookSecret: config.github.webhookSecret
    });

    sweAgentMock = new SWEAgentMock({
      responseDelay: 200,
      successRate: 0.95,
      enableRealFiles: true
    });

    // Setup complete application endpoints
    app.post('/webhook', require('../../src/github/handler').handleWebhook);
    app.get('/health', (req, res) => res.json({ status: 'healthy' }));
    app.get('/status', (req, res) => res.json({ 
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      executions: sweAgentMock.getExecutionStats()
    }));

    request = supertest(app);
  });

  beforeEach(() => {
    sweAgentMock.reset();
  });

  describe('Complete Bug Fix Workflow', () => {
    test('should execute complete bug fix from issue to resolution', async () => {
      const workflowId = `workflow_${Date.now()}`;
      const issueNumber = 123;

      // Step 1: Issue reported
      const issueWebhook = webhookSimulator.createIssuesWebhook('opened', {
        number: issueNumber,
        title: 'Critical Bug: Authentication bypass vulnerability',
        body: `
# Bug Report

## Description
Users can bypass authentication by manipulating the session token.

## Steps to Reproduce
1. Login with valid credentials
2. Modify session token format
3. Access protected routes without proper authentication

## Expected Behavior
Should reject invalid session tokens

## Actual Behavior
Allows access with malformed tokens

## Priority
Critical - Security vulnerability
        `,
        labels: [
          { name: 'bug', color: 'red' },
          { name: 'security', color: 'orange' },
          { name: 'critical', color: 'red' }
        ]
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--fix', '--issue', issueNumber.toString()], {
        status: 'success',
        task: 'fix_issue',
        summary: 'Security vulnerability fixed - implemented proper token validation',
        details: {
          issue_type: 'security_vulnerability',
          confidence: 0.92,
          files_modified: [
            'src/auth/token-validator.js',
            'src/middleware/auth.js',
            'src/utils/security.js'
          ],
          changes: {
            lines_added: 45,
            lines_removed: 12,
            files_changed: 3
          },
          security_improvements: [
            'Added token format validation',
            'Implemented signature verification',
            'Added rate limiting for invalid tokens'
          ],
          tests_added: 8,
          tests_updated: 3
        },
        execution_time: 5000,
        artifacts: {
          patch_file: `security-fix-${issueNumber}.patch`,
          test_results: `security-tests-${issueNumber}.xml`,
          security_report: `security-analysis-${issueNumber}.pdf`
        }
      });

      const response1 = await request
        .post('/webhook')
        .set(issueWebhook.headers)
        .send(issueWebhook.rawPayload)
        .expect(200);

      expect(response1.body).toMatchObject({
        status: 'success',
        issueNumber: issueNumber,
        taskType: 'fix_issue'
      });

      // Step 2: Developer requests test generation
      const testRequestWebhook = webhookSimulator.createIssueCommentWebhook('created', {
        body: '@swe-agent please generate comprehensive security tests for this fix'
      }, {
        number: issueNumber
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--test', '--issue', issueNumber.toString()], {
        status: 'success',
        task: 'generate_tests',
        summary: 'Generated 15 comprehensive security tests',
        details: {
          tests_generated: 15,
          coverage_increase: '25.5%',
          test_types: {
            unit: 8,
            integration: 5,
            security: 2
          },
          files_created: [
            'test/auth/token-validator.test.js',
            'test/middleware/auth.test.js',
            'test/security/integration.test.js'
          ],
          test_scenarios: [
            'Valid token validation',
            'Invalid token rejection',
            'Malformed token handling',
            'Token expiry validation',
            'Rate limiting tests'
          ]
        }
      });

      const response2 = await request
        .post('/webhook')
        .set(testRequestWebhook.headers)
        .send(testRequestWebhook.rawPayload)
        .expect(200);

      expect(response2.body).toMatchObject({
        status: 'success',
        issueNumber: issueNumber,
        taskType: 'generate_tests'
      });

      // Step 3: PR created for the fix
      const prWebhook = webhookSimulator.createPullRequestWebhook('opened', {
        number: 45,
        title: `fix: Security vulnerability - token validation (closes #${issueNumber})`,
        body: `
Fixes #${issueNumber}

## Changes Made
- Implemented proper token format validation
- Added signature verification
- Enhanced rate limiting for invalid tokens
- Added comprehensive test suite

## Security Impact
- Prevents authentication bypass
- Improves overall security posture
- Adds proper input validation

## Testing
- Added 15 new security tests
- All tests passing
- Security scan clean
        `,
        head: { ref: 'security/fix-token-validation' },
        base: { ref: 'main' }
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--review', '--pr', '45'], {
        status: 'success',
        task: 'review_pr',
        summary: 'Security-focused PR review completed',
        details: {
          overall_score: 95,
          review_comments: 3,
          categories: {
            security: 2,
            code_quality: 1,
            performance: 0,
            style: 0,
            documentation: 0
          },
          approval_status: 'approved',
          files_reviewed: 6,
          security_analysis: {
            vulnerabilities_found: 0,
            security_improvements: 3,
            risk_level: 'low'
          },
          recommendations: [
            'Consider adding additional rate limiting',
            'Document new security measures',
            'Update security guidelines'
          ]
        }
      });

      const response3 = await request
        .post('/webhook')
        .set(prWebhook.headers)
        .send(prWebhook.rawPayload)
        .expect(200);

      expect(response3.body).toMatchObject({
        status: 'success',
        prNumber: 45,
        taskType: 'review_pr'
      });

      // Step 4: Final validation comment
      const validationWebhook = webhookSimulator.createIssueCommentWebhook('created', {
        body: '@swe-agent please perform final security validation before we close this issue'
      }, {
        number: issueNumber
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--validate', '--issue', issueNumber.toString()], {
        status: 'success',
        task: 'security_validation',
        summary: 'Security validation passed - issue resolution confirmed',
        details: {
          validation_checks: {
            token_validation: 'pass',
            signature_verification: 'pass',
            rate_limiting: 'pass',
            integration_tests: 'pass',
            security_scan: 'pass'
          },
          risk_assessment: 'resolved',
          confidence: 0.98,
          recommendations: [
            'Monitor authentication logs for anomalies',
            'Schedule follow-up security review in 30 days'
          ]
        }
      });

      const response4 = await request
        .post('/webhook')
        .set(validationWebhook.headers)
        .send(validationWebhook.rawPayload)
        .expect(200);

      expect(response4.body.status).toBe('success');

      // Verify complete workflow execution
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(4);
      
      const taskTypes = execHistory.map(exec => exec.result.task);
      expect(taskTypes).toEqual(['fix_issue', 'generate_tests', 'review_pr', 'security_validation']);

      // Verify execution statistics
      const stats = sweAgentMock.getExecutionStats();
      expect(stats.total_executions).toBe(4);
      expect(stats.successful_executions).toBe(4);
      expect(stats.success_rate).toBe(1.0);
    });
  });

  describe('Feature Development Workflow', () => {
    test('should handle complete feature development lifecycle', async () => {
      const featureIssue = 201;
      const featurePR = 67;

      // Step 1: Feature request
      const featureRequestWebhook = webhookSimulator.createIssuesWebhook('opened', {
        number: featureIssue,
        title: 'Feature Request: Real-time collaboration system',
        body: `
# Feature Request

## Description
Implement real-time collaboration features for document editing.

## Requirements
- Real-time multi-user editing
- Conflict resolution
- User presence indicators
- Change tracking
- Performance optimization

## Acceptance Criteria
- [ ] Multiple users can edit simultaneously
- [ ] Changes sync in real-time
- [ ] Conflicts are resolved automatically
- [ ] Performance impact < 10ms latency
        `,
        labels: [
          { name: 'enhancement', color: 'green' },
          { name: 'feature', color: 'blue' }
        ]
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--analyze', '--feature', featureIssue.toString()], {
        status: 'success',
        task: 'feature_analysis',
        summary: 'Feature analysis completed - implementation plan generated',
        details: {
          complexity_score: 8.5,
          estimated_effort: '2-3 weeks',
          components_needed: [
            'WebSocket server',
            'Conflict resolution engine',
            'User presence system',
            'Change tracking service'
          ],
          technical_requirements: [
            'Redis for real-time state',
            'WebSocket connection pool',
            'Operational transformation library'
          ],
          implementation_plan: {
            phase1: 'Basic real-time editing',
            phase2: 'Conflict resolution',
            phase3: 'Performance optimization'
          }
        }
      });

      const response1 = await request
        .post('/webhook')
        .set(featureRequestWebhook.headers)
        .send(featureRequestWebhook.rawPayload)
        .expect(200);

      expect(response1.body.status).toBe('success');

      // Step 2: Implementation PR
      const implementationPR = webhookSimulator.createPullRequestWebhook('opened', {
        number: featurePR,
        title: `feat: Real-time collaboration system (implements #${featureIssue})`,
        body: `
Implements #${featureIssue}

## Implementation Details
- Added WebSocket server for real-time communication
- Implemented operational transformation for conflict resolution
- Added user presence tracking
- Optimized for sub-10ms latency

## Architecture Changes
- New collaboration service
- Enhanced client-side editor
- Redis integration for state management

## Performance
- 99th percentile latency: 8.5ms
- Supports up to 50 concurrent users per document
- Memory usage increase: ~15MB per active session
        `,
        head: { ref: 'feature/realtime-collaboration' },
        base: { ref: 'develop' }
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--review', '--pr', featurePR.toString()], {
        status: 'success',
        task: 'feature_review',
        summary: 'Comprehensive feature review completed',
        details: {
          overall_score: 88,
          review_comments: 12,
          categories: {
            architecture: 3,
            performance: 2,
            security: 1,
            code_quality: 4,
            documentation: 2
          },
          approval_status: 'approved_with_suggestions',
          feature_validation: {
            requirements_met: 0.95,
            performance_targets: 'exceeded',
            scalability_score: 8.2
          },
          suggestions: [
            'Add rate limiting for WebSocket connections',
            'Improve error handling for network failures',
            'Add monitoring for collaboration metrics'
          ]
        }
      });

      const response2 = await request
        .post('/webhook')
        .set(implementationPR.headers)
        .send(implementationPR.rawPayload)
        .expect(200);

      expect(response2.body.status).toBe('success');

      // Step 3: Performance testing request
      const perfTestWebhook = webhookSimulator.createIssueCommentWebhook('created', {
        body: '@swe-agent please run comprehensive performance tests on the new collaboration features'
      }, {
        number: featureIssue
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--test', '--performance', featureIssue.toString()], {
        status: 'success',
        task: 'performance_testing',
        summary: 'Performance testing completed - all targets met',
        details: {
          test_scenarios: [
            'Single user editing',
            'Multi-user collaboration (5 users)',
            'High load scenario (50 users)',
            'Network degradation simulation'
          ],
          results: {
            average_latency: '6.2ms',
            p99_latency: '8.1ms',
            throughput: '15000 ops/sec',
            memory_usage: '142MB baseline + 14MB per session',
            cpu_usage: '12% baseline + 2% per active session'
          },
          bottlenecks_identified: [],
          recommendations: [
            'Implement connection pooling optimization',
            'Add client-side caching for frequently accessed data'
          ]
        }
      });

      const response3 = await request
        .post('/webhook')
        .set(perfTestWebhook.headers)
        .send(perfTestWebhook.rawPayload)
        .expect(200);

      expect(response3.body.status).toBe('success');

      // Verify complete feature workflow
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(3);
      
      const taskTypes = execHistory.map(exec => exec.result.task);
      expect(taskTypes).toEqual(['feature_analysis', 'feature_review', 'performance_testing']);
    });
  });

  describe('Code Quality Workflow', () => {
    test('should handle comprehensive code quality improvement workflow', async () => {
      // Step 1: Push with code quality issues
      const pushWithIssues = webhookSimulator.createPushWebhook([{
        id: 'quality123',
        message: 'refactor: Improve legacy authentication module',
        author: { name: 'developer', email: 'dev@example.com' },
        modified: [
          'src/auth/legacy-auth.js',
          'src/auth/session-manager.js',
          'src/utils/crypto-utils.js'
        ]
      }]);

      sweAgentMock.setPredefinedResponse('swe-agent', ['--analyze', '--commit', 'quality123'], {
        status: 'success',
        task: 'quality_analysis',
        summary: 'Code quality analysis completed - multiple improvement opportunities found',
        details: {
          code_quality_score: 65.5,
          issues_found: {
            critical: 1,
            major: 4,
            minor: 8,
            style: 12
          },
          files_analyzed: 3,
          improvement_opportunities: [
            {
              file: 'src/auth/legacy-auth.js',
              issues: ['High cyclomatic complexity', 'Duplicate code blocks', 'Missing error handling'],
              suggestions: ['Extract functions', 'Add proper error handling', 'Implement design patterns']
            },
            {
              file: 'src/auth/session-manager.js',
              issues: ['Memory leaks', 'Synchronous operations'],
              suggestions: ['Fix memory management', 'Use async/await patterns']
            }
          ],
          metrics: {
            complexity: 8.5,
            maintainability: 62.3,
            test_coverage: 45.2,
            duplication: 12.8
          }
        }
      });

      const response1 = await request
        .post('/webhook')
        .set(pushWithIssues.headers)
        .send(pushWithIssues.rawPayload)
        .expect(200);

      expect(response1.body.status).toBe('success');

      // Step 2: Request automated refactoring
      const refactorRequest = webhookSimulator.createIssueCommentWebhook('created', {
        body: '@swe-agent please refactor the legacy authentication module to improve code quality'
      }, {
        number: 301,
        title: 'Technical Debt: Legacy authentication module needs refactoring'
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--refactor', '--issue', '301'], {
        status: 'success',
        task: 'automated_refactoring',
        summary: 'Automated refactoring completed - significant quality improvements achieved',
        details: {
          refactoring_type: 'comprehensive_modernization',
          files_refactored: 3,
          improvements: {
            complexity_reduction: '45%',
            maintainability_improvement: '38%',
            code_duplication_removed: '85%',
            test_coverage_increase: '25%'
          },
          changes_made: [
            'Extracted 8 functions to reduce complexity',
            'Implemented async/await patterns',
            'Added comprehensive error handling',
            'Removed code duplication',
            'Applied modern JavaScript patterns',
            'Enhanced type safety'
          ],
          new_metrics: {
            complexity: 4.2,
            maintainability: 86.1,
            test_coverage: 70.2,
            duplication: 2.1
          },
          breaking_changes: false,
          test_results: {
            existing_tests: 'all_passing',
            new_tests_added: 15,
            coverage_improvement: '24.8%'
          }
        }
      });

      const response2 = await request
        .post('/webhook')
        .set(refactorRequest.headers)
        .send(refactorRequest.rawPayload)
        .expect(200);

      expect(response2.body.status).toBe('success');

      // Step 3: Generate comprehensive tests
      const testGeneration = webhookSimulator.createIssueCommentWebhook('created', {
        body: '@swe-agent generate comprehensive test suite for the refactored authentication module'
      }, {
        number: 301
      });

      sweAgentMock.setPredefinedResponse('swe-agent', ['--test', '--comprehensive', '301'], {
        status: 'success',
        task: 'comprehensive_test_generation',
        summary: 'Comprehensive test suite generated - 95% coverage achieved',
        details: {
          tests_generated: 42,
          coverage_achieved: '95.2%',
          test_categories: {
            unit_tests: 28,
            integration_tests: 10,
            security_tests: 4
          },
          test_scenarios: [
            'Authentication success/failure paths',
            'Session management lifecycle',
            'Error handling edge cases',
            'Security boundary testing',
            'Performance under load',
            'Memory leak prevention'
          ],
          quality_metrics: {
            assertion_coverage: '98%',
            branch_coverage: '93%',
            line_coverage: '95%',
            mutation_test_score: '87%'
          },
          files_created: [
            'test/auth/legacy-auth.test.js',
            'test/auth/session-manager.test.js',
            'test/utils/crypto-utils.test.js',
            'test/integration/auth-flow.test.js'
          ]
        }
      });

      const response3 = await request
        .post('/webhook')
        .set(testGeneration.headers)
        .send(testGeneration.rawPayload)
        .expect(200);

      expect(response3.body.status).toBe('success');

      // Verify complete quality workflow
      const execHistory = sweAgentMock.getExecutionHistory();
      expect(execHistory).toHaveLength(3);
      
      const taskTypes = execHistory.map(exec => exec.result.task);
      expect(taskTypes).toEqual(['quality_analysis', 'automated_refactoring', 'comprehensive_test_generation']);

      // Verify improvement metrics
      const refactorResult = execHistory[1].result;
      expect(parseFloat(refactorResult.details.improvements.complexity_reduction)).toBeGreaterThan(40);
      expect(parseFloat(refactorResult.details.improvements.maintainability_improvement)).toBeGreaterThan(30);
    });
  });

  describe('Workflow Health and Monitoring', () => {
    test('should provide comprehensive workflow health status', async () => {
      // Execute a series of operations
      const operations = [
        () => webhookSimulator.createIssuesWebhook('opened'),
        () => webhookSimulator.createPullRequestWebhook('opened'),
        () => webhookSimulator.createIssueCommentWebhook('created', { body: '@swe-agent help' })
      ];

      for (const createOperation of operations) {
        const webhook = createOperation();
        await request
          .post('/webhook')
          .set(webhook.headers)
          .send(webhook.rawPayload)
          .expect(200);
      }

      // Check system health
      const healthResponse = await request
        .get('/health')
        .expect(200);

      expect(healthResponse.body).toHaveProperty('status', 'healthy');

      // Check detailed status
      const statusResponse = await request
        .get('/status')
        .expect(200);

      expect(statusResponse.body).toHaveProperty('uptime');
      expect(statusResponse.body).toHaveProperty('memory');
      expect(statusResponse.body).toHaveProperty('executions');

      const execStats = statusResponse.body.executions;
      expect(execStats.total_executions).toBeGreaterThan(0);
      expect(execStats.success_rate).toBeGreaterThan(0.8);
    });
  });
});