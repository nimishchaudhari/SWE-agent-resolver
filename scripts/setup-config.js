#!/usr/bin/env node

const LLMConfigBuilder = require('../src/config/llm-config-builder');
const path = require('path');
const fs = require('fs').promises;

/**
 * SWE-Agent Configuration Setup CLI
 * 
 * Easy command-line tool for generating SWE-agent configurations
 */
class ConfigSetupCLI {
  constructor() {
    this.configBuilder = new LLMConfigBuilder();
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
      switch (command) {
        case 'interactive':
        case 'i':
          await this.runInteractiveSetup();
          break;
          
        case 'quick':
        case 'q':
          const scenario = args[1] || 'github-integration';
          await this.runQuickSetup(scenario);
          break;
          
        case 'presets':
        case 'list':
        case 'p':
          this.configBuilder.listPresets();
          break;
          
        case 'generate':
        case 'g':
          await this.runGenerate(args.slice(1));
          break;
          
        case 'validate':
        case 'v':
          await this.runValidate(args[1]);
          break;
          
        case 'env':
        case 'e':
          await this.generateEnvOnly(args[1]);
          break;
          
        case 'help':
        case 'h':
        case undefined:
          this.showHelp();
          break;
          
        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  async runInteractiveSetup() {
    console.log('🔧 Starting interactive configuration setup...\n');
    await this.configBuilder.buildInteractiveConfig();
  }

  async runQuickSetup(scenario) {
    console.log(`🚀 Setting up ${scenario} configuration...\n`);
    
    const result = await this.configBuilder.quickSetup(scenario);
    
    console.log('\n📋 Configuration Summary:');
    console.log(`Scenario: ${scenario}`);
    console.log(`Preset: ${result.scenario.description}`);
    console.log(`Config file: ${result.configPath}`);
    console.log(`Environment file: ${result.envPath}`);
  }

  async runGenerate(args) {
    const options = this.parseGenerateArgs(args);
    
    console.log('⚙️ Generating configuration with options:');
    console.log(JSON.stringify(options, null, 2));
    console.log('');
    
    const config = await this.configBuilder.generateConfig(options);
    const configPath = options.output || 'swe-agent-config.yaml';
    const envPath = options.envOutput || '.env.example';
    
    await this.configBuilder.saveConfig(config, configPath);
    
    if (options.generateEnv !== false) {
      await this.configBuilder.saveEnvTemplate(options.preset, envPath);
    }
    
    console.log(`✅ Configuration generated successfully!`);
    console.log(`📄 Config: ${configPath}`);
    if (options.generateEnv !== false) {
      console.log(`🔧 Environment: ${envPath}`);
    }
  }

  parseGenerateArgs(args) {
    const options = {
      preset: 'claude-3-5-sonnet',
      problemType: 'issue_analysis',
      workspacePath: '/tmp/swe-agent-workspace',
      generateEnv: true
    };

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      const value = args[i + 1];

      switch (key) {
        case '--preset':
        case '-p':
          options.preset = value;
          break;
        case '--type':
        case '-t':
          options.problemType = value;
          break;
        case '--workspace':
        case '-w':
          options.workspacePath = value;
          break;
        case '--repository':
        case '-r':
          options.repositoryUrl = value;
          break;
        case '--output':
        case '-o':
          options.output = value;
          break;
        case '--env-output':
        case '-e':
          options.envOutput = value;
          break;
        case '--no-env':
          options.generateEnv = false;
          i--; // No value for this flag
          break;
      }
    }

    return options;
  }

  async runValidate(configPath) {
    if (!configPath) {
      console.error('❌ Please provide a configuration file path');
      return;
    }

    console.log(`🔍 Validating configuration: ${configPath}`);
    
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const yaml = require('js-yaml');
      const config = yaml.load(configContent);
      
      const validation = await this.configBuilder.validateConfig(config);
      
      console.log('\n📊 Validation Results:');
      console.log(`Status: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
      
      if (validation.errors.length > 0) {
        console.log('\n🚫 Errors:');
        validation.errors.forEach(error => console.log(`  • ${error}`));
      }
      
      if (validation.warnings.length > 0) {
        console.log('\n⚠️ Warnings:');
        validation.warnings.forEach(warning => console.log(`  • ${warning}`));
      }
      
      if (validation.environmentVariables.length > 0) {
        console.log('\n🔧 Required Environment Variables:');
        validation.environmentVariables.forEach(varName => {
          const isSet = process.env[varName] ? '✅' : '❌';
          console.log(`  ${isSet} ${varName}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Failed to validate configuration: ${error.message}`);
    }
  }

  async generateEnvOnly(preset = 'claude-3-5-sonnet') {
    console.log(`🔧 Generating environment template for preset: ${preset}`);
    
    const envPath = `.env.${preset}`;
    await this.configBuilder.saveEnvTemplate(preset, envPath);
    
    console.log(`✅ Environment template saved to: ${envPath}`);
    console.log('💡 Copy this file to .env and fill in your API keys');
  }

  showHelp() {
    console.log(`
🤖 SWE-Agent Configuration Setup CLI

USAGE:
  node scripts/setup-config.js <command> [options]

COMMANDS:
  interactive, i          Interactive configuration builder
  quick, q [scenario]     Quick setup for common scenarios
  generate, g [options]   Generate configuration with specific options
  presets, list, p        List available LLM presets
  validate, v <file>      Validate existing configuration file
  env, e [preset]         Generate environment template only
  help, h                 Show this help message

QUICK SETUP SCENARIOS:
  github-integration      Standard GitHub integration (default)
  pr-review              Pull request review setup
  local-development      Local development with local LLM
  enterprise             Enterprise setup with Azure OpenAI

GENERATE OPTIONS:
  --preset, -p <name>         LLM preset to use (default: claude-3-5-sonnet)
  --type, -t <type>           Problem type (default: issue_analysis)
  --workspace, -w <path>      Workspace path (default: /tmp/swe-agent-workspace)
  --repository, -r <url>      Repository URL
  --output, -o <file>         Output config file (default: swe-agent-config.yaml)
  --env-output, -e <file>     Environment file (default: .env.example)
  --no-env                    Don't generate environment template

EXAMPLES:
  # Interactive setup
  node scripts/setup-config.js interactive

  # Quick GitHub integration setup
  node scripts/setup-config.js quick github-integration

  # Generate custom configuration
  node scripts/setup-config.js generate --preset gpt-4 --type pr_review

  # List available presets
  node scripts/setup-config.js presets

  # Validate configuration
  node scripts/setup-config.js validate swe-agent-config.yaml

  # Generate environment template only
  node scripts/setup-config.js env claude-3-5-sonnet

AVAILABLE PRESETS:
  • claude-3-5-sonnet     - Anthropic Claude 3.5 Sonnet (recommended)
  • claude-3-haiku        - Anthropic Claude 3 Haiku (faster, cheaper)
  • gpt-4                 - OpenAI GPT-4
  • gpt-4-turbo           - OpenAI GPT-4 Turbo
  • gpt-3.5-turbo         - OpenAI GPT-3.5 Turbo
  • local-llama           - Local Llama model
  • local-codellama       - Local CodeLlama model
  • azure-gpt-4           - Azure OpenAI GPT-4

PROBLEM TYPES:
  • issue_analysis        - Analyze GitHub issues
  • pr_review             - Review pull requests
  • bug_fix               - Fix bugs in code
  • feature_implementation - Implement new features
  • code_refactoring      - Refactor existing code
  • test_generation       - Generate tests
  • documentation         - Generate documentation
  • general_task          - General purpose
`);
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  const cli = new ConfigSetupCLI();
  cli.run().catch(error => {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = ConfigSetupCLI;