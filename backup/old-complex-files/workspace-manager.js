/**
 * Workspace Manager for SWE-Agent
 * Handles git operations, patch application, and workspace security
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

class WorkspaceManager {
  constructor(workspaceDir) {
    this.workspaceDir = workspaceDir;
    this.gitConfigured = false;
  }

  /**
   * Initialize git configuration for the workspace
   * @param {Object} context - GitHub context
   */
  async configureGit(context) {
    if (this.gitConfigured) return;

    try {
      const repoPath = path.join(this.workspaceDir, 'repos', context.repoName);
      
      // Configure git user (required for commits)
      await this.execGit(repoPath, 'config user.name "SWE-Agent Bot"');
      await this.execGit(repoPath, 'config user.email "swe-agent@github-actions.bot"');
      
      // Configure git to be safe
      await this.execGit(repoPath, 'config core.autocrlf false');
      await this.execGit(repoPath, 'config core.filemode false');
      
      this.gitConfigured = true;
      logger.info('✅ Git configuration completed');
      
    } catch (error) {
      logger.error('❌ Failed to configure git:', error);
      throw error;
    }
  }

  /**
   * Execute git command in repository
   * @param {string} repoPath - Repository path
   * @param {string} command - Git command
   * @returns {Promise<string>} Command output
   */
  async execGit(repoPath, command) {
    return new Promise((resolve, reject) => {
      exec(`git ${command}`, { cwd: repoPath }, (error, stdout, stderr) => {
        if (error) {
          logger.debug(`Git command failed: git ${command}`);
          logger.debug(`Error: ${stderr}`);
          reject(new Error(`Git command failed: ${stderr || error.message}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Create a new branch for changes
   * @param {string} repoPath - Repository path
   * @param {string} branchName - Branch name
   * @returns {Promise<string>} Created branch name
   */
  async createBranch(repoPath, branchName) {
    try {
      // Ensure we're on the main branch first
      await this.execGit(repoPath, 'checkout main');
      
      // Create and checkout new branch
      await this.execGit(repoPath, `checkout -b ${branchName}`);
      
      logger.info(`🌿 Created branch: ${branchName}`);
      return branchName;
      
    } catch (error) {
      // If main doesn't exist, try master
      try {
        await this.execGit(repoPath, 'checkout master');
        await this.execGit(repoPath, `checkout -b ${branchName}`);
        logger.info(`🌿 Created branch: ${branchName} (from master)`);
        return branchName;
      } catch (masterError) {
        logger.error('❌ Failed to create branch from main or master:', error);
        throw error;
      }
    }
  }

  /**
   * Apply patches to repository
   * @param {string} repoPath - Repository path
   * @param {Array} patches - Array of patch objects
   * @param {Object} context - GitHub context
   * @returns {Promise<Object>} Application result
   */
  async applyPatches(repoPath, patches, context) {
    if (!patches || patches.length === 0) {
      return {
        applied: false,
        reason: 'No patches to apply',
        changes: []
      };
    }

    try {
      await this.configureGit(context);
      
      // Create a new branch for changes
      const timestamp = Date.now();
      const branchName = `swe-agent-${context.type}-${timestamp}`;
      await this.createBranch(repoPath, branchName);

      const appliedChanges = [];
      let hasErrors = false;

      for (const patch of patches) {
        try {
          const result = await this.applyPatch(repoPath, patch);
          appliedChanges.push(result);
          
        } catch (patchError) {
          logger.error(`❌ Failed to apply patch ${patch.filename}:`, patchError);
          appliedChanges.push({
            filename: patch.filename,
            applied: false,
            error: patchError.message
          });
          hasErrors = true;
        }
      }

      // Commit changes if any were applied successfully
      const successfulChanges = appliedChanges.filter(c => c.applied);
      if (successfulChanges.length > 0) {
        await this.commitChanges(repoPath, context, successfulChanges);
      }

      return {
        applied: successfulChanges.length > 0,
        branchName: successfulChanges.length > 0 ? branchName : null,
        changes: appliedChanges,
        hasErrors,
        totalPatches: patches.length,
        appliedPatches: successfulChanges.length
      };

    } catch (error) {
      logger.error('❌ Failed to apply patches:', error);
      return {
        applied: false,
        reason: error.message,
        changes: []
      };
    }
  }

  /**
   * Apply a single patch
   * @param {string} repoPath - Repository path  
   * @param {Object} patch - Patch object
   * @returns {Promise<Object>} Application result
   */
  async applyPatch(repoPath, patch) {
    try {
      // Try to apply the patch using git apply
      await this.execGit(repoPath, `apply --check ${patch.path}`);
      await this.execGit(repoPath, `apply ${patch.path}`);
      
      logger.info(`✅ Applied patch: ${patch.filename}`);
      
      return {
        filename: patch.filename,
        applied: true,
        method: 'git_apply'
      };
      
    } catch (gitApplyError) {
      logger.warn(`⚠️ Git apply failed for ${patch.filename}, trying manual application...`);
      
      // Fallback: try to parse and apply manually
      try {
        const result = await this.manualPatchApplication(repoPath, patch);
        return result;
      } catch (manualError) {
        throw new Error(`Both git apply and manual application failed: ${gitApplyError.message} | ${manualError.message}`);
      }
    }
  }

  /**
   * Manually apply patch by parsing diff
   * @param {string} repoPath - Repository path
   * @param {Object} patch - Patch object
   * @returns {Promise<Object>} Application result
   */
  async manualPatchApplication(repoPath, patch) {
    // This is a simplified manual patch application
    // In production, you'd want a more robust diff parser
    
    const diffLines = patch.content.split('\n');
    const fileChanges = this.parseDiff(diffLines);
    
    for (const change of fileChanges) {
      await this.applyFileChange(repoPath, change);
    }
    
    logger.info(`✅ Manually applied patch: ${patch.filename}`);
    
    return {
      filename: patch.filename,
      applied: true,
      method: 'manual',
      changes: fileChanges.length
    };
  }

  /**
   * Parse diff content into file changes
   * @param {Array} diffLines - Diff lines
   * @returns {Array} File changes
   */
  parseDiff(diffLines) {
    const changes = [];
    let currentFile = null;
    let currentHunk = null;
    
    for (const line of diffLines) {
      if (line.startsWith('--- ')) {
        // Start of file change
        currentFile = {
          oldFile: line.substring(4),
          newFile: null,
          hunks: []
        };
      } else if (line.startsWith('+++ ')) {
        if (currentFile) {
          currentFile.newFile = line.substring(4);
        }
      } else if (line.startsWith('@@')) {
        // Start of hunk
        currentHunk = {
          header: line,
          lines: []
        };
        if (currentFile) {
          currentFile.hunks.push(currentHunk);
        }
      } else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
        currentHunk.lines.push(line);
      }
      
      if (currentFile && currentFile.newFile && line === '') {
        // End of file
        changes.push(currentFile);
        currentFile = null;
      }
    }
    
    // Add last file if not added
    if (currentFile && currentFile.newFile) {
      changes.push(currentFile);
    }
    
    return changes;
  }

  /**
   * Apply file change
   * @param {string} repoPath - Repository path
   * @param {Object} change - File change object
   */
  async applyFileChange(repoPath, change) {
    const filePath = path.join(repoPath, change.newFile.replace(/^[ab]\//, ''));
    
    try {
      // Read current file content
      let currentContent = '';
      try {
        currentContent = await fs.readFile(filePath, 'utf8');
      } catch (readError) {
        // File might not exist, that's ok for new files
        logger.debug(`File doesn't exist, creating new: ${filePath}`);
      }
      
      // Apply hunks
      let newContent = currentContent;
      for (const hunk of change.hunks) {
        newContent = this.applyHunk(newContent, hunk);
      }
      
      // Write updated content
      await fs.writeFile(filePath, newContent, 'utf8');
      logger.debug(`📝 Updated file: ${filePath}`);
      
    } catch (error) {
      logger.error(`❌ Failed to apply change to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Apply a single hunk to file content
   * @param {string} content - Current file content
   * @param {Object} hunk - Hunk object
   * @returns {string} Updated content
   */
  applyHunk(content, hunk) {
    // This is a simplified hunk application
    // For production use, consider using a proper diff library
    
    const lines = content.split('\n');
    const newLines = [];
    
    let lineIndex = 0;
    for (const hunkLine of hunk.lines) {
      if (hunkLine.startsWith(' ')) {
        // Context line, keep as is
        if (lineIndex < lines.length) {
          newLines.push(lines[lineIndex]);
          lineIndex++;
        }
      } else if (hunkLine.startsWith('-')) {
        // Remove line
        lineIndex++; // Skip this line
      } else if (hunkLine.startsWith('+')) {
        // Add line
        newLines.push(hunkLine.substring(1));
      }
    }
    
    // Add remaining lines
    while (lineIndex < lines.length) {
      newLines.push(lines[lineIndex]);
      lineIndex++;
    }
    
    return newLines.join('\n');
  }

  /**
   * Commit changes to repository
   * @param {string} repoPath - Repository path
   * @param {Object} context - GitHub context
   * @param {Array} changes - Applied changes
   */
  async commitChanges(repoPath, context, changes) {
    try {
      // Add all changes
      await this.execGit(repoPath, 'add .');
      
      // Check if there are changes to commit
      const status = await this.execGit(repoPath, 'status --porcelain');
      if (!status.trim()) {
        logger.info('ℹ️ No changes to commit');
        return;
      }
      
      // Create commit message
      const commitMessage = this.generateCommitMessage(context, changes);
      
      // Commit changes
      await this.execGit(repoPath, `commit -m "${commitMessage}"`);
      
      logger.info(`✅ Committed changes: ${changes.length} files`);
      
    } catch (error) {
      logger.error('❌ Failed to commit changes:', error);
      throw error;
    }
  }

  /**
   * Generate commit message
   * @param {Object} context - GitHub context
   * @param {Array} changes - Applied changes
   * @returns {string} Commit message
   */
  generateCommitMessage(context, changes) {
    let message = '';
    
    switch (context.type) {
      case 'issue':
        message = `Fix: Address issue #${context.issueNumber} - ${context.title}`;
        break;
      case 'issue_comment':
        message = `Fix: Address comment on issue #${context.issueNumber}`;
        break;
      case 'pull_request':
        message = `Review: Address PR #${context.prNumber} - ${context.title}`;
        break;
      case 'pr_review_comment':
        message = `Fix: Address review comment on PR #${context.prNumber}`;
        break;
      default:
        message = `Auto-fix: Apply SWE-agent suggestions`;
    }
    
    message += `\n\nApplied ${changes.length} patch(es):\n`;
    changes.forEach((change, i) => {
      message += `- ${change.filename}\n`;
    });
    
    message += `\nGenerated by SWE-Agent Resolver`;
    
    return message;
  }

  /**
   * Get repository status
   * @param {string} repoPath - Repository path
   * @returns {Promise<Object>} Repository status
   */
  async getStatus(repoPath) {
    try {
      const status = await this.execGit(repoPath, 'status --porcelain');
      const branch = await this.execGit(repoPath, 'branch --show-current');
      const lastCommit = await this.execGit(repoPath, 'log -1 --pretty=format:"%H %s"');
      
      return {
        hasChanges: status.trim().length > 0,
        changedFiles: status.split('\n').filter(line => line.trim()).length,
        currentBranch: branch.trim(),
        lastCommit: lastCommit.trim(),
        status: status.trim()
      };
      
    } catch (error) {
      logger.error('❌ Failed to get repository status:', error);
      return {
        hasChanges: false,
        changedFiles: 0,
        currentBranch: 'unknown',
        lastCommit: 'unknown',
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Create pull request branch and get diff
   * @param {string} repoPath - Repository path
   * @param {string} branchName - Branch name
   * @returns {Promise<Object>} PR information
   */
  async preparePullRequest(repoPath, branchName) {
    try {
      // Get diff from main/master
      let baseBranch = 'main';
      try {
        await this.execGit(repoPath, 'show-ref --verify --quiet refs/heads/main');
      } catch (error) {
        baseBranch = 'master';
      }
      
      const diff = await this.execGit(repoPath, `diff ${baseBranch}..${branchName}`);
      const fileList = await this.execGit(repoPath, `diff --name-only ${baseBranch}..${branchName}`);
      
      return {
        branchName,
        baseBranch,
        diff,
        changedFiles: fileList.split('\n').filter(f => f.trim()),
        ready: diff.trim().length > 0
      };
      
    } catch (error) {
      logger.error('❌ Failed to prepare pull request:', error);
      return {
        branchName,
        baseBranch: 'main',
        diff: '',
        changedFiles: [],
        ready: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up workspace
   */
  async cleanup() {
    try {
      if (this.workspaceDir) {
        await fs.rm(this.workspaceDir, { recursive: true, force: true });
        logger.info(`🧹 Cleaned up workspace: ${this.workspaceDir}`);
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup workspace:', error);
    }
  }
}

module.exports = WorkspaceManager;