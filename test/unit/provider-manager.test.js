const ProviderManager = require('../../action/provider-manager');

describe('ProviderManager', () => {
  let providerManager;
  let originalEnv;

  beforeEach(() => {
    providerManager = new ProviderManager();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('detectProvider', () => {
    test('should detect OpenAI provider for gpt models', () => {
      const result = providerManager.detectProvider('gpt-4o');
      expect(result).toEqual({
        provider: 'openai',
        apiKey: 'OPENAI_API_KEY',
        baseUrl: 'https://api.openai.com/v1'
      });
    });

    test('should detect Anthropic provider for claude models', () => {
      const result = providerManager.detectProvider('claude-3-5-sonnet-latest');
      expect(result).toEqual({
        provider: 'anthropic',
        apiKey: 'ANTHROPIC_API_KEY',
        baseUrl: 'https://api.anthropic.com'
      });
    });

    test('should detect DeepSeek provider with prefix', () => {
      const result = providerManager.detectProvider('deepseek/deepseek-chat');
      expect(result).toEqual({
        provider: 'deepseek',
        apiKey: 'DEEPSEEK_API_KEY',
        baseUrl: 'https://api.deepseek.com/v1'
      });
    });

    test('should detect Azure provider', () => {
      const result = providerManager.detectProvider('azure/gpt-4');
      expect(result).toEqual({
        provider: 'azure',
        apiKey: 'AZURE_OPENAI_API_KEY',
        baseUrl: null
      });
    });

    test('should default to OpenAI for unknown models', () => {
      const result = providerManager.detectProvider('unknown-model');
      expect(result).toEqual({
        provider: 'openai',
        apiKey: 'OPENAI_API_KEY',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'unknown-model'
      });
    });

    test('should detect provider from pattern for openrouter models', () => {
      const result = providerManager.detectProvider('openrouter/custom/model');
      expect(result).toEqual({
        provider: 'openrouter',
        apiKey: 'OPENROUTER_API_KEY',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelName: 'openrouter/custom/model'
      });
    });
  });

  describe('validateApiKey', () => {
    test('should validate when API key exists', () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(48);
      const providerInfo = { apiKey: 'OPENAI_API_KEY' };
      const result = providerManager.validateApiKey(providerInfo);
      expect(result).toEqual({ valid: true });
    });

    test('should fail validation when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      const providerInfo = { apiKey: 'OPENAI_API_KEY' };
      const result = providerManager.validateApiKey(providerInfo);
      expect(result).toEqual({
        valid: false,
        error: 'Missing API key: OPENAI_API_KEY',
        suggestion: 'Add OPENAI_API_KEY to your repository secrets'
      });
    });

    test('should validate OpenAI API key format', () => {
      process.env.OPENAI_API_KEY = 'invalid-key';
      const providerInfo = { apiKey: 'OPENAI_API_KEY' };
      const result = providerManager.validateApiKey(providerInfo);
      expect(result).toEqual({
        valid: false,
        error: 'Invalid OPENAI_API_KEY format',
        suggestion: 'Verify your OPENAI_API_KEY format is correct'
      });
    });

    test('should validate Anthropic API key format', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-' + 'a'.repeat(95);
      const providerInfo = { apiKey: 'ANTHROPIC_API_KEY' };
      const result = providerManager.validateApiKey(providerInfo);
      expect(result).toEqual({ valid: true });
    });

    test('should validate Groq API key format', () => {
      process.env.GROQ_API_KEY = 'gsk_' + 'a'.repeat(52);
      const providerInfo = { apiKey: 'GROQ_API_KEY' };
      const result = providerManager.validateApiKey(providerInfo);
      expect(result).toEqual({ valid: true });
    });

    test('should skip format validation for unknown keys', () => {
      process.env.UNKNOWN_API_KEY = 'any-format';
      const providerInfo = { apiKey: 'UNKNOWN_API_KEY' };
      const result = providerManager.validateApiKey(providerInfo);
      expect(result).toEqual({ valid: true });
    });
  });

  describe('generateLiteLLMConfig', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(48);
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
      process.env.AZURE_OPENAI_API_KEY = 'a'.repeat(32);
    });

    test('should generate basic LiteLLM config', () => {
      const result = providerManager.generateLiteLLMConfig('gpt-4o');
      expect(result.config).toEqual({
        model: 'gpt-4o',
        api_key: '$OPENAI_API_KEY',
        temperature: 0.0,
        max_tokens: 4000,
        timeout: 300,
        api_base: 'https://api.openai.com/v1'
      });
      expect(result.providerInfo.provider).toBe('openai');
    });

    test('should generate Azure-specific config', () => {
      const result = providerManager.generateLiteLLMConfig('azure/gpt-4');
      expect(result.config).toEqual({
        model: 'azure/gpt-4',
        api_key: '$AZURE_OPENAI_API_KEY',
        temperature: 0.0,
        max_tokens: 4000,
        timeout: 300,
        api_base: '$AZURE_OPENAI_ENDPOINT',
        api_version: '$AZURE_OPENAI_API_VERSION',
        azure_deployment: 'gpt-4'
      });
    });

    test('should apply custom options', () => {
      const result = providerManager.generateLiteLLMConfig('gpt-4o', {
        temperature: 0.5,
        maxTokens: 2000,
        timeout: 600
      });
      expect(result.config.temperature).toBe(0.5);
      expect(result.config.max_tokens).toBe(2000);
      expect(result.config.timeout).toBe(600);
    });

    test('should throw error for invalid API key', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => {
        providerManager.generateLiteLLMConfig('gpt-4o');
      }).toThrow('Provider validation failed: Missing API key: OPENAI_API_KEY');
    });

    test('should include cost estimate', () => {
      const result = providerManager.generateLiteLLMConfig('gpt-4o', {
        estimatedTokens: 3000
      });
      expect(result.costEstimate).toBeDefined();
      expect(result.costEstimate.provider).toBe('openai');
      expect(result.costEstimate.inputTokens).toBe(2100);
      expect(result.costEstimate.outputTokens).toBe(900);
    });
  });

  describe('getCostEstimate', () => {
    test('should calculate cost for OpenAI', () => {
      const result = providerManager.getCostEstimate('openai', 1000);
      expect(result).toEqual({
        provider: 'openai',
        inputTokens: 700,
        outputTokens: 300,
        inputCost: '0.0010',
        outputCost: '0.0006',
        totalCost: '0.0016',
        currency: 'USD'
      });
    });

    test('should calculate cost for DeepSeek (cheapest)', () => {
      const result = providerManager.getCostEstimate('deepseek', 1000);
      expect(result).toEqual({
        provider: 'deepseek',
        inputTokens: 700,
        outputTokens: 300,
        inputCost: '0.0001',
        outputCost: '0.0001',
        totalCost: '0.0002',
        currency: 'USD'
      });
    });

    test('should use custom costs for unknown provider', () => {
      const result = providerManager.getCostEstimate('unknown', 1000);
      expect(result.provider).toBe('unknown');
      expect(parseFloat(result.totalCost)).toBeLessThan(0.001);
    });
  });

  describe('getFallbackModels', () => {
    test('should return user-specified fallbacks first', () => {
      const result = providerManager.getFallbackModels('gpt-4o', [
        'claude-3-5-sonnet-latest',
        'deepseek/deepseek-chat'
      ]);
      expect(result[0]).toBe('claude-3-5-sonnet-latest');
      expect(result[1]).toBe('deepseek/deepseek-chat');
    });

    test('should include provider defaults', () => {
      const result = providerManager.getFallbackModels('gpt-4o', []);
      expect(result).toContain('gpt-3.5-turbo');
      expect(result).toContain('gpt-4');
    });

    test('should remove current model from fallbacks', () => {
      const result = providerManager.getFallbackModels('gpt-4', ['gpt-4', 'gpt-3.5-turbo']);
      expect(result).not.toContain('gpt-4');
      expect(result).toContain('gpt-3.5-turbo');
    });

    test('should remove duplicates', () => {
      const result = providerManager.getFallbackModels('gpt-4o', [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo'
      ]);
      const gpt35Count = result.filter(m => m === 'gpt-3.5-turbo').length;
      expect(gpt35Count).toBe(1);
    });
  });

  describe('generateStatusMessage', () => {
    test('should generate status message without cost', () => {
      const result = providerManager.generateStatusMessage('gpt-4o', 'processing');
      expect(result).toContain('🤖 **OPENAI** (gpt-4o)');
      expect(result).toContain('📊 Status: processing');
    });

    test('should generate status message with cost', () => {
      const costInfo = { totalCost: '0.0025' };
      const result = providerManager.generateStatusMessage('gpt-4o', 'completed', costInfo);
      expect(result).toContain('Est. Cost: $0.0025');
    });

    test('should use correct emoji for each provider', () => {
      const tests = [
        { model: 'claude-3-5-sonnet-latest', emoji: '🧠' },
        { model: 'deepseek/deepseek-chat', emoji: '🌊' },
        { model: 'groq/llama2-70b-4096', emoji: '⚡' },
        { model: 'azure/gpt-4', emoji: '☁️' }
      ];

      tests.forEach(({ model, emoji }) => {
        const result = providerManager.generateStatusMessage(model, 'test');
        expect(result).toContain(emoji);
      });
    });
  });
});