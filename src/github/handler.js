const githubClient = require('./client');
const sweOrchestrator = require('../swe-agent/orchestrator');
const resultProcessor = require('../result-processor');
const logger = require('../utils/logger');
const WebhookParser = require('./webhook-parser');
const TriggerDetector = require('./trigger-detector');
const ContextExtractor = require('./context-extractor');
const PermissionValidator = require('./permission-validator');
const config = require('../config');

class GitHubHandler {
  async handleIssueOpened(context) {
    const { payload } = context;
    const { repository, issue } = payload;
    
    logger.info(`Issue opened: ${repository.full_name}#${issue.number}`);
    
    try {
      await githubClient.updateIssueStatus(repository, issue.number, 'pending', 'SWE-Agent is analyzing the issue...');
      
      const result = await sweOrchestrator.processIssue({
        repository: repository.full_name,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueBody: issue.body,
        repoUrl: repository.clone_url
      });
      
      const formattedResult = resultProcessor.formatIssueResult(result);
      await githubClient.commentOnIssue(repository, issue.number, formattedResult);
      await githubClient.updateIssueStatus(repository, issue.number, 'success', 'SWE-Agent analysis completed');
      
    } catch (error) {
      logger.error('Error handling issue opened:', error);
      await githubClient.updateIssueStatus(repository, issue.number, 'error', 'SWE-Agent analysis failed');
      await githubClient.commentOnIssue(repository, issue.number, 
        `❌ SWE-Agent analysis failed: ${error.message}`);
    }
  }

  async handlePullRequestOpened(context) {
    const { payload } = context;
    const { repository, pull_request } = payload;
    
    logger.info(`PR opened: ${repository.full_name}#${pull_request.number}`);
    
    try {
      await githubClient.updatePRStatus(repository, pull_request.head.sha, 'pending', 'SWE-Agent is reviewing the PR...');
      
      const result = await sweOrchestrator.processPullRequest({
        repository: repository.full_name,
        prNumber: pull_request.number,
        prTitle: pull_request.title,
        prBody: pull_request.body,
        headSha: pull_request.head.sha,
        baseSha: pull_request.base.sha,
        repoUrl: repository.clone_url
      });
      
      const formattedResult = resultProcessor.formatPRResult(result);
      await githubClient.commentOnPR(repository, pull_request.number, formattedResult);
      await githubClient.updatePRStatus(repository, pull_request.head.sha, 'success', 'SWE-Agent review completed');
      
    } catch (error) {
      logger.error('Error handling PR opened:', error);
      await githubClient.updatePRStatus(repository, pull_request.head.sha, 'error', 'SWE-Agent review failed');
      await githubClient.commentOnPR(repository, pull_request.number, 
        `❌ SWE-Agent review failed: ${error.message}`);
    }
  }

  async handleIssueComment(context) {
    const { payload } = context;
    const { repository, issue, comment } = payload;
    
    if (comment.body.includes('@swe-agent')) {
      logger.info(`SWE-Agent mentioned in comment: ${repository.full_name}#${issue.number}`);
      
      try {
        const result = await sweOrchestrator.processComment({
          repository: repository.full_name,
          issueNumber: issue.number,
          commentBody: comment.body,
          repoUrl: repository.clone_url
        });
        
        const formattedResult = resultProcessor.formatCommentResult(result);
        await githubClient.commentOnIssue(repository, issue.number, formattedResult);
        
      } catch (error) {
        logger.error('Error handling issue comment:', error);
        await githubClient.commentOnIssue(repository, issue.number, 
          `❌ SWE-Agent command failed: ${error.message}`);
      }
    }
  }
}

module.exports = new GitHubHandler();