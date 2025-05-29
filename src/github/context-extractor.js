const logger = require('../utils/logger');

class ContextExtractor {
  constructor() {
    this.maxContextSize = 50000; // Max characters for context
    this.maxFileHistory = 10; // Max files to include in context
  }

  async extractProblemContext(parsedWebhook, trigger) {
    try {
      const baseContext = this.extractBaseContext(parsedWebhook);
      const triggerContext = this.extractTriggerContext(trigger);
      const issueContext = await this.extractIssueContext(parsedWebhook);
      const codeContext = this.extractCodeContext(parsedWebhook, trigger);
      
      const context = {
        ...baseContext,
        ...triggerContext,
        ...issueContext,
        ...codeContext,
        timestamp: new Date().toISOString(),
        contextSize: 0
      };
      
      // Calculate and validate context size
      context.contextSize = this.calculateContextSize(context);
      
      if (context.contextSize > this.maxContextSize) {
        logger.warn(`Context size ${context.contextSize} exceeds limit ${this.maxContextSize}, truncating`);
        return this.truncateContext(context);
      }
      
      return context;
    } catch (error) {
      logger.error('Failed to extract problem context:', error);
      throw new Error(`Context extraction failed: ${error.message}`);
    }
  }

  extractBaseContext(parsedWebhook) {
    const { event, action, repository, sender } = parsedWebhook;
    
    return {
      event: {
        type: event,
        action,
        delivery: parsedWebhook.delivery
      },
      repository: {
        name: repository.name,
        fullName: repository.full_name,
        owner: repository.owner?.login,
        private: repository.private,
        defaultBranch: repository.default_branch,
        language: repository.language,
        topics: repository.topics || []
      },
      sender: {
        login: sender?.login,
        type: sender?.type
      }
    };
  }

  extractTriggerContext(trigger) {
    if (!trigger || !trigger.triggered) {
      return { trigger: null };
    }
    
    return {
      trigger: {
        commands: trigger.commands.map(cmd => ({
          type: cmd.type,
          text: cmd.text,
          args: cmd.args
        })),
        primaryCommand: trigger.primaryCommand ? {
          type: trigger.primaryCommand.type,
          text: trigger.primaryCommand.text,
          args: trigger.primaryCommand.args
        } : null,
        context: {
          ...trigger.context,
          codeBlocks: trigger.context.codeBlocks.map(block => ({
            language: block.language,
            code: this.truncateText(block.code, 1000)
          }))
        }
      }
    };
  }

  async extractIssueContext(parsedWebhook) {
    const context = {};
    
    if (parsedWebhook.issue) {
      context.issue = {
        number: parsedWebhook.issue.number,
        title: parsedWebhook.issue.title,
        body: this.truncateText(parsedWebhook.issue.body, 5000),
        state: parsedWebhook.issue.state,
        author: parsedWebhook.issue.author,
        labels: parsedWebhook.issue.labels || [],
        assignees: parsedWebhook.issue.assignees || [],
        isPullRequest: parsedWebhook.issue.isPullRequest || false,
        createdAt: parsedWebhook.issue.createdAt,
        updatedAt: parsedWebhook.issue.updatedAt
      };
    }
    
    if (parsedWebhook.pullRequest) {
      context.pullRequest = {
        number: parsedWebhook.pullRequest.number,
        title: parsedWebhook.pullRequest.title,
        body: this.truncateText(parsedWebhook.pullRequest.body, 5000),
        state: parsedWebhook.pullRequest.state,
        author: parsedWebhook.pullRequest.author,
        draft: parsedWebhook.pullRequest.draft,
        mergeable: parsedWebhook.pullRequest.mergeable,
        head: parsedWebhook.pullRequest.head,
        base: parsedWebhook.pullRequest.base,
        createdAt: parsedWebhook.pullRequest.createdAt,
        updatedAt: parsedWebhook.pullRequest.updatedAt
      };
    }
    
    if (parsedWebhook.comment) {
      context.comment = {
        id: parsedWebhook.comment.id,
        body: this.truncateText(parsedWebhook.comment.body, 2000),
        author: parsedWebhook.comment.author,
        createdAt: parsedWebhook.comment.createdAt,
        // Include line/file info for PR comments
        ...(parsedWebhook.comment.path && {
          file: {
            path: parsedWebhook.comment.path,
            line: parsedWebhook.comment.line,
            position: parsedWebhook.comment.position,
            diffHunk: this.truncateText(parsedWebhook.comment.diffHunk, 500)
          }
        })
      };
    }
    
    return context;
  }

  extractCodeContext(parsedWebhook, trigger) {
    const context = {
      files: {
        mentioned: [],
        modified: [],
        relevant: []
      },
      codeSnippets: [],
      technicalDetails: {}
    };
    
    // Extract mentioned files from trigger
    if (trigger?.context?.fileRefs) {
      context.files.mentioned = trigger.context.fileRefs;
    }
    
    // Extract code blocks from comments/descriptions
    if (trigger?.context?.codeBlocks) {
      context.codeSnippets = trigger.context.codeBlocks.map(block => ({
        language: block.language,
        code: this.truncateText(block.code, 1000),
        source: 'comment'
      }));
    }
    
    // Extract technical context from PR diff info
    if (parsedWebhook.comment?.diffHunk) {
      context.codeSnippets.push({
        language: this.detectLanguageFromPath(parsedWebhook.comment.path),
        code: parsedWebhook.comment.diffHunk,
        source: 'diff',
        file: parsedWebhook.comment.path,
        line: parsedWebhook.comment.line
      });
    }
    
    // Add language detection
    if (parsedWebhook.repository?.language) {
      context.technicalDetails.primaryLanguage = parsedWebhook.repository.language;
    }
    
    // Extract error patterns and stack traces
    context.technicalDetails.errors = this.extractErrorPatterns(
      [
        parsedWebhook.issue?.body,
        parsedWebhook.pullRequest?.body,
        parsedWebhook.comment?.body
      ].filter(Boolean).join('\n')
    );
    
    return context;
  }

  extractErrorPatterns(text) {
    if (!text) return [];
    
    const patterns = [
      // Stack traces
      /at\s+[\w\.$]+\s*\([^)]*\)/g,
      // Error messages
      /Error:\s*[^\n]+/g,
      // Exception types
      /\b\w*Exception:\s*[^\n]+/g,
      // HTTP status codes
      /\b[45]\d{2}\b/g,
      // Common error keywords
      /\b(?:failed|error|exception|crash|bug|issue|problem|broken)\b[^\n]*/gi
    ];
    
    const errors = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        errors.push(...matches.slice(0, 5)); // Limit to 5 per pattern
      }
    }
    
    return errors.slice(0, 10); // Max 10 errors total
  }

  detectLanguageFromPath(path) {
    if (!path) return null;
    
    const extensions = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    
    const ext = path.substring(path.lastIndexOf('.'));
    return extensions[ext] || null;
  }

  extractRelatedIssues(text) {
    if (!text) return [];
    
    const patterns = [
      /#(\d+)/g, // #123
      /issue\s+#?(\d+)/gi, // issue 123, issue #123
      /closes?\s+#?(\d+)/gi, // closes #123
      /fixes?\s+#?(\d+)/gi, // fixes #123
      /resolves?\s+#?(\d+)/gi // resolves #123
    ];
    
    const issues = new Set();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        issues.add(parseInt(match[1]));
      }
      pattern.lastIndex = 0;
    }
    
    return Array.from(issues);
  }

  calculateContextSize(context) {
    return JSON.stringify(context).length;
  }

  truncateContext(context) {
    const truncated = { ...context };
    
    // Truncate in order of priority (least important first)
    const truncationSteps = [
      () => this.truncateCodeSnippets(truncated),
      () => this.truncateDescriptions(truncated),
      () => this.truncateArrays(truncated),
      () => this.truncateStrings(truncated)
    ];
    
    for (const step of truncationSteps) {
      step();
      truncated.contextSize = this.calculateContextSize(truncated);
      
      if (truncated.contextSize <= this.maxContextSize) {
        break;
      }
    }
    
    truncated.truncated = true;
    return truncated;
  }

  truncateCodeSnippets(context) {
    if (context.codeSnippets) {
      context.codeSnippets = context.codeSnippets.slice(0, 3).map(snippet => ({
        ...snippet,
        code: this.truncateText(snippet.code, 500)
      }));
    }
  }

  truncateDescriptions(context) {
    if (context.issue?.body) {
      context.issue.body = this.truncateText(context.issue.body, 2000);
    }
    if (context.pullRequest?.body) {
      context.pullRequest.body = this.truncateText(context.pullRequest.body, 2000);
    }
    if (context.comment?.body) {
      context.comment.body = this.truncateText(context.comment.body, 1000);
    }
  }

  truncateArrays(context) {
    if (context.files?.mentioned) {
      context.files.mentioned = context.files.mentioned.slice(0, 5);
    }
    if (context.technicalDetails?.errors) {
      context.technicalDetails.errors = context.technicalDetails.errors.slice(0, 5);
    }
  }

  truncateStrings(context) {
    const maxStringLength = 500;
    
    const truncateRecursive = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length > maxStringLength) {
          obj[key] = this.truncateText(value, maxStringLength);
        } else if (typeof value === 'object' && value !== null) {
          truncateRecursive(value);
        }
      }
    };
    
    truncateRecursive(context);
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }

  validateContext(context) {
    const required = ['event', 'repository'];
    const missing = required.filter(field => !context[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required context fields: ${missing.join(', ')}`);
    }
    
    if (context.contextSize > this.maxContextSize * 1.5) {
      throw new Error(`Context size ${context.contextSize} too large even after truncation`);
    }
    
    return true;
  }
}

module.exports = ContextExtractor;