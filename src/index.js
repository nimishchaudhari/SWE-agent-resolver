#!/usr/bin/env node

/**
 * Main entry point for SWE-Agent Resolver
 * Orchestrates the complete workflow from GitHub events to AI-powered responses
 */

const SWEAgentAction = require('../action/entrypoint');
const { validateEnvironment, setupLogging } = require('./utils/environment');
const logger = require('./utils/logger');

async function main() {
  try {
    // Setup logging and validate environment
    setupLogging();
    logger.info('🚀 Starting SWE-Agent Resolver');
    
    // Validate required environment variables
    const validation = validateEnvironment();
    if (!validation.valid) {
      logger.error('❌ Environment validation failed:', validation.errors);
      process.exit(1);
    }
    
    // Initialize and run the action
    const action = new SWEAgentAction();
    await action.run();
    
    logger.info('✅ SWE-Agent Resolver completed successfully');
    
  } catch (error) {
    logger.error('❌ Fatal error in SWE-Agent Resolver:', error);
    
    // Set GitHub Action failure status
    if (process.env.GITHUB_ACTIONS === 'true') {
      const core = require('@actions/core');
      core.setFailed(error.message || 'Unknown error occurred');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { main };