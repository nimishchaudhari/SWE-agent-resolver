/**
 * Real SWE-Agent CLI Integration
 * Handles actual SWE-agent execution with proper workspace management
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('./utils/logger');
const { createTempDirectory } = require('./utils/environment');

class SWEAgentCLI {
  constructor() {
    this.workspaceDir = null;
    this.configPath = null;
    this.processRef = null;
    this.isExecuting = false;
  }

  /**
   * Initialize SWE-agent CLI and workspace
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    try {
      // Create secure workspace directory
      this.workspaceDir = createTempDirectory();
      logger.info(`📁 Created workspace: ${this.workspaceDir}`);

      // Ensure SWE-agent is available
      await this.ensureSWEAgentInstalled();

      // Set up workspace structure
      await this.setupWorkspace(options);

      return {
        workspaceDir: this.workspaceDir,
        success: true
      };
    } catch (error) {
      logger.error('❌ Failed to initialize SWE-agent:', error);
      throw error;
    }
  }

  /**
   * Ensure SWE-agent CLI is installed and available
   */
  async ensureSWEAgentInstalled() {
    return new Promise((resolve, reject) => {
      exec('which sweagent || which python -m sweagent', (error, stdout) => {
        if (error) {
          logger.warn('⚠️ SWE-agent not found, attempting to install...');
          this.installSWEAgent()
            .then(() => resolve())
            .catch(reject);
        } else {
          logger.info(`✅ SWE-agent found at: ${stdout.trim()}`);
          resolve();
        }
      });
    });
  }

  /**
   * Install SWE-agent if not available
   */
  async installSWEAgent() {
    return new Promise((resolve, reject) => {
      logger.info('📦 Installing SWE-agent...');
      
      const installCmd = 'pip install swe-agent';
      const installProcess = spawn('sh', ['-c', installCmd], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let output = '';
      let errorOutput = '';

      installProcess.stdout.on('data', (data) => {
        output += data.toString();
        logger.debug(`SWE-agent install stdout: ${data}`);
      });

      installProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        logger.debug(`SWE-agent install stderr: ${data}`);
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('✅ SWE-agent installed successfully');
          resolve();
        } else {
          logger.error(`❌ SWE-agent installation failed with code ${code}`);
          logger.error(`Error output: ${errorOutput}`);
          reject(new Error(`SWE-agent installation failed: ${errorOutput}`));
        }
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        installProcess.kill('SIGKILL');
        reject(new Error('SWE-agent installation timed out'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Set up workspace directory structure
   * @param {Object} options - Setup options
   */
  async setupWorkspace(options) {
    const dirs = [
      'repos',
      'configs',
      'logs',
      'temp',
      'output'
    ];

    for (const dir of dirs) {
      const dirPath = path.join(this.workspaceDir, dir);
      await fs.mkdir(dirPath, { recursive: true });
      await fs.chmod(dirPath, 0o755);
    }

    logger.info('📂 Workspace structure created');
  }

  /**
   * Execute SWE-agent with given configuration
   * @param {string} configPath - Path to SWE-agent configuration file
   * @param {Object} context - GitHub context
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async execute(configPath, context, options = {}) {
    if (this.isExecuting) {
      throw new Error('SWE-agent is already executing');
    }

    this.isExecuting = true;
    this.configPath = configPath;

    try {
      // Clone repository if needed
      const repoPath = await this.cloneRepository(context);
      
      // Prepare execution environment
      const execOptions = await this.prepareExecution(configPath, repoPath, context, options);
      
      // Execute SWE-agent
      const result = await this.executeSWEAgent(execOptions);
      
      // Process results
      const processedResult = await this.processResults(result, context);
      
      return processedResult;

    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Clone repository to workspace
   * @param {Object} context - GitHub context
   * @returns {string} Path to cloned repository
   */
  async cloneRepository(context) {
    const repoUrl = `https://github.com/${context.repoOwner}/${context.repoName}.git`;
    const repoPath = path.join(this.workspaceDir, 'repos', context.repoName);
    
    logger.info(`🔄 Cloning repository: ${repoUrl}`);

    return new Promise((resolve, reject) => {
      const cloneCmd = `git clone --depth=1 --branch=${context.ref || 'main'} ${repoUrl} ${repoPath}`;
      
      const cloneProcess = spawn('sh', ['-c', cloneCmd], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          GIT_TERMINAL_PROMPT: '0' // Disable git prompts
        }
      });

      let output = '';
      let errorOutput = '';

      cloneProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      cloneProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      cloneProcess.on('close', (code) => {
        if (code === 0) {
          logger.info(`✅ Repository cloned to: ${repoPath}`);
          resolve(repoPath);
        } else {
          logger.error(`❌ Repository clone failed: ${errorOutput}`);
          reject(new Error(`Git clone failed: ${errorOutput}`));
        }
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        cloneProcess.kill('SIGKILL');
        reject(new Error('Repository clone timed out'));
      }, 2 * 60 * 1000);
    });
  }

  /**
   * Prepare SWE-agent execution environment
   * @param {string} configPath - Configuration file path
   * @param {string} repoPath - Repository path
   * @param {Object} context - GitHub context
   * @param {Object} options - Execution options
   * @returns {Object} Execution options
   */
  async prepareExecution(configPath, repoPath, context, options) {
    const outputDir = path.join(this.workspaceDir, 'output');
    const logFile = path.join(this.workspaceDir, 'logs', 'swe-agent.log');
    
    // Create problem statement file
    const problemPath = await this.createProblemStatement(context);
    
    const execOptions = {
      configPath,
      repoPath,
      problemPath,
      outputDir,
      logFile,
      timeout: options.timeout || 1800, // 30 minutes default
      maxTokens: options.maxTokens || 4000,
      environment: {
        ...process.env,
        SWE_AGENT_WORKSPACE: this.workspaceDir,
        SWE_AGENT_LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
        PYTHONPATH: `${process.env.PYTHONPATH || ''}:${this.workspaceDir}`
      }
    };

    logger.logSWEAgentExecution(configPath, 'execute', execOptions);
    return execOptions;
  }

  /**
   * Create problem statement file for SWE-agent
   * @param {Object} context - GitHub context
   * @returns {string} Path to problem statement file
   */
  async createProblemStatement(context) {
    const problemPath = path.join(this.workspaceDir, 'temp', 'problem.md');
    
    let problemStatement = '';
    
    switch (context.type) {
      case 'issue':
        problemStatement = `# Issue: ${context.title}\n\n${context.body || ''}\n\n`;
        if (context.labels && context.labels.length > 0) {
          problemStatement += `Labels: ${context.labels.join(', ')}\n\n`;
        }
        break;
        
      case 'issue_comment':
        problemStatement = `# Issue Comment Response\n\n`;
        problemStatement += `**Issue:** ${context.title}\n\n`;
        problemStatement += `**Comment:** ${context.comment}\n\n`;
        problemStatement += `**Context:** ${context.body || ''}\n\n`;
        break;
        
      case 'pull_request':
        problemStatement = `# Pull Request Review: ${context.title}\n\n${context.body || ''}\n\n`;
        problemStatement += `**Base Branch:** ${context.baseBranch}\n`;
        problemStatement += `**Head Branch:** ${context.headBranch}\n`;
        problemStatement += `**Changed Files:** ${context.changedFiles}\n\n`;
        break;
        
      case 'pr_review_comment':
        problemStatement = `# PR Review Comment Response\n\n`;
        problemStatement += `**PR:** ${context.title}\n\n`;
        problemStatement += `**Comment:** ${context.comment}\n\n`;
        problemStatement += `**File:** ${context.filePath}\n\n`;
        problemStatement += `**Diff:**\n\`\`\`diff\n${context.diffHunk}\n\`\`\`\n\n`;
        break;
        
      default:
        problemStatement = `# Task: ${context.title || 'AI Assistant Request'}\n\n${context.body || context.comment || ''}\n\n`;
    }
    
    problemStatement += `**Repository:** ${context.repoOwner}/${context.repoName}\n`;
    problemStatement += `**Author:** ${context.author}\n`;
    problemStatement += `**Timestamp:** ${new Date().toISOString()}\n`;
    
    await fs.writeFile(problemPath, problemStatement, 'utf8');
    logger.info(`📝 Problem statement created: ${problemPath}`);
    
    return problemPath;
  }

  /**
   * Execute SWE-agent CLI
   * @param {Object} execOptions - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeSWEAgent(execOptions) {
    return new Promise((resolve, reject) => {
      const {
        configPath,
        repoPath,
        problemPath,
        outputDir,
        logFile,
        timeout,
        environment
      } = execOptions;

      // Build SWE-agent command
      const cmd = [
        'python', '-m', 'sweagent',
        '--config_file', configPath,
        '--model_name', 'from_config', // Use model from config
        '--data_path', problemPath,
        '--repo_path', repoPath,
        '--output_dir', outputDir,
        '--verbose'
      ].join(' ');

      logger.info(`🚀 Executing SWE-agent: ${cmd}`);

      const startTime = Date.now();
      this.processRef = spawn('sh', ['-c', cmd], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: environment,
        cwd: repoPath
      });

      let stdout = '';
      let stderr = '';
      let hasTimedOut = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        hasTimedOut = true;
        logger.warn(`⏰ SWE-agent execution timed out after ${timeout}s`);
        this.processRef.kill('SIGKILL');
      }, timeout * 1000);

      // Capture output
      this.processRef.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        logger.debug(`SWE-agent stdout: ${chunk.slice(0, 500)}`);
      });

      this.processRef.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        logger.debug(`SWE-agent stderr: ${chunk.slice(0, 500)}`);
      });

      this.processRef.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        logger.info(`📊 SWE-agent completed in ${duration}ms with code ${code}`);

        if (hasTimedOut) {
          reject(new Error(`SWE-agent execution timed out after ${timeout}s`));
          return;
        }

        const result = {
          exitCode: code,
          stdout,
          stderr,
          duration,
          success: code === 0,
          outputDir,
          logFile
        };

        if (code === 0) {
          logger.info('✅ SWE-agent execution successful');
          resolve(result);
        } else {
          logger.error(`❌ SWE-agent execution failed with code ${code}`);
          logger.error(`Error output: ${stderr.slice(0, 1000)}`);
          reject(new Error(`SWE-agent execution failed: ${stderr}`));
        }
      });

      this.processRef.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.error('❌ SWE-agent process error:', error);
        reject(error);
      });
    });
  }

  /**
   * Process SWE-agent execution results
   * @param {Object} result - Raw execution result
   * @param {Object} context - GitHub context
   * @returns {Object} Processed result
   */
  async processResults(result, context) {
    try {
      // Read output files
      const outputFiles = await this.readOutputFiles(result.outputDir);
      
      // Extract patches if any
      const patches = await this.extractPatches(result.outputDir);
      
      // Parse trajectory for insights
      const trajectory = await this.parseTrajectory(result.outputDir);
      
      // Generate summary
      const summary = await this.generateSummary(outputFiles, patches, trajectory, context);
      
      return {
        status: result.success ? 'success' : 'failed',
        summary,
        patches,
        trajectory,
        outputFiles,
        duration: result.duration,
        patchApplied: patches.length > 0,
        cost: await this.calculateCost(result, context),
        logData: await this.readLogData(result.logFile)
      };
      
    } catch (error) {
      logger.error('❌ Failed to process SWE-agent results:', error);
      return {
        status: 'failed',
        summary: `Error processing results: ${error.message}`,
        patches: [],
        trajectory: null,
        outputFiles: {},
        duration: result.duration,
        patchApplied: false,
        error: error.message
      };
    }
  }

  /**
   * Read all output files from SWE-agent
   * @param {string} outputDir - Output directory path
   * @returns {Object} Output files content
   */
  async readOutputFiles(outputDir) {
    const files = {};
    
    try {
      const dirContents = await fs.readdir(outputDir);
      
      for (const file of dirContents) {
        const filePath = path.join(outputDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.size < 10 * 1024 * 1024) { // Max 10MB
          try {
            files[file] = await fs.readFile(filePath, 'utf8');
          } catch (readError) {
            logger.warn(`Failed to read output file ${file}:`, readError);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to read output directory:', error);
    }
    
    return files;
  }

  /**
   * Extract patches from SWE-agent output
   * @param {string} outputDir - Output directory path
   * @returns {Array} Array of patches
   */
  async extractPatches(outputDir) {
    const patches = [];
    
    try {
      const patchFiles = await fs.readdir(outputDir);
      const patchPattern = /\.patch$/;
      
      for (const file of patchFiles) {
        if (patchPattern.test(file)) {
          const patchPath = path.join(outputDir, file);
          const patchContent = await fs.readFile(patchPath, 'utf8');
          
          patches.push({
            filename: file,
            content: patchContent,
            path: patchPath
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to extract patches:', error);
    }
    
    return patches;
  }

  /**
   * Parse SWE-agent trajectory for insights
   * @param {string} outputDir - Output directory path
   * @returns {Object} Parsed trajectory
   */
  async parseTrajectory(outputDir) {
    try {
      const trajectoryPath = path.join(outputDir, 'trajectory.json');
      const trajectoryContent = await fs.readFile(trajectoryPath, 'utf8');
      return JSON.parse(trajectoryContent);
    } catch (error) {
      logger.warn('Failed to parse trajectory:', error);
      return null;
    }
  }

  /**
   * Generate summary from SWE-agent results
   * @param {Object} outputFiles - Output files
   * @param {Array} patches - Extracted patches
   * @param {Object} trajectory - Execution trajectory
   * @param {Object} context - GitHub context
   * @returns {string} Generated summary
   */
  async generateSummary(outputFiles, patches, trajectory, context) {
    let summary = `## AI Analysis Results\n\n`;
    
    // Add context
    summary += `**Task Type:** ${context.type}\n`;
    summary += `**Repository:** ${context.repoOwner}/${context.repoName}\n\n`;
    
    // Add findings
    if (patches.length > 0) {
      summary += `### 🔧 Code Changes Applied\n\n`;
      summary += `Found and applied ${patches.length} patch(es):\n\n`;
      patches.forEach((patch, i) => {
        summary += `${i + 1}. \`${patch.filename}\`\n`;
      });
      summary += '\n';
    }
    
    // Add trajectory insights if available
    if (trajectory && trajectory.steps) {
      summary += `### 📊 Analysis Process\n\n`;
      summary += `Completed ${trajectory.steps.length} analysis steps:\n\n`;
      
      const keySteps = trajectory.steps.slice(-5); // Last 5 steps
      keySteps.forEach((step, i) => {
        if (step.action && step.observation) {
          summary += `${i + 1}. **${step.action}:** ${step.observation.slice(0, 100)}...\n`;
        }
      });
      summary += '\n';
    }
    
    // Add output file summary
    const outputFileNames = Object.keys(outputFiles).filter(f => !f.includes('log'));
    if (outputFileNames.length > 0) {
      summary += `### 📄 Generated Files\n\n`;
      outputFileNames.forEach(file => {
        summary += `- \`${file}\`\n`;
      });
      summary += '\n';
    }
    
    summary += `*Analysis completed using SWE-agent with AI assistance.*`;
    
    return summary;
  }

  /**
   * Calculate cost estimate for execution
   * @param {Object} result - Execution result
   * @param {Object} context - GitHub context
   * @returns {Object} Cost estimate
   */
  async calculateCost(result, context) {
    // Basic cost calculation based on duration and estimated token usage
    const baseCostPerMinute = 0.01; // $0.01 per minute
    const minutes = result.duration / (1000 * 60);
    const estimatedCost = minutes * baseCostPerMinute;
    
    return {
      totalCost: estimatedCost.toFixed(4),
      duration: result.duration,
      currency: 'USD'
    };
  }

  /**
   * Read log data
   * @param {string} logFile - Log file path
   * @returns {string} Log content
   */
  async readLogData(logFile) {
    try {
      return await fs.readFile(logFile, 'utf8');
    } catch (error) {
      logger.warn('Failed to read log file:', error);
      return '';
    }
  }

  /**
   * Clean up workspace and resources
   */
  async cleanup() {
    try {
      // Kill any running process
      if (this.processRef && !this.processRef.killed) {
        this.processRef.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!this.processRef.killed) {
            this.processRef.kill('SIGKILL');
          }
        }, 5000);
      }

      // Clean up workspace directory
      if (this.workspaceDir) {
        await fs.rm(this.workspaceDir, { recursive: true, force: true });
        logger.info(`🧹 Cleaned up workspace: ${this.workspaceDir}`);
      }

      this.isExecuting = false;
      this.processRef = null;
      this.workspaceDir = null;
      this.configPath = null;

    } catch (error) {
      logger.error('❌ Failed to cleanup SWE-agent resources:', error);
    }
  }
}

module.exports = SWEAgentCLI;