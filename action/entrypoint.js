#!/usr/bin/env node

/**
 * SWE-Agent Resolver GitHub Action
 * Main entrypoint for processing GitHub events and executing SWE-agent with LiteLLM
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const ProviderManager = require('./provider-manager');
const SWEAgentConfigGenerator = require('./swe-agent-config-generator');
const CommentHandler = require('./comment-handler');
const ErrorHandler = require('./error-handler');
const SWEAgentCLI = require('../src/swe-agent-cli');
const WorkspaceManager = require('../src/workspace-manager');
const logger = require('../src/utils/logger');
const { validateInputs, getSafeEnvironment } = require('../src/utils/environment');
const core = require('@actions/core');
const github = require('@actions/github');

class SWEAgentAction {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.providerManager = new ProviderManager();
    this.configGenerator = new SWEAgentConfigGenerator();
    this.commentHandler = new CommentHandler(this.octokit, this.providerManager);
    this.errorHandler = new ErrorHandler(this.providerManager, logger);
    this.sweAgentCLI = new SWEAgentCLI();
    this.workspaceManager = null; // Will be initialized with workspace
    
    // Action inputs
    this.inputs = {
      modelName: process.env.INPUT_MODEL_NAME || 'gpt-4o',
      triggerPhrase: process.env.INPUT_TRIGGER_PHRASE || '@swe-agent',
      maxCost: parseFloat(process.env.INPUT_MAX_COST || '5.00'),
      allowedTools: (process.env.INPUT_ALLOWED_TOOLS || '').split(',').filter(Boolean),
      deploymentType: process.env.INPUT_DEPLOYMENT_TYPE || 'local',
      customInstructions: process.env.INPUT_CUSTOM_INSTRUCTIONS || '',
      fallbackModels: (process.env.INPUT_FALLBACK_MODELS || '').split(',').filter(Boolean),
      workspaceTimeout: parseInt(process.env.INPUT_WORKSPACE_TIMEOUT || '1800'),
      debugMode: process.env.INPUT_DEBUG_MODE === 'true'
    };

    // GitHub context
    this.context = {
      repository: process.env.GITHUB_REPOSITORY,
      eventName: process.env.GITHUB_EVENT_NAME,
      eventPath: process.env.GITHUB_EVENT_PATH,
      workspace: process.env.GITHUB_WORKSPACE,
      sha: process.env.GITHUB_SHA,
      ref: process.env.GITHUB_REF,
      actor: process.env.GITHUB_ACTOR
    };

    this.logger = logger;
  }

  /**
   * Main execution entry point
   */
  async run() {
    try {
      this.logger.info('🚀 Starting SWE-Agent Resolver Action');
      this.logger.info(`📋 Event: ${this.context.eventName}`);
      this.logger.info(`🤖 Model: ${this.inputs.modelName}`);
      
      // Validate inputs
      const inputValidation = validateInputs(this.inputs);
      if (!inputValidation.valid) {
        throw new Error(`Input validation failed: ${inputValidation.errors.join(', ')}`);
      }

      // Load GitHub event payload
      const eventPayload = await this.loadEventPayload();
      this.logger.logGitHubEvent(eventPayload);
      
      // Check if this event should trigger the action
      const shouldProcess = await this.shouldProcessEvent(eventPayload);
      if (!shouldProcess) {
        this.logger.info('⏭️ Event does not require processing');
        return this.setOutput('execution_status', 'skipped');
      }

      // Extract context from the event
      const context = await this.extractContext(eventPayload);
      this.logger.info(`📝 Extracted context for ${context.type}: ${context.title}`);

      // Detect and validate provider
      const providerInfo = this.providerManager.detectProvider(this.inputs.modelName);
      this.logger.logProvider(providerInfo.provider, this.inputs.modelName, 'detected');
      
      const validation = this.providerManager.validateApiKey(providerInfo);
      if (!validation.valid) {
        await this.handleError(context, `❌ ${validation.error}. ${validation.suggestion}`);
        return this.setOutput('execution_status', 'failed');
      }

      // Initialize SWE-agent CLI
      await this.sweAgentCLI.initialize();
      this.workspaceManager = new WorkspaceManager(this.sweAgentCLI.workspaceDir);

      // Create initial status comment
      const statusComment = await this.commentHandler.createStatusComment(
        context,
        this.inputs.modelName,
        'initializing'
      );

      let result;
      try {
        // Generate SWE-agent configuration
        this.logger.info('⚙️ Generating SWE-agent configuration');
        const sweConfig = await this.generateSWEConfig(context);
        
        // Update status: starting execution
        await this.commentHandler.updateStatusComment(
          statusComment.id,
          context,
          this.inputs.modelName,
          'executing',
          null,
          'Executing SWE-agent with AI model...'
        );

        // Execute SWE-agent with fallback support
        result = await this.executeSWEAgent(sweConfig, context);
        
      } finally {
        // Always cleanup resources
        await this.cleanup();
      }
      
      // Update final status
      await this.commentHandler.updateStatusComment(
        statusComment.id,
        context,
        this.inputs.modelName,
        result.status,
        result.cost,
        result.summary
      );

      // Set action outputs
      this.setOutput('execution_status', result.status);
      this.setOutput('provider_used', providerInfo.provider);
      this.setOutput('cost_estimate', result.cost?.totalCost || '0.00');
      this.setOutput('patch_applied', result.patchApplied || false);
      this.setOutput('comment_url', statusComment.html_url);

      this.logger.info(`✅ Action completed with status: ${result.status}`);

    } catch (error) {
      this.logger.error('❌ Action failed:', error);
      await this.cleanup();
      this.setOutput('execution_status', 'error');
      
      if (error.message) {
        core.setFailed(error.message);
      }
    }
  }

  /**
   * Load GitHub event payload
   */
  async loadEventPayload() {
    try {
      const eventData = await fs.readFile(this.context.eventPath, 'utf8');
      return JSON.parse(eventData);
    } catch (error) {
      throw new Error(`Failed to load event payload: ${error.message}`);
    }
  }

  /**
   * Determine if this event should trigger SWE-agent processing
   */
  async shouldProcessEvent(eventPayload) {
    const { eventName } = this.context;
    
    // Handle issue comments
    if (eventName === 'issue_comment') {
      const comment = eventPayload.comment;
      return comment.body.includes(this.inputs.triggerPhrase);
    }
    
    // Handle PR review comments
    if (eventName === 'pull_request_review_comment') {
      const comment = eventPayload.comment;
      return comment.body.includes(this.inputs.triggerPhrase);
    }
    
    // Handle new issues (if configured to auto-analyze)
    if (eventName === 'issues' && eventPayload.action === 'opened') {
      return true; // Could add configuration to enable/disable auto-analysis
    }
    
    // Handle new PRs (if configured to auto-review)
    if (eventName === 'pull_request' && ['opened', 'synchronize'].includes(eventPayload.action)) {
      return true; // Could add configuration to enable/disable auto-review
    }
    
    return false;
  }

  /**
   * Extract relevant context from GitHub event
   */
  async extractContext(eventPayload) {
    const { eventName } = this.context;
    
    if (eventName === 'issue_comment') {
      return {
        type: 'issue_comment',
        issueNumber: eventPayload.issue.number,
        title: eventPayload.issue.title,
        body: eventPayload.issue.body,
        comment: eventPayload.comment.body,
        author: eventPayload.comment.user.login,
        repoOwner: eventPayload.repository.owner.login,
        repoName: eventPayload.repository.name
      };
    }
    
    if (eventName === 'pull_request_review_comment') {
      return {
        type: 'pr_review_comment',
        prNumber: eventPayload.pull_request.number,
        title: eventPayload.pull_request.title,
        body: eventPayload.pull_request.body,
        comment: eventPayload.comment.body,
        author: eventPayload.comment.user.login,
        repoOwner: eventPayload.repository.owner.login,
        repoName: eventPayload.repository.name,
        diffHunk: eventPayload.comment.diff_hunk,
        filePath: eventPayload.comment.path
      };
    }
    
    if (eventName === 'issues') {
      return {
        type: 'issue',
        issueNumber: eventPayload.issue.number,
        title: eventPayload.issue.title,
        body: eventPayload.issue.body,
        author: eventPayload.issue.user.login,
        repoOwner: eventPayload.repository.owner.login,
        repoName: eventPayload.repository.name,
        labels: eventPayload.issue.labels.map(label => label.name)
      };
    }
    
    if (eventName === 'pull_request') {
      return {
        type: 'pull_request',
        prNumber: eventPayload.pull_request.number,
        title: eventPayload.pull_request.title,
        body: eventPayload.pull_request.body,
        author: eventPayload.pull_request.user.login,
        repoOwner: eventPayload.repository.owner.login,
        repoName: eventPayload.repository.name,
        baseBranch: eventPayload.pull_request.base.ref,
        headBranch: eventPayload.pull_request.head.ref,
        changedFiles: eventPayload.pull_request.changed_files
      };
    }
    
    throw new Error(`Unsupported event type: ${eventName}`);
  }

  /**
   * Generate SWE-agent configuration with LiteLLM integration
   */
  async generateSWEConfig(context) {
    const litellmConfig = this.providerManager.generateLiteLLMConfig(this.inputs.modelName, {
      temperature: 0.0,
      maxTokens: 4000,
      timeout: this.inputs.workspaceTimeout,
      estimatedTokens: 3000
    });

    return this.configGenerator.generateConfig({
      model: litellmConfig.config,
      problem: this.determineProblemType(context),
      context: context,
      tools: this.inputs.allowedTools,
      customInstructions: this.inputs.customInstructions,
      workspace: {
        path: '/swe-agent-workspace',
        timeout: this.inputs.workspaceTimeout
      }
    });
  }

  /**
   * Determine problem type based on context
   */
  determineProblemType(context) {
    if (context.type.includes('issue')) {
      return 'issue_analysis';
    } else if (context.type.includes('pr')) {
      return 'pr_review';
    }
    return 'general_task';
  }

  /**
   * Execute SWE-agent with generated configuration
   */
  async executeSWEAgent(config, context) {
    try {
      this.logger.info('🔧 Writing SWE-agent configuration');
      const configPath = path.join(this.sweAgentCLI.workspaceDir, 'configs', 'swe-agent-config.yaml');
      await fs.writeFile(configPath, config);

      this.logger.info('▶️ Starting SWE-agent execution with fallback support');
      
      // Execute with error handling and fallback
      const operation = async (modelName, execContext) => {
        return await this.executeSWEAgentWithModel(configPath, modelName, context, execContext);
      };
      
      const result = await this.errorHandler.executeWithFallback(
        operation,
        this.inputs.modelName,
        this.inputs.fallbackModels,
        context
      );
      
      return result;
      
    } catch (error) {
      this.logger.error('❌ All SWE-agent execution attempts failed:', error);
      
      // Generate user-friendly error message
      const errorMessage = this.errorHandler.generateUserErrorMessage(error);
      
      return {
        status: 'failed',
        summary: errorMessage,
        patchApplied: false,
        cost: error.totalCost || null,
        error: error
      };
    }
  }

  /**
   * Execute SWE-agent with a specific model
   */
  async executeSWEAgentWithModel(configPath, modelName, context, execContext) {
    const providerInfo = this.providerManager.detectProvider(modelName);
    this.logger.logProvider(providerInfo.provider, modelName, 'executing');
    
    try {
      // Update configuration with current model
      await this.updateConfigForModel(configPath, modelName);
      
      // Execute real SWE-agent CLI
      const result = await this.logger.logPerformance(
        `SWE-agent execution with ${modelName}`,
        async () => {
          return await this.sweAgentCLI.execute(configPath, context, {
            timeout: this.inputs.workspaceTimeout,
            maxTokens: 4000
          });
        }
      );
      
      // Apply patches if any were generated
      if (result.patches && result.patches.length > 0) {
        this.logger.info(`🔧 Applying ${result.patches.length} patch(es)`);
        const patchResult = await this.workspaceManager.applyPatches(
          path.join(this.sweAgentCLI.workspaceDir, 'repos', context.repoName),
          result.patches,
          context
        );
        
        result.patchApplied = patchResult.applied;
        result.patchDetails = patchResult;
      }
      
      // Calculate cost estimate
      const costEstimate = this.providerManager.getCostEstimate(providerInfo.provider, 3000);
      result.cost = costEstimate;
      
      this.logger.logCost(costEstimate);
      this.logger.logProvider(providerInfo.provider, modelName, 'completed');
      
      return result;
      
    } catch (error) {
      this.logger.error(`❌ SWE-agent execution failed with ${modelName}:`, error);
      
      // Add provider context to error
      error.provider = providerInfo.provider;
      error.model = modelName;
      error.attempt = execContext.attempt;
      
      throw error;
    }
  }

  /**
   * Update configuration file with specific model
   */
  async updateConfigForModel(configPath, modelName) {
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const yaml = require('js-yaml');
      const config = yaml.load(configContent);
      
      // Update model in config
      const providerInfo = this.providerManager.detectProvider(modelName);
      const litellmConfig = this.providerManager.generateLiteLLMConfig(modelName);
      
      config.agent.model = litellmConfig.config;
      
      // Write updated config
      const updatedContent = yaml.dump(config);
      await fs.writeFile(configPath, updatedContent);
      
      this.logger.debug(`Updated config for model: ${modelName}`);
      
    } catch (error) {
      this.logger.error('Failed to update config for model:', error);
      throw error;
    }
  }

  /**
   * Handle errors by creating error comments
   */
  async handleError(context, message) {
    try {
      await this.commentHandler.createErrorComment(context, message);
    } catch (commentError) {
      this.logger.error('Failed to create error comment:', commentError);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.sweAgentCLI) {
        await this.sweAgentCLI.cleanup();
      }
      if (this.workspaceManager) {
        await this.workspaceManager.cleanup();
      }
      this.logger.info('🧹 Cleanup completed');
    } catch (error) {
      this.logger.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Set GitHub Action output
   */
  setOutput(name, value) {
    if (typeof core !== 'undefined' && core.setOutput) {
      core.setOutput(name, value);
    } else {
      this.logger.log(`Output ${name}: ${value}`);
    }
  }
}

// Entry point - ensure we have required dependencies
async function main() {
  try {
    // Try to require @actions/core, install if not available
    let core, github;
    try {
      core = require('@actions/core');
      github = require('@actions/github');
    } catch (error) {
      console.log('Installing @actions/core and @actions/github...');
      const { execSync } = require('child_process');
      execSync('npm install @actions/core @actions/github', { stdio: 'inherit' });
      core = require('@actions/core');
      github = require('@actions/github');
    }

    const action = new SWEAgentAction();
    await action.run();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = SWEAgentAction;