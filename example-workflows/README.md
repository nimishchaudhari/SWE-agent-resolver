# Example Workflow Files

This directory contains example GitHub Action workflow files for various AI providers. These workflows demonstrate how to set up the SWE-Agent action with different AI providers.

## Available Examples

- **swe-agent-anthropic.yml** - Configuration for Anthropic Claude models
- **swe-agent-azure.yml** - Configuration for Azure OpenAI services  
- **swe-agent-deepseek.yml** - Configuration for DeepSeek models (cost-effective option)
- **swe-agent-multi-provider.yml** - Configuration supporting multiple AI providers
- **swe-agent-openrouter.yml** - Configuration for OpenRouter (access to 100+ models)

## Usage

To use any of these examples:

1. Copy the desired workflow file to your `.github/workflows/` directory
2. Add the required API keys to your repository secrets
3. Customize the configuration as needed for your use case

## Active Workflow

The repository currently uses:
- **OpenAI workflow** (`.github/workflows/swe-agent-openai.yml`) - Production workflow
- **Claude workflow** (`.github/workflows/claude.yml`) - Claude Code assistant

## API Keys Required

Each provider requires specific API keys in your repository secrets:

- **Anthropic**: `ANTHROPIC_API_KEY`
- **Azure**: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`
- **DeepSeek**: `DEEPSEEK_API_KEY`
- **OpenRouter**: `OPENROUTER_API_KEY`
- **OpenAI**: `OPENAI_API_KEY`

Refer to each workflow file for complete configuration details.