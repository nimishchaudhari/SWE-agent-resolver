/**
 * Result Parser
 * Parse SWE-agent execution outputs and format for GitHub
 */

const logger = require('../utils/logger');

class ResultParser {
  parse(sweAgentResult, metadata = {}) {
    const { executionTime, model, event } = metadata;
    
    if (!sweAgentResult.success) {
      return this.parseFailure(sweAgentResult, metadata);
    }
    
    return this.parseSuccess(sweAgentResult, metadata);
  }

  parseSuccess(result, metadata) {
    const { executionTime, model, event } = metadata;
    
    // Extract key information from SWE-agent output
    const summary = this.extractSummary(result);
    const filesChanged = this.extractFileChanges(result);
    const costEstimate = this.estimateCost(model, result);
    
    return {
      success: true,
      summary: summary,
      filesChanged: filesChanged,
      costEstimate: costEstimate,
      executionTime: executionTime || 0,
      model: model,
      event: event,
      rawOutput: {
        stdout: result.stdout,
        stderr: result.stderr,
        output: result.output
      }
    };
  }

  parseFailure(result, metadata) {
    const { executionTime, model, event } = metadata;
    
    return {
      success: false,
      error: this.extractError(result),
      costEstimate: this.estimateCost(model, result, true),
      executionTime: executionTime || 0,
      model: model,
      event: event,
      rawOutput: {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error
      }
    };
  }

  extractSummary(result) {
    const { stdout, output } = result;
    
    // Try to extract summary from various SWE-agent output formats
    if (output && output['summary.json']) {
      return output['summary.json'].summary || 'Analysis completed successfully.';
    }
    
    // Look for summary in stdout
    const summaryMatch = stdout.match(/SUMMARY:?\s*(.+?)(?:\n\n|\n$|$)/is);
    if (summaryMatch) {
      return summaryMatch[1].trim();
    }
    
    // Look for conclusion
    const conclusionMatch = stdout.match(/CONCLUSION:?\s*(.+?)(?:\n\n|\n$|$)/is);
    if (conclusionMatch) {
      return conclusionMatch[1].trim();
    }
    
    // Look for final thoughts
    const finalMatch = stdout.match(/FINAL:?\s*(.+?)(?:\n\n|\n$|$)/is);
    if (finalMatch) {
      return finalMatch[1].trim();
    }
    
    // Extract key actions from stdout
    const actions = this.extractActions(stdout);
    if (actions.length > 0) {
      return `Completed ${actions.length} actions: ${actions.slice(0, 3).join(', ')}${actions.length > 3 ? '...' : ''}`;
    }
    
    return 'SWE-agent analysis completed successfully.';
  }

  extractFileChanges(result) {
    const { stdout, output } = result;
    const changes = [];
    
    // Try to extract from output files
    if (output && output['changes.json']) {
      return output['changes.json'].files || [];
    }
    
    // Parse file operations from stdout
    const fileOperations = [
      /(?:Created|Added)\s+file:?\s*([^\n]+)/gi,
      /(?:Modified|Updated|Edited)\s+file:?\s*([^\n]+)/gi,
      /(?:Deleted|Removed)\s+file:?\s*([^\n]+)/gi,
      /str_replace_editor\s+(?:create|edit)\s+([^\s]+)/gi
    ];
    
    const actionMap = ['added', 'modified', 'deleted', 'modified'];
    
    fileOperations.forEach((regex, index) => {
      let match;
      while ((match = regex.exec(stdout)) !== null) {
        const filePath = match[1].trim();
        if (filePath && !changes.find(c => c.path === filePath)) {
          changes.push({
            path: filePath,
            action: actionMap[index],
            linesAdded: this.extractLinesChanged(stdout, filePath, 'added'),
            linesRemoved: this.extractLinesChanged(stdout, filePath, 'removed')
          });
        }
      }
    });
    
    return changes;
  }

  extractActions(stdout) {
    const actions = [];
    
    // Common SWE-agent action patterns
    const actionPatterns = [
      /str_replace_editor\s+(\w+)/g,
      /bash\s+command:?\s*([^\n]+)/g,
      /file_viewer\s+(\w+)/g,
      /python_executor\s+(\w+)/g
    ];
    
    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(stdout)) !== null) {
        const action = match[1].trim();
        if (action && !actions.includes(action)) {
          actions.push(action);
        }
      }
    });
    
    return actions.slice(0, 10); // Limit to 10 actions
  }

  extractLinesChanged(stdout, filePath, type) {
    const regex = type === 'added' 
      ? new RegExp(`${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\+(\\d+)`, 'i')
      : new RegExp(`${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?-(\\d+)`, 'i');
    
    const match = stdout.match(regex);
    return match ? parseInt(match[1]) : 0;
  }

  extractError(result) {
    if (result.error) {
      return result.error;
    }
    
    if (result.stderr) {
      // Extract meaningful error from stderr
      const lines = result.stderr.split('\n').filter(line => line.trim());
      
      // Look for common error patterns
      const errorLine = lines.find(line => 
        line.includes('Error:') || 
        line.includes('Exception:') ||
        line.includes('Failed:') ||
        line.includes('timeout')
      );
      
      if (errorLine) {
        return errorLine.trim();
      }
      
      // Return last non-empty line
      return lines[lines.length - 1] || 'Unknown error occurred';
    }
    
    return 'SWE-agent execution failed with unknown error';
  }

  estimateCost(model, result, failed = false) {
    // Rough token estimation based on output length
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    
    // Estimate tokens (rough: 1 token ≈ 4 characters)
    const inputTokens = failed ? 500 : 1000; // Estimated input
    const outputTokens = Math.max(100, (stdout.length + stderr.length) / 4);
    
    // Cost per 1K tokens (input/output)
    const pricing = {
      'gpt-4o-mini': [0.00015, 0.0006],
      'gpt-4o': [0.005, 0.015],
      'gpt-3.5-turbo': [0.0015, 0.002],
      'claude-3-5-sonnet-latest': [0.003, 0.015],
      'claude-3-haiku': [0.00025, 0.00125],
      'deepseek/deepseek-chat': [0.0002, 0.0002],
      'groq/llama2-70b-4096': [0.00007, 0.00008]
    };
    
    const [inputPrice, outputPrice] = pricing[model] || [0.001, 0.002];
    
    const inputCost = (inputTokens / 1000) * inputPrice;
    const outputCost = (outputTokens / 1000) * outputPrice;
    
    return Math.max(0.0001, inputCost + outputCost); // Minimum $0.0001
  }
}

module.exports = ResultParser;