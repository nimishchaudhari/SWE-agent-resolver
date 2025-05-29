const FastStartupOptimizer = require('./fast-startup');

// Enable fast startup optimizations
FastStartupOptimizer.enableFastMode();

// Initialize startup timing
const startupStart = Date.now();

// Pre-optimize modules
FastStartupOptimizer.optimizeModuleLoading();

// Lazy load handlers for better startup performance
const getEnhancedHandler = FastStartupOptimizer.createLazyLoader('./enhanced-handler');
const getWebhookParser = FastStartupOptimizer.createLazyLoader('./webhook-parser');
const getTriggerDetector = FastStartupOptimizer.createLazyLoader('./trigger-detector');
const getContextExtractor = FastStartupOptimizer.createLazyLoader('./context-extractor');
const getPermissionValidator = FastStartupOptimizer.createLazyLoader('./permission-validator');

// Warm up services in background
FastStartupOptimizer.warmupServices().catch(error => {
  console.warn('Service warmup failed:', error);
});

// Primary export - optimized handler
const handler = {
  // Main webhook processing function
  async processWebhook(rawPayload, headers) {
    const enhancedHandler = getEnhancedHandler();
    return enhancedHandler.processWebhook(rawPayload, headers);
  },

  // Legacy compatibility
  async handleIssueOpened(context) {
    const enhancedHandler = getEnhancedHandler();
    return enhancedHandler.handleIssueOpened(context);
  },

  async handlePullRequestOpened(context) {
    const enhancedHandler = getEnhancedHandler();
    return enhancedHandler.handlePullRequestOpened(context);
  },

  async handleIssueComment(context) {
    const enhancedHandler = getEnhancedHandler();
    return enhancedHandler.handleIssueComment(context);
  },

  // Utility functions
  getMetrics() {
    const enhancedHandler = getEnhancedHandler();
    return {
      ...enhancedHandler.getMetrics(),
      startup: FastStartupOptimizer.measureStartupTime(startupStart)
    };
  },

  // Direct access to components for testing/debugging
  getComponents() {
    return {
      WebhookParser: getWebhookParser(),
      TriggerDetector: getTriggerDetector(),
      ContextExtractor: getContextExtractor(),
      PermissionValidator: getPermissionValidator(),
      EnhancedHandler: getEnhancedHandler()
    };
  },

  // Health check
  healthCheck() {
    try {
      const components = this.getComponents();
      return {
        status: 'healthy',
        components: Object.keys(components),
        startup: FastStartupOptimizer.measureStartupTime(startupStart)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
};

// Measure final startup time
setTimeout(() => {
  FastStartupOptimizer.measureStartupTime(startupStart);
}, 0);

module.exports = handler;