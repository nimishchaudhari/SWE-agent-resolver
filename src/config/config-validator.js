const Joi = require('joi');
const fs = require('fs');
const path = require('path');

class ConfigValidator {
  constructor() {
    this.validationCache = new Map();
    this.fallbackConfigs = new Map();
    this.validationRules = this.initializeValidationRules();
  }

  /**
   * Initialize comprehensive validation rules
   */
  initializeValidationRules() {
    return {
      base: this.createBaseSchema(),
      modal: this.createModalSchema(),
      docker: this.createDockerSchema(),
      kubernetes: this.createKubernetesSchema(),
      local: this.createLocalSchema(),
      'github-actions': this.createGitHubActionsSchema(),
      'aws-lambda': this.createAWSLambdaSchema()
    };
  }

  /**
   * Validate configuration with fallback mechanisms
   */
  validateConfig(config, mode = 'local', options = {}) {
    const validationOptions = {
      allowUnknown: true,
      stripUnknown: false,
      abortEarly: false,
      ...options
    };

    try {
      // Primary validation with mode-specific schema
      const primaryResult = this.validateWithSchema(config, mode, validationOptions);
      
      if (primaryResult.isValid) {
        return {
          isValid: true,
          config: primaryResult.config,
          warnings: primaryResult.warnings || [],
          source: 'primary'
        };
      }

      // If primary validation fails, try fallback strategies
      return this.handleValidationFailure(config, mode, primaryResult.errors, validationOptions);

    } catch (error) {
      // Last resort fallback
      return this.createEmergencyFallback(mode, error);
    }
  }

  /**
   * Validate configuration with specific schema
   */
  validateWithSchema(config, mode, options) {
    const schema = this.getSchemaForMode(mode);
    const { error, value, warning } = schema.validate(config, options);

    return {
      isValid: !error,
      config: value,
      errors: error ? this.formatValidationErrors(error) : null,
      warnings: warning ? this.formatValidationWarnings(warning) : []
    };
  }

  /**
   * Handle validation failures with fallback strategies
   */
  handleValidationFailure(config, mode, errors, options) {
    const fallbackStrategies = [
      () => this.tryPartialValidation(config, mode, options),
      () => this.tryModeDowngrade(config, mode, options),
      () => this.tryMinimalConfig(config, mode, options),
      () => this.tryDefaultConfig(mode)
    ];

    for (const strategy of fallbackStrategies) {
      try {
        const result = strategy();
        if (result.isValid) {
          result.warnings = result.warnings || [];
          result.warnings.push({
            type: 'fallback_used',
            message: `Configuration validation failed, using fallback strategy: ${result.source}`,
            originalErrors: errors
          });
          return result;
        }
      } catch (strategyError) {
        // Continue to next strategy
        continue;
      }
    }

    // All strategies failed
    throw new Error(`All validation strategies failed. Original errors: ${JSON.stringify(errors)}`);
  }

  /**
   * Try partial validation by excluding problematic sections
   */
  tryPartialValidation(config, mode, options) {
    const sections = ['server', 'github', 'sweAgent', 'logging', 'performance', 'security', 'env'];
    const validSections = {};
    const errors = [];

    for (const section of sections) {
      if (config[section]) {
        try {
          const sectionSchema = this.getSectionSchema(section, mode);
          const { error, value } = sectionSchema.validate(config[section], options);
          
          if (!error) {
            validSections[section] = value;
          } else {
            errors.push({ section, error: this.formatValidationErrors(error) });
          }
        } catch (sectionError) {
          errors.push({ section, error: sectionError.message });
        }
      }
    }

    // If we have at least critical sections, consider it valid
    const criticalSections = ['github', 'sweAgent'];
    const hasCriticalSections = criticalSections.every(section => validSections[section]);

    if (hasCriticalSections) {
      // Fill in missing sections with defaults
      const fullConfig = this.fillMissingWithDefaults(validSections, mode);
      
      return {
        isValid: true,
        config: fullConfig,
        warnings: [{
          type: 'partial_validation',
          message: 'Some configuration sections failed validation and were replaced with defaults',
          errors
        }],
        source: 'partial_validation'
      };
    }

    return { isValid: false, errors };
  }

  /**
   * Try downgrading to a simpler deployment mode
   */
  tryModeDowngrade(config, mode, options) {
    const downgradePath = {
      'modal': 'docker',
      'kubernetes': 'docker',
      'docker': 'local',
      'aws-lambda': 'local',
      'github-actions': 'local'
    };

    const fallbackMode = downgradePath[mode];
    if (!fallbackMode) {
      return { isValid: false };
    }

    // Attempt validation with simpler mode
    const result = this.validateWithSchema(config, fallbackMode, options);
    
    if (result.isValid) {
      result.source = `mode_downgrade_${fallbackMode}`;
      return result;
    }

    // Try recursive downgrade
    return this.tryModeDowngrade(config, fallbackMode, options);
  }

  /**
   * Try minimal configuration with only required fields
   */
  tryMinimalConfig(config, mode, options) {
    const minimalConfig = this.extractMinimalConfig(config, mode);
    const result = this.validateWithSchema(minimalConfig, mode, options);
    
    if (result.isValid) {
      result.source = 'minimal_config';
      return result;
    }

    return { isValid: false };
  }

  /**
   * Create default configuration for mode
   */
  tryDefaultConfig(mode) {
    const defaultConfig = this.getDefaultConfigForMode(mode);
    return {
      isValid: true,
      config: defaultConfig,
      source: 'default_config',
      warnings: [{
        type: 'default_fallback',
        message: 'Using complete default configuration due to validation failures'
      }]
    };
  }

  /**
   * Create emergency fallback configuration
   */
  createEmergencyFallback(mode, error) {
    const emergencyConfig = {
      server: { port: 3000, host: '0.0.0.0' },
      github: {
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'fallback-secret',
        token: process.env.GITHUB_TOKEN || 'fallback-token'
      },
      sweAgent: {
        path: '/usr/local/bin/swe-agent',
        timeout: 300000,
        maxConcurrentJobs: 1,
        workspaceDir: '/tmp/swe-agent-jobs'
      },
      logging: { level: 'error', format: 'json', output: 'console' },
      env: { nodeEnv: 'emergency' }
    };

    return {
      isValid: true,
      config: emergencyConfig,
      source: 'emergency_fallback',
      warnings: [{
        type: 'emergency_fallback',
        message: `Configuration system failure, using emergency fallback. Error: ${error.message}`
      }]
    };
  }

  /**
   * Get schema for specific deployment mode
   */
  getSchemaForMode(mode) {
    const cacheKey = `schema_${mode}`;
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey);
    }

    let schema = this.validationRules.base;

    // Apply mode-specific extensions
    if (this.validationRules[mode]) {
      schema = schema.concat(this.validationRules[mode]);
    }

    this.validationCache.set(cacheKey, schema);
    return schema;
  }

  /**
   * Create base validation schema
   */
  createBaseSchema() {
    return Joi.object({
      server: Joi.object({
        port: Joi.number().port().required(),
        host: Joi.string().ip().required(),
        cors: Joi.object({
          enabled: Joi.boolean().default(true),
          origins: Joi.array().items(Joi.string()).default(['*'])
        }).default()
      }).required(),

      github: Joi.object({
        webhookSecret: Joi.string().min(1).required(),
        token: Joi.string().min(1).required(),
        apiUrl: Joi.string().uri().default('https://api.github.com'),
        timeout: Joi.number().positive().default(30000)
      }).required(),

      sweAgent: Joi.object({
        path: Joi.string().min(1).required(),
        timeout: Joi.number().positive().min(10000).max(3600000).required(),
        maxConcurrentJobs: Joi.number().positive().min(1).max(100).required(),
        workspaceDir: Joi.string().min(1).required(),
        configTemplatesDir: Joi.string().default('./src/swe-agent/templates')
      }).required(),

      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'silent').default('info'),
        format: Joi.string().valid('json', 'pretty', 'github').default('json'),
        output: Joi.string().valid('console', 'file', 'both').default('console')
      }).default(),

      performance: Joi.object({
        enableCaching: Joi.boolean().default(true),
        cacheTimeout: Joi.number().positive().default(300000),
        enableCompression: Joi.boolean().default(false),
        memoryLimit: Joi.number().positive().allow(null).default(null),
        cpuLimit: Joi.number().positive().allow(null).default(null)
      }).default(),

      security: Joi.object({
        enableRateLimit: Joi.boolean().default(true),
        rateLimitWindow: Joi.number().positive().default(900000),
        rateLimitMax: Joi.number().positive().default(100),
        validateWebhooks: Joi.boolean().default(true)
      }).default(),

      env: Joi.object({
        nodeEnv: Joi.string().valid('development', 'test', 'staging', 'production', 'emergency').default('development'),
        version: Joi.string().default('1.0.0'),
        buildId: Joi.string().default('unknown'),
        commitSha: Joi.string().default('unknown')
      }).default()
    });
  }

  /**
   * Create Modal-specific validation schema
   */
  createModalSchema() {
    return Joi.object({
      modal: Joi.object({
        environment: Joi.string().default('modal'),
        taskId: Joi.string().allow(null),
        gpuEnabled: Joi.boolean().default(false),
        cpu: Joi.number().positive().min(1).max(64).default(4),
        memory: Joi.number().positive().min(512).max(32768).default(4096)
      }).default(),

      sweAgent: Joi.object({
        maxConcurrentJobs: Joi.number().min(1).max(50).default(10),
        timeout: Joi.number().min(60000).max(1800000).default(600000)
      }),

      performance: Joi.object({
        enableCaching: Joi.boolean().default(true),
        enableCompression: Joi.boolean().default(true),
        memoryLimit: Joi.number().positive().max(32768).allow(null)
      })
    });
  }

  /**
   * Create Docker-specific validation schema
   */
  createDockerSchema() {
    return Joi.object({
      docker: Joi.object({
        isContainer: Joi.boolean().default(true),
        memoryLimit: Joi.number().positive().allow(null),
        cpuLimit: Joi.number().positive().allow(null)
      }).default(),

      server: Joi.object({
        host: Joi.string().valid('0.0.0.0').default('0.0.0.0')
      }),

      sweAgent: Joi.object({
        workspaceDir: Joi.string().default('/tmp/swe-agent-jobs'),
        maxConcurrentJobs: Joi.number().min(1).max(10).default(3)
      })
    });
  }

  /**
   * Create additional mode-specific schemas
   */
  createKubernetesSchema() {
    return Joi.object({
      kubernetes: Joi.object({
        namespace: Joi.string().default('default'),
        serviceName: Joi.string().default('swe-agent'),
        enableAutoScaling: Joi.boolean().default(true)
      }).default()
    });
  }

  createLocalSchema() {
    return Joi.object({
      sweAgent: Joi.object({
        maxConcurrentJobs: Joi.number().min(1).max(5).default(2),
        timeout: Joi.number().max(600000).default(180000)
      }),
      logging: Joi.object({
        level: Joi.string().default('debug'),
        format: Joi.string().default('pretty')
      })
    });
  }

  createGitHubActionsSchema() {
    return Joi.object({
      sweAgent: Joi.object({
        workspaceDir: Joi.string().pattern(/github/).default(process.env.GITHUB_WORKSPACE + '/swe-agent-tmp'),
        maxConcurrentJobs: Joi.number().min(1).max(3).default(2)
      }),
      performance: Joi.object({
        enableCaching: Joi.boolean().default(false)
      })
    });
  }

  createAWSLambdaSchema() {
    return Joi.object({
      sweAgent: Joi.object({
        maxConcurrentJobs: Joi.number().valid(1).default(1),
        timeout: Joi.number().max(300000).default(300000),
        workspaceDir: Joi.string().default('/tmp')
      }),
      performance: Joi.object({
        enableCaching: Joi.boolean().default(false)
      })
    });
  }

  /**
   * Get section-specific schema
   */
  getSectionSchema(section, mode) {
    const fullSchema = this.getSchemaForMode(mode);
    return fullSchema.extract(section);
  }

  /**
   * Fill missing configuration sections with defaults
   */
  fillMissingWithDefaults(config, mode) {
    const defaultConfig = this.getDefaultConfigForMode(mode);
    return this.deepMerge(defaultConfig, config);
  }

  /**
   * Extract minimal required configuration
   */
  extractMinimalConfig(config, mode) {
    const minimal = {
      github: {
        webhookSecret: config.github?.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET,
        token: config.github?.token || process.env.GITHUB_TOKEN
      },
      sweAgent: {
        path: config.sweAgent?.path || '/usr/local/bin/swe-agent',
        timeout: config.sweAgent?.timeout || 300000,
        maxConcurrentJobs: config.sweAgent?.maxConcurrentJobs || 1,
        workspaceDir: config.sweAgent?.workspaceDir || '/tmp/swe-agent-jobs'
      },
      server: {
        port: config.server?.port || 3000,
        host: config.server?.host || (mode === 'docker' ? '0.0.0.0' : 'localhost')
      }
    };

    return minimal;
  }

  /**
   * Get default configuration for mode
   */
  getDefaultConfigForMode(mode) {
    const defaults = {
      local: {
        server: { port: 3000, host: 'localhost' },
        sweAgent: { maxConcurrentJobs: 2, timeout: 180000 },
        logging: { level: 'debug', format: 'pretty' },
        performance: { enableCaching: false }
      },
      docker: {
        server: { port: 3000, host: '0.0.0.0' },
        sweAgent: { maxConcurrentJobs: 3, timeout: 300000 },
        logging: { level: 'info', format: 'json' },
        performance: { enableCaching: true }
      },
      modal: {
        server: { port: 3000, host: '0.0.0.0' },
        sweAgent: { maxConcurrentJobs: 10, timeout: 600000 },
        logging: { level: 'info', format: 'json' },
        performance: { enableCaching: true, enableCompression: true }
      }
    };

    const baseDefaults = {
      github: {
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'default-secret',
        token: process.env.GITHUB_TOKEN || 'default-token',
        apiUrl: 'https://api.github.com',
        timeout: 30000
      },
      sweAgent: {
        path: '/usr/local/bin/swe-agent',
        workspaceDir: '/tmp/swe-agent-jobs',
        configTemplatesDir: './src/swe-agent/templates'
      },
      env: { nodeEnv: 'development' }
    };

    return this.deepMerge(baseDefaults, defaults[mode] || defaults.local);
  }

  /**
   * Deep merge utility
   */
  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * Format validation errors for better readability
   */
  formatValidationErrors(error) {
    return error.details.map(detail => ({
      path: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
      value: detail.context?.value
    }));
  }

  /**
   * Format validation warnings
   */
  formatValidationWarnings(warnings) {
    if (!Array.isArray(warnings)) return [];
    return warnings.map(warning => ({
      path: warning.path?.join('.') || 'unknown',
      message: warning.message,
      type: 'warning'
    }));
  }

  /**
   * Check if configuration file exists and is readable
   */
  async validateConfigFile(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }
      
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch (error) {
      throw new Error(`Configuration file validation failed: ${error.message}`);
    }
  }

  /**
   * Validate environment variables
   */
  validateEnvironment(requiredVars = []) {
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      return {
        isValid: false,
        missing,
        message: `Missing required environment variables: ${missing.join(', ')}`
      };
    }

    return { isValid: true };
  }
}

module.exports = ConfigValidator;