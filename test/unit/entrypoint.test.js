const SWEAgentAction = require('../../action/entrypoint');

// Mock the dependencies
jest.mock('../../action/swe-agent-runner');
jest.mock('../../action/github-integration');
jest.mock('../../src/config-builder');
jest.mock('../../utils/logger');
jest.mock('@actions/core');
jest.mock('@actions/github');

const mockCore = require('@actions/core');
const mockGithub = require('@actions/github');

describe('SWEAgentAction', () => {
  let action;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock core inputs
    mockCore.getInput.mockImplementation((name) => {
      const inputs = {
        'model_name': 'gpt-4o-mini',
        'trigger_phrase': '@swe-agent',
        'max_cost': '5.00',
        'tools': 'str_replace_editor,bash',
        'debug_mode': 'false'
      };
      return inputs[name] || '';
    });

    // Mock GitHub context
    mockGithub.context = {
      eventName: 'issue_comment',
      payload: {
        comment: { body: '@swe-agent help with this bug' },
        issue: { number: 123, title: 'Test issue' },
        repository: { full_name: 'test/repo' }
      },
      repo: { owner: 'test', repo: 'repo' },
      actor: 'testuser'
    };

    action = new SWEAgentAction();
  });

  describe('constructor', () => {
    it('should initialize with correct inputs', () => {
      expect(action.inputs.model).toBe('gpt-4o-mini');
      expect(action.inputs.triggerPhrase).toBe('@swe-agent');
      expect(action.inputs.maxCost).toBe(5.00);
      expect(action.inputs.tools).toBe('str_replace_editor,bash');
    });

    it('should initialize GitHub context', () => {
      expect(action.context.eventName).toBe('issue_comment');
      expect(action.context.repository.owner).toBe('test');
    });
  });

  describe('parseGitHubEvent', () => {
    it('should parse issue comment event', () => {
      const event = action.parseGitHubEvent();

      expect(event.type).toBe('issue_comment');
      expect(event.trigger).toBe('@swe-agent help with this bug');
      expect(event.issueNumber).toBe(123);
    });

    it('should parse issues event', () => {
      mockGithub.context.eventName = 'issues';
      mockGithub.context.payload = {
        action: 'opened',
        issue: { number: 456, title: 'New issue' },
        repository: { full_name: 'test/repo' }
      };

      action = new SWEAgentAction();
      const event = action.parseGitHubEvent();

      expect(event.type).toBe('issue');
      expect(event.issueNumber).toBe(456);
    });

    it('should throw error for unsupported event type', () => {
      mockGithub.context.eventName = 'push';
      action = new SWEAgentAction();

      expect(() => action.parseGitHubEvent()).toThrow('Unsupported event type: push');
    });
  });

  describe('shouldProcess', () => {
    it('should process issue comment with trigger phrase', () => {
      const event = {
        type: 'issue_comment',
        trigger: '@swe-agent help with this'
      };

      expect(action.shouldProcess(event)).toBe(true);
    });

    it('should not process issue comment without trigger phrase', () => {
      const event = {
        type: 'issue_comment',
        trigger: 'regular comment without trigger'
      };

      expect(action.shouldProcess(event)).toBe(false);
    });

    it('should process new issues', () => {
      mockGithub.context.payload.action = 'opened';
      action = new SWEAgentAction();

      const event = { type: 'issue' };
      expect(action.shouldProcess(event)).toBe(true);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format API key error', () => {
      const error = new Error('Missing API key for OpenAI');
      const message = action.formatErrorMessage(error);

      expect(message).toContain('Configuration Error');
      expect(message).toContain('API key');
    });

    it('should format timeout error', () => {
      const error = new Error('Command timeout exceeded');
      const message = action.formatErrorMessage(error);

      expect(message).toContain('Timeout');
    });

    it('should format permission error', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      const message = action.formatErrorMessage(error);

      expect(message).toContain('Permission Error');
    });

    it('should format generic error', () => {
      const error = new Error('Something went wrong');
      const message = action.formatErrorMessage(error);

      expect(message).toContain('Execution Error');
      expect(message).toContain('Something went wrong');
    });
  });
});
