const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs').promises;
const GitHubEnvMapper = require('./github-env-mapper');
const logger = require('../utils/logger');

/**
 * SWE-Agent YAML Configuration Generator
 * Generates dynamic SWE-agent YAML configurations based on GitHub context and environment
 */
class SWEAgentConfigGenerator {
  constructor() {
    this.envMapper = new GitHubEnvMapper();
    this.configCache = new Map();
    
    // SWE-agent configuration schema templates
    this.baseSchema = {
      problem_statement: {},
      agent: {},
      env: {}
    };

    // Model-specific configurations
    this.modelConfigurations = {
      'anthropic': {
        parser_name: 'ToolCallingParser',
        history_processor_name: 'DefaultHistoryProcessor',
        supports_function_calling: true,
        max_context_tokens: 200000,
        recommended_temperature: 0.0
      },
      'openai': {
        parser_name: 'ToolCallingParser', 
        history_processor_name: 'DefaultHistoryProcessor',
        supports_function_calling: true,
        max_context_tokens: 128000,
        recommended_temperature: 0.0
      },
      'local': {
        parser_name: 'ThoughtActionParser',
        history_processor_name: 'DefaultHistoryProcessor', 
        supports_function_calling: false,
        max_context_tokens: 4096,
        recommended_temperature: 0.1
      }
    };

    // Tool configurations based on model capabilities
    this.toolConfigurations = {
      'function_calling': [
        'str_replace_editor',
        'bash',
        'file_viewer'
      ],
      'thought_action': [
        'str_replace_based_edit_tool',
        'bash',
        'file_viewer'
      ]
    };
  }

  /**
   * Generate complete SWE-agent YAML configuration
   * @param {object} githubContext - GitHub Actions context
   * @param {object} problemContext - Problem/issue context
   * @param {object} options - Additional configuration options
   * @returns {Promise<object>} Generated configuration with YAML content
   */
  async generateConfiguration(githubContext, problemContext, options = {}) {
    try {
      // Map environment variables to configuration
      const envMapping = this.envMapper.mapEnvironmentToConfig(githubContext);
      
      if (envMapping.errors.length > 0) {
        logger.error('Environment mapping errors:', envMapping.errors);
        if (!options.allowPartialConfig) {
          throw new Error(`Configuration errors: ${envMapping.errors.join(', ')}`);
        }
      }

      // Generate the three main configuration sections
      const problemStatement = await this.generateProblemStatement(problemContext, envMapping.config);
      const agentConfig = await this.generateAgentConfig(envMapping.config, options);
      const envConfig = await this.generateEnvironmentConfig(githubContext, envMapping.config, options);

      // Combine all sections
      const fullConfig = {
        problem_statement: problemStatement,
        agent: agentConfig,
        env: envConfig,
        metadata: {
          generated_at: new Date().toISOString(),
          generator_version: '1.0.0',
          github_context: this.extractMetadataContext(githubContext),
          environment_mapping: envMapping.metadata,
          warnings: envMapping.warnings
        }
      };

      // Validate the complete configuration
      const validation = await this.validateConfiguration(fullConfig);
      if (!validation.valid) {
        if (options.allowPartialConfig) {
          logger.warn('Configuration validation warnings:', validation.errors);
          fullConfig.metadata.validation_warnings = validation.errors;
        } else {
          throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Generate YAML content
      const yamlContent = this.generateYAMLContent(fullConfig, options);

      return {
        config: fullConfig,
        yaml: yamlContent,
        metadata: envMapping.metadata,
        validation,
        warnings: envMapping.warnings,
        cache_key: this.generateCacheKey(githubContext, problemContext, options)
      };

    } catch (error) {
      logger.error('Configuration generation failed:', error);
      
      if (options.fallbackMode) {
        return this.generateFallbackConfiguration(githubContext, problemContext, error);
      }
      
      throw error;
    }
  }

  /**
   * Generate problem_statement configuration section
   */
  async generateProblemStatement(problemContext, mappedConfig) {
    const config = {
      type: this.determineProblemType(problemContext),
      description: this.generateProblemDescription(problemContext),
      context: {}
    };

    // Add issue-specific context
    if (problemContext.issue) {
      config.context.issue = {
        number: problemContext.issue.number,
        title: problemContext.issue.title,
        body: this.sanitizeForYAML(problemContext.issue.body),
        labels: problemContext.issue.labels || [],
        state: problemContext.issue.state,
        author: problemContext.issue.author,
        created_at: problemContext.issue.createdAt
      };
    }

    // Add pull request context
    if (problemContext.pullRequest) {
      config.context.pull_request = {
        number: problemContext.pullRequest.number,
        title: problemContext.pullRequest.title,
        body: this.sanitizeForYAML(problemContext.pullRequest.body),
        draft: problemContext.pullRequest.draft,
        mergeable: problemContext.pullRequest.mergeable,
        head: {
          ref: problemContext.pullRequest.head?.ref,
          sha: problemContext.pullRequest.head?.sha
        },
        base: {
          ref: problemContext.pullRequest.base?.ref,
          sha: problemContext.pullRequest.base?.sha
        }
      };
    }

    // Add comment trigger context
    if (problemContext.comment) {
      config.context.trigger_comment = {
        id: problemContext.comment.id,
        body: this.sanitizeForYAML(problemContext.comment.body),
        author: problemContext.comment.author,
        created_at: problemContext.comment.createdAt
      };

      // Add file context for PR comments
      if (problemContext.comment.file) {
        config.context.file_context = {
          path: problemContext.comment.file.path,
          line: problemContext.comment.file.line,
          diff_hunk: this.sanitizeForYAML(problemContext.comment.file.diffHunk)
        };
      }
    }

    // Add extracted commands and context
    if (problemContext.trigger) {
      config.context.commands = this.generateCommandContext(problemContext.trigger);
      config.context.files = problemContext.trigger.context?.fileRefs || [];
      config.context.code_blocks = this.generateCodeBlockContext(problemContext.trigger.context);
    }

    // Add repository context
    config.context.repository = {
      name: problemContext.repository?.name,
      language: problemContext.repository?.language,
      topics: problemContext.repository?.topics || []
    };

    return config;
  }

  /**
   * Generate agent configuration section
   */
  async generateAgentConfig(mappedConfig, options) {
    const provider = this.envMapper.detectModelProvider(mappedConfig);
    const modelConfig = this.modelConfigurations[provider] || this.modelConfigurations['anthropic'];
    
    const config = {
      model: {
        name: this.envMapper.getNestedValue(mappedConfig, 'agent.model.name') || 'claude-3-5-sonnet-20241022',
        provider: provider,
        temperature: this.envMapper.getNestedValue(mappedConfig, 'agent.model.temperature') || modelConfig.recommended_temperature,
        max_tokens: this.envMapper.getNestedValue(mappedConfig, 'agent.model.max_tokens') || modelConfig.max_context_tokens,
        timeout: this.envMapper.getNestedValue(mappedConfig, 'agent.model.timeout') || 300000
      },
      parser: {
        name: this.envMapper.getNestedValue(mappedConfig, 'agent.parser.name') || modelConfig.parser_name,
        function_calling: this.envMapper.getNestedValue(mappedConfig, 'agent.parser.function_calling') !== false && modelConfig.supports_function_calling
      },
      history_processor: {
        name: this.envMapper.getNestedValue(mappedConfig, 'agent.history_processor.name') || modelConfig.history_processor_name,
        window_size: this.envMapper.getNestedValue(mappedConfig, 'agent.history_processor.window_size') || 4000,
        compression: this.envMapper.getNestedValue(mappedConfig, 'agent.history_processor.compression') || false
      }
    };

    // Add tool configuration based on parser type
    const toolMode = config.parser.function_calling ? 'function_calling' : 'thought_action';
    config.tools = this.generateToolsConfig(toolMode, mappedConfig, options);

    // Add cost and performance limits
    if (this.envMapper.getNestedValue(mappedConfig, 'performance.cost_limit')) {
      config.cost_limit = parseFloat(this.envMapper.getNestedValue(mappedConfig, 'performance.cost_limit'));
    }

    // Add API key rotation if multiple keys available
    const apiKeys = this.envMapper.apiKeyRotation[provider];
    if (apiKeys && apiKeys.length > 1) {
      config.model.api_key_rotation = {
        enabled: true,
        key_count: apiKeys.length,
        rotation_strategy: 'round_robin'
      };
    }

    return config;
  }

  /**
   * Generate environment configuration section
   */
  async generateEnvironmentConfig(githubContext, mappedConfig, options) {
    const config = {
      repo: {
        github_url: this.buildGitHubURL(githubContext),
        base_commit: githubContext.sha || 'HEAD',
        split_patch: this.envMapper.getNestedValue(mappedConfig, 'env.repo.split_patch') || false
      },
      workspace: {
        mount_path: this.envMapper.getNestedValue(mappedConfig, 'env.workspace.mount_path') || '/tmp/swe-agent-workspace',
        persistent: options.persistentWorkspace || false,
        cleanup: options.cleanupWorkspace !== false
      }
    };

    // Add Docker configuration if enabled
    if (this.envMapper.getNestedValue(mappedConfig, 'deployment.docker.enabled')) {
      config.docker = {
        image: this.envMapper.getNestedValue(mappedConfig, 'deployment.docker.image') || 'sweagent/swe-agent:latest',
        memory_limit: this.envMapper.getNestedValue(mappedConfig, 'performance.memory_limit') || '4GB',
        cpu_limit: this.envMapper.getNestedValue(mappedConfig, 'performance.cpu_limit') || 2,
        network: 'bridge',
        volumes: [
          `${config.workspace.mount_path}:/workspace`
        ]
      };
    }

    // Add Modal configuration if enabled
    if (this.envMapper.getNestedValue(mappedConfig, 'deployment.modal.enabled')) {
      config.modal = {
        environment: this.envMapper.getNestedValue(mappedConfig, 'deployment.modal.environment') || 'dev',
        cpu_count: this.envMapper.getNestedValue(mappedConfig, 'performance.cpu_limit') || 2,
        memory_mb: this.parseMemoryLimit(this.envMapper.getNestedValue(mappedConfig, 'performance.memory_limit') || '4GB'),
        timeout: this.envMapper.getNestedValue(mappedConfig, 'performance.request_timeout') || 3600,
        gpu: options.requireGPU || false
      };
    }

    // Add GitHub-specific environment variables
    config.environment_variables = {
      GITHUB_REPOSITORY: githubContext.repository,
      GITHUB_REF: githubContext.ref,
      GITHUB_SHA: githubContext.sha,
      GITHUB_ACTOR: githubContext.actor,
      GITHUB_WORKSPACE: githubContext.workspace,
      LOG_LEVEL: this.envMapper.getNestedValue(mappedConfig, 'logging.level') || 'INFO'
    };

    // Add secrets (without exposing values)
    config.secrets = {
      github_token: 'GITHUB_TOKEN',
      model_api_key: this.getModelApiKeySecret(mappedConfig)
    };

    return config;
  }

  /**
   * Generate tools configuration based on capabilities
   */
  generateToolsConfig(toolMode, mappedConfig, options) {
    const baseTools = this.toolConfigurations[toolMode] || this.toolConfigurations['function_calling'];
    const config = [];

    for (const tool of baseTools) {
      const toolConfig = { name: tool };

      // Add tool-specific configurations
      switch (tool) {
        case 'str_replace_editor':
        case 'str_replace_based_edit_tool':
          toolConfig.config = {
            max_file_size: '1MB',
            max_lines: 10000,
            backup_files: true
          };
          break;
          
        case 'bash':
          toolConfig.config = {
            enabled: this.envMapper.getNestedValue(mappedConfig, 'tools.bash.enabled') !== false,
            timeout: 30000,
            max_output_size: '1MB',
            restricted_commands: ['rm -rf /', 'format', 'mkfs']
          };
          break;
          
        case 'file_viewer':
          toolConfig.config = {
            max_file_size: '10MB',
            max_lines: 50000,
            encoding: 'utf-8'
          };
          break;
      }

      config.push(toolConfig);
    }

    // Add language-specific tools
    const repoLanguage = this.envMapper.getNestedValue(mappedConfig, 'github.repository_language');
    if (repoLanguage) {
      const languageTools = this.getLanguageSpecificTools(repoLanguage);
      config.push(...languageTools);
    }

    return config;
  }

  /**
   * Get language-specific tools
   */
  getLanguageSpecificTools(language) {
    const languageMap = {
      'Python': [
        { name: 'python_executor', config: { version: '3.11' } },
        { name: 'pytest_runner', config: { auto_discovery: true } }
      ],
      'JavaScript': [
        { name: 'node_executor', config: { version: '18' } },
        { name: 'npm_manager', config: { auto_install: true } }
      ],
      'TypeScript': [
        { name: 'node_executor', config: { version: '18' } },
        { name: 'typescript_compiler', config: { strict: true } }
      ],
      'Java': [
        { name: 'java_compiler', config: { version: '17' } },
        { name: 'maven_manager', config: { auto_download: true } }
      ],
      'Go': [
        { name: 'go_compiler', config: { version: '1.21' } },
        { name: 'go_mod_manager', config: { auto_tidy: true } }
      ]
    };

    return languageMap[language] || [];
  }

  /**
   * Determine problem type from context
   */
  determineProblemType(problemContext) {
    if (problemContext.pullRequest) {
      return 'pull_request_review';
    }
    
    if (problemContext.issue) {
      const labels = problemContext.issue.labels || [];
      if (labels.some(label => label.includes('bug'))) {
        return 'bug_fix';
      }
      if (labels.some(label => label.includes('feature'))) {
        return 'feature_implementation';
      }
      return 'issue_analysis';
    }

    if (problemContext.trigger?.primaryCommand) {
      const cmdType = problemContext.trigger.primaryCommand.type;
      switch (cmdType) {
        case 'fix': return 'bug_fix';
        case 'test': return 'test_generation';
        case 'refactor': return 'code_refactoring';
        case 'review': return 'code_review';
        case 'explain': return 'code_explanation';
        default: return 'general_task';
      }
    }

    return 'general_analysis';
  }

  /**
   * Generate problem description
   */
  generateProblemDescription(problemContext) {
    const parts = [];

    if (problemContext.issue) {
      parts.push(`Issue #${problemContext.issue.number}: ${problemContext.issue.title}`);
    }

    if (problemContext.pullRequest) {
      parts.push(`Pull Request #${problemContext.pullRequest.number}: ${problemContext.pullRequest.title}`);
    }

    if (problemContext.trigger?.primaryCommand) {
      parts.push(`Command: ${problemContext.trigger.primaryCommand.text}`);
    }

    if (problemContext.comment) {
      const preview = problemContext.comment.body.substring(0, 200);
      parts.push(`Triggered by comment: ${preview}${preview.length < problemContext.comment.body.length ? '...' : ''}`);
    }

    return parts.join('\n') || 'General software engineering task';
  }

  /**
   * Generate command context from trigger
   */
  generateCommandContext(trigger) {
    const commands = [];

    if (trigger.primaryCommand) {
      commands.push({
        type: trigger.primaryCommand.type,
        text: trigger.primaryCommand.text,
        priority: 'primary',
        args: trigger.primaryCommand.args || {}
      });
    }

    if (trigger.commands) {
      trigger.commands.forEach(cmd => {
        if (cmd !== trigger.primaryCommand) {
          commands.push({
            type: cmd.type,
            text: cmd.text,
            priority: 'secondary',
            args: cmd.args || {}
          });
        }
      });
    }

    return commands;
  }

  /**
   * Generate code block context
   */
  generateCodeBlockContext(triggerContext) {
    if (!triggerContext?.codeBlocks) return [];

    return triggerContext.codeBlocks.map(block => ({
      language: block.language,
      code: this.sanitizeForYAML(block.code),
      source: block.source || 'comment',
      line_count: (block.code.match(/\n/g) || []).length + 1
    }));
  }

  /**
   * Build GitHub URL from context
   */
  buildGitHubURL(githubContext) {
    const serverUrl = githubContext.server_url || 'https://github.com';
    const repository = githubContext.repository;
    
    if (!repository) {
      throw new Error('Repository not specified in GitHub context');
    }

    return `${serverUrl}/${repository}.git`;
  }

  /**
   * Get model API key secret name
   */
  getModelApiKeySecret(mappedConfig) {
    const provider = this.envMapper.detectModelProvider(mappedConfig);
    const providerInfo = this.envMapper.modelProviders[provider];
    return providerInfo?.api_key_env || 'ANTHROPIC_API_KEY';
  }

  /**
   * Parse memory limit to MB
   */
  parseMemoryLimit(memoryLimit) {
    const match = memoryLimit.match(/^(\d+)(GB|MB)$/);
    if (!match) return 4096; // Default 4GB

    const [, amount, unit] = match;
    return unit === 'GB' ? parseInt(amount) * 1024 : parseInt(amount);
  }

  /**
   * Generate YAML content with proper formatting
   */
  generateYAMLContent(config, options = {}) {
    const yamlOptions = {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
      skipInvalid: true,
      flowLevel: -1,
      ...options.yamlOptions
    };

    try {
      return yaml.dump(config, yamlOptions);
    } catch (error) {
      logger.error('YAML generation failed:', error);
      throw new Error(`YAML generation failed: ${error.message}`);
    }
  }

  /**
   * Validate complete configuration
   */
  async validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    // Validate problem_statement
    if (!config.problem_statement?.type) {
      errors.push('problem_statement.type is required');
    }

    if (!config.problem_statement?.description) {
      errors.push('problem_statement.description is required');
    }

    // Validate agent configuration
    if (!config.agent?.model?.name) {
      errors.push('agent.model.name is required');
    }

    if (!config.agent?.parser?.name) {
      errors.push('agent.parser.name is required');
    }

    // Validate environment configuration
    if (!config.env?.repo?.github_url) {
      errors.push('env.repo.github_url is required');
    }

    if (!config.env?.workspace?.mount_path) {
      errors.push('env.workspace.mount_path is required');
    }

    // Validate model and parser compatibility
    const modelProvider = config.agent.model?.provider;
    const parserName = config.agent.parser?.name;
    const functionCalling = config.agent.parser?.function_calling;

    if (modelProvider === 'local' && functionCalling) {
      warnings.push('Local models may not support function calling, consider using ThoughtActionParser');
    }

    if (parserName === 'ToolCallingParser' && !functionCalling) {
      warnings.push('ToolCallingParser typically requires function_calling enabled');
    }

    // Validate resource limits
    const costLimit = config.agent?.cost_limit;
    if (costLimit && (costLimit < 0 || costLimit > 100)) {
      warnings.push('Cost limit should be between 0 and 100');
    }

    // Validate tools configuration
    if (!config.agent?.tools || config.agent.tools.length === 0) {
      warnings.push('No tools configured, agent may have limited capabilities');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate fallback configuration on error
   */
  generateFallbackConfiguration(githubContext, problemContext, originalError) {
    logger.warn('Generating fallback configuration due to error:', originalError.message);

    const fallbackConfig = {
      problem_statement: {
        type: 'general_task',
        description: 'Software engineering task (fallback configuration)',
        context: {
          repository: { name: githubContext.repository || 'unknown' },
          error: originalError.message
        }
      },
      agent: {
        model: {
          name: 'claude-3-5-sonnet-20241022',
          provider: 'anthropic',
          temperature: 0.0,
          timeout: 300000
        },
        parser: {
          name: 'ToolCallingParser',
          function_calling: true
        },
        history_processor: {
          name: 'DefaultHistoryProcessor',
          window_size: 4000
        },
        tools: [
          { name: 'str_replace_editor' },
          { name: 'bash' },
          { name: 'file_viewer' }
        ]
      },
      env: {
        repo: {
          github_url: this.buildGitHubURL(githubContext) || 'https://github.com/unknown/unknown.git',
          base_commit: 'HEAD'
        },
        workspace: {
          mount_path: '/tmp/swe-agent-workspace'
        },
        environment_variables: {
          LOG_LEVEL: 'INFO'
        },
        secrets: {
          github_token: 'GITHUB_TOKEN',
          model_api_key: 'ANTHROPIC_API_KEY'
        }
      },
      metadata: {
        generated_at: new Date().toISOString(),
        fallback_mode: true,
        original_error: originalError.message
      }
    };

    const yamlContent = this.generateYAMLContent(fallbackConfig);

    return {
      config: fallbackConfig,
      yaml: yamlContent,
      metadata: { fallback: true, error: originalError.message },
      validation: { valid: true, errors: [], warnings: ['Using fallback configuration'] },
      warnings: [`Fallback configuration used: ${originalError.message}`]
    };
  }

  /**
   * Extract metadata context for tracking
   */
  extractMetadataContext(githubContext) {
    return {
      repository: githubContext.repository,
      ref: githubContext.ref,
      sha: githubContext.sha?.substring(0, 8),
      actor: githubContext.actor,
      event_name: githubContext.event_name,
      workflow: githubContext.workflow
    };
  }

  /**
   * Generate cache key for configuration caching
   */
  generateCacheKey(githubContext, problemContext, options) {
    const keyParts = [
      githubContext.repository,
      githubContext.sha?.substring(0, 8),
      problemContext.issue?.number || problemContext.pullRequest?.number || 'no-issue',
      JSON.stringify(options),
      Date.now().toString().substring(0, -3) // 10-second granularity
    ];

    return keyParts.join('-');
  }

  /**
   * Sanitize text for YAML output
   */
  sanitizeForYAML(text) {
    if (!text) return '';
    
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\t/g, '  ') // Convert tabs to spaces
      .substring(0, 10000) // Limit length
      .trim();
  }

  /**
   * Preset: Generate issue analysis configuration
   */
  async generateIssueAnalysisConfig(githubContext, issueContext, options = {}) {
    return this.generateConfiguration(githubContext, {
      issue: issueContext,
      repository: githubContext.repository_info
    }, {
      ...options,
      problemType: 'issue_analysis',
      maxTokens: 8192,
      temperature: 0.0
    });
  }

  /**
   * Preset: Generate PR review configuration  
   */
  async generatePRReviewConfig(githubContext, prContext, options = {}) {
    return this.generateConfiguration(githubContext, {
      pullRequest: prContext,
      repository: githubContext.repository_info
    }, {
      ...options,
      problemType: 'pull_request_review',
      maxTokens: 16384,
      persistentWorkspace: true
    });
  }

  /**
   * Preset: Generate code fix configuration
   */
  async generateCodeFixConfig(githubContext, problemContext, options = {}) {
    return this.generateConfiguration(githubContext, problemContext, {
      ...options,
      problemType: 'bug_fix',
      maxTokens: 12288,
      requireTools: ['str_replace_editor', 'bash', 'file_viewer'],
      cleanupWorkspace: false
    });
  }
}

module.exports = SWEAgentConfigGenerator;