const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class OutputParser {
  constructor() {
    this.parsers = new Map();
    this.registerDefaultParsers();
  }

  registerDefaultParsers() {
    this.parsers.set('json', this.parseJsonOutput.bind(this));
    this.parsers.set('structured', this.parseStructuredOutput.bind(this));
    this.parsers.set('markdown', this.parseMarkdownOutput.bind(this));
    this.parsers.set('diff', this.parseDiffOutput.bind(this));
    this.parsers.set('log', this.parseLogOutput.bind(this));
    this.parsers.set('raw', this.parseRawOutput.bind(this));
  }

  async parseProcessOutput(processResult, outputDir, options = {}) {
    const startTime = Date.now();
    
    try {
      const outputs = await this.collectOutputFiles(outputDir);
      const parsedOutputs = await this.parseMultipleOutputs(outputs, options);
      
      const consolidatedResult = this.consolidateResults(
        processResult,
        parsedOutputs,
        options
      );
      
      const parseTime = Date.now() - startTime;
      logger.debug(`Output parsing completed in ${parseTime}ms`);
      
      return {
        ...consolidatedResult,
        metadata: {
          parseTime,
          outputFiles: outputs.map(o => o.name),
          parsedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('Output parsing failed:', error);
      return this.createErrorResult(processResult, error);
    }
  }

  async collectOutputFiles(outputDir) {
    const outputs = [];
    
    try {
      const files = await fs.readdir(outputDir);
      
      for (const file of files) {
        const filePath = path.join(outputDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && this.isOutputFile(file)) {
          const content = await this.readOutputFile(filePath, stats.size);
          
          outputs.push({
            name: file,
            path: filePath,
            content,
            size: stats.size,
            modified: stats.mtime,
            type: this.detectOutputType(file, content)
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to collect output files from ${outputDir}:`, error);
    }
    
    return outputs.sort((a, b) => this.getFilePriority(a.name) - this.getFilePriority(b.name));
  }

  isOutputFile(filename) {
    const outputPatterns = [
      /^output\.(json|yaml|yml|md|txt|log)$/,
      /^result\.(json|yaml|yml|md|txt)$/,
      /^summary\.(md|txt)$/,
      /^analysis\.(json|md)$/,
      /^changes\.(diff|patch)$/,
      /^log\.(txt|log)$/,
      /^trace\.(json|txt)$/,
      /^metrics\.(json|yaml)$/
    ];
    
    return outputPatterns.some(pattern => pattern.test(filename));
  }

  getFilePriority(filename) {
    const priorities = {
      'output.json': 1,
      'result.json': 2,
      'analysis.json': 3,
      'summary.md': 4,
      'changes.diff': 5,
      'log.txt': 6,
      'trace.json': 7
    };
    
    return priorities[filename] || 10;
  }

  async readOutputFile(filePath, fileSize) {
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    
    if (fileSize > maxSize) {
      logger.warn(`Output file ${filePath} is too large (${fileSize} bytes), truncating`);
      
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(maxSize);
      await fd.read(buffer, 0, maxSize, 0);
      await fd.close();
      
      return buffer.toString('utf-8') + '\n\n[... truncated ...]';
    }
    
    return fs.readFile(filePath, 'utf-8');
  }

  detectOutputType(filename, content) {
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.md')) return 'markdown';
    if (filename.endsWith('.diff') || filename.endsWith('.patch')) return 'diff';
    if (filename.includes('log')) return 'log';
    
    // Content-based detection
    if (this.looksLikeJson(content)) return 'json';
    if (this.looksLikeStructured(content)) return 'structured';
    if (this.looksLikeMarkdown(content)) return 'markdown';
    if (this.looksLikeDiff(content)) return 'diff';
    
    return 'raw';
  }

  looksLikeJson(content) {
    try {
      JSON.parse(content.trim());
      return true;
    } catch {
      return false;
    }
  }

  looksLikeStructured(content) {
    const structuredPatterns = [
      /^##\s+/m, // Headers
      /^\s*[-*+]\s+/m, // Lists
      /^[A-Z][^:]*:\s*/m, // Key-value pairs
      /^---\s*$/m // Separators
    ];
    
    return structuredPatterns.some(pattern => pattern.test(content));
  }

  looksLikeMarkdown(content) {
    const markdownPatterns = [
      /^#{1,6}\s+/m, // Headers
      /\*\*[^*]+\*\*/m, // Bold
      /\*[^*]+\*/m, // Italic
      /```[\s\S]*?```/m, // Code blocks
      /`[^`]+`/m // Inline code
    ];
    
    return markdownPatterns.some(pattern => pattern.test(content));
  }

  looksLikeDiff(content) {
    const diffPatterns = [
      /^diff --git/m,
      /^@@\s+-\d+,\d+\s+\+\d+,\d+\s+@@/m,
      /^[+-][^+-]/m,
      /^index\s+[a-f0-9]+\.\.[a-f0-9]+/m
    ];
    
    return diffPatterns.some(pattern => pattern.test(content));
  }

  async parseMultipleOutputs(outputs, options) {
    const parsed = {};
    
    for (const output of outputs) {
      try {
        const parser = this.parsers.get(output.type);
        if (parser) {
          parsed[output.name] = await parser(output.content, output, options);
        } else {
          parsed[output.name] = { raw: output.content, type: output.type };
        }
      } catch (error) {
        logger.warn(`Failed to parse ${output.name}:`, error);
        parsed[output.name] = { 
          error: error.message, 
          raw: output.content,
          type: output.type 
        };
      }
    }
    
    return parsed;
  }

  async parseJsonOutput(content, file, options) {
    const parsed = JSON.parse(content);
    
    return {
      type: 'json',
      data: parsed,
      summary: this.extractJsonSummary(parsed),
      metrics: this.extractJsonMetrics(parsed),
      valid: true
    };
  }

  async parseStructuredOutput(content, file, options) {
    const sections = this.parseIntoSections(content);
    
    return {
      type: 'structured',
      sections,
      summary: this.extractStructuredSummary(sections),
      keyPoints: this.extractKeyPoints(sections)
    };
  }

  async parseMarkdownOutput(content, file, options) {
    const sections = this.parseMarkdownSections(content);
    const codeBlocks = this.extractCodeBlocks(content);
    
    return {
      type: 'markdown',
      sections,
      codeBlocks,
      summary: this.extractMarkdownSummary(sections),
      actionItems: this.extractActionItems(content)
    };
  }

  async parseDiffOutput(content, file, options) {
    const changes = this.parseDiffChanges(content);
    
    return {
      type: 'diff',
      changes,
      files: this.extractChangedFiles(changes),
      stats: this.calculateDiffStats(changes),
      summary: this.createDiffSummary(changes)
    };
  }

  async parseLogOutput(content, file, options) {
    const entries = this.parseLogEntries(content);
    
    return {
      type: 'log',
      entries,
      errors: entries.filter(e => e.level === 'ERROR'),
      warnings: entries.filter(e => e.level === 'WARN'),
      summary: this.createLogSummary(entries)
    };
  }

  async parseRawOutput(content, file, options) {
    return {
      type: 'raw',
      content,
      length: content.length,
      lines: content.split('\n').length,
      summary: this.createRawSummary(content)
    };
  }

  parseIntoSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
      if (line.match(/^##\s+(.+)/) || line.match(/^([A-Z][^:]*):?\s*$/)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        
        currentSection = {
          title: line.replace(/^##\s+/, '').replace(/:?\s*$/, ''),
          content: [],
          type: 'section'
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections.map(section => ({
      ...section,
      content: section.content.join('\n').trim()
    }));
  }

  parseMarkdownSections(content) {
    const sections = [];
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    let lastIndex = 0;
    let match;
    
    while ((match = headerRegex.exec(content)) !== null) {
      if (lastIndex > 0) {
        const sectionContent = content.slice(lastIndex, match.index).trim();
        sections[sections.length - 1].content = sectionContent;
      }
      
      sections.push({
        level: match[1].length,
        title: match[2],
        content: '',
        index: match.index
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    if (sections.length > 0) {
      sections[sections.length - 1].content = content.slice(lastIndex).trim();
    }
    
    return sections;
  }

  extractCodeBlocks(content) {
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    const blocks = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        index: match.index
      });
    }
    
    return blocks;
  }

  parseDiffChanges(content) {
    const files = [];
    const fileRegex = /^diff --git a\/(.+) b\/(.+)$/gm;
    const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/gm;
    
    let fileMatch;
    while ((fileMatch = fileRegex.exec(content)) !== null) {
      const file = {
        oldPath: fileMatch[1],
        newPath: fileMatch[2],
        hunks: [],
        additions: 0,
        deletions: 0
      };
      
      // Find hunks for this file
      const fileContent = content.slice(fileMatch.index);
      const nextFileIndex = fileContent.search(/^diff --git/m);
      const fileEnd = nextFileIndex > 0 ? nextFileIndex : fileContent.length;
      const fileDiff = fileContent.slice(0, fileEnd);
      
      let hunkMatch;
      while ((hunkMatch = hunkRegex.exec(fileDiff)) !== null) {
        const hunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldCount: parseInt(hunkMatch[2]) || 1,
          newStart: parseInt(hunkMatch[3]),
          newCount: parseInt(hunkMatch[4]) || 1,
          context: hunkMatch[5] || '',
          changes: []
        };
        
        file.hunks.push(hunk);
      }
      
      // Count additions and deletions
      const lines = fileDiff.split('\n');
      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          file.additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          file.deletions++;
        }
      }
      
      files.push(file);
    }
    
    return files;
  }

  parseLogEntries(content) {
    const entries = [];
    const logRegex = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+)$/gm;
    
    let match;
    while ((match = logRegex.exec(content)) !== null) {
      entries.push({
        timestamp: new Date(match[1]),
        level: match[2],
        message: match[3]
      });
    }
    
    return entries;
  }

  consolidateResults(processResult, parsedOutputs, options) {
    const primary = this.findPrimaryOutput(parsedOutputs);
    const metadata = this.extractConsolidatedMetadata(parsedOutputs);
    
    return {
      success: processResult.exitCode === 0,
      exitCode: processResult.exitCode,
      duration: processResult.duration,
      primary: primary || { type: 'raw', content: processResult.stdout },
      outputs: parsedOutputs,
      metadata,
      summary: this.createConsolidatedSummary(parsedOutputs, processResult),
      artifacts: this.extractArtifacts(parsedOutputs)
    };
  }

  findPrimaryOutput(parsedOutputs) {
    const priorities = ['output.json', 'result.json', 'analysis.json', 'summary.md'];
    
    for (const filename of priorities) {
      if (parsedOutputs[filename]) {
        return parsedOutputs[filename];
      }
    }
    
    // Return first structured output
    const structured = Object.values(parsedOutputs).find(
      output => ['json', 'structured', 'markdown'].includes(output.type)
    );
    
    return structured || Object.values(parsedOutputs)[0];
  }

  extractConsolidatedMetadata(parsedOutputs) {
    const metadata = {
      outputFiles: Object.keys(parsedOutputs),
      totalSize: 0,
      types: new Set(),
      hasErrors: false
    };
    
    for (const [filename, output] of Object.entries(parsedOutputs)) {
      if (output.error) metadata.hasErrors = true;
      metadata.types.add(output.type);
      
      if (output.content) {
        metadata.totalSize += output.content.length || 0;
      }
    }
    
    metadata.types = Array.from(metadata.types);
    return metadata;
  }

  createConsolidatedSummary(parsedOutputs, processResult) {
    const summaries = [];
    
    for (const [filename, output] of Object.entries(parsedOutputs)) {
      if (output.summary) {
        summaries.push(`${filename}: ${output.summary}`);
      }
    }
    
    return {
      processSuccess: processResult.exitCode === 0,
      duration: `${processResult.duration}ms`,
      outputCount: Object.keys(parsedOutputs).length,
      summaries: summaries.slice(0, 5) // Limit to top 5
    };
  }

  extractArtifacts(parsedOutputs) {
    const artifacts = [];
    
    for (const [filename, output] of Object.entries(parsedOutputs)) {
      if (output.type === 'diff' && output.files) {
        artifacts.push({
          type: 'code_changes',
          filename,
          files: output.files,
          stats: output.stats
        });
      } else if (output.codeBlocks && output.codeBlocks.length > 0) {
        artifacts.push({
          type: 'code_snippets',
          filename,
          blocks: output.codeBlocks
        });
      } else if (output.type === 'json' && output.data) {
        artifacts.push({
          type: 'structured_data',
          filename,
          data: output.data
        });
      }
    }
    
    return artifacts;
  }

  createErrorResult(processResult, error) {
    return {
      success: false,
      error: error.message,
      exitCode: processResult.exitCode || -1,
      duration: processResult.duration || 0,
      stdout: processResult.stdout || '',
      stderr: processResult.stderr || '',
      metadata: {
        parseError: true,
        parsedAt: new Date().toISOString()
      }
    };
  }

  // Utility methods for extracting summaries and metrics
  extractJsonSummary(data) {
    if (data.summary) return data.summary;
    if (data.result) return `Result: ${JSON.stringify(data.result).slice(0, 100)}...`;
    if (data.message) return data.message;
    return `JSON data with ${Object.keys(data).length} fields`;
  }

  extractJsonMetrics(data) {
    const metrics = {};
    
    if (data.metrics) metrics.agent = data.metrics;
    if (data.duration) metrics.duration = data.duration;
    if (data.steps) metrics.steps = data.steps.length;
    if (data.files_modified) metrics.filesModified = data.files_modified.length;
    
    return metrics;
  }

  extractStructuredSummary(sections) {
    const summary = sections.find(s => 
      s.title.toLowerCase().includes('summary') || 
      s.title.toLowerCase().includes('conclusion')
    );
    
    return summary ? summary.content.slice(0, 200) + '...' : 
           `${sections.length} sections found`;
  }

  extractKeyPoints(sections) {
    const points = [];
    
    for (const section of sections) {
      const lines = section.content.split('\n');
      const bulletPoints = lines.filter(line => 
        line.match(/^\s*[-*+]\s+/) || line.match(/^\d+\.\s+/)
      );
      
      points.push(...bulletPoints.slice(0, 3));
    }
    
    return points.slice(0, 10);
  }

  extractActionItems(content) {
    const actionPatterns = [
      /(?:TODO|FIXME|HACK):\s*(.+)/gi,
      /Action:\s*(.+)/gi,
      /Next steps?:\s*(.+)/gi,
      /Recommendation:\s*(.+)/gi
    ];
    
    const items = [];
    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        items.push(match[1].trim());
      }
    }
    
    return items.slice(0, 10);
  }

  extractChangedFiles(changes) {
    return changes.map(change => ({
      path: change.newPath,
      additions: change.additions,
      deletions: change.deletions,
      type: this.determineChangeType(change)
    }));
  }

  determineChangeType(change) {
    if (change.oldPath === '/dev/null') return 'added';
    if (change.newPath === '/dev/null') return 'deleted';
    if (change.oldPath !== change.newPath) return 'renamed';
    return 'modified';
  }

  calculateDiffStats(changes) {
    return changes.reduce((stats, change) => ({
      files: stats.files + 1,
      additions: stats.additions + change.additions,
      deletions: stats.deletions + change.deletions
    }), { files: 0, additions: 0, deletions: 0 });
  }

  createDiffSummary(changes) {
    const stats = this.calculateDiffStats(changes);
    return `${stats.files} files changed, ${stats.additions} insertions(+), ${stats.deletions} deletions(-)`;
  }

  createLogSummary(entries) {
    const levels = entries.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1;
      return acc;
    }, {});
    
    return `${entries.length} log entries: ${Object.entries(levels)
      .map(([level, count]) => `${count} ${level}`)
      .join(', ')}`;
  }

  createRawSummary(content) {
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).length;
    return `${lines} lines, ${words} words, ${content.length} characters`;
  }
}

module.exports = OutputParser;