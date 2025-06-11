/**
 * Configuration Builder
 * Simple SWE-agent configuration generation
 */

const logger = require('../utils/logger');

class ConfigBuilder {
  build(inputs) {
    const config = {
      model_name: inputs.model || 'gpt-4o-mini',
      api_key: this.resolveApiKey(inputs.model),
      tools: this.parseTools(inputs.tools),
      max_cost: parseFloat(inputs.maxCost) || 5.00,
      max_iterations: 30,
      verbose: inputs.debugMode || false
    };
    
    // Validate configuration
    this.validateConfig(config);
    
    logger.info('Configuration built', { 
      model: config.model_name,
      tools: config.tools.length,
      maxCost: config.max_cost 
    });
    
    return config;
  }

  resolveApiKey(modelName) {
    const model = modelName || 'gpt-4o-mini';
    
    // OpenAI models
    if (model.includes('gpt') || model.includes('o1')) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY environment variable is required for OpenAI models');
      return key;
    }
    
    // Anthropic models
    if (model.includes('claude')) {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic models');
      return key;
    }
    
    // DeepSeek models
    if (model.includes('deepseek')) {
      const key = process.env.DEEPSEEK_API_KEY;
      if (!key) throw new Error('DEEPSEEK_API_KEY environment variable is required for DeepSeek models');
      return key;
    }
    
    // Groq models
    if (model.includes('groq') || model.includes('llama') || model.includes('mixtral')) {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error('GROQ_API_KEY environment variable is required for Groq models');
      return key;
    }
    
    // OpenRouter models
    if (model.includes('openrouter') || model.includes('/')) {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error('OPENROUTER_API_KEY environment variable is required for OpenRouter models');
      return key;
    }
    
    // Azure OpenAI
    if (model.includes('azure')) {
      const key = process.env.AZURE_OPENAI_API_KEY;
      if (!key) throw new Error('AZURE_OPENAI_API_KEY environment variable is required for Azure OpenAI');
      return key;
    }
    
    // Default to OpenAI
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY environment variable is required');
    return key;
  }

  parseTools(toolsInput) {
    // Default SWE-agent tools
    const defaultTools = [
      'str_replace_editor',
      'bash',
      'file_viewer'
    ];
    
    if (!toolsInput || toolsInput.trim() === '') {
      return defaultTools;
    }
    
    // Parse comma-separated tools
    const tools = toolsInput.split(',')
      .map(tool => tool.trim())
      .filter(tool => tool.length > 0);
    
    if (tools.length === 0) {
      return defaultTools;
    }
    
    // Validate tools
    const validTools = [
      'str_replace_editor',
      'bash',
      'file_viewer',
      'python_executor',
      'web_browser',
      'file_manager'
    ];
    
    const invalidTools = tools.filter(tool => !validTools.includes(tool));
    if (invalidTools.length > 0) {
      logger.warn('Invalid tools specified, using defaults', { 
        invalid: invalidTools,
        valid: validTools 
      });
      return defaultTools;
    }
    
    return tools;
  }

  validateConfig(config) {
    if (!config.model_name) {
      throw new Error('Model name is required');
    }
    
    if (!config.api_key) {
      throw new Error('API key is required');
    }
    
    if (!Array.isArray(config.tools) || config.tools.length === 0) {
      throw new Error('At least one tool must be specified');
    }
    
    if (isNaN(config.max_cost) || config.max_cost <= 0) {
      throw new Error('Max cost must be a positive number');
    }
    
    if (config.max_cost > 50) {
      logger.warn('High max cost specified', { maxCost: config.max_cost });
    }
  }

  estimateCost(model, inputTokens = 1000, outputTokens = 500) {
    // Rough cost estimates per 1K tokens (input/output)
    const pricing = {
      // OpenAI
      'gpt-4o-mini': [0.00015, 0.0006],
      'gpt-4o': [0.005, 0.015],
      'gpt-3.5-turbo': [0.0015, 0.002],
      
      // Anthropic
      'claude-3-5-sonnet-latest': [0.003, 0.015],
      'claude-3-haiku': [0.00025, 0.00125],
      
      // DeepSeek
      'deepseek/deepseek-chat': [0.0002, 0.0002],
      'deepseek/deepseek-coder': [0.0002, 0.0002],
      
      // Groq (often free or very cheap)
      'groq/llama2-70b-4096': [0.00007, 0.00008],
      'groq/mixtral-8x7b-32768': [0.00024, 0.00024]
    };
    
    const [inputPrice, outputPrice] = pricing[model] || [0.001, 0.002]; // Default pricing
    
    const inputCost = (inputTokens / 1000) * inputPrice;
    const outputCost = (outputTokens / 1000) * outputPrice;
    
    return inputCost + outputCost;
  }
}

module.exports = ConfigBuilder;