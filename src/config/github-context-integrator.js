const logger = require('../utils/logger');

/**
 * GitHub Context Integrator
 * Integrates repository context with SWE-agent configuration for GitHub workflows
 */
class GitHubContextIntegrator {
  constructor() {
    this.contextCache = new Map();
    this.repositoryMetadataCache = new Map();
  }

  /**
   * Integrate GitHub Actions context with SWE-agent configuration
   * @param {object} githubContext - GitHub Actions context object
   * @param {object} webhookPayload - Optional webhook payload for additional context
   * @returns {object} Enhanced configuration context
   */
  async integrateGitHubContext(githubContext, webhookPayload = null) {
    try {
      const cacheKey = this.generateContextCacheKey(githubContext, webhookPayload);
      
      // Check cache for recent context
      if (this.contextCache.has(cacheKey)) {
        const cached = this.contextCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
          logger.debug('Using cached GitHub context');
          return cached.context;
        }
      }

      // Build integrated context
      const integratedContext = {
        github: await this.extractGitHubActionsContext(githubContext),
        repository: await this.extractRepositoryContext(githubContext, webhookPayload),
        workflow: await this.extractWorkflowContext(githubContext),
        deployment: await this.detectDeploymentContext(githubContext),
        security: await this.extractSecurityContext(githubContext),
        performance: await this.extractPerformanceContext(githubContext),
        metadata: {
          integrated_at: new Date().toISOString(),
          context_version: '1.0.0',
          cache_key: cacheKey
        }
      };

      // Cache the result
      this.contextCache.set(cacheKey, {
        context: integratedContext,
        timestamp: Date.now()
      });

      return integratedContext;

    } catch (error) {
      logger.error('GitHub context integration failed:', error);
      return this.getFallbackContext(githubContext, error);
    }
  }

  /**
   * Extract GitHub Actions specific context
   */
  async extractGitHubActionsContext(githubContext) {
    const context = {
      // Core GitHub Actions variables
      repository: githubContext.repository || process.env.GITHUB_REPOSITORY,
      ref: githubContext.ref || process.env.GITHUB_REF,
      sha: githubContext.sha || process.env.GITHUB_SHA,
      actor: githubContext.actor || process.env.GITHUB_ACTOR,
      workflow: githubContext.workflow || process.env.GITHUB_WORKFLOW,
      run_id: githubContext.run_id || process.env.GITHUB_RUN_ID,
      run_number: githubContext.run_number || process.env.GITHUB_RUN_NUMBER,
      job: githubContext.job || process.env.GITHUB_JOB,
      
      // Event information
      event_name: githubContext.event_name || process.env.GITHUB_EVENT_NAME,
      event_path: process.env.GITHUB_EVENT_PATH,
      
      // Environment information
      workspace: githubContext.workspace || process.env.GITHUB_WORKSPACE,
      server_url: process.env.GITHUB_SERVER_URL || 'https://github.com',
      api_url: process.env.GITHUB_API_URL || 'https://api.github.com',
      graphql_url: process.env.GITHUB_GRAPHQL_URL || 'https://api.github.com/graphql',
      
      // Runner information
      runner_os: process.env.RUNNER_OS,
      runner_arch: process.env.RUNNER_ARCH,
      runner_name: process.env.RUNNER_NAME,
      runner_environment: process.env.RUNNER_ENVIRONMENT,
      
      // Authentication
      token_available: !!process.env.GITHUB_TOKEN,
      token_permissions: await this.detectTokenPermissions()
    };

    // Parse repository information
    if (context.repository) {
      const [owner, repo] = context.repository.split('/');
      context.repository_owner = owner;
      context.repository_name = repo;
      context.repository_url = `${context.server_url}/${context.repository}`;
      context.repository_clone_url = `${context.repository_url}.git`;
    }

    // Parse branch/tag information
    if (context.ref) {
      if (context.ref.startsWith('refs/heads/')) {
        context.branch = context.ref.replace('refs/heads/', '');
        context.ref_type = 'branch';
      } else if (context.ref.startsWith('refs/tags/')) {
        context.tag = context.ref.replace('refs/tags/', '');
        context.ref_type = 'tag';
      } else if (context.ref.startsWith('refs/pull/')) {
        const prMatch = context.ref.match(/refs\/pull\/(\d+)\/merge/);
        if (prMatch) {
          context.pull_request_number = parseInt(prMatch[1]);
          context.ref_type = 'pull_request';
        }
      }
    }

    return context;
  }

  /**
   * Extract repository-specific context
   */
  async extractRepositoryContext(githubContext, webhookPayload) {
    const repositoryName = githubContext.repository || process.env.GITHUB_REPOSITORY;
    
    if (!repositoryName) {
      throw new Error('Repository name not available in GitHub context');
    }

    // Check cache for repository metadata
    if (this.repositoryMetadataCache.has(repositoryName)) {
      const cached = this.repositoryMetadataCache.get(repositoryName);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        logger.debug('Using cached repository metadata');
        return cached.metadata;
      }
    }

    const context = {
      name: repositoryName,
      full_name: repositoryName,
      private: false, // Default assumption
      default_branch: 'main', // Default assumption
      clone_url: `https://github.com/${repositoryName}.git`,
      ssh_url: `git@github.com:${repositoryName}.git`,
      
      // Will be enhanced with webhook payload or API data
      language: null,
      topics: [],
      size: null,
      stargazers_count: null,
      forks_count: null,
      open_issues_count: null,
      has_issues: true,
      has_projects: true,
      has_wiki: true,
      has_pages: false,
      archived: false,
      disabled: false,
      visibility: 'public'
    };

    // Enhance with webhook payload data if available
    if (webhookPayload?.repository) {
      const repo = webhookPayload.repository;
      Object.assign(context, {
        id: repo.id,
        private: repo.private,
        default_branch: repo.default_branch,
        language: repo.language,
        topics: repo.topics || [],
        size: repo.size,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        has_issues: repo.has_issues,
        has_projects: repo.has_projects,
        has_wiki: repo.has_wiki,
        has_pages: repo.has_pages,
        archived: repo.archived,
        disabled: repo.disabled,
        visibility: repo.visibility,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        homepage: repo.homepage,
        description: repo.description,
        license: repo.license
      });
    }

    // Detect repository patterns and conventions
    context.patterns = await this.detectRepositoryPatterns(context);
    context.technologies = await this.detectRepositoryTechnologies(context);
    context.workflow_files = await this.detectWorkflowFiles(githubContext);

    // Cache the repository metadata
    this.repositoryMetadataCache.set(repositoryName, {
      metadata: context,
      timestamp: Date.now()
    });

    return context;
  }

  /**
   * Extract workflow-specific context
   */
  async extractWorkflowContext(githubContext) {
    const context = {
      name: githubContext.workflow || process.env.GITHUB_WORKFLOW,
      run_id: githubContext.run_id || process.env.GITHUB_RUN_ID,
      run_number: githubContext.run_number || process.env.GITHUB_RUN_NUMBER,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT,
      job: githubContext.job || process.env.GITHUB_JOB,
      action: process.env.GITHUB_ACTION,
      step: process.env.GITHUB_STEP,
      
      // Workflow file detection
      workflow_file: this.detectWorkflowFile(githubContext),
      
      // Trigger information
      trigger: {
        event: githubContext.event_name || process.env.GITHUB_EVENT_NAME,
        actor: githubContext.actor || process.env.GITHUB_ACTOR,
        ref: githubContext.ref || process.env.GITHUB_REF
      },
      
      // Execution context
      runner: {
        os: process.env.RUNNER_OS,
        arch: process.env.RUNNER_ARCH,
        name: process.env.RUNNER_NAME,
        environment: process.env.RUNNER_ENVIRONMENT,
        temp: process.env.RUNNER_TEMP,
        tool_cache: process.env.RUNNER_TOOL_CACHE
      },
      
      // Previous steps context (if available)
      previous_steps: this.extractPreviousStepsContext()
    };

    // Detect workflow patterns
    context.patterns = this.detectWorkflowPatterns(context);
    
    return context;
  }

  /**
   * Detect deployment context from environment
   */
  async detectDeploymentContext(githubContext) {
    const context = {
      mode: 'github_actions', // Default
      capabilities: [],
      constraints: {},
      environment: process.env.GITHUB_ENV || 'development'
    };

    // Detect available deployment options
    if (process.env.MODAL_TOKEN || process.env.MODAL_TOKEN_ID) {
      context.capabilities.push('modal');
      context.modal = {
        token_available: !!process.env.MODAL_TOKEN,
        token_id_available: !!process.env.MODAL_TOKEN_ID,
        environment: process.env.MODAL_ENVIRONMENT || 'dev'
      };
    }

    if (process.env.DOCKER_REGISTRY_TOKEN || githubContext.event_name === 'push') {
      context.capabilities.push('docker');
      context.docker = {
        registry_token_available: !!process.env.DOCKER_REGISTRY_TOKEN,
        buildx_available: true, // Assume available in GitHub Actions
        compose_available: true
      };
    }

    // Detect runner constraints
    context.constraints = {
      memory_limit: this.detectRunnerMemoryLimit(),
      cpu_limit: this.detectRunnerCPULimit(),
      disk_space: this.detectRunnerDiskSpace(),
      network_access: this.detectNetworkAccess(),
      timeout_limit: this.detectTimeoutLimit(githubContext)
    };

    // Detect environment type
    if (githubContext.ref?.includes('main') || githubContext.ref?.includes('master')) {
      context.environment = 'production';
    } else if (githubContext.ref?.includes('develop') || githubContext.ref?.includes('staging')) {
      context.environment = 'staging';
    } else if (githubContext.event_name === 'pull_request') {
      context.environment = 'preview';
    }

    return context;
  }

  /**
   * Extract security context
   */
  async extractSecurityContext(githubContext) {
    const context = {
      token_permissions: await this.detectTokenPermissions(),
      secrets_available: this.detectAvailableSecrets(),
      security_features: this.detectSecurityFeatures(githubContext),
      compliance: this.detectComplianceRequirements(githubContext)
    };

    // Detect private repository requirements
    if (process.env.GITHUB_REPOSITORY && 
        (process.env.GITHUB_REPOSITORY_VISIBILITY === 'private' || 
         githubContext.repository_private)) {
      context.private_repository = true;
      context.additional_security_required = true;
    }

    return context;
  }

  /**
   * Extract performance context
   */
  async extractPerformanceContext(githubContext) {
    const context = {
      runner_specs: {
        os: process.env.RUNNER_OS,
        arch: process.env.RUNNER_ARCH,
        cores: this.detectRunnerCores(),
        memory: this.detectRunnerMemoryLimit(),
        disk: this.detectRunnerDiskSpace()
      },
      
      optimization_hints: {
        cache_available: true, // GitHub Actions cache
        artifacts_available: true,
        parallel_jobs_possible: this.detectParallelJobCapability(githubContext),
        matrix_build_detected: this.detectMatrixBuild(githubContext)
      },
      
      cost_considerations: {
        runner_cost_per_minute: this.estimateRunnerCost(process.env.RUNNER_OS),
        estimated_execution_time: this.estimateExecutionTime(githubContext),
        optimization_recommendations: this.generateOptimizationRecommendations()
      }
    };

    return context;
  }

  /**
   * Detect repository patterns
   */
  async detectRepositoryPatterns(repositoryContext) {
    const patterns = {
      monorepo: false,
      microservices: false,
      library: false,
      application: false,
      documentation: false,
      template: false,
      fork: false
    };

    // Analyze repository name and description
    const name = repositoryContext.name?.toLowerCase() || '';
    const description = repositoryContext.description?.toLowerCase() || '';

    if (name.includes('template') || description.includes('template')) {
      patterns.template = true;
    }

    if (name.includes('docs') || name.includes('documentation') || 
        description.includes('documentation')) {
      patterns.documentation = true;
    }

    if (name.includes('lib') || name.includes('library') || name.includes('sdk') ||
        description.includes('library') || description.includes('package')) {
      patterns.library = true;
    }

    // Detect monorepo patterns
    if (name.includes('monorepo') || description.includes('monorepo')) {
      patterns.monorepo = true;
    }

    // Detect microservices
    if (name.includes('service') || name.includes('micro') || 
        description.includes('microservice') || description.includes('service')) {
      patterns.microservices = true;
    }

    // Default to application if no other pattern detected
    if (!Object.values(patterns).some(Boolean)) {
      patterns.application = true;
    }

    return patterns;
  }

  /**
   * Detect repository technologies
   */
  async detectRepositoryTechnologies(repositoryContext) {
    const technologies = {
      primary_language: repositoryContext.language,
      frameworks: [],
      tools: [],
      platforms: [],
      databases: []
    };

    // Detect technologies from repository topics
    const topics = repositoryContext.topics || [];
    
    const frameworkPatterns = {
      'react': 'React',
      'vue': 'Vue.js', 
      'angular': 'Angular',
      'express': 'Express.js',
      'django': 'Django',
      'flask': 'Flask',
      'spring': 'Spring',
      'rails': 'Ruby on Rails',
      'laravel': 'Laravel'
    };

    const toolPatterns = {
      'docker': 'Docker',
      'kubernetes': 'Kubernetes',
      'terraform': 'Terraform',
      'ansible': 'Ansible',
      'jenkins': 'Jenkins',
      'github-actions': 'GitHub Actions',
      'webpack': 'Webpack',
      'babel': 'Babel',
      'eslint': 'ESLint'
    };

    const platformPatterns = {
      'aws': 'AWS',
      'azure': 'Azure',
      'gcp': 'Google Cloud',
      'heroku': 'Heroku',
      'vercel': 'Vercel',
      'netlify': 'Netlify'
    };

    const databasePatterns = {
      'mysql': 'MySQL',
      'postgresql': 'PostgreSQL',
      'mongodb': 'MongoDB',
      'redis': 'Redis',
      'sqlite': 'SQLite',
      'elasticsearch': 'Elasticsearch'
    };

    // Analyze topics for technology patterns
    for (const topic of topics) {
      const topicLower = topic.toLowerCase();
      
      if (frameworkPatterns[topicLower]) {
        technologies.frameworks.push(frameworkPatterns[topicLower]);
      }
      if (toolPatterns[topicLower]) {
        technologies.tools.push(toolPatterns[topicLower]);
      }
      if (platformPatterns[topicLower]) {
        technologies.platforms.push(platformPatterns[topicLower]);
      }
      if (databasePatterns[topicLower]) {
        technologies.databases.push(databasePatterns[topicLower]);
      }
    }

    return technologies;
  }

  /**
   * Utility methods for detection
   */
  detectWorkflowFile(githubContext) {
    const workflowName = githubContext.workflow || process.env.GITHUB_WORKFLOW;
    if (!workflowName) return null;
    
    // Convert workflow name to likely file name
    const fileName = workflowName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    return `.github/workflows/${fileName}.yml`;
  }

  async detectWorkflowFiles(githubContext) {
    // In a real implementation, this would scan the .github/workflows directory
    // For now, return common workflow file patterns
    return [
      '.github/workflows/ci.yml',
      '.github/workflows/test.yml',
      '.github/workflows/deploy.yml',
      '.github/workflows/release.yml'
    ];
  }

  detectWorkflowPatterns(workflowContext) {
    const patterns = {
      ci_cd: false,
      testing: false,
      deployment: false,
      release: false,
      security_scanning: false,
      code_quality: false
    };

    const workflowName = workflowContext.name?.toLowerCase() || '';
    const event = workflowContext.trigger?.event || '';

    if (workflowName.includes('ci') || workflowName.includes('test') || 
        event === 'pull_request') {
      patterns.ci_cd = true;
      patterns.testing = true;
    }

    if (workflowName.includes('deploy') || workflowName.includes('release') ||
        event === 'release') {
      patterns.deployment = true;
    }

    if (workflowName.includes('release') || event === 'release') {
      patterns.release = true;
    }

    if (workflowName.includes('security') || workflowName.includes('scan')) {
      patterns.security_scanning = true;
    }

    if (workflowName.includes('lint') || workflowName.includes('quality')) {
      patterns.code_quality = true;
    }

    return patterns;
  }

  async detectTokenPermissions() {
    // In a real implementation, this would check actual token permissions
    // For now, return assumed permissions based on environment
    const permissions = {
      contents: 'read',
      pull_requests: 'read',
      issues: 'read',
      actions: 'read',
      checks: 'read'
    };

    // Enhanced permissions for certain events
    if (process.env.GITHUB_EVENT_NAME === 'push') {
      permissions.contents = 'write';
    }

    return permissions;
  }

  detectAvailableSecrets() {
    const secrets = {
      github_token: !!process.env.GITHUB_TOKEN,
      anthropic_api_key: !!process.env.ANTHROPIC_API_KEY,
      openai_api_key: !!process.env.OPENAI_API_KEY,
      modal_token: !!process.env.MODAL_TOKEN,
      docker_token: !!process.env.DOCKER_REGISTRY_TOKEN
    };

    return secrets;
  }

  detectSecurityFeatures(githubContext) {
    return {
      dependabot_enabled: true, // Assume enabled
      security_advisories: true,
      code_scanning: true,
      secret_scanning: true,
      private_vulnerability_reporting: githubContext.repository_private || false
    };
  }

  detectComplianceRequirements(githubContext) {
    // Detect compliance requirements based on repository patterns
    const requirements = {
      audit_logging: false,
      data_retention: false,
      encryption_at_rest: false,
      encryption_in_transit: true,
      access_controls: true
    };

    // Enhanced requirements for enterprise repositories
    if (githubContext.repository?.includes('enterprise') || 
        process.env.RUNNER_ENVIRONMENT === 'github-hosted') {
      requirements.audit_logging = true;
      requirements.data_retention = true;
      requirements.encryption_at_rest = true;
    }

    return requirements;
  }

  detectRunnerMemoryLimit() {
    // GitHub-hosted runners have 7GB RAM
    const os = process.env.RUNNER_OS;
    if (os === 'Linux' || os === 'Windows' || os === 'macOS') {
      return '7GB';
    }
    return '4GB'; // Conservative default
  }

  detectRunnerCPULimit() {
    // GitHub-hosted runners have 2 cores
    return 2;
  }

  detectRunnerCores() {
    return 2; // GitHub-hosted runners
  }

  detectRunnerDiskSpace() {
    // GitHub-hosted runners have 14GB available space
    return '14GB';
  }

  detectNetworkAccess() {
    return {
      internet: true,
      github_api: true,
      external_services: true,
      restricted_domains: []
    };
  }

  detectTimeoutLimit(githubContext) {
    // GitHub Actions jobs timeout after 6 hours by default
    return 21600000; // 6 hours in milliseconds
  }

  detectParallelJobCapability(githubContext) {
    // GitHub allows up to 20 concurrent jobs for free accounts
    return {
      max_parallel_jobs: 20,
      current_job_count: 1,
      matrix_strategy_available: true
    };
  }

  detectMatrixBuild(githubContext) {
    // Detect if this is part of a matrix build
    return {
      is_matrix: !!process.env.MATRIX_OS || !!process.env.MATRIX_NODE_VERSION,
      matrix_variables: this.extractMatrixVariables()
    };
  }

  extractMatrixVariables() {
    const matrixVars = {};
    
    // Extract matrix variables from environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('MATRIX_')) {
        const varName = key.replace('MATRIX_', '').toLowerCase();
        matrixVars[varName] = process.env[key];
      }
    });

    return matrixVars;
  }

  extractPreviousStepsContext() {
    // Extract context from previous steps (if available)
    const context = {
      setup_complete: false,
      dependencies_installed: false,
      tests_run: false,
      build_complete: false
    };

    // This would typically be enhanced with actual step status
    return context;
  }

  estimateRunnerCost(runnerOS) {
    // GitHub Actions pricing (approximate)
    const costPerMinute = {
      'Linux': 0.008,
      'Windows': 0.016,
      'macOS': 0.08
    };

    return costPerMinute[runnerOS] || costPerMinute['Linux'];
  }

  estimateExecutionTime(githubContext) {
    // Estimate based on workflow patterns
    const baseTime = 300000; // 5 minutes base
    
    let multiplier = 1;
    if (githubContext.event_name === 'pull_request') {
      multiplier = 1.5; // PR workflows typically longer
    }
    if (githubContext.ref?.includes('main')) {
      multiplier = 2; // Main branch workflows often more comprehensive
    }

    return baseTime * multiplier;
  }

  generateOptimizationRecommendations() {
    return [
      'Use caching for dependencies to reduce build time',
      'Parallelize independent test suites',
      'Use matrix builds for multi-environment testing',
      'Cache Docker layers for faster builds',
      'Use artifacts for sharing data between jobs'
    ];
  }

  /**
   * Generate fallback context on error
   */
  getFallbackContext(githubContext, error) {
    logger.warn('Using fallback GitHub context due to error:', error.message);

    return {
      github: {
        repository: githubContext.repository || process.env.GITHUB_REPOSITORY || 'unknown/unknown',
        sha: githubContext.sha || process.env.GITHUB_SHA || 'unknown',
        ref: githubContext.ref || process.env.GITHUB_REF || 'refs/heads/main',
        actor: githubContext.actor || process.env.GITHUB_ACTOR || 'unknown',
        event_name: githubContext.event_name || process.env.GITHUB_EVENT_NAME || 'push',
        fallback: true,
        error: error.message
      },
      repository: {
        name: githubContext.repository || 'unknown/unknown',
        clone_url: `https://github.com/${githubContext.repository || 'unknown/unknown'}.git`,
        default_branch: 'main',
        private: false
      },
      workflow: {
        name: 'SWE-Agent Workflow',
        trigger: { event: 'unknown' }
      },
      deployment: {
        mode: 'github_actions',
        capabilities: ['docker'],
        constraints: { timeout_limit: 21600000 }
      },
      security: {
        token_permissions: { contents: 'read' },
        secrets_available: { github_token: true }
      },
      performance: {
        runner_specs: { cores: 2, memory: '7GB' },
        optimization_hints: { cache_available: true }
      },
      metadata: {
        fallback: true,
        error: error.message,
        generated_at: new Date().toISOString()
      }
    };
  }

  /**
   * Generate cache key for context caching
   */
  generateContextCacheKey(githubContext, webhookPayload) {
    const keyData = {
      repository: githubContext.repository,
      sha: githubContext.sha,
      event: githubContext.event_name,
      workflow: githubContext.workflow,
      timestamp: Math.floor(Date.now() / 300000) // 5-minute granularity
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 32);
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.contextCache.clear();
    this.repositoryMetadataCache.clear();
    logger.debug('GitHub context caches cleared');
  }

  /**
   * Get context summary for debugging
   */
  getContextSummary(integratedContext) {
    return {
      repository: {
        name: integratedContext.repository?.name,
        language: integratedContext.repository?.language,
        private: integratedContext.repository?.private
      },
      workflow: {
        name: integratedContext.workflow?.name,
        event: integratedContext.workflow?.trigger?.event,
        runner_os: integratedContext.workflow?.runner?.os
      },
      deployment: {
        mode: integratedContext.deployment?.mode,
        capabilities: integratedContext.deployment?.capabilities
      },
      performance: {
        cores: integratedContext.performance?.runner_specs?.cores,
        memory: integratedContext.performance?.runner_specs?.memory
      }
    };
  }
}

module.exports = GitHubContextIntegrator;