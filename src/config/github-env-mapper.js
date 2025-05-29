const logger = require('../utils/logger');

/**
 * GitHub Environment Variables and Secrets Mapper
 * Maps GitHub Actions repository variables and secrets to SWE-agent configuration
 */
class GitHubEnvMapper {
  constructor() {
    // Repository secrets mapping for API keys and sensitive data
    this.secretsMapping = {
      // Model API Keys
      'ANTHROPIC_API_KEY': 'agent.model.api_key',
      'OPENAI_API_KEY': 'agent.model.api_key', 
      'AZURE_OPENAI_API_KEY': 'agent.model.api_key',
      'GOOGLE_API_KEY': 'agent.model.api_key',
      'HUGGINGFACE_API_KEY': 'agent.model.api_key',
      
      // GitHub Access
      'GITHUB_TOKEN': 'env.github.token',
      'GH_TOKEN': 'env.github.token',
      
      // Database/Storage
      'DATABASE_URL': 'env.database.url',
      'REDIS_URL': 'env.cache.url',
      'AWS_ACCESS_KEY_ID': 'env.aws.access_key',
      'AWS_SECRET_ACCESS_KEY': 'env.aws.secret_key',
      
      // Deployment specific
      'MODAL_TOKEN': 'env.modal.token',
      'MODAL_TOKEN_ID': 'env.modal.token_id',
      'MODAL_TOKEN_SECRET': 'env.modal.token_secret',
      'DOCKER_REGISTRY_TOKEN': 'env.docker.token',
      
      // Webhook security
      'WEBHOOK_SECRET': 'env.webhook.secret',
      'GITHUB_WEBHOOK_SECRET': 'env.webhook.secret'
    };

    // Repository variables mapping for configuration options
    this.variablesMapping = {
      // Model selection and configuration
      'SWE_AGENT_MODEL': 'agent.model.name',
      'SWE_AGENT_MODEL_PROVIDER': 'agent.model.provider',
      'SWE_AGENT_TEMPERATURE': 'agent.model.temperature',
      'SWE_AGENT_MAX_TOKENS': 'agent.model.max_tokens',
      'SWE_AGENT_TIMEOUT': 'agent.model.timeout',
      
      // Parser configuration
      'SWE_AGENT_PARSER': 'agent.parser.name',
      'SWE_AGENT_PARSER_MODE': 'agent.parser.mode',
      'ENABLE_FUNCTION_CALLING': 'agent.parser.function_calling',
      
      // History processors
      'HISTORY_PROCESSOR': 'agent.history_processor.name',
      'HISTORY_WINDOW_SIZE': 'agent.history_processor.window_size',
      'ENABLE_HISTORY_COMPRESSION': 'agent.history_processor.compression',
      
      // Environment settings
      'WORKSPACE_MOUNT_PATH': 'env.workspace.mount_path',
      'REPO_PATH': 'env.repo.path',
      'BASE_COMMIT': 'env.repo.base_commit',
      'SPLIT_PATCH_WORK': 'env.repo.split_patch',
      
      // Performance and limits
      'MAX_COST_LIMIT': 'performance.cost_limit',
      'MEMORY_LIMIT': 'performance.memory_limit',
      'CPU_LIMIT': 'performance.cpu_limit',
      'PARALLEL_JOBS': 'performance.parallel_jobs',
      'REQUEST_TIMEOUT': 'performance.request_timeout',
      
      // Deployment preferences
      'DEPLOYMENT_MODE': 'deployment.mode',
      'ENABLE_DOCKER': 'deployment.docker.enabled',
      'ENABLE_MODAL': 'deployment.modal.enabled',
      'DOCKER_IMAGE': 'deployment.docker.image',
      'MODAL_ENVIRONMENT': 'deployment.modal.environment',
      
      // Tool configuration
      'ENABLE_BASH_TOOL': 'tools.bash.enabled',
      'ENABLE_EDITOR_TOOL': 'tools.editor.enabled',
      'EDITOR_TOOL_NAME': 'tools.editor.name',
      'ENABLE_FILE_OPERATIONS': 'tools.file_ops.enabled',
      
      // Logging and debugging
      'LOG_LEVEL': 'logging.level',
      'ENABLE_VERBOSE_LOGGING': 'logging.verbose',
      'LOG_FORMAT': 'logging.format',
      'ENABLE_TELEMETRY': 'logging.telemetry'
    };

    // Default values for common configurations
    this.defaults = {
      'agent.model.name': 'claude-3-5-sonnet-20241022',
      'agent.model.provider': 'anthropic',
      'agent.model.temperature': 0.0,
      'agent.model.max_tokens': 8192,
      'agent.model.timeout': 300000,
      'agent.parser.name': 'ToolCallingParser',
      'agent.parser.mode': 'function_calling',
      'agent.parser.function_calling': true,
      'agent.history_processor.name': 'DefaultHistoryProcessor',
      'agent.history_processor.window_size': 4000,
      'agent.history_processor.compression': false,
      'env.workspace.mount_path': '/tmp/swe-agent-workspace',
      'env.repo.split_patch': false,
      'performance.cost_limit': 10.0,
      'performance.memory_limit': '4GB',
      'performance.cpu_limit': 2,
      'performance.parallel_jobs': 1,
      'performance.request_timeout': 30000,
      'tools.bash.enabled': true,
      'tools.editor.enabled': true,
      'tools.editor.name': 'str_replace_editor',
      'tools.file_ops.enabled': true,
      'logging.level': 'INFO',
      'logging.verbose': false,
      'logging.format': 'json',
      'logging.telemetry': false
    };

    // Model provider configurations
    this.modelProviders = {
      'anthropic': {
        api_key_env: 'ANTHROPIC_API_KEY',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        supports_function_calling: true,
        default_parser: 'ToolCallingParser',
        max_tokens: 8192,
        cost_per_1k_tokens: { input: 0.003, output: 0.015 }
      },
      'openai': {
        api_key_env: 'OPENAI_API_KEY',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        supports_function_calling: true,
        default_parser: 'ToolCallingParser',
        max_tokens: 4096,
        cost_per_1k_tokens: { input: 0.01, output: 0.03 }
      },
      'azure': {
        api_key_env: 'AZURE_OPENAI_API_KEY',
        models: ['gpt-4', 'gpt-35-turbo'],
        supports_function_calling: true,
        default_parser: 'ToolCallingParser',
        max_tokens: 4096,
        requires_additional_config: ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_DEPLOYMENT']
      },
      'google': {
        api_key_env: 'GOOGLE_API_KEY',
        models: ['gemini-pro', 'gemini-pro-vision'],
        supports_function_calling: true,
        default_parser: 'ToolCallingParser',
        max_tokens: 2048,
        cost_per_1k_tokens: { input: 0.001, output: 0.002 }
      },
      'local': {
        api_key_env: null,
        models: ['ollama/llama2', 'ollama/codellama', 'local/custom'],
        supports_function_calling: false,
        default_parser: 'ThoughtActionParser',
        max_tokens: 2048,
        cost_per_1k_tokens: { input: 0, output: 0 }
      }
    };

    // API key rotation for high-parallelism scenarios
    this.apiKeyRotation = {
      'anthropic': [],
      'openai': [],
      'azure': [],
      'google': []
    };
  }

  /**
   * Map GitHub environment variables to SWE-agent configuration
   * @param {object} githubContext - GitHub Actions context
   * @returns {object} Mapped configuration object
   */
  mapEnvironmentToConfig(githubContext = {}) {
    const config = {};
    const env = process.env;
    const errors = [];
    const warnings = [];

    try {
      // Map repository secrets
      const secretsConfig = this.mapSecrets(env, errors);
      Object.assign(config, secretsConfig);

      // Map repository variables  
      const variablesConfig = this.mapVariables(env, warnings);
      Object.assign(config, variablesConfig);

      // Apply defaults for missing values
      const defaultsConfig = this.applyDefaults(config);
      Object.assign(config, defaultsConfig);

      // Setup API key rotation
      this.setupApiKeyRotation(env);

      // Add GitHub context
      config.github = this.mapGitHubContext(githubContext);

      // Validate the final configuration
      const validation = this.validateMappedConfig(config);
      if (!validation.valid) {
        errors.push(...validation.errors);
      }

      return {
        config,
        errors,
        warnings,
        metadata: {
          mapped_at: new Date().toISOString(),
          source: 'github_environment',
          api_keys_available: this.getAvailableApiKeys(env),
          model_provider: this.detectModelProvider(config),
          deployment_mode: this.detectDeploymentMode(config)
        }
      };

    } catch (error) {
      logger.error('Environment mapping failed:', error);
      errors.push(`Environment mapping failed: ${error.message}`);
      
      return {
        config: this.getMinimalConfig(),
        errors,
        warnings,
        metadata: {
          mapped_at: new Date().toISOString(),
          source: 'fallback',
          status: 'error'
        }
      };
    }
  }

  /**
   * Map repository secrets to configuration
   */
  mapSecrets(env, errors) {
    const config = {};
    
    for (const [envKey, configPath] of Object.entries(this.secretsMapping)) {
      if (env[envKey]) {
        this.setNestedValue(config, configPath, env[envKey]);
        logger.debug(`Mapped secret ${envKey} -> ${configPath}`);
      }
    }

    // Validate required secrets
    const requiredSecrets = this.getRequiredSecrets(env);
    const missingSecrets = requiredSecrets.filter(secret => !env[secret]);
    
    if (missingSecrets.length > 0) {
      errors.push(`Missing required secrets: ${missingSecrets.join(', ')}`);
    }

    return config;
  }

  /**
   * Map repository variables to configuration
   */
  mapVariables(env, warnings) {
    const config = {};
    
    for (const [envKey, configPath] of Object.entries(this.variablesMapping)) {
      if (env[envKey]) {
        const value = this.parseEnvironmentValue(env[envKey], configPath);
        this.setNestedValue(config, configPath, value);
        logger.debug(`Mapped variable ${envKey} -> ${configPath} = ${value}`);
      }
    }

    return config;
  }

  /**
   * Apply default values for missing configuration
   */
  applyDefaults(config) {
    const defaultsConfig = {};
    
    for (const [configPath, defaultValue] of Object.entries(this.defaults)) {
      if (!this.getNestedValue(config, configPath)) {
        this.setNestedValue(defaultsConfig, configPath, defaultValue);
      }
    }

    return defaultsConfig;
  }

  /**
   * Setup API key rotation for rate limiting management
   */
  setupApiKeyRotation(env) {
    // Clear existing rotation
    Object.keys(this.apiKeyRotation).forEach(provider => {
      this.apiKeyRotation[provider] = [];
    });

    // Detect multiple API keys for each provider
    for (const provider of Object.keys(this.modelProviders)) {
      const baseKey = this.modelProviders[provider].api_key_env;
      if (!baseKey) continue;

      // Primary key
      if (env[baseKey]) {
        this.apiKeyRotation[provider].push(env[baseKey]);
      }

      // Secondary keys (numbered suffixes)
      for (let i = 2; i <= 10; i++) {
        const altKey = `${baseKey}_${i}`;
        if (env[altKey]) {
          this.apiKeyRotation[provider].push(env[altKey]);
        }
      }

      if (this.apiKeyRotation[provider].length > 1) {
        logger.info(`API key rotation setup for ${provider}: ${this.apiKeyRotation[provider].length} keys`);
      }
    }
  }

  /**
   * Get rotated API key for rate limit management
   */
  getRotatedApiKey(provider, index = 0) {
    const keys = this.apiKeyRotation[provider];
    if (keys.length === 0) return null;
    
    return keys[index % keys.length];
  }

  /**
   * Map GitHub Actions context
   */
  mapGitHubContext(githubContext) {
    return {
      repository: githubContext.repository || process.env.GITHUB_REPOSITORY,
      ref: githubContext.ref || process.env.GITHUB_REF,
      sha: githubContext.sha || process.env.GITHUB_SHA,
      actor: githubContext.actor || process.env.GITHUB_ACTOR,
      workflow: githubContext.workflow || process.env.GITHUB_WORKFLOW,
      run_id: githubContext.run_id || process.env.GITHUB_RUN_ID,
      run_number: githubContext.run_number || process.env.GITHUB_RUN_NUMBER,
      job: githubContext.job || process.env.GITHUB_JOB,
      event_name: githubContext.event_name || process.env.GITHUB_EVENT_NAME,
      workspace: githubContext.workspace || process.env.GITHUB_WORKSPACE,
      server_url: process.env.GITHUB_SERVER_URL || 'https://github.com',
      api_url: process.env.GITHUB_API_URL || 'https://api.github.com'
    };
  }

  /**
   * Detect the model provider from configuration
   */
  detectModelProvider(config) {
    const modelName = this.getNestedValue(config, 'agent.model.name');
    const explicitProvider = this.getNestedValue(config, 'agent.model.provider');
    
    if (explicitProvider) return explicitProvider;
    
    if (modelName) {
      for (const [provider, info] of Object.entries(this.modelProviders)) {
        if (info.models.some(model => modelName.includes(model) || model.includes(modelName))) {
          return provider;
        }
      }
    }
    
    // Fallback to available API keys
    for (const [provider, info] of Object.entries(this.modelProviders)) {
      if (info.api_key_env && process.env[info.api_key_env]) {
        return provider;
      }
    }
    
    return 'anthropic'; // Default fallback
  }

  /**
   * Detect deployment mode from environment
   */
  detectDeploymentMode(config) {
    const explicitMode = this.getNestedValue(config, 'deployment.mode');
    if (explicitMode) return explicitMode;

    // Auto-detect from environment
    if (process.env.MODAL_TOKEN || process.env.MODAL_TOKEN_ID) {
      return 'modal';
    }
    if (process.env.DOCKER_REGISTRY_TOKEN || process.env.GITHUB_ACTIONS) {
      return 'docker';
    }
    
    return 'local';
  }

  /**
   * Get required secrets based on configuration
   */
  getRequiredSecrets(env) {
    const required = ['GITHUB_TOKEN']; // Always required
    
    // Add model API key requirement
    const provider = this.detectModelProvider({ agent: { model: { provider: env.SWE_AGENT_MODEL_PROVIDER } } });
    const providerInfo = this.modelProviders[provider];
    
    if (providerInfo?.api_key_env) {
      required.push(providerInfo.api_key_env);
    }

    // Add deployment-specific requirements
    if (env.DEPLOYMENT_MODE === 'modal' || env.ENABLE_MODAL === 'true') {
      required.push('MODAL_TOKEN');
    }

    return required;
  }

  /**
   * Get available API keys
   */
  getAvailableApiKeys(env) {
    const available = {};
    
    for (const [provider, info] of Object.entries(this.modelProviders)) {
      if (info.api_key_env && env[info.api_key_env]) {
        available[provider] = {
          primary: !!env[info.api_key_env],
          rotation_count: this.apiKeyRotation[provider]?.length || 0
        };
      }
    }

    return available;
  }

  /**
   * Parse environment value with type conversion
   */
  parseEnvironmentValue(value, configPath) {
    if (!value) return value;

    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Numeric values
    if (/^\d+$/.test(value)) return parseInt(value);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    // JSON values
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as string if JSON parsing fails
      }
    }

    return value; // Return as string
  }

  /**
   * Validate mapped configuration
   */
  validateMappedConfig(config) {
    const errors = [];

    // Check required fields
    if (!this.getNestedValue(config, 'agent.model.api_key')) {
      errors.push('Model API key is required');
    }

    if (!this.getNestedValue(config, 'env.github.token')) {
      errors.push('GitHub token is required');
    }

    // Validate model configuration
    const modelName = this.getNestedValue(config, 'agent.model.name');
    const provider = this.getNestedValue(config, 'agent.model.provider') || this.detectModelProvider(config);
    
    if (modelName && provider) {
      const providerInfo = this.modelProviders[provider];
      if (providerInfo && !providerInfo.models.some(model => 
        modelName.includes(model) || model.includes(modelName))) {
        errors.push(`Model ${modelName} not supported by provider ${provider}`);
      }
    }

    // Validate numeric limits
    const costLimit = this.getNestedValue(config, 'performance.cost_limit');
    if (costLimit && (isNaN(costLimit) || costLimit < 0)) {
      errors.push('Cost limit must be a positive number');
    }

    const memoryLimit = this.getNestedValue(config, 'performance.memory_limit');
    if (memoryLimit && !/^\d+[GMK]B$/.test(memoryLimit)) {
      errors.push('Memory limit must be in format like "4GB", "512MB"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get minimal fallback configuration
   */
  getMinimalConfig() {
    return {
      agent: {
        model: {
          name: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic',
          temperature: 0.0,
          api_key: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || 'missing'
        },
        parser: {
          name: 'ToolCallingParser',
          function_calling: true
        }
      },
      env: {
        github: {
          token: process.env.GITHUB_TOKEN || 'missing'
        },
        workspace: {
          mount_path: '/tmp/swe-agent-workspace'
        }
      },
      performance: {
        cost_limit: 5.0,
        memory_limit: '2GB',
        timeout: 300000
      }
    };
  }

  /**
   * Utility: Set nested object value using dot notation
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Utility: Get nested object value using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && typeof current === 'object' ? current[key] : undefined, obj);
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary(config) {
    return {
      model: {
        provider: this.detectModelProvider(config),
        name: this.getNestedValue(config, 'agent.model.name'),
        api_key_available: !!this.getNestedValue(config, 'agent.model.api_key')
      },
      deployment: {
        mode: this.detectDeploymentMode(config),
        docker_enabled: this.getNestedValue(config, 'deployment.docker.enabled'),
        modal_enabled: this.getNestedValue(config, 'deployment.modal.enabled')
      },
      performance: {
        cost_limit: this.getNestedValue(config, 'performance.cost_limit'),
        memory_limit: this.getNestedValue(config, 'performance.memory_limit'),
        parallel_jobs: this.getNestedValue(config, 'performance.parallel_jobs')
      },
      github: {
        repository: this.getNestedValue(config, 'github.repository'),
        token_available: !!this.getNestedValue(config, 'env.github.token')
      }
    };
  }
}

module.exports = GitHubEnvMapper;