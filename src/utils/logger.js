/**
 * Centralized logging utility with GitHub Actions integration
 */

const winston = require('winston');
const path = require('path');

// Custom format for GitHub Actions
const githubActionsFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  // GitHub Actions log commands
  const logCommands = {
    error: '::error::',
    warn: '::warning::',
    notice: '::notice::',
    debug: '::debug::'
  };
  
  const prefix = process.env.GITHUB_ACTIONS === 'true' ? (logCommands[level] || '') : '';
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  
  return `${prefix}[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`.trim();
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    githubActionsFormat
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ],
  exitOnError: false
});

// Add file transport if log directory is available
if (process.env.LOG_DIR) {
  logger.add(new winston.transports.File({
    filename: path.join(process.env.LOG_DIR, 'swe-agent-resolver.log'),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
  
  logger.add(new winston.transports.File({
    filename: path.join(process.env.LOG_DIR, 'error.log'),
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 3,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

/**
 * Log with performance timing
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to execute
 * @returns {Promise} Function result
 */
async function logPerformance(operation, fn) {
  const start = Date.now();
  logger.info(`🚀 Starting ${operation}`);
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.info(`✅ Completed ${operation} in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`❌ Failed ${operation} after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Log cost information
 * @param {Object} costInfo - Cost information
 */
function logCost(costInfo) {
  if (!costInfo) return;
  
  logger.info('💰 Cost Information:', {
    provider: costInfo.provider,
    inputTokens: costInfo.inputTokens,
    outputTokens: costInfo.outputTokens,
    totalCost: costInfo.totalCost,
    currency: costInfo.currency
  });
}

/**
 * Log provider information
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {string} status - Status
 */
function logProvider(provider, model, status) {
  const emoji = {
    'openai': '🤖',
    'anthropic': '🧠',
    'azure': '☁️',
    'deepseek': '🌊',
    'openrouter': '🔀',
    'together': '🤝',
    'groq': '⚡',
    'mistral': '🌀',
    'cohere': '🔗',
    'perplexity': '🔍',
    'anyscale': '📈',
    'custom': '🛠️'
  }[provider] || '🤖';
  
  logger.info(`${emoji} Provider: ${provider} | Model: ${model} | Status: ${status}`);
}

/**
 * Create child logger with context
 * @param {Object} context - Context information
 * @returns {Object} Child logger
 */
function createChildLogger(context) {
  return logger.child(context);
}

/**
 * Log GitHub event information
 * @param {Object} eventPayload - GitHub event payload
 */
function logGitHubEvent(eventPayload) {
  const safePayload = {
    action: eventPayload.action,
    event_type: eventPayload.zen ? 'ping' : 'unknown',
    repository: eventPayload.repository?.full_name,
    sender: eventPayload.sender?.login,
    issue_number: eventPayload.issue?.number,
    pull_request_number: eventPayload.pull_request?.number
  };
  
  logger.info('📫 GitHub Event:', safePayload);
}

/**
 * Log SWE-agent execution details
 * @param {string} configPath - Configuration file path
 * @param {string} command - SWE-agent command
 * @param {Object} options - Execution options
 */
function logSWEAgentExecution(configPath, command, options = {}) {
  logger.info('🔧 SWE-Agent Execution:', {
    configPath,
    command,
    timeout: options.timeout,
    workspace: options.workspace
  });
}

// Defensive export to ensure all logger methods are available
const loggerExports = {
  logPerformance,
  logCost,
  logProvider,
  createChildLogger,
  logGitHubEvent,
  logSWEAgentExecution
};

// Add all winston logger methods
Object.setPrototypeOf(loggerExports, logger);

// Ensure critical methods are available even if logger isn't fully initialized
if (!loggerExports.error) {
  loggerExports.error = (...args) => console.error('[ERROR]', ...args);
}
if (!loggerExports.info) {
  loggerExports.info = (...args) => console.log('[INFO]', ...args);
}
if (!loggerExports.warn) {
  loggerExports.warn = (...args) => console.warn('[WARN]', ...args);
}
if (!loggerExports.debug) {
  loggerExports.debug = (...args) => console.log('[DEBUG]', ...args);
}

module.exports = loggerExports;