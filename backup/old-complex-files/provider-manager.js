/**
 * LiteLLM Provider Manager
 * Handles AI provider detection, API key mapping, and model validation
 */

class ProviderManager {
  constructor() {
    this.providerMappings = {
      // OpenAI models
      'gpt-4': { provider: 'openai', apiKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
      'gpt-4-turbo': { provider: 'openai', apiKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
      'gpt-4o': { provider: 'openai', apiKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
      'gpt-3.5-turbo': { provider: 'openai', apiKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
      
      // Anthropic models
      'claude-3-5-sonnet-latest': { provider: 'anthropic', apiKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com' },
      'claude-3-5-sonnet-20241022': { provider: 'anthropic', apiKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com' },
      'claude-3-haiku-20240307': { provider: 'anthropic', apiKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com' },
      'claude-3-opus-20240229': { provider: 'anthropic', apiKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com' },
      
      // Azure OpenAI models (custom naming)
      'azure/gpt-4': { provider: 'azure', apiKey: 'AZURE_OPENAI_API_KEY', baseUrl: null }, // Will use AZURE_OPENAI_ENDPOINT
      'azure/gpt-35-turbo': { provider: 'azure', apiKey: 'AZURE_OPENAI_API_KEY', baseUrl: null },
      
      // DeepSeek models
      'deepseek/deepseek-chat': { provider: 'deepseek', apiKey: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com/v1' },
      'deepseek/deepseek-coder': { provider: 'deepseek', apiKey: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com/v1' },
      
      // OpenRouter models
      'openrouter/qwen/qwen-32b': { provider: 'openrouter', apiKey: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1' },
      'openrouter/anthropic/claude-3.5-sonnet': { provider: 'openrouter', apiKey: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1' },
      'openrouter/openai/gpt-4': { provider: 'openrouter', apiKey: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1' },
      
      // Together AI models
      'together/meta-llama/Llama-2-70b-chat-hf': { provider: 'together', apiKey: 'TOGETHER_API_KEY', baseUrl: 'https://api.together.xyz/v1' },
      'together/codellama/CodeLlama-34b-Instruct-hf': { provider: 'together', apiKey: 'TOGETHER_API_KEY', baseUrl: 'https://api.together.xyz/v1' },
      
      // Groq models
      'groq/llama2-70b-4096': { provider: 'groq', apiKey: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1' },
      'groq/mixtral-8x7b-32768': { provider: 'groq', apiKey: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1' },
      
      // Mistral models
      'mistral/mistral-large-latest': { provider: 'mistral', apiKey: 'MISTRAL_API_KEY', baseUrl: 'https://api.mistral.ai/v1' },
      'mistral/mistral-medium': { provider: 'mistral', apiKey: 'MISTRAL_API_KEY', baseUrl: 'https://api.mistral.ai/v1' },
      
      // Cohere models
      'cohere/command': { provider: 'cohere', apiKey: 'COHERE_API_KEY', baseUrl: 'https://api.cohere.ai/v1' },
      'cohere/command-r': { provider: 'cohere', apiKey: 'COHERE_API_KEY', baseUrl: 'https://api.cohere.ai/v1' },
      
      // Perplexity models
      'perplexity/llama-3-sonar-large-32k-online': { provider: 'perplexity', apiKey: 'PERPLEXITY_API_KEY', baseUrl: 'https://api.perplexity.ai' },
      'perplexity/llama-3-sonar-small-32k-chat': { provider: 'perplexity', apiKey: 'PERPLEXITY_API_KEY', baseUrl: 'https://api.perplexity.ai' },
      
      // Anyscale models
      'anyscale/meta-llama/Llama-2-70b-chat-hf': { provider: 'anyscale', apiKey: 'ANYSCALE_API_KEY', baseUrl: 'https://api.endpoints.anyscale.com/v1' },
      
      // Custom/Local models
      'custom/local-model': { provider: 'custom', apiKey: 'CUSTOM_LLM_API_KEY', baseUrl: null } // Will use CUSTOM_LLM_BASE_URL
    };

    // Provider cost estimates (per 1K tokens)
    this.costEstimates = {
      'openai': { input: 0.0015, output: 0.002 },
      'anthropic': { input: 0.003, output: 0.015 },
      'azure': { input: 0.0015, output: 0.002 },
      'deepseek': { input: 0.00014, output: 0.00028 },
      'openrouter': { input: 0.002, output: 0.004 },
      'together': { input: 0.0008, output: 0.0008 },
      'groq': { input: 0.00027, output: 0.00027 },
      'mistral': { input: 0.002, output: 0.006 },
      'cohere': { input: 0.0015, output: 0.002 },
      'perplexity': { input: 0.001, output: 0.001 },
      'anyscale': { input: 0.0015, output: 0.002 },
      'custom': { input: 0.0001, output: 0.0001 }
    };
  }

  /**
   * Detect provider from model name
   * @param {string} modelName - LiteLLM model identifier
   * @returns {Object} Provider information
   */
  detectProvider(modelName) {
    // Direct mapping first
    if (this.providerMappings[modelName]) {
      return this.providerMappings[modelName];
    }

    // Pattern-based detection for provider prefixes
    const patterns = [
      { pattern: /^openrouter\//, provider: 'openrouter', apiKey: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1' },
      { pattern: /^deepseek\//, provider: 'deepseek', apiKey: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com/v1' },
      { pattern: /^together\//, provider: 'together', apiKey: 'TOGETHER_API_KEY', baseUrl: 'https://api.together.xyz/v1' },
      { pattern: /^groq\//, provider: 'groq', apiKey: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1' },
      { pattern: /^mistral\//, provider: 'mistral', apiKey: 'MISTRAL_API_KEY', baseUrl: 'https://api.mistral.ai/v1' },
      { pattern: /^cohere\//, provider: 'cohere', apiKey: 'COHERE_API_KEY', baseUrl: 'https://api.cohere.ai/v1' },
      { pattern: /^perplexity\//, provider: 'perplexity', apiKey: 'PERPLEXITY_API_KEY', baseUrl: 'https://api.perplexity.ai' },
      { pattern: /^anyscale\//, provider: 'anyscale', apiKey: 'ANYSCALE_API_KEY', baseUrl: 'https://api.endpoints.anyscale.com/v1' },
      { pattern: /^azure\//, provider: 'azure', apiKey: 'AZURE_OPENAI_API_KEY', baseUrl: null },
      { pattern: /^custom\//, provider: 'custom', apiKey: 'CUSTOM_LLM_API_KEY', baseUrl: null },
      { pattern: /^gpt-/, provider: 'openai', apiKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
      { pattern: /^claude-/, provider: 'anthropic', apiKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com' }
    ];

    for (const { pattern, provider, apiKey, baseUrl } of patterns) {
      if (pattern.test(modelName)) {
        return { provider, apiKey, baseUrl, modelName };
      }
    }

    // Default to OpenAI if no pattern matches
    return { 
      provider: 'openai', 
      apiKey: 'OPENAI_API_KEY', 
      baseUrl: 'https://api.openai.com/v1',
      modelName 
    };
  }

  /**
   * Validate API key availability for a provider
   * @param {Object} providerInfo - Provider information
   * @returns {Object} Validation result
   */
  validateApiKey(providerInfo) {
    const apiKey = process.env[providerInfo.apiKey];
    
    if (!apiKey) {
      return {
        valid: false,
        error: `Missing API key: ${providerInfo.apiKey}`,
        suggestion: `Add ${providerInfo.apiKey} to your repository secrets`
      };
    }

    // Basic format validation
    const validationRules = {
      'OPENAI_API_KEY': /^sk-[a-zA-Z0-9\-_]{48,}$|^sk-proj-[a-zA-Z0-9\-_]{120,}$/,
      'ANTHROPIC_API_KEY': /^sk-ant-[a-zA-Z0-9\-_]{95,}$/,
      'AZURE_OPENAI_API_KEY': /^[a-f0-9]{32}$/,
      'DEEPSEEK_API_KEY': /^sk-[a-zA-Z0-9]{48,}$/,
      'OPENROUTER_API_KEY': /^sk-or-[a-zA-Z0-9\-_]{48,}$/,
      'GROQ_API_KEY': /^gsk_[a-zA-Z0-9]{52}$/,
      'TOGETHER_API_KEY': /^[a-f0-9]{64}$/,
      'MISTRAL_API_KEY': /^[a-zA-Z0-9]{32}$/
    };

    const rule = validationRules[providerInfo.apiKey];
    if (rule && !rule.test(apiKey)) {
      return {
        valid: false,
        error: `Invalid ${providerInfo.apiKey} format`,
        suggestion: `Verify your ${providerInfo.apiKey} format is correct`
      };
    }

    return { valid: true };
  }

  /**
   * Generate LiteLLM configuration for SWE-agent
   * @param {string} modelName - Model identifier
   * @param {Object} options - Additional configuration options
   * @returns {Object} LiteLLM configuration
   */
  generateLiteLLMConfig(modelName, options = {}) {
    const providerInfo = this.detectProvider(modelName);
    const validation = this.validateApiKey(providerInfo);

    if (!validation.valid) {
      throw new Error(`Provider validation failed: ${validation.error}. ${validation.suggestion}`);
    }

    // Base configuration
    const config = {
      model: modelName,
      api_key: `$${providerInfo.apiKey}`,
      temperature: options.temperature || 0.0,
      max_tokens: options.maxTokens || 4000,
      timeout: options.timeout || 300
    };

    // Add provider-specific configurations
    switch (providerInfo.provider) {
      case 'azure':
        config.api_base = `$AZURE_OPENAI_ENDPOINT`;
        config.api_version = `$AZURE_OPENAI_API_VERSION`;
        config.azure_deployment = modelName.replace('azure/', '');
        break;
        
      case 'custom':
        config.api_base = `$CUSTOM_LLM_BASE_URL`;
        break;
        
      default:
        if (providerInfo.baseUrl) {
          config.api_base = providerInfo.baseUrl;
        }
    }

    return {
      config,
      providerInfo,
      costEstimate: this.getCostEstimate(providerInfo.provider, options.estimatedTokens || 2000)
    };
  }

  /**
   * Get cost estimate for provider
   * @param {string} provider - Provider name
   * @param {number} estimatedTokens - Estimated token usage
   * @returns {Object} Cost estimate
   */
  getCostEstimate(provider, estimatedTokens) {
    const costs = this.costEstimates[provider] || this.costEstimates.custom;
    const inputTokens = Math.floor(estimatedTokens * 0.7);
    const outputTokens = Math.floor(estimatedTokens * 0.3);
    
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    const totalCost = inputCost + outputCost;

    return {
      provider,
      inputTokens,
      outputTokens,
      inputCost: inputCost.toFixed(4),
      outputCost: outputCost.toFixed(4),
      totalCost: totalCost.toFixed(4),
      currency: 'USD'
    };
  }

  /**
   * Get fallback models for a provider
   * @param {string} currentModel - Current model that failed
   * @param {string[]} fallbackModels - User-specified fallbacks
   * @returns {string[]} Ordered list of fallback models
   */
  getFallbackModels(currentModel, fallbackModels = []) {
    const currentProvider = this.detectProvider(currentModel);
    const defaultFallbacks = {
      'openai': ['gpt-3.5-turbo', 'gpt-4'],
      'anthropic': ['claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
      'azure': ['azure/gpt-35-turbo', 'azure/gpt-4'],
      'deepseek': ['deepseek/deepseek-chat', 'deepseek/deepseek-coder'],
      'openrouter': ['openrouter/anthropic/claude-3.5-sonnet', 'openrouter/openai/gpt-4'],
      'together': ['together/meta-llama/Llama-2-70b-chat-hf'],
      'groq': ['groq/llama2-70b-4096', 'groq/mixtral-8x7b-32768']
    };

    // Combine user fallbacks with provider defaults
    const providerDefaults = defaultFallbacks[currentProvider.provider] || [];
    const allFallbacks = [...fallbackModels, ...providerDefaults];
    
    // Remove current model and duplicates
    return [...new Set(allFallbacks.filter(model => model !== currentModel))];
  }

  /**
   * Generate provider status message for comments
   * @param {string} modelName - Model being used
   * @param {string} status - Current status
   * @param {Object} costInfo - Cost information
   * @returns {string} Formatted status message
   */
  generateStatusMessage(modelName, status, costInfo = null) {
    const providerInfo = this.detectProvider(modelName);
    const providerEmoji = {
      'openai': '🤖',
      'anthropic': '🧠',
      'azure': '☁️',
      'deepseek': '🌊',
      'openrouter': '🔀',
      'together': '🤝',
      'groq': '⚡',
      'mistral': '🌀',
      'cohere': '🔗',
      'perplexity': '🔍',
      'anyscale': '📈',
      'custom': '🛠️'
    };

    const emoji = providerEmoji[providerInfo.provider] || '🤖';
    let message = `${emoji} **${providerInfo.provider.toUpperCase()}** (${modelName})`;
    
    if (costInfo) {
      message += ` - Est. Cost: $${costInfo.totalCost}`;
    }
    
    message += `\n📊 Status: ${status}`;
    
    return message;
  }
}

module.exports = ProviderManager;