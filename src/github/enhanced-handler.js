const githubClient = require('./client');
const sweOrchestrator = require('../swe-agent/orchestrator');
const resultProcessor = require('../result-processor');
const logger = require('../utils/logger');
const WebhookParser = require('./webhook-parser');
const TriggerDetector = require('./trigger-detector');
const ContextExtractor = require('./context-extractor');
const PermissionValidator = require('./permission-validator');
const config = require('../config');

class EnhancedGitHubHandler {
  constructor() {
    this.webhookParser = new WebhookParser(config.github.webhookSecret);
    this.triggerDetector = new TriggerDetector();
    this.contextExtractor = new ContextExtractor();
    this.permissionValidator = new PermissionValidator();
    
    // Performance metrics
    this.metrics = {
      processed: 0,
      errors: 0,
      avgProcessingTime: 0,
      lastProcessed: null
    };
  }

  async processWebhook(rawPayload, headers) {
    const startTime = Date.now();
    let parsedWebhook = null;
    
    try {
      // Parse and validate webhook
      parsedWebhook = this.webhookParser.parseWebhook(rawPayload, headers);
      
      if (!parsedWebhook.supported) {
        logger.debug(`Ignoring unsupported webhook event: ${parsedWebhook.event}`);
        return { processed: false, reason: 'unsupported_event' };
      }
      
      // Check if we should process this event
      if (!this.triggerDetector.shouldProcessEvent(parsedWebhook)) {
        logger.debug(`Skipping event ${parsedWebhook.event}:${parsedWebhook.action}`);
        return { processed: false, reason: 'skipped_action' };
      }
      
      // Validate permissions
      const repository = this.webhookParser.extractRepositoryInfo(parsedWebhook);
      const permissionCheck = await this.permissionValidator.validateWebhookSource(
        repository, 
        parsedWebhook.sender
      );
      
      if (!permissionCheck.allowed) {
        logger.warn(`Permission denied for webhook from ${repository.fullName}`, permissionCheck);
        return { 
          processed: false, 
          reason: 'permission_denied',
          details: permissionCheck
        };
      }
      
      // Route to appropriate handler
      const result = await this.routeWebhook(parsedWebhook, repository);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      
      logger.info(`Webhook processed successfully`, {
        event: parsedWebhook.event,
        action: parsedWebhook.action,
        repository: repository.fullName,
        processingTime: `${processingTime}ms`
      });
      
      return { processed: true, result, processingTime };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);
      
      logger.error('Webhook processing failed:', {
        error: error.message,
        stack: error.stack,
        event: parsedWebhook?.event,
        repository: parsedWebhook?.repository?.full_name,
        processingTime: `${processingTime}ms`
      });
      
      // Try to send error feedback if we have enough context
      if (parsedWebhook && this.canSendErrorFeedback(parsedWebhook)) {
        await this.sendErrorFeedback(parsedWebhook, error);
      }
      
      throw error;
    }
  }

  async routeWebhook(parsedWebhook, repository) {
    const { event, action } = parsedWebhook;
    
    switch (event) {
      case 'issues':
        if (action === 'opened' || action === 'edited') {
          return this.handleIssueEvent(parsedWebhook, repository);
        }
        break;
        
      case 'issue_comment':
        if (action === 'created') {
          return this.handleCommentEvent(parsedWebhook, repository);
        }
        break;
        
      case 'pull_request':
        if (['opened', 'edited', 'synchronize'].includes(action)) {
          return this.handlePullRequestEvent(parsedWebhook, repository);
        }
        break;
        
      case 'pull_request_review_comment':
        if (action === 'created') {
          return this.handlePRCommentEvent(parsedWebhook, repository);
        }
        break;
        
      default:
        throw new Error(`Unhandled event: ${event}:${action}`);
    }
  }

  async handleIssueEvent(parsedWebhook, repository) {
    const { issue } = parsedWebhook;
    
    logger.info(`Processing issue event`, {
      repository: repository.fullName,
      issue: issue.number,
      action: parsedWebhook.action
    });
    
    try {
      await this.updateStatus(repository, 'issue', issue.number, 'pending', 'SWE-Agent is analyzing the issue...');
      
      const context = await this.contextExtractor.extractProblemContext(parsedWebhook, null);
      
      const result = await sweOrchestrator.processIssue({
        repository: repository.fullName,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueBody: issue.body,
        repoUrl: repository.cloneUrl,
        context
      });
      
      const formattedResult = resultProcessor.formatIssueResult(result);
      await githubClient.commentOnIssue(repository, issue.number, formattedResult);
      await this.updateStatus(repository, 'issue', issue.number, 'success', 'SWE-Agent analysis completed');
      
      return { success: true, type: 'issue_analysis', result };
      
    } catch (error) {
      await this.handleProcessingError(error, parsedWebhook, repository, 'issue');
      throw error;
    }
  }

  async handlePullRequestEvent(parsedWebhook, repository) {
    const { pullRequest } = parsedWebhook;
    
    logger.info(`Processing PR event`, {
      repository: repository.fullName,
      pr: pullRequest.number,
      action: parsedWebhook.action
    });
    
    try {
      await githubClient.updatePRStatus(repository, pullRequest.head.sha, 'pending', 'SWE-Agent is reviewing the PR...');
      
      const context = await this.contextExtractor.extractProblemContext(parsedWebhook, null);
      
      const result = await sweOrchestrator.processPullRequest({
        repository: repository.fullName,
        prNumber: pullRequest.number,
        prTitle: pullRequest.title,
        prBody: pullRequest.body,
        headSha: pullRequest.head.sha,
        baseSha: pullRequest.base.sha,
        repoUrl: repository.cloneUrl,
        context
      });
      
      const formattedResult = resultProcessor.formatPRResult(result);
      await githubClient.commentOnPR(repository, pullRequest.number, formattedResult);
      await githubClient.updatePRStatus(repository, pullRequest.head.sha, 'success', 'SWE-Agent review completed');
      
      return { success: true, type: 'pr_review', result };
      
    } catch (error) {
      await this.handleProcessingError(error, parsedWebhook, repository, 'pr');
      throw error;
    }
  }

  async handleCommentEvent(parsedWebhook, repository) {
    const { issue, comment } = parsedWebhook;
    
    const triggerAnalysis = this.triggerDetector.analyzeCommentTrigger(comment);
    
    if (!triggerAnalysis.shouldProcess) {
      logger.debug(`Comment does not contain trigger phrases`, {
        repository: repository.fullName,
        issue: issue.number,
        comment: comment.id
      });
      return { processed: false, reason: 'no_trigger' };
    }
    
    logger.info(`Processing triggered comment`, {
      repository: repository.fullName,
      issue: issue.number,
      comment: comment.id,
      trigger: triggerAnalysis.trigger.primaryCommand?.type
    });
    
    try {
      const context = await this.contextExtractor.extractProblemContext(parsedWebhook, triggerAnalysis.trigger);
      
      const result = await sweOrchestrator.processComment({
        repository: repository.fullName,
        issueNumber: issue.number,
        commentBody: comment.body,
        repoUrl: repository.cloneUrl,
        trigger: triggerAnalysis.trigger,
        context
      });
      
      const formattedResult = resultProcessor.formatCommentResult(result);
      await githubClient.commentOnIssue(repository, issue.number, formattedResult);
      
      return { success: true, type: 'comment_command', result };
      
    } catch (error) {
      await this.handleProcessingError(error, parsedWebhook, repository, 'comment');
      throw error;
    }
  }

  async handlePRCommentEvent(parsedWebhook, repository) {
    const { pullRequest, comment } = parsedWebhook;
    
    const triggerAnalysis = this.triggerDetector.analyzeCommentTrigger(comment);
    
    if (!triggerAnalysis.shouldProcess) {
      logger.debug(`PR comment does not contain trigger phrases`, {
        repository: repository.fullName,
        pr: pullRequest.number,
        comment: comment.id
      });
      return { processed: false, reason: 'no_trigger' };
    }
    
    logger.info(`Processing triggered PR comment`, {
      repository: repository.fullName,
      pr: pullRequest.number,
      comment: comment.id,
      trigger: triggerAnalysis.trigger.primaryCommand?.type,
      file: comment.path
    });
    
    try {
      const context = await this.contextExtractor.extractProblemContext(parsedWebhook, triggerAnalysis.trigger);
      
      const result = await sweOrchestrator.processPRComment({
        repository: repository.fullName,
        prNumber: pullRequest.number,
        commentBody: comment.body,
        repoUrl: repository.cloneUrl,
        file: comment.path,
        line: comment.line,
        trigger: triggerAnalysis.trigger,
        context
      });
      
      const formattedResult = resultProcessor.formatCommentResult(result);
      await githubClient.commentOnPR(repository, pullRequest.number, formattedResult);
      
      return { success: true, type: 'pr_comment_command', result };
      
    } catch (error) {
      await this.handleProcessingError(error, parsedWebhook, repository, 'pr_comment');
      throw error;
    }
  }

  async handleProcessingError(error, parsedWebhook, repository, type) {
    logger.error(`${type} processing failed:`, {
      error: error.message,
      repository: repository.fullName,
      event: parsedWebhook.event,
      action: parsedWebhook.action
    });
    
    try {
      await this.updateStatus(repository, type, this.getItemNumber(parsedWebhook), 'error', `SWE-Agent ${type} failed`);
    } catch (statusError) {
      logger.error('Failed to update error status:', statusError);
    }
  }

  async updateStatus(repository, type, number, state, description) {
    try {
      if (type === 'issue') {
        await githubClient.updateIssueStatus(repository, number, state, description);
      } else if (type === 'pr') {
        // Would need SHA for PR status update
        logger.debug('PR status update skipped - SHA needed');
      }
    } catch (error) {
      logger.warn('Status update failed:', error);
    }
  }

  getItemNumber(parsedWebhook) {
    return parsedWebhook.issue?.number || parsedWebhook.pullRequest?.number || 0;
  }

  canSendErrorFeedback(parsedWebhook) {
    return parsedWebhook.repository && 
           (parsedWebhook.issue || parsedWebhook.pullRequest) &&
           ['issue_comment', 'pull_request_review_comment'].includes(parsedWebhook.event);
  }

  async sendErrorFeedback(parsedWebhook, error) {
    try {
      const repository = this.webhookParser.extractRepositoryInfo(parsedWebhook);
      const itemNumber = this.getItemNumber(parsedWebhook);
      const errorMessage = `❌ SWE-Agent processing failed: ${error.message}`;
      
      if (parsedWebhook.issue) {
        await githubClient.commentOnIssue(repository, itemNumber, errorMessage);
      } else if (parsedWebhook.pullRequest) {
        await githubClient.commentOnPR(repository, itemNumber, errorMessage);
      }
    } catch (feedbackError) {
      logger.error('Failed to send error feedback:', feedbackError);
    }
  }

  updateMetrics(processingTime, error) {
    this.metrics.processed++;
    if (error) this.metrics.errors++;
    
    this.metrics.avgProcessingTime = (
      (this.metrics.avgProcessingTime * (this.metrics.processed - 1)) + processingTime
    ) / this.metrics.processed;
    
    this.metrics.lastProcessed = new Date().toISOString();
  }

  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.processed > 0 ? (this.metrics.errors / this.metrics.processed) : 0,
      permissionCache: this.permissionValidator.getCacheStats()
    };
  }

  // Legacy compatibility methods
  async handleIssueOpened(context) {
    logger.warn('Using legacy handleIssueOpened method - consider migrating to processWebhook');
    const rawPayload = JSON.stringify(context.payload);
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': context.delivery || 'legacy',
      'x-hub-signature-256': 'legacy'
    };
    
    return this.processWebhook(rawPayload, headers);
  }

  async handlePullRequestOpened(context) {
    logger.warn('Using legacy handlePullRequestOpened method - consider migrating to processWebhook');
    const rawPayload = JSON.stringify(context.payload);
    const headers = {
      'x-github-event': 'pull_request',
      'x-github-delivery': context.delivery || 'legacy',
      'x-hub-signature-256': 'legacy'
    };
    
    return this.processWebhook(rawPayload, headers);
  }

  async handleIssueComment(context) {
    logger.warn('Using legacy handleIssueComment method - consider migrating to processWebhook');
    const rawPayload = JSON.stringify(context.payload);
    const headers = {
      'x-github-event': 'issue_comment',
      'x-github-delivery': context.delivery || 'legacy',
      'x-hub-signature-256': 'legacy'
    };
    
    return this.processWebhook(rawPayload, headers);
  }
}

module.exports = new EnhancedGitHubHandler();