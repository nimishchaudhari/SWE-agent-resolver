const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

/**
 * Simplified LLM Configuration Builder for SWE-Agent
 * 
 * Follows SWE-agent's configuration patterns:
 * - Uses environment variables with $VARIABLE_NAME syntax
 * - Supports api_base and name fields in GenericAPIModelConfig format
 * - Compatible with .env file loading
 * - Generates proper YAML configurations
 */
class LLMConfigBuilder {
  constructor() {
    // Preset configurations for popular LLM providers
    this.presets = {
      // Anthropic Claude configurations
      'claude-3-5-sonnet': {
        name: 'claude-3-5-sonnet-20241022',
        api_base: 'https://api.anthropic.com',
        api_key: '$ANTHROPIC_API_KEY',
        max_tokens: 200000,
        temperature: 0.0,
        provider: 'anthropic',
        supports_function_calling: true
      },
      'claude-3-haiku': {
        name: 'claude-3-haiku-20240307',
        api_base: 'https://api.anthropic.com',
        api_key: '$ANTHROPIC_API_KEY',
        max_tokens: 200000,
        temperature: 0.0,
        provider: 'anthropic',
        supports_function_calling: true
      },
      
      // OpenAI configurations
      'gpt-4': {
        name: 'gpt-4',
        api_base: 'https://api.openai.com/v1',
        api_key: '$OPENAI_API_KEY',
        max_tokens: 128000,
        temperature: 0.0,
        provider: 'openai',
        supports_function_calling: true
      },
      'gpt-4-turbo': {
        name: 'gpt-4-turbo-preview',
        api_base: 'https://api.openai.com/v1',
        api_key: '$OPENAI_API_KEY',
        max_tokens: 128000,
        temperature: 0.0,
        provider: 'openai',
        supports_function_calling: true
      },
      'gpt-3.5-turbo': {
        name: 'gpt-3.5-turbo',
        api_base: 'https://api.openai.com/v1',
        api_key: '$OPENAI_API_KEY',
        max_tokens: 16385,
        temperature: 0.0,
        provider: 'openai',
        supports_function_calling: true
      },
      
      // Local model configurations
      'local-llama': {
        name: 'llama-2-7b-chat',
        api_base: '$LOCAL_LLM_URL',
        api_key: '$LOCAL_LLM_API_KEY',
        max_tokens: 4096,
        temperature: 0.1,
        provider: 'local',
        supports_function_calling: false
      },
      'local-codellama': {
        name: 'codellama-7b-instruct',
        api_base: '$LOCAL_LLM_URL',
        api_key: '$LOCAL_LLM_API_KEY',
        max_tokens: 4096,
        temperature: 0.1,
        provider: 'local',
        supports_function_calling: false
      },
      
      // Azure OpenAI configurations
      'azure-gpt-4': {
        name: 'gpt-4',
        api_base: '$AZURE_OPENAI_ENDPOINT',
        api_key: '$AZURE_OPENAI_API_KEY',
        api_version: '$AZURE_OPENAI_API_VERSION',
        max_tokens: 128000,
        temperature: 0.0,
        provider: 'azure-openai',
        supports_function_calling: true
      }
    };
  }

  /**
   * Generate a complete SWE-agent configuration with LLM settings
   */
  async generateConfig(options = {}) {
    const {
      preset = 'claude-3-5-sonnet',
      customModel = null,
      problemType = 'issue_analysis',
      workspacePath = '/tmp/swe-agent-workspace',
      repositoryUrl = null,
      additionalTools = []
    } = options;

    // Get LLM configuration
    const llmConfig = customModel || this.presets[preset];
    
    if (!llmConfig) {
      throw new Error(`Unknown preset: ${preset}. Available presets: ${Object.keys(this.presets).join(', ')}`);
    }

    // Generate the complete SWE-agent configuration
    const config = {
      // Problem statement section
      problem_statement: {
        type: problemType,
        description: this.getProblemDescription(problemType)
      },

      // Agent configuration - compatible with SWE-agent's GenericAPIModelConfig
      agent: {
        model: {
          name: llmConfig.name,
          api_base: llmConfig.api_base,
          api_key: llmConfig.api_key,
          ...(llmConfig.api_version && { api_version: llmConfig.api_version }),
          temperature: llmConfig.temperature,
          max_tokens: llmConfig.max_tokens,
          timeout: 300
        },
        
        // Parser configuration based on function calling support
        parser: {
          name: llmConfig.supports_function_calling ? 'ToolCallingParser' : 'ThoughtActionParser',
          function_calling: llmConfig.supports_function_calling
        },
        
        // History processor
        history_processor: {
          name: 'DefaultHistoryProcessor',
          window_size: Math.min(4000, Math.floor(llmConfig.max_tokens * 0.7))
        },

        // Tools configuration
        tools: this.generateToolsConfig(llmConfig, additionalTools)
      },

      // Environment configuration
      env: {
        repo: {
          ...(repositoryUrl && { github_url: repositoryUrl }),
          base_commit: 'HEAD'
        },
        workspace: {
          mount_path: workspacePath,
          persistent: false,
          cleanup: true
        },
        environment_variables: {
          LOG_LEVEL: 'INFO',
          PYTHONPATH: '$PYTHONPATH'
        }
      },

      // Metadata
      metadata: {
        generated_by: 'swe-agent-resolver',
        generated_at: new Date().toISOString(),
        preset_used: preset,
        llm_provider: llmConfig.provider
      }
    };

    return config;
  }

  /**
   * Generate tools configuration based on LLM capabilities
   */
  generateToolsConfig(llmConfig, additionalTools = []) {
    const baseTools = llmConfig.supports_function_calling
      ? [
          { name: 'str_replace_editor' },
          { name: 'bash' },
          { name: 'file_viewer' }
        ]
      : [
          { name: 'str_replace_based_edit_tool' },
          { name: 'bash' },
          { name: 'file_viewer' }
        ];

    // Add language-specific tools
    const languageTools = [
      { name: 'python_executor', condition: 'python' },
      { name: 'node_executor', condition: 'javascript' },
      { name: 'git_tool', condition: 'always' }
    ];

    return [...baseTools, ...languageTools, ...additionalTools];
  }

  /**
   * Get problem description based on type
   */
  getProblemDescription(problemType) {
    const descriptions = {
      'issue_analysis': 'Analyze and provide insights for GitHub issues',
      'pr_review': 'Review pull requests and suggest improvements',
      'bug_fix': 'Identify and fix bugs in the codebase',
      'feature_implementation': 'Implement new features based on requirements',
      'code_refactoring': 'Refactor code to improve quality and maintainability',
      'test_generation': 'Generate comprehensive tests for the codebase',
      'documentation': 'Generate or improve code documentation',
      'general_task': 'General software engineering assistance'
    };

    return descriptions[problemType] || descriptions['general_task'];
  }

  /**
   * Generate environment file template
   */
  generateEnvTemplate(preset = 'claude-3-5-sonnet') {
    const llmConfig = this.presets[preset];
    const envVars = new Set();
    
    // Extract environment variables from the configuration
    this.extractEnvVars(llmConfig, envVars);
    
    const envTemplate = [
      '# SWE-Agent Resolver Environment Configuration',
      '# Generated environment template',
      '',
      '# GitHub Configuration',
      'GITHUB_TOKEN=your_github_token_here',
      'GITHUB_WEBHOOK_SECRET=your_webhook_secret_here',
      '',
      '# LLM Configuration',
      ...Array.from(envVars).sort().map(varName => {
        const description = this.getEnvVarDescription(varName);
        return `${varName}=your_${varName.toLowerCase()}_here  # ${description}`;
      }),
      '',
      '# Optional: Local LLM Configuration (for local models)',
      'LOCAL_LLM_URL=http://localhost:8080/v1  # Your local LLM endpoint',
      'LOCAL_LLM_API_KEY=your_local_api_key  # Optional API key for local models',
      '',
      '# Optional: Azure OpenAI Configuration',
      'AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/',
      'AZURE_OPENAI_API_KEY=your_azure_api_key',
      'AZURE_OPENAI_API_VERSION=2024-02-15-preview',
      '',
      '# SWE-Agent Configuration',
      'SWE_AGENT_PATH=/usr/local/bin/swe-agent',
      'SWE_AGENT_TIMEOUT=600000',
      'MAX_CONCURRENT_JOBS=3',
      '',
      '# Logging',
      'LOG_LEVEL=info'
    ];

    return envTemplate.join('\n');
  }

  /**
   * Extract environment variables from configuration
   */
  extractEnvVars(obj, envVars) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        envVars.add(value.substring(1));
      } else if (typeof value === 'object' && value !== null) {
        this.extractEnvVars(value, envVars);
      }
    }
  }

  /**
   * Get description for environment variables
   */
  getEnvVarDescription(varName) {
    const descriptions = {
      'ANTHROPIC_API_KEY': 'Anthropic Claude API key',
      'OPENAI_API_KEY': 'OpenAI API key',
      'AZURE_OPENAI_API_KEY': 'Azure OpenAI API key',
      'AZURE_OPENAI_ENDPOINT': 'Azure OpenAI endpoint URL',
      'AZURE_OPENAI_API_VERSION': 'Azure OpenAI API version',
      'LOCAL_LLM_URL': 'Local LLM endpoint URL',
      'LOCAL_LLM_API_KEY': 'Local LLM API key (if required)'
    };

    return descriptions[varName] || 'Configuration value';
  }

  /**
   * Save configuration to YAML file
   */
  async saveConfig(config, filePath) {
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      quotingType: '"'
    });

    await fs.writeFile(filePath, yamlContent, 'utf8');
    logger.info(`Configuration saved to ${filePath}`);
    
    return yamlContent;
  }

  /**
   * Save environment template to file
   */
  async saveEnvTemplate(preset, filePath) {
    const envContent = this.generateEnvTemplate(preset);
    await fs.writeFile(filePath, envContent, 'utf8');
    logger.info(`Environment template saved to ${filePath}`);
    
    return envContent;
  }

  /**
   * Interactive configuration builder
   */
  async buildInteractiveConfig() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => rl.question(query, resolve));

    try {
      console.log('\n🤖 SWE-Agent Configuration Builder\n');
      
      // Show available presets
      console.log('Available LLM presets:');
      Object.keys(this.presets).forEach((preset, index) => {
        const config = this.presets[preset];
        console.log(`  ${index + 1}. ${preset} (${config.provider})`);
      });
      
      const presetChoice = await question('\nSelect a preset (1-' + Object.keys(this.presets).length + ') or enter custom preset name: ');
      const presetIndex = parseInt(presetChoice) - 1;
      const preset = presetIndex >= 0 && presetIndex < Object.keys(this.presets).length 
        ? Object.keys(this.presets)[presetIndex]
        : presetChoice.trim();

      const problemType = await question('Problem type (issue_analysis/pr_review/bug_fix/feature_implementation): ') || 'issue_analysis';
      const workspacePath = await question('Workspace path (/tmp/swe-agent-workspace): ') || '/tmp/swe-agent-workspace';
      const repositoryUrl = await question('Repository URL (optional): ');

      const config = await this.generateConfig({
        preset,
        problemType,
        workspacePath,
        repositoryUrl: repositoryUrl || null
      });

      const configPath = await question('Save configuration to (swe-agent-config.yaml): ') || 'swe-agent-config.yaml';
      const envPath = await question('Save environment template to (.env.example): ') || '.env.example';

      await this.saveConfig(config, configPath);
      await this.saveEnvTemplate(preset, envPath);

      console.log('\n✅ Configuration generated successfully!');
      console.log(`📄 Config saved to: ${configPath}`);
      console.log(`🔧 Environment template saved to: ${envPath}`);
      console.log('\nNext steps:');
      console.log(`1. Copy ${envPath} to .env and fill in your API keys`);
      console.log(`2. Test the configuration with: swe-agent --config ${configPath}`);

      return { config, configPath, envPath };

    } finally {
      rl.close();
    }
  }

  /**
   * Quick setup for common scenarios
   */
  async quickSetup(scenario = 'github-integration') {
    const scenarios = {
      'github-integration': {
        preset: 'claude-3-5-sonnet',
        problemType: 'issue_analysis',
        workspacePath: '/tmp/swe-agent-workspace',
        description: 'Standard GitHub integration setup'
      },
      'pr-review': {
        preset: 'gpt-4',
        problemType: 'pr_review',
        workspacePath: '/tmp/swe-agent-workspace',
        description: 'Pull request review setup'
      },
      'local-development': {
        preset: 'local-llama',
        problemType: 'general_task',
        workspacePath: './workspace',
        description: 'Local development with local LLM'
      },
      'enterprise': {
        preset: 'azure-gpt-4',
        problemType: 'issue_analysis',
        workspacePath: '/opt/swe-agent/workspace',
        description: 'Enterprise setup with Azure OpenAI'
      }
    };

    const scenarioConfig = scenarios[scenario];
    if (!scenarioConfig) {
      throw new Error(`Unknown scenario: ${scenario}. Available scenarios: ${Object.keys(scenarios).join(', ')}`);
    }

    console.log(`\n🚀 Quick Setup: ${scenarioConfig.description}\n`);

    const config = await this.generateConfig(scenarioConfig);
    
    const configPath = `swe-agent-${scenario}.yaml`;
    const envPath = `.env.${scenario}`;

    await this.saveConfig(config, configPath);
    await this.saveEnvTemplate(scenarioConfig.preset, envPath);

    console.log('✅ Quick setup completed!');
    console.log(`📄 Config: ${configPath}`);
    console.log(`🔧 Environment: ${envPath}`);

    return { config, configPath, envPath, scenario: scenarioConfig };
  }

  /**
   * Validate LLM configuration
   */
  async validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate agent.model section
    if (!config.agent?.model?.name) {
      errors.push('agent.model.name is required');
    }

    if (!config.agent?.model?.api_key) {
      errors.push('agent.model.api_key is required');
    }

    if (!config.agent?.model?.api_base) {
      warnings.push('agent.model.api_base not specified, using default');
    }

    // Validate environment variables
    const envVars = new Set();
    this.extractEnvVars(config, envVars);

    for (const varName of envVars) {
      if (!process.env[varName]) {
        warnings.push(`Environment variable ${varName} is not set`);
      }
    }

    // Validate tools configuration
    if (!config.agent?.tools || config.agent.tools.length === 0) {
      warnings.push('No tools configured, agent capabilities will be limited');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      environmentVariables: Array.from(envVars)
    };
  }

  /**
   * List available presets with details
   */
  listPresets() {
    console.log('\n📋 Available LLM Presets:\n');
    
    Object.entries(this.presets).forEach(([name, config]) => {
      console.log(`🔹 ${name}`);
      console.log(`   Provider: ${config.provider}`);
      console.log(`   Model: ${config.name}`);
      console.log(`   Max Tokens: ${config.max_tokens.toLocaleString()}`);
      console.log(`   Function Calling: ${config.supports_function_calling ? '✅' : '❌'}`);
      console.log(`   API Key: ${config.api_key}`);
      console.log('');
    });
  }
}

module.exports = LLMConfigBuilder;