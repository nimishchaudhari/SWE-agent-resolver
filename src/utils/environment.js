/**
 * Environment validation and setup utilities
 */

const fs = require('fs');
const path = require('path');

/**
 * Validate all required environment variables
 * @returns {Object} Validation result with errors
 */
function validateEnvironment() {
  const errors = [];
  const warnings = [];
  
  // Required for GitHub Actions
  const requiredVars = [
    'GITHUB_TOKEN',
    'GITHUB_WORKSPACE',
    'GITHUB_EVENT_NAME',
    'GITHUB_EVENT_PATH'
  ];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }
  
  // Validate GitHub event file exists
  if (process.env.GITHUB_EVENT_PATH && !fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
    errors.push(`GitHub event file not found: ${process.env.GITHUB_EVENT_PATH}`);
  }
  
  // Check for at least one AI provider API key
  const providerKeys = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'AZURE_OPENAI_API_KEY',
    'DEEPSEEK_API_KEY',
    'OPENROUTER_API_KEY',
    'GROQ_API_KEY',
    'TOGETHER_API_KEY',
    'MISTRAL_API_KEY',
    'COHERE_API_KEY',
    'PERPLEXITY_API_KEY',
    'ANYSCALE_API_KEY',
    'CUSTOM_LLM_API_KEY'
  ];
  
  const hasProviderKey = providerKeys.some(key => process.env[key]);
  if (!hasProviderKey) {
    errors.push(`No AI provider API key found. Please set at least one of: ${providerKeys.join(', ')}`);
  }
  
  // Validate workspace directory
  if (process.env.GITHUB_WORKSPACE && !fs.existsSync(process.env.GITHUB_WORKSPACE)) {
    errors.push(`GitHub workspace directory not found: ${process.env.GITHUB_WORKSPACE}`);
  }
  
  // Check for SWE-agent CLI availability
  try {
    require('child_process').execSync('which sweagent', { stdio: 'pipe' });
  } catch (error) {
    warnings.push('SWE-agent CLI not found in PATH. Will attempt to install.');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Setup logging configuration
 */
function setupLogging() {
  // Set log level based on environment
  const debugMode = process.env.INPUT_DEBUG_MODE === 'true' || process.env.DEBUG === 'true';
  process.env.LOG_LEVEL = debugMode ? 'debug' : 'info';
  
  // Ensure log directory exists
  const logDir = path.join(process.env.GITHUB_WORKSPACE || '/tmp', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  process.env.LOG_DIR = logDir;
}

/**
 * Get safe environment variables for logging (exclude secrets)
 * @returns {Object} Safe environment variables
 */
function getSafeEnvironment() {
  const safeEnv = {};
  const secretPatterns = [
    /api_key/i,
    /token/i,
    /secret/i,
    /password/i,
    /auth/i
  ];
  
  for (const [key, value] of Object.entries(process.env)) {
    const isSecret = secretPatterns.some(pattern => pattern.test(key));
    safeEnv[key] = isSecret ? '[REDACTED]' : value;
  }
  
  return safeEnv;
}

/**
 * Validate input parameters
 * @param {Object} inputs - Action inputs
 * @returns {Object} Validation result
 */
function validateInputs(inputs) {
  const errors = [];
  
  // Validate model name
  if (!inputs.modelName || typeof inputs.modelName !== 'string') {
    errors.push('Invalid model_name: must be a non-empty string');
  }
  
  // Validate max cost
  if (inputs.maxCost !== undefined) {
    const cost = parseFloat(inputs.maxCost);
    if (isNaN(cost) || cost < 0) {
      errors.push('Invalid max_cost: must be a positive number');
    }
  }
  
  // Validate timeout
  if (inputs.workspaceTimeout !== undefined) {
    const timeout = parseInt(inputs.workspaceTimeout);
    if (isNaN(timeout) || timeout < 30 || timeout > 7200) {
      errors.push('Invalid workspace_timeout: must be between 30 and 7200 seconds');
    }
  }
  
  // Validate trigger phrase
  if (inputs.triggerPhrase && inputs.triggerPhrase.length < 3) {
    errors.push('Invalid trigger_phrase: must be at least 3 characters');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create secure temporary directory
 * @returns {string} Path to temporary directory
 */
function createTempDirectory() {
  const os = require('os');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swe-agent-'));
  
  // Set restrictive permissions
  fs.chmodSync(tempDir, 0o700);
  
  return tempDir;
}

module.exports = {
  validateEnvironment,
  setupLogging,
  getSafeEnvironment,
  validateInputs,
  createTempDirectory
};