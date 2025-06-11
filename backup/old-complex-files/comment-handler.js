/**
 * GitHub Comment Handler
 * Manages status comments with provider-specific information
 */

class CommentHandler {
  constructor(octokit, providerManager) {
    this.octokit = octokit;
    this.providerManager = providerManager;
    this.statusTemplate = this.getStatusTemplate();
  }

  /**
   * Create initial status comment
   * @param {Object} context - GitHub context
   * @param {string} modelName - Model being used
   * @param {string} status - Current status
   * @returns {Object} Created comment
   */
  async createStatusComment(context, modelName, status) {
    const providerInfo = this.providerManager.detectProvider(modelName);
    const costEstimate = this.providerManager.getCostEstimate(providerInfo.provider, 3000);
    
    const body = this.generateStatusBody({
      modelName,
      providerInfo,
      status,
      costEstimate,
      context
    });

    const commentParams = this.getCommentParams(context, body);
    
    try {
      const response = await this.octokit.rest.issues.createComment(commentParams);
      return response.data;
    } catch (error) {
      console.error('Failed to create status comment:', error);
      throw error;
    }
  }

  /**
   * Update existing status comment
   * @param {number} commentId - Comment ID to update
   * @param {Object} context - GitHub context
   * @param {string} modelName - Model being used
   * @param {string} status - Current status
   * @param {Object} costEstimate - Cost information
   * @param {string} details - Additional details
   */
  async updateStatusComment(commentId, context, modelName, status, costEstimate = null, details = '') {
    const providerInfo = this.providerManager.detectProvider(modelName);
    
    const body = this.generateStatusBody({
      modelName,
      providerInfo,
      status,
      costEstimate,
      context,
      details
    });

    try {
      await this.octokit.rest.issues.updateComment({
        owner: context.repoOwner,
        repo: context.repoName,
        comment_id: commentId,
        body
      });
    } catch (error) {
      console.error('Failed to update status comment:', error);
    }
  }

  /**
   * Create error comment
   * @param {Object} context - GitHub context
   * @param {string} errorMessage - Error message
   */
  async createErrorComment(context, errorMessage) {
    const body = this.generateErrorBody(errorMessage);
    const commentParams = this.getCommentParams(context, body);
    
    try {
      await this.octokit.rest.issues.createComment(commentParams);
    } catch (error) {
      console.error('Failed to create error comment:', error);
    }
  }

  /**
   * Generate status comment body
   */
  generateStatusBody({ modelName, providerInfo, status, costEstimate, context, details = '' }) {
    const statusEmoji = this.getStatusEmoji(status);
    const providerEmoji = this.getProviderEmoji(providerInfo.provider);
    const timestamp = new Date().toISOString();

    let body = `## 🤖 SWE-Agent Status\n\n`;
    
    // Header with provider and model info
    body += `${providerEmoji} **Provider:** ${providerInfo.provider.toUpperCase()}\n`;
    body += `🧠 **Model:** \`${modelName}\`\n`;
    body += `${statusEmoji} **Status:** ${this.getStatusText(status)}\n`;
    body += `🕒 **Updated:** ${new Date(timestamp).toLocaleString()}\n\n`;

    // Context information
    body += `### 📋 Task Information\n`;
    body += `- **Type:** ${this.getTaskTypeDescription(context.type)}\n`;
    if (context.title) {
      body += `- **Title:** ${context.title}\n`;
    }
    if (context.author) {
      body += `- **Requested by:** @${context.author}\n`;
    }
    body += '\n';

    // Progress tracking
    body += this.generateProgressSection(status, details);

    // Cost information
    if (costEstimate) {
      body += this.generateCostSection(costEstimate);
    }

    // Status-specific information
    if (status === 'failed' || status === 'error') {
      body += this.generateErrorSection(details);
    } else if (status === 'success') {
      body += this.generateSuccessSection(details);
    } else if (status === 'executing') {
      body += this.generateExecutingSection(details);
    }

    // Footer
    body += `\n---\n`;
    body += `*Powered by [SWE-Agent Resolver](https://github.com/nimishchaudhari/swe-agent-resolver) • `;
    body += `Provider: ${providerInfo.provider} • `;
    body += `Updated: ${new Date(timestamp).toLocaleTimeString()}*`;

    return body;
  }

  /**
   * Generate progress section
   */
  generateProgressSection(status, details) {
    const steps = [
      { name: 'Initialize', status: 'completed' },
      { name: 'Validate Provider', status: status === 'initializing' ? 'in_progress' : 'completed' },
      { name: 'Generate Config', status: ['executing', 'success', 'failed'].includes(status) ? 'completed' : 'pending' },
      { name: 'Execute SWE-Agent', status: status === 'executing' ? 'in_progress' : (status === 'success' || status === 'failed' ? 'completed' : 'pending') },
      { name: 'Process Results', status: status === 'success' ? 'completed' : (status === 'failed' ? 'failed' : 'pending') }
    ];

    let section = `### 📊 Progress\n\n`;
    
    for (const step of steps) {
      const emoji = this.getStepEmoji(step.status);
      section += `${emoji} ${step.name}\n`;
    }
    
    if (details) {
      section += `\n**Current:** ${details}\n`;
    }
    
    section += '\n';
    return section;
  }

  /**
   * Generate cost section
   */
  generateCostSection(costEstimate) {
    let section = `### 💰 Cost Estimate\n\n`;
    section += `| Metric | Value |\n`;
    section += `|--------|-------|\n`;
    section += `| Input Tokens | ${costEstimate.inputTokens.toLocaleString()} |\n`;
    section += `| Output Tokens | ${costEstimate.outputTokens.toLocaleString()} |\n`;
    section += `| Input Cost | $${costEstimate.inputCost} |\n`;
    section += `| Output Cost | $${costEstimate.outputCost} |\n`;
    section += `| **Total Cost** | **$${costEstimate.totalCost}** |\n\n`;
    return section;
  }

  /**
   * Generate error section
   */
  generateErrorSection(errorDetails) {
    let section = `### ❌ Error Information\n\n`;
    section += `\`\`\`\n${errorDetails}\n\`\`\`\n\n`;
    section += `**Need help?** Check the [troubleshooting guide](https://github.com/nimishchaudhari/swe-agent-resolver#troubleshooting) or [open an issue](https://github.com/nimishchaudhari/swe-agent-resolver/issues/new).\n\n`;
    return section;
  }

  /**
   * Generate success section
   */
  generateSuccessSection(successDetails) {
    let section = `### ✅ Execution Complete\n\n`;
    if (successDetails) {
      section += `${successDetails}\n\n`;
    }
    section += `The AI agent has finished analyzing and providing recommendations. Please review the results above.\n\n`;
    return section;
  }

  /**
   * Generate executing section
   */
  generateExecutingSection(executingDetails) {
    let section = `### ⚡ Currently Executing\n\n`;
    if (executingDetails) {
      section += `${executingDetails}\n\n`;
    }
    section += `The AI agent is currently working on your request. This may take a few minutes...\n\n`;
    return section;
  }

  /**
   * Generate error comment body
   */
  generateErrorBody(errorMessage) {
    return `## ❌ SWE-Agent Error\n\n` +
           `**Error:** ${errorMessage}\n\n` +
           `Please check your configuration and try again. ` +
           `See the [documentation](https://github.com/nimishchaudhari/swe-agent-resolver#configuration) for setup instructions.`;
  }

  /**
   * Get comment parameters based on context type
   */
  getCommentParams(context, body) {
    const baseParams = {
      owner: context.repoOwner,
      repo: context.repoName,
      body
    };

    if (context.type === 'issue' || context.type === 'issue_comment') {
      return {
        ...baseParams,
        issue_number: context.issueNumber
      };
    } else if (context.type === 'pull_request' || context.type === 'pr_review_comment') {
      return {
        ...baseParams,
        issue_number: context.prNumber // PRs use issue_number for comments
      };
    }

    throw new Error(`Unsupported context type: ${context.type}`);
  }

  /**
   * Get status emoji
   */
  getStatusEmoji(status) {
    const emojis = {
      'initializing': '🔄',
      'executing': '⚡',
      'success': '✅',
      'failed': '❌',
      'error': '💥',
      'timeout': '⏰',
      'cancelled': '🚫'
    };
    return emojis[status] || '❓';
  }

  /**
   * Get provider emoji
   */
  getProviderEmoji(provider) {
    const emojis = {
      'openai': '🤖',
      'anthropic': '🧠',
      'azure': '☁️',
      'deepseek': '🌊',
      'openrouter': '🔀',
      'together': '🤝',
      'groq': '⚡',
      'mistral': '🌀',
      'cohere': '🔗',
      'perplexity': '🔍',
      'anyscale': '📈',
      'custom': '🛠️'
    };
    return emojis[provider] || '🤖';
  }

  /**
   * Get step emoji
   */
  getStepEmoji(status) {
    const emojis = {
      'completed': '✅',
      'in_progress': '🔄',
      'pending': '⏳',
      'failed': '❌'
    };
    return emojis[status] || '⏳';
  }

  /**
   * Get status text
   */
  getStatusText(status) {
    const texts = {
      'initializing': 'Initializing',
      'executing': 'Executing',
      'success': 'Completed Successfully',
      'failed': 'Failed',
      'error': 'Error Occurred',
      'timeout': 'Timed Out',
      'cancelled': 'Cancelled'
    };
    return texts[status] || 'Unknown';
  }

  /**
   * Get task type description
   */
  getTaskTypeDescription(type) {
    const descriptions = {
      'issue': 'Issue Analysis',
      'issue_comment': 'Issue Comment Response',
      'pull_request': 'Pull Request Review',
      'pr_review_comment': 'PR Comment Response'
    };
    return descriptions[type] || type;
  }

  /**
   * Get status template
   */
  getStatusTemplate() {
    return {
      header: '## 🤖 SWE-Agent Status',
      sections: {
        provider: 'Provider Information',
        progress: 'Progress Tracking',
        cost: 'Cost Estimate',
        results: 'Results'
      }
    };
  }
}

module.exports = CommentHandler;