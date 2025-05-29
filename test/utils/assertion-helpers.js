/**
 * Custom assertion helpers for testing SWE-agent functionality
 */
class AssertionHelpers {
  /**
   * Assert that a webhook response has the expected structure
   */
  static assertWebhookResponse(response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    
    if (expectedStatus === 200) {
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('success');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    }
  }

  /**
   * Assert that SWE-agent execution result has correct structure
   */
  static assertSWEAgentResult(result) {
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('task');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('execution_time');
    expect(typeof result.execution_time).toBe('number');
    expect(result.execution_time).toBeGreaterThan(0);
    
    if (result.status === 'success') {
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('workspace');
    }
  }

  /**
   * Assert that a configuration object is valid
   */
  static assertValidConfiguration(config) {
    expect(config).toHaveProperty('server');
    expect(config.server).toHaveProperty('port');
    expect(config.server).toHaveProperty('host');
    
    expect(config).toHaveProperty('github');
    expect(config.github).toHaveProperty('webhookSecret');
    expect(config.github).toHaveProperty('token');
    
    expect(config).toHaveProperty('sweAgent');
    expect(config.sweAgent).toHaveProperty('path');
    expect(config.sweAgent).toHaveProperty('timeout');
    expect(config.sweAgent).toHaveProperty('maxConcurrentJobs');
    
    expect(config).toHaveProperty('logging');
    expect(config.logging).toHaveProperty('level');
  }

  /**
   * Assert that performance metrics meet requirements
   */
  static assertPerformanceRequirements(metrics, requirements = {}) {
    const defaults = {
      maxResponseTime: 1000, // 1 second
      minThroughput: 10, // 10 requests per second
      maxMemoryGrowth: 100 * 1024 * 1024, // 100MB
      minSuccessRate: 0.95 // 95%
    };
    
    const reqs = { ...defaults, ...requirements };
    
    if (metrics.responseTime !== undefined) {
      expect(metrics.responseTime).toBeLessThanOrEqual(reqs.maxResponseTime);
    }
    
    if (metrics.throughput !== undefined) {
      expect(metrics.throughput).toBeGreaterThanOrEqual(reqs.minThroughput);
    }
    
    if (metrics.memoryGrowth !== undefined) {
      expect(metrics.memoryGrowth).toBeLessThanOrEqual(reqs.maxMemoryGrowth);
    }
    
    if (metrics.successRate !== undefined) {
      expect(metrics.successRate).toBeGreaterThanOrEqual(reqs.minSuccessRate);
    }
  }

  /**
   * Assert that webhook signature is valid
   */
  static assertValidWebhookSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    expect(signature).toBe(`sha256=${expectedSignature}`);
  }

  /**
   * Assert that GitHub webhook has required headers
   */
  static assertWebhookHeaders(headers) {
    expect(headers).toHaveProperty('x-github-event');
    expect(headers).toHaveProperty('x-github-delivery');
    expect(headers).toHaveProperty('x-hub-signature-256');
    expect(headers).toHaveProperty('content-type');
    expect(headers['content-type']).toContain('application/json');
  }

  /**
   * Assert that execution history contains expected operations
   */
  static assertExecutionHistory(history, expectedOperations) {
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(expectedOperations.length);
    
    expectedOperations.forEach((expectedOp, index) => {
      const actualOp = history[index];
      expect(actualOp).toHaveProperty('command', expectedOp.command);
      
      if (expectedOp.args) {
        expectedOp.args.forEach(arg => {
          expect(actualOp.args).toContain(arg);
        });
      }
      
      if (expectedOp.status) {
        expect(actualOp.result?.status).toBe(expectedOp.status);
      }
    });
  }

  /**
   * Assert that memory usage is within acceptable bounds
   */
  static assertMemoryUsage(memoryUsage, maxHeapUsed = 100 * 1024 * 1024) {
    expect(memoryUsage).toHaveProperty('rss');
    expect(memoryUsage).toHaveProperty('heapTotal');
    expect(memoryUsage).toHaveProperty('heapUsed');
    expect(memoryUsage).toHaveProperty('external');
    
    expect(memoryUsage.heapUsed).toBeLessThanOrEqual(maxHeapUsed);
  }

  /**
   * Assert that response time meets SLA requirements
   */
  static assertResponseTimeSLA(responseTime, maxTime = 1000) {
    expect(responseTime).toBeGreaterThan(0);
    expect(responseTime).toBeLessThanOrEqual(maxTime);
  }

  /**
   * Assert that concurrent operations complete successfully
   */
  static assertConcurrentExecution(results, expectedCount, minSuccessRate = 0.95) {
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(expectedCount);
    
    const successfulResults = results.filter(result => 
      result.status === 200 || result.body?.status === 'success'
    );
    
    const successRate = successfulResults.length / results.length;
    expect(successRate).toBeGreaterThanOrEqual(minSuccessRate);
  }

  /**
   * Assert that error handling works correctly
   */
  static assertErrorHandling(errorResponse, expectedErrorType) {
    expect(errorResponse.status).toBeGreaterThanOrEqual(400);
    expect(errorResponse.body).toHaveProperty('error');
    
    if (expectedErrorType) {
      expect(errorResponse.body.error).toContain(expectedErrorType);
    }
  }

  /**
   * Assert that logs contain expected entries
   */
  static assertLogEntries(logs, expectedEntries) {
    expectedEntries.forEach(expectedEntry => {
      const found = logs.some(logEntry => {
        if (expectedEntry.level && logEntry.level !== expectedEntry.level) {
          return false;
        }
        
        if (expectedEntry.message) {
          return logEntry.message.includes(expectedEntry.message);
        }
        
        return true;
      });
      
      expect(found).toBe(true);
    });
  }

  /**
   * Assert that resource monitoring data is valid
   */
  static assertResourceMonitoring(monitoringData) {
    expect(monitoringData).toHaveProperty('memory');
    expect(monitoringData).toHaveProperty('cpu');
    expect(monitoringData).toHaveProperty('timestamp');
    
    expect(monitoringData.memory).toHaveProperty('percentage');
    expect(monitoringData.cpu).toHaveProperty('percentage');
    
    expect(monitoringData.memory.percentage).toBeGreaterThanOrEqual(0);
    expect(monitoringData.memory.percentage).toBeLessThanOrEqual(100);
    expect(monitoringData.cpu.percentage).toBeGreaterThanOrEqual(0);
  }

  /**
   * Assert that file operations are safe and valid
   */
  static async assertFileOperations(filePath, expectedContent = null) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Check that file exists
    expect(await this.fileExists(filePath)).toBe(true);
    
    // Check that file is in expected location (security check)
    const resolvedPath = path.resolve(filePath);
    const allowedPaths = [
      path.resolve('/tmp'),
      path.resolve(process.cwd(), 'test'),
      path.resolve(process.cwd(), 'logs')
    ];
    
    const isInAllowedPath = allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    );
    expect(isInAllowedPath).toBe(true);
    
    // Check content if specified
    if (expectedContent !== null) {
      const actualContent = await fs.readFile(filePath, 'utf8');
      if (typeof expectedContent === 'string') {
        expect(actualContent).toContain(expectedContent);
      } else if (expectedContent instanceof RegExp) {
        expect(actualContent).toMatch(expectedContent);
      }
    }
  }

  /**
   * Helper method to check if file exists
   */
  static async fileExists(filePath) {
    const fs = require('fs').promises;
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Assert that network calls are made correctly
   */
  static assertNetworkCall(mockCall, expectedUrl, expectedMethod = 'POST', expectedHeaders = {}) {
    expect(mockCall).toHaveBeenCalled();
    
    const callArgs = mockCall.mock.calls[mockCall.mock.calls.length - 1];
    const [url, options] = callArgs;
    
    expect(url).toContain(expectedUrl);
    
    if (options) {
      expect(options.method || 'GET').toBe(expectedMethod);
      
      Object.entries(expectedHeaders).forEach(([header, value]) => {
        expect(options.headers).toHaveProperty(header, value);
      });
    }
  }

  /**
   * Assert that security measures are in place
   */
  static assertSecurityMeasures(securityData) {
    // Check that sensitive data is not logged
    expect(securityData.logs || []).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/token/i),
        expect.stringMatching(/secret/i),
        expect.stringMatching(/password/i)
      ])
    );
    
    // Check that webhooks are validated
    if (securityData.webhookValidation) {
      expect(securityData.webhookValidation).toHaveProperty('signatureVerified', true);
    }
    
    // Check that rate limiting is applied
    if (securityData.rateLimiting) {
      expect(securityData.rateLimiting).toHaveProperty('enabled', true);
    }
  }

  /**
   * Assert that deployment configuration is environment-appropriate
   */
  static assertDeploymentConfiguration(config, environment) {
    const environmentRequirements = {
      local: {
        maxConcurrentJobs: { max: 5 },
        logging: { level: ['debug', 'info'] }
      },
      docker: {
        server: { host: '0.0.0.0' },
        logging: { format: 'json' }
      },
      modal: {
        sweAgent: { maxConcurrentJobs: { min: 5 } },
        performance: { enableCaching: true }
      },
      production: {
        logging: { level: ['warn', 'error', 'info'] },
        security: { validateWebhooks: true }
      }
    };
    
    const requirements = environmentRequirements[environment];
    if (!requirements) return;
    
    Object.entries(requirements).forEach(([section, sectionReqs]) => {
      expect(config).toHaveProperty(section);
      
      Object.entries(sectionReqs).forEach(([key, requirement]) => {
        if (requirement.min !== undefined) {
          expect(config[section][key]).toBeGreaterThanOrEqual(requirement.min);
        }
        if (requirement.max !== undefined) {
          expect(config[section][key]).toBeLessThanOrEqual(requirement.max);
        }
        if (Array.isArray(requirement)) {
          expect(requirement).toContain(config[section][key]);
        }
        if (typeof requirement === 'boolean') {
          expect(config[section][key]).toBe(requirement);
        }
      });
    });
  }

  /**
   * Assert that webhook sequence is processed in correct order
   */
  static assertWebhookSequence(executionHistory, expectedSequence) {
    expect(executionHistory.length).toBeGreaterThanOrEqual(expectedSequence.length);
    
    expectedSequence.forEach((expectedStep, index) => {
      const execution = executionHistory[index];
      expect(execution).toHaveProperty('command', expectedStep.command);
      
      if (expectedStep.args) {
        expectedStep.args.forEach(arg => {
          expect(execution.args).toContain(arg);
        });
      }
      
      if (expectedStep.order) {
        expect(execution.startTime).toBeDefined();
        if (index > 0) {
          expect(execution.startTime).toBeGreaterThanOrEqual(executionHistory[index - 1].startTime);
        }
      }
    });
  }
}

module.exports = AssertionHelpers;