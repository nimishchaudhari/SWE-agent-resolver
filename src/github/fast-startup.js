const logger = require('../utils/logger');

class FastStartupOptimizer {
  static async optimizeModuleLoading() {
    const startTime = Date.now();
    
    // Pre-compile regex patterns to avoid runtime compilation
    const precompiledPatterns = {
      mention: /@swe-agent\b/gi,
      filePath: /\b([\w\/\-]+\.[\w]+)\b/g,
      errorPattern: /Error:\s*[^\n]+/g,
      issueRef: /#(\d+)/g
    };
    
    // Cache commonly used modules
    const moduleCache = new Map();
    
    // Pre-initialize crypto for signature validation
    const crypto = require('crypto');
    crypto.constants; // Force module initialization
    
    const loadTime = Date.now() - startTime;
    logger.debug(`Fast startup optimization completed in ${loadTime}ms`);
    
    return {
      precompiledPatterns,
      moduleCache,
      loadTime
    };
  }

  static createLazyLoader(modulePath) {
    let module = null;
    
    return () => {
      if (!module) {
        module = require(modulePath);
      }
      return module;
    };
  }

  static async warmupServices() {
    const startTime = Date.now();
    
    try {
      // Warm up critical services without full initialization
      const promises = [
        this.warmupCrypto(),
        this.warmupRegex(),
        this.warmupJSON()
      ];
      
      await Promise.all(promises);
      
      const warmupTime = Date.now() - startTime;
      logger.debug(`Service warmup completed in ${warmupTime}ms`);
      
      return { success: true, warmupTime };
    } catch (error) {
      logger.warn('Service warmup failed:', error);
      return { success: false, error: error.message };
    }
  }

  static async warmupCrypto() {
    const crypto = require('crypto');
    
    // Pre-warm HMAC operations
    const testHmac = crypto.createHmac('sha256', 'test');
    testHmac.update('test');
    testHmac.digest('hex');
    
    // Pre-warm timing safe equal
    const buffer1 = Buffer.from('test');
    const buffer2 = Buffer.from('test');
    crypto.timingSafeEqual(buffer1, buffer2);
  }

  static async warmupRegex() {
    const testText = '@swe-agent analyze file.js #123 Error: test';
    
    // Pre-warm regex engines with test patterns
    const patterns = [
      /@swe-agent\b/gi,
      /\b([\w\/\-]+\.[\w]+)\b/g,
      /Error:\s*[^\n]+/g,
      /#(\d+)/g
    ];
    
    patterns.forEach(pattern => {
      pattern.test(testText);
      pattern.lastIndex = 0; // Reset for next use
    });
  }

  static async warmupJSON() {
    // Pre-warm JSON operations
    const testObj = { test: 'data', number: 123 };
    const jsonStr = JSON.stringify(testObj);
    JSON.parse(jsonStr);
  }

  static createOptimizedHandler(HandlerClass) {
    return class OptimizedHandler extends HandlerClass {
      constructor() {
        super();
        this.initializeOptimizations();
      }

      initializeOptimizations() {
        // Pre-allocate common objects
        this.reusableObjects = {
          context: {},
          metrics: { processed: 0, errors: 0 },
          response: { processed: false }
        };
        
        // Pre-bind methods to avoid runtime binding
        this.processWebhook = this.processWebhook.bind(this);
        this.routeWebhook = this.routeWebhook.bind(this);
      }

      // Override with optimized version
      async processWebhook(rawPayload, headers) {
        // Reset reusable objects
        Object.keys(this.reusableObjects.context).forEach(key => {
          delete this.reusableObjects.context[key];
        });
        
        this.reusableObjects.response.processed = false;
        
        return super.processWebhook(rawPayload, headers);
      }
    };
  }

  static enableFastMode() {
    // Disable unnecessary features for faster startup
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    
    // Optimize V8 flags for startup speed
    if (process.env.NODE_ENV === 'production') {
      // These would typically be set via command line
      logger.debug('Fast mode enabled - production optimizations active');
    }
    
    // Set process priority for better responsiveness
    try {
      process.setMaxListeners(20); // Increase event listener limit
    } catch (error) {
      logger.debug('Could not set max listeners:', error.message);
    }
  }

  static measureStartupTime(startTime) {
    const totalStartup = Date.now() - startTime;
    
    const breakdown = {
      total: totalStartup,
      memory: process.memoryUsage(),
      uptime: process.uptime() * 1000
    };
    
    logger.info('Startup performance:', breakdown);
    
    return breakdown;
  }
}

module.exports = FastStartupOptimizer;