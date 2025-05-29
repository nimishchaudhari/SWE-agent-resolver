const Joi = require('joi');
const DeploymentDetector = require('./deployment-detector');
const path = require('path');
const fs = require('fs');

class ConfigManager {
  constructor() {
    this.detector = new DeploymentDetector();
    this.configCache = new Map();
    this.schemaCache = new Map();
    this.watchers = new Map();
    this.loadedConfigs = new Set();
  }

  /**
   * Load configuration with automatic optimization
   */
  async loadConfig(configPath = null) {
    const deployment = this.detector.detectDeployment();
    const optimalConfig = this.detector.getOptimalConfig();
    
    // Load base configuration
    const baseConfig = this.loadBaseConfig();
    
    // Load mode-specific configuration
    const modeConfig = await this.loadModeSpecificConfig(deployment.mode, configPath);
    
    // Load environment-specific overrides
    const envConfig = this.loadEnvironmentConfig(deployment.environment);
    
    // Merge configurations with priority: env > mode > optimal > base
    const mergedConfig = this.mergeConfigs([
      baseConfig,
      optimalConfig,
      modeConfig,
      envConfig
    ]);

    // Validate final configuration
    const validatedConfig = this.validateConfig(mergedConfig, deployment.mode);
    
    // Add runtime metadata
    validatedConfig._meta = {
      deployment,
      loadedAt: new Date().toISOString(),
      configSources: this.getConfigSources(),
      optimizations: optimalConfig.optimizations
    };

    // Cache the configuration
    this.cacheConfig('current', validatedConfig);
    
    return validatedConfig;
  }

  /**
   * Load base configuration schema
   */
  loadBaseConfig() {
    return {
      // Server configuration
      server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || '0.0.0.0',
        cors: {
          enabled: process.env.CORS_ENABLED !== 'false',
          origins: process.env.CORS_ORIGINS?.split(',') || ['*']
        }
      },

      // GitHub integration
      github: {
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
        token: process.env.GITHUB_TOKEN,
        apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
        timeout: parseInt(process.env.GITHUB_TIMEOUT) || 30000
      },

      // SWE-Agent configuration
      sweAgent: {
        path: process.env.SWE_AGENT_PATH || '/usr/local/bin/swe-agent',
        timeout: parseInt(process.env.SWE_AGENT_TIMEOUT) || 300000,
        maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 3,
        workspaceDir: process.env.WORKSPACE_DIR || '/tmp/swe-agent-jobs',
        configTemplatesDir: process.env.CONFIG_TEMPLATES_DIR || './src/swe-agent/templates'
      },

      // Logging configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        output: process.env.LOG_OUTPUT || 'console',
        file: process.env.LOG_FILE || './logs/app.log',
        maxSize: process.env.LOG_MAX_SIZE || '10MB',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
      },

      // Performance and resource management
      performance: {
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 300000,
        enableCompression: process.env.ENABLE_COMPRESSION === 'true',
        memoryLimit: process.env.MEMORY_LIMIT ? parseInt(process.env.MEMORY_LIMIT) : null,
        cpuLimit: process.env.CPU_LIMIT ? parseFloat(process.env.CPU_LIMIT) : null
      },

      // Security settings
      security: {
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        secretsPath: process.env.SECRETS_PATH || '.env',
        validateWebhooks: process.env.VALIDATE_WEBHOOKS !== 'false'
      },

      // Environment settings
      env: {
        nodeEnv: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        buildId: process.env.BUILD_ID || 'local',
        commitSha: process.env.GITHUB_SHA || 'unknown'
      }
    };
  }

  /**
   * Load mode-specific configuration
   */
  async loadModeSpecificConfig(mode, configPath) {
    const configs = {
      local: {
        sweAgent: {
          maxConcurrentJobs: 2,
          timeout: 180000
        },
        logging: {
          level: 'debug',
          format: 'pretty'
        },
        performance: {
          enableCaching: true,
          enableCompression: false
        }
      },

      docker: {
        sweAgent: {
          path: '/usr/local/bin/swe-agent',
          workspaceDir: '/tmp/swe-agent-jobs',
          maxConcurrentJobs: 3
        },
        logging: {
          output: 'console',
          format: 'json'
        },
        server: {
          host: '0.0.0.0'
        }
      },

      modal: {
        sweAgent: {
          maxConcurrentJobs: 10,
          timeout: 600000,
          workspaceDir: '/tmp/modal-swe-agent'
        },
        performance: {
          enableCaching: true,
          enableCompression: true,
          memoryLimit: 2048
        },
        logging: {
          level: 'info',
          format: 'json'
        }
      },

      kubernetes: {
        sweAgent: {
          maxConcurrentJobs: 5,
          timeout: 450000
        },
        performance: {
          enableCaching: true,
          enableCompression: true
        },
        logging: {
          format: 'json',
          output: 'console'
        },
        server: {
          host: '0.0.0.0'
        }
      },

      'github-actions': {
        sweAgent: {
          maxConcurrentJobs: 2,
          timeout: 300000,
          workspaceDir: process.env.GITHUB_WORKSPACE + '/swe-agent-tmp'
        },
        logging: {
          level: 'info',
          format: 'github'
        },
        performance: {
          enableCaching: false // Stateless CI environment
        }
      },

      'aws-lambda': {
        sweAgent: {
          maxConcurrentJobs: 1,
          timeout: 300000,
          workspaceDir: '/tmp'
        },
        performance: {
          enableCaching: false,
          enableCompression: true
        },
        logging: {
          format: 'json',
          output: 'console'
        }
      }
    };

    let modeConfig = configs[mode] || {};

    // Load from external config file if provided
    if (configPath && fs.existsSync(configPath)) {
      try {
        const externalConfig = require(path.resolve(configPath));
        modeConfig = this.mergeConfigs([modeConfig, externalConfig]);
      } catch (error) {
        console.warn(`Failed to load external config from ${configPath}:`, error.message);
      }
    }

    return modeConfig;
  }

  /**
   * Load environment-specific configuration
   */
  loadEnvironmentConfig(environment) {
    const configs = {
      development: {
        logging: { level: 'debug' },
        security: { validateWebhooks: false },
        performance: { enableCaching: false }
      },
      test: {
        logging: { level: 'silent' },
        server: { port: 0 }, // Random port for testing
        sweAgent: { timeout: 30000 }
      },
      staging: {
        logging: { level: 'info' },
        performance: { enableCaching: true }
      },
      production: {
        logging: { level: 'warn', format: 'json' },
        performance: { enableCaching: true, enableCompression: true },
        security: { validateWebhooks: true }
      },
      ci: {
        logging: { level: 'info' },
        sweAgent: { timeout: 300000 },
        performance: { enableCaching: false }
      }
    };

    return configs[environment] || {};
  }

  /**
   * Deep merge multiple configuration objects
   */
  mergeConfigs(configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {});
  }

  /**
   * Deep merge two objects
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
   * Validate configuration based on mode
   */
  validateConfig(config, mode) {
    const schema = this.getValidationSchema(mode);
    const { error, value } = schema.validate(config, { allowUnknown: true });
    
    if (error) {
      throw new Error(`Configuration validation error for mode '${mode}': ${error.message}`);
    }
    
    return value;
  }

  /**
   * Get validation schema for specific mode
   */
  getValidationSchema(mode) {
    const cacheKey = `schema_${mode}`;
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }

    const baseSchema = Joi.object({
      server: Joi.object({
        port: Joi.number().port().required(),
        host: Joi.string().required(),
        cors: Joi.object({
          enabled: Joi.boolean(),
          origins: Joi.array().items(Joi.string())
        })
      }),
      
      github: Joi.object({
        webhookSecret: Joi.string().required(),
        token: Joi.string().required(),
        apiUrl: Joi.string().uri(),
        timeout: Joi.number().positive()
      }),
      
      sweAgent: Joi.object({
        path: Joi.string().required(),
        timeout: Joi.number().positive().required(),
        maxConcurrentJobs: Joi.number().positive().required(),
        workspaceDir: Joi.string().required(),
        configTemplatesDir: Joi.string()
      }),
      
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'silent'),
        format: Joi.string().valid('json', 'pretty', 'github'),
        output: Joi.string().valid('console', 'file', 'both'),
        file: Joi.string(),
        maxSize: Joi.string(),
        maxFiles: Joi.number()
      }),
      
      performance: Joi.object({
        enableCaching: Joi.boolean(),
        cacheTimeout: Joi.number(),
        enableCompression: Joi.boolean(),
        memoryLimit: Joi.number().positive().allow(null),
        cpuLimit: Joi.number().positive().allow(null)
      }),
      
      security: Joi.object({
        enableRateLimit: Joi.boolean(),
        rateLimitWindow: Joi.number(),
        rateLimitMax: Joi.number(),
        secretsPath: Joi.string(),
        validateWebhooks: Joi.boolean()
      }),
      
      env: Joi.object({
        nodeEnv: Joi.string(),
        version: Joi.string(),
        buildId: Joi.string(),
        commitSha: Joi.string()
      })
    });

    // Mode-specific schema adjustments
    let schema = baseSchema;
    
    switch (mode) {
      case 'aws-lambda':
        schema = baseSchema.fork('sweAgent.maxConcurrentJobs', (field) => field.max(1));
        break;
      case 'modal':
        schema = baseSchema.fork('sweAgent.maxConcurrentJobs', (field) => field.max(50));
        break;
    }

    this.schemaCache.set(cacheKey, schema);
    return schema;
  }

  /**
   * Get configuration sources metadata
   */
  getConfigSources() {
    return Array.from(this.loadedConfigs);
  }

  /**
   * Cache configuration
   */
  cacheConfig(key, config) {
    this.configCache.set(key, {
      config,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached configuration
   */
  getCachedConfig(key) {
    const cached = this.configCache.get(key);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.config;
    }
    return null;
  }

  /**
   * Watch configuration file for changes
   */
  watchConfig(configPath, callback) {
    if (this.watchers.has(configPath)) {
      return; // Already watching
    }

    if (fs.existsSync(configPath)) {
      const watcher = fs.watchFile(configPath, () => {
        callback();
      });
      this.watchers.set(configPath, watcher);
    }
  }

  /**
   * Stop watching configuration files
   */
  stopWatching() {
    this.watchers.forEach((watcher, path) => {
      fs.unwatchFile(path);
    });
    this.watchers.clear();
  }

  /**
   * Get current configuration summary for debugging
   */
  getConfigSummary() {
    const cached = this.getCachedConfig('current');
    if (!cached) return null;

    return {
      mode: cached._meta?.deployment?.mode,
      environment: cached._meta?.deployment?.environment,
      resources: {
        cpu: cached._meta?.deployment?.resources?.cpu?.cores,
        memory: `${Math.round(cached._meta?.deployment?.resources?.memory?.total / 1024 / 1024 / 1024)}GB`,
        concurrency: cached.sweAgent?.maxConcurrentJobs
      },
      optimizations: cached._meta?.optimizations,
      loadedAt: cached._meta?.loadedAt
    };
  }
}

module.exports = ConfigManager;