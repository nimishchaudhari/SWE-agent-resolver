const ConfigManager = require('./config-manager');
require('dotenv').config();

// Initialize configuration manager
const configManager = new ConfigManager();

// Load and cache configuration
let cachedConfig = null;
let configPromise = null;

/**
 * Get current configuration (async initialization)
 */
async function getConfig(configPath = null) {
  if (!configPromise) {
    configPromise = configManager.loadConfig(configPath);
  }
  
  if (!cachedConfig) {
    cachedConfig = await configPromise;
  }
  
  return cachedConfig;
}

/**
 * Get configuration synchronously (for backward compatibility)
 * Note: This will use cached config or throw if not initialized
 */
function getConfigSync() {
  if (!cachedConfig) {
    throw new Error('Configuration not initialized. Call getConfig() first or use initializeConfig().');
  }
  return cachedConfig;
}

/**
 * Initialize configuration synchronously for immediate use
 */
function initializeConfig(configPath = null) {
  try {
    // For sync initialization, we'll create a minimal config and enhance it
    const deployment = configManager.detector.detectDeployment();
    const optimalConfig = configManager.detector.getOptimalConfig();
    
    // Create basic config for immediate use
    const baseConfig = configManager.loadBaseConfig();
    const mergedConfig = configManager.mergeConfigs([baseConfig, optimalConfig]);
    const validatedConfig = configManager.validateConfig(mergedConfig, deployment.mode);
    
    validatedConfig._meta = {
      deployment,
      loadedAt: new Date().toISOString(),
      syncInit: true
    };
    
    cachedConfig = validatedConfig;
    configManager.cacheConfig('current', validatedConfig);
    
    return validatedConfig;
  } catch (error) {
    console.error('Failed to initialize configuration:', error.message);
    throw error;
  }
}

/**
 * Reload configuration
 */
async function reloadConfig(configPath = null) {
  configPromise = null;
  cachedConfig = null;
  configManager.configCache.clear();
  return await getConfig(configPath);
}

/**
 * Get configuration summary for debugging
 */
function getConfigSummary() {
  return configManager.getConfigSummary();
}

/**
 * Get deployment information
 */
function getDeploymentInfo() {
  const config = getConfigSync();
  return config._meta?.deployment || configManager.detector.detectDeployment();
}

// Export for backward compatibility (legacy format)
const legacyConfig = (() => {
  try {
    const config = initializeConfig();
    return {
      env: config.env.nodeEnv,
      server: {
        port: config.server.port
      },
      github: {
        webhookSecret: config.github.webhookSecret,
        token: config.github.token
      },
      sweAgent: {
        path: config.sweAgent.path,
        timeout: config.sweAgent.timeout,
        maxConcurrentJobs: config.sweAgent.maxConcurrentJobs
      },
      logging: {
        level: config.logging.level
      }
    };
  } catch (error) {
    console.error('Failed to create legacy config:', error.message);
    // Fallback to basic config
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
  // New flexible configuration interface
  getConfig,
  getConfigSync,
  initializeConfig,
  reloadConfig,
  getConfigSummary,
  getDeploymentInfo,
  configManager,
  
  // Legacy interface for backward compatibility
  ...legacyConfig
};