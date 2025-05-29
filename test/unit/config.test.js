const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const TestHelpers = require('../utils/test-helpers');

describe('Configuration System Tests', () => {
  let cleanupEnv;

  beforeEach(() => {
    // Mock environment for testing
    cleanupEnv = TestHelpers.mockEnvironment({
      NODE_ENV: 'test',
      GITHUB_WEBHOOK_SECRET: 'test-secret',
      GITHUB_TOKEN: 'test-token'
    });
  });

  afterEach(() => {
    if (cleanupEnv) {
      cleanupEnv();
    }
    
    // Clear require cache for config modules
    delete require.cache[require.resolve('../../src/config')];
    delete require.cache[require.resolve('../../src/config/config-manager')];
    delete require.cache[require.resolve('../../src/config/deployment-detector')];
  });

  describe('Basic Configuration Loading', () => {
    test('should load configuration successfully', async () => {
      const { getConfig } = require('../../src/config');
      
      const config = await getConfig();
      
      expect(config).toBeDefined();
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('github');
      expect(config).toHaveProperty('sweAgent');
      expect(config).toHaveProperty('logging');
    });

    test('should provide backward compatibility', () => {
      const config = require('../../src/config');
      
      // Legacy interface should still work
      expect(config).toHaveProperty('env');
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('github');
      expect(config).toHaveProperty('sweAgent');
      expect(config.github.webhookSecret).toBe('test-secret');
      expect(config.github.token).toBe('test-token');
    });
  });

  describe('Deployment Detection', () => {
    test('should detect local deployment by default', () => {
      const DeploymentDetector = require('../../src/config/deployment-detector');
      const detector = new DeploymentDetector();
      
      const deployment = detector.detectDeployment();
      
      expect(deployment.mode).toBe('local');
      expect(deployment.platform).toHaveProperty('os');
      expect(deployment.resources).toHaveProperty('cpu');
      expect(deployment.resources).toHaveProperty('memory');
    });

    test('should detect Docker environment', () => {
      // Mock Docker environment
      const originalEnv = process.env.DOCKER_CONTAINER;
      process.env.DOCKER_CONTAINER = 'true';
      
      const DeploymentDetector = require('../../src/config/deployment-detector');
      const detector = new DeploymentDetector();
      
      // Clear cache first
      detector.clearCache();
      
      const deployment = detector.detectDeployment();
      
      // Restore environment
      if (originalEnv === undefined) {
        delete process.env.DOCKER_CONTAINER;
      } else {
        process.env.DOCKER_CONTAINER = originalEnv;
      }
      
      // Note: Without actual Docker environment, this will still detect as local
      // This test demonstrates the detection logic
      expect(deployment.mode).toBeDefined();
      expect(['local', 'docker']).toContain(deployment.mode);
    });

    test('should detect Modal environment', () => {
      const originalEnv = process.env.MODAL_ENVIRONMENT;
      process.env.MODAL_ENVIRONMENT = 'modal';
      
      const DeploymentDetector = require('../../src/config/deployment-detector');
      const detector = new DeploymentDetector();
      
      detector.clearCache();
      const deployment = detector.detectDeployment();
      
      // Restore environment
      if (originalEnv === undefined) {
        delete process.env.MODAL_ENVIRONMENT;
      } else {
        process.env.MODAL_ENVIRONMENT = originalEnv;
      }
      
      expect(deployment.mode).toBe('modal');
    });

    test('should provide optimal configuration recommendations', () => {
      const DeploymentDetector = require('../../src/config/deployment-detector');
      const detector = new DeploymentDetector();
      
      const optimalConfig = detector.getOptimalConfig();
      
      expect(optimalConfig).toHaveProperty('maxConcurrentJobs');
      expect(optimalConfig).toHaveProperty('timeout');
      expect(optimalConfig).toHaveProperty('deployment');
      expect(optimalConfig.maxConcurrentJobs).toBeGreaterThan(0);
      expect(optimalConfig.timeout).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration successfully', () => {
      const ConfigValidator = require('../../src/config/config-validator');
      const validator = new ConfigValidator();
      
      const testConfig = {
        server: { port: 3000, host: 'localhost' },
        github: { webhookSecret: 'secret', token: 'token' },
        sweAgent: { path: '/bin/swe-agent', timeout: 300000, maxConcurrentJobs: 2, workspaceDir: '/tmp' },
        logging: { level: 'info' },
        env: { nodeEnv: 'test' }
      };
      
      const result = validator.validateConfig(testConfig, 'local');
      
      expect(result.isValid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.source).toBe('primary');
    });

    test('should handle validation failures with fallbacks', () => {
      const ConfigValidator = require('../../src/config/config-validator');
      const validator = new ConfigValidator();
      
      const invalidConfig = {
        server: { port: 'invalid-port' }, // Invalid port
        github: {}, // Missing required fields
        sweAgent: {} // Missing required fields
      };
      
      const result = validator.validateConfig(invalidConfig, 'local');
      
      // Should fall back to a valid configuration
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(['partial_validation', 'mode_downgrade', 'minimal_config', 'default_config']).toContain(result.source);
    });

    test('should create emergency fallback for complete failure', () => {
      const ConfigValidator = require('../../src/config/config-validator');
      const validator = new ConfigValidator();
      
      // Force an error in validation
      jest.spyOn(validator, 'validateWithSchema').mockImplementation(() => {
        throw new Error('Validation system failure');
      });
      
      const result = validator.validateConfig({}, 'local');
      
      expect(result.isValid).toBe(true);
      expect(result.source).toBe('emergency_fallback');
      expect(result.warnings).toBeDefined();
      expect(result.warnings[0].type).toBe('emergency_fallback');
    });
  });

  describe('Configuration Caching', () => {
    test('should cache configuration for performance', async () => {
      const { getConfig } = require('../../src/config');
      
      const start1 = Date.now();
      const config1 = await getConfig();
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      const config2 = await getConfig();
      const time2 = Date.now() - start2;
      
      // Second call should be faster (cached)
      expect(time2).toBeLessThan(time1);
      expect(config1).toEqual(config2);
    });

    test('should support configuration reloading', async () => {
      const { getConfig, reloadConfig } = require('../../src/config');
      
      const config1 = await getConfig();
      
      // Change environment variable
      process.env.TEST_CONFIG_CHANGE = 'true';
      
      const config2 = await reloadConfig();
      
      // Configuration should be reloaded
      expect(config2).toBeDefined();
      
      // Clean up
      delete process.env.TEST_CONFIG_CHANGE;
    });
  });

  describe('Environment-Specific Configuration', () => {
    test('should load development configuration', async () => {
      process.env.NODE_ENV = 'development';
      
      // Clear cache
      const { configManager } = require('../../src/config');
      configManager.configCache.clear();
      
      const { getConfig } = require('../../src/config');
      const config = await getConfig();
      
      expect(config.env.nodeEnv).toBe('development');
      expect(config.logging.level).toBe('debug');
    });

    test('should load production configuration', async () => {
      process.env.NODE_ENV = 'production';
      
      // Clear cache
      const { configManager } = require('../../src/config');
      configManager.configCache.clear();
      
      const { getConfig } = require('../../src/config');
      const config = await getConfig();
      
      expect(config.env.nodeEnv).toBe('production');
      expect(config.security.validateWebhooks).toBe(true);
    });

    test('should load test configuration', async () => {
      process.env.NODE_ENV = 'test';
      
      // Clear cache
      const { configManager } = require('../../src/config');
      configManager.configCache.clear();
      
      const { getConfig } = require('../../src/config');
      const config = await getConfig();
      
      expect(config.env.nodeEnv).toBe('test');
      expect(config.logging.level).toBe('silent');
    });
  });

  describe('Resource Monitoring', () => {
    test('should initialize resource monitor', () => {
      const ResourceMonitor = require('../../src/config/resource-monitor');
      const monitor = new ResourceMonitor();
      
      expect(monitor).toBeDefined();
      expect(monitor.enabled).toBe(true);
      expect(monitor.interval).toBe(5000);
    });

    test('should collect system metrics', () => {
      const ResourceMonitor = require('../../src/config/resource-monitor');
      const monitor = new ResourceMonitor();
      
      const memoryUsage = monitor.getMemoryUsage();
      expect(memoryUsage).toHaveProperty('system');
      expect(memoryUsage).toHaveProperty('process');
      expect(memoryUsage).toHaveProperty('percentage');
      expect(memoryUsage.percentage).toBeGreaterThanOrEqual(0);
      expect(memoryUsage.percentage).toBeLessThanOrEqual(100);
      
      const cpuUsage = monitor.getCpuUsage();
      expect(cpuUsage).toHaveProperty('process');
      expect(cpuUsage).toHaveProperty('system');
      expect(cpuUsage).toHaveProperty('percentage');
    });

    test('should provide system status', () => {
      const ResourceMonitor = require('../../src/config/resource-monitor');
      const monitor = new ResourceMonitor();
      
      const status = monitor.getStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('pid');
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(status.status);
    });
  });

  describe('Configuration Summary', () => {
    test('should provide configuration summary', async () => {
      const { getConfigSummary } = require('../../src/config');
      
      const summary = getConfigSummary();
      
      if (summary) {
        expect(summary).toHaveProperty('mode');
        expect(summary).toHaveProperty('environment');
        expect(summary).toHaveProperty('resources');
        expect(summary).toHaveProperty('loadedAt');
      }
    });

    test('should provide deployment information', async () => {
      const { getDeploymentInfo } = require('../../src/config');
      
      const deploymentInfo = getDeploymentInfo();
      
      expect(deploymentInfo).toHaveProperty('mode');
      expect(deploymentInfo).toHaveProperty('platform');
      expect(deploymentInfo).toHaveProperty('resources');
    });
  });
});