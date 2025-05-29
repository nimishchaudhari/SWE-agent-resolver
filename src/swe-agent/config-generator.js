const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class ConfigGenerator {
  constructor() {
    this.templateCache = new Map();
    this.defaultTemplates = {
      issue_analysis: 'issue-analysis.yaml',
      pr_review: 'pr-review.yaml',
      code_fix: 'code-fix.yaml',
      test_generation: 'test-generation.yaml',
      refactor: 'refactor.yaml',
      explain: 'explain.yaml',
      generic: 'generic.yaml'
    };
  }

  async generateConfig(context, options = {}) {
    const configType = this.determineConfigType(context, options);
    const template = await this.getTemplate(configType);
    
    const config = {
      ...template,
      ...this.generateBaseConfig(context),
      ...this.generateTaskConfig(context, options),
      ...this.generateEnvironmentConfig(context),
      ...this.generateResourceLimits(options)
    };

    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    return config;
  }

  determineConfigType(context, options) {
    if (options.configType) return options.configType;
    
    const { trigger, event } = context;
    
    if (trigger?.primaryCommand) {
      const commandType = trigger.primaryCommand.type;
      
      switch (commandType) {
        case 'fix':
          return 'code_fix';
        case 'test':
          return 'test_generation';
        case 'refactor':
          return 'refactor';
        case 'explain':
          return 'explain';
        case 'analyze':
        case 'review':
          return event?.type === 'pull_request' ? 'pr_review' : 'issue_analysis';
        default:
          return 'generic';
      }
    }
    
    if (event?.type === 'pull_request') return 'pr_review';
    if (event?.type === 'issues') return 'issue_analysis';
    
    return 'generic';
  }

  generateBaseConfig(context) {
    const { repository, event } = context;
    
    return {
      version: '1.0',
      metadata: {
        generated_at: new Date().toISOString(),
        repository: repository?.fullName,
        event_type: event?.type,
        action: event?.action,
        context_id: this.generateContextId(context)
      },
      repository: {
        name: repository?.name,
        owner: repository?.owner,
        clone_url: repository?.cloneUrl,
        default_branch: repository?.defaultBranch || 'main',
        language: repository?.language,
        private: repository?.private || false
      }
    };
  }

  generateTaskConfig(context, options) {
    const { issue, pullRequest, comment, trigger } = context;
    const config = { task: {} };
    
    if (issue) {
      config.task.type = 'issue_analysis';
      config.task.target = {
        type: 'issue',
        number: issue.number,
        title: issue.title,
        body: this.sanitizeText(issue.body),
        labels: issue.labels || [],
        state: issue.state
      };
    }
    
    if (pullRequest) {
      config.task.type = 'pr_review';
      config.task.target = {
        type: 'pull_request',
        number: pullRequest.number,
        title: pullRequest.title,
        body: this.sanitizeText(pullRequest.body),
        head_sha: pullRequest.head?.sha,
        base_sha: pullRequest.base?.sha,
        head_ref: pullRequest.head?.ref,
        base_ref: pullRequest.base?.ref,
        mergeable: pullRequest.mergeable,
        draft: pullRequest.draft
      };
    }
    
    if (comment) {
      config.task.trigger = {
        type: 'comment',
        comment_id: comment.id,
        body: this.sanitizeText(comment.body),
        author: comment.author,
        created_at: comment.createdAt
      };
      
      if (comment.file) {
        config.task.trigger.file_context = {
          path: comment.file.path,
          line: comment.file.line,
          position: comment.file.position,
          diff_hunk: comment.file.diffHunk
        };
      }
    }
    
    if (trigger) {
      config.task.commands = this.generateCommandConfig(trigger);
      config.task.context = this.generateContextConfig(trigger.context);
    }
    
    config.task.options = {
      timeout: options.timeout || 300000,
      max_iterations: options.maxIterations || 50,
      temperature: options.temperature || 0.0,
      model: options.model || 'claude-3-sonnet',
      output_format: 'json'
    };
    
    return config;
  }

  generateCommandConfig(trigger) {
    const commands = [];
    
    if (trigger.primaryCommand) {
      const cmd = trigger.primaryCommand;
      commands.push({
        type: cmd.type,
        text: cmd.text,
        priority: 'primary',
        args: cmd.args
      });
    }
    
    trigger.commands?.forEach(cmd => {
      if (cmd !== trigger.primaryCommand) {
        commands.push({
          type: cmd.type,
          text: cmd.text,
          priority: 'secondary',
          args: cmd.args
        });
      }
    });
    
    return commands;
  }

  generateContextConfig(triggerContext) {
    if (!triggerContext) return {};
    
    return {
      files: {
        mentioned: triggerContext.fileRefs || [],
        focus: triggerContext.fileRefs?.slice(0, 5) || []
      },
      code_blocks: triggerContext.codeBlocks?.map(block => ({
        language: block.language,
        code: block.code,
        source: block.source || 'comment'
      })) || [],
      urls: triggerContext.urls || [],
      issue_refs: triggerContext.issueRefs || [],
      language: triggerContext.language,
      urgent: triggerContext.isUrgent || false,
      has_questions: triggerContext.hasQuestions || false
    };
  }

  generateEnvironmentConfig(context) {
    const { repository, technicalDetails } = context;
    
    return {
      environment: {
        working_dir: '/tmp/swe-agent-workspace',
        python_version: '3.11',
        node_version: '18',
        language: repository?.language || technicalDetails?.primaryLanguage,
        tools: this.generateToolsConfig(context),
        limits: {
          max_file_size: '10MB',
          max_files: 1000,
          max_output_size: '5MB'
        }
      }
    };
  }

  generateToolsConfig(context) {
    const { trigger, repository } = context;
    const tools = ['file_reader', 'file_writer', 'bash', 'grep', 'find'];
    
    // Add language-specific tools
    const language = repository?.language?.toLowerCase();
    if (language === 'python') {
      tools.push('python', 'pytest', 'pip');
    } else if (language === 'javascript' || language === 'typescript') {
      tools.push('node', 'npm', 'jest');
    } else if (language === 'java') {
      tools.push('javac', 'maven', 'gradle');
    } else if (language === 'go') {
      tools.push('go', 'gofmt');
    }
    
    // Add tools based on trigger commands
    if (trigger?.primaryCommand?.type === 'test') {
      tools.push('test_runner', 'coverage');
    } else if (trigger?.primaryCommand?.type === 'fix') {
      tools.push('linter', 'formatter');
    }
    
    return tools;
  }

  generateResourceLimits(options) {
    return {
      resources: {
        memory_limit: options.memoryLimit || '2GB',
        cpu_limit: options.cpuLimit || 2,
        timeout: options.timeout || 300000,
        max_processes: options.maxProcesses || 10,
        disk_limit: options.diskLimit || '1GB'
      }
    };
  }

  async getTemplate(configType) {
    if (this.templateCache.has(configType)) {
      return this.templateCache.get(configType);
    }
    
    const templatePath = this.defaultTemplates[configType] || this.defaultTemplates.generic;
    const template = await this.loadTemplate(templatePath);
    
    this.templateCache.set(configType, template);
    return template;
  }

  async loadTemplate(templateName) {
    try {
      const templatePath = path.join(__dirname, 'templates', templateName);
      const exists = await fs.access(templatePath).then(() => true).catch(() => false);
      
      if (exists) {
        const content = await fs.readFile(templatePath, 'utf-8');
        return yaml.load(content);
      } else {
        logger.warn(`Template ${templateName} not found, using default`);
        return this.getDefaultTemplate();
      }
    } catch (error) {
      logger.error(`Failed to load template ${templateName}:`, error);
      return this.getDefaultTemplate();
    }
  }

  getDefaultTemplate() {
    return {
      agent: {
        name: 'swe-agent',
        version: '0.4.0',
        model: 'claude-3-sonnet'
      },
      commands: [
        {
          name: 'analyze',
          description: 'Analyze the codebase and provide insights'
        }
      ],
      prompts: {
        system: 'You are a helpful software engineering assistant.',
        task: 'Analyze the given code and provide helpful suggestions.'
      }
    };
  }

  validateConfig(config) {
    const errors = [];
    
    // Required fields validation
    if (!config.metadata) errors.push('metadata is required');
    if (!config.repository) errors.push('repository is required');
    if (!config.task) errors.push('task is required');
    
    // Repository validation
    if (config.repository && !config.repository.clone_url) {
      errors.push('repository.clone_url is required');
    }
    
    // Task validation
    if (config.task) {
      if (!config.task.type) errors.push('task.type is required');
      if (!config.task.options) errors.push('task.options is required');
    }
    
    // Resource limits validation
    if (config.resources) {
      if (config.resources.timeout && config.resources.timeout > 3600000) {
        errors.push('timeout cannot exceed 1 hour');
      }
      if (config.resources.memory_limit) {
        const memoryMatch = config.resources.memory_limit.match(/^(\d+)(GB|MB)$/);
        if (!memoryMatch) {
          errors.push('invalid memory_limit format');
        } else {
          const [, amount, unit] = memoryMatch;
          const memoryMB = unit === 'GB' ? parseInt(amount) * 1024 : parseInt(amount);
          if (memoryMB > 8192) { // 8GB limit
            errors.push('memory_limit cannot exceed 8GB');
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async writeConfig(config, filePath) {
    try {
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: 80,
        quotingType: '"',
        forceQuotes: false
      });
      
      await fs.writeFile(filePath, yamlContent, 'utf-8');
      logger.debug(`Configuration written to ${filePath}`);
      
      return filePath;
    } catch (error) {
      logger.error(`Failed to write config to ${filePath}:`, error);
      throw error;
    }
  }

  sanitizeText(text) {
    if (!text) return '';
    
    // Remove potential YAML-breaking characters and limit length
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .substring(0, 10000) // Limit length
      .replace(/'/g, "''"); // Escape single quotes for YAML
  }

  generateContextId(context) {
    const parts = [
      context.repository?.fullName,
      context.event?.type,
      context.issue?.number || context.pullRequest?.number,
      context.comment?.id
    ].filter(Boolean);
    
    return parts.join('-') + '-' + Date.now();
  }

  // Preset configurations for common scenarios
  async generateIssueAnalysisConfig(context, options = {}) {
    return this.generateConfig(context, {
      ...options,
      configType: 'issue_analysis',
      maxIterations: 30,
      timeout: 600000 // 10 minutes
    });
  }

  async generatePRReviewConfig(context, options = {}) {
    return this.generateConfig(context, {
      ...options,
      configType: 'pr_review',
      maxIterations: 40,
      timeout: 900000 // 15 minutes
    });
  }

  async generateCodeFixConfig(context, options = {}) {
    return this.generateConfig(context, {
      ...options,
      configType: 'code_fix',
      maxIterations: 50,
      timeout: 1200000 // 20 minutes
    });
  }

  clearCache() {
    this.templateCache.clear();
    logger.debug('Template cache cleared');
  }
}

module.exports = ConfigGenerator;