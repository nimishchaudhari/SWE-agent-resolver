/**
 * Unit tests for CommentHandler
 * Tests GitHub comment creation, updates, and formatting
 */

// Jest globals are available automatically
const CommentHandler = require('../../action/comment-handler');
const ProviderManager = require('../../action/provider-manager');

// Mock Octokit
const mockOctokit = {
  rest: {
    issues: {
      createComment: jest.fn(),
      updateComment: jest.fn()
    }
  }
};

describe('CommentHandler', () => {
  let commentHandler;
  let providerManager;

  beforeEach(() => {
    providerManager = new ProviderManager();
    commentHandler = new CommentHandler(mockOctokit, providerManager);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createStatusComment', () => {
    const mockContext = {
      type: 'issue_comment',
      repoOwner: 'test-org',
      repoName: 'test-repo',
      issueNumber: 123,
      title: 'Test Issue',
      author: 'test-user'
    };

    test('should create status comment with correct structure', async () => {
      const mockResponse = {
        data: {
          id: 456,
          html_url: 'https://github.com/test-org/test-repo/issues/123#issuecomment-456'
        }
      };
      
      mockOctokit.rest.issues.createComment.mockResolvedValue(mockResponse);

      const result = await commentHandler.createStatusComment(
        mockContext,
        'gpt-4o',
        'initializing'
      );

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('🤖 SWE-Agent Status')
      });

      expect(result).toEqual(mockResponse.data);
    });

    test('should include provider information in comment', async () => {
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

      await commentHandler.createStatusComment(
        mockContext,
        'claude-3-5-sonnet-latest',
        'executing'
      );

      const callArgs = mockOctokit.rest.issues.createComment.mock.calls[0][0];
      expect(callArgs.body).toContain('**Provider:** ANTHROPIC');
      expect(callArgs.body).toContain('**Model:** `claude-3-5-sonnet-latest`');
      expect(callArgs.body).toContain('🧠'); // Anthropic emoji
    });

    test('should handle different context types', async () => {
      const prContext = {
        type: 'pull_request',
        repoOwner: 'test-org',
        repoName: 'test-repo',
        prNumber: 45,
        title: 'Test PR',
        author: 'test-user'
      };

      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 456 } });

      await commentHandler.createStatusComment(prContext, 'gpt-4o', 'initializing');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        issue_number: 45, // PRs use issue_number for comments
        body: expect.stringContaining('**Type:** Pull Request Review')
      });
    });

    test('should handle API errors gracefully', async () => {
      const apiError = new Error('GitHub API error');
      mockOctokit.rest.issues.createComment.mockRejectedValue(apiError);

      await expect(
        commentHandler.createStatusComment(mockContext, 'gpt-4o', 'initializing')
      ).rejects.toThrow('GitHub API error');
    });
  });

  describe('updateStatusComment', () => {
    const mockContext = {
      type: 'issue_comment',
      repoOwner: 'test-org',
      repoName: 'test-repo',
      title: 'Test Issue'
    };

    test('should update comment with new status', async () => {
      const costEstimate = {
        totalCost: '0.0045',
        inputTokens: 1500,
        outputTokens: 500,
        provider: 'openai'
      };

      await commentHandler.updateStatusComment(
        456,
        mockContext,
        'gpt-4o',
        'success',
        costEstimate,
        'Analysis completed successfully'
      );

      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        comment_id: 456,
        body: expect.stringContaining('✅')
      });

      const callArgs = mockOctokit.rest.issues.updateComment.mock.calls[0][0];
      expect(callArgs.body).toContain('**Status:** Completed Successfully');
      expect(callArgs.body).toContain('$0.0045');
      expect(callArgs.body).toContain('Analysis completed successfully');
    });

    test('should handle update failures gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockOctokit.rest.issues.updateComment.mockRejectedValue(new Error('Update failed'));

      // Should not throw
      await commentHandler.updateStatusComment(
        456,
        mockContext,
        'gpt-4o',
        'success'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update status comment:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateStatusBody', () => {
    test('should generate complete status body', () => {
      const params = {
        modelName: 'gpt-4o',
        providerInfo: { provider: 'openai' },
        status: 'executing',
        costEstimate: {
          totalCost: '0.0123',
          inputTokens: 2000,
          outputTokens: 800
        },
        context: {
          type: 'issue_comment',
          title: 'Test Issue',
          author: 'test-user'
        },
        details: 'Processing request...'
      };

      const body = commentHandler.generateStatusBody(params);

      expect(body).toContain('🤖 SWE-Agent Status');
      expect(body).toContain('🤖 **Provider:** OPENAI');
      expect(body).toContain('**Model:** `gpt-4o`');
      expect(body).toContain('⚡ **Status:** Executing');
      expect(body).toContain('**Type:** Issue Comment Response');
      expect(body).toContain('**Requested by:** @test-user');
      expect(body).toContain('💰 Cost Estimate');
      expect(body).toContain('$0.0123');
      expect(body).toContain('Processing request...');
    });

    test('should handle missing cost estimate', () => {
      const params = {
        modelName: 'gpt-4o',
        providerInfo: { provider: 'openai' },
        status: 'initializing',
        context: { type: 'issue', title: 'Test' }
      };

      const body = commentHandler.generateStatusBody(params);

      expect(body).toContain('🤖 SWE-Agent Status');
      expect(body).not.toContain('💰 Cost Estimate');
    });
  });

  describe('generateProgressSection', () => {
    test('should show correct progress for different statuses', () => {
      const progressInitializing = commentHandler.generateProgressSection('initializing', '');
      expect(progressInitializing).toContain('✅ Initialize');
      expect(progressInitializing).toContain('🔄 Validate Provider');
      expect(progressInitializing).toContain('⏳ Generate Config');

      const progressExecuting = commentHandler.generateProgressSection('executing', 'Running analysis...');
      expect(progressExecuting).toContain('✅ Initialize');
      expect(progressExecuting).toContain('✅ Validate Provider');
      expect(progressExecuting).toContain('✅ Generate Config');
      expect(progressExecuting).toContain('🔄 Execute SWE-Agent');
      expect(progressExecuting).toContain('Running analysis...');

      const progressSuccess = commentHandler.generateProgressSection('success', '');
      expect(progressSuccess).toContain('✅ Initialize');
      expect(progressSuccess).toContain('✅ Process Results');
    });
  });

  describe('generateCostSection', () => {
    test('should format cost information correctly', () => {
      const costEstimate = {
        inputTokens: 1500,
        outputTokens: 800,
        inputCost: '0.0030',
        outputCost: '0.0016',
        totalCost: '0.0046'
      };

      const section = commentHandler.generateCostSection(costEstimate);

      expect(section).toContain('💰 Cost Estimate');
      expect(section).toContain('| Input Tokens | 1,500 |');
      expect(section).toContain('| Output Tokens | 800 |');
      expect(section).toContain('| Input Cost | $0.0030 |');
      expect(section).toContain('| Output Cost | $0.0016 |');
      expect(section).toContain('| **Total Cost** | **$0.0046** |');
    });
  });

  describe('createErrorComment', () => {
    test('should create error comment with proper formatting', async () => {
      const mockContext = {
        type: 'issue',
        repoOwner: 'test-org',
        repoName: 'test-repo',
        issueNumber: 123
      };

      await commentHandler.createErrorComment(
        mockContext,
        'Provider API key validation failed'
      );

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('❌ SWE-Agent Error')
      });

      const callArgs = mockOctokit.rest.issues.createComment.mock.calls[0][0];
      expect(callArgs.body).toContain('Provider API key validation failed');
      expect(callArgs.body).toContain('documentation');
    });

    test('should handle error comment creation failures', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockOctokit.rest.issues.createComment.mockRejectedValue(new Error('Failed'));

      const mockContext = { type: 'issue', repoOwner: 'test', repoName: 'test', issueNumber: 1 };

      // Should not throw
      await commentHandler.createErrorComment(mockContext, 'Test error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create error comment:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCommentParams', () => {
    test('should return correct params for issue context', () => {
      const context = {
        type: 'issue',
        repoOwner: 'test-org',
        repoName: 'test-repo',
        issueNumber: 123
      };

      const params = commentHandler.getCommentParams(context, 'test body');

      expect(params).toEqual({
        owner: 'test-org',
        repo: 'test-repo',
        issue_number: 123,
        body: 'test body'
      });
    });

    test('should return correct params for PR context', () => {
      const context = {
        type: 'pull_request',
        repoOwner: 'test-org',
        repoName: 'test-repo',
        prNumber: 45
      };

      const params = commentHandler.getCommentParams(context, 'test body');

      expect(params).toEqual({
        owner: 'test-org',
        repo: 'test-repo',
        issue_number: 45, // PRs use issue_number
        body: 'test body'
      });
    });

    test('should throw error for unsupported context type', () => {
      const context = {
        type: 'unsupported',
        repoOwner: 'test-org',
        repoName: 'test-repo'
      };

      expect(() => {
        commentHandler.getCommentParams(context, 'test body');
      }).toThrow('Unsupported context type: unsupported');
    });
  });

  describe('emoji and text helpers', () => {
    test('should return correct status emojis', () => {
      expect(commentHandler.getStatusEmoji('initializing')).toBe('🔄');
      expect(commentHandler.getStatusEmoji('executing')).toBe('⚡');
      expect(commentHandler.getStatusEmoji('success')).toBe('✅');
      expect(commentHandler.getStatusEmoji('failed')).toBe('❌');
      expect(commentHandler.getStatusEmoji('unknown')).toBe('❓');
    });

    test('should return correct provider emojis', () => {
      expect(commentHandler.getProviderEmoji('openai')).toBe('🤖');
      expect(commentHandler.getProviderEmoji('anthropic')).toBe('🧠');
      expect(commentHandler.getProviderEmoji('deepseek')).toBe('🌊');
      expect(commentHandler.getProviderEmoji('groq')).toBe('⚡');
      expect(commentHandler.getProviderEmoji('unknown')).toBe('🤖');
    });

    test('should return correct status text', () => {
      expect(commentHandler.getStatusText('initializing')).toBe('Initializing');
      expect(commentHandler.getStatusText('executing')).toBe('Executing');
      expect(commentHandler.getStatusText('success')).toBe('Completed Successfully');
      expect(commentHandler.getStatusText('failed')).toBe('Failed');
      expect(commentHandler.getStatusText('unknown')).toBe('Unknown');
    });

    test('should return correct task type descriptions', () => {
      expect(commentHandler.getTaskTypeDescription('issue')).toBe('Issue Analysis');
      expect(commentHandler.getTaskTypeDescription('issue_comment')).toBe('Issue Comment Response');
      expect(commentHandler.getTaskTypeDescription('pull_request')).toBe('Pull Request Review');
      expect(commentHandler.getTaskTypeDescription('pr_review_comment')).toBe('PR Comment Response');
      expect(commentHandler.getTaskTypeDescription('custom')).toBe('custom');
    });
  });
});