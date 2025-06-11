#!/usr/bin/env node

/**
 * SWE-Agent GitHub Action Wrapper
 * Lightweight wrapper for seamless SWE-agent integration
 */

const core = require('@actions/core');
const github = require('@actions/github');
const SWEAgentRunner = require('./swe-agent-runner');
const GitHubIntegration = require('./github-integration');
const ConfigBuilder = require('../src/config-builder');
const logger = require('../utils/logger');

class SWEAgentAction {
  constructor() {
    // Initialize components
    this.configBuilder = new ConfigBuilder();
    this.sweRunner = new SWEAgentRunner();
    this.github = new GitHubIntegration();

    // Parse inputs
    this.inputs = {
      model: core.getInput('model_name') || 'gpt-4o-mini',
      triggerPhrase: core.getInput('trigger_phrase') || '@swe-agent',
      maxCost: parseFloat(core.getInput('max_cost') || '5.00'),
      tools: core.getInput('tools') || 'str_replace_editor,bash',
      debugMode: core.getInput('debug_mode') === 'true'
    };

    // GitHub context (handle test environment gracefully)
    this.context = {
      eventName: github.context?.eventName || process.env.GITHUB_EVENT_NAME,
      payload: github.context?.payload || this.parseEventPayload(),
      repository: github.context?.repo || { owner: 'test', repo: 'test' },
      actor: github.context?.actor || 'test-actor'
    };

    logger.info('SWE-Agent Action initialized', {
      model: this.inputs.model,
      event: this.context.eventName
    });
  }

  parseEventPayload() {
    // Try to read event payload from GITHUB_EVENT_PATH
    try {
      const eventPath = process.env.GITHUB_EVENT_PATH;
      if (eventPath) {
        const fs = require('fs');
        return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      }
    } catch (error) {
      logger.warn('Failed to parse event payload', { error: error.message });
    }

    // Return minimal test payload
    return {
      action: 'created',
      comment: { body: '@swe-agent test' },
      issue: { number: 1, title: 'Test issue' },
      repository: { full_name: 'test/repo', owner: { login: 'test' }, name: 'repo' }
    };
  }

  async run() {
    try {
      // 1. Parse GitHub event
      const event = this.parseGitHubEvent();

      // 2. Check if we should process this event
      if (!this.shouldProcess(event)) {
        logger.info('Event skipped - no trigger phrase or unsupported event type');
        core.setOutput('status', 'skipped');
        return;
      }

      logger.info('Processing event', {
        type: event.type,
        trigger: event.trigger
      });

      // 3. Build SWE-agent configuration
      const config = this.configBuilder.build(this.inputs);

      // 4. Execute SWE-agent
      const result = await this.sweRunner.execute(event, config);

      // 5. Post result to GitHub
      await this.github.postComment(event, result);

      // 6. Set outputs
      core.setOutput('status', 'success');
      core.setOutput('cost_estimate', result.costEstimate);
      core.setOutput('comment_url', result.commentUrl);

      logger.info('Action completed successfully', {
        cost: result.costEstimate
      });

    } catch (error) {
      await this.handleError(error);
    }
  }

  parseGitHubEvent() {
    const { eventName, payload } = this.context;

    if (!payload) {
      throw new Error('No event payload available');
    }

    switch (eventName) {
    case 'issue_comment':
      if (!payload.comment || !payload.issue) {
        throw new Error('Invalid issue_comment payload structure');
      }
      return {
        type: 'issue_comment',
        trigger: payload.comment.body,
        issueNumber: payload.issue.number,
        repository: payload.repository,
        comment: payload.comment,
        issue: payload.issue
      };

    case 'issues':
      if (!payload.issue) {
        throw new Error('Invalid issues payload structure');
      }
      return {
        type: 'issue',
        trigger: this.inputs.triggerPhrase, // Auto-trigger for new issues
        issueNumber: payload.issue.number,
        repository: payload.repository,
        issue: payload.issue
      };

    case 'pull_request':
      if (!payload.pull_request) {
        throw new Error('Invalid pull_request payload structure');
      }
      return {
        type: 'pull_request',
        trigger: this.inputs.triggerPhrase, // Auto-trigger for new PRs
        issueNumber: payload.pull_request.number,
        repository: payload.repository,
        pullRequest: payload.pull_request
      };

    case 'pull_request_review_comment':
      if (!payload.comment || !payload.pull_request) {
        throw new Error('Invalid pull_request_review_comment payload structure');
      }
      return {
        type: 'pull_request_review_comment',
        trigger: payload.comment.body,
        issueNumber: payload.pull_request.number,
        repository: payload.repository,
        comment: payload.comment,
        pullRequest: payload.pull_request
      };

    default:
      throw new Error(`Unsupported event type: ${eventName}`);
    }
  }

  shouldProcess(event) {
    // Check if event contains trigger phrase
    if (event.type === 'issue_comment') {
      return event.trigger.includes(this.inputs.triggerPhrase);
    }

    // Auto-process new issues and PRs if enabled
    if (event.type === 'issue' && this.context.payload.action === 'opened') {
      return true;
    }

    if (event.type === 'pull_request' && this.context.payload.action === 'opened') {
      return true;
    }

    return false;
  }

  async handleError(error) {
    const errorMessage = this.formatErrorMessage(error);

    logger.error('Action failed', {
      error: error.message,
      stack: error.stack
    });

    // Try to post error comment to GitHub
    try {
      await this.github.postErrorComment(this.parseGitHubEvent(), errorMessage);
    } catch (commentError) {
      logger.error('Failed to post error comment', { error: commentError.message });
    }

    // Set outputs and fail the action
    core.setOutput('status', 'failure');
    core.setFailed(errorMessage);
  }

  formatErrorMessage(error) {
    if (error.message.includes('API key')) {
      return '❌ **Configuration Error**: Missing or invalid API key. Please check your repository secrets.';
    }

    if (error.message.includes('rate limit')) {
      return '⏰ **Rate Limit**: API rate limit reached. Please try again later.';
    }

    if (error.message.includes('timeout')) {
      return '⏱️ **Timeout**: SWE-agent execution timed out. The issue might be too complex.';
    }

    if (error.code === 'EACCES') {
      return '🔒 **Permission Error**: Insufficient permissions to access required resources.';
    }

    return `🚨 **Execution Error**: ${error.message}`;
  }
}

// Run the action
if (require.main === module) {
  const action = new SWEAgentAction();
  action.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = SWEAgentAction;
