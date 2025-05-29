const logger = require('../utils/logger');

class TriggerDetector {
  constructor() {
    // Pre-compiled regex patterns for performance
    this.patterns = {
      mention: /@swe-agent\b/gi,
      commands: {
        analyze: /(?:@swe-agent\s+)?(?:analyze|review|check|examine)\s*/gi,
        fix: /(?:@swe-agent\s+)?(?:fix|resolve|solve)\s*/gi,
        explain: /(?:@swe-agent\s+)?(?:explain|describe|clarify)\s*/gi,
        test: /(?:@swe-agent\s+)?(?:test|verify|validate)\s*/gi,
        refactor: /(?:@swe-agent\s+)?(?:refactor|improve|optimize)\s*/gi,
        help: /(?:@swe-agent\s+)?(?:help|usage|commands)\s*/gi
      }
    };

    // Command priority for multiple matches
    this.commandPriority = ['help', 'fix', 'test', 'analyze', 'refactor', 'explain'];
  }

  detectTrigger(text) {
    if (!text || typeof text !== 'string') {
      return { triggered: false };
    }

    const mentions = this.extractMentions(text);
    if (mentions.length === 0) {
      return { triggered: false };
    }

    const commands = this.extractCommands(text);
    const context = this.extractContext(text);

    return {
      triggered: true,
      mentions,
      commands,
      context,
      primaryCommand: this.getPrimaryCommand(commands),
      text: text.trim()
    };
  }

  extractMentions(text) {
    const matches = [];
    let match;
    
    while ((match = this.patterns.mention.exec(text)) !== null) {
      matches.push({
        mention: match[0],
        index: match.index,
        length: match[0].length
      });
    }
    
    // Reset regex lastIndex for next use
    this.patterns.mention.lastIndex = 0;
    
    return matches;
  }

  extractCommands(text) {
    const commands = [];
    
    for (const [commandType, pattern] of Object.entries(this.patterns.commands)) {
      pattern.lastIndex = 0; // Reset regex state
      
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const commandText = this.extractCommandText(text, match);
        
        commands.push({
          type: commandType,
          match: match[0],
          index: match.index,
          text: commandText,
          args: this.parseCommandArgs(commandText, commandType)
        });
      }
    }
    
    return commands.sort((a, b) => a.index - b.index);
  }

  extractCommandText(text, match) {
    const startIndex = match.index + match[0].length;
    
    // Find end of command (next mention, newline, or end of text)
    const remainingText = text.substring(startIndex);
    const nextMention = remainingText.search(/@swe-agent\b/i);
    const nextNewline = remainingText.indexOf('\n');
    
    let endIndex = remainingText.length;
    if (nextMention !== -1 && (nextNewline === -1 || nextMention < nextNewline)) {
      endIndex = nextMention;
    } else if (nextNewline !== -1) {
      endIndex = nextNewline;
    }
    
    return remainingText.substring(0, endIndex).trim();
  }

  parseCommandArgs(commandText, commandType) {
    const args = {};
    
    switch (commandType) {
      case 'analyze':
      case 'review':
        args.files = this.extractFilePaths(commandText);
        args.depth = this.extractDepth(commandText);
        break;
        
      case 'fix':
        args.files = this.extractFilePaths(commandText);
        args.issue = this.extractIssueReference(commandText);
        break;
        
      case 'test':
        args.files = this.extractFilePaths(commandText);
        args.testType = this.extractTestType(commandText);
        break;
        
      case 'explain':
        args.files = this.extractFilePaths(commandText);
        args.concept = commandText.replace(/files?:\s*\S+/gi, '').trim();
        break;
        
      case 'refactor':
        args.files = this.extractFilePaths(commandText);
        args.pattern = this.extractPattern(commandText);
        break;
        
      case 'help':
        args.topic = commandText.trim();
        break;
    }
    
    return args;
  }

  extractFilePaths(text) {
    const patterns = [
      /(?:files?:\s*)([\w\/\-\.]+(?:\s*,\s*[\w\/\-\.]+)*)/gi,
      /`([^`]+\.[^`]+)`/g,
      /\b([\w\/\-]+\.[\w]+)\b/g
    ];
    
    const files = new Set();
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          // Handle comma-separated files
          match[1].split(',').forEach(file => {
            files.add(file.trim());
          });
        }
      }
      pattern.lastIndex = 0;
    }
    
    return Array.from(files);
  }

  extractDepth(text) {
    const depthMatch = text.match(/(?:depth|level):\s*(\w+)/i);
    if (depthMatch) {
      const depth = depthMatch[1].toLowerCase();
      if (['shallow', 'basic', 'simple'].includes(depth)) return 'shallow';
      if (['deep', 'detailed', 'thorough'].includes(depth)) return 'deep';
    }
    return 'normal';
  }

  extractIssueReference(text) {
    const issueMatch = text.match(/#(\d+)/);
    return issueMatch ? parseInt(issueMatch[1]) : null;
  }

  extractTestType(text) {
    if (/unit/i.test(text)) return 'unit';
    if (/integration/i.test(text)) return 'integration';
    if (/e2e|end.to.end/i.test(text)) return 'e2e';
    return 'all';
  }

  extractPattern(text) {
    const patternMatch = text.match(/pattern:\s*([^\s]+)/i);
    return patternMatch ? patternMatch[1] : null;
  }

  extractContext(text) {
    return {
      codeBlocks: this.extractCodeBlocks(text),
      urls: this.extractUrls(text),
      issueRefs: this.extractIssueReferences(text),
      fileRefs: this.extractFilePaths(text),
      hasQuestions: /\?/.test(text),
      isUrgent: /urgent|asap|immediately|critical/i.test(text),
      language: this.detectLanguage(text)
    };
  }

  extractCodeBlocks(text) {
    const blocks = [];
    const pattern = /```(\w+)?\n?([\s\S]*?)```/g;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      blocks.push({
        language: match[1] || null,
        code: match[2].trim(),
        index: match.index
      });
    }
    
    pattern.lastIndex = 0;
    return blocks;
  }

  extractUrls(text) {
    const pattern = /https?:\/\/[^\s]+/g;
    return text.match(pattern) || [];
  }

  extractIssueReferences(text) {
    const pattern = /#(\d+)/g;
    const refs = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      refs.push(parseInt(match[1]));
    }
    
    pattern.lastIndex = 0;
    return refs;
  }

  detectLanguage(text) {
    const languages = {
      javascript: /\b(?:function|const|let|var|=>|require|import)\b/,
      python: /\b(?:def|import|from|class|if\s+__name__|print)\b/,
      java: /\b(?:public|private|class|interface|import\s+java)\b/,
      go: /\b(?:func|package|import|var|type)\b/,
      rust: /\b(?:fn|let|mut|impl|struct|enum)\b/,
      typescript: /\b(?:interface|type|extends|implements)\b/
    };
    
    for (const [lang, pattern] of Object.entries(languages)) {
      if (pattern.test(text)) {
        return lang;
      }
    }
    
    return null;
  }

  getPrimaryCommand(commands) {
    if (commands.length === 0) return null;
    if (commands.length === 1) return commands[0];
    
    // Return highest priority command
    for (const priority of this.commandPriority) {
      const command = commands.find(c => c.type === priority);
      if (command) return command;
    }
    
    return commands[0];
  }

  shouldProcessEvent(parsedWebhook) {
    const { event, action } = parsedWebhook;
    
    // Define which events/actions should be processed
    const processableEvents = {
      'issue_comment': ['created'],
      'pull_request_review_comment': ['created'],
      'issues': ['opened', 'edited'],
      'pull_request': ['opened', 'edited', 'synchronize']
    };
    
    if (!processableEvents[event]) {
      logger.debug(`Event ${event} not processable`);
      return false;
    }
    
    if (!processableEvents[event].includes(action)) {
      logger.debug(`Action ${action} for event ${event} not processable`);
      return false;
    }
    
    return true;
  }

  analyzeCommentTrigger(comment) {
    const trigger = this.detectTrigger(comment.body);
    
    if (!trigger.triggered) {
      return { shouldProcess: false };
    }
    
    return {
      shouldProcess: true,
      trigger,
      metadata: {
        author: comment.author,
        createdAt: comment.createdAt,
        commentId: comment.id
      }
    };
  }
}

module.exports = TriggerDetector;