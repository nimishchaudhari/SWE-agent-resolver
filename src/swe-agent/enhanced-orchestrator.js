const ConfigGenerator = require('./config-generator');
const ProcessManager = require('./process-manager');
const OutputParser = require('./output-parser');
const FilesystemManager = require('./filesystem-manager');
const ResultValidator = require('./result-validator');
const config = require('../config');
const logger = require('../utils/logger');

class EnhancedOrchestrator {
  constructor(options = {}) {
    this.configGenerator = new ConfigGenerator();
    this.processManager = new ProcessManager({
      maxConcurrent: config.sweAgent.maxConcurrentJobs,
      defaultTimeout: config.sweAgent.timeout,
      ...options.processManager
    });
    this.outputParser = new OutputParser();
    this.filesystemManager = new FilesystemManager(options.filesystem);
    this.resultValidator = new ResultValidator();
    
    this.activeJobs = new Map();
    this.jobHistory = new Map();
    this.metrics = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      totalDuration: 0,
      avgDuration: 0
    };
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.processManager.on('processCompleted', (data) => {
      this.updateMetrics(data);
    });
    
    this.processManager.on('processError', (data) => {
      this.updateMetrics(data);
      logger.error('Process error:', data);
    });
    
    this.processManager.on('resourceUpdate', (data) => {
      this.updateJobResourceUsage(data);
    });
  }

  async processIssue(params) {
    return this.executeJob('issue', params);
  }

  async processPullRequest(params) {
    return this.executeJob('pr', params);
  }

  async processComment(params) {
    return this.executeJob('comment', params);
  }

  async processPRComment(params) {
    return this.executeJob('pr_comment', params);
  }

  async executeJob(type, params) {
    const jobId = this.generateJobId(type);
    const startTime = Date.now();
    
    let workspace = null;
    let result = null;
    
    try {
      logger.info(`Starting SWE-Agent job ${jobId}`, { type, repository: params.repository });
      
      // Create workspace
      workspace = await this.filesystemManager.createWorkspace(jobId, params.context);
      
      // Register active job
      this.registerJob(jobId, {
        type,
        params,
        workspace,
        startTime,
        status: 'initializing'
      });
      
      // Generate configuration
      const configType = this.determineConfigType(type, params);
      const sweConfig = await this.configGenerator.generateConfig(params.context, {
        configType,
        timeout: params.timeout || config.sweAgent.timeout
      });
      
      // Write configuration to workspace
      const configPath = await workspace.writeConfig(workspace, sweConfig, 'swe-agent-config.yaml');
      
      this.updateJobStatus(jobId, 'configured');
      
      // Execute SWE-Agent
      const processResult = await this.executeSWEAgent(jobId, workspace, configPath, params);
      
      this.updateJobStatus(jobId, 'parsing');
      
      // Parse outputs
      const parsedResult = await this.outputParser.parseProcessOutput(
        processResult,
        workspace.directories.output,
        { context: params.context }
      );
      
      this.updateJobStatus(jobId, 'validating');
      
      // Validate results
      const validation = await this.resultValidator.validateResult(parsedResult, params.context);
      
      result = {
        ...parsedResult,
        validation,
        jobId,
        type,
        workspace: {
          id: workspace.id,
          path: workspace.path
        },
        config: sweConfig,
        duration: Date.now() - startTime
      };
      
      this.updateJobStatus(jobId, 'completed');
      logger.info(`SWE-Agent job ${jobId} completed successfully`);
      
      return result;
      
    } catch (error) {
      this.updateJobStatus(jobId, 'failed');
      logger.error(`SWE-Agent job ${jobId} failed:`, error);
      
      result = this.createErrorResult(jobId, type, error, startTime, workspace);
      throw error;
      
    } finally {
      // Clean up
      await this.finalizeJob(jobId, result, workspace);
    }
  }

  async executeSWEAgent(jobId, workspace, configPath, params) {
    const command = config.sweAgent.path || 'swe-agent';
    const args = this.buildSWEAgentArgs(configPath, workspace, params);
    
    logger.debug(`Executing SWE-Agent for job ${jobId}`, { command, args });
    
    const processOptions = {
      cwd: workspace.path,
      timeout: params.timeout || config.sweAgent.timeout,
      env: {
        ...process.env,
        WORKSPACE_PATH: workspace.path,
        REPO_PATH: workspace.directories.repo,
        OUTPUT_PATH: workspace.directories.output,
        CONFIG_PATH: configPath,
        JOB_ID: jobId
      },
      onStdout: (data) => this.handleProcessOutput(jobId, 'stdout', data),
      onStderr: (data) => this.handleProcessOutput(jobId, 'stderr', data)
    };
    
    this.updateJobStatus(jobId, 'executing');
    
    return this.processManager.executeProcess(command, args, processOptions);
  }

  buildSWEAgentArgs(configPath, workspace, params) {
    const args = [
      '--config', configPath,
      '--workspace', workspace.path,
      '--output-dir', workspace.directories.output
    ];
    
    // Add repository information
    if (params.repository) {
      args.push('--repository', params.repository);
    }
    
    if (params.repoUrl) {
      args.push('--repo-url', params.repoUrl);
    }
    
    // Add specific parameters based on type
    if (params.issueNumber) {
      args.push('--issue', params.issueNumber.toString());
    }
    
    if (params.prNumber) {
      args.push('--pr', params.prNumber.toString());
    }
    
    if (params.headSha) {
      args.push('--head-sha', params.headSha);
    }
    
    if (params.baseSha) {
      args.push('--base-sha', params.baseSha);
    }
    
    // Add trigger-specific parameters
    if (params.trigger?.primaryCommand) {
      args.push('--command', params.trigger.primaryCommand.type);
      
      if (params.trigger.primaryCommand.args) {
        const cmdArgs = params.trigger.primaryCommand.args;
        
        if (cmdArgs.files && cmdArgs.files.length > 0) {
          args.push('--files', cmdArgs.files.join(','));
        }
        
        if (cmdArgs.depth) {
          args.push('--depth', cmdArgs.depth);
        }
        
        if (cmdArgs.testType) {
          args.push('--test-type', cmdArgs.testType);
        }
      }
    }
    
    // Add output format
    args.push('--output-format', 'json');
    args.push('--verbose');
    
    return args;
  }

  determineConfigType(type, params) {
    if (params.trigger?.primaryCommand) {
      const commandType = params.trigger.primaryCommand.type;
      
      const commandMapping = {
        'fix': 'code_fix',
        'test': 'test_generation',
        'refactor': 'refactor',
        'explain': 'explain',
        'analyze': type === 'pr' ? 'pr_review' : 'issue_analysis',
        'review': 'pr_review'
      };
      
      return commandMapping[commandType] || 'generic';
    }
    
    const typeMapping = {
      'issue': 'issue_analysis',
      'pr': 'pr_review',
      'comment': 'generic',
      'pr_comment': 'pr_review'
    };
    
    return typeMapping[type] || 'generic';
  }

  handleProcessOutput(jobId, stream, data) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      if (!job.output) {
        job.output = { stdout: [], stderr: [] };
      }
      
      job.output[stream].push({
        timestamp: new Date().toISOString(),
        data: data.toString()
      });
      
      job.lastOutput = Date.now();
    }
    
    // Log significant output
    const text = data.toString().trim();
    if (text.length > 0) {
      logger.debug(`Job ${jobId} ${stream}:`, text.substring(0, 200));
    }
  }

  registerJob(jobId, jobData) {
    this.activeJobs.set(jobId, {
      ...jobData,
      registeredAt: Date.now(),
      lastUpdate: Date.now()
    });
    
    this.metrics.totalJobs++;
  }

  updateJobStatus(jobId, status) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = status;
      job.lastUpdate = Date.now();
      
      logger.debug(`Job ${jobId} status: ${status}`);
    }
  }

  updateJobResourceUsage(resourceData) {
    const job = this.activeJobs.get(resourceData.processId);
    if (job) {
      job.resourceUsage = resourceData.usage;
      job.lastUpdate = Date.now();
    }
  }

  async finalizeJob(jobId, result, workspace) {
    const job = this.activeJobs.get(jobId);
    
    if (job) {
      // Move to history
      this.jobHistory.set(jobId, {
        ...job,
        completedAt: Date.now(),
        result: result ? {
          success: result.success,
          duration: result.duration,
          validation: result.validation?.valid
        } : null
      });
      
      // Remove from active jobs
      this.activeJobs.delete(jobId);
    }
    
    // Cleanup workspace (with delay for debugging)
    if (workspace) {
      setTimeout(async () => {
        try {
          await this.filesystemManager.cleanupWorkspace(workspace.id);
        } catch (error) {
          logger.warn(`Failed to cleanup workspace ${workspace.id}:`, error);
        }
      }, 60000); // 1 minute delay
    }
  }

  createErrorResult(jobId, type, error, startTime, workspace) {
    return {
      success: false,
      error: error.message,
      jobId,
      type,
      duration: Date.now() - startTime,
      workspace: workspace ? {
        id: workspace.id,
        path: workspace.path
      } : null,
      metadata: {
        errorType: error.constructor.name,
        timestamp: new Date().toISOString()
      }
    };
  }

  updateMetrics(data) {
    if (data.error) {
      this.metrics.failedJobs++;
    } else {
      this.metrics.successfulJobs++;
    }
    
    if (data.duration) {
      this.metrics.totalDuration += data.duration;
      this.metrics.avgDuration = this.metrics.totalDuration / this.metrics.totalJobs;
    }
  }

  generateJobId(type) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `${type}_${timestamp}_${random}`;
  }

  // Status and monitoring methods
  getStatus() {
    return {
      activeJobs: this.activeJobs.size,
      totalJobs: this.metrics.totalJobs,
      metrics: this.metrics,
      processManager: this.processManager.getStats(),
      filesystem: this.filesystemManager.getActiveWorkspaces(),
      memory: process.memoryUsage()
    };
  }

  getJobStatus(jobId) {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return {
        id: jobId,
        status: activeJob.status,
        type: activeJob.type,
        startTime: activeJob.startTime,
        duration: Date.now() - activeJob.startTime,
        workspace: activeJob.workspace?.id,
        resourceUsage: activeJob.resourceUsage
      };
    }
    
    const historicalJob = this.jobHistory.get(jobId);
    if (historicalJob) {
      return {
        id: jobId,
        status: 'completed',
        type: historicalJob.type,
        startTime: historicalJob.startTime,
        duration: historicalJob.completedAt - historicalJob.startTime,
        result: historicalJob.result
      };
    }
    
    return null;
  }

  getActiveJobs() {
    return Array.from(this.activeJobs.entries()).map(([id, job]) => ({
      id,
      type: job.type,
      status: job.status,
      startTime: job.startTime,
      duration: Date.now() - job.startTime,
      workspace: job.workspace?.id
    }));
  }

  async killJob(jobId, reason = 'manual') {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    logger.info(`Killing job ${jobId} (reason: ${reason})`);
    
    // Kill associated process
    const killed = await this.processManager.killAllProcesses(reason);
    
    // Update job status
    this.updateJobStatus(jobId, 'killed');
    
    // Cleanup workspace
    if (job.workspace) {
      await this.filesystemManager.cleanupWorkspace(job.workspace.id);
    }
    
    // Move to history
    await this.finalizeJob(jobId, null, job.workspace);
    
    return killed;
  }

  async killAllJobs(reason = 'shutdown') {
    const activeJobIds = Array.from(this.activeJobs.keys());
    
    logger.info(`Killing all jobs (${activeJobIds.length}) - reason: ${reason}`);
    
    const killPromises = activeJobIds.map(jobId => 
      this.killJob(jobId, reason).catch(error => {
        logger.error(`Failed to kill job ${jobId}:`, error);
        return false;
      })
    );
    
    const results = await Promise.allSettled(killPromises);
    
    await this.processManager.killAllProcesses(reason);
    
    return {
      attempted: activeJobIds.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value).length
    };
  }

  // Health check and diagnostics
  async healthCheck() {
    const issues = [];
    
    // Check process manager health
    const processStats = this.processManager.getStats();
    if (processStats.activeProcesses > processStats.maxConcurrent * 0.8) {
      issues.push('High process utilization');
    }
    
    // Check filesystem health
    const fsStats = await this.filesystemManager.getWorkspaceStats();
    if (fsStats.totalSize > fsStats.maxSize * 0.8) {
      issues.push('High disk usage');
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
      issues.push('High memory usage');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      status: this.getStatus()
    };
  }
}

module.exports = EnhancedOrchestrator;