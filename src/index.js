const express = require('express');
const { createServer } = require('http');
const { Webhooks } = require('@octokit/webhooks');
const config = require('./config');
const logger = require('./utils/logger');
const githubHandler = require('./github/handler');

const app = express();
const webhooks = new Webhooks({ secret: config.github.webhookSecret });

app.use('/webhook', webhooks.middleware);

webhooks.on('issues.opened', githubHandler.handleIssueOpened);
webhooks.on('pull_request.opened', githubHandler.handlePullRequestOpened);
webhooks.on('issue_comment.created', githubHandler.handleIssueComment);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
  try {
    const metrics = githubHandler.getMetrics();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ...metrics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/pipeline/:pipelineId/status', (req, res) => {
  try {
    const { pipelineId } = req.params;
    const status = githubHandler.getPipelineStatus(pipelineId);
    
    if (!status) {
      return res.status(404).json({
        error: 'Pipeline not found',
        pipelineId
      });
    }
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      pipelineId: req.params.pipelineId
    });
  }
});

app.get('/metrics', (req, res) => {
  try {
    const metrics = githubHandler.getMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      metrics: metrics.pipelineStatus.metrics,
      activeJobs: metrics.pipelineStatus.activePipelines,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

const server = createServer(app);

server.listen(config.server.port, () => {
  logger.info(`SWE-Agent GitHub Action server listening on port ${config.server.port}`);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});