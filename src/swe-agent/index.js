const EnhancedOrchestrator = require('./enhanced-orchestrator');
const config = require('../config');

// Create singleton instance
const orchestrator = new EnhancedOrchestrator({
  filesystem: {
    baseWorkspace: '/tmp/swe-agent-workspace',
    maxWorkspaces: config.sweAgent.maxConcurrentJobs * 2,
    maxWorkspaceSize: '5GB',
    cleanupInterval: 1800000 // 30 minutes
  },
  processManager: {
    maxConcurrent: config.sweAgent.maxConcurrentJobs,
    defaultTimeout: config.sweAgent.timeout,
    maxMemory: '2GB',
    maxCpu: 200
  }
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down SWE-Agent orchestrator...');
  
  try {
    await orchestrator.killAllJobs('shutdown');
    console.log('SWE-Agent orchestrator shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down SWE-Agent orchestrator...');
  
  try {
    await orchestrator.killAllJobs('shutdown');
    console.log('SWE-Agent orchestrator shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Export enhanced orchestrator with legacy compatibility
module.exports = {
  // Enhanced methods
  processIssue: orchestrator.processIssue.bind(orchestrator),
  processPullRequest: orchestrator.processPullRequest.bind(orchestrator),
  processComment: orchestrator.processComment.bind(orchestrator),
  processPRComment: orchestrator.processPRComment.bind(orchestrator),
  
  // Status and management
  getStatus: orchestrator.getStatus.bind(orchestrator),
  getJobStatus: orchestrator.getJobStatus.bind(orchestrator),
  getActiveJobs: orchestrator.getActiveJobs.bind(orchestrator),
  killJob: orchestrator.killJob.bind(orchestrator),
  killAllJobs: orchestrator.killAllJobs.bind(orchestrator),
  healthCheck: orchestrator.healthCheck.bind(orchestrator),
  
  // Direct access to components
  getOrchestrator: () => orchestrator,
  
  // Legacy compatibility (delegates to enhanced methods)
  executeJob: async (jobId, jobParams) => {
    const type = jobParams.type || 'generic';
    
    switch (type) {
      case 'issue':
        return orchestrator.processIssue(jobParams);
      case 'pr':
        return orchestrator.processPullRequest(jobParams);
      case 'comment':
        return orchestrator.processComment(jobParams);
      default:
        return orchestrator.processComment(jobParams);
    }
  },
  
  generateJobId: () => orchestrator.generateJobId('legacy'),
  
  // Utility exports
  ConfigGenerator: require('./config-generator'),
  ProcessManager: require('./process-manager'),
  OutputParser: require('./output-parser'),
  FilesystemManager: require('./filesystem-manager'),
  ResultValidator: require('./result-validator')
};