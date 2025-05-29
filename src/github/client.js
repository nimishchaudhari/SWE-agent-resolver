const { Octokit } = require('@octokit/rest');
const config = require('../config');
const logger = require('../utils/logger');

class GitHubClient {
  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token
    });
  }

  async commentOnIssue(repository, issueNumber, body) {
    try {
      await this.octokit.issues.createComment({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: issueNumber,
        body
      });
      logger.info(`Comment added to issue ${repository.full_name}#${issueNumber}`);
    } catch (error) {
      logger.error('Error commenting on issue:', error);
      throw error;
    }
  }

  async commentOnPR(repository, prNumber, body) {
    try {
      await this.octokit.issues.createComment({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: prNumber,
        body
      });
      logger.info(`Comment added to PR ${repository.full_name}#${prNumber}`);
    } catch (error) {
      logger.error('Error commenting on PR:', error);
      throw error;
    }
  }

  async updateIssueStatus(repository, issueNumber, state, description) {
    try {
      await this.octokit.repos.createCommitStatus({
        owner: repository.owner.login,
        repo: repository.name,
        sha: repository.default_branch,
        state,
        description,
        context: 'swe-agent/issue-analysis'
      });
      logger.info(`Status updated for issue ${repository.full_name}#${issueNumber}: ${state}`);
    } catch (error) {
      logger.error('Error updating issue status:', error);
    }
  }

  async updatePRStatus(repository, sha, state, description) {
    try {
      await this.octokit.repos.createCommitStatus({
        owner: repository.owner.login,
        repo: repository.name,
        sha,
        state,
        description,
        context: 'swe-agent/pr-review'
      });
      logger.info(`Status updated for PR ${repository.full_name} (${sha}): ${state}`);
    } catch (error) {
      logger.error('Error updating PR status:', error);
    }
  }

  async getRepository(owner, repo) {
    try {
      const response = await this.octokit.repos.get({ owner, repo });
      return response.data;
    } catch (error) {
      logger.error('Error getting repository:', error);
      throw error;
    }
  }
}

module.exports = new GitHubClient();