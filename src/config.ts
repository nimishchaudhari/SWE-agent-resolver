// filepath: /workspaces/swe-agent-resolver/src/config.ts
import * as core from '@actions/core';
import { log, logWarning, logError, logSuccess } from './utils';

export interface Config {
  githubToken: string;
  triggerPhrase: string;
  githubApiUrl: string;
  githubRepository: string;
  // AI Model Configuration
  apiProvider?: string; // Added: Preferred API provider
  llmApiKey?: string; // Generic, if used
  openAiApiKey?: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;
  openRouterApiKey?: string;
  geminiApiKey?: string;
  modelName: string;
  codeReviewModel?: string; // Optional: specific model for code reviews
  openRouterModel?: string; // Optional: specific model for openrouter
  modelTemperature?: number;
  modelTopP?: number;
  modelMaxTokens?: number;

  // Enhanced Response Mode Configuration
  responseMode: 'auto' | 'comment' | 'pr' | 'none';
  enableVisualContent: boolean;
  visualContentFormat: 'all' | 'mermaid' | 'ascii' | 'code';
  maxCommentLength: number;

  // Multi-Context Support Configuration
  contextMode: 'auto' | 'issue' | 'pr_comment' | 'pr_review' | 'pr_commit';
  prStrategy: 'continue' | 'new' | 'skip';
  gitReferenceMode: 'auto' | 'sha' | 'branch';
  enableReviewContext: boolean;
  targetBranchStrategy: 'auto' | 'default_branch' | 'pr_target_branch';

  // SWE-Agent specific (can be expanded)
  sweAgentImage: string;
  sweAgentArgs: string[];
  sweAgentSetupCommands: string[];
  dataDir?: string; // For SWE-Agent data persistence
  logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
}

export function loadConfig(): Config {
  const githubToken = core.getInput('GITHUB_TOKEN', { required: true });
  const modelName = core.getInput('MODEL_NAME') || 'gpt-4o';

  const config: Config = {
    githubToken,
    triggerPhrase: core.getInput('TRIGGER_PHRASE') || '@swe-agent',
    githubApiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    githubRepository: process.env.GITHUB_REPOSITORY || '',

    apiProvider: core.getInput('API_PROVIDER'), // Added
    llmApiKey: core.getInput('LLM_API_KEY'),
    openAiApiKey: core.getInput('OPENAI_API_KEY'),
    anthropicApiKey: core.getInput('ANTHROPIC_API_KEY'),
    deepseekApiKey: core.getInput('DEEPSEEK_API_KEY'),
    openRouterApiKey: core.getInput('OPENROUTER_API_KEY'),
    geminiApiKey: core.getInput('GEMINI_API_KEY'),
    modelName,
    codeReviewModel: core.getInput('CODE_REVIEW_MODEL') || modelName,
    openRouterModel: core.getInput('OPENROUTER_MODEL_NAME'),


    responseMode: (core.getInput('RESPONSE_MODE') || 'auto') as Config['responseMode'],
    enableVisualContent: core.getBooleanInput('ENABLE_VISUAL_CONTENT'),
    visualContentFormat: (core.getInput('VISUAL_CONTENT_FORMAT') || 'all') as Config['visualContentFormat'],
    maxCommentLength: parseInt(core.getInput('MAX_COMMENT_LENGTH') || '65536', 10),

    contextMode: (core.getInput('CONTEXT_MODE') || 'auto') as Config['contextMode'],
    prStrategy: (core.getInput('PR_STRATEGY') || 'continue') as Config['prStrategy'],
    gitReferenceMode: (core.getInput('GIT_REFERENCE_MODE') || 'auto') as Config['gitReferenceMode'],
    enableReviewContext: core.getBooleanInput('ENABLE_REVIEW_CONTEXT'),
    targetBranchStrategy: (core.getInput('TARGET_BRANCH_STRATEGY') || 'auto') as Config['targetBranchStrategy'],
    
    sweAgentImage: core.getInput('SWE_AGENT_IMAGE') || 'ghcr.io/sweepai/swe-agent:latest',
    sweAgentArgs: core.getMultilineInput('SWE_AGENT_ARGS'),
    sweAgentSetupCommands: core.getMultilineInput('SWE_AGENT_SETUP_COMMANDS'),
    dataDir: core.getInput('SWE_AGENT_DATA_DIR'),
    logLevel: (core.getInput('LOG_LEVEL') || 'INFO').toUpperCase() as Config['logLevel'],
  };

  config.modelTemperature = core.getInput('MODEL_TEMPERATURE') ? parseFloat(core.getInput('MODEL_TEMPERATURE')) : undefined;
  config.modelTopP = core.getInput('MODEL_TOP_P') ? parseFloat(core.getInput('MODEL_TOP_P')) : undefined;
  config.modelMaxTokens = core.getInput('MODEL_MAX_TOKENS') ? parseInt(core.getInput('MODEL_MAX_TOKENS'), 10) : undefined;

  // Validate temperature and top_p ranges if they are set
  if (config.modelTemperature !== undefined && (config.modelTemperature < 0 || config.modelTemperature > 2)) {
    logWarning('MODEL_TEMPERATURE is out of the typical range (0-2). Using default or model provider\'s default.');
    config.modelTemperature = undefined; // Or set to a default like 0.7
  }
  if (config.modelTopP !== undefined && (config.modelTopP < 0 || config.modelTopP > 1)) {
    logWarning('MODEL_TOP_P is out of the typical range (0-1). Using default or model provider\'s default.');
    config.modelTopP = undefined; // Or set to a default like 1.0
  }

  // Validate required configuration
  const validationErrors: string[] = [];
  if (!config.githubToken) {
    validationErrors.push('GITHUB_TOKEN is required');
  }
  if (!config.githubRepository) {
    validationErrors.push('GITHUB_REPOSITORY is required (usually set by GitHub Actions)');
  }

  const apiKeysConfigured = [
    config.openAiApiKey,
    config.anthropicApiKey,
    config.deepseekApiKey,
    config.openRouterApiKey,
    config.geminiApiKey,
    config.llmApiKey, // Generic key
  ].filter(Boolean);

  if (apiKeysConfigured.length === 0) {
    logWarning('No specific AI API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) detected. The action might rely on a generic LLM_API_KEY or other authentication methods for the selected model.');
  } else {
    logSuccess(`API keys configured for: ${apiKeysConfigured.length} provider(s).`);
  }
  
  if (validationErrors.length > 0) {
    validationErrors.forEach(err => logError(err));
    throw new Error('Configuration validation failed. See logs for details.');
  }

  logSuccess('✅ Configuration loaded and validated successfully.');
  return config;
}

export function displayConfigSummary(config: Config): void {
  log('📋 Configuration Summary:');
  log(`  - Model: ${config.modelName}`);
  log(`  - Response Mode: ${config.responseMode}`);
  log(`  - Context Mode: ${config.contextMode}`);
  log(`  - Visual Content: ${config.enableVisualContent}`);
  log(`  - Repository: ${config.githubRepository}`);
  log(`  - Trigger Phrase: ${config.triggerPhrase}`);
  log(`  - SWE Agent Image: ${config.sweAgentImage}`);
  log(`  - Log Level: ${config.logLevel}`);
}

// Example of how model-specific parameters might be handled in TypeScript
// This is more illustrative; actual SWE-Agent CLI args will be built dynamically.
export function getModelSpecificSweAgentArgs(modelName: string): string[] {
    const params: string[] = [];
    if (['openai/o1', 'openai/o3', 'openai/o3-mini', 'openai/o4-mini'].includes(modelName)) {
        params.push('--agent.model.top_p', 'null', '--agent.model.temperature', '1.0');
    }
    // Add other model-specific args as needed
    return params;
}
