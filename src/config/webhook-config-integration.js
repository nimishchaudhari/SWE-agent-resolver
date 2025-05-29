const EnhancedConfigManager = require('./enhanced-config-manager');
const logger = require('../utils/logger');

/**
 * Webhook Configuration Integration
 * Integrates the enhanced configuration system with existing webhook handlers
 */
class WebhookConfigIntegration {
  constructor() {
    this.configManager = new EnhancedConfigManager();
    this.integrationCache = new Map();
  }

  /**
   * Process webhook with enhanced configuration
   * @param {object} parsedWebhook - Parsed webhook data
   * @param {object} trigger - Trigger information
   * @param {object} options - Processing options
   * @returns {Promise<object>} Enhanced webhook context with configuration
   */
  async processWebhookWithConfig(parsedWebhook, trigger, options = {}) {
    try {
      logger.info('Processing webhook with enhanced configuration', {
        event: parsedWebhook.event,
        repository: parsedWebhook.repository?.full_name,
        action: parsedWebhook.action
      });

      // Build webhook context for configuration
      const webhookContext = this.buildWebhookContext(parsedWebhook, trigger);
      
      // Generate configuration using the enhanced manager
      const configPackage = await this.configManager.handleWebhookConfiguration(
        webhookContext, 
        {
          ...options,
          validationMode: 'production',
          optimize: true,
          optimizationMode: options.optimizationMode || 'balanced'
        }
      );

      // Enhance the original webhook context with configuration
      const enhancedContext = {
        ...parsedWebhook,
        swe_agent_config: configPackage.config,
        configuration_metadata: configPackage.metadata,
        validation_status: configPackage.validation,
        optimization_results: configPackage.optimization,
        execution_artifacts: configPackage.artifacts,
        orchestrator_config: configPackage.orchestrator_config
      };

      // Add integration-specific metadata
      enhancedContext.integration_metadata = {
        processed_at: new Date().toISOString(),
        configuration_version: '1.0.0',
        integration_mode: options.integrationMode || 'enhanced',
        preset_applied: configPackage.metadata.preset_applied
      };

      logger.info('Webhook processing completed with configuration', {
        repository: parsedWebhook.repository?.full_name,
        config_valid: configPackage.validation.valid,
        optimization_applied: !!configPackage.optimization,
        preset: configPackage.metadata.preset_applied
      });

      return enhancedContext;

    } catch (error) {
      logger.error('Webhook configuration processing failed:', error);
      
      // Return enhanced context with error fallback
      return {
        ...parsedWebhook,
        swe_agent_config: this.getErrorFallbackConfig(parsedWebhook),
        configuration_error: error.message,
        integration_metadata: {
          processed_at: new Date().toISOString(),
          error: error.message,
          fallback_used: true
        }
      };
    }
  }

  /**
   * Integrate with existing GitHub handler
   * @param {object} originalHandler - Original GitHub webhook handler
   * @returns {function} Enhanced handler function
   */
  enhanceGitHubHandler(originalHandler) {
    return async (req, res) => {
      try {
        // Parse webhook using original handler logic
        const parsedWebhook = await this.extractWebhookData(req);
        
        // Extract trigger information
        const trigger = await this.extractTriggerInfo(parsedWebhook);
        
        // Process with enhanced configuration
        const enhancedContext = await this.processWebhookWithConfig(
          parsedWebhook, 
          trigger,
          {
            integrationMode: 'github_handler',
            optimizationMode: 'performance'
          }
        );

        // Attach enhanced context to request for downstream processing
        req.enhancedWebhookContext = enhancedContext;
        req.sweAgentConfig = enhancedContext.swe_agent_config;
        req.configurationPackage = {
          config: enhancedContext.swe_agent_config,
          metadata: enhancedContext.configuration_metadata,
          validation: enhancedContext.validation_status,
          artifacts: enhancedContext.execution_artifacts
        };

        // Call original handler with enhanced context
        return await originalHandler(req, res);

      } catch (error) {
        logger.error('Enhanced GitHub handler failed:', error);
        
        // Fallback to original handler
        return await originalHandler(req, res);
      }
    };
  }

  /**
   * Integrate with orchestrator
   * @param {object} orchestratorContext - Orchestrator context
   * @param {object} options - Integration options
   * @returns {Promise<object>} Enhanced orchestrator context
   */
  async integrateWithOrchestrator(orchestratorContext, options = {}) {
    try {
      logger.info('Integrating with orchestrator', {
        task_id: orchestratorContext.taskId,
        repository: orchestratorContext.githubContext?.repository
      });

      // Prepare orchestration configuration
      const orchestratorConfig = await this.configManager.prepareOrchestrationConfiguration(
        orchestratorContext,
        {
          ...options,
          optimize: true,
          validationMode: 'production',
          applyCostOptimizations: true,
          applyPerformanceOptimizations: true
        }
      );

      // Enhanced orchestrator context
      const enhancedContext = {
        ...orchestratorContext,
        swe_agent_config: orchestratorConfig.config,
        execution_config: orchestratorConfig.orchestrator_config,
        configuration_package: orchestratorConfig,
        
        // Enhanced execution parameters
        execution_parameters: {
          workspace_path: orchestratorConfig.orchestrator_config.execution_context.workspace_path,
          resource_limits: orchestratorConfig.orchestrator_config.execution_context.resource_limits,
          environment_variables: orchestratorConfig.artifacts.environment_variables,
          cli_command: orchestratorConfig.orchestrator_config.cli_command,
          deployment_mode: orchestratorConfig.orchestrator_config.execution_context.deployment_mode
        },
        
        // Monitoring configuration
        monitoring_config: {
          cost_tracking: orchestratorConfig.orchestrator_config.monitoring.cost_tracking,
          performance_metrics: orchestratorConfig.orchestrator_config.monitoring.performance_metrics,
          validation_status: orchestratorConfig.orchestrator_config.monitoring.validation_status
        }
      };

      logger.info('Orchestrator integration completed', {
        task_id: orchestratorContext.taskId,
        config_valid: orchestratorConfig.validation.valid,
        deployment_mode: enhancedContext.execution_parameters.deployment_mode
      });

      return enhancedContext;

    } catch (error) {
      logger.error('Orchestrator integration failed:', error);
      throw new Error(`Orchestrator integration failed: ${error.message}`);
    }
  }

  /**
   * Create configuration-aware task executor
   * @param {function} originalExecutor - Original task executor
   * @returns {function} Enhanced executor with configuration management
   */
  createConfigAwareExecutor(originalExecutor) {
    return async (taskContext) => {
      try {
        logger.info('Executing task with configuration awareness', {
          task_id: taskContext.taskId,
          task_type: taskContext.taskType
        });

        // Enhance task context with configuration if not already present
        if (!taskContext.swe_agent_config) {
          const enhancedContext = await this.integrateWithOrchestrator(taskContext, {
            optimizationMode: 'performance',
            preset: this.selectPresetFromTaskType(taskContext.taskType)
          });
          
          // Update task context
          Object.assign(taskContext, enhancedContext);
        }

        // Add pre-execution configuration validation
        const preExecutionValidation = await this.validatePreExecution(taskContext);
        if (!preExecutionValidation.valid) {
          logger.warn('Pre-execution validation failed', preExecutionValidation.warnings);
          
          // Apply auto-corrections if possible
          if (preExecutionValidation.auto_corrections) {
            taskContext = await this.applyAutoCorrections(taskContext, preExecutionValidation.auto_corrections);
          }
        }

        // Execute with monitoring
        const executionResult = await this.executeWithMonitoring(originalExecutor, taskContext);

        // Post-execution analysis
        const postExecutionAnalysis = await this.analyzeExecution(taskContext, executionResult);

        return {
          ...executionResult,
          configuration_metadata: taskContext.configuration_package?.metadata,
          execution_analysis: postExecutionAnalysis,
          monitoring_data: taskContext.monitoring_config
        };

      } catch (error) {
        logger.error('Configuration-aware execution failed:', error);
        
        // Fallback to original executor
        return await originalExecutor(taskContext);
      }
    };
  }

  /**
   * Build webhook context for configuration generation
   */
  buildWebhookContext(parsedWebhook, trigger) {
    return {
      event: parsedWebhook.event,
      action: parsedWebhook.action,
      repository: parsedWebhook.repository,
      issue: parsedWebhook.issue,
      pull_request: parsedWebhook.pullRequest,
      comment: parsedWebhook.comment,
      sender: parsedWebhook.sender,
      ref: parsedWebhook.ref,
      after: parsedWebhook.after,
      delivery: parsedWebhook.delivery,
      trigger: trigger,
      webhookPayload: parsedWebhook
    };
  }

  /**
   * Extract webhook data from request
   */
  async extractWebhookData(req) {
    // This would typically use the existing webhook parser
    // For now, return the parsed webhook from the request body
    return req.body || req.parsedWebhook;
  }

  /**
   * Extract trigger information
   */
  async extractTriggerInfo(parsedWebhook) {
    // This would typically use the existing trigger detector
    // For now, return basic trigger info based on event type
    const trigger = {
      triggered: false,
      commands: [],
      primaryCommand: null,
      context: {}
    };

    // Simple trigger detection based on event
    if (parsedWebhook.event === 'issues' && parsedWebhook.action === 'opened') {
      trigger.triggered = true;
      trigger.primaryCommand = {
        type: 'analyze',
        text: 'analyze issue',
        args: {}
      };
    } else if (parsedWebhook.event === 'pull_request' && ['opened', 'synchronize'].includes(parsedWebhook.action)) {
      trigger.triggered = true;
      trigger.primaryCommand = {
        type: 'review',
        text: 'review pull request',
        args: {}
      };
    }

    return trigger;
  }

  /**
   * Get error fallback configuration
   */
  getErrorFallbackConfig(parsedWebhook) {
    return {
      problem_statement: {
        type: 'general_task',
        description: `Process ${parsedWebhook.event} event (error fallback)`,
        context: {
          event: parsedWebhook.event,
          repository: parsedWebhook.repository?.full_name
        }
      },
      agent: {
        model: {
          name: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic',
          temperature: 0.0,
          timeout: 300000
        },
        parser: {
          name: 'ToolCallingParser',
          function_calling: true
        },
        history_processor: {
          name: 'DefaultHistoryProcessor',
          window_size: 4000
        },
        tools: [
          { name: 'str_replace_editor' },
          { name: 'bash' },
          { name: 'file_viewer' }
        ],
        max_iterations: 30,
        cost_limit: 5.0
      },
      env: {
        repo: {
          github_url: `https://github.com/${parsedWebhook.repository?.full_name || 'unknown/unknown'}.git`,
          base_commit: 'HEAD'
        },
        workspace: {
          mount_path: '/tmp/swe-agent-workspace',
          cleanup: true
        },
        secrets: {
          github_token: 'GITHUB_TOKEN',
          model_api_key: 'ANTHROPIC_API_KEY'
        }
      }
    };
  }

  /**
   * Select preset based on task type
   */
  selectPresetFromTaskType(taskType) {
    const presetMap = {
      'issue_analysis': 'issue_analysis',
      'pr_review': 'pr_review',
      'code_fix': 'code_fix',
      'test_generation': 'test_generation',
      'bug_fix': 'code_fix',
      'feature_implementation': 'code_fix',
      'code_review': 'pr_review'
    };

    return presetMap[taskType] || 'issue_analysis';
  }

  /**
   * Validate configuration before execution
   */
  async validatePreExecution(taskContext) {
    const validation = {
      valid: true,
      warnings: [],
      auto_corrections: []
    };

    try {
      // Check required secrets
      const requiredSecrets = this.getRequiredSecrets(taskContext.swe_agent_config);
      for (const secret of requiredSecrets) {
        if (!process.env[secret]) {
          validation.valid = false;
          validation.warnings.push(`Required secret ${secret} is not available`);
        }
      }

      // Check resource availability
      const resourceLimits = taskContext.execution_parameters?.resource_limits;
      if (resourceLimits) {
        if (this.parseMemoryLimit(resourceLimits.memory) > 16384) {
          validation.warnings.push('High memory allocation requested');
          validation.auto_corrections.push({
            type: 'memory_limit',
            current: resourceLimits.memory,
            suggested: '8GB'
          });
        }
      }

      // Check workspace permissions
      const workspacePath = taskContext.execution_parameters?.workspace_path;
      if (workspacePath && !this.isValidWorkspacePath(workspacePath)) {
        validation.valid = false;
        validation.warnings.push('Invalid workspace path');
      }

    } catch (error) {
      validation.valid = false;
      validation.warnings.push(`Pre-execution validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Apply auto-corrections to task context
   */
  async applyAutoCorrections(taskContext, corrections) {
    for (const correction of corrections) {
      switch (correction.type) {
        case 'memory_limit':
          if (taskContext.execution_parameters?.resource_limits) {
            taskContext.execution_parameters.resource_limits.memory = correction.suggested;
          }
          logger.info('Applied memory limit correction', {
            from: correction.current,
            to: correction.suggested
          });
          break;
      }
    }

    return taskContext;
  }

  /**
   * Execute with monitoring
   */
  async executeWithMonitoring(originalExecutor, taskContext) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      // Execute the original task
      const result = await originalExecutor(taskContext);

      // Calculate execution metrics
      const endTime = Date.now();
      const endMemory = process.memoryUsage();

      const executionMetrics = {
        execution_time_ms: endTime - startTime,
        memory_usage: {
          heap_used_start: startMemory.heapUsed,
          heap_used_end: endMemory.heapUsed,
          memory_delta: endMemory.heapUsed - startMemory.heapUsed
        },
        success: true
      };

      return {
        ...result,
        execution_metrics: executionMetrics
      };

    } catch (error) {
      const endTime = Date.now();
      
      const executionMetrics = {
        execution_time_ms: endTime - startTime,
        success: false,
        error: error.message
      };

      throw {
        ...error,
        execution_metrics: executionMetrics
      };
    }
  }

  /**
   * Analyze execution results
   */
  async analyzeExecution(taskContext, executionResult) {
    const analysis = {
      performance: {
        execution_time: executionResult.execution_metrics?.execution_time_ms,
        memory_efficiency: this.calculateMemoryEfficiency(executionResult.execution_metrics),
        success_rate: executionResult.execution_metrics?.success ? 1.0 : 0.0
      },
      cost: {
        estimated_cost: this.estimateExecutionCost(taskContext, executionResult),
        cost_efficiency: this.calculateCostEfficiency(taskContext, executionResult)
      },
      configuration: {
        optimization_effectiveness: this.assessOptimizationEffectiveness(taskContext, executionResult),
        configuration_accuracy: this.assessConfigurationAccuracy(taskContext, executionResult)
      }
    };

    return analysis;
  }

  /**
   * Utility methods
   */
  getRequiredSecrets(config) {
    const secrets = ['GITHUB_TOKEN'];
    
    const provider = config.agent?.model?.provider;
    switch (provider) {
      case 'anthropic':
        secrets.push('ANTHROPIC_API_KEY');
        break;
      case 'openai':
        secrets.push('OPENAI_API_KEY');
        break;
      case 'azure':
        secrets.push('AZURE_OPENAI_API_KEY');
        break;
      case 'google':
        secrets.push('GOOGLE_API_KEY');
        break;
    }

    if (config.env?.modal) {
      secrets.push('MODAL_TOKEN');
    }

    return secrets;
  }

  parseMemoryLimit(memoryString) {
    const match = memoryString.match(/^(\d+)(GB|MB)$/);
    if (!match) return 0;
    
    const [, amount, unit] = match;
    return unit === 'GB' ? parseInt(amount) * 1024 : parseInt(amount);
  }

  isValidWorkspacePath(path) {
    // Basic validation for workspace path
    return path.startsWith('/') && 
           !path.includes('..') && 
           !path.startsWith('/etc') && 
           !path.startsWith('/root');
  }

  calculateMemoryEfficiency(executionMetrics) {
    if (!executionMetrics?.memory_usage) return 0.5;
    
    const memoryUsed = executionMetrics.memory_usage.memory_delta;
    const executionTime = executionMetrics.execution_time_ms;
    
    // Simple efficiency calculation: less memory per second is better
    return Math.max(0, Math.min(1, 1 - (memoryUsed / (executionTime || 1000))));
  }

  estimateExecutionCost(taskContext, executionResult) {
    // Simple cost estimation based on execution time and configuration
    const executionTime = executionResult.execution_metrics?.execution_time_ms || 0;
    const costLimit = taskContext.swe_agent_config?.agent?.cost_limit || 0;
    
    // Estimate cost as a fraction of time vs expected time
    const expectedTime = 300000; // 5 minutes
    return (executionTime / expectedTime) * costLimit;
  }

  calculateCostEfficiency(taskContext, executionResult) {
    const estimatedCost = this.estimateExecutionCost(taskContext, executionResult);
    const costLimit = taskContext.swe_agent_config?.agent?.cost_limit || 1;
    
    return Math.max(0, Math.min(1, 1 - (estimatedCost / costLimit)));
  }

  assessOptimizationEffectiveness(taskContext, executionResult) {
    // Assess how effective the optimization was
    const optimizationApplied = !!taskContext.configuration_package?.optimization;
    const executionSuccess = executionResult.execution_metrics?.success;
    
    if (!optimizationApplied) return 0.5;
    if (!executionSuccess) return 0.3;
    
    return 0.8; // Good optimization effectiveness
  }

  assessConfigurationAccuracy(taskContext, executionResult) {
    // Assess how accurate the configuration was for the task
    const configValid = taskContext.configuration_package?.validation?.valid;
    const executionSuccess = executionResult.execution_metrics?.success;
    
    if (!configValid && !executionSuccess) return 0.2;
    if (!configValid && executionSuccess) return 0.6;
    if (configValid && !executionSuccess) return 0.7;
    if (configValid && executionSuccess) return 0.9;
    
    return 0.5;
  }

  /**
   * Get integration status
   */
  getIntegrationStatus() {
    return {
      config_manager_status: this.configManager.getConfigurationStatus(),
      integration_cache_size: this.integrationCache.size,
      components: {
        webhook_integration: 'ready',
        orchestrator_integration: 'ready',
        execution_monitoring: 'ready'
      },
      last_processed: this.getLastProcessedInfo()
    };
  }

  getLastProcessedInfo() {
    // Implementation would track last processed webhook
    return {
      timestamp: new Date().toISOString(),
      event_type: 'unknown',
      repository: 'unknown'
    };
  }

  /**
   * Clear integration caches
   */
  clearCaches() {
    this.integrationCache.clear();
    this.configManager.clearCaches();
    logger.info('Webhook integration caches cleared');
  }
}

module.exports = WebhookConfigIntegration;