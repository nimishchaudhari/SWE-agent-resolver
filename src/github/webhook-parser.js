const crypto = require('crypto');
const logger = require('../utils/logger');

class WebhookParser {
  constructor(secret) {
    this.secret = secret;
    this.supportedEvents = new Set([
      'issues',
      'issue_comment', 
      'pull_request',
      'pull_request_review_comment'
    ]);
  }

  validateSignature(payload, signature) {
    if (!signature) {
      throw new Error('Missing webhook signature');
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', this.secret)
      .update(payload, 'utf8')
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      throw new Error('Invalid webhook signature');
    }
  }

  parseWebhook(rawPayload, headers) {
    try {
      // Validate signature
      this.validateSignature(rawPayload, headers['x-hub-signature-256']);

      // Parse JSON payload
      const payload = JSON.parse(rawPayload);
      const event = headers['x-github-event'];
      const delivery = headers['x-github-delivery'];

      // Basic validation
      if (!event) {
        throw new Error('Missing X-GitHub-Event header');
      }

      if (!this.supportedEvents.has(event)) {
        logger.debug(`Ignoring unsupported event: ${event}`);
        return { supported: false, event, delivery };
      }

      // Extract common fields
      const parsed = {
        supported: true,
        event,
        delivery,
        action: payload.action,
        repository: payload.repository,
        sender: payload.sender,
        payload
      };

      // Event-specific parsing
      switch (event) {
        case 'issues':
          return this.parseIssueEvent(parsed);
        case 'issue_comment':
          return this.parseIssueCommentEvent(parsed);
        case 'pull_request':
          return this.parsePullRequestEvent(parsed);
        case 'pull_request_review_comment':
          return this.parsePRCommentEvent(parsed);
        default:
          return parsed;
      }
    } catch (error) {
      logger.error('Webhook parsing failed:', error);
      throw error;
    }
  }

  parseIssueEvent(parsed) {
    const { payload } = parsed;
    
    return {
      ...parsed,
      issue: {
        number: payload.issue.number,
        title: payload.issue.title,
        body: payload.issue.body,
        state: payload.issue.state,
        author: payload.issue.user?.login,
        labels: payload.issue.labels?.map(l => l.name) || [],
        assignees: payload.issue.assignees?.map(a => a.login) || [],
        createdAt: payload.issue.created_at,
        updatedAt: payload.issue.updated_at
      }
    };
  }

  parseIssueCommentEvent(parsed) {
    const { payload } = parsed;
    
    return {
      ...parsed,
      issue: {
        number: payload.issue.number,
        title: payload.issue.title,
        body: payload.issue.body,
        state: payload.issue.state,
        author: payload.issue.user?.login,
        isPullRequest: !!payload.issue.pull_request
      },
      comment: {
        id: payload.comment.id,
        body: payload.comment.body,
        author: payload.comment.user?.login,
        createdAt: payload.comment.created_at,
        updatedAt: payload.comment.updated_at
      }
    };
  }

  parsePullRequestEvent(parsed) {
    const { payload } = parsed;
    
    return {
      ...parsed,
      pullRequest: {
        number: payload.pull_request.number,
        title: payload.pull_request.title,
        body: payload.pull_request.body,
        state: payload.pull_request.state,
        author: payload.pull_request.user?.login,
        draft: payload.pull_request.draft,
        mergeable: payload.pull_request.mergeable,
        head: {
          sha: payload.pull_request.head.sha,
          ref: payload.pull_request.head.ref,
          repo: payload.pull_request.head.repo?.full_name
        },
        base: {
          sha: payload.pull_request.base.sha,
          ref: payload.pull_request.base.ref,
          repo: payload.pull_request.base.repo?.full_name
        },
        createdAt: payload.pull_request.created_at,
        updatedAt: payload.pull_request.updated_at
      }
    };
  }

  parsePRCommentEvent(parsed) {
    const { payload } = parsed;
    
    return {
      ...parsed,
      pullRequest: {
        number: payload.pull_request.number,
        title: payload.pull_request.title,
        author: payload.pull_request.user?.login
      },
      comment: {
        id: payload.comment.id,
        body: payload.comment.body,
        author: payload.comment.user?.login,
        path: payload.comment.path,
        line: payload.comment.line,
        position: payload.comment.position,
        diffHunk: payload.comment.diff_hunk,
        createdAt: payload.comment.created_at,
        updatedAt: payload.comment.updated_at
      }
    };
  }

  extractRepositoryInfo(parsed) {
    if (!parsed.repository) {
      throw new Error('Repository information missing from webhook');
    }

    return {
      id: parsed.repository.id,
      name: parsed.repository.name,
      fullName: parsed.repository.full_name,
      owner: parsed.repository.owner?.login,
      private: parsed.repository.private,
      defaultBranch: parsed.repository.default_branch,
      cloneUrl: parsed.repository.clone_url,
      sshUrl: parsed.repository.ssh_url,
      permissions: {
        admin: parsed.repository.permissions?.admin || false,
        push: parsed.repository.permissions?.push || false,
        pull: parsed.repository.permissions?.pull || false
      }
    };
  }
}

module.exports = WebhookParser;