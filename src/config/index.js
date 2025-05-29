const EnhancedConfigManager = require('./enhanced-config-manager');
const GitHubEnvMapper = require('./github-env-mapper');
const SWEAgentConfigGenerator = require('./swe-agent-config-generator');
const ComprehensiveConfigValidator = require('./comprehensive-config-validator');
const GitHubContextIntegrator = require('./github-context-integrator');
const PerformanceCostOptimizer = require('./performance-cost-optimizer');
const WebhookConfigIntegration = require('./webhook-config-integration');

// Legacy config manager for backward compatibility
const LegacyConfigManager = require('./config-manager');
require('dotenv').config();

/**
 * Enhanced Configuration System
 * Main entry point for all SWE-agent configuration functionality
 */
class ConfigurationSystem {
  constructor() {
    // Core enhanced components
    this.enhancedManager = new EnhancedConfigManager();
    this.envMapper = new GitHubEnvMapper();
    this.configGenerator = new SWEAgentConfigGenerator();
    this.validator = new ComprehensiveConfigValidator();
    this.contextIntegrator = new GitHubContextIntegrator();
    this.optimizer = new PerformanceCostOptimizer();
    this.webhookIntegration = new WebhookConfigIntegration();
    
    // Legacy compatibility
    this.legacyManager = new LegacyConfigManager();
    
    // System state
    this.initialized = false;
    this.version = '1.0.0';
    
    // Legacy cache for backward compatibility
    this.cachedConfig = null;
    this.configPromise = null;
  }

  /**
   * Initialize the configuration system
   */
  async initialize(options = {}) {
    if (this.initialized) {
      return;
    }

    try {
      // Perform health checks on all components
      const healthCheck = await this.enhancedManager.healthCheck();
      
      if (healthCheck.status !== 'healthy') {
        console.warn('Configuration system health check failed, continuing with degraded functionality:', healthCheck.error);
      }

      this.initialized = true;
      
      console.log('🔧 Enhanced SWE-Agent Configuration System initialized', {
        version: this.version,
        components: Object.keys(healthCheck.components).length,
        status: healthCheck.status
      });

    } catch (error) {
      console.error('❌ Configuration system initialization failed, falling back to legacy mode:', error);
      // Continue with legacy mode for backward compatibility
    }
  }

  /**
   * Generate configuration for GitHub webhook
   * @param {object} webhookContext - Webhook context
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Configuration package
   */
  async generateWebhookConfiguration(webhookContext, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.enhancedManager.handleWebhookConfiguration(webhookContext, options);
  }

  /**
   * Generate configuration for orchestrator
   * @param {object} orchestratorContext - Orchestrator context
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Configuration package
   */
  async generateOrchestratorConfiguration(orchestratorContext, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.enhancedManager.prepareOrchestrationConfiguration(orchestratorContext, options);
  }

  /**
   * Generate configuration from GitHub Actions context
   * @param {object} githubContext - GitHub Actions context
   * @param {object} problemContext - Problem context
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Configuration package
   */
  async generateConfiguration(githubContext, problemContext, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.enhancedManager.generateConfiguration(githubContext, problemContext, options);
  }

  /**
   * Legacy compatibility methods
   */

  /**
   * Get current configuration (async initialization)
   * Enhanced to use new system with legacy fallback
   */
  async getConfig(configPath = null) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.cachedConfig) {
        return this.cachedConfig;
      }

      // Generate configuration using enhanced system
      const githubContext = {
        repository: process.env.GITHUB_REPOSITORY || 'unknown/unknown',
        ref: process.env.GITHUB_REF || 'refs/heads/main',
        sha: process.env.GITHUB_SHA || 'HEAD',
        event_name: process.env.GITHUB_EVENT_NAME || 'push'
      };

      const problemContext = {
        repository: { name: githubContext.repository }
      };

      const configPackage = await this.generateConfiguration(githubContext, problemContext, {
        preset: 'issue_analysis',
        optimize: true
      });

      // Convert to legacy format for backward compatibility
      this.cachedConfig = this.convertToLegacyFormat(configPackage.config);
      return this.cachedConfig;

    } catch (error) {
      console.warn('Enhanced config generation failed, falling back to legacy:', error.message);
      
      // Fallback to legacy behavior
      if (!this.configPromise) {
        this.configPromise = this.legacyManager.loadConfig(configPath);
      }
      
      if (!this.cachedConfig) {
        this.cachedConfig = await this.configPromise;
      }
      
      return this.cachedConfig;
    }
  }

  /**
   * Get configuration synchronously (for backward compatibility)
   */
  getConfigSync() {
    if (!this.cachedConfig) {
      // Try to initialize synchronously with legacy manager
      try {
        const deployment = this.legacyManager.detector.detectDeployment();
        const optimalConfig = this.legacyManager.detector.getOptimalConfig();
        const baseConfig = this.legacyManager.loadBaseConfig();
        const mergedConfig = this.legacyManager.mergeConfigs([baseConfig, optimalConfig]);
        const validatedConfig = this.legacyManager.validateConfig(mergedConfig, deployment.mode);
        
        validatedConfig._meta = {
          deployment,
          loadedAt: new Date().toISOString(),
          syncInit: true,
          enhanced: false
        };
        
        this.cachedConfig = validatedConfig;
        return validatedConfig;
      } catch (error) {
        throw new Error('Configuration not initialized. Call getConfig() first or use initializeConfig().');
      }
    }
    return this.cachedConfig;
  }

  /**
   * Initialize configuration synchronously for immediate use
   */
  initializeConfig(configPath = null) {
    try {
      // Try enhanced initialization first
      if (!this.initialized) {
        const deployment = this.legacyManager.detector.detectDeployment();
        const optimalConfig = this.legacyManager.detector.getOptimalConfig();
        const baseConfig = this.legacyManager.loadBaseConfig();
        const mergedConfig = this.legacyManager.mergeConfigs([baseConfig, optimalConfig]);
        const validatedConfig = this.legacyManager.validateConfig(mergedConfig, deployment.mode);
        
        validatedConfig._meta = {
          deployment,
          loadedAt: new Date().toISOString(),
          syncInit: true,
          enhanced: false
        };
        
        this.cachedConfig = validatedConfig;
        this.legacyManager.cacheConfig('current', validatedConfig);
        
        return validatedConfig;
      }
      
      return this.cachedConfig;
    } catch (error) {
      console.error('Failed to initialize configuration:', error.message);
      throw error;
    }
  }

  /**
   * Reload configuration
   */
  async reloadConfig(configPath = null) {
    this.configPromise = null;
    this.cachedConfig = null;
    if (this.legacyManager.configCache) {
      this.legacyManager.configCache.clear();
    }
    this.clearCaches();
    return await this.getConfig(configPath);
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary() {
    if (this.initialized) {
      return this.getSystemStatus();
    }
    return this.legacyManager.getConfigSummary();
  }

  /**
   * Get deployment information
   */
  getDeploymentInfo() {
    const config = this.getConfigSync();
    return config._meta?.deployment || this.legacyManager.detector.detectDeployment();
  }

  /**
   * Convert enhanced config to legacy format
   */
  convertToLegacyFormat(enhancedConfig) {
    return {
      env: {
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      server: {
        port: parseInt(process.env.PORT) || 3000
      },
      github: {
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
        token: enhancedConfig.env?.secrets?.github_token || process.env.GITHUB_TOKEN
      },
      sweAgent: {
        path: process.env.SWE_AGENT_PATH || '/usr/local/bin/swe-agent',
        timeout: enhancedConfig.agent?.model?.timeout || 300000,
        maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 3
      },
      logging: {
        level: enhancedConfig.env?.environment_variables?.LOG_LEVEL || 'info'
      },
      _meta: {
        enhanced: true,
        loadedAt: new Date().toISOString(),
        configVersion: this.version
      }
    };
  }

  /**
   * Enhanced system methods
   */
  
  async generateConfigurationFile(githubContext, problemContext, outputPath, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.enhancedManager.generateConfigurationFile(githubContext, problemContext, outputPath, options);
  }

  enhanceWebhookHandler(originalHandler) {
    return this.webhookIntegration.enhanceGitHubHandler(originalHandler);
  }

  createConfigAwareExecutor(originalExecutor) {
    return this.webhookIntegration.createConfigAwareExecutor(originalExecutor);
  }

  mapEnvironmentToConfig(githubContext = {}) {
    return this.envMapper.mapEnvironmentToConfig(githubContext);
  }

  async validateConfiguration(config, options = {}) {
    return this.validator.validateConfiguration(config, options);
  }

  async optimizeConfiguration(config, options = {}) {
    return this.optimizer.optimizeConfiguration(config, options);
  }

  applyPerformanceProfile(config, profileName) {
    return this.optimizer.applyPerformanceProfile(config, profileName);
  }

  getAvailablePresets() {
    return this.enhancedManager.presets;
  }

  getSystemStatus() {
    return {
      initialized: this.initialized,
      version: this.version,
      configuration_manager: this.initialized ? this.enhancedManager.getConfigurationStatus() : null,
      webhook_integration: this.initialized ? this.webhookIntegration.getIntegrationStatus() : null,
      health: this.initialized ? 'healthy' : 'legacy_mode'
    };
  }

  clearCaches() {
    if (this.initialized) {
      this.enhancedManager.clearCaches();
      this.webhookIntegration.clearCaches();
    }
    console.log('🧹 Configuration system caches cleared');
  }
}

// Create singleton instance
const configSystem = new ConfigurationSystem();

// Initialize legacy config for immediate backward compatibility
const legacyConfig = (() => {
  try {
    const config = configSystem.initializeConfig();
    return {
      env: config.env?.nodeEnv || process.env.NODE_ENV || 'development',
      server: {
        port: config.server?.port || parseInt(process.env.PORT) || 3000
      },
      github: {
        webhookSecret: config.github?.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET,
        token: config.github?.token || process.env.GITHUB_TOKEN
      },
      sweAgent: {
        path: config.sweAgent?.path || process.env.SWE_AGENT_PATH || '/usr/local/bin/swe-agent',
        timeout: config.sweAgent?.timeout || parseInt(process.env.SWE_AGENT_TIMEOUT) || 300000,
        maxConcurrentJobs: config.sweAgent?.maxConcurrentJobs || parseInt(process.env.MAX_CONCURRENT_JOBS) || 3
      },
      logging: {
        level: config.logging?.level || process.env.LOG_LEVEL || 'info'
      }
    };
  } catch (error) {
    console.error('Failed to create legacy config:', error.message);
    // Fallback to environment variables
    return {
      env: process.env.NODE_ENV || 'development',
      server: { port: parseInt(process.env.PORT) || 3000 },
      github: {
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
        token: process.env.GITHUB_TOKEN
      },
      sweAgent: {
        path: process.env.SWE_AGENT_PATH || '/usr/local/bin/swe-agent',
        timeout: parseInt(process.env.SWE_AGENT_TIMEOUT) || 300000,
        maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 3
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info'
      }
    };
  }
})();

// Export both new and legacy interfaces
module.exports = {
  // Enhanced configuration system
  ConfigurationSystem,
  configSystem,
  
  // Individual components for advanced usage
  EnhancedConfigManager,
  GitHubEnvMapper,
  SWEAgentConfigGenerator,
  ComprehensiveConfigValidator,
  GitHubContextIntegrator,
  PerformanceCostOptimizer,
  WebhookConfigIntegration,

  // Convenience methods using singleton
  generateWebhookConfiguration: (webhookContext, options) => 
    configSystem.generateWebhookConfiguration(webhookContext, options),
  
  generateOrchestratorConfiguration: (orchestratorContext, options) =>
    configSystem.generateOrchestratorConfiguration(orchestratorContext, options),
  
  generateConfiguration: (githubContext, problemContext, options) =>
    configSystem.generateConfiguration(githubContext, problemContext, options),
  
  generateConfigurationFile: (githubContext, problemContext, outputPath, options) =>
    configSystem.generateConfigurationFile(githubContext, problemContext, outputPath, options),
  
  mapEnvironmentToConfig: (githubContext) =>
    configSystem.mapEnvironmentToConfig(githubContext),
  
  validateConfiguration: (config, options) =>
    configSystem.validateConfiguration(config, options),
  
  optimizeConfiguration: (config, options) =>
    configSystem.optimizeConfiguration(config, options),
  
  applyPerformanceProfile: (config, profileName) =>
    configSystem.applyPerformanceProfile(config, profileName),
  
  enhanceWebhookHandler: (originalHandler) =>
    configSystem.enhanceWebhookHandler(originalHandler),
  
  createConfigAwareExecutor: (originalExecutor) =>
    configSystem.createConfigAwareExecutor(originalExecutor),
  
  getAvailablePresets: () => configSystem.getAvailablePresets(),
  getSystemStatus: () => configSystem.getSystemStatus(),
  clearCaches: () => configSystem.clearCaches(),
  
  // Legacy compatibility interface (maintained for backward compatibility)
  getConfig: (configPath) => configSystem.getConfig(configPath),
  getConfigSync: () => configSystem.getConfigSync(),
  initializeConfig: (configPath) => configSystem.initializeConfig(configPath),
  reloadConfig: (configPath) => configSystem.reloadConfig(configPath),
  getConfigSummary: () => configSystem.getConfigSummary(),
  getDeploymentInfo: () => configSystem.getDeploymentInfo(),
  configManager: configSystem.legacyManager,
  
  // Legacy configuration values for immediate access
  ...legacyConfig
};