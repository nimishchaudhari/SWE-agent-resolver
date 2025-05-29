/**
 * GitHub API mock response fixtures
 */

module.exports = {
  // Issue responses
  issue: {
    basic: {
      id: 1,
      number: 123,
      title: 'Test Issue',
      body: 'This is a test issue that needs fixing',
      state: 'open',
      user: {
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        type: 'User'
      },
      labels: [
        { id: 1, name: 'bug', color: 'd73a4a' }
      ],
      assignee: null,
      milestone: null,
      comments: 2,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      closed_at: null,
      html_url: 'https://github.com/test-owner/test-repo/issues/123'
    }
  },

  // Pull request responses
  pullRequest: {
    basic: {
      id: 2,
      number: 456,
      title: 'Add new feature',
      body: 'This PR adds a new feature to the codebase',
      state: 'open',
      user: {
        login: 'contributor',
        id: 23456,
        avatar_url: 'https://avatars.githubusercontent.com/u/23456',
        type: 'User'
      },
      head: {
        label: 'contributor:feature-branch',
        ref: 'feature-branch',
        sha: 'abc123',
        repo: {
          name: 'test-repo',
          owner: { login: 'contributor' }
        }
      },
      base: {
        label: 'test-owner:main',
        ref: 'main',
        sha: 'def456',
        repo: {
          name: 'test-repo',
          owner: { login: 'test-owner' }
        }
      },
      draft: false,
      merged: false,
      mergeable: true,
      changed_files: 5,
      additions: 100,
      deletions: 20,
      commits: 3,
      review_comments: 1,
      comments: 2,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      html_url: 'https://github.com/test-owner/test-repo/pull/456'
    }
  },

  // Comment responses
  comment: {
    issue: {
      id: 12345,
      body: '@swe-agent please analyze this issue',
      user: {
        login: 'testuser',
        id: 12345,
        type: 'User'
      },
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      html_url: 'https://github.com/test-owner/test-repo/issues/123#issuecomment-12345',
      issue_url: 'https://api.github.com/repos/test-owner/test-repo/issues/123'
    },
    pr: {
      id: 23456,
      body: '@swe-agent review this code',
      user: {
        login: 'reviewer',
        id: 34567,
        type: 'User'
      },
      path: 'src/feature.js',
      line: 42,
      diff_hunk: '@@ -40,3 +40,5 @@ function oldFunction() {\n   return result;\n }\n+function newFunction() {\n+  // Implementation\n+}',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      html_url: 'https://github.com/test-owner/test-repo/pull/456#discussion_r23456',
      pull_request_url: 'https://api.github.com/repos/test-owner/test-repo/pulls/456'
    }
  },

  // Repository responses
  repository: {
    basic: {
      id: 1234567,
      name: 'test-repo',
      full_name: 'test-owner/test-repo',
      owner: {
        login: 'test-owner',
        id: 78901,
        type: 'Organization'
      },
      private: false,
      description: 'Test repository for SWE-Agent',
      fork: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      pushed_at: '2024-01-02T00:00:00Z',
      size: 1024,
      stargazers_count: 100,
      watchers_count: 100,
      language: 'JavaScript',
      has_issues: true,
      has_projects: true,
      has_downloads: true,
      has_wiki: true,
      has_pages: false,
      forks_count: 20,
      archived: false,
      disabled: false,
      open_issues_count: 10,
      topics: ['testing', 'automation'],
      visibility: 'public',
      default_branch: 'main',
      permissions: {
        admin: false,
        push: true,
        pull: true
      }
    }
  },

  // Webhook event payloads
  webhooks: {
    issueOpened: {
      action: 'opened',
      issue: {
        id: 3,
        number: 789,
        title: 'New bug report',
        body: 'Found a bug in the authentication flow',
        state: 'open',
        user: {
          login: 'reporter',
          id: 45678
        },
        labels: [],
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z'
      },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' }
      },
      sender: {
        login: 'reporter',
        id: 45678
      }
    },
    issueComment: {
      action: 'created',
      issue: {
        id: 1,
        number: 123,
        title: 'Test Issue',
        body: 'This is a test issue that needs fixing',
        state: 'open',
        user: { login: 'testuser' },
        labels: [{ name: 'bug' }]
      },
      comment: {
        id: 12345,
        body: '@swe-agent analyze this issue and suggest a fix',
        user: { login: 'testuser' },
        created_at: '2024-01-02T00:00:00Z'
      },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' }
      },
      sender: {
        login: 'testuser',
        id: 12345
      }
    },
    prOpened: {
      action: 'opened',
      pull_request: {
        id: 4,
        number: 999,
        title: 'Implement new feature',
        body: 'This PR implements the requested feature',
        state: 'open',
        user: { login: 'developer' },
        head: {
          ref: 'new-feature',
          sha: 'xyz789'
        },
        base: {
          ref: 'main',
          sha: 'uvw456'
        },
        draft: false,
        changed_files: 8,
        additions: 200,
        deletions: 50
      },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' }
      },
      sender: {
        login: 'developer',
        id: 56789
      }
    },
    prReviewComment: {
      action: 'created',
      pull_request: {
        id: 2,
        number: 456,
        title: 'Add new feature',
        user: { login: 'contributor' }
      },
      comment: {
        id: 34567,
        body: '@swe-agent can you check if this follows best practices?',
        user: { login: 'reviewer' },
        path: 'src/utils.js',
        line: 25,
        diff_hunk: '@@ -23,3 +23,5 @@ export function utility() {\n   return value;\n }\n+export function newUtility() {\n+  // TODO: implement\n+}'
      },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' }
      },
      sender: {
        login: 'reviewer',
        id: 67890
      }
    }
  },

  // Error responses
  errors: {
    notFound: {
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest/issues/issues#get-an-issue',
      status: '404'
    },
    unauthorized: {
      message: 'Bad credentials',
      documentation_url: 'https://docs.github.com/rest',
      status: '401'
    },
    rateLimit: {
      message: 'API rate limit exceeded',
      documentation_url: 'https://docs.github.com/rest/rate-limit',
      status: '429'
    },
    serverError: {
      message: 'Server Error',
      status: '500'
    }
  }
};