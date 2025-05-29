const crypto = require('crypto');
const { EventEmitter } = require('events');

class WebhookSimulator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.webhookSecret = options.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';
    this.baseUrl = options.baseUrl || 'https://api.github.com';
    this.defaultUser = options.defaultUser || 'testuser';
    this.defaultRepo = options.defaultRepo || 'test-repo';
  }

  /**
   * Generate webhook signature for payload validation
   */
  generateSignature(payload, secret = this.webhookSecret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Create base webhook headers
   */
  createHeaders(event, signature, deliveryId = null) {
    return {
      'x-github-event': event,
      'x-github-delivery': deliveryId || crypto.randomUUID(),
      'x-github-hook-id': '12345678',
      'x-github-hook-installation-target-id': '123456',
      'x-github-hook-installation-target-type': 'repository',
      'x-hub-signature-256': signature,
      'content-type': 'application/json',
      'user-agent': 'GitHub-Hookshot/abcd123'
    };
  }

  /**
   * Create repository object for webhooks
   */
  createRepository(overrides = {}) {
    return {
      id: 123456789,
      name: this.defaultRepo,
      full_name: `${this.defaultUser}/${this.defaultRepo}`,
      owner: {
        login: this.defaultUser,
        id: 987654321,
        type: 'User',
        ...overrides.owner
      },
      private: false,
      html_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}`,
      clone_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}.git`,
      ssh_url: `git@github.com:${this.defaultUser}/${this.defaultRepo}.git`,
      default_branch: 'main',
      ...overrides
    };
  }

  /**
   * Create user object for webhooks
   */
  createUser(overrides = {}) {
    return {
      login: this.defaultUser,
      id: 987654321,
      type: 'User',
      avatar_url: `https://github.com/images/avatars/${this.defaultUser}`,
      ...overrides
    };
  }

  /**
   * Create installation object for GitHub Apps
   */
  createInstallation(overrides = {}) {
    return {
      id: 12345,
      account: this.createUser(),
      repository_selection: 'selected',
      access_tokens_url: `${this.baseUrl}/app/installations/12345/access_tokens`,
      repositories_url: `${this.baseUrl}/installation/repositories`,
      html_url: `https://github.com/settings/installations/12345`,
      app_id: 67890,
      target_id: 987654321,
      target_type: 'User',
      permissions: {
        issues: 'write',
        pull_requests: 'write',
        contents: 'write',
        metadata: 'read'
      },
      events: ['issues', 'pull_request', 'push'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      single_file_name: null,
      ...overrides
    };
  }

  /**
   * Simulate issues webhook
   */
  createIssuesWebhook(action, issueData = {}, overrides = {}) {
    const issue = {
      id: 1,
      number: 1,
      title: 'Test Issue',
      body: 'This is a test issue for SWE-agent',
      state: 'open',
      user: this.createUser(),
      assignee: null,
      assignees: [],
      milestone: null,
      labels: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
      html_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}/issues/1`,
      ...issueData
    };

    const payload = {
      action,
      issue,
      repository: this.createRepository(),
      sender: this.createUser(),
      installation: this.createInstallation(),
      ...overrides
    };

    const payloadStr = JSON.stringify(payload);
    const signature = this.generateSignature(payloadStr);
    const headers = this.createHeaders('issues', signature);

    this.emit('webhook', { event: 'issues', payload, headers, rawPayload: payloadStr });

    return { payload, headers, rawPayload: payloadStr };
  }

  /**
   * Simulate pull request webhook
   */
  createPullRequestWebhook(action, prData = {}, overrides = {}) {
    const pullRequest = {
      id: 1,
      number: 1,
      title: 'Test Pull Request',
      body: 'This is a test PR for SWE-agent',
      state: 'open',
      draft: false,
      merged: false,
      mergeable: true,
      user: this.createUser(),
      assignee: null,
      assignees: [],
      requested_reviewers: [],
      milestone: null,
      head: {
        label: `${this.defaultUser}:feature-branch`,
        ref: 'feature-branch',
        sha: 'abc123def456',
        repo: this.createRepository()
      },
      base: {
        label: `${this.defaultUser}:main`,
        ref: 'main',
        sha: '123def456abc',
        repo: this.createRepository()
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_at: null,
      merged_at: null,
      html_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}/pull/1`,
      diff_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}/pull/1.diff`,
      patch_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}/pull/1.patch`,
      commits: 3,
      additions: 100,
      deletions: 50,
      changed_files: 5,
      ...prData
    };

    const payload = {
      action,
      number: pullRequest.number,
      pull_request: pullRequest,
      repository: this.createRepository(),
      sender: this.createUser(),
      installation: this.createInstallation(),
      ...overrides
    };

    const payloadStr = JSON.stringify(payload);
    const signature = this.generateSignature(payloadStr);
    const headers = this.createHeaders('pull_request', signature);

    this.emit('webhook', { event: 'pull_request', payload, headers, rawPayload: payloadStr });

    return { payload, headers, rawPayload: payloadStr };
  }

  /**
   * Simulate push webhook
   */
  createPushWebhook(commits = [], overrides = {}) {
    const defaultCommits = commits.length > 0 ? commits : [
      {
        id: 'abc123def456',
        message: 'Fix: Update configuration handling',
        author: {
          name: this.defaultUser,
          email: `${this.defaultUser}@example.com`,
          username: this.defaultUser
        },
        url: `https://github.com/${this.defaultUser}/${this.defaultRepo}/commit/abc123def456`,
        distinct: true,
        added: ['src/config/new-feature.js'],
        modified: ['src/config/index.js', 'README.md'],
        removed: []
      }
    ];

    const payload = {
      ref: 'refs/heads/main',
      before: '123def456abc',
      after: 'abc123def456',
      created: false,
      deleted: false,
      forced: false,
      base_ref: null,
      compare: `https://github.com/${this.defaultUser}/${this.defaultRepo}/compare/123def456abc...abc123def456`,
      commits: defaultCommits,
      head_commit: defaultCommits[defaultCommits.length - 1],
      repository: this.createRepository(),
      pusher: {
        name: this.defaultUser,
        email: `${this.defaultUser}@example.com`
      },
      sender: this.createUser(),
      installation: this.createInstallation(),
      ...overrides
    };

    const payloadStr = JSON.stringify(payload);
    const signature = this.generateSignature(payloadStr);
    const headers = this.createHeaders('push', signature);

    this.emit('webhook', { event: 'push', payload, headers, rawPayload: payloadStr });

    return { payload, headers, rawPayload: payloadStr };
  }

  /**
   * Simulate issue comment webhook
   */
  createIssueCommentWebhook(action, commentData = {}, issueData = {}, overrides = {}) {
    const comment = {
      id: 1,
      body: '@swe-agent please fix this issue',
      user: this.createUser(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}/issues/1#issuecomment-1`,
      ...commentData
    };

    const issue = {
      id: 1,
      number: 1,
      title: 'Test Issue',
      body: 'This is a test issue',
      state: 'open',
      user: this.createUser(),
      html_url: `https://github.com/${this.defaultUser}/${this.defaultRepo}/issues/1`,
      ...issueData
    };

    const payload = {
      action,
      issue,
      comment,
      repository: this.createRepository(),
      sender: this.createUser(),
      installation: this.createInstallation(),
      ...overrides
    };

    const payloadStr = JSON.stringify(payload);
    const signature = this.generateSignature(payloadStr);
    const headers = this.createHeaders('issue_comment', signature);

    this.emit('webhook', { event: 'issue_comment', payload, headers, rawPayload: payloadStr });

    return { payload, headers, rawPayload: payloadStr };
  }

  /**
   * Simulate workflow dispatch webhook
   */
  createWorkflowDispatchWebhook(inputs = {}, overrides = {}) {
    const payload = {
      ref: 'main',
      workflow: '.github/workflows/swe-agent.yml',
      inputs: {
        issue_number: '1',
        action: 'fix',
        ...inputs
      },
      repository: this.createRepository(),
      sender: this.createUser(),
      installation: this.createInstallation(),
      ...overrides
    };

    const payloadStr = JSON.stringify(payload);
    const signature = this.generateSignature(payloadStr);
    const headers = this.createHeaders('workflow_dispatch', signature);

    this.emit('webhook', { event: 'workflow_dispatch', payload, headers, rawPayload: payloadStr });

    return { payload, headers, rawPayload: payloadStr };
  }

  /**
   * Create webhook with invalid signature for testing security
   */
  createInvalidSignatureWebhook(event = 'issues') {
    const { payload, headers, rawPayload } = this.createIssuesWebhook('opened');
    
    // Corrupt the signature
    headers['x-hub-signature-256'] = 'sha256=invalid_signature_here';

    return { payload, headers, rawPayload };
  }

  /**
   * Create malformed webhook for testing error handling
   */
  createMalformedWebhook() {
    const malformedPayload = '{"incomplete": "json"';
    const signature = this.generateSignature(malformedPayload);
    const headers = this.createHeaders('issues', signature);

    return { 
      payload: null, 
      headers, 
      rawPayload: malformedPayload 
    };
  }

  /**
   * Simulate webhook delivery with retries
   */
  async simulateWebhookWithRetries(webhookData, maxRetries = 3, delay = 1000) {
    const attempts = [];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const deliveryId = crypto.randomUUID();
      const webhookWithRetry = {
        ...webhookData,
        headers: {
          ...webhookData.headers,
          'x-github-delivery': deliveryId,
          'x-github-hook-retry': attempt > 1 ? (attempt - 1).toString() : undefined
        }
      };

      attempts.push({
        attempt,
        deliveryId,
        webhook: webhookWithRetry,
        timestamp: new Date().toISOString()
      });

      this.emit('delivery_attempt', {
        attempt,
        deliveryId,
        webhook: webhookWithRetry
      });

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return attempts;
  }

  /**
   * Generate a sequence of related webhooks (e.g., issue opened -> commented -> closed)
   */
  async createWebhookSequence(sequenceType = 'issue_lifecycle', delay = 100) {
    const sequences = {
      issue_lifecycle: [
        () => this.createIssuesWebhook('opened'),
        () => this.createIssueCommentWebhook('created'),
        () => this.createIssuesWebhook('closed')
      ],
      pr_lifecycle: [
        () => this.createPullRequestWebhook('opened'),
        () => this.createIssueCommentWebhook('created'),
        () => this.createPullRequestWebhook('closed')
      ],
      push_sequence: [
        () => this.createPushWebhook([{
          id: 'commit1',
          message: 'Initial commit',
          author: { name: this.defaultUser, email: `${this.defaultUser}@example.com` }
        }]),
        () => this.createPushWebhook([{
          id: 'commit2', 
          message: 'Add feature',
          author: { name: this.defaultUser, email: `${this.defaultUser}@example.com` }
        }])
      ]
    };

    const sequence = sequences[sequenceType] || sequences.issue_lifecycle;
    const results = [];

    for (const createWebhook of sequence) {
      const webhook = createWebhook();
      results.push(webhook);
      
      this.emit('sequence_step', {
        step: results.length,
        total: sequence.length,
        webhook
      });

      if (delay > 0 && results.length < sequence.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.emit('sequence_complete', {
      type: sequenceType,
      webhooks: results
    });

    return results;
  }

  /**
   * Create bulk webhooks for load testing
   */
  createBulkWebhooks(count = 10, type = 'issues') {
    const webhooks = [];
    
    for (let i = 0; i < count; i++) {
      let webhook;
      
      switch (type) {
        case 'issues':
          webhook = this.createIssuesWebhook('opened', { 
            number: i + 1,
            title: `Test Issue ${i + 1}` 
          });
          break;
        case 'pull_request':
          webhook = this.createPullRequestWebhook('opened', {
            number: i + 1,
            title: `Test PR ${i + 1}`
          });
          break;
        case 'push':
          webhook = this.createPushWebhook([{
            id: `commit${i + 1}`,
            message: `Commit ${i + 1}`,
            author: { name: this.defaultUser, email: `${this.defaultUser}@example.com` }
          }]);
          break;
        default:
          webhook = this.createIssuesWebhook('opened');
      }
      
      webhooks.push(webhook);
    }

    this.emit('bulk_created', { count, type, webhooks });
    return webhooks;
  }
}

module.exports = WebhookSimulator;