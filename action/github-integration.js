/**
 * GitHub Integration
 * Simple GitHub API handling for comments and status updates
 */

const { Octokit } = require('@octokit/rest');
const core = require('@actions/core');
const logger = require('../utils/logger');

class GitHubIntegration {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }

  async postComment(event, result) {
    // Handle test mode
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      logger.info('Test mode: Simulating GitHub comment');
      result.commentUrl = 'https://github.com/test/repo/issues/1#issuecomment-test';
      return { id: 'test-comment', html_url: result.commentUrl };
    }

    try {
      const commentBody = this.formatResultComment(result);

      const response = await this.octokit.rest.issues.createComment({
        owner: event.repository.owner.login,
        repo: event.repository.name,
        issue_number: event.issueNumber,
        body: commentBody
      });

      logger.info('Comment posted successfully', {
        commentId: response.data.id,
        url: response.data.html_url
      });

      // Update result with comment URL
      result.commentUrl = response.data.html_url;

      return response.data;

    } catch (error) {
      logger.error('Failed to post comment', { error: error.message });
      throw error;
    }
  }

  async postErrorComment(event, errorMessage) {
    // Handle test mode
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      logger.info('Test mode: Simulating error comment');
      return { id: 'test-error-comment', html_url: 'https://github.com/test/repo/issues/1#issuecomment-test-error' };
    }

    try {
      const commentBody = `## 🤖 SWE-Agent Error

${errorMessage}

---
<sub>🔧 SWE-Agent GitHub Action Wrapper</sub>`;

      const response = await this.octokit.rest.issues.createComment({
        owner: event.repository.owner.login,
        repo: event.repository.name,
        issue_number: event.issueNumber,
        body: commentBody
      });

      logger.info('Error comment posted', { commentId: response.data.id });
      return response.data;

    } catch (error) {
      logger.error('Failed to post error comment', { error: error.message });
      // Don't throw here - we don't want to fail the action just because we can't post a comment
    }
  }

  formatResultComment(result) {
    const { success, summary, costEstimate, executionTime, filesChanged, model } = result;

    if (!success) {
      return `## 🤖 SWE-Agent Analysis Failed

❌ **Execution Failed**: ${result.error}

### Execution Details
- **Model**: ${model}
- **Execution Time**: ${this.formatTime(executionTime)}
- **Est. Cost**: $${costEstimate.toFixed(4)}

---
<sub>🔧 SWE-Agent GitHub Action Wrapper</sub>`;
    }

    return `## 🤖 SWE-Agent Analysis Complete

✅ **Analysis Successful**

### Summary
${summary}

### Changes Applied
${this.formatChanges(filesChanged)}

### Execution Details
- **Model**: ${model}
- **Execution Time**: ${this.formatTime(executionTime)}
- **Est. Cost**: $${costEstimate.toFixed(4)}
- **Files Changed**: ${filesChanged.length}

---
<sub>🔧 SWE-Agent GitHub Action Wrapper</sub>`;
  }

  formatChanges(filesChanged) {
    if (!filesChanged || filesChanged.length === 0) {
      return '📝 No file changes were made.';
    }

    let changes = '';

    for (const file of filesChanged.slice(0, 10)) { // Limit to first 10 files
      const { path: filePath, action, linesAdded, linesRemoved } = file;
      const changeType = this.getChangeIcon(action);

      changes += `${changeType} \`${filePath}\``;

      if (linesAdded || linesRemoved) {
        changes += ` (+${linesAdded || 0}/-${linesRemoved || 0})`;
      }

      changes += '\n';
    }

    if (filesChanged.length > 10) {
      changes += `... and ${filesChanged.length - 10} more files\n`;
    }

    return changes.trim();
  }

  getChangeIcon(action) {
    switch (action) {
    case 'added':
    case 'create':
      return '➕';
    case 'modified':
    case 'edit':
      return '✏️';
    case 'deleted':
    case 'remove':
      return '🗑️';
    default:
      return '📝';
    }
  }

  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  async updateComment(commentId, newBody, event) {
    try {
      const response = await this.octokit.rest.issues.updateComment({
        owner: event.repository.owner.login,
        repo: event.repository.name,
        comment_id: commentId,
        body: newBody
      });

      logger.info('Comment updated successfully', { commentId });
      return response.data;

    } catch (error) {
      logger.error('Failed to update comment', {
        commentId,
        error: error.message
      });
      throw error;
    }
  }

  async postProgressComment(event, status) {
    try {
      const commentBody = `## 🤖 SWE-Agent Working...

🔄 **Status**: ${status}

*This comment will be updated with results when analysis is complete.*

---
<sub>🔧 SWE-Agent GitHub Action Wrapper</sub>`;

      const response = await this.octokit.rest.issues.createComment({
        owner: event.repository.owner.login,
        repo: event.repository.name,
        issue_number: event.issueNumber,
        body: commentBody
      });

      logger.info('Progress comment posted', { commentId: response.data.id });
      return response.data;

    } catch (error) {
      logger.warn('Failed to post progress comment', { error: error.message });
      // Don't throw - this is optional
      return null;
    }
  }

  async setOutput(key, value) {
    try {
      core.setOutput(key, value);
    } catch (error) {
      // Handle GitHub Actions file_commands permission issues gracefully
      if (error.code === 'EACCES' && error.path && error.path.includes('/github/file_commands')) {
        logger.warn(`⚠️ Cannot write to GitHub file_commands, output ${key} will be logged only:`, error.message);
        logger.info(`Output ${key}: ${value}`);
      } else {
        throw error;
      }
    }
  }
}

module.exports = GitHubIntegration;
