const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

class SWEAgentMock extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      responseDelay: options.responseDelay || 1000,
      successRate: options.successRate || 0.9,
      outputFormat: options.outputFormat || 'json',
      workspaceDir: options.workspaceDir || '/tmp/test-swe-agent',
      enableRealFiles: options.enableRealFiles || false,
      ...options
    };
    
    this.executionHistory = [];
    this.predefinedResponses = new Map();
    this.executionCount = 0;
    this.isRunning = false;
  }

  /**
   * Mock SWE-agent command execution
   */
  async execute(command, args = [], options = {}) {
    this.executionCount++;
    const executionId = `exec_${this.executionCount}_${Date.now()}`;
    
    this.isRunning = true;
    
    const execution = {
      id: executionId,
      command,
      args,
      options,
      startTime: new Date(),
      pid: Math.floor(Math.random() * 10000) + 1000
    };

    this.executionHistory.push(execution);
    this.emit('execution_started', execution);

    try {
      // Simulate processing delay
      await this.simulateDelay();

      // Check for predefined response
      const predefinedKey = this.createResponseKey(command, args);
      if (this.predefinedResponses.has(predefinedKey)) {
        const response = this.predefinedResponses.get(predefinedKey);
        execution.endTime = new Date();
        execution.duration = execution.endTime - execution.startTime;
        execution.result = response;
        
        this.emit('execution_completed', execution);
        this.isRunning = false;
        return response;
      }

      // Generate response based on command type
      const result = await this.generateResponse(command, args, options);
      
      execution.endTime = new Date();
      execution.duration = execution.endTime - execution.startTime;
      execution.result = result;
      
      this.emit('execution_completed', execution);
      this.isRunning = false;
      
      return result;

    } catch (error) {
      execution.endTime = new Date();
      execution.duration = execution.endTime - execution.startTime;
      execution.error = error;
      
      this.emit('execution_failed', execution);
      this.isRunning = false;
      
      throw error;
    }
  }

  /**
   * Generate mock response based on command type
   */
  async generateResponse(command, args, options) {
    const commandType = this.detectCommandType(command, args);
    
    // Simulate random failures based on success rate
    if (Math.random() > this.options.successRate) {
      throw new Error(this.generateErrorResponse(commandType));
    }

    switch (commandType) {
      case 'fix_issue':
        return this.generateFixIssueResponse(args, options);
      case 'analyze_code':
        return this.generateAnalyzeCodeResponse(args, options);
      case 'generate_tests':
        return this.generateTestsResponse(args, options);
      case 'refactor':
        return this.generateRefactorResponse(args, options);
      case 'review_pr':
        return this.generatePRReviewResponse(args, options);
      case 'init':
        return this.generateInitResponse(args, options);
      default:
        return this.generateGenericResponse(command, args, options);
    }
  }

  /**
   * Detect command type from arguments
   */
  detectCommandType(command, args) {
    const argsStr = args.join(' ').toLowerCase();
    
    if (argsStr.includes('--fix') || argsStr.includes('fix')) {
      return 'fix_issue';
    }
    if (argsStr.includes('--analyze') || argsStr.includes('analyze')) {
      return 'analyze_code';
    }
    if (argsStr.includes('--test') || argsStr.includes('test')) {
      return 'generate_tests';
    }
    if (argsStr.includes('--refactor') || argsStr.includes('refactor')) {
      return 'refactor';
    }
    if (argsStr.includes('--review') || argsStr.includes('review')) {
      return 'review_pr';
    }
    if (argsStr.includes('--init') || argsStr.includes('init')) {
      return 'init';
    }
    
    return 'generic';
  }

  /**
   * Generate fix issue response
   */
  generateFixIssueResponse(args, options) {
    const filesChanged = Math.floor(Math.random() * 5) + 1;
    const linesAdded = Math.floor(Math.random() * 100) + 10;
    const linesRemoved = Math.floor(Math.random() * 50) + 5;

    return {
      status: 'success',
      task: 'fix_issue',
      summary: 'Successfully identified and fixed the issue',
      details: {
        issue_type: 'bug_fix',
        confidence: 0.85 + Math.random() * 0.1,
        files_modified: Array.from({ length: filesChanged }, (_, i) => 
          `src/components/component_${i + 1}.js`
        ),
        changes: {
          lines_added: linesAdded,
          lines_removed: linesRemoved,
          files_changed: filesChanged
        },
        tests_added: Math.floor(Math.random() * 3),
        tests_updated: Math.floor(Math.random() * 2)
      },
      execution_time: this.options.responseDelay,
      workspace: options.workspace || this.options.workspaceDir,
      artifacts: this.generateArtifacts('fix'),
      logs: this.generateExecutionLogs('fix_issue')
    };
  }

  /**
   * Generate code analysis response
   */
  generateAnalyzeCodeResponse(args, options) {
    const issues = Math.floor(Math.random() * 10);
    const suggestions = Math.floor(Math.random() * 15) + 5;

    return {
      status: 'success',
      task: 'analyze_code',
      summary: `Code analysis completed. Found ${issues} issues and ${suggestions} improvement suggestions`,
      details: {
        code_quality_score: (Math.random() * 40 + 60).toFixed(1), // 60-100
        issues_found: {
          critical: Math.floor(Math.random() * 2),
          major: Math.floor(Math.random() * 4),
          minor: Math.floor(Math.random() * 6),
          style: Math.floor(Math.random() * 10)
        },
        suggestions: Array.from({ length: suggestions }, (_, i) => ({
          type: ['performance', 'maintainability', 'security', 'style'][Math.floor(Math.random() * 4)],
          file: `src/file_${i + 1}.js`,
          line: Math.floor(Math.random() * 100) + 1,
          description: `Improvement suggestion ${i + 1}`
        })),
        metrics: {
          complexity: (Math.random() * 10).toFixed(1),
          maintainability: (Math.random() * 40 + 60).toFixed(1),
          test_coverage: (Math.random() * 30 + 70).toFixed(1)
        }
      },
      execution_time: this.options.responseDelay,
      workspace: options.workspace || this.options.workspaceDir,
      artifacts: this.generateArtifacts('analyze'),
      logs: this.generateExecutionLogs('analyze_code')
    };
  }

  /**
   * Generate test generation response
   */
  generateTestsResponse(args, options) {
    const testsGenerated = Math.floor(Math.random() * 10) + 5;

    return {
      status: 'success',
      task: 'generate_tests',
      summary: `Generated ${testsGenerated} comprehensive tests`,
      details: {
        tests_generated: testsGenerated,
        coverage_increase: (Math.random() * 20 + 10).toFixed(1) + '%',
        test_types: {
          unit: Math.floor(testsGenerated * 0.6),
          integration: Math.floor(testsGenerated * 0.3),
          e2e: Math.floor(testsGenerated * 0.1)
        },
        files_created: Array.from({ length: Math.ceil(testsGenerated / 3) }, (_, i) => 
          `test/test_file_${i + 1}.test.js`
        )
      },
      execution_time: this.options.responseDelay,
      workspace: options.workspace || this.options.workspaceDir,
      artifacts: this.generateArtifacts('test'),
      logs: this.generateExecutionLogs('generate_tests')
    };
  }

  /**
   * Generate refactor response
   */
  generateRefactorResponse(args, options) {
    const filesRefactored = Math.floor(Math.random() * 8) + 2;

    return {
      status: 'success',
      task: 'refactor',
      summary: `Successfully refactored ${filesRefactored} files for improved maintainability`,
      details: {
        refactoring_type: ['extract_function', 'rename_variable', 'simplify_logic', 'optimize_performance'][Math.floor(Math.random() * 4)],
        files_refactored: filesRefactored,
        complexity_reduction: (Math.random() * 30 + 10).toFixed(1) + '%',
        maintainability_improvement: (Math.random() * 25 + 15).toFixed(1) + '%',
        changes: {
          functions_extracted: Math.floor(Math.random() * 5),
          variables_renamed: Math.floor(Math.random() * 10),
          code_duplications_removed: Math.floor(Math.random() * 3)
        }
      },
      execution_time: this.options.responseDelay,
      workspace: options.workspace || this.options.workspaceDir,
      artifacts: this.generateArtifacts('refactor'),
      logs: this.generateExecutionLogs('refactor')
    };
  }

  /**
   * Generate PR review response
   */
  generatePRReviewResponse(args, options) {
    const reviewComments = Math.floor(Math.random() * 15) + 5;

    return {
      status: 'success',
      task: 'review_pr',
      summary: `Completed comprehensive PR review with ${reviewComments} comments`,
      details: {
        overall_score: (Math.random() * 30 + 70).toFixed(1), // 70-100
        review_comments: reviewComments,
        categories: {
          code_quality: Math.floor(Math.random() * 5),
          security: Math.floor(Math.random() * 3),
          performance: Math.floor(Math.random() * 4),
          style: Math.floor(Math.random() * 8),
          documentation: Math.floor(Math.random() * 3)
        },
        approval_status: Math.random() > 0.3 ? 'approved' : 'changes_requested',
        files_reviewed: Math.floor(Math.random() * 10) + 1,
        time_to_review: (Math.random() * 10 + 5).toFixed(1) + ' minutes'
      },
      execution_time: this.options.responseDelay,
      workspace: options.workspace || this.options.workspaceDir,
      artifacts: this.generateArtifacts('review'),
      logs: this.generateExecutionLogs('review_pr')
    };
  }

  /**
   * Generate init response
   */
  generateInitResponse(args, options) {
    return {
      status: 'success',
      task: 'init',
      summary: 'SWE-agent workspace initialized successfully',
      details: {
        workspace_created: options.workspace || this.options.workspaceDir,
        config_files_created: [
          '.swe-agent/config.yaml',
          '.swe-agent/prompts/',
          '.swe-agent/tools/'
        ],
        version: '0.4.0',
        capabilities: ['fix', 'analyze', 'test', 'refactor', 'review']
      },
      execution_time: this.options.responseDelay,
      workspace: options.workspace || this.options.workspaceDir,
      artifacts: this.generateArtifacts('init'),
      logs: this.generateExecutionLogs('init')
    };
  }

  /**
   * Generate generic response
   */
  generateGenericResponse(command, args, options) {
    return {
      status: 'success',
      task: 'generic',
      summary: 'Task completed successfully',
      details: {
        command,
        args,
        output: 'Generic SWE-agent execution completed'
      },
      execution_time: this.options.responseDelay,
      workspace: options.workspace || this.options.workspaceDir,
      artifacts: this.generateArtifacts('generic'),
      logs: this.generateExecutionLogs('generic')
    };
  }

  /**
   * Generate error response
   */
  generateErrorResponse(commandType) {
    const errors = {
      fix_issue: 'Failed to identify root cause of the issue',
      analyze_code: 'Code analysis failed due to parsing errors',
      generate_tests: 'Test generation failed - unable to understand code structure',
      refactor: 'Refactoring failed - potential breaking changes detected',
      review_pr: 'PR review failed - unable to access diff',
      init: 'Workspace initialization failed - permission denied',
      generic: 'Command execution failed with unknown error'
    };

    return errors[commandType] || errors.generic;
  }

  /**
   * Generate execution artifacts
   */
  generateArtifacts(taskType) {
    const baseArtifacts = {
      execution_log: `swe-agent-${taskType}-${Date.now()}.log`,
      workspace_snapshot: `workspace-${Date.now()}.tar.gz`
    };

    const taskSpecificArtifacts = {
      fix: {
        patch_file: `fix-${Date.now()}.patch`,
        test_results: `test-results-${Date.now()}.xml`
      },
      analyze: {
        analysis_report: `analysis-report-${Date.now()}.json`,
        metrics_report: `metrics-${Date.now()}.html`
      },
      test: {
        test_files: `generated-tests-${Date.now()}.zip`,
        coverage_report: `coverage-${Date.now()}.html`
      },
      refactor: {
        refactor_plan: `refactor-plan-${Date.now()}.md`,
        diff_report: `refactor-diff-${Date.now()}.patch`
      },
      review: {
        review_report: `pr-review-${Date.now()}.md`,
        suggestions: `suggestions-${Date.now()}.json`
      }
    };

    return {
      ...baseArtifacts,
      ...(taskSpecificArtifacts[taskType] || {})
    };
  }

  /**
   * Generate execution logs
   */
  generateExecutionLogs(taskType) {
    const logEntries = [];
    const startTime = new Date();

    // Generate realistic log progression
    const logSteps = {
      fix_issue: [
        'Initializing issue analysis...',
        'Reading repository structure...',
        'Analyzing issue description...',
        'Identifying relevant files...',
        'Generating fix strategy...',
        'Implementing solution...',
        'Running tests...',
        'Validating fix...'
      ],
      analyze_code: [
        'Starting code analysis...',
        'Parsing source files...',
        'Running static analysis...',
        'Calculating metrics...',
        'Identifying issues...',
        'Generating suggestions...',
        'Creating report...'
      ],
      generate_tests: [
        'Analyzing code structure...',
        'Identifying testable functions...',
        'Generating test cases...',
        'Creating test files...',
        'Running generated tests...',
        'Calculating coverage...'
      ]
    };

    const steps = logSteps[taskType] || ['Executing task...', 'Processing...', 'Completing...'];
    
    steps.forEach((step, index) => {
      const timestamp = new Date(startTime.getTime() + (index * 200));
      logEntries.push({
        timestamp: timestamp.toISOString(),
        level: 'INFO',
        message: step,
        step: index + 1,
        total_steps: steps.length
      });
    });

    return logEntries;
  }

  /**
   * Simulate processing delay
   */
  async simulateDelay() {
    const delay = this.options.responseDelay + (Math.random() * 1000 - 500); // ±500ms variance
    await new Promise(resolve => setTimeout(resolve, Math.max(100, delay)));
  }

  /**
   * Create response key for predefined responses
   */
  createResponseKey(command, args) {
    return `${command}:${args.join(':')}`;
  }

  /**
   * Set predefined response for specific command
   */
  setPredefinedResponse(command, args, response) {
    const key = this.createResponseKey(command, args);
    this.predefinedResponses.set(key, response);
  }

  /**
   * Clear predefined responses
   */
  clearPredefinedResponses() {
    this.predefinedResponses.clear();
  }

  /**
   * Get execution history
   */
  getExecutionHistory() {
    return this.executionHistory;
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    const successful = this.executionHistory.filter(e => !e.error).length;
    const failed = this.executionHistory.filter(e => e.error).length;
    const totalTime = this.executionHistory.reduce((sum, e) => sum + (e.duration || 0), 0);
    const avgTime = this.executionHistory.length > 0 ? totalTime / this.executionHistory.length : 0;

    return {
      total_executions: this.executionHistory.length,
      successful_executions: successful,
      failed_executions: failed,
      success_rate: this.executionHistory.length > 0 ? successful / this.executionHistory.length : 0,
      average_execution_time: avgTime,
      total_execution_time: totalTime
    };
  }

  /**
   * Reset mock state
   */
  reset() {
    this.executionHistory = [];
    this.executionCount = 0;
    this.isRunning = false;
    this.clearPredefinedResponses();
    this.emit('reset');
  }

  /**
   * Create workspace files for more realistic testing
   */
  async createWorkspaceFiles(workspace) {
    if (!this.options.enableRealFiles) return;

    try {
      await fs.mkdir(workspace, { recursive: true });
      
      // Create some basic files
      const files = {
        'config.yaml': 'version: 1.0\nagent:\n  name: swe-agent\n  version: 0.4.0',
        'execution.log': 'SWE-agent execution log\n',
        'results.json': JSON.stringify({ status: 'completed' }, null, 2)
      };

      for (const [filename, content] of Object.entries(files)) {
        await fs.writeFile(path.join(workspace, filename), content);
      }
    } catch (error) {
      // Ignore file creation errors in tests
    }
  }

  /**
   * Cleanup workspace files
   */
  async cleanupWorkspaceFiles(workspace) {
    if (!this.options.enableRealFiles) return;

    try {
      await fs.rmdir(workspace, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

module.exports = SWEAgentMock;