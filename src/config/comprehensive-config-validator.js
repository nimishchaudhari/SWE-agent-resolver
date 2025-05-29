const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Comprehensive Configuration Validator
 * Validates SWE-agent configurations with detailed error handling and fallback strategies
 */
class ComprehensiveConfigValidator {
  constructor() {
    this.validationCache = new Map();
    this.initializeSchemas();
  }

  /**
   * Initialize Joi validation schemas
   */
  initializeSchemas() {
    // Model configuration schema
    this.modelSchema = Joi.object({
      name: Joi.string().required().messages({
        'any.required': 'Model name is required',
        'string.empty': 'Model name cannot be empty'
      }),
      provider: Joi.string().valid('anthropic', 'openai', 'azure', 'google', 'local').default('anthropic'),
      temperature: Joi.number().min(0).max(2).default(0.0),
      max_tokens: Joi.number().integer().min(1).max(200000).default(8192),
      timeout: Joi.number().integer().min(1000).max(3600000).default(300000),
      api_key_rotation: Joi.object({
        enabled: Joi.boolean().default(false),
        key_count: Joi.number().integer().min(1).max(10),
        rotation_strategy: Joi.string().valid('round_robin', 'random', 'least_used').default('round_robin')
      }).optional()
    });

    // Parser configuration schema
    this.parserSchema = Joi.object({
      name: Joi.string().valid('ToolCallingParser', 'ThoughtActionParser', 'XMLParser').required(),
      function_calling: Joi.boolean().default(true),
      max_retries: Joi.number().integer().min(0).max(5).default(3),
      timeout: Joi.number().integer().min(1000).max(60000).default(30000)
    });

    // History processor schema
    this.historyProcessorSchema = Joi.object({
      name: Joi.string().valid('DefaultHistoryProcessor', 'CompressedHistoryProcessor', 'SlidingWindowProcessor').required(),
      window_size: Joi.number().integer().min(100).max(50000).default(4000),
      compression: Joi.boolean().default(false),
      max_history_tokens: Joi.number().integer().min(100).max(100000).default(10000)
    });

    // Tools configuration schema
    this.toolSchema = Joi.object({
      name: Joi.string().required(),
      config: Joi.object().optional(),
      enabled: Joi.boolean().default(true),
      timeout: Joi.number().integer().min(1000).max(300000).default(30000)
    });

    // Agent configuration schema
    this.agentSchema = Joi.object({
      model: this.modelSchema.required(),
      parser: this.parserSchema.required(),
      history_processor: this.historyProcessorSchema.required(),
      tools: Joi.array().items(this.toolSchema).min(1).required(),
      cost_limit: Joi.number().min(0).max(1000).optional(),
      max_iterations: Joi.number().integer().min(1).max(100).default(50)
    });

    // Environment repository schema
    this.repoSchema = Joi.object({
      github_url: Joi.string().uri().pattern(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\.git$/).required().messages({
        'string.pattern.base': 'GitHub URL must be in format: https://github.com/owner/repo.git'
      }),
      base_commit: Joi.string().min(1).default('HEAD'),
      split_patch: Joi.boolean().default(false),
      clone_depth: Joi.number().integer().min(1).max(1000).default(50)
    });

    // Workspace configuration schema
    this.workspaceSchema = Joi.object({
      mount_path: Joi.string().pattern(/^\/[a-zA-Z0-9\/_-]+$/).required().messages({
        'string.pattern.base': 'Mount path must be an absolute Unix path'
      }),
      persistent: Joi.boolean().default(false),
      cleanup: Joi.boolean().default(true),
      max_size: Joi.string().pattern(/^\d+[GMK]B$/).default('10GB')
    });

    // Docker configuration schema
    this.dockerSchema = Joi.object({
      image: Joi.string().required(),
      memory_limit: Joi.string().pattern(/^\d+[GMK]B$/).default('4GB'),
      cpu_limit: Joi.number().min(0.1).max(16).default(2),
      network: Joi.string().valid('bridge', 'host', 'none').default('bridge'),
      volumes: Joi.array().items(Joi.string()).default([]),
      environment: Joi.object().optional()
    });

    // Modal configuration schema
    this.modalSchema = Joi.object({
      environment: Joi.string().valid('dev', 'staging', 'prod').default('dev'),
      cpu_count: Joi.number().integer().min(1).max(32).default(2),
      memory_mb: Joi.number().integer().min(512).max(32768).default(4096),
      timeout: Joi.number().integer().min(60).max(7200).default(3600),
      gpu: Joi.boolean().default(false),
      shared_volumes: Joi.boolean().default(false)
    });

    // Environment configuration schema
    this.envSchema = Joi.object({
      repo: this.repoSchema.required(),
      workspace: this.workspaceSchema.required(),
      docker: this.dockerSchema.optional(),
      modal: this.modalSchema.optional(),
      environment_variables: Joi.object().optional(),
      secrets: Joi.object({
        github_token: Joi.string().required(),
        model_api_key: Joi.string().required()
      }).required()
    });

    // Problem statement schema
    this.problemStatementSchema = Joi.object({
      type: Joi.string().valid(
        'bug_fix', 'feature_implementation', 'code_review', 'test_generation',
        'code_refactoring', 'issue_analysis', 'pull_request_review', 
        'code_explanation', 'general_task', 'general_analysis'
      ).required(),
      description: Joi.string().min(10).max(50000).required(),
      context: Joi.object({
        issue: Joi.object().optional(),
        pull_request: Joi.object().optional(),
        trigger_comment: Joi.object().optional(),
        file_context: Joi.object().optional(),
        commands: Joi.array().optional(),
        files: Joi.array().optional(),
        code_blocks: Joi.array().optional(),
        repository: Joi.object().optional()
      }).optional()
    });

    // Complete configuration schema
    this.fullConfigSchema = Joi.object({
      problem_statement: this.problemStatementSchema.required(),
      agent: this.agentSchema.required(),
      env: this.envSchema.required(),
      metadata: Joi.object().optional()
    });

    // Validation presets for different scenarios
    this.validationPresets = {
      strict: { abortEarly: false, allowUnknown: false, stripUnknown: false },
      permissive: { abortEarly: false, allowUnknown: true, stripUnknown: true },
      production: { abortEarly: true, allowUnknown: false, stripUnknown: false },
      development: { abortEarly: false, allowUnknown: true, stripUnknown: false }
    };
  }

  /**
   * Validate complete SWE-agent configuration
   * @param {object} config - Configuration to validate
   * @param {object} options - Validation options
   * @returns {object} Validation result with errors and warnings
   */
  async validateConfiguration(config, options = {}) {
    const validationMode = options.mode || 'strict';
    const cacheKey = this.generateCacheKey(config, validationMode);

    // Check cache for recent validation
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        logger.debug('Using cached validation result');
        return cached.result;
      }
    }

    try {
      const result = await this.performValidation(config, validationMode, options);
      
      // Cache the result
      this.validationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logger.error('Validation failed:', error);
      return {
        valid: false,
        errors: [`Validation system error: ${error.message}`],
        warnings: [],
        fallback: null,
        metadata: {
          validation_mode: validationMode,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Perform the actual validation
   */
  async performValidation(config, validationMode, options) {
    const validationOptions = this.validationPresets[validationMode] || this.validationPresets.strict;
    const errors = [];
    const warnings = [];

    // Step 1: Schema validation
    const schemaResult = this.fullConfigSchema.validate(config, validationOptions);
    
    if (schemaResult.error) {
      errors.push(...schemaResult.error.details.map(detail => detail.message));
    }

    // Use the cleaned config from Joi
    const cleanConfig = schemaResult.value || config;

    // Step 2: Cross-component validation
    const crossValidation = await this.performCrossComponentValidation(cleanConfig);
    errors.push(...crossValidation.errors);
    warnings.push(...crossValidation.warnings);

    // Step 3: Environment-specific validation
    const envValidation = await this.performEnvironmentValidation(cleanConfig, options);
    errors.push(...envValidation.errors);
    warnings.push(...envValidation.warnings);

    // Step 4: Security validation
    const securityValidation = this.performSecurityValidation(cleanConfig);
    errors.push(...securityValidation.errors);
    warnings.push(...securityValidation.warnings);

    // Step 5: Performance validation
    const performanceValidation = this.performPerformanceValidation(cleanConfig);
    warnings.push(...performanceValidation.warnings);

    // Determine if configuration is valid
    const isValid = errors.length === 0;

    // Generate fallback configuration if needed
    let fallbackConfig = null;
    if (!isValid && options.generateFallback) {
      fallbackConfig = await this.generateFallbackConfiguration(cleanConfig, errors);
    }

    return {
      valid: isValid,
      errors: [...new Set(errors)], // Remove duplicates
      warnings: [...new Set(warnings)], // Remove duplicates
      config: cleanConfig,
      fallback: fallbackConfig,
      metadata: {
        validation_mode: validationMode,
        schema_errors: schemaResult.error?.details.length || 0,
        cross_validation_issues: crossValidation.errors.length + crossValidation.warnings.length,
        environment_issues: envValidation.errors.length + envValidation.warnings.length,
        security_issues: securityValidation.errors.length + securityValidation.warnings.length,
        performance_warnings: performanceValidation.warnings.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Perform cross-component validation
   */
  async performCrossComponentValidation(config) {
    const errors = [];
    const warnings = [];

    // Validate model and parser compatibility
    const modelProvider = config.agent?.model?.provider;
    const parserName = config.agent?.parser?.name;
    const functionCalling = config.agent?.parser?.function_calling;

    if (modelProvider === 'local' && functionCalling) {
      warnings.push('Local models typically do not support function calling. Consider using ThoughtActionParser.');
    }

    if (parserName === 'ToolCallingParser' && !functionCalling) {
      errors.push('ToolCallingParser requires function_calling to be enabled');
    }

    if (parserName === 'ThoughtActionParser' && functionCalling) {
      warnings.push('ThoughtActionParser typically works better with function_calling disabled');
    }

    // Validate model and token limits
    const modelName = config.agent?.model?.name;
    const maxTokens = config.agent?.model?.max_tokens;
    
    if (modelName && maxTokens) {
      const modelLimits = this.getModelTokenLimits(modelName);
      if (modelLimits && maxTokens > modelLimits.max) {
        errors.push(`Max tokens ${maxTokens} exceeds model limit ${modelLimits.max} for ${modelName}`);
      }
    }

    // Validate tools and parser compatibility
    const tools = config.agent?.tools || [];
    const requiredTools = this.getRequiredToolsForParser(parserName);
    
    const toolNames = tools.map(tool => tool.name);
    const missingTools = requiredTools.filter(tool => !toolNames.includes(tool));
    
    if (missingTools.length > 0) {
      warnings.push(`Missing recommended tools for ${parserName}: ${missingTools.join(', ')}`);
    }

    // Validate workspace and deployment compatibility
    const workspacePath = config.env?.workspace?.mount_path;
    const dockerConfig = config.env?.docker;
    const modalConfig = config.env?.modal;

    if (dockerConfig && modalConfig) {
      errors.push('Cannot enable both Docker and Modal deployment modes simultaneously');
    }

    if (dockerConfig && !dockerConfig.volumes.some(vol => vol.includes(workspacePath))) {
      warnings.push('Workspace path should be mounted as Docker volume for data persistence');
    }

    // Validate cost limits and model pricing
    const costLimit = config.agent?.cost_limit;
    if (costLimit && modelProvider) {
      const estimatedCost = this.estimateConfigurationCost(config);
      if (estimatedCost > costLimit) {
        warnings.push(`Estimated cost ${estimatedCost} may exceed limit ${costLimit}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Perform environment-specific validation
   */
  async performEnvironmentValidation(config, options) {
    const errors = [];
    const warnings = [];

    // Validate GitHub repository access
    const githubUrl = config.env?.repo?.github_url;
    if (githubUrl) {
      const repoValidation = await this.validateRepositoryAccess(githubUrl, options);
      errors.push(...repoValidation.errors);
      warnings.push(...repoValidation.warnings);
    }

    // Validate secrets availability
    const secrets = config.env?.secrets;
    if (secrets) {
      const secretsValidation = this.validateSecretsAvailability(secrets);
      errors.push(...secretsValidation.errors);
      warnings.push(...secretsValidation.warnings);
    }

    // Validate deployment environment
    const dockerConfig = config.env?.docker;
    const modalConfig = config.env?.modal;

    if (dockerConfig) {
      const dockerValidation = await this.validateDockerEnvironment(dockerConfig);
      errors.push(...dockerValidation.errors);
      warnings.push(...dockerValidation.warnings);
    }

    if (modalConfig) {
      const modalValidation = await this.validateModalEnvironment(modalConfig);
      errors.push(...modalValidation.errors);
      warnings.push(...modalValidation.warnings);
    }

    return { errors, warnings };
  }

  /**
   * Perform security validation
   */
  performSecurityValidation(config) {
    const errors = [];
    const warnings = [];

    // Check for exposed secrets in configuration
    const configStr = JSON.stringify(config);
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
      /pk-[a-zA-Z0-9]{24}/g, // Anthropic API keys
      /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
      /[A-Za-z0-9+/]{40,}/g // Base64 encoded secrets
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(configStr)) {
        errors.push('Configuration contains potentially exposed secrets');
        break;
      }
    }

    // Validate workspace path security
    const workspacePath = config.env?.workspace?.mount_path;
    if (workspacePath) {
      if (workspacePath.includes('..') || workspacePath.includes('~')) {
        errors.push('Workspace path contains potentially unsafe path traversal characters');
      }
      
      if (workspacePath === '/' || workspacePath.startsWith('/etc') || workspacePath.startsWith('/root')) {
        errors.push('Workspace path targets sensitive system directories');
      }
    }

    // Validate tool configurations for security
    const tools = config.agent?.tools || [];
    for (const tool of tools) {
      if (tool.name === 'bash' && tool.config) {
        const restrictedCommands = tool.config.restricted_commands || [];
        if (restrictedCommands.length === 0) {
          warnings.push('Bash tool has no restricted commands - consider adding security restrictions');
        }
      }
    }

    // Validate Docker security
    if (config.env?.docker) {
      const dockerConfig = config.env.docker;
      
      if (dockerConfig.network === 'host') {
        warnings.push('Docker host networking may expose container to host network risks');
      }
      
      if (!dockerConfig.memory_limit) {
        warnings.push('Docker container has no memory limit - may cause resource exhaustion');
      }
    }

    return { errors, warnings };
  }

  /**
   * Perform performance validation
   */
  performPerformanceValidation(config) {
    const warnings = [];

    // Check memory allocation
    const memoryLimit = config.env?.docker?.memory_limit || config.env?.modal?.memory_mb;
    if (memoryLimit) {
      const memoryMB = typeof memoryLimit === 'string' ? 
        this.parseMemoryToMB(memoryLimit) : memoryLimit;
      
      if (memoryMB < 1024) {
        warnings.push('Memory limit below 1GB may cause performance issues');
      }
      
      if (memoryMB > 16384) {
        warnings.push('Memory limit above 16GB may be excessive for most tasks');
      }
    }

    // Check CPU allocation
    const cpuLimit = config.env?.docker?.cpu_limit || config.env?.modal?.cpu_count;
    if (cpuLimit && cpuLimit > 8) {
      warnings.push('High CPU allocation may not improve performance for LLM-based tasks');
    }

    // Check timeout values
    const modelTimeout = config.agent?.model?.timeout;
    const maxIterations = config.agent?.max_iterations;
    
    if (modelTimeout && maxIterations) {
      const totalTimeout = modelTimeout * maxIterations;
      if (totalTimeout > 3600000) { // 1 hour
        warnings.push('Total estimated execution time exceeds 1 hour - consider reducing iterations or timeout');
      }
    }

    // Check token limits vs history size
    const maxTokens = config.agent?.model?.max_tokens;
    const historySize = config.agent?.history_processor?.window_size;
    
    if (maxTokens && historySize && historySize > maxTokens * 0.5) {
      warnings.push('History window size is large relative to max tokens - may cause context overflow');
    }

    // Check cost efficiency
    const costLimit = config.agent?.cost_limit;
    const modelName = config.agent?.model?.name;
    
    if (costLimit && modelName) {
      const estimatedCost = this.estimateConfigurationCost(config);
      if (estimatedCost > costLimit * 0.8) {
        warnings.push('Configuration may quickly approach cost limit');
      }
    }

    return { warnings };
  }

  /**
   * Validate repository access
   */
  async validateRepositoryAccess(githubUrl, options) {
    const errors = [];
    const warnings = [];

    // Basic URL validation
    if (!githubUrl.startsWith('https://github.com/')) {
      errors.push('Repository URL must be a GitHub HTTPS URL');
      return { errors, warnings };
    }

    // Extract owner/repo from URL
    const match = githubUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\.git$/);
    if (!match) {
      errors.push('Invalid GitHub repository URL format');
      return { errors, warnings };
    }

    const [, owner, repo] = match;

    // Skip actual API call in test mode
    if (options.skipNetworkValidation) {
      return { errors, warnings };
    }

    // Note: In production, you would make an API call here to validate access
    // For now, we'll just validate the format and provide warnings
    if (owner.length < 1 || repo.length < 1) {
      errors.push('Repository owner and name cannot be empty');
    }

    if (repo.includes(' ') || owner.includes(' ')) {
      errors.push('Repository owner and name cannot contain spaces');
    }

    return { errors, warnings };
  }

  /**
   * Validate secrets availability
   */
  validateSecretsAvailability(secrets) {
    const errors = [];
    const warnings = [];

    const requiredSecrets = ['github_token', 'model_api_key'];
    
    for (const secretName of requiredSecrets) {
      if (!secrets[secretName]) {
        errors.push(`Required secret '${secretName}' is not configured`);
      } else if (secrets[secretName] === 'missing' || secrets[secretName] === 'undefined') {
        errors.push(`Secret '${secretName}' is configured but appears to be missing`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate Docker environment
   */
  async validateDockerEnvironment(dockerConfig) {
    const errors = [];
    const warnings = [];

    // Validate image name
    if (!dockerConfig.image) {
      errors.push('Docker image is required');
    } else if (!dockerConfig.image.includes(':')) {
      warnings.push('Docker image has no tag specified - will use latest');
    }

    // Validate memory limit
    if (dockerConfig.memory_limit) {
      const memoryMB = this.parseMemoryToMB(dockerConfig.memory_limit);
      if (memoryMB < 512) {
        errors.push('Docker memory limit must be at least 512MB');
      }
    }

    // Validate volumes
    if (dockerConfig.volumes && dockerConfig.volumes.length > 0) {
      for (const volume of dockerConfig.volumes) {
        if (!volume.includes(':')) {
          errors.push(`Invalid Docker volume format: ${volume}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate Modal environment
   */
  async validateModalEnvironment(modalConfig) {
    const errors = [];
    const warnings = [];

    // Validate memory allocation
    if (modalConfig.memory_mb < 512) {
      errors.push('Modal memory allocation must be at least 512MB');
    }

    // Validate CPU count
    if (modalConfig.cpu_count < 1) {
      errors.push('Modal CPU count must be at least 1');
    }

    // Validate timeout
    if (modalConfig.timeout > 7200) {
      warnings.push('Modal timeout exceeds 2 hours - may hit platform limits');
    }

    // Validate GPU configuration
    if (modalConfig.gpu && modalConfig.cpu_count > 8) {
      warnings.push('High CPU count with GPU may be inefficient');
    }

    return { errors, warnings };
  }

  /**
   * Generate fallback configuration
   */
  async generateFallbackConfiguration(originalConfig, errors) {
    logger.info('Generating fallback configuration due to validation errors');

    const fallback = {
      problem_statement: {
        type: 'general_task',
        description: originalConfig.problem_statement?.description || 'Software engineering task (fallback)',
        context: {
          fallback_reason: 'Original configuration had validation errors',
          original_errors: errors.slice(0, 5) // Include first 5 errors
        }
      },
      agent: {
        model: {
          name: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic',
          temperature: 0.0,
          max_tokens: 8192,
          timeout: 300000
        },
        parser: {
          name: 'ToolCallingParser',
          function_calling: true
        },
        history_processor: {
          name: 'DefaultHistoryProcessor',
          window_size: 4000,
          compression: false
        },
        tools: [
          { name: 'str_replace_editor', enabled: true },
          { name: 'bash', enabled: true, config: { restricted_commands: ['rm -rf /'] } },
          { name: 'file_viewer', enabled: true }
        ],
        cost_limit: 5.0,
        max_iterations: 30
      },
      env: {
        repo: {
          github_url: originalConfig.env?.repo?.github_url || 'https://github.com/unknown/unknown.git',
          base_commit: 'HEAD',
          split_patch: false
        },
        workspace: {
          mount_path: '/tmp/swe-agent-workspace',
          persistent: false,
          cleanup: true
        },
        environment_variables: {
          LOG_LEVEL: 'INFO'
        },
        secrets: {
          github_token: 'GITHUB_TOKEN',
          model_api_key: 'ANTHROPIC_API_KEY'
        }
      },
      metadata: {
        fallback: true,
        original_errors: errors,
        generated_at: new Date().toISOString()
      }
    };

    return fallback;
  }

  /**
   * Utility functions
   */
  getModelTokenLimits(modelName) {
    const limits = {
      'claude-3-5-sonnet-20241022': { max: 200000, recommended: 8192 },
      'claude-3-sonnet-20240229': { max: 200000, recommended: 8192 },
      'claude-3-haiku-20240307': { max: 200000, recommended: 4096 },
      'gpt-4o': { max: 128000, recommended: 8192 },
      'gpt-4o-mini': { max: 128000, recommended: 4096 },
      'gpt-4-turbo': { max: 128000, recommended: 8192 },
      'gpt-3.5-turbo': { max: 4096, recommended: 2048 }
    };
    
    return limits[modelName] || { max: 8192, recommended: 4096 };
  }

  getRequiredToolsForParser(parserName) {
    const requirements = {
      'ToolCallingParser': ['str_replace_editor', 'bash', 'file_viewer'],
      'ThoughtActionParser': ['str_replace_based_edit_tool', 'bash', 'file_viewer'],
      'XMLParser': ['str_replace_editor', 'bash']
    };
    
    return requirements[parserName] || [];
  }

  estimateConfigurationCost(config) {
    // Simplified cost estimation based on model and expected usage
    const modelName = config.agent?.model?.name;
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const maxIterations = config.agent?.max_iterations || 50;

    const costPerToken = {
      'claude-3-5-sonnet-20241022': 0.000015,
      'claude-3-sonnet-20240229': 0.000015,
      'gpt-4o': 0.00003,
      'gpt-4o-mini': 0.00001
    };

    const rate = costPerToken[modelName] || 0.000015;
    return rate * maxTokens * maxIterations;
  }

  parseMemoryToMB(memoryString) {
    const match = memoryString.match(/^(\d+)(GB|MB)$/);
    if (!match) return 0;
    
    const [, amount, unit] = match;
    return unit === 'GB' ? parseInt(amount) * 1024 : parseInt(amount);
  }

  generateCacheKey(config, mode) {
    const key = JSON.stringify({
      config_hash: this.hashObject(config),
      mode,
      version: '1.0'
    });
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  hashObject(obj) {
    return JSON.stringify(obj).split('').reduce((hash, char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      return hash & hash; // Convert to 32-bit integer
    }, 0);
  }

  clearCache() {
    this.validationCache.clear();
    logger.debug('Validation cache cleared');
  }

  /**
   * Dry run validation - validate without side effects
   */
  async dryRunValidation(config, options = {}) {
    return this.validateConfiguration(config, {
      ...options,
      skipNetworkValidation: true,
      generateFallback: false,
      mode: 'development'
    });
  }

  /**
   * Production validation - strict validation for production use
   */
  async productionValidation(config, options = {}) {
    return this.validateConfiguration(config, {
      ...options,
      mode: 'production',
      generateFallback: true,
      skipNetworkValidation: false
    });
  }
}

module.exports = ComprehensiveConfigValidator;