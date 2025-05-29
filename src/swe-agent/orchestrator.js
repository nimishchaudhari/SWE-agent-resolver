const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const logger = require('../utils/logger');

class SWEOrchestrator {
  constructor() {
    this.activeJobs = new Map();
    this.jobQueue = [];
    this.concurrentJobs = 0;
  }

  async processIssue(params) {
    const jobId = this.generateJobId();
    logger.info(`Starting issue analysis job ${jobId}`, params);

    return this.executeJob(jobId, {
      type: 'issue',
      command: 'analyze-issue',
      ...params
    });
  }

  async processPullRequest(params) {
    const jobId = this.generateJobId();
    logger.info(`Starting PR review job ${jobId}`, params);

    return this.executeJob(jobId, {
      type: 'pr',
      command: 'review-pr',
      ...params
    });
  }

  async processComment(params) {
    const jobId = this.generateJobId();
    logger.info(`Starting comment processing job ${jobId}`, params);

    return this.executeJob(jobId, {
      type: 'comment',
      command: 'process-command',
      ...params
    });
  }

  async executeJob(jobId, jobParams) {
    if (this.concurrentJobs >= config.sweAgent.maxConcurrentJobs) {
      return new Promise((resolve, reject) => {
        this.jobQueue.push({ jobId, jobParams, resolve, reject });
      });
    }

    this.concurrentJobs++;
    this.activeJobs.set(jobId, jobParams);

    try {
      const result = await this.runSWEAgent(jobId, jobParams);
      return result;
    } finally {
      this.concurrentJobs--;
      this.activeJobs.delete(jobId);
      this.processQueue();
    }
  }

  async runSWEAgent(jobId, params) {
    const workDir = `/tmp/swe-agent-${jobId}`;
    await fs.mkdir(workDir, { recursive: true });

    try {
      const args = this.buildSWEAgentArgs(params);
      logger.info(`Executing SWE-Agent with args:`, args);

      const result = await this.spawnProcess(config.sweAgent.path, args, {
        cwd: workDir,
        timeout: config.sweAgent.timeout
      });

      const output = await this.parseOutput(result, workDir);
      return {
        jobId,
        success: true,
        output,
        workDir
      };

    } catch (error) {
      logger.error(`SWE-Agent job ${jobId} failed:`, error);
      return {
        jobId,
        success: false,
        error: error.message,
        workDir
      };
    } finally {
      await this.cleanup(workDir);
    }
  }

  buildSWEAgentArgs(params) {
    const args = [];
    
    switch (params.type) {
      case 'issue':
        args.push('--mode', 'issue');
        args.push('--repository', params.repository);
        args.push('--issue-number', params.issueNumber.toString());
        if (params.repoUrl) args.push('--repo-url', params.repoUrl);
        break;
        
      case 'pr':
        args.push('--mode', 'pr');
        args.push('--repository', params.repository);
        args.push('--pr-number', params.prNumber.toString());
        args.push('--head-sha', params.headSha);
        args.push('--base-sha', params.baseSha);
        if (params.repoUrl) args.push('--repo-url', params.repoUrl);
        break;
        
      case 'comment':
        args.push('--mode', 'command');
        args.push('--repository', params.repository);
        args.push('--command', params.commentBody);
        if (params.repoUrl) args.push('--repo-url', params.repoUrl);
        break;
    }

    args.push('--output-format', 'json');
    return args;
  }

  spawnProcess(command, args, options) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Process timed out after ${options.timeout}ms`));
      }, options.timeout);

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Process exited with code ${code}. stderr: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async parseOutput(result, workDir) {
    try {
      const outputFile = path.join(workDir, 'output.json');
      const exists = await fs.access(outputFile).then(() => true).catch(() => false);
      
      if (exists) {
        const content = await fs.readFile(outputFile, 'utf-8');
        return JSON.parse(content);
      } else {
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          raw: true
        };
      }
    } catch (error) {
      logger.warn('Failed to parse SWE-Agent output as JSON:', error);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        raw: true
      };
    }
  }

  async cleanup(workDir) {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
      logger.debug(`Cleaned up work directory: ${workDir}`);
    } catch (error) {
      logger.warn(`Failed to cleanup work directory ${workDir}:`, error);
    }
  }

  processQueue() {
    if (this.jobQueue.length > 0 && this.concurrentJobs < config.sweAgent.maxConcurrentJobs) {
      const { jobId, jobParams, resolve, reject } = this.jobQueue.shift();
      this.executeJob(jobId, jobParams).then(resolve).catch(reject);
    }
  }

  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStatus() {
    return {
      activeJobs: Array.from(this.activeJobs.keys()),
      queuedJobs: this.jobQueue.length,
      concurrentJobs: this.concurrentJobs,
      maxConcurrentJobs: config.sweAgent.maxConcurrentJobs
    };
  }
}

module.exports = new SWEOrchestrator();