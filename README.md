# SWE-Agent Issue Resolver (TypeScript Edition)

[![TypeScript Build](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/typescript-build.yml/badge.svg)](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/typescript-build.yml)
[![All-in-One Workflow](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/swe-agent-aio.yml/badge.svg)](https://github.com/nimishchaudhari/swe-agent-resolver/actions/workflows/swe-agent-aio.yml) <!-- This will be updated to reflect the new TypeScript action -->

A sophisticated GitHub Action that leverages AI to automatically analyze and resolve software engineering issues. This version is implemented in TypeScript for enhanced reliability, maintainability, and performance, while still orchestrating the powerful Python-based `swe-agent`.

## 🚀 Quick Start

The action is triggered by comments on issues or pull requests.

### Triggering the Action

Mention the agent in any issue or pull request comment with your request:

```
@swe-agent Please fix this bug
@swe-agent Implement this feature
@swe-agent Analyze this performance issue
@swe-agent Can you refactor this module?
```

### Workflow Setup

Ensure you have a workflow file (e.g., `.github/workflows/swe-agent-typescript.yml`) that uses this action:

```yaml
name: SWE-Agent TypeScript Resolver
on:
  issue_comment:
    types: [created, edited]
  pull_request_review_comment:
    types: [created, edited]
  # Potentially add pull_request event for PR description triggers if implemented

jobs:
  resolve_with_swe_agent:
    runs-on: ubuntu-latest # The new Dockerfile is based on Node.js, so this should be fine.
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for SWE-Agent to have full repo history if it's still used directly for git operations

      - name: Run SWE-Agent Resolver (TypeScript)
        uses: ./ # Uses the action in the current repository
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # --- Required API Keys (at least one provider) ---
          # OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          # ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          # DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          # OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }} # If using OpenRouter
          # GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }} # If using Google Gemini

          # --- Core Configuration (TypeScript Action) ---
          MODEL_NAME: 'gpt-4o' # Or your preferred model
          TRIGGER_PHRASE: '@swe-agent'
          # CONFIG_FILE: '.github/swe-agent-config.json' # Default path for TS action config

          # --- SWE-Agent Python Tool Configuration (if invoked by TypeScript) ---
          # These might be passed through or set via the CONFIG_FILE
          # SWE_AGENT_MODEL_NAME: 'gpt-4o' # Model for the Python swe-agent if different
          # SWE_AGENT_ARGS: | # Optional multi-line arguments for the python swe-agent
          #   --some-swe-agent-flag=value
          # SWE_AGENT_SETUP_COMMANDS: | # Optional multi-line setup commands for the python swe-agent
          #   pip install -r requirements-dev.txt

          # --- Behavior Configuration (TypeScript Action) ---
          # LOG_LEVEL: 'INFO' # 'DEBUG', 'INFO', 'WARNING', 'ERROR'
          # MAX_COMMENT_LENGTH: '65536' # Max length for GitHub comments

```

## ✨ Features

*   **TypeScript Implementation**: Modern, maintainable, and type-safe codebase.
*   **Orchestrates Python `swe-agent`**: Leverages the power of the original `swe-agent` for core task resolution. The TypeScript action acts as a wrapper.
*   **Modular Design**: Clear separation of concerns for configuration, GitHub interactions, intent detection, AI API calls, response formatting, and `swe-agent` Python tool execution.
*   **Multi-Provider AI Support**: Easily configurable to use models from OpenAI, Anthropic, DeepSeek, OpenRouter, and Gemini via the TypeScript layer.
*   **Context-Aware Operation**: Adapts behavior based on whether it's triggered from an issue, PR comment, or PR review.
*   **Flexible Intent Handling**:
    *   Generates code patches for "fix," "implement," etc. by invoking `swe-agent`.
    *   Provides analysis for "analyze," "explain," etc. using configured AI models.
    *   Offers opinions/advice for "suggest," "recommend," etc.
*   **Enhanced GitHub Integration**:
    *   Posts detailed comments with results.
    *   Can update existing comments with progress.
    *   Uses reactions for quick status feedback.
*   **Configurable**: Many aspects of its behavior can be tuned via GitHub Action inputs and the `CONFIG_FILE`.

## 🛠️ Development

1.  **Prerequisites**: Node.js (v20+), npm. Docker is required if you plan to build/run the action using the `Dockerfile` locally.
2.  **Install Dependencies**: `npm install`
3.  **Build**: `npm run build` (compiles TypeScript to `dist/index.js`). This is automatically run if you use `npm start`.
4.  **Lint**: `npm run lint`
5.  **Test**: `npm test` (Test framework and scripts to be added/updated)
6.  **Run Locally (Simulated)**: You can simulate the action by setting environment variables and running `npm start` or `node dist/index.js`.

### Project Structure

*   `src/`: Contains the TypeScript source code.
    *   `index.ts`: Main entry point for the action.
    *   `config.ts`: Handles configuration loading and validation.
    *   `github.ts`: Manages interactions with the GitHub API.
    *   `intent.ts`: Detects user intent from comments.
    *   `ai.ts`: Interfaces with various AI model APIs.
    *   `responseFormatter.ts`: Formats AI responses for GitHub.
    *   `sweAgent.ts`: Handles the execution of the Python `swe-agent` tool.
    *   `utils.ts`: Common utility functions.
*   `dist/`: Contains the compiled JavaScript code (after running `npm run build`).
*   `legacy/`: Contains the original shell scripts, Dockerfile, and action.yml for reference.
*   `Dockerfile`: Defines the Docker image for running the TypeScript action.
*   `action.yml`: Defines the metadata for the GitHub Action.
*   `package.json`: Manages project dependencies and scripts.
*   `tsconfig.json`: TypeScript compiler options.

This action is built with a focus on robustness and providing clear, actionable results for software development tasks.

---
Built with ❤️ for the developer community. Making software engineering more efficient, one issue at a time.