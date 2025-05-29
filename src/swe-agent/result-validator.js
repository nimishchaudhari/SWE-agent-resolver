const Joi = require('joi');
const logger = require('../utils/logger');

class ResultValidator {
  constructor() {
    this.schemas = this.createValidationSchemas();
    this.validationRules = this.createValidationRules();
  }

  createValidationSchemas() {
    const baseResult = Joi.object({
      success: Joi.boolean().required(),
      exitCode: Joi.number().integer().required(),
      duration: Joi.number().positive().required(),
      metadata: Joi.object({
        parseTime: Joi.number(),
        outputFiles: Joi.array().items(Joi.string()),
        parsedAt: Joi.string().isoDate()
      }),
      summary: Joi.object()
    });

    const outputSchema = Joi.object({
      type: Joi.string().valid('json', 'structured', 'markdown', 'diff', 'log', 'raw').required(),
      content: Joi.alternatives().try(Joi.string(), Joi.object()),
      error: Joi.string(),
      valid: Joi.boolean()
    });

    const jsonOutputSchema = outputSchema.keys({
      data: Joi.object(),
      summary: Joi.string(),
      metrics: Joi.object()
    });

    const structuredOutputSchema = outputSchema.keys({
      sections: Joi.array().items(Joi.object({
        title: Joi.string().required(),
        content: Joi.string().required(),
        type: Joi.string()
      })),
      keyPoints: Joi.array().items(Joi.string())
    });

    const markdownOutputSchema = outputSchema.keys({
      sections: Joi.array(),
      codeBlocks: Joi.array().items(Joi.object({
        language: Joi.string(),
        code: Joi.string().required()
      })),
      actionItems: Joi.array().items(Joi.string())
    });

    const diffOutputSchema = outputSchema.keys({
      changes: Joi.array().items(Joi.object({
        oldPath: Joi.string().required(),
        newPath: Joi.string().required(),
        additions: Joi.number().integer().min(0),
        deletions: Joi.number().integer().min(0),
        hunks: Joi.array()
      })),
      files: Joi.array(),
      stats: Joi.object({
        files: Joi.number().integer().min(0),
        additions: Joi.number().integer().min(0),
        deletions: Joi.number().integer().min(0)
      })
    });

    return {
      base: baseResult,
      output: outputSchema,
      json: jsonOutputSchema,
      structured: structuredOutputSchema,
      markdown: markdownOutputSchema,
      diff: diffOutputSchema
    };
  }

  createValidationRules() {
    return {
      maxDuration: 3600000, // 1 hour
      maxOutputSize: 50 * 1024 * 1024, // 50MB
      maxFiles: 100,
      maxCodeBlocks: 50,
      maxSections: 20,
      requiredFields: {
        issue: ['analysis', 'recommendations'],
        pr: ['changes_summary', 'suggestions'],
        comment: ['response']
      },
      allowedCommands: [
        'analyze', 'fix', 'explain', 'test', 'refactor', 'help'
      ]
    };
  }

  async validateResult(result, context = {}) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {
        validatedAt: new Date().toISOString(),
        context: context.type || 'unknown'
      }
    };

    try {
      // Basic structure validation
      await this.validateStructure(result, validation);
      
      // Content validation
      await this.validateContent(result, validation, context);
      
      // Business logic validation
      await this.validateBusinessRules(result, validation, context);
      
      // Security validation
      await this.validateSecurity(result, validation);
      
      // Performance validation
      await this.validatePerformance(result, validation);

    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
      logger.error('Result validation error:', error);
    }

    return validation;
  }

  async validateStructure(result, validation) {
    const { error } = this.schemas.base.validate(result);
    
    if (error) {
      validation.valid = false;
      validation.errors.push(`Structure validation failed: ${error.message}`);
      return;
    }

    // Validate outputs structure
    if (result.outputs) {
      for (const [filename, output] of Object.entries(result.outputs)) {
        const outputValidation = this.validateOutputStructure(output, filename);
        
        if (!outputValidation.valid) {
          validation.errors.push(...outputValidation.errors);
          validation.valid = false;
        } else if (outputValidation.warnings.length > 0) {
          validation.warnings.push(...outputValidation.warnings);
        }
      }
    }

    // Validate primary output
    if (result.primary) {
      const primaryValidation = this.validateOutputStructure(result.primary, 'primary');
      
      if (!primaryValidation.valid) {
        validation.errors.push(...primaryValidation.errors);
        validation.valid = false;
      }
    }
  }

  validateOutputStructure(output, filename) {
    const validation = { valid: true, errors: [], warnings: [] };
    
    // Basic output validation
    const { error } = this.schemas.output.validate(output);
    if (error) {
      validation.valid = false;
      validation.errors.push(`Output ${filename}: ${error.message}`);
      return validation;
    }

    // Type-specific validation
    const typeSchema = this.schemas[output.type];
    if (typeSchema) {
      const { error: typeError } = typeSchema.validate(output);
      if (typeError) {
        validation.warnings.push(`Output ${filename} type validation: ${typeError.message}`);
      }
    }

    return validation;
  }

  async validateContent(result, validation, context) {
    // Check for required content based on context
    const requiredFields = this.validationRules.requiredFields[context.type];
    
    if (requiredFields && result.primary?.data) {
      const missingFields = requiredFields.filter(field => 
        !result.primary.data[field] && !this.findFieldInOutputs(result.outputs, field)
      );
      
      if (missingFields.length > 0) {
        validation.warnings.push(`Missing recommended fields: ${missingFields.join(', ')}`);
      }
    }

    // Validate content quality
    await this.validateContentQuality(result, validation);
    
    // Check for common issues
    this.checkForCommonIssues(result, validation);
  }

  async validateContentQuality(result, validation) {
    const content = this.extractAllContent(result);
    
    // Check for minimum content length
    if (content.length < 50) {
      validation.warnings.push('Result content appears too brief');
    }
    
    // Check for error indicators
    const errorIndicators = [
      /error|failed|exception/i,
      /timeout|killed|terminated/i,
      /permission denied|access denied/i,
      /not found|missing|unavailable/i
    ];
    
    const hasErrors = errorIndicators.some(pattern => pattern.test(content));
    if (hasErrors && result.success) {
      validation.warnings.push('Success flag conflicts with error content');
    }
    
    // Check for placeholder content
    const placeholders = [
      /TODO|FIXME|PLACEHOLDER/i,
      /\[.*\]/,
      /\{.*\}/
    ];
    
    const hasPlaceholders = placeholders.some(pattern => pattern.test(content));
    if (hasPlaceholders) {
      validation.warnings.push('Result contains placeholder content');
    }
  }

  checkForCommonIssues(result, validation) {
    // Check for empty outputs
    if (result.outputs) {
      const emptyOutputs = Object.entries(result.outputs)
        .filter(([, output]) => !output.content || output.content.length === 0)
        .map(([filename]) => filename);
      
      if (emptyOutputs.length > 0) {
        validation.warnings.push(`Empty outputs: ${emptyOutputs.join(', ')}`);
      }
    }
    
    // Check for duplicate content
    if (result.outputs && Object.keys(result.outputs).length > 1) {
      const contents = Object.values(result.outputs)
        .map(output => JSON.stringify(output.content))
        .filter(content => content.length > 10);
      
      const uniqueContents = new Set(contents);
      if (uniqueContents.size < contents.length) {
        validation.warnings.push('Duplicate content detected in outputs');
      }
    }
  }

  async validateBusinessRules(result, validation, context) {
    // Validate command execution rules
    if (context.trigger?.primaryCommand) {
      const command = context.trigger.primaryCommand.type;
      
      if (!this.validationRules.allowedCommands.includes(command)) {
        validation.errors.push(`Invalid command: ${command}`);
        validation.valid = false;
      }
      
      // Command-specific validation
      await this.validateCommandResult(result, validation, command, context);
    }
    
    // Validate repository context
    if (context.repository) {
      await this.validateRepositoryResult(result, validation, context.repository);
    }
  }

  async validateCommandResult(result, validation, command, context) {
    switch (command) {
      case 'fix':
        this.validateFixResult(result, validation);
        break;
      case 'test':
        this.validateTestResult(result, validation);
        break;
      case 'analyze':
        this.validateAnalysisResult(result, validation);
        break;
      case 'refactor':
        this.validateRefactorResult(result, validation);
        break;
    }
  }

  validateFixResult(result, validation) {
    // Check for code changes
    const hasChanges = this.findChangesInResult(result);
    if (!hasChanges) {
      validation.warnings.push('Fix command produced no code changes');
    }
    
    // Check for fix explanation
    const hasExplanation = this.findExplanationInResult(result);
    if (!hasExplanation) {
      validation.warnings.push('Fix command missing explanation');
    }
  }

  validateTestResult(result, validation) {
    // Check for test results
    const hasTestResults = this.findTestResultsInResult(result);
    if (!hasTestResults) {
      validation.warnings.push('Test command produced no test results');
    }
  }

  validateAnalysisResult(result, validation) {
    // Check for analysis sections
    const requiredSections = ['summary', 'findings', 'recommendations'];
    const missingSections = requiredSections.filter(section => 
      !this.findSectionInResult(result, section)
    );
    
    if (missingSections.length > 0) {
      validation.warnings.push(`Analysis missing sections: ${missingSections.join(', ')}`);
    }
  }

  validateRefactorResult(result, validation) {
    // Check for before/after comparison
    const hasComparison = this.findComparisonInResult(result);
    if (!hasComparison) {
      validation.warnings.push('Refactor result missing before/after comparison');
    }
  }

  async validateRepositoryResult(result, validation, repository) {
    // Validate repository-specific constraints
    if (repository.language) {
      const expectedLanguage = repository.language.toLowerCase();
      const resultLanguage = this.detectLanguageInResult(result);
      
      if (resultLanguage && resultLanguage !== expectedLanguage) {
        validation.warnings.push(`Language mismatch: expected ${expectedLanguage}, found ${resultLanguage}`);
      }
    }
  }

  async validateSecurity(result, validation) {
    const content = this.extractAllContent(result);
    
    // Check for potential security issues
    const securityPatterns = [
      {
        pattern: /(?:password|secret|key|token)\s*[=:]\s*["']?[^\s"']+/gi,
        message: 'Potential credential exposure'
      },
      {
        pattern: /(?:api_key|access_token|private_key)\s*[=:]/gi,
        message: 'Potential API key exposure'
      },
      {
        pattern: /-----BEGIN [A-Z ]+-----/gi,
        message: 'Potential private key in output'
      },
      {
        pattern: /(?:eval|exec|system)\s*\(/gi,
        message: 'Potential code injection risk'
      }
    ];
    
    for (const { pattern, message } of securityPatterns) {
      if (pattern.test(content)) {
        validation.errors.push(`Security issue: ${message}`);
        validation.valid = false;
      }
    }
    
    // Check for file path traversal
    const pathTraversalPattern = /\.\.[\/\\]/g;
    if (pathTraversalPattern.test(content)) {
      validation.warnings.push('Potential path traversal in file paths');
    }
  }

  async validatePerformance(result, validation) {
    const rules = this.validationRules;
    
    // Duration check
    if (result.duration > rules.maxDuration) {
      validation.warnings.push(`Execution time exceeded recommended limit (${rules.maxDuration}ms)`);
    }
    
    // Output size check
    const totalSize = this.calculateTotalOutputSize(result);
    if (totalSize > rules.maxOutputSize) {
      validation.warnings.push(`Output size (${totalSize} bytes) exceeds limit`);
    }
    
    // File count check
    if (result.outputs && Object.keys(result.outputs).length > rules.maxFiles) {
      validation.warnings.push(`Too many output files (${Object.keys(result.outputs).length})`);
    }
    
    // Code blocks check
    const codeBlockCount = this.countCodeBlocks(result);
    if (codeBlockCount > rules.maxCodeBlocks) {
      validation.warnings.push(`Too many code blocks (${codeBlockCount})`);
    }
  }

  // Helper methods
  findFieldInOutputs(outputs, field) {
    if (!outputs) return false;
    
    return Object.values(outputs).some(output => {
      if (output.data && output.data[field]) return true;
      if (output.content && typeof output.content === 'string') {
        return output.content.toLowerCase().includes(field.toLowerCase());
      }
      return false;
    });
  }

  extractAllContent(result) {
    let content = '';
    
    if (result.primary?.content) {
      content += JSON.stringify(result.primary.content);
    }
    
    if (result.outputs) {
      for (const output of Object.values(result.outputs)) {
        if (output.content) {
          content += JSON.stringify(output.content);
        }
      }
    }
    
    return content;
  }

  findChangesInResult(result) {
    const content = this.extractAllContent(result);
    const changePatterns = [
      /diff|patch|modified|changed/i,
      /\+\+\+|---|@@/,
      /before.*after/i
    ];
    
    return changePatterns.some(pattern => pattern.test(content));
  }

  findExplanationInResult(result) {
    const content = this.extractAllContent(result);
    const explanationPatterns = [
      /explanation|reason|because|fixed|changed/i,
      /summary|description/i
    ];
    
    return explanationPatterns.some(pattern => pattern.test(content));
  }

  findTestResultsInResult(result) {
    const content = this.extractAllContent(result);
    const testPatterns = [
      /test.*(?:passed|failed|skipped)/i,
      /\d+\s+(?:tests?|specs?)/i,
      /coverage|assertion/i
    ];
    
    return testPatterns.some(pattern => pattern.test(content));
  }

  findSectionInResult(result, section) {
    const content = this.extractAllContent(result);
    const sectionPattern = new RegExp(`${section}`, 'i');
    return sectionPattern.test(content);
  }

  findComparisonInResult(result) {
    const content = this.extractAllContent(result);
    const comparisonPatterns = [
      /before.*after/i,
      /original.*refactored/i,
      /old.*new/i
    ];
    
    return comparisonPatterns.some(pattern => pattern.test(content));
  }

  detectLanguageInResult(result) {
    const content = this.extractAllContent(result);
    const languagePatterns = {
      javascript: /\.js|javascript|node/i,
      python: /\.py|python|pip/i,
      java: /\.java|java|maven/i,
      go: /\.go|golang/i,
      rust: /\.rs|rust|cargo/i
    };
    
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(content)) {
        return lang;
      }
    }
    
    return null;
  }

  calculateTotalOutputSize(result) {
    let size = 0;
    
    if (result.primary?.content) {
      size += JSON.stringify(result.primary.content).length;
    }
    
    if (result.outputs) {
      for (const output of Object.values(result.outputs)) {
        if (output.content) {
          size += JSON.stringify(output.content).length;
        }
      }
    }
    
    return size;
  }

  countCodeBlocks(result) {
    let count = 0;
    
    if (result.primary?.codeBlocks) {
      count += result.primary.codeBlocks.length;
    }
    
    if (result.outputs) {
      for (const output of Object.values(result.outputs)) {
        if (output.codeBlocks) {
          count += output.codeBlocks.length;
        }
      }
    }
    
    return count;
  }

  // Public utility methods
  isValidResult(result, context = {}) {
    try {
      const validation = this.validateResult(result, context);
      return validation.valid;
    } catch {
      return false;
    }
  }

  getValidationSummary(validation) {
    return {
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      criticalIssues: validation.errors.slice(0, 3),
      topWarnings: validation.warnings.slice(0, 3)
    };
  }
}

module.exports = ResultValidator;