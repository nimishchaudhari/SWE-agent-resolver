const EventEmitter = require('events');
const logger = require('../utils/logger');
const githubClient = require('../github/client');
const EnhancedOrchestrator = require('./enhanced-orchestrator');
const SWEAgentConfigGenerator = require('../config/swe-agent-config-generator');
const resultProcessor = require('../result-processor');

/**
 * Comprehensive Pipeline Orchestrator
 * Manages the complete end-to-end workflow with intelligent error recovery
 */
class PipelineOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enhancedOrchestrator = new EnhancedOrchestrator(options.orchestrator);
    this.configGenerator = new SWEAgentConfigGenerator();
    
    // Pipeline state management
    this.activePipelines = new Map();
    this.pipelineHistory = new Map();
    
    // Error recovery configuration
    this.errorClassifier = new ErrorClassifier();
    this.recoveryEngine = new RecoveryStrategyEngine();
    this.progressTracker = new ProgressTracker();
    
    // Performance and resource tracking
    this.metrics = {
      totalPipelines: 0,
      successfulPipelines: 0,
      recoveredPipelines: 0,
      failedPipelines: 0,
      avgProcessingTime: 0,
      resourceUsage: {}
    };
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.enhancedOrchestrator.on('jobStatusChanged', (data) => {
      this.handleJobStatusChange(data);
    });
    
    this.enhancedOrchestrator.on('jobError', (data) => {
      this.handleJobError(data);
    });
    
    this.enhancedOrchestrator.on('resourceUpdate', (data) => {
      this.updateResourceMetrics(data);
    });
  }

  /**
   * Execute complete pipeline with comprehensive error handling
   */
  async executePipeline(params) {
    const pipelineId = this.generatePipelineId(params.type);
    const startTime = Date.now();
    
    try {
      logger.info(`Starting pipeline ${pipelineId}`, {
        type: params.type,
        repository: params.repository,
        trigger: params.trigger?.primaryCommand?.type
      });

      // Initialize pipeline state
      const pipeline = await this.initializePipeline(pipelineId, params, startTime);
      
      // Execute pipeline stages with error recovery
      const result = await this.executeStages(pipeline);
      
      // Process and communicate results
      await this.processResults(pipeline, result);
      
      this.updateMetrics(pipeline, true);
      logger.info(`Pipeline ${pipelineId} completed successfully`);
      
      return result;
      
    } catch (error) {
      return this.handlePipelineError(pipelineId, error, startTime);
    }
  }

  /**
   * Initialize pipeline with comprehensive state tracking
   */
  async initializePipeline(pipelineId, params, startTime) {
    const pipeline = {
      id: pipelineId,
      type: params.type,
      params,
      startTime,
      status: 'initializing',
      stages: {
        initialization: { status: 'pending', startTime: null, endTime: null, error: null },
        context_extraction: { status: 'pending', startTime: null, endTime: null, error: null },
        config_generation: { status: 'pending', startTime: null, endTime: null, error: null },
        swe_execution: { status: 'pending', startTime: null, endTime: null, error: null },
        result_processing: { status: 'pending', startTime: null, endTime: null, error: null },
        communication: { status: 'pending', startTime: null, endTime: null, error: null }
      },
      retryCount: 0,
      maxRetries: 3,
      recoveryAttempts: [],
      resourceUsage: {},
      gitHubFeedback: {
        statusComments: [],
        errorReports: [],
        progressUpdates: []
      }
    };

    this.activePipelines.set(pipelineId, pipeline);
    this.metrics.totalPipelines++;
    
    await this.updatePipelineStage(pipeline, 'initialization', 'in_progress');
    await this.sendProgressUpdate(pipeline, 'Pipeline initialized, beginning execution...');
    
    return pipeline;
  }

  /**
   * Execute all pipeline stages with error recovery
   */
  async executeStages(pipeline) {
    let result = null;
    
    try {
      // Stage 1: Context Extraction
      await this.executeStage(pipeline, 'context_extraction', async () => {
        return this.extractContext(pipeline);
      });

      // Stage 2: Configuration Generation
      await this.executeStage(pipeline, 'config_generation', async () => {
        return this.generateConfiguration(pipeline);
      });

      // Stage 3: SWE-Agent Execution
      await this.executeStage(pipeline, 'swe_execution', async () => {
        return this.executeSWEAgent(pipeline);
      });

      // Stage 4: Result Processing
      result = await this.executeStage(pipeline, 'result_processing', async () => {
        return this.processExecutionResults(pipeline);
      });

      // Stage 5: Communication
      await this.executeStage(pipeline, 'communication', async () => {
        return this.communicateResults(pipeline, result);
      });

      pipeline.status = 'completed';
      await this.updatePipelineStage(pipeline, 'communication', 'completed');
      
      return result;
      
    } catch (error) {
      throw error; // Will be handled by pipeline error handler
    }
  }

  /**
   * Execute individual stage with error handling and recovery
   */
  async executeStage(pipeline, stageName, stageFunction) {
    const stage = pipeline.stages[stageName];
    
    try {
      await this.updatePipelineStage(pipeline, stageName, 'in_progress');
      
      const result = await stageFunction();
      
      await this.updatePipelineStage(pipeline, stageName, 'completed');
      stage.result = result;
      
      return result;
      
    } catch (error) {
      await this.updatePipelineStage(pipeline, stageName, 'error', error);
      
      // Attempt stage-specific recovery
      const recoveryResult = await this.attemptStageRecovery(pipeline, stageName, error);
      
      if (recoveryResult.success) {
        logger.info(`Stage ${stageName} recovered successfully`, { pipeline: pipeline.id });
        await this.updatePipelineStage(pipeline, stageName, 'completed');
        stage.result = recoveryResult.result;
        return recoveryResult.result;
      }
      
      throw error;
    }
  }

  /**
   * Stage 1: Extract enhanced context from GitHub webhook
   */
  async extractContext(pipeline) {
    await this.sendProgressUpdate(pipeline, 'Extracting context from GitHub event...');
    
    const contextExtractor = require('../github/context-extractor');
    const extractor = new contextExtractor();
    
    const context = await extractor.extractProblemContext(
      pipeline.params.parsedWebhook,
      pipeline.params.trigger
    );
    
    // Add additional context for better error recovery
    context.pipeline = {
      id: pipeline.id,
      type: pipeline.type,
      startTime: pipeline.startTime
    };
    
    pipeline.context = context;
    return context;
  }

  /**
   * Stage 2: Generate dynamic SWE-Agent configuration
   */
  async generateConfiguration(pipeline) {
    await this.sendProgressUpdate(pipeline, 'Generating SWE-Agent configuration...');
    
    const configResult = await this.configGenerator.generateConfiguration(
      pipeline.params.githubContext,
      pipeline.context,
      {
        allowPartialConfig: true,
        fallbackMode: true,
        timeout: pipeline.params.timeout
      }
    );
    
    if (configResult.warnings.length > 0) {
      await this.sendProgressUpdate(
        pipeline,
        `Configuration generated with warnings: ${configResult.warnings.join(', ')}`
      );
    }
    
    pipeline.config = configResult;
    return configResult;
  }

  /**
   * Stage 3: Execute SWE-Agent with real-time monitoring
   */
  async executeSWEAgent(pipeline) {
    await this.sendProgressUpdate(pipeline, 'Executing SWE-Agent analysis...');
    
    // Set up real-time progress monitoring
    const progressHandler = (update) => {
      this.handleSWEAgentProgress(pipeline, update);
    };
    
    const executionParams = {
      ...pipeline.params,
      context: pipeline.context,
      config: pipeline.config.config,
      progressHandler,
      timeout: pipeline.params.timeout || 600000 // 10 minutes default
    };
    
    const result = await this.enhancedOrchestrator.executeJob(pipeline.type, executionParams);
    
    pipeline.sweResult = result;
    return result;
  }

  /**
   * Stage 4: Process SWE-Agent execution results
   */
  async processExecutionResults(pipeline) {
    await this.sendProgressUpdate(pipeline, 'Processing execution results...');
    
    const result = pipeline.sweResult;
    
    // Validate result quality
    const validation = await this.validateResults(result, pipeline.context);
    
    // Format results for GitHub communication
    const formattedResult = await this.formatResults(result, validation, pipeline);
    
    // Generate recovery suggestions if needed
    if (!validation.complete || validation.hasIssues) {
      formattedResult.recoverySuggestions = await this.generateRecoverySuggestions(
        result,
        validation,
        pipeline
      );
    }
    
    return formattedResult;
  }

  /**
   * Stage 5: Communicate results to GitHub
   */
  async communicateResults(pipeline, result) {
    await this.sendProgressUpdate(pipeline, 'Communicating results...');
    
    try {
      const repository = this.extractRepositoryInfo(pipeline.params);
      const itemNumber = this.getItemNumber(pipeline.params);
      
      if (pipeline.type === 'issue') {
        await githubClient.commentOnIssue(repository, itemNumber, result.formatted);
      } else if (pipeline.type.includes('pr')) {
        await githubClient.commentOnPR(repository, itemNumber, result.formatted);
      }
      
      // Update status if applicable
      await this.updateGitHubStatus(pipeline, 'success', 'Analysis completed');
      
      return { success: true, communicated: true };
      
    } catch (error) {
      logger.error('Failed to communicate results:', error);
      // Don't fail the pipeline for communication errors
      return { success: false, error: error.message, fallback: true };
    }
  }

  /**
   * Comprehensive error handling with intelligent recovery
   */
  async handlePipelineError(pipelineId, error, startTime) {
    const pipeline = this.activePipelines.get(pipelineId);
    
    if (!pipeline) {
      logger.error(`Pipeline ${pipelineId} not found during error handling`);
      return this.createErrorResult(pipelineId, error, startTime);
    }
    
    logger.error(`Pipeline ${pipelineId} encountered error:`, {
      error: error.message,
      stage: this.getCurrentStage(pipeline),
      retryCount: pipeline.retryCount
    });
    
    // Classify the error
    const errorClassification = await this.errorClassifier.classifyError(error, pipeline);
    
    // Attempt recovery if possible
    const recoveryResult = await this.attemptPipelineRecovery(pipeline, error, errorClassification);
    
    if (recoveryResult.success) {
      this.metrics.recoveredPipelines++;
      logger.info(`Pipeline ${pipelineId} recovered successfully`);
      return recoveryResult.result;
    }
    
    // Recovery failed, provide comprehensive feedback
    await this.handleUnrecoverableError(pipeline, error, errorClassification);
    
    this.updateMetrics(pipeline, false);
    this.metrics.failedPipelines++;
    
    return this.createErrorResult(pipelineId, error, startTime, pipeline);
  }

  /**
   * Attempt stage-specific recovery strategies
   */
  async attemptStageRecovery(pipeline, stageName, error) {
    const recoveryStrategies = {
      context_extraction: async () => {
        // Retry with simplified context extraction
        logger.info(`Attempting simplified context extraction for ${pipeline.id}`);
        return { success: false }; // Implement simplified extraction
      },
      
      config_generation: async () => {
        // Use fallback configuration
        logger.info(`Using fallback configuration for ${pipeline.id}`);
        const fallbackConfig = await this.configGenerator.generateFallbackConfiguration(
          pipeline.params.githubContext,
          { repository: { name: pipeline.params.repository } },
          error
        );
        return { success: true, result: fallbackConfig };
      },
      
      swe_execution: async () => {
        // Retry with reduced timeout or simplified config
        if (pipeline.retryCount < pipeline.maxRetries) {
          logger.info(`Retrying SWE execution for ${pipeline.id} (attempt ${pipeline.retryCount + 1})`);
          pipeline.retryCount++;
          
          // Reduce complexity for retry
          const simplifiedParams = this.simplifyExecutionParams(pipeline.params);
          
          try {
            const result = await this.enhancedOrchestrator.executeJob(pipeline.type, simplifiedParams);
            return { success: true, result };
          } catch (retryError) {
            return { success: false, error: retryError };
          }
        }
        return { success: false };
      },
      
      result_processing: async () => {
        // Process partial results
        logger.info(`Processing partial results for ${pipeline.id}`);
        const partialResult = this.processPartialResults(pipeline.sweResult, error);
        return { success: true, result: partialResult };
      },
      
      communication: async () => {
        // Use alternative communication method
        logger.info(`Using fallback communication for ${pipeline.id}`);
        await this.sendErrorReport(pipeline, error);
        return { success: true, result: { fallback: true } };
      }
    };
    
    const strategy = recoveryStrategies[stageName];
    if (strategy) {
      pipeline.recoveryAttempts.push({
        stage: stageName,
        timestamp: Date.now(),
        error: error.message
      });
      
      return strategy();
    }
    
    return { success: false };
  }

  /**
   * Attempt pipeline-level recovery
   */
  async attemptPipelineRecovery(pipeline, error, classification) {
    if (classification.recoverable && pipeline.retryCount < pipeline.maxRetries) {
      pipeline.retryCount++;
      
      logger.info(`Attempting pipeline recovery for ${pipeline.id} (attempt ${pipeline.retryCount})`);
      
      // Apply recovery strategy based on error type
      const strategy = await this.recoveryEngine.getRecoveryStrategy(classification, pipeline);
      
      if (strategy.applicable) {
        try {
          await this.sendProgressUpdate(pipeline, `Recovering from error: ${strategy.description}`);
          
          // Apply the recovery strategy
          await strategy.apply(pipeline);
          
          // Retry the failed stage
          const result = await this.executeStages(pipeline);
          
          await this.sendProgressUpdate(pipeline, 'Recovery successful, execution completed');
          
          return { success: true, result };
          
        } catch (recoveryError) {
          logger.error(`Recovery attempt failed for ${pipeline.id}:`, recoveryError);
        }
      }
    }
    
    return { success: false };
  }

  /**
   * Handle unrecoverable errors with user guidance
   */
  async handleUnrecoverableError(pipeline, error, classification) {
    const errorReport = {
      pipelineId: pipeline.id,
      error: error.message,
      classification: classification.type,
      stage: this.getCurrentStage(pipeline),
      timestamp: new Date().toISOString(),
      context: {
        repository: pipeline.params.repository,
        type: pipeline.type,
        retryCount: pipeline.retryCount
      },
      guidance: await this.generateErrorGuidance(error, classification, pipeline),
      debugInfo: this.generateDebugInfo(pipeline)
    };
    
    await this.sendErrorReport(pipeline, errorReport);
    await this.updateGitHubStatus(pipeline, 'error', `Analysis failed: ${classification.type}`);
  }

  /**
   * Generate actionable error guidance for users
   */
  async generateErrorGuidance(error, classification, pipeline) {
    const guidance = {
      summary: `SWE-Agent analysis failed due to ${classification.type}`,
      description: classification.description,
      possibleCauses: classification.possibleCauses,
      recommendedActions: [],
      escalationPath: []
    };
    
    switch (classification.type) {
      case 'configuration_error':
        guidance.recommendedActions = [
          'Check repository permissions and access',
          'Verify GitHub token has necessary scopes',
          'Review environment variables and secrets'
        ];
        guidance.escalationPath = [
          'Contact repository administrator',
          'Review GitHub Actions configuration'
        ];
        break;
        
      case 'resource_limit':
        guidance.recommendedActions = [
          'Reduce the scope of the analysis',
          'Split large tasks into smaller ones',
          'Consider upgrading resource limits'
        ];
        guidance.escalationPath = [
          'Contact system administrator',
          'Consider alternative deployment options'
        ];
        break;
        
      case 'api_limit':
        guidance.recommendedActions = [
          'Wait for rate limit reset',
          'Configure API key rotation',
          'Reduce API usage frequency'
        ];
        guidance.escalationPath = [
          'Review API usage patterns',
          'Consider upgrading API plan'
        ];
        break;
        
      case 'timeout':
        guidance.recommendedActions = [
          'Simplify the analysis scope',
          'Increase timeout limits',
          'Break down into smaller tasks'
        ];
        guidance.escalationPath = [
          'Review computational requirements',
          'Consider distributed processing'
        ];
        break;
        
      default:
        guidance.recommendedActions = [
          'Review error logs for specific details',
          'Try the operation again',
          'Contact support if issue persists'
        ];
        guidance.escalationPath = [
          'Report issue with full context',
          'Provide debugging information'
        ];
    }
    
    return guidance;
  }

  /**
   * Send progressive updates to GitHub
   */
  async sendProgressUpdate(pipeline, message) {
    try {
      const repository = this.extractRepositoryInfo(pipeline.params);
      const itemNumber = this.getItemNumber(pipeline.params);
      
      const progressComment = `🔄 **SWE-Agent Progress Update**\n\n${message}\n\n_Pipeline ID: ${pipeline.id}_`;
      
      if (pipeline.type === 'issue') {
        await githubClient.commentOnIssue(repository, itemNumber, progressComment);
      } else if (pipeline.type.includes('pr')) {
        await githubClient.commentOnPR(repository, itemNumber, progressComment);
      }
      
      pipeline.gitHubFeedback.progressUpdates.push({
        timestamp: new Date().toISOString(),
        message
      });
      
    } catch (error) {
      logger.warn('Failed to send progress update:', error);
    }
  }

  /**
   * Send comprehensive error report to GitHub
   */
  async sendErrorReport(pipeline, errorInfo) {
    try {
      const repository = this.extractRepositoryInfo(pipeline.params);
      const itemNumber = this.getItemNumber(pipeline.params);
      
      const errorReport = this.formatErrorReport(errorInfo);
      
      if (pipeline.type === 'issue') {
        await githubClient.commentOnIssue(repository, itemNumber, errorReport);
      } else if (pipeline.type.includes('pr')) {
        await githubClient.commentOnPR(repository, itemNumber, errorReport);
      }
      
      pipeline.gitHubFeedback.errorReports.push({
        timestamp: new Date().toISOString(),
        error: errorInfo
      });
      
    } catch (error) {
      logger.error('Failed to send error report:', error);
    }
  }

  /**
   * Format comprehensive error report for GitHub
   */
  formatErrorReport(errorInfo) {
    return `❌ **SWE-Agent Analysis Failed**

**Error Classification:** ${errorInfo.classification}
**Failed at Stage:** ${errorInfo.stage}
**Pipeline ID:** ${errorInfo.pipelineId}

**Description:**
${errorInfo.guidance.description}

**Possible Causes:**
${errorInfo.guidance.possibleCauses.map(cause => `• ${cause}`).join('\n')}

**Recommended Actions:**
${errorInfo.guidance.recommendedActions.map(action => `1. ${action}`).join('\n')}

**Need Help?**
${errorInfo.guidance.escalationPath.map(step => `• ${step}`).join('\n')}

<details>
<summary>Debug Information</summary>

\`\`\`json
${JSON.stringify(errorInfo.debugInfo, null, 2)}
\`\`\`
</details>

_If this error persists, please create an issue with the debug information above._`;
  }

  /**
   * Generate debug information for troubleshooting
   */
  generateDebugInfo(pipeline) {
    return {
      pipelineId: pipeline.id,
      type: pipeline.type,
      startTime: pipeline.startTime,
      duration: Date.now() - pipeline.startTime,
      retryCount: pipeline.retryCount,
      stages: Object.entries(pipeline.stages).map(([name, stage]) => ({
        name,
        status: stage.status,
        duration: stage.endTime ? stage.endTime - stage.startTime : null,
        error: stage.error?.message
      })),
      resourceUsage: pipeline.resourceUsage,
      configWarnings: pipeline.config?.warnings || [],
      recoveryAttempts: pipeline.recoveryAttempts
    };
  }

  // Utility methods
  generatePipelineId(type) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `pipeline_${type}_${timestamp}_${random}`;
  }

  getCurrentStage(pipeline) {
    for (const [stageName, stage] of Object.entries(pipeline.stages)) {
      if (stage.status === 'in_progress' || stage.status === 'error') {
        return stageName;
      }
    }
    return 'unknown';
  }

  async updatePipelineStage(pipeline, stageName, status, error = null) {
    const stage = pipeline.stages[stageName];
    const now = Date.now();
    
    if (status === 'in_progress' && !stage.startTime) {
      stage.startTime = now;
    } else if (status === 'completed' || status === 'error') {
      stage.endTime = now;
    }
    
    stage.status = status;
    if (error) {
      stage.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }
    
    pipeline.lastUpdate = now;
    
    this.emit('stageUpdate', {
      pipelineId: pipeline.id,
      stage: stageName,
      status,
      error: error?.message
    });
  }

  extractRepositoryInfo(params) {
    return {
      owner: params.repository?.split('/')[0],
      repo: params.repository?.split('/')[1],
      fullName: params.repository
    };
  }

  getItemNumber(params) {
    return params.issueNumber || params.prNumber || 0;
  }

  async updateGitHubStatus(pipeline, state, description) {
    try {
      if (pipeline.params.headSha) {
        const repository = this.extractRepositoryInfo(pipeline.params);
        await githubClient.updatePRStatus(repository, pipeline.params.headSha, state, description);
      }
    } catch (error) {
      logger.warn('Failed to update GitHub status:', error);
    }
  }

  updateMetrics(pipeline, success) {
    if (success) {
      this.metrics.successfulPipelines++;
    }
    
    const duration = Date.now() - pipeline.startTime;
    this.metrics.avgProcessingTime = (
      (this.metrics.avgProcessingTime * (this.metrics.totalPipelines - 1) + duration)
    ) / this.metrics.totalPipelines;
  }

  createErrorResult(pipelineId, error, startTime, pipeline = null) {
    return {
      success: false,
      pipelineId,
      error: error.message,
      duration: Date.now() - startTime,
      stage: pipeline ? this.getCurrentStage(pipeline) : 'initialization',
      retryCount: pipeline?.retryCount || 0,
      debugInfo: pipeline ? this.generateDebugInfo(pipeline) : null
    };
  }

  // Status and monitoring methods
  getStatus() {
    return {
      activePipelines: this.activePipelines.size,
      metrics: this.metrics,
      orchestratorStatus: this.enhancedOrchestrator.getStatus()
    };
  }

  getPipelineStatus(pipelineId) {
    const active = this.activePipelines.get(pipelineId);
    if (active) {
      return {
        id: pipelineId,
        status: active.status,
        currentStage: this.getCurrentStage(active),
        duration: Date.now() - active.startTime,
        retryCount: active.retryCount
      };
    }
    
    const historical = this.pipelineHistory.get(pipelineId);
    if (historical) {
      return {
        id: pipelineId,
        status: 'completed',
        duration: historical.duration,
        success: historical.success
      };
    }
    
    return null;
  }

  /**
   * Handle real-time SWE-Agent progress updates
   */
  handleSWEAgentProgress(pipeline, update) {
    this.progressTracker.trackProgress(pipeline.id, 'swe_execution', update);
    
    // Send periodic progress updates to GitHub
    if (update.significant) {
      this.sendProgressUpdate(pipeline, `SWE-Agent: ${update.message}`);
    }
  }

  /**
   * Validate execution results
   */
  async validateResults(result, context) {
    const validation = {
      complete: false,
      hasIssues: false,
      quality: 'unknown',
      issues: []
    };

    if (!result || !result.success) {
      validation.hasIssues = true;
      validation.issues.push('Execution failed or returned no results');
      return validation;
    }

    // Check for expected outputs
    if (result.changes && result.changes.length > 0) {
      validation.complete = true;
      validation.quality = 'good';
    } else if (result.analysis && result.analysis.length > 0) {
      validation.complete = true;
      validation.quality = 'fair';
    } else {
      validation.hasIssues = true;
      validation.issues.push('No meaningful changes or analysis produced');
    }

    return validation;
  }

  /**
   * Format results for GitHub presentation
   */
  async formatResults(result, validation, pipeline) {
    let formatted = `## 🤖 SWE-Agent Analysis Results\n\n`;
    
    if (result.success) {
      formatted += `✅ **Status**: Analysis completed successfully\n`;
      formatted += `⏱️ **Duration**: ${Math.round(result.duration / 1000)}s\n`;
      formatted += `🆔 **Pipeline ID**: ${pipeline.id}\n\n`;
      
      if (result.changes && result.changes.length > 0) {
        formatted += `### 📝 Changes Made\n\n`;
        result.changes.forEach((change, index) => {
          formatted += `${index + 1}. **${change.file}**: ${change.description}\n`;
        });
        formatted += `\n`;
      }
      
      if (result.analysis) {
        formatted += `### 🔍 Analysis\n\n${result.analysis}\n\n`;
      }
      
      if (validation.hasIssues) {
        formatted += `### ⚠️ Issues Detected\n\n`;
        validation.issues.forEach(issue => {
          formatted += `- ${issue}\n`;
        });
        formatted += `\n`;
      }
    } else {
      formatted += `❌ **Status**: Analysis failed\n`;
      formatted += `🆔 **Pipeline ID**: ${pipeline.id}\n`;
      formatted += `⏱️ **Duration**: ${Math.round(result.duration / 1000)}s\n\n`;
      formatted += `**Error**: ${result.error}\n\n`;
    }
    
    formatted += `---\n_Generated by SWE-Agent Resolver Pipeline_`;
    
    return { formatted, raw: result };
  }

  /**
   * Generate recovery suggestions based on results
   */
  async generateRecoverySuggestions(result, validation, pipeline) {
    const suggestions = [];
    
    if (validation.issues.includes('No meaningful changes or analysis produced')) {
      suggestions.push({
        title: 'Simplify the Request',
        description: 'Try breaking down the task into smaller, more specific requests',
        action: 'Consider using more specific commands or focusing on individual files'
      });
    }
    
    if (result.duration > 300000) { // 5 minutes
      suggestions.push({
        title: 'Optimize Analysis Scope',
        description: 'The analysis took longer than expected',
        action: 'Consider reducing the scope or increasing timeout limits'
      });
    }
    
    if (pipeline.retryCount > 0) {
      suggestions.push({
        title: 'Review Configuration',
        description: 'Multiple attempts were required',
        action: 'Check repository configuration and available resources'
      });
    }
    
    return suggestions;
  }

  /**
   * Simplify execution parameters for retry attempts
   */
  simplifyExecutionParams(params) {
    return {
      ...params,
      timeout: Math.min(params.timeout || 600000, 300000), // Max 5 minutes for retry
      simplifiedAnalysis: true,
      reducedScope: true,
      maxChanges: 3
    };
  }

  /**
   * Process partial results when full execution fails
   */
  processPartialResults(sweResult, error) {
    return {
      success: false,
      partial: true,
      error: error.message,
      availableData: sweResult ? {
        logs: sweResult.logs?.slice(-10), // Last 10 log entries
        partialAnalysis: sweResult.partialOutput,
        workspace: sweResult.workspace
      } : null,
      recoverySuggestions: [
        'Retry with simplified parameters',
        'Check workspace permissions',
        'Review available resources'
      ]
    };
  }
}

/**
 * Error Classification System
 */
class ErrorClassifier {
  async classifyError(error, pipeline) {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack || '';
    
    // Configuration errors
    if (errorMessage.includes('config') || errorMessage.includes('permission') || errorMessage.includes('token')) {
      return {
        type: 'configuration_error',
        recoverable: true,
        description: 'Configuration or permission issue',
        possibleCauses: [
          'Invalid GitHub token or insufficient permissions',
          'Missing environment variables',
          'Incorrect repository configuration'
        ]
      };
    }
    
    // Resource limits
    if (errorMessage.includes('memory') || errorMessage.includes('disk') || errorMessage.includes('resource')) {
      return {
        type: 'resource_limit',
        recoverable: false,
        description: 'Resource limit exceeded',
        possibleCauses: [
          'Insufficient memory allocation',
          'Disk space exhausted',
          'CPU limit reached'
        ]
      };
    }
    
    // API limits
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('429')) {
      return {
        type: 'api_limit',
        recoverable: true,
        description: 'API rate limit or quota exceeded',
        possibleCauses: [
          'Too many API requests',
          'Daily quota exceeded',
          'Concurrent request limit reached'
        ]
      };
    }
    
    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        type: 'timeout',
        recoverable: true,
        description: 'Operation timed out',
        possibleCauses: [
          'Long-running analysis exceeded time limit',
          'Network connectivity issues',
          'Resource contention'
        ]
      };
    }
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('enotfound')) {
      return {
        type: 'network_error',
        recoverable: true,
        description: 'Network connectivity issue',
        possibleCauses: [
          'Network connectivity problems',
          'DNS resolution failure',
          'Service unavailable'
        ]
      };
    }
    
    // Default classification
    return {
      type: 'unknown_error',
      recoverable: pipeline.retryCount < 2,
      description: 'Unknown error occurred',
      possibleCauses: [
        'Unexpected system error',
        'Software bug',
        'External service failure'
      ]
    };
  }
}

/**
 * Recovery Strategy Engine
 */
class RecoveryStrategyEngine {
  async getRecoveryStrategy(classification, pipeline) {
    const strategies = {
      configuration_error: {
        applicable: true,
        description: 'Retry with fallback configuration',
        apply: async (pipeline) => {
          // Reset to use fallback configuration
          pipeline.params.useFallback = true;
        }
      },
      
      api_limit: {
        applicable: true,
        description: 'Wait and retry with reduced scope',
        apply: async (pipeline) => {
          // Wait for rate limit reset
          await new Promise(resolve => setTimeout(resolve, 60000));
          pipeline.params.reducedScope = true;
        }
      },
      
      timeout: {
        applicable: true,
        description: 'Retry with increased timeout and simplified analysis',
        apply: async (pipeline) => {
          pipeline.params.timeout = (pipeline.params.timeout || 600000) * 1.5;
          pipeline.params.simplifiedAnalysis = true;
        }
      },
      
      network_error: {
        applicable: true,
        description: 'Retry after brief delay',
        apply: async (pipeline) => {
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    };
    
    return strategies[classification.type] || { applicable: false };
  }
}

/**
 * Progress Tracking System
 */
class ProgressTracker {
  constructor() {
    this.progressUpdates = new Map();
  }
  
  trackProgress(pipelineId, stage, progress) {
    if (!this.progressUpdates.has(pipelineId)) {
      this.progressUpdates.set(pipelineId, []);
    }
    
    this.progressUpdates.get(pipelineId).push({
      stage,
      progress,
      timestamp: Date.now()
    });
  }
  
  getProgress(pipelineId) {
    return this.progressUpdates.get(pipelineId) || [];
  }
}

module.exports = PipelineOrchestrator;