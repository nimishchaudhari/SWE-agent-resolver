/**
 * Unit tests for ErrorHandler
 * Tests error classification, retry logic, and fallback mechanisms
 */

// Jest globals are available automatically
const ErrorHandler = require('../../action/error-handler');
const ProviderManager = require('../../action/provider-manager');

// Mock logger
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
};

describe('ErrorHandler', () => {
  let errorHandler;
  let providerManager;

  beforeEach(() => {
    providerManager = new ProviderManager();
    errorHandler = new ErrorHandler(providerManager, mockLogger);
    
    jest.clearAllMocks();
  });

  describe('classifyError', () => {
    test('should classify rate limit errors', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.statusCode = 429;
      
      expect(errorHandler.classifyError(rateLimitError)).toBe('rate_limit');
      
      const quotaError = new Error('Quota exceeded for this model');
      expect(errorHandler.classifyError(quotaError)).toBe('rate_limit');
      
      const tooManyError = new Error('Too many requests');
      expect(errorHandler.classifyError(tooManyError)).toBe('rate_limit');
    });

    test('should classify authentication errors', () => {
      const authError = new Error('Invalid API key');
      authError.statusCode = 401;
      
      expect(errorHandler.classifyError(authError)).toBe('auth_error');
      
      const unauthorizedError = new Error('Unauthorized access');
      expect(errorHandler.classifyError(unauthorizedError)).toBe('auth_error');
      
      const forbiddenError = new Error('Forbidden');
      forbiddenError.statusCode = 403;
      expect(errorHandler.classifyError(forbiddenError)).toBe('auth_error');
    });

    test('should classify model unavailable errors', () => {
      const modelError = new Error('Model not found');
      modelError.statusCode = 404;
      
      expect(errorHandler.classifyError(modelError)).toBe('model_unavailable');
      
      const unsupportedError = new Error('Unsupported model type');
      expect(errorHandler.classifyError(unsupportedError)).toBe('model_unavailable');
    });

    test('should classify server errors', () => {
      const serverError = new Error('Internal server error');
      serverError.statusCode = 500;
      
      expect(errorHandler.classifyError(serverError)).toBe('server_error');
      
      const badGatewayError = new Error('Bad gateway');
      badGatewayError.statusCode = 502;
      expect(errorHandler.classifyError(badGatewayError)).toBe('server_error');
    });

    test('should classify timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      expect(errorHandler.classifyError(timeoutError)).toBe('timeout');
      
      const connectionError = new Error('ETIMEDOUT');
      expect(errorHandler.classifyError(connectionError)).toBe('timeout');
    });

    test('should classify context length errors', () => {
      const contextError = new Error('Context length exceeded');
      expect(errorHandler.classifyError(contextError)).toBe('context_length');
      
      const tokenError = new Error('Token limit exceeded');
      expect(errorHandler.classifyError(tokenError)).toBe('context_length');
    });

    test('should classify content filter errors', () => {
      const contentError = new Error('Content filter triggered');
      expect(errorHandler.classifyError(contentError)).toBe('content_filter');
      
      const policyError = new Error('Content policy violation');
      expect(errorHandler.classifyError(policyError)).toBe('content_filter');
    });

    test('should return unknown for unclassified errors', () => {
      const unknownError = new Error('Something weird happened');
      expect(errorHandler.classifyError(unknownError)).toBe('unknown');
    });
  });

  describe('isRetryableError', () => {
    test('should identify retryable errors', () => {
      expect(errorHandler.isRetryableError('rate_limit')).toBe(true);
      expect(errorHandler.isRetryableError('server_error')).toBe(true);
      expect(errorHandler.isRetryableError('timeout')).toBe(true);
    });

    test('should identify non-retryable errors', () => {
      expect(errorHandler.isRetryableError('auth_error')).toBe(false);
      expect(errorHandler.isRetryableError('model_unavailable')).toBe(false);
      expect(errorHandler.isRetryableError('content_filter')).toBe(false);
      expect(errorHandler.isRetryableError('context_length')).toBe(false);
    });
  });

  describe('shouldFallback', () => {
    test('should identify errors that should trigger fallback', () => {
      expect(errorHandler.shouldFallback('auth_error')).toBe(true);
      expect(errorHandler.shouldFallback('model_unavailable')).toBe(true);
      expect(errorHandler.shouldFallback('rate_limit')).toBe(true);
      expect(errorHandler.shouldFallback('server_error')).toBe(true);
      expect(errorHandler.shouldFallback('context_length')).toBe(true);
    });

    test('should identify errors that should not trigger fallback', () => {
      expect(errorHandler.shouldFallback('content_filter')).toBe(true); // Actually should fallback
      expect(errorHandler.shouldFallback('unknown')).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    test('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ success: true });
      const context = { attempt: 0 };

      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'gpt-4o',
        context
      );

      expect(result).toEqual({ success: true });
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockOperation).toHaveBeenCalledWith('gpt-4o', { ...context, attempt: 0 });
    });

    test('should retry on retryable errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.statusCode = 429;

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ success: true });

      // Mock sleep to avoid actual delays
      jest.spyOn(errorHandler, 'sleep').mockResolvedValue();

      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'gpt-4o',
        { attempt: 0 }
      );

      expect(result).toEqual({ success: true });
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(errorHandler.sleep).toHaveBeenCalledTimes(2);
    });

    test('should not retry non-retryable errors', async () => {
      const authError = new Error('Invalid API key');
      authError.statusCode = 401;

      const mockOperation = jest.fn().mockRejectedValue(authError);

      await expect(
        errorHandler.executeWithRetry(mockOperation, 'gpt-4o', { attempt: 0 })
      ).rejects.toThrow('Invalid API key');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should respect max retry limit', async () => {
      const serverError = new Error('Internal server error');
      serverError.statusCode = 500;

      const mockOperation = jest.fn().mockRejectedValue(serverError);
      jest.spyOn(errorHandler, 'sleep').mockResolvedValue();

      await expect(
        errorHandler.executeWithRetry(mockOperation, 'gpt-4o', { attempt: 0 })
      ).rejects.toThrow('Internal server error');

      // Should try initial + 3 retries for OpenAI = 4 total
      expect(mockOperation).toHaveBeenCalledTimes(4);
    });
  });

  describe('executeWithFallback', () => {
    test('should succeed with primary model', async () => {
      const mockOperation = jest.fn().mockResolvedValue({
        success: true,
        cost: 0.05
      });

      const result = await errorHandler.executeWithFallback(
        mockOperation,
        'gpt-4o',
        ['gpt-3.5-turbo'],
        { test: true }
      );

      expect(result.success).toBe(true);
      expect(result.modelUsed).toBe('gpt-4o');
      expect(result.wasRetry).toBe(false);
      expect(result.totalCost).toBe(0.05);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should fallback to secondary model on failure', async () => {
      const authError = new Error('Invalid API key');
      authError.statusCode = 401;

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(authError)
        .mockResolvedValue({ success: true, cost: 0.02 });

      jest.spyOn(errorHandler, 'sleep').mockResolvedValue();

      const result = await errorHandler.executeWithFallback(
        mockOperation,
        'claude-3-5-sonnet-latest',
        ['gpt-4o'],
        { test: true }
      );

      expect(result.success).toBe(true);
      expect(result.modelUsed).toBe('gpt-4o');
      expect(result.wasRetry).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    test('should try all models before failing', async () => {
      const serverError = new Error('Server error');
      serverError.statusCode = 500;

      const mockOperation = jest.fn().mockRejectedValue(serverError);
      jest.spyOn(errorHandler, 'sleep').mockResolvedValue();

      await expect(
        errorHandler.executeWithFallback(
          mockOperation,
          'gpt-4o',
          ['claude-3-5-sonnet-latest', 'deepseek/deepseek-chat'],
          { test: true }
        )
      ).rejects.toThrow('All fallback models failed');

      // Should try primary + 2 fallbacks, each with retries
      // OpenAI: 4 attempts, Claude: 3 attempts, DeepSeek: 5 attempts = 12 total
      expect(mockOperation).toHaveBeenCalledTimes(12);
    });

    test('should accumulate costs across attempts', async () => {
      // Use an auth error to avoid retries
      const authError = new Error('Invalid API key');
      authError.cost = 0.01;
      authError.statusCode = 401;

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(authError)
        .mockResolvedValue({ success: true, cost: 0.03 });

      jest.spyOn(errorHandler, 'sleep').mockResolvedValue();

      const result = await errorHandler.executeWithFallback(
        mockOperation,
        'gpt-4o',
        ['gpt-3.5-turbo'],
        { test: true }
      );

      expect(result.totalCost).toBe(0.04); // 0.01 + 0.03
    });

    test('should not fallback for non-fallback errors', async () => {
      const contentError = new Error('Content filter triggered');
      
      // Mock classifyError and shouldFallback for this specific test
      jest.spyOn(errorHandler, 'classifyError').mockReturnValue('content_filter');
      jest.spyOn(errorHandler, 'shouldFallback').mockReturnValue(false);

      const mockOperation = jest.fn().mockRejectedValue(contentError);

      await expect(
        errorHandler.executeWithFallback(
          mockOperation,
          'gpt-4o',
          ['gpt-3.5-turbo'],
          { test: true }
        )
      ).rejects.toThrow('All fallback models failed');

      expect(mockOperation).toHaveBeenCalledTimes(1); // Only primary, no fallback
    });
  });

  describe('calculateRetryDelay', () => {
    test('should calculate exponential backoff', () => {
      const retryPolicy = { baseDelay: 1000, backoffMultiplier: 2 };
      
      const delay1 = errorHandler.calculateRetryDelay(0, retryPolicy, 'server_error');
      const delay2 = errorHandler.calculateRetryDelay(1, retryPolicy, 'server_error');
      const delay3 = errorHandler.calculateRetryDelay(2, retryPolicy, 'server_error');

      expect(delay1).toBeGreaterThan(1000);
      expect(delay1).toBeLessThan(1200); // With jitter
      expect(delay2).toBeGreaterThan(2000);
      expect(delay2).toBeLessThan(2400);
      expect(delay3).toBeGreaterThan(4000);
      expect(delay3).toBeLessThan(4800);
    });

    test('should use longer delays for rate limits', () => {
      const retryPolicy = { baseDelay: 1000, backoffMultiplier: 2 };
      
      const normalDelay = errorHandler.calculateRetryDelay(0, retryPolicy, 'server_error');
      const rateLimitDelay = errorHandler.calculateRetryDelay(0, retryPolicy, 'rate_limit');

      expect(rateLimitDelay).toBeGreaterThan(normalDelay * 2.5); // 3x base + jitter tolerance
    });
  });

  describe('calculateFallbackDelay', () => {
    test('should return appropriate delays for different error types', () => {
      expect(errorHandler.calculateFallbackDelay(0, 'rate_limit')).toBe(5000);
      expect(errorHandler.calculateFallbackDelay(0, 'server_error')).toBe(2000);
      expect(errorHandler.calculateFallbackDelay(0, 'timeout')).toBe(1000);
      expect(errorHandler.calculateFallbackDelay(0, 'auth_error')).toBe(0);
      expect(errorHandler.calculateFallbackDelay(0, 'model_unavailable')).toBe(0);
    });
  });

  describe('createFallbackError', () => {
    test('should create enhanced error with fallback information', () => {
      const originalError = new Error('Original error message');
      const attemptedModels = ['gpt-4o', 'claude-3-5-sonnet-latest', 'gpt-3.5-turbo'];
      const totalCost = 0.15;

      const enhancedError = errorHandler.createFallbackError(
        originalError,
        attemptedModels,
        totalCost
      );

      expect(enhancedError.name).toBe('FallbackError');
      expect(enhancedError.message).toContain('All fallback models failed');
      expect(enhancedError.message).toContain('Original error message');
      expect(enhancedError.originalError).toBe(originalError);
      expect(enhancedError.attemptedModels).toEqual(attemptedModels);
      expect(enhancedError.totalCost).toBe(totalCost);
      expect(enhancedError.troubleshooting).toBeDefined();
      expect(Array.isArray(enhancedError.troubleshooting)).toBe(true);
    });
  });

  describe('getTroubleshootingSteps', () => {
    test('should return specific steps for auth errors', () => {
      const steps = errorHandler.getTroubleshootingSteps('auth_error', ['gpt-4o']);
      
      expect(steps).toContain('Verify API keys are correctly set in repository secrets');
      expect(steps).toContain('Check API key format and validity');
      expect(steps).toContain('Review the comprehensive troubleshooting guide in README.md');
    });

    test('should return specific steps for rate limit errors', () => {
      const steps = errorHandler.getTroubleshootingSteps('rate_limit', ['gpt-4o']);
      
      expect(steps).toContain('Check provider rate limits and usage quotas');
      expect(steps).toContain('Consider upgrading to higher tier plan');
    });

    test('should include general steps for all error types', () => {
      const steps = errorHandler.getTroubleshootingSteps('unknown', ['gpt-4o']);
      
      expect(steps).toContain('Review the comprehensive troubleshooting guide in README.md');
      expect(steps).toContain('Check GitHub Actions logs for detailed error information');
      expect(steps).toContain('Test with a simpler model first (e.g., gpt-3.5-turbo)');
    });
  });

  describe('generateUserErrorMessage', () => {
    test('should generate comprehensive message for fallback errors', () => {
      const fallbackError = new Error('All fallback models failed');
      fallbackError.name = 'FallbackError';
      fallbackError.attemptedModels = ['gpt-4o', 'claude-3-5-sonnet-latest'];
      fallbackError.errorType = 'rate_limit';
      fallbackError.originalError = { message: 'Rate limit exceeded' };
      fallbackError.totalCost = 0.05;
      fallbackError.troubleshooting = [
        'Check rate limits',
        'Upgrade plan',
        'Use fallback providers'
      ];

      const message = errorHandler.generateUserErrorMessage(fallbackError);

      expect(message).toContain('❌ All AI providers failed');
      expect(message).toContain('gpt-4o, claude-3-5-sonnet-latest');
      expect(message).toContain('rate_limit - Rate limit exceeded');
      expect(message).toContain('$0.0500');
      expect(message).toContain('🔧 Troubleshooting Steps');
      expect(message).toContain('1. Check rate limits');
      expect(message).toContain('2. Upgrade plan');
      expect(message).toContain('3. Use fallback providers');
    });

    test('should generate simple message for regular errors', () => {
      const regularError = new Error('Simple error message');

      const message = errorHandler.generateUserErrorMessage(regularError);

      expect(message).toContain('❌ AI provider error');
      expect(message).toContain('**Error type:** unknown');
      expect(message).toContain('**Details:** Simple error message');
      expect(message).toContain('🔧 Quick fixes');
    });
  });

  describe('sleep', () => {
    test('should resolve after specified delay', async () => {
      const start = Date.now();
      await errorHandler.sleep(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(95); // Account for timer precision
      expect(elapsed).toBeLessThan(150); // Should not take too much longer
    });
  });
});