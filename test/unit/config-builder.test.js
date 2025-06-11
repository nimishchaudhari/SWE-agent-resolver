const ConfigBuilder = require('../../src/config-builder');

describe('ConfigBuilder', () => {
  let configBuilder;

  beforeEach(() => {
    configBuilder = new ConfigBuilder();
    // Clean up environment for consistent tests
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  describe('build', () => {
    it('should build basic configuration with OpenAI', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const inputs = {
        model: 'gpt-4o-mini',
        maxCost: '5.00',
        tools: 'str_replace_editor,bash'
      };

      const config = configBuilder.build(inputs);

      expect(config.model_name).toBe('gpt-4o-mini');
      expect(config.api_key).toBe('test-key');
      expect(config.max_cost).toBe(5.00);
      expect(config.tools).toEqual(['str_replace_editor', 'bash']);
    });

    it('should use default tools when none specified', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const inputs = { model: 'gpt-4o-mini' };
      const config = configBuilder.build(inputs);

      expect(config.tools).toEqual(['str_replace_editor', 'bash', 'file_viewer']);
    });

    it('should throw error when API key is missing', () => {
      const inputs = { model: 'gpt-4o-mini' };
      
      expect(() => configBuilder.build(inputs)).toThrow('OPENAI_API_KEY environment variable is required');
    });
  });

  describe('resolveApiKey', () => {
    it('should resolve OpenAI API key for GPT models', () => {
      process.env.OPENAI_API_KEY = 'openai-key';
      
      const key = configBuilder.resolveApiKey('gpt-4o-mini');
      expect(key).toBe('openai-key');
    });

    it('should resolve Anthropic API key for Claude models', () => {
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      
      const key = configBuilder.resolveApiKey('claude-3-5-sonnet-latest');
      expect(key).toBe('anthropic-key');
    });

    it('should resolve DeepSeek API key for DeepSeek models', () => {
      process.env.DEEPSEEK_API_KEY = 'deepseek-key';
      
      const key = configBuilder.resolveApiKey('deepseek/deepseek-chat');
      expect(key).toBe('deepseek-key');
    });
  });

  describe('parseTools', () => {
    it('should parse comma-separated tools', () => {
      const tools = configBuilder.parseTools('str_replace_editor,bash,file_viewer');
      expect(tools).toEqual(['str_replace_editor', 'bash', 'file_viewer']);
    });

    it('should handle empty tool string', () => {
      const tools = configBuilder.parseTools('');
      expect(tools).toEqual(['str_replace_editor', 'bash', 'file_viewer']);
    });

    it('should filter invalid tools', () => {
      const tools = configBuilder.parseTools('str_replace_editor,invalid_tool,bash');
      expect(tools).toEqual(['str_replace_editor', 'bash', 'file_viewer']);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for known models', () => {
      const cost = configBuilder.estimateCost('gpt-4o-mini', 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1); // Should be reasonable
    });

    it('should use default pricing for unknown models', () => {
      const cost = configBuilder.estimateCost('unknown-model', 1000, 500);
      expect(cost).toBeGreaterThan(0);
    });
  });
});