/**
 * Multi-Provider Error Handler with Intelligent Fallbacks
 * Handles provider-specific errors and implements fallback strategies
 */

class ErrorHandler {
  constructor(providerManager, logger = console) {
    this.providerManager = providerManager;
    this.logger = logger;
    
    // Provider-specific error patterns
    this.errorPatterns = {
      'rate_limit': [
        /rate limit exceeded/i,
        /too many requests/i,
        /quota exceeded/i,
        /throttled/i,
        /429/
      ],
      'auth_error': [
        /invalid api key/i,
        /unauthorized/i,
        /authentication failed/i,
        /invalid token/i,
        /401/,
        /403/
      ],
      'model_unavailable': [
        /model not found/i,
        /model unavailable/i,
        /model not supported/i,
        /unsupported model/i,
        /404/
      ],
      'context_length': [
        /context length exceeded/i,
        /token limit exceeded/i,
        /input too long/i,
        /maximum context/i
      ],
      'server_error': [
        /internal server error/i,
        /service unavailable/i,
        /bad gateway/i,
        /500/,
        /502/,
        /503/,
        /504/
      ],
      'timeout': [
        /timeout/i,
        /connection timeout/i,
        /request timeout/i,
        /ETIMEDOUT/
      ],
      'content_filter': [
        /content filter/i,
        /content policy/i,
        /inappropriate content/i,
        /safety filter/i
      ]
    };

    // Provider-specific retry policies
    this.retryPolicies = {
      'openai': { maxRetries: 3, baseDelay: 1000, backoffMultiplier: 2 },
      'anthropic': { maxRetries: 2, baseDelay: 2000, backoffMultiplier: 1.5 },
      'azure': { maxRetries: 3, baseDelay: 1000, backoffMultiplier: 2 },
      'deepseek': { maxRetries: 4, baseDelay: 500, backoffMultiplier: 2 },
      'openrouter': { maxRetries: 2, baseDelay: 1500, backoffMultiplier: 2 },
      'groq': { maxRetries: 5, baseDelay: 200, backoffMultiplier: 1.5 },
      'together': { maxRetries: 3, baseDelay: 1000, backoffMultiplier: 2 },
      'mistral': { maxRetries: 2, baseDelay: 1000, backoffMultiplier: 2 },
      'cohere': { maxRetries: 3, baseDelay: 1000, backoffMultiplier: 2 },
      'perplexity': { maxRetries: 2, baseDelay: 1500, backoffMultiplier: 2 },
      'anyscale': { maxRetries: 3, baseDelay: 1000, backoffMultiplier: 2 },
      'custom': { maxRetries: 2, baseDelay: 1000, backoffMultiplier: 2 }
    };
  }

  /**
   * Classify error type from error message
   * @param {Error} error - The error object
   * @returns {string} Error type classification
   */
  classifyError(error) {
    const errorMessage = error.message || error.toString();
    const statusCode = error.status || error.statusCode || error.code;

    // Check for specific HTTP status codes first
    if (statusCode === 429) return 'rate_limit';
    if (statusCode === 401 || statusCode === 403) return 'auth_error';
    if (statusCode === 404) return 'model_unavailable';
    if (statusCode >= 500) return 'server_error';

    // Check error message patterns
    for (const [errorType, patterns] of Object.entries(this.errorPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(errorMessage)) {
          return errorType;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Determine if error is retryable
   * @param {string} errorType - Classified error type
   * @returns {boolean} Whether the error should be retried
   */
  isRetryableError(errorType) {
    const retryableErrors = [
      'rate_limit',
      'server_error',
      'timeout'
    ];
    return retryableErrors.includes(errorType);
  }

  /**
   * Determine if error should trigger fallback
   * @param {string} errorType - Classified error type
   * @returns {boolean} Whether to use fallback model
   */
  shouldFallback(errorType) {
    const fallbackErrors = [
      'auth_error',
      'model_unavailable',
      'rate_limit',
      'server_error',
      'timeout',
      'context_length',
      'content_filter'
    ];
    return fallbackErrors.includes(errorType);
  }

  /**
   * Execute with automatic retry and fallback
   * @param {Function} operation - The operation to execute
   * @param {string} modelName - Current model name
   * @param {Array} fallbackModels - List of fallback models
   * @param {Object} context - Execution context
   * @returns {Object} Result or throws final error
   */
  async executeWithFallback(operation, modelName, fallbackModels = [], context = {}) {
    const allModels = [modelName, ...fallbackModels];
    let lastError = null;
    let totalCost = 0;

    for (let i = 0; i < allModels.length; i++) {
      const currentModel = allModels[i];
      const isRetry = i > 0;
      
      try {
        this.logger.log(`${isRetry ? '🔄 Fallback' : '🚀 Primary'} attempt with model: ${currentModel}`);
        
        // Update context with current model
        const modelContext = { ...context, currentModel, isRetry };
        
        // Execute operation with retry logic
        const result = await this.executeWithRetry(operation, currentModel, modelContext);
        
        // Track successful provider
        const providerInfo = this.providerManager.detectProvider(currentModel);
        result.providerUsed = providerInfo.provider;
        result.modelUsed = currentModel;
        result.wasRetry = isRetry;
        result.totalCost = totalCost + (result.cost || 0);
        
        this.logger.log(`✅ Success with ${currentModel} (${providerInfo.provider})`);
        return result;
        
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        const providerInfo = this.providerManager.detectProvider(currentModel);
        
        this.logger.error(`❌ ${currentModel} failed: ${errorType} - ${error.message}`);
        
        // Track cost even on failure (for rate limit errors)
        if (error.cost) {
          totalCost += error.cost;
        }
        
        // Check if we should continue to next model
        if (i === allModels.length - 1) {
          // Last model, throw error
          break;
        }
        
        if (!this.shouldFallback(errorType)) {
          this.logger.log(`🚫 Error type '${errorType}' not suitable for fallback`);
          break;
        }
        
        // Add delay before trying next model
        const delay = this.calculateFallbackDelay(i, errorType);
        if (delay > 0) {
          this.logger.log(`⏳ Waiting ${delay}ms before fallback...`);
          await this.sleep(delay);
        }
      }
    }

    // All models failed, throw enhanced error
    const enhancedError = this.createFallbackError(lastError, allModels, totalCost);
    throw enhancedError;
  }

  /**
   * Execute operation with retry logic for a single model
   * @param {Function} operation - Operation to execute
   * @param {string} modelName - Model name
   * @param {Object} context - Execution context
   * @returns {Object} Operation result
   */
  async executeWithRetry(operation, modelName, context) {
    const providerInfo = this.providerManager.detectProvider(modelName);
    const retryPolicy = this.retryPolicies[providerInfo.provider] || this.retryPolicies.custom;
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.log(`🔄 Retry ${attempt}/${retryPolicy.maxRetries} for ${modelName}`);
        }
        
        const result = await operation(modelName, { ...context, attempt });
        return result;
        
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        
        // Don't retry if not retryable or last attempt
        if (!this.isRetryableError(errorType) || attempt === retryPolicy.maxRetries) {
          throw error;
        }
        
        // Calculate delay for next retry
        const delay = this.calculateRetryDelay(attempt, retryPolicy, errorType);
        this.logger.log(`⏳ Retrying in ${delay}ms (error: ${errorType})`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Current attempt number
   * @param {Object} retryPolicy - Retry policy configuration
   * @param {string} errorType - Type of error
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt, retryPolicy, errorType) {
    let baseDelay = retryPolicy.baseDelay;
    
    // Longer delays for rate limits
    if (errorType === 'rate_limit') {
      baseDelay *= 3;
    }
    
    // Exponential backoff
    const delay = baseDelay * Math.pow(retryPolicy.backoffMultiplier, attempt);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Calculate delay before trying fallback model
   * @param {number} modelIndex - Index of current model in fallback chain
   * @param {string} errorType - Type of error that triggered fallback
   * @returns {number} Delay in milliseconds
   */
  calculateFallbackDelay(modelIndex, errorType) {
    const baseDelays = {
      'rate_limit': 5000,    // 5 seconds for rate limits
      'server_error': 2000,  // 2 seconds for server errors
      'timeout': 1000,       // 1 second for timeouts
      'auth_error': 0,       // No delay for auth errors
      'model_unavailable': 0 // No delay for unavailable models
    };
    
    return baseDelays.hasOwnProperty(errorType) ? baseDelays[errorType] : 1000;
  }

  /**
   * Create enhanced error with fallback information
   * @param {Error} originalError - The last error encountered
   * @param {Array} attemptedModels - All models that were attempted
   * @param {number} totalCost - Total cost incurred
   * @returns {Error} Enhanced error object
   */
  createFallbackError(originalError, attemptedModels, totalCost) {
    const error = new Error(
      `All fallback models failed. Last error: ${originalError.message}`
    );
    
    error.name = 'FallbackError';
    error.originalError = originalError;
    error.attemptedModels = attemptedModels;
    error.totalCost = totalCost;
    error.errorType = this.classifyError(originalError);
    error.troubleshooting = this.getTroubleshootingSteps(error.errorType, attemptedModels);
    
    return error;
  }

  /**
   * Get troubleshooting steps for error type
   * @param {string} errorType - Classified error type
   * @param {Array} attemptedModels - Models that were attempted
   * @returns {Array} List of troubleshooting steps
   */
  getTroubleshootingSteps(errorType, attemptedModels) {
    const steps = {
      'auth_error': [
        'Verify API keys are correctly set in repository secrets',
        'Check API key format and validity',
        'Ensure API keys have sufficient permissions',
        'Verify account billing status and limits'
      ],
      'rate_limit': [
        'Check provider rate limits and usage quotas',
        'Consider upgrading to higher tier plan',
        'Implement request spacing in workflows',
        'Use multiple API keys for load distribution'
      ],
      'model_unavailable': [
        'Verify model names are correct for each provider',
        'Check model availability in your region',
        'Ensure account has access to requested models',
        'Try alternative models from the same provider'
      ],
      'context_length': [
        'Reduce input size or use summarization',
        'Switch to models with larger context windows',
        'Break large requests into smaller chunks',
        'Use more efficient prompt engineering'
      ],
      'server_error': [
        'Check provider status pages for outages',
        'Try again later as issues may be temporary',
        'Contact provider support if persistent',
        'Use fallback providers during outages'
      ],
      'timeout': [
        'Increase workspace_timeout setting',
        'Optimize prompts for faster processing',
        'Use faster models (e.g., Groq) for time-sensitive tasks',
        'Check network connectivity issues'
      ]
    };

    const generalSteps = [
      'Review the comprehensive troubleshooting guide in README.md',
      'Check GitHub Actions logs for detailed error information',
      'Verify all required secrets and variables are configured',
      'Test with a simpler model first (e.g., gpt-3.5-turbo)'
    ];

    return [...(steps[errorType] || []), ...generalSteps];
  }

  /**
   * Generate user-friendly error message for comments
   * @param {Error} error - Error object
   * @returns {string} Formatted error message
   */
  generateUserErrorMessage(error) {
    if (error.name === 'FallbackError') {
      let message = `## ❌ All AI providers failed\n\n`;
      message += `**Attempted models:** ${error.attemptedModels.join(', ')}\n`;
      message += `**Final error:** ${error.errorType} - ${error.originalError.message}\n`;
      
      if (error.totalCost > 0) {
        message += `**Cost incurred:** $${error.totalCost.toFixed(4)}\n`;
      }
      
      message += `\n### 🔧 Troubleshooting Steps:\n\n`;
      error.troubleshooting.forEach((step, index) => {
        message += `${index + 1}. ${step}\n`;
      });
      
      message += `\n**Need help?** Check the [troubleshooting guide](https://github.com/nimishchaudhari/swe-agent-resolver#troubleshooting) or [open an issue](https://github.com/nimishchaudhari/swe-agent-resolver/issues/new).`;
      
      return message;
    }
    
    const errorType = this.classifyError(error);
    const steps = this.getTroubleshootingSteps(errorType, []);
    
    let message = `## ❌ AI provider error\n\n`;
    message += `**Error type:** ${errorType}\n`;
    message += `**Details:** ${error.message}\n\n`;
    message += `### 🔧 Quick fixes:\n\n`;
    steps.slice(0, 3).forEach((step, index) => {
      message += `${index + 1}. ${step}\n`;
    });
    
    return message;
  }

  /**
   * Sleep utility function
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ErrorHandler;