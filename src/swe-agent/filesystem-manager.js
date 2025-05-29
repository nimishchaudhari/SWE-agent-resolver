const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

class FilesystemManager {
  constructor(options = {}) {
    this.baseWorkspace = options.baseWorkspace || '/tmp/swe-agent-workspace';
    this.maxWorkspaces = options.maxWorkspaces || 10;
    this.maxWorkspaceSize = options.maxWorkspaceSize || '1GB';
    this.cleanupInterval = options.cleanupInterval || 3600000; // 1 hour
    this.activeWorkspaces = new Map();
    
    this.startCleanupTimer();
  }

  async createWorkspace(jobId, context = {}) {
    const workspaceId = this.generateWorkspaceId(jobId);
    const workspacePath = path.join(this.baseWorkspace, workspaceId);
    
    try {
      await this.ensureBaseDirectory();
      await this.validateWorkspaceQuota();
      
      await fs.mkdir(workspacePath, { recursive: true });
      
      const workspace = {
        id: workspaceId,
        path: workspacePath,
        jobId,
        createdAt: new Date(),
        lastAccessed: new Date(),
        size: 0,
        context,
        directories: {
          repo: path.join(workspacePath, 'repo'),
          output: path.join(workspacePath, 'output'),
          config: path.join(workspacePath, 'config'),
          logs: path.join(workspacePath, 'logs'),
          temp: path.join(workspacePath, 'temp')
        }
      };
      
      await this.initializeWorkspaceStructure(workspace);
      await this.setupRepositoryAccess(workspace, context);
      
      this.activeWorkspaces.set(workspaceId, workspace);
      
      logger.info(`Created workspace ${workspaceId} for job ${jobId}`);
      
      return workspace;
      
    } catch (error) {
      logger.error(`Failed to create workspace for job ${jobId}:`, error);
      await this.cleanupWorkspace(workspaceId).catch(() => {});
      throw error;
    }
  }

  async initializeWorkspaceStructure(workspace) {
    const dirs = Object.values(workspace.directories);
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Create standard files
    await this.createWorkspaceMetadata(workspace);
    await this.createGitConfig(workspace);
    await this.createEnvironmentFile(workspace);
  }

  async createWorkspaceMetadata(workspace) {
    const metadata = {
      workspaceId: workspace.id,
      jobId: workspace.jobId,
      createdAt: workspace.createdAt.toISOString(),
      context: workspace.context,
      directories: workspace.directories,
      version: '1.0'
    };
    
    const metadataPath = path.join(workspace.path, 'workspace.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async createGitConfig(workspace) {
    const gitConfig = [
      '[user]',
      '  name = SWE Agent',
      '  email = swe-agent@github-action.local',
      '[core]',
      '  autocrlf = false',
      '  filemode = false',
      '[init]',
      '  defaultBranch = main',
      '[safe]',
      `  directory = ${workspace.directories.repo}`
    ].join('\n');
    
    const gitConfigPath = path.join(workspace.path, '.gitconfig');
    await fs.writeFile(gitConfigPath, gitConfig);
  }

  async createEnvironmentFile(workspace) {
    const envVars = [
      `WORKSPACE_ID=${workspace.id}`,
      `WORKSPACE_PATH=${workspace.path}`,
      `REPO_PATH=${workspace.directories.repo}`,
      `OUTPUT_PATH=${workspace.directories.output}`,
      `CONFIG_PATH=${workspace.directories.config}`,
      `LOGS_PATH=${workspace.directories.logs}`,
      `TEMP_PATH=${workspace.directories.temp}`,
      `HOME=${workspace.path}`,
      `GIT_CONFIG_GLOBAL=${path.join(workspace.path, '.gitconfig')}`
    ].join('\n');
    
    const envPath = path.join(workspace.path, '.env');
    await fs.writeFile(envPath, envVars);
  }

  async setupRepositoryAccess(workspace, context) {
    if (!context.repository?.cloneUrl) {
      logger.debug('No repository to clone for workspace', workspace.id);
      return;
    }
    
    try {
      await this.cloneRepository(workspace, context.repository);
      await this.configureRepositoryAccess(workspace, context);
    } catch (error) {
      logger.warn(`Failed to setup repository access in workspace ${workspace.id}:`, error);
      // Don't throw - workspace can still be used without repo
    }
  }

  async cloneRepository(workspace, repository) {
    const repoPath = workspace.directories.repo;
    const cloneUrl = this.sanitizeCloneUrl(repository.cloneUrl);
    
    logger.info(`Cloning repository ${repository.fullName} to ${repoPath}`);
    
    const cloneOptions = [
      '--depth=50', // Shallow clone for performance
      '--single-branch',
      '--branch', repository.defaultBranch || 'main'
    ];
    
    if (repository.private) {
      // For private repos, we'd need authentication setup
      logger.warn('Private repository cloning requires authentication setup');
    }
    
    const cloneCommand = `git clone ${cloneOptions.join(' ')} "${cloneUrl}" "${repoPath}"`;
    
    try {
      const { stdout, stderr } = await execAsync(cloneCommand, {
        timeout: 120000, // 2 minutes
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: path.join(workspace.path, '.gitconfig')
        }
      });
      
      logger.debug('Repository cloned successfully', { stdout, stderr });
      
      // Update workspace metadata
      workspace.repository = {
        ...repository,
        clonedAt: new Date(),
        localPath: repoPath
      };
      
    } catch (error) {
      throw new Error(`Git clone failed: ${error.message}`);
    }
  }

  async configureRepositoryAccess(workspace, context) {
    const repoPath = workspace.directories.repo;
    
    // Set up branch if working with PR
    if (context.pullRequest) {
      await this.setupPullRequestBranch(workspace, context.pullRequest);
    }
    
    // Create worktree for isolated changes
    const worktreePath = path.join(workspace.directories.temp, 'worktree');
    try {
      await execAsync(`git worktree add "${worktreePath}" HEAD`, {
        cwd: repoPath,
        timeout: 30000
      });
      
      workspace.worktreePath = worktreePath;
    } catch (error) {
      logger.debug('Failed to create worktree, using main repo:', error.message);
    }
  }

  async setupPullRequestBranch(workspace, pullRequest) {
    const repoPath = workspace.directories.repo;
    
    try {
      // Fetch PR branch
      const fetchCommand = `git fetch origin pull/${pullRequest.number}/head:pr-${pullRequest.number}`;
      await execAsync(fetchCommand, { cwd: repoPath, timeout: 60000 });
      
      // Checkout PR branch
      await execAsync(`git checkout pr-${pullRequest.number}`, { 
        cwd: repoPath, 
        timeout: 30000 
      });
      
      logger.info(`Checked out PR #${pullRequest.number} in workspace ${workspace.id}`);
      
    } catch (error) {
      logger.warn(`Failed to setup PR branch: ${error.message}`);
      // Fall back to base branch
    }
  }

  sanitizeCloneUrl(url) {
    // Remove any credentials that might be in the URL
    return url.replace(/\/\/[^@]+@/, '//');
  }

  async writeConfig(workspace, config, filename = 'config.yaml') {
    const configPath = path.join(workspace.directories.config, filename);
    
    if (typeof config === 'object') {
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } else {
      await fs.writeFile(configPath, config);
    }
    
    return configPath;
  }

  async readOutput(workspace, filename) {
    const outputPath = path.join(workspace.directories.output, filename);
    
    try {
      const content = await fs.readFile(outputPath, 'utf-8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listOutputFiles(workspace) {
    try {
      const files = await fs.readdir(workspace.directories.output);
      const fileStats = [];
      
      for (const file of files) {
        const filePath = path.join(workspace.directories.output, file);
        const stats = await fs.stat(filePath);
        
        fileStats.push({
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          isDirectory: stats.isDirectory()
        });
      }
      
      return fileStats.sort((a, b) => b.modified - a.modified);
      
    } catch (error) {
      logger.warn(`Failed to list output files for workspace ${workspace.id}:`, error);
      return [];
    }
  }

  async getWorkspaceSize(workspace) {
    try {
      const { stdout } = await execAsync(`du -sb "${workspace.path}"`, {
        timeout: 30000
      });
      
      const size = parseInt(stdout.split('\t')[0]);
      workspace.size = size;
      workspace.lastAccessed = new Date();
      
      return size;
      
    } catch (error) {
      logger.debug(`Failed to get workspace size for ${workspace.id}:`, error);
      return 0;
    }
  }

  async cleanupWorkspace(workspaceId) {
    const workspace = this.activeWorkspaces.get(workspaceId);
    
    try {
      if (workspace) {
        // Remove any git worktrees first
        if (workspace.worktreePath) {
          try {
            await execAsync(`git worktree remove --force "${workspace.worktreePath}"`, {
              cwd: workspace.directories.repo,
              timeout: 30000
            });
          } catch (error) {
            logger.debug('Failed to remove worktree:', error.message);
          }
        }
        
        // Remove workspace directory
        await fs.rm(workspace.path, { recursive: true, force: true });
        
        this.activeWorkspaces.delete(workspaceId);
        
        logger.info(`Cleaned up workspace ${workspaceId}`);
        return true;
      }
      
      // Try to clean up by path if workspace not tracked
      const workspacePath = path.join(this.baseWorkspace, workspaceId);
      await fs.rm(workspacePath, { recursive: true, force: true });
      
      return true;
      
    } catch (error) {
      logger.error(`Failed to cleanup workspace ${workspaceId}:`, error);
      return false;
    }
  }

  async cleanupOldWorkspaces(maxAge = 3600000) { // 1 hour default
    const cutoffTime = new Date(Date.now() - maxAge);
    const cleanedUp = [];
    
    for (const [workspaceId, workspace] of this.activeWorkspaces.entries()) {
      if (workspace.lastAccessed < cutoffTime) {
        const success = await this.cleanupWorkspace(workspaceId);
        if (success) {
          cleanedUp.push(workspaceId);
        }
      }
    }
    
    logger.info(`Cleaned up ${cleanedUp.length} old workspaces`);
    return cleanedUp;
  }

  async validateWorkspaceQuota() {
    if (this.activeWorkspaces.size >= this.maxWorkspaces) {
      // Try to clean up old workspaces first
      await this.cleanupOldWorkspaces(1800000); // 30 minutes
      
      if (this.activeWorkspaces.size >= this.maxWorkspaces) {
        throw new Error(`Maximum number of workspaces (${this.maxWorkspaces}) reached`);
      }
    }
    
    // Check total disk usage
    const totalSize = await this.getTotalWorkspaceSize();
    const maxSize = this.parseSize(this.maxWorkspaceSize);
    
    if (totalSize > maxSize) {
      throw new Error(`Workspace size limit (${this.maxWorkspaceSize}) exceeded`);
    }
  }

  async getTotalWorkspaceSize() {
    try {
      const { stdout } = await execAsync(`du -sb "${this.baseWorkspace}"`, {
        timeout: 60000
      });
      
      return parseInt(stdout.split('\t')[0]);
      
    } catch (error) {
      logger.debug('Failed to get total workspace size:', error);
      return 0;
    }
  }

  parseSize(sizeString) {
    const match = sizeString.match(/^(\d+)(GB|MB|KB)?$/i);
    if (!match) return 1024 * 1024 * 1024; // 1GB default
    
    const [, amount, unit] = match;
    const bytes = parseInt(amount);
    
    switch (unit?.toUpperCase()) {
      case 'GB': return bytes * 1024 * 1024 * 1024;
      case 'MB': return bytes * 1024 * 1024;
      case 'KB': return bytes * 1024;
      default: return bytes;
    }
  }

  async ensureBaseDirectory() {
    await fs.mkdir(this.baseWorkspace, { recursive: true });
  }

  generateWorkspaceId(jobId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `ws_${jobId}_${timestamp}_${random}`;
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanupOldWorkspaces().catch(error => {
        logger.error('Scheduled workspace cleanup failed:', error);
      });
    }, this.cleanupInterval);
  }

  getWorkspace(workspaceId) {
    return this.activeWorkspaces.get(workspaceId);
  }

  getActiveWorkspaces() {
    return Array.from(this.activeWorkspaces.values()).map(workspace => ({
      id: workspace.id,
      jobId: workspace.jobId,
      createdAt: workspace.createdAt,
      lastAccessed: workspace.lastAccessed,
      size: workspace.size,
      path: workspace.path
    }));
  }

  async getWorkspaceStats() {
    const workspaces = this.getActiveWorkspaces();
    let totalSize = 0;
    
    for (const workspace of workspaces) {
      totalSize += await this.getWorkspaceSize(this.activeWorkspaces.get(workspace.id));
    }
    
    return {
      activeCount: workspaces.length,
      maxWorkspaces: this.maxWorkspaces,
      totalSize,
      maxSize: this.parseSize(this.maxWorkspaceSize),
      baseWorkspace: this.baseWorkspace,
      workspaces
    };
  }

  // Shared filesystem utilities
  async createSharedFile(relativePath, content, workspaceId = null) {
    const basePath = workspaceId ? 
      this.activeWorkspaces.get(workspaceId)?.path : 
      this.baseWorkspace;
    
    if (!basePath) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }
    
    const filePath = path.join(basePath, relativePath);
    const dir = path.dirname(filePath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content);
    
    return filePath;
  }

  async readSharedFile(relativePath, workspaceId = null) {
    const basePath = workspaceId ? 
      this.activeWorkspaces.get(workspaceId)?.path : 
      this.baseWorkspace;
    
    if (!basePath) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }
    
    const filePath = path.join(basePath, relativePath);
    return fs.readFile(filePath, 'utf-8');
  }

  async fileExists(relativePath, workspaceId = null) {
    try {
      const basePath = workspaceId ? 
        this.activeWorkspaces.get(workspaceId)?.path : 
        this.baseWorkspace;
      
      if (!basePath) return false;
      
      const filePath = path.join(basePath, relativePath);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = FilesystemManager;