/**
 * SWE-Agent Configuration Generator with LiteLLM Integration
 * Generates SWE-agent YAML configurations optimized for GitHub Actions
 */

const yaml = require('js-yaml');

class SWEAgentConfigGenerator {
  constructor() {
    this.problemTypes = {
      'issue_analysis': {
        description: 'Analyze and provide insights for GitHub issues',
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'python_executor'],
        systemPrompt: 'You are an expert software engineer analyzing GitHub issues. Provide thorough analysis, identify root causes, and suggest concrete solutions.'
      },
      'pr_review': {
        description: 'Review pull requests and suggest improvements',
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'git_tool'],
        systemPrompt: 'You are an expert code reviewer. Analyze the changes, identify potential issues, suggest improvements, and ensure code quality.'
      },
      'bug_fix': {
        description: 'Fix bugs in the codebase',
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'python_executor', 'git_tool'],
        systemPrompt: 'You are an expert debugger. Identify the root cause of bugs and implement comprehensive fixes with proper testing.'
      },
      'feature_implementation': {
        description: 'Implement new features',
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'python_executor', 'git_tool'],
        systemPrompt: 'You are an expert software developer. Implement features following best practices, include tests, and ensure proper documentation.'
      },
      'code_refactoring': {
        description: 'Refactor and improve existing code',
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'python_executor'],
        systemPrompt: 'You are an expert in code refactoring. Improve code quality, maintainability, and performance while preserving functionality.'
      },
      'test_generation': {
        description: 'Generate comprehensive tests',
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'python_executor'],
        systemPrompt: 'You are an expert in test-driven development. Create comprehensive, maintainable tests with good coverage.'
      },
      'general_task': {
        description: 'General software engineering task',
        tools: ['str_replace_editor', 'bash', 'file_viewer', 'python_executor', 'git_tool'],
        systemPrompt: 'You are an expert software engineer. Analyze the task and provide high-quality solutions following best practices.'
      }
    };
  }

  /**
   * Generate complete SWE-agent configuration
   * @param {Object} options - Configuration options
   * @returns {string} YAML configuration
   */
  generateConfig(options) {
    const {
      model,
      problem,
      context,
      tools = [],
      customInstructions = '',
      workspace = {}
    } = options;

    const problemConfig = this.problemTypes[problem] || this.problemTypes.general_task;
    const selectedTools = tools.length > 0 ? tools : problemConfig.tools;

    const config = {
      problem_statement: {
        type: problem,
        description: this.generateProblemDescription(context, problemConfig.description),
        context: this.formatContextForSWE(context),
        custom_instructions: customInstructions || null
      },
      agent: {
        model: this.formatModelConfig(model),
        parser: {
          name: 'ToolCallingParser',
          function_calling: true
        },
        history_processor: {
          name: 'DefaultHistoryProcessor',
          window_size: 4000
        },
        tools: this.formatToolsConfig(selectedTools),
        system_prompt: this.generateSystemPrompt(problemConfig.systemPrompt, context, customInstructions)
      },
      env: {
        repo: this.generateRepoConfig(context),
        workspace: this.generateWorkspaceConfig(workspace),
        environment_variables: this.generateEnvironmentVariables(context)
      },
      metadata: {
        generated_by: 'swe-agent-resolver',
        generated_at: new Date().toISOString(),
        problem_type: problem,
        github_context: {
          event: context.type,
          repository: `${context.repoOwner}/${context.repoName}`,
          actor: context.author
        }
      }
    };

    // Remove null values for cleaner YAML
    this.removeNullValues(config);

    return yaml.dump(config, {
      indent: 2,
      defaultFlowStyle: false,
      quotingType: '"',
      forceQuotes: false
    });
  }

  /**
   * Format model configuration for LiteLLM compatibility
   */
  formatModelConfig(modelConfig) {
    return {
      name: modelConfig.model,
      api_base: modelConfig.api_base || undefined,
      api_key: modelConfig.api_key,
      api_version: modelConfig.api_version || undefined,
      azure_deployment: modelConfig.azure_deployment || undefined,
      temperature: modelConfig.temperature || 0.0,
      max_tokens: modelConfig.max_tokens || 4000,
      timeout: modelConfig.timeout || 300
    };
  }

  /**
   * Generate problem description based on context
   */
  generateProblemDescription(context, baseDescription) {
    switch (context.type) {
      case 'issue':
        return `${baseDescription}: "${context.title}"`;
      case 'issue_comment':
        return `Respond to comment on issue: "${context.title}"`;
      case 'pull_request':
        return `${baseDescription}: "${context.title}"`;
      case 'pr_review_comment':
        return `Address review comment on PR: "${context.title}"`;
      default:
        return baseDescription;
    }
  }

  /**
   * Format context information for SWE-agent
   */
  formatContextForSWE(context) {
    const formattedContext = {
      type: context.type,
      title: context.title,
      author: context.author,
      repository: `${context.repoOwner}/${context.repoName}`
    };

    // Add type-specific context
    if (context.body) {
      formattedContext.description = context.body;
    }

    if (context.comment) {
      formattedContext.comment = context.comment;
    }

    if (context.labels) {
      formattedContext.labels = context.labels;
    }

    if (context.diffHunk) {
      formattedContext.diff_hunk = context.diffHunk;
      formattedContext.file_path = context.filePath;
    }

    if (context.baseBranch && context.headBranch) {
      formattedContext.base_branch = context.baseBranch;
      formattedContext.head_branch = context.headBranch;
      formattedContext.changed_files = context.changedFiles;
    }

    return formattedContext;
  }

  /**
   * Format tools configuration
   */
  formatToolsConfig(tools) {
    const toolConfigs = [];

    for (const tool of tools) {
      switch (tool) {
        case 'str_replace_editor':
          toolConfigs.push({ name: 'str_replace_editor' });
          break;
        case 'bash':
          toolConfigs.push({ 
            name: 'bash',
            condition: 'always'
          });
          break;
        case 'file_viewer':
          toolConfigs.push({ name: 'file_viewer' });
          break;
        case 'python_executor':
          toolConfigs.push({ 
            name: 'python_executor',
            condition: 'python'
          });
          break;
        case 'node_executor':
          toolConfigs.push({ 
            name: 'node_executor',
            condition: 'javascript'
          });
          break;
        case 'git_tool':
          toolConfigs.push({ 
            name: 'git_tool',
            condition: 'always'
          });
          break;
        default:
          toolConfigs.push({ name: tool });
      }
    }

    return toolConfigs;
  }

  /**
   * Generate system prompt with context
   */
  generateSystemPrompt(basePrompt, context, customInstructions) {
    let prompt = basePrompt;

    // Add context-specific instructions
    if (context.type === 'issue_comment' || context.type === 'pr_review_comment') {
      prompt += `\n\nUser Comment: "${context.comment}"`;
      prompt += '\n\nRespond specifically to this comment and provide actionable assistance.';
    }

    if (context.type === 'pull_request' && context.changedFiles) {
      prompt += `\n\nThis PR affects ${context.changedFiles} file(s). Focus your review on the changes and their impact.`;
    }

    // Add custom instructions if provided
    if (customInstructions) {
      prompt += `\n\nAdditional Instructions: ${customInstructions}`;
    }

    // Add GitHub Actions specific context
    prompt += '\n\nYou are running in a GitHub Actions environment. Be concise and actionable in your responses.';

    return prompt;
  }

  /**
   * Generate repository configuration
   */
  generateRepoConfig(context) {
    return {
      github_url: `https://github.com/${context.repoOwner}/${context.repoName}`,
      base_commit: '$GITHUB_SHA',
      branch: '$GITHUB_REF_NAME'
    };
  }

  /**
   * Generate workspace configuration
   */
  generateWorkspaceConfig(workspace) {
    return {
      mount_path: workspace.path || '/swe-agent-workspace',
      persistent: false,
      cleanup: true,
      timeout: workspace.timeout || 1800
    };
  }

  /**
   * Generate environment variables
   */
  generateEnvironmentVariables(context) {
    const envVars = {
      LOG_LEVEL: 'INFO',
      GITHUB_ACTIONS: 'true',
      PYTHONPATH: '$PYTHONPATH'
    };

    // Add context-specific variables
    if (context.issueNumber) {
      envVars.GITHUB_ISSUE_NUMBER = context.issueNumber.toString();
    }

    if (context.prNumber) {
      envVars.GITHUB_PR_NUMBER = context.prNumber.toString();
    }

    return envVars;
  }

  /**
   * Remove null and undefined values from object recursively
   */
  removeNullValues(obj) {
    Object.keys(obj).forEach(key => {
      if (obj[key] === null || obj[key] === undefined) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        this.removeNullValues(obj[key]);
      }
    });
  }

  /**
   * Validate generated configuration
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    try {
      const parsed = yaml.load(config);

      // Required sections
      if (!parsed.agent) {
        errors.push('Missing agent configuration');
      }

      if (!parsed.agent?.model) {
        errors.push('Missing model configuration');
      }

      if (!parsed.env) {
        errors.push('Missing environment configuration');
      }

      // Model validation
      if (parsed.agent?.model && !parsed.agent.model.name) {
        errors.push('Missing model name');
      }

      if (parsed.agent?.model && !parsed.agent.model.api_key) {
        errors.push('Missing API key configuration');
      }

      // Tools validation
      if (!parsed.agent?.tools || parsed.agent.tools.length === 0) {
        warnings.push('No tools configured - agent may have limited capabilities');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (yamlError) {
      return {
        valid: false,
        errors: [`Invalid YAML: ${yamlError.message}`],
        warnings: []
      };
    }
  }
}

module.exports = SWEAgentConfigGenerator;