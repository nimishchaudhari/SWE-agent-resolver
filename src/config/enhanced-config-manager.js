const GitHubEnvMapper = require('./github-env-mapper');
const SWEAgentConfigGenerator = require('./swe-agent-config-generator');
const ComprehensiveConfigValidator = require('./comprehensive-config-validator');
const GitHubContextIntegrator = require('./github-context-integrator');
const PerformanceCostOptimizer = require('./performance-cost-optimizer');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Enhanced Configuration Manager
 * Central hub for SWE-agent configuration management with GitHub integration
 */
class EnhancedConfigManager {
  constructor() {
    this.envMapper = new GitHubEnvMapper();
    this.configGenerator = new SWEAgentConfigGenerator();
    this.validator = new ComprehensiveConfigValidator();
    this.contextIntegrator = new GitHubContextIntegrator();
    this.optimizer = new PerformanceCostOptimizer();
    
    this.configCache = new Map();
    this.generationHistory = new Map();
    
    // Configuration presets for common scenarios
    this.presets = {
      'issue_analysis': {
        description: 'Optimized for analyzing GitHub issues',
        profile: 'development',
        max_tokens: 8192,
        max_iterations: 30,
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'grep']
      },
      'pr_review': {
        description: 'Optimized for reviewing pull requests',
        profile: 'testing',
        max_tokens: 16384,
        max_iterations: 40,
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'git']
      },
      'code_fix': {
        description: 'Optimized for fixing code issues',
        profile: 'production',
        max_tokens: 12288,
        max_iterations: 50,
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'git', 'grep']
      },
      'test_generation': {
        description: 'Optimized for generating tests',
        profile: 'testing',
        max_tokens: 8192,
        max_iterations: 25,
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'test_runner']
      }
    };
  }

  /**
   * Generate complete SWE-agent configuration from GitHub context
   * @param {object} githubContext - GitHub Actions context
   * @param {object} problemContext - Problem/issue context from webhooks
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Complete configuration package
   */
  async generateConfiguration(githubContext, problemContext, options = {}) {
    try {
      const startTime = Date.now();
      logger.info('Starting configuration generation', {
        repository: githubContext.repository,
        event: githubContext.event_name,
        preset: options.preset
      });

      // Step 1: Integrate GitHub context
      const integratedContext = await this.contextIntegrator.integrateGitHubContext(
        githubContext, 
        problemContext.webhookPayload
      );

      // Step 2: Apply preset if specified
      if (options.preset && this.presets[options.preset]) {
        options = this.applyPreset(options.preset, options);
      }

      // Step 3: Generate base configuration
      const configResult = await this.configGenerator.generateConfiguration(
        integratedContext.github,
        problemContext,
        options
      );

      // Step 4: Validate configuration
      const validationResult = await this.validator.validateConfiguration(
        configResult.config,
        {
          mode: options.validationMode || 'production',
          generateFallback: true,
          skipNetworkValidation: options.skipNetworkValidation || false
        }
      );

      // Step 5: Optimize if requested
      let optimizationResult = null;
      if (options.optimize !== false) {
        optimizationResult = await this.optimizer.optimizeConfiguration(
          validationResult.valid ? configResult.config : validationResult.fallback,
          {
            optimizationMode: options.optimizationMode || 'balanced',
            applyCostOptimizations: options.applyCostOptimizations !== false,
            applyPerformanceOptimizations: options.applyPerformanceOptimizations !== false
          }
        );
      }

      // Step 6: Generate final configuration package
      const finalConfig = optimizationResult ? 
        optimizationResult.optimized_config : 
        (validationResult.valid ? configResult.config : validationResult.fallback);

      const configPackage = {
        // Core configuration
        config: finalConfig,
        yaml: configResult.yaml,
        
        // Generation metadata
        metadata: {
          generated_at: new Date().toISOString(),
          generation_time_ms: Date.now() - startTime,
          generator_version: '1.0.0',
          github_context: integratedContext,
          preset_applied: options.preset || null,
          optimization_applied: !!optimizationResult
        },
        
        // Validation results
        validation: {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          fallback_used: !validationResult.valid
        },
        
        // Optimization results (if applied)
        optimization: optimizationResult ? {
          cost_impact: optimizationResult.cost_impact,
          performance_impact: optimizationResult.performance_impact,
          applied_strategies: optimizationResult.recommendations.applied_strategies,
          estimated_savings: optimizationResult.metadata.estimated_savings
        } : null,
        
        // Ready-to-use artifacts
        artifacts: {
          config_file_path: null, // Will be set if written to file
          cli_args: this.generateCLIArgs(finalConfig),
          environment_variables: this.generateEnvironmentVariables(finalConfig),
          deployment_instructions: this.generateDeploymentInstructions(finalConfig, integratedContext)
        }
      };

      // Cache the result
      const cacheKey = this.generateCacheKey(githubContext, problemContext, options);
      this.configCache.set(cacheKey, {
        package: configPackage,
        timestamp: Date.now()
      });

      // Track generation history
      this.trackGenerationHistory(githubContext, configPackage);

      logger.info('Configuration generation completed', {
        repository: githubContext.repository,
        generation_time: configPackage.metadata.generation_time_ms,
        validation_status: validationResult.valid ? 'valid' : 'fallback',
        optimization_applied: !!optimizationResult
      });

      return configPackage;

    } catch (error) {
      logger.error('Configuration generation failed:', error);
      return this.generateErrorFallback(githubContext, problemContext, error, options);
    }
  }

  /**
   * Generate configuration and write to file
   * @param {object} githubContext - GitHub Actions context
   * @param {object} problemContext - Problem context
   * @param {string} outputPath - Output file path
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Configuration package with file path
   */
  async generateConfigurationFile(githubContext, problemContext, outputPath, options = {}) {
    const configPackage = await this.generateConfiguration(githubContext, problemContext, options);
    
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Write YAML configuration to file
      await fs.writeFile(outputPath, configPackage.yaml, 'utf8');
      
      // Update artifacts with file path
      configPackage.artifacts.config_file_path = outputPath;
      
      logger.info('Configuration written to file', { path: outputPath });
      
      return configPackage;
      
    } catch (error) {
      logger.error('Failed to write configuration file:', error);
      configPackage.artifacts.file_write_error = error.message;
      return configPackage;
    }
  }

  /**
   * Integration with webhook handler
   * @param {object} webhookContext - Parsed webhook context
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Configuration package ready for SWE-agent
   */
  async handleWebhookConfiguration(webhookContext, options = {}) {
    try {
      // Extract GitHub context from webhook
      const githubContext = {
        repository: webhookContext.repository?.full_name,
        ref: webhookContext.ref || `refs/heads/${webhookContext.repository?.default_branch || 'main'}`,
        sha: webhookContext.after || webhookContext.pull_request?.head?.sha || 'HEAD',
        actor: webhookContext.sender?.login,
        event_name: webhookContext.event,
        workflow: 'SWE-Agent Webhook Handler',
        server_url: 'https://github.com',
        workspace: process.env.GITHUB_WORKSPACE || '/workspace'
      };

      // Build problem context from webhook data
      const problemContext = {
        event: webhookContext.event,
        issue: webhookContext.issue,
        pullRequest: webhookContext.pull_request,
        comment: webhookContext.comment,
        repository: webhookContext.repository,
        trigger: webhookContext.trigger,
        webhookPayload: webhookContext
      };

      // Auto-select preset based on webhook event
      if (!options.preset) {
        options.preset = this.selectPresetFromWebhook(webhookContext);
      }

      // Generate configuration
      const configPackage = await this.generateConfiguration(githubContext, problemContext, {
        ...options,
        validationMode: 'production',
        optimize: true,
        optimizationMode: 'balanced'
      });

      // Add webhook-specific metadata
      configPackage.metadata.webhook_context = {
        event: webhookContext.event,
        action: webhookContext.action,
        delivery_id: webhookContext.delivery,
        processed_at: new Date().toISOString()
      };

      return configPackage;

    } catch (error) {
      logger.error('Webhook configuration handling failed:', error);
      throw new Error(`Webhook configuration failed: ${error.message}`);
    }
  }

  /**
   * Integration with orchestrator
   * @param {object} orchestrationContext - Orchestration context
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Configuration ready for orchestrator execution
   */
  async prepareOrchestrationConfiguration(orchestrationContext, options = {}) {
    try {
      const configPackage = await this.generateConfiguration(
        orchestrationContext.githubContext,
        orchestrationContext.problemContext,
        {
          ...options,
          optimize: true,
          validationMode: 'production',
          applyCostOptimizations: true,
          applyPerformanceOptimizations: true
        }
      );

      // Generate orchestrator-specific artifacts
      const orchestratorConfig = {
        swe_agent_config: configPackage.config,
        execution_context: {
          workspace_path: configPackage.config.env.workspace.mount_path,
          github_token: process.env.GITHUB_TOKEN,
          model_api_key: this.getModelApiKey(configPackage.config),
          deployment_mode: this.detectDeploymentMode(configPackage.config),
          resource_limits: this.extractResourceLimits(configPackage.config)
        },
        monitoring: {
          cost_tracking: configPackage.optimization?.cost_impact || null,
          performance_metrics: configPackage.optimization?.performance_impact || null,
          validation_status: configPackage.validation
        },
        cli_command: this.generateSWEAgentCommand(configPackage),
        environment_setup: this.generateEnvironmentSetup(configPackage)
      };

      return {
        ...configPackage,
        orchestrator_config: orchestratorConfig
      };

    } catch (error) {
      logger.error('Orchestration configuration preparation failed:', error);
      throw new Error(`Orchestration configuration failed: ${error.message}`);
    }
  }

  /**
   * Apply configuration preset
   */
  applyPreset(presetName, options) {
    const preset = this.presets[presetName];
    if (!preset) {
      logger.warn(`Unknown preset: ${presetName}`);
      return options;
    }

    logger.info(`Applying preset: ${presetName}`, { description: preset.description });

    return {
      ...options,
      performanceProfile: preset.profile,
      maxTokens: preset.max_tokens,
      maxIterations: preset.max_iterations,
      requiredTools: preset.tools,
      preset: presetName
    };
  }

  /**
   * Select appropriate preset from webhook context
   */
  selectPresetFromWebhook(webhookContext) {
    const event = webhookContext.event;
    const action = webhookContext.action;

    // Pull request events
    if (event === 'pull_request' && ['opened', 'synchronize'].includes(action)) {
      return 'pr_review';
    }

    // Issue events
    if (event === 'issues' && action === 'opened') {
      return 'issue_analysis';
    }

    // Comment events with commands
    if (event === 'issue_comment' || event === 'pull_request_review_comment') {
      const comment = webhookContext.comment?.body?.toLowerCase() || '';
      
      if (comment.includes('fix') || comment.includes('bug')) {
        return 'code_fix';
      }
      if (comment.includes('test')) {
        return 'test_generation';
      }
      if (comment.includes('review')) {
        return 'pr_review';
      }
    }

    // Default to issue analysis
    return 'issue_analysis';
  }

  /**
   * Generate CLI arguments for SWE-agent
   */
  generateCLIArgs(config) {
    const args = [];

    // Problem statement
    if (config.problem_statement?.description) {
      args.push('--problem_statement', `"${config.problem_statement.description}"`);
    }

    // Repository
    if (config.env?.repo?.github_url) {
      args.push('--repo_path', config.env.repo.github_url);
    }

    // Model configuration
    if (config.agent?.model?.name) {
      args.push('--model_name', config.agent.model.name);
    }

    // Configuration file (if written to disk)
    args.push('--config_file', './swe-agent-config.yaml');

    // Resource limits
    if (config.agent?.cost_limit) {
      args.push('--cost_limit', config.agent.cost_limit.toString());
    }

    if (config.agent?.max_iterations) {
      args.push('--max_iterations', config.agent.max_iterations.toString());
    }

    return args;
  }

  /**
   * Generate environment variables
   */
  generateEnvironmentVariables(config) {
    const env = {};

    // Model API key
    const modelProvider = config.agent?.model?.provider;
    if (modelProvider === 'anthropic') {
      env.ANTHROPIC_API_KEY = '${ANTHROPIC_API_KEY}';
    } else if (modelProvider === 'openai') {
      env.OPENAI_API_KEY = '${OPENAI_API_KEY}';
    }

    // GitHub token
    env.GITHUB_TOKEN = '${GITHUB_TOKEN}';

    // Workspace configuration
    if (config.env?.workspace?.mount_path) {
      env.SWE_AGENT_WORKSPACE = config.env.workspace.mount_path;
    }

    // Logging
    env.LOG_LEVEL = config.env?.environment_variables?.LOG_LEVEL || 'INFO';

    // Deployment-specific variables
    if (config.env?.modal) {
      env.MODAL_TOKEN = '${MODAL_TOKEN}';
    }

    if (config.env?.docker) {
      env.DOCKER_BUILDKIT = '1';
    }

    return env;
  }

  /**
   * Generate deployment instructions
   */
  generateDeploymentInstructions(config, integratedContext) {
    const instructions = {
      deployment_mode: this.detectDeploymentMode(config),
      prerequisites: [],
      setup_commands: [],
      execution_commands: [],
      cleanup_commands: []
    };

    // Prerequisites
    instructions.prerequisites.push('GitHub token with repository access');
    
    const modelProvider = config.agent?.model?.provider;
    if (modelProvider === 'anthropic') {
      instructions.prerequisites.push('Anthropic API key');
    } else if (modelProvider === 'openai') {
      instructions.prerequisites.push('OpenAI API key');
    }

    // Setup commands
    if (instructions.deployment_mode === 'docker') {
      instructions.setup_commands.push('docker pull sweagent/swe-agent:latest');
      instructions.setup_commands.push(`mkdir -p ${config.env.workspace.mount_path}`);
    } else if (instructions.deployment_mode === 'modal') {
      instructions.setup_commands.push('pip install modal');
      instructions.setup_commands.push('modal setup');
    }

    // Execution commands
    const cliArgs = this.generateCLIArgs(config);
    instructions.execution_commands.push(`swe-agent ${cliArgs.join(' ')}`);

    // Cleanup commands
    if (config.env?.workspace?.cleanup) {
      instructions.cleanup_commands.push(`rm -rf ${config.env.workspace.mount_path}`);
    }

    return instructions;
  }

  /**
   * Generate SWE-agent command
   */
  generateSWEAgentCommand(configPackage) {
    const config = configPackage.config;
    const args = this.generateCLIArgs(config);
    
    let command = 'swe-agent';
    
    // Add deployment-specific wrapper
    const deploymentMode = this.detectDeploymentMode(config);
    if (deploymentMode === 'docker') {
      const dockerArgs = [
        'docker run --rm',
        `-v ${config.env.workspace.mount_path}:/workspace`,
        '-e GITHUB_TOKEN=${GITHUB_TOKEN}',
        `-e ${this.getModelApiKeyEnvVar(config)}=\${${this.getModelApiKeyEnvVar(config)}}`,
        'sweagent/swe-agent:latest'
      ];
      command = `${dockerArgs.join(' ')} swe-agent`;
    } else if (deploymentMode === 'modal') {
      command = 'modal run swe-agent-modal.py';
    }

    return `${command} ${args.join(' ')}`;
  }

  /**
   * Generate environment setup
   */
  generateEnvironmentSetup(configPackage) {
    const config = configPackage.config;
    const env = this.generateEnvironmentVariables(config);
    
    return {
      environment_variables: env,
      workspace_setup: {
        path: config.env.workspace.mount_path,
        persistent: config.env.workspace.persistent,
        cleanup: config.env.workspace.cleanup
      },
      resource_allocation: this.extractResourceLimits(config),
      secrets_required: Object.keys(env).filter(key => env[key].startsWith('${'))
    };
  }

  /**
   * Utility methods
   */
  detectDeploymentMode(config) {
    if (config.env?.docker) return 'docker';
    if (config.env?.modal) return 'modal';
    return 'local';
  }

  getModelApiKey(config) {
    const provider = config.agent?.model?.provider;
    const envVarName = this.getModelApiKeyEnvVar(config);
    return process.env[envVarName];
  }

  getModelApiKeyEnvVar(config) {
    const provider = config.agent?.model?.provider;
    switch (provider) {
      case 'anthropic': return 'ANTHROPIC_API_KEY';
      case 'openai': return 'OPENAI_API_KEY';
      case 'azure': return 'AZURE_OPENAI_API_KEY';
      case 'google': return 'GOOGLE_API_KEY';
      default: return 'ANTHROPIC_API_KEY';
    }
  }

  extractResourceLimits(config) {
    return {
      memory: config.env?.docker?.memory_limit || 
              (config.env?.modal?.memory_mb ? `${config.env.modal.memory_mb}MB` : '4GB'),
      cpu: config.env?.docker?.cpu_limit || config.env?.modal?.cpu_count || 2,
      timeout: config.agent?.model?.timeout || 300000,
      cost_limit: config.agent?.cost_limit || 10.0
    };
  }

  generateCacheKey(githubContext, problemContext, options) {
    const keyData = {
      repository: githubContext.repository,
      sha: githubContext.sha,
      event: githubContext.event_name,
      issue_id: problemContext.issue?.number,
      pr_id: problemContext.pullRequest?.number,
      preset: options.preset,
      timestamp: Math.floor(Date.now() / 300000) // 5-minute granularity
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 32);
  }

  trackGenerationHistory(githubContext, configPackage) {
    const historyKey = githubContext.repository || 'unknown';
    
    if (!this.generationHistory.has(historyKey)) {
      this.generationHistory.set(historyKey, []);
    }

    const history = this.generationHistory.get(historyKey);
    history.push({
      timestamp: Date.now(),
      event: githubContext.event_name,
      preset: configPackage.metadata.preset_applied,
      validation_status: configPackage.validation.valid ? 'valid' : 'fallback',
      optimization_applied: configPackage.metadata.optimization_applied,
      generation_time: configPackage.metadata.generation_time_ms
    });

    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  generateErrorFallback(githubContext, problemContext, error, options) {
    logger.error('Generating error fallback configuration');

    return {
      config: {
        problem_statement: {
          type: 'general_task',
          description: 'Software engineering task (error fallback)',
          context: { error: error.message }
        },
        agent: {
          model: {
            name: 'claude-3-5-sonnet-20241022',
            provider: 'anthropic',
            temperature: 0.0,
            timeout: 300000
          },
          parser: { name: 'ToolCallingParser', function_calling: true },
          history_processor: { name: 'DefaultHistoryProcessor', window_size: 4000 },
          tools: [{ name: 'str_replace_editor' }, { name: 'bash' }, { name: 'file_viewer' }],
          max_iterations: 30
        },
        env: {
          repo: {
            github_url: `https://github.com/${githubContext.repository || 'unknown/unknown'}.git`,
            base_commit: 'HEAD'
          },
          workspace: { mount_path: '/tmp/swe-agent-workspace' },
          secrets: { github_token: 'GITHUB_TOKEN', model_api_key: 'ANTHROPIC_API_KEY' }
        }
      },
      yaml: null,
      metadata: {
        error_fallback: true,
        original_error: error.message,
        generated_at: new Date().toISOString()
      },
      validation: { valid: false, errors: [error.message], warnings: [] },
      optimization: null,
      artifacts: {
        cli_args: ['--problem_statement', '"Software engineering task"'],
        environment_variables: { GITHUB_TOKEN: '${GITHUB_TOKEN}', ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}' },
        deployment_instructions: { deployment_mode: 'local', prerequisites: ['GitHub token', 'Anthropic API key'] }
      }
    };
  }

  /**
   * Get configuration status and metrics
   */
  getConfigurationStatus() {
    return {
      cache_status: {
        config_cache_size: this.configCache.size,
        generation_history_repositories: this.generationHistory.size
      },
      component_status: {
        env_mapper: 'ready',
        config_generator: 'ready',
        validator: 'ready',
        context_integrator: 'ready',
        optimizer: 'ready'
      },
      presets_available: Object.keys(this.presets),
      last_generation: this.getLastGenerationInfo()
    };
  }

  getLastGenerationInfo() {
    let lastGeneration = null;
    let latestTimestamp = 0;

    for (const [repo, history] of this.generationHistory) {
      if (history.length > 0) {
        const latest = history[history.length - 1];
        if (latest.timestamp > latestTimestamp) {
          latestTimestamp = latest.timestamp;
          lastGeneration = { repository: repo, ...latest };
        }
      }
    }

    return lastGeneration;
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.configCache.clear();
    this.generationHistory.clear();
    this.envMapper.clearCaches && this.envMapper.clearCaches();
    this.contextIntegrator.clearCaches && this.contextIntegrator.clearCaches();
    this.optimizer.clearCaches && this.optimizer.clearCaches();
    this.validator.clearCache && this.validator.clearCache();
    
    logger.info('All configuration caches cleared');
  }

  /**
   * Health check for all components
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      components: {},
      timestamp: new Date().toISOString()
    };

    try {
      // Test environment mapping
      const testEnvMapping = this.envMapper.mapEnvironmentToConfig({});
      health.components.env_mapper = testEnvMapping.errors.length === 0 ? 'healthy' : 'degraded';

      // Test configuration generation with minimal context
      const testGithubContext = { repository: 'test/test', event_name: 'push' };
      const testProblemContext = { repository: { name: 'test' } };
      
      const testConfig = await this.configGenerator.generateConfiguration(testGithubContext, testProblemContext, { skipValidation: true });
      health.components.config_generator = testConfig.config ? 'healthy' : 'degraded';

      // Test validation
      const testValidation = await this.validator.dryRunValidation(testConfig.config || {});
      health.components.validator = 'healthy'; // If no exception thrown

      // Test context integration
      const testContext = await this.contextIntegrator.integrateGitHubContext(testGithubContext);
      health.components.context_integrator = testContext ? 'healthy' : 'degraded';

      // Test optimization
      const testOptimization = await this.optimizer.optimizeConfiguration(testConfig.config || {}, { optimizationMode: 'conservative' });
      health.components.optimizer = testOptimization ? 'healthy' : 'degraded';

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
      logger.error('Configuration manager health check failed:', error);
    }

    return health;
  }
}

module.exports = EnhancedConfigManager;