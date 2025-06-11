const ResultParser = require('../../src/result-parser');

describe('ResultParser', () => {
  let resultParser;

  beforeEach(() => {
    resultParser = new ResultParser();
  });

  describe('parse', () => {
    it('should parse successful SWE-agent result', () => {
      const sweAgentResult = {
        success: true,
        stdout: 'SUMMARY: Fixed authentication bug by updating password validation logic\nstr_replace_editor create auth.js\nModified file: auth.js (+10/-5)',
        stderr: '',
        output: {}
      };

      const metadata = {
        executionTime: 30000,
        model: 'gpt-4o-mini',
        event: { type: 'issue' }
      };

      const result = resultParser.parse(sweAgentResult, metadata);

      expect(result.success).toBe(true);
      expect(result.summary).toContain('Fixed authentication bug');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.executionTime).toBe(30000);
      expect(result.costEstimate).toBeGreaterThan(0);
    });

    it('should parse failed SWE-agent result', () => {
      const sweAgentResult = {
        success: false,
        error: 'Timeout: Command execution exceeded time limit',
        stdout: '',
        stderr: 'Error: timeout'
      };

      const metadata = {
        executionTime: 300000,
        model: 'gpt-4o-mini',
        event: { type: 'issue' }
      };

      const result = resultParser.parse(sweAgentResult, metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
      expect(result.costEstimate).toBeGreaterThan(0);
    });
  });

  describe('extractSummary', () => {
    it('should extract summary from stdout', () => {
      const result = {
        stdout: 'SUMMARY: Fixed bug in authentication module\nOther output here',
        output: {}
      };

      const summary = resultParser.extractSummary(result);
      expect(summary).toBe('Fixed bug in authentication module');
    });

    it('should extract conclusion if no summary', () => {
      const result = {
        stdout: 'CONCLUSION: Successfully refactored the code\nOther output',
        output: {}
      };

      const summary = resultParser.extractSummary(result);
      expect(summary).toBe('Successfully refactored the code');
    });

    it('should provide default summary if none found', () => {
      const result = {
        stdout: 'Some random output without summary',
        output: {}
      };

      const summary = resultParser.extractSummary(result);
      expect(summary).toBe('SWE-agent analysis completed successfully.');
    });
  });

  describe('extractFileChanges', () => {
    it('should extract file changes from stdout', () => {
      const result = {
        stdout: 'str_replace_editor create auth.js\nModified file: login.js\nCreated file: utils.js',
        output: {}
      };

      const changes = resultParser.extractFileChanges(result);
      
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(c => c.path === 'auth.js')).toBe(true);
    });

    it('should handle empty changes', () => {
      const result = {
        stdout: 'No file operations performed',
        output: {}
      };

      const changes = resultParser.extractFileChanges(result);
      expect(changes).toEqual([]);
    });
  });

  describe('estimateCost', () => {
    it('should estimate reasonable cost', () => {
      const result = {
        stdout: 'Some output text that represents tokens',
        stderr: ''
      };

      const cost = resultParser.estimateCost('gpt-4o-mini', result);
      
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1); // Should be reasonable for small output
    });

    it('should have minimum cost floor', () => {
      const result = {
        stdout: '',
        stderr: ''
      };

      const cost = resultParser.estimateCost('gpt-4o-mini', result);
      expect(cost).toBeGreaterThanOrEqual(0.0001);
    });
  });
});