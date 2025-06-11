/**
 * Environment Utilities
 * Simple environment setup and validation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function validateEnvironment() {
  const errors = [];
  
  // Check required environment variables
  if (!process.env.GITHUB_TOKEN) {
    errors.push('GITHUB_TOKEN is required');
  }
  
  // Check if we have at least one AI provider API key
  const hasApiKey = !!(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.AZURE_OPENAI_API_KEY
  );
  
  if (!hasApiKey) {
    errors.push('At least one AI provider API key is required (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)');
  }
  
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

function setupWorkspace() {
  // Create basic workspace directory
  const workspaceBase = path.join(os.tmpdir(), 'swe-workspace');
  
  try {
    if (!fs.existsSync(workspaceBase)) {
      fs.mkdirSync(workspaceBase, { recursive: true });
    }
    
    // Test write permissions
    const testFile = path.join(workspaceBase, '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return workspaceBase;
  } catch (error) {
    throw new Error(`Failed to setup workspace: ${error.message}`);
  }
}

function getSafeEnvironment() {
  // Return environment variables safe for logging (no secrets)
  return {
    nodeVersion: process.version,
    platform: process.platform,
    githubActions: process.env.GITHUB_ACTIONS,
    runner: process.env.RUNNER_OS,
    workspace: process.env.GITHUB_WORKSPACE,
    eventName: process.env.GITHUB_EVENT_NAME,
    repository: process.env.GITHUB_REPOSITORY,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    hasDeepSeek: !!process.env.DEEPSEEK_API_KEY,
    hasGroq: !!process.env.GROQ_API_KEY
  };
}

function checkSWEAgentCLI() {
  // Simple check if SWE-agent CLI is available
  try {
    const { execSync } = require('child_process');
    execSync('sweagent --help', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  validateEnvironment,
  setupWorkspace,
  getSafeEnvironment,
  checkSWEAgentCLI
};