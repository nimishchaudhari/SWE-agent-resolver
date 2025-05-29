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