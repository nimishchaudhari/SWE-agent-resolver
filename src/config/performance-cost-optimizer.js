const logger = require('../utils/logger');

/**
 * Performance and Cost Optimization Controller
 * Manages performance tuning and cost controls for SWE-agent configurations
 */
class PerformanceCostOptimizer {
  constructor() {
    this.optimizationCache = new Map();
    this.costTracker = new Map();
    this.performanceMetrics = new Map();
    
    // Model cost data (per 1K tokens)
    this.modelCosts = {
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
    };

    // Performance profiles for different use cases
    this.performanceProfiles = {
      'development': {
        max_tokens: 4096,
        max_iterations: 20,
        timeout: 300000,
        cost_limit: 2.0,
        memory_limit: '2GB',
        cpu_limit: 1
      },
      'testing': {
        max_tokens: 8192,
        max_iterations: 30,
        timeout: 600000,
        cost_limit: 5.0,
        memory_limit: '4GB',
        cpu_limit: 2
      },
      'production': {
        max_tokens: 16384,
        max_iterations: 50,
        timeout: 1800000,
        cost_limit: 20.0,
        memory_limit: '8GB',
        cpu_limit: 4
      },
      'budget': {
        max_tokens: 2048,
        max_iterations: 15,
        timeout: 180000,
        cost_limit: 1.0,
        memory_limit: '1GB',
        cpu_limit: 1
      },
      'performance': {
        max_tokens: 32768,
        max_iterations: 100,
        timeout: 3600000,
        cost_limit: 50.0,
        memory_limit: '16GB',
        cpu_limit: 8
      }
    };

    // Cost optimization strategies
    this.costOptimizationStrategies = {
      'model_selection': {
        priority: 1,
        description: 'Choose cost-effective model for task complexity',
        implementation: this.optimizeModelSelection.bind(this)
      },
      'token_optimization': {
        priority: 2,
        description: 'Optimize token usage through context management',
        implementation: this.optimizeTokenUsage.bind(this)
      },
      'iteration_limiting': {
        priority: 3,
        description: 'Set appropriate iteration limits',
        implementation: this.optimizeIterations.bind(this)
      },
      'batch_processing': {
        priority: 4,
        description: 'Batch multiple tasks for efficiency',
        implementation: this.optimizeBatchProcessing.bind(this)
      },
      'caching': {
        priority: 5,
        description: 'Cache results to avoid duplicate processing',
        implementation: this.optimizeCaching.bind(this)
      }
    };

    // Performance optimization strategies
    this.performanceOptimizationStrategies = {
      'parallel_processing': {
        priority: 1,
        description: 'Enable parallel task execution',
        implementation: this.optimizeParallelProcessing.bind(this)
      },
      'memory_management': {
        priority: 2,
        description: 'Optimize memory allocation and usage',
        implementation: this.optimizeMemoryManagement.bind(this)
      },
      'resource_allocation': {
        priority: 3,
        description: 'Allocate optimal compute resources',
        implementation: this.optimizeResourceAllocation.bind(this)
      },
      'request_optimization': {
        priority: 4,
        description: 'Optimize API request patterns',
        implementation: this.optimizeRequestPatterns.bind(this)
      },
      'streaming': {
        priority: 5,
        description: 'Use streaming for real-time responses',
        implementation: this.optimizeStreaming.bind(this)
      }
    };
  }

  /**
   * Optimize configuration for performance and cost
   * @param {object} config - SWE-agent configuration
   * @param {object} options - Optimization options
   * @returns {object} Optimized configuration with recommendations
   */
  async optimizeConfiguration(config, options = {}) {
    try {
      const cacheKey = this.generateOptimizationCacheKey(config, options);
      
      // Check cache for recent optimization
      if (this.optimizationCache.has(cacheKey)) {
        const cached = this.optimizationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 600000) { // 10 minute cache
          logger.debug('Using cached optimization result');
          return cached.result;
        }
      }

      // Perform optimization analysis
      const analysis = await this.analyzeConfiguration(config, options);
      const recommendations = await this.generateRecommendations(config, analysis, options);
      const optimizedConfig = await this.applyOptimizations(config, recommendations, options);
      
      const result = {
        original_config: config,
        optimized_config: optimizedConfig,
        analysis,
        recommendations,
        cost_impact: this.calculateCostImpact(config, optimizedConfig),
        performance_impact: this.calculatePerformanceImpact(config, optimizedConfig),
        metadata: {
          optimized_at: new Date().toISOString(),
          optimization_version: '1.0.0',
          applied_strategies: recommendations.applied_strategies,
          estimated_savings: this.calculateEstimatedSavings(config, optimizedConfig)
        }
      };

      // Cache the result
      this.optimizationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      logger.error('Configuration optimization failed:', error);
      return {
        original_config: config,
        optimized_config: config, // Return original if optimization fails
        error: error.message,
        recommendations: { applied_strategies: [], warnings: [error.message] },
        metadata: { optimization_failed: true, error: error.message }
      };
    }
  }

  /**
   * Analyze configuration for optimization opportunities
   */
  async analyzeConfiguration(config, options) {
    const analysis = {
      cost_analysis: await this.analyzeCost(config),
      performance_analysis: await this.analyzePerformance(config),
      resource_analysis: await this.analyzeResourceUsage(config),
      efficiency_analysis: await this.analyzeEfficiency(config),
      bottleneck_analysis: await this.analyzeBottlenecks(config)
    };

    // Calculate overall scores
    analysis.overall_score = this.calculateOverallScore(analysis);
    analysis.optimization_potential = this.calculateOptimizationPotential(analysis);

    return analysis;
  }

  /**
   * Analyze cost implications
   */
  async analyzeCost(config) {
    const modelName = config.agent?.model?.name;
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const maxIterations = config.agent?.max_iterations || 50;
    const costLimit = config.agent?.cost_limit || 10.0;

    const modelCost = this.modelCosts[modelName] || this.modelCosts['claude-3-5-sonnet-20241022'];
    
    // Estimate cost per execution
    const estimatedInputTokens = maxTokens * 0.7; // Assume 70% input
    const estimatedOutputTokens = maxTokens * 0.3; // Assume 30% output
    
    const costPerIteration = 
      (estimatedInputTokens / 1000) * modelCost.input +
      (estimatedOutputTokens / 1000) * modelCost.output;
    
    const totalEstimatedCost = costPerIteration * maxIterations;

    return {
      model_cost_per_1k_tokens: modelCost,
      estimated_cost_per_iteration: costPerIteration,
      total_estimated_cost: totalEstimatedCost,
      cost_limit: costLimit,
      cost_efficiency: costLimit > 0 ? (totalEstimatedCost / costLimit) : 1,
      cost_risk: totalEstimatedCost > costLimit ? 'high' : 
                 totalEstimatedCost > costLimit * 0.8 ? 'medium' : 'low',
      optimization_opportunity: this.calculateCostOptimizationOpportunity(totalEstimatedCost, costLimit)
    };
  }

  /**
   * Analyze performance characteristics
   */
  async analyzePerformance(config) {
    const modelTimeout = config.agent?.model?.timeout || 300000;
    const maxIterations = config.agent?.max_iterations || 50;
    const memoryLimit = config.env?.docker?.memory_limit || config.env?.modal?.memory_mb || '4GB';
    const cpuLimit = config.env?.docker?.cpu_limit || config.env?.modal?.cpu_count || 2;

    // Parse memory limit
    const memoryMB = this.parseMemoryToMB(memoryLimit);

    // Estimate execution time
    const estimatedTimePerIteration = modelTimeout * 0.6; // Assume 60% of timeout used
    const totalEstimatedTime = estimatedTimePerIteration * maxIterations;

    return {
      timeout_per_iteration: modelTimeout,
      max_iterations: maxIterations,
      estimated_time_per_iteration: estimatedTimePerIteration,
      total_estimated_time: totalEstimatedTime,
      memory_allocation_mb: memoryMB,
      cpu_allocation: cpuLimit,
      performance_efficiency: this.calculatePerformanceEfficiency(config),
      bottlenecks: this.identifyPerformanceBottlenecks(config),
      scalability_score: this.calculateScalabilityScore(config)
    };
  }

  /**
   * Analyze resource usage patterns
   */
  async analyzeResourceUsage(config) {
    const memoryLimit = config.env?.docker?.memory_limit || config.env?.modal?.memory_mb || '4GB';
    const cpuLimit = config.env?.docker?.cpu_limit || config.env?.modal?.cpu_count || 2;
    const deploymentMode = config.env?.docker ? 'docker' : 
                          config.env?.modal ? 'modal' : 'local';

    const memoryMB = this.parseMemoryToMB(memoryLimit);

    return {
      deployment_mode: deploymentMode,
      memory_allocation: {
        allocated_mb: memoryMB,
        efficiency_score: this.calculateMemoryEfficiency(memoryMB, config),
        optimization_potential: this.calculateMemoryOptimizationPotential(memoryMB)
      },
      cpu_allocation: {
        allocated_cores: cpuLimit,
        efficiency_score: this.calculateCPUEfficiency(cpuLimit, config),
        optimization_potential: this.calculateCPUOptimizationPotential(cpuLimit)
      },
      storage_requirements: this.analyzeStorageRequirements(config),
      network_usage: this.analyzeNetworkUsage(config)
    };
  }

  /**
   * Analyze overall efficiency
   */
  async analyzeEfficiency(config) {
    const toolsCount = config.agent?.tools?.length || 0;
    const historyWindowSize = config.agent?.history_processor?.window_size || 4000;
    const compressionEnabled = config.agent?.history_processor?.compression || false;

    return {
      tool_utilization: {
        tools_configured: toolsCount,
        efficiency_score: this.calculateToolEfficiency(config.agent?.tools || []),
        optimization_suggestions: this.generateToolOptimizationSuggestions(config.agent?.tools || [])
      },
      context_management: {
        history_window_size: historyWindowSize,
        compression_enabled: compressionEnabled,
        efficiency_score: this.calculateContextEfficiency(historyWindowSize, compressionEnabled),
        optimization_potential: this.calculateContextOptimizationPotential(config)
      },
      parser_efficiency: {
        parser_type: config.agent?.parser?.name,
        function_calling: config.agent?.parser?.function_calling,
        efficiency_score: this.calculateParserEfficiency(config.agent?.parser)
      }
    };
  }

  /**
   * Identify bottlenecks
   */
  async analyzeBottlenecks(config) {
    const bottlenecks = [];

    // Check for potential bottlenecks
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const historySize = config.agent?.history_processor?.window_size || 4000;
    
    if (historySize > maxTokens * 0.8) {
      bottlenecks.push({
        type: 'context_overflow',
        severity: 'high',
        description: 'History window size may cause context overflow',
        impact: 'performance'
      });
    }

    const memoryLimit = this.parseMemoryToMB(config.env?.docker?.memory_limit || '4GB');
    if (memoryLimit < 2048) {
      bottlenecks.push({
        type: 'memory_constraint',
        severity: 'medium',
        description: 'Low memory allocation may impact performance',
        impact: 'performance'
      });
    }

    const totalTimeout = (config.agent?.model?.timeout || 300000) * (config.agent?.max_iterations || 50);
    if (totalTimeout > 3600000) { // 1 hour
      bottlenecks.push({
        type: 'timeout_risk',
        severity: 'medium',
        description: 'Long execution time may hit platform limits',
        impact: 'reliability'
      });
    }

    return {
      identified_bottlenecks: bottlenecks,
      bottleneck_count: bottlenecks.length,
      severity_distribution: this.calculateSeverityDistribution(bottlenecks),
      resolution_priority: this.prioritizeBottleneckResolution(bottlenecks)
    };
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(config, analysis, options) {
    const recommendations = {
      cost_optimizations: [],
      performance_optimizations: [],
      resource_optimizations: [],
      applied_strategies: [],
      warnings: []
    };

    // Apply cost optimization strategies
    for (const [name, strategy] of Object.entries(this.costOptimizationStrategies)) {
      if (this.shouldApplyStrategy(name, analysis, options)) {
        try {
          const result = await strategy.implementation(config, analysis, options);
          if (result.applicable) {
            recommendations.cost_optimizations.push({
              strategy: name,
              description: strategy.description,
              priority: strategy.priority,
              ...result
            });
          }
        } catch (error) {
          recommendations.warnings.push(`Cost optimization '${name}' failed: ${error.message}`);
        }
      }
    }

    // Apply performance optimization strategies
    for (const [name, strategy] of Object.entries(this.performanceOptimizationStrategies)) {
      if (this.shouldApplyStrategy(name, analysis, options)) {
        try {
          const result = await strategy.implementation(config, analysis, options);
          if (result.applicable) {
            recommendations.performance_optimizations.push({
              strategy: name,
              description: strategy.description,
              priority: strategy.priority,
              ...result
            });
          }
        } catch (error) {
          recommendations.warnings.push(`Performance optimization '${name}' failed: ${error.message}`);
        }
      }
    }

    // Sort by priority
    recommendations.cost_optimizations.sort((a, b) => a.priority - b.priority);
    recommendations.performance_optimizations.sort((a, b) => a.priority - b.priority);

    return recommendations;
  }

  /**
   * Apply optimizations to configuration
   */
  async applyOptimizations(config, recommendations, options) {
    const optimizedConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    // Apply cost optimizations
    for (const optimization of recommendations.cost_optimizations) {
      if (optimization.auto_apply !== false && options.applyCostOptimizations !== false) {
        this.applyOptimization(optimizedConfig, optimization);
        recommendations.applied_strategies.push(optimization.strategy);
      }
    }

    // Apply performance optimizations
    for (const optimization of recommendations.performance_optimizations) {
      if (optimization.auto_apply !== false && options.applyPerformanceOptimizations !== false) {
        this.applyOptimization(optimizedConfig, optimization);
        recommendations.applied_strategies.push(optimization.strategy);
      }
    }

    // Apply resource optimizations
    if (recommendations.resource_optimizations) {
      for (const optimization of recommendations.resource_optimizations) {
        if (optimization.auto_apply !== false && options.applyResourceOptimizations !== false) {
          this.applyOptimization(optimizedConfig, optimization);
          recommendations.applied_strategies.push(optimization.strategy);
        }
      }
    }

    return optimizedConfig;
  }

  /**
   * Optimization strategy implementations
   */
  async optimizeModelSelection(config, analysis, options) {
    const currentModel = config.agent?.model?.name;
    const currentCost = analysis.cost_analysis?.total_estimated_cost || 0;
    const costLimit = config.agent?.cost_limit || 10.0;

    // Suggest cheaper models if cost is high
    if (currentCost > costLimit * 0.8) {
      const cheaperModels = this.findCheaperModels(currentModel, costLimit);
      if (cheaperModels.length > 0) {
        return {
          applicable: true,
          auto_apply: false, // Model selection should be manual
          changes: {
            'agent.model.name': cheaperModels[0],
            'agent.model.provider': this.getModelProvider(cheaperModels[0])
          },
          estimated_savings: currentCost - this.estimateModelCost(cheaperModels[0], config),
          alternatives: cheaperModels,
          reasoning: `Current model may exceed cost limit. Consider ${cheaperModels[0]} for cost efficiency.`
        };
      }
    }

    return { applicable: false };
  }

  async optimizeTokenUsage(config, analysis, options) {
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const historySize = config.agent?.history_processor?.window_size || 4000;
    
    const changes = {};
    let savings = 0;

    // Optimize token allocation
    if (maxTokens > 16384 && !options.requireHighTokens) {
      const newTokens = Math.min(16384, maxTokens);
      changes['agent.model.max_tokens'] = newTokens;
      savings += this.calculateTokenSavings(maxTokens, newTokens, config);
    }

    // Optimize history window
    if (historySize > maxTokens * 0.5) {
      const newHistorySize = Math.floor(maxTokens * 0.4);
      changes['agent.history_processor.window_size'] = newHistorySize;
    }

    // Enable compression if not already enabled
    if (!config.agent?.history_processor?.compression && historySize > 2000) {
      changes['agent.history_processor.compression'] = true;
    }

    return {
      applicable: Object.keys(changes).length > 0,
      auto_apply: true,
      changes,
      estimated_savings: savings,
      reasoning: 'Optimized token usage to reduce costs while maintaining functionality'
    };
  }

  async optimizeIterations(config, analysis, options) {
    const maxIterations = config.agent?.max_iterations || 50;
    const estimatedTime = analysis.performance_analysis?.total_estimated_time || 0;
    
    const changes = {};

    // Reduce iterations if execution time is too long
    if (estimatedTime > 3600000 && maxIterations > 30) { // 1 hour
      const newIterations = Math.max(30, Math.floor(maxIterations * 0.7));
      changes['agent.max_iterations'] = newIterations;
      
      return {
        applicable: true,
        auto_apply: true,
        changes,
        estimated_savings: this.calculateIterationSavings(maxIterations, newIterations, config),
        reasoning: 'Reduced iterations to prevent timeout while maintaining effectiveness'
      };
    }

    return { applicable: false };
  }

  async optimizeBatchProcessing(config, analysis, options) {
    // This would implement batch processing optimizations
    // For now, return a placeholder implementation
    return {
      applicable: false,
      reasoning: 'Batch processing optimization not applicable for single-task configuration'
    };
  }

  async optimizeCaching(config, analysis, options) {
    const changes = {};

    // Enable result caching if not already enabled
    if (!config.caching?.enabled) {
      changes['caching.enabled'] = true;
      changes['caching.ttl'] = 3600000; // 1 hour
      changes['caching.max_entries'] = 100;
    }

    return {
      applicable: Object.keys(changes).length > 0,
      auto_apply: true,
      changes,
      estimated_savings: 0.1, // 10% estimated savings from caching
      reasoning: 'Enabled caching to avoid duplicate computations'
    };
  }

  async optimizeParallelProcessing(config, analysis, options) {
    const deploymentMode = config.env?.docker ? 'docker' : 
                          config.env?.modal ? 'modal' : 'local';
    const cpuLimit = config.env?.docker?.cpu_limit || config.env?.modal?.cpu_count || 2;

    const changes = {};

    // Enable parallel processing for multi-core environments
    if (cpuLimit > 1 && !config.parallel_processing?.enabled) {
      changes['parallel_processing.enabled'] = true;
      changes['parallel_processing.max_workers'] = Math.min(cpuLimit, 4);
      changes['parallel_processing.chunk_size'] = 10;
    }

    return {
      applicable: Object.keys(changes).length > 0,
      auto_apply: true,
      changes,
      performance_improvement: `${Math.min(cpuLimit, 4)}x potential speedup`,
      reasoning: 'Enabled parallel processing to utilize available CPU cores'
    };
  }

  async optimizeMemoryManagement(config, analysis, options) {
    const memoryMB = analysis.resource_analysis?.memory_allocation?.allocated_mb || 4096;
    const changes = {};

    // Optimize memory allocation
    if (memoryMB > 8192) {
      changes['env.docker.memory_limit'] = '8GB';
      changes['env.modal.memory_mb'] = 8192;
    } else if (memoryMB < 2048) {
      changes['env.docker.memory_limit'] = '2GB';
      changes['env.modal.memory_mb'] = 2048;
    }

    // Add memory management settings
    if (!config.memory_management) {
      changes['memory_management.gc_enabled'] = true;
      changes['memory_management.max_heap_size'] = Math.floor(memoryMB * 0.8);
    }

    return {
      applicable: Object.keys(changes).length > 0,
      auto_apply: true,
      changes,
      reasoning: 'Optimized memory allocation for efficient resource usage'
    };
  }

  async optimizeResourceAllocation(config, analysis, options) {
    const cpuLimit = config.env?.docker?.cpu_limit || config.env?.modal?.cpu_count || 2;
    const memoryMB = analysis.resource_analysis?.memory_allocation?.allocated_mb || 4096;

    const changes = {};

    // Balance CPU and memory allocation
    const optimalCPU = this.calculateOptimalCPU(memoryMB);
    if (Math.abs(cpuLimit - optimalCPU) > 1) {
      changes['env.docker.cpu_limit'] = optimalCPU;
      changes['env.modal.cpu_count'] = optimalCPU;
    }

    return {
      applicable: Object.keys(changes).length > 0,
      auto_apply: true,
      changes,
      reasoning: 'Balanced CPU and memory allocation for optimal performance'
    };
  }

  async optimizeRequestPatterns(config, analysis, options) {
    const changes = {};

    // Add request batching and retry logic
    if (!config.request_optimization) {
      changes['request_optimization.batch_size'] = 5;
      changes['request_optimization.retry_attempts'] = 3;
      changes['request_optimization.exponential_backoff'] = true;
      changes['request_optimization.connection_pooling'] = true;
    }

    return {
      applicable: Object.keys(changes).length > 0,
      auto_apply: true,
      changes,
      reasoning: 'Optimized API request patterns for better reliability and performance'
    };
  }

  async optimizeStreaming(config, analysis, options) {
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const changes = {};

    // Enable streaming for large responses
    if (maxTokens > 4096 && !config.streaming?.enabled) {
      changes['streaming.enabled'] = true;
      changes['streaming.chunk_size'] = 512;
      changes['streaming.buffer_size'] = 2048;
    }

    return {
      applicable: Object.keys(changes).length > 0,
      auto_apply: true,
      changes,
      reasoning: 'Enabled streaming for better responsiveness with large outputs'
    };
  }

  /**
   * Utility methods
   */
  calculateOverallScore(analysis) {
    const costScore = 1 - Math.min(1, analysis.cost_analysis?.cost_efficiency || 0);
    const performanceScore = analysis.performance_analysis?.performance_efficiency || 0.5;
    const resourceScore = (analysis.resource_analysis?.memory_allocation?.efficiency_score || 0.5 +
                          analysis.resource_analysis?.cpu_allocation?.efficiency_score || 0.5) / 2;
    
    return (costScore + performanceScore + resourceScore) / 3;
  }

  calculateOptimizationPotential(analysis) {
    const bottleneckCount = analysis.bottleneck_analysis?.bottleneck_count || 0;
    const efficiencyScore = analysis.efficiency_analysis?.tool_utilization?.efficiency_score || 0.5;
    
    return Math.min(1, (bottleneckCount * 0.2) + (1 - efficiencyScore));
  }

  calculateCostOptimizationOpportunity(estimatedCost, costLimit) {
    if (costLimit <= 0) return 0;
    return Math.max(0, (estimatedCost - costLimit) / costLimit);
  }

  calculatePerformanceEfficiency(config) {
    // Simplified performance efficiency calculation
    const memoryMB = this.parseMemoryToMB(config.env?.docker?.memory_limit || '4GB');
    const cpuLimit = config.env?.docker?.cpu_limit || 2;
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    
    // Higher is better, normalized to 0-1
    return Math.min(1, (memoryMB / 8192) * 0.3 + (cpuLimit / 4) * 0.3 + (maxTokens / 16384) * 0.4);
  }

  identifyPerformanceBottlenecks(config) {
    const bottlenecks = [];
    
    const memoryMB = this.parseMemoryToMB(config.env?.docker?.memory_limit || '4GB');
    if (memoryMB < 2048) {
      bottlenecks.push('low_memory');
    }
    
    const cpuLimit = config.env?.docker?.cpu_limit || 2;
    if (cpuLimit < 2) {
      bottlenecks.push('low_cpu');
    }
    
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const historySize = config.agent?.history_processor?.window_size || 4000;
    if (historySize > maxTokens * 0.8) {
      bottlenecks.push('context_overflow_risk');
    }
    
    return bottlenecks;
  }

  calculateScalabilityScore(config) {
    // Simplified scalability score based on resource allocation and configuration
    const memoryMB = this.parseMemoryToMB(config.env?.docker?.memory_limit || '4GB');
    const cpuLimit = config.env?.docker?.cpu_limit || 2;
    const parallelEnabled = config.parallel_processing?.enabled || false;
    
    let score = 0.5; // Base score
    
    if (memoryMB >= 4096) score += 0.2;
    if (cpuLimit >= 2) score += 0.2;
    if (parallelEnabled) score += 0.1;
    
    return Math.min(1, score);
  }

  parseMemoryToMB(memoryString) {
    if (typeof memoryString === 'number') return memoryString;
    
    const match = memoryString.toString().match(/^(\d+)(GB|MB)$/);
    if (!match) return 4096; // Default 4GB
    
    const [, amount, unit] = match;
    return unit === 'GB' ? parseInt(amount) * 1024 : parseInt(amount);
  }

  calculateMemoryEfficiency(memoryMB, config) {
    // Calculate efficiency based on expected usage
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const expectedMemoryUsage = Math.max(1024, maxTokens * 0.1); // Rough estimate
    
    return Math.min(1, expectedMemoryUsage / memoryMB);
  }

  calculateMemoryOptimizationPotential(memoryMB) {
    if (memoryMB > 16384) return 0.8; // High optimization potential
    if (memoryMB > 8192) return 0.4;   // Medium optimization potential
    if (memoryMB < 1024) return 0.6;   // Low memory needs optimization
    return 0.2; // Low optimization potential
  }

  calculateCPUEfficiency(cpuLimit, config) {
    // LLM workloads are typically not CPU-intensive
    const optimalCPU = Math.min(4, Math.max(1, Math.ceil(cpuLimit / 2)));
    return Math.min(1, optimalCPU / cpuLimit);
  }

  calculateCPUOptimizationPotential(cpuLimit) {
    if (cpuLimit > 8) return 0.7; // High optimization potential
    if (cpuLimit > 4) return 0.3; // Medium optimization potential
    return 0.1; // Low optimization potential
  }

  analyzeStorageRequirements(config) {
    const workspacePath = config.env?.workspace?.mount_path;
    const persistentWorkspace = config.env?.workspace?.persistent || false;
    
    return {
      workspace_path: workspacePath,
      persistent: persistentWorkspace,
      estimated_usage: '1GB', // Conservative estimate
      optimization_potential: persistentWorkspace ? 0.2 : 0.1
    };
  }

  analyzeNetworkUsage(config) {
    const modelProvider = config.agent?.model?.provider;
    const tools = config.agent?.tools || [];
    
    const networkIntensiveTools = tools.filter(tool => 
      ['bash', 'git', 'curl', 'wget'].includes(tool.name)).length;
    
    return {
      api_calls: modelProvider !== 'local',
      network_intensive_tools: networkIntensiveTools,
      optimization_potential: networkIntensiveTools > 0 ? 0.3 : 0.1
    };
  }

  calculateToolEfficiency(tools) {
    if (tools.length === 0) return 0;
    
    const essentialTools = ['str_replace_editor', 'bash', 'file_viewer'];
    const hasEssentialTools = essentialTools.every(tool => 
      tools.some(t => t.name === tool));
    
    const redundantTools = tools.length > 6; // More than 6 tools might be redundant
    
    let score = 0.5;
    if (hasEssentialTools) score += 0.3;
    if (!redundantTools) score += 0.2;
    
    return Math.min(1, score);
  }

  generateToolOptimizationSuggestions(tools) {
    const suggestions = [];
    
    const essentialTools = ['str_replace_editor', 'bash', 'file_viewer'];
    const missingEssential = essentialTools.filter(tool => 
      !tools.some(t => t.name === tool));
    
    if (missingEssential.length > 0) {
      suggestions.push(`Add essential tools: ${missingEssential.join(', ')}`);
    }
    
    if (tools.length > 6) {
      suggestions.push('Consider reducing the number of tools to improve focus');
    }
    
    return suggestions;
  }

  calculateContextEfficiency(historySize, compression) {
    let score = 0.5;
    
    if (historySize <= 4000) score += 0.2;
    if (historySize <= 2000) score += 0.1;
    if (compression) score += 0.2;
    
    return Math.min(1, score);
  }

  calculateContextOptimizationPotential(config) {
    const historySize = config.agent?.history_processor?.window_size || 4000;
    const compression = config.agent?.history_processor?.compression || false;
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    
    let potential = 0;
    
    if (historySize > maxTokens * 0.5) potential += 0.4;
    if (!compression && historySize > 2000) potential += 0.3;
    if (historySize > 8000) potential += 0.3;
    
    return Math.min(1, potential);
  }

  calculateParserEfficiency(parser) {
    if (!parser) return 0.5;
    
    const parserName = parser.name;
    const functionCalling = parser.function_calling;
    
    // ToolCallingParser with function calling is most efficient
    if (parserName === 'ToolCallingParser' && functionCalling) {
      return 0.9;
    }
    
    // ThoughtActionParser is good for non-function-calling models
    if (parserName === 'ThoughtActionParser' && !functionCalling) {
      return 0.8;
    }
    
    return 0.6; // Default efficiency
  }

  calculateSeverityDistribution(bottlenecks) {
    const distribution = { high: 0, medium: 0, low: 0 };
    
    bottlenecks.forEach(bottleneck => {
      distribution[bottleneck.severity] += 1;
    });
    
    return distribution;
  }

  prioritizeBottleneckResolution(bottlenecks) {
    return bottlenecks
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .map(bottleneck => ({
        type: bottleneck.type,
        priority: bottleneck.severity,
        recommendation: this.getBottleneckResolutionRecommendation(bottleneck)
      }));
  }

  getBottleneckResolutionRecommendation(bottleneck) {
    const recommendations = {
      'context_overflow': 'Reduce history window size or enable compression',
      'memory_constraint': 'Increase memory allocation to at least 2GB',
      'timeout_risk': 'Reduce max iterations or increase individual timeouts'
    };
    
    return recommendations[bottleneck.type] || 'Review configuration settings';
  }

  shouldApplyStrategy(strategyName, analysis, options) {
    // Check if strategy should be applied based on analysis and options
    const optimizationMode = options.optimizationMode || 'balanced';
    
    switch (optimizationMode) {
      case 'aggressive':
        return true;
      case 'conservative':
        return analysis.optimization_potential > 0.5;
      case 'cost_focused':
        return strategyName.includes('cost') || analysis.cost_analysis?.cost_risk === 'high';
      case 'performance_focused':
        return strategyName.includes('performance') || analysis.performance_analysis?.performance_efficiency < 0.5;
      default: // balanced
        return analysis.optimization_potential > 0.3;
    }
  }

  applyOptimization(config, optimization) {
    // Apply the optimization changes to the configuration
    for (const [path, value] of Object.entries(optimization.changes || {})) {
      this.setNestedValue(config, path, value);
    }
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  calculateCostImpact(originalConfig, optimizedConfig) {
    const originalCost = this.estimateConfigurationCost(originalConfig);
    const optimizedCost = this.estimateConfigurationCost(optimizedConfig);
    
    return {
      original_cost: originalCost,
      optimized_cost: optimizedCost,
      absolute_savings: originalCost - optimizedCost,
      percentage_savings: originalCost > 0 ? ((originalCost - optimizedCost) / originalCost) * 100 : 0
    };
  }

  calculatePerformanceImpact(originalConfig, optimizedConfig) {
    const originalPerf = this.calculatePerformanceEfficiency(originalConfig);
    const optimizedPerf = this.calculatePerformanceEfficiency(optimizedConfig);
    
    return {
      original_efficiency: originalPerf,
      optimized_efficiency: optimizedPerf,
      efficiency_improvement: optimizedPerf - originalPerf,
      percentage_improvement: originalPerf > 0 ? ((optimizedPerf - originalPerf) / originalPerf) * 100 : 0
    };
  }

  estimateConfigurationCost(config) {
    const modelName = config.agent?.model?.name || 'claude-3-5-sonnet-20241022';
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const maxIterations = config.agent?.max_iterations || 50;
    
    const modelCost = this.modelCosts[modelName] || this.modelCosts['claude-3-5-sonnet-20241022'];
    const costPerIteration = ((maxTokens * 0.7) / 1000) * modelCost.input + 
                            ((maxTokens * 0.3) / 1000) * modelCost.output;
    
    return costPerIteration * maxIterations;
  }

  calculateEstimatedSavings(originalConfig, optimizedConfig) {
    const costImpact = this.calculateCostImpact(originalConfig, optimizedConfig);
    const performanceImpact = this.calculatePerformanceImpact(originalConfig, optimizedConfig);
    
    return {
      cost_savings: costImpact.absolute_savings,
      performance_improvement: performanceImpact.efficiency_improvement,
      total_value: costImpact.absolute_savings + (performanceImpact.efficiency_improvement * 10) // Rough value calculation
    };
  }

  findCheaperModels(currentModel, costLimit) {
    // Return models that are cheaper than the current model
    const currentCost = this.modelCosts[currentModel];
    if (!currentCost) return [];
    
    const cheaperModels = [];
    for (const [model, cost] of Object.entries(this.modelCosts)) {
      if (cost.input < currentCost.input && cost.output < currentCost.output) {
        cheaperModels.push(model);
      }
    }
    
    return cheaperModels.sort((a, b) => {
      const aCost = this.modelCosts[a];
      const bCost = this.modelCosts[b];
      return (aCost.input + aCost.output) - (bCost.input + bCost.output);
    });
  }

  getModelProvider(modelName) {
    if (modelName.includes('claude')) return 'anthropic';
    if (modelName.includes('gpt')) return 'openai';
    return 'anthropic'; // Default
  }

  estimateModelCost(modelName, config) {
    const maxTokens = config.agent?.model?.max_tokens || 8192;
    const maxIterations = config.agent?.max_iterations || 50;
    
    const modelCost = this.modelCosts[modelName] || this.modelCosts['claude-3-5-sonnet-20241022'];
    const costPerIteration = ((maxTokens * 0.7) / 1000) * modelCost.input + 
                            ((maxTokens * 0.3) / 1000) * modelCost.output;
    
    return costPerIteration * maxIterations;
  }

  calculateTokenSavings(oldTokens, newTokens, config) {
    const oldCost = this.estimateModelCost(config.agent?.model?.name, { 
      ...config, 
      agent: { ...config.agent, model: { ...config.agent.model, max_tokens: oldTokens } } 
    });
    const newCost = this.estimateModelCost(config.agent?.model?.name, { 
      ...config, 
      agent: { ...config.agent, model: { ...config.agent.model, max_tokens: newTokens } } 
    });
    
    return oldCost - newCost;
  }

  calculateIterationSavings(oldIterations, newIterations, config) {
    const oldCost = this.estimateModelCost(config.agent?.model?.name, { 
      ...config, 
      agent: { ...config.agent, max_iterations: oldIterations } 
    });
    const newCost = this.estimateModelCost(config.agent?.model?.name, { 
      ...config, 
      agent: { ...config.agent, max_iterations: newIterations } 
    });
    
    return oldCost - newCost;
  }

  calculateOptimalCPU(memoryMB) {
    // Rule of thumb: 1 CPU core per 2GB of memory for LLM workloads
    return Math.max(1, Math.min(8, Math.ceil(memoryMB / 2048)));
  }

  generateOptimizationCacheKey(config, options) {
    const key = JSON.stringify({
      config_hash: this.hashObject(config),
      options_hash: this.hashObject(options),
      timestamp: Math.floor(Date.now() / 600000) // 10-minute granularity
    });
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  hashObject(obj) {
    return JSON.stringify(obj).split('').reduce((hash, char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      return hash & hash; // Convert to 32-bit integer
    }, 0);
  }

  clearCaches() {
    this.optimizationCache.clear();
    this.costTracker.clear();
    this.performanceMetrics.clear();
    logger.debug('Performance and cost optimization caches cleared');
  }

  /**
   * Apply performance profile
   */
  applyPerformanceProfile(config, profileName) {
    const profile = this.performanceProfiles[profileName];
    if (!profile) {
      throw new Error(`Unknown performance profile: ${profileName}`);
    }

    const optimizedConfig = JSON.parse(JSON.stringify(config));

    // Apply profile settings
    this.setNestedValue(optimizedConfig, 'agent.model.max_tokens', profile.max_tokens);
    this.setNestedValue(optimizedConfig, 'agent.max_iterations', profile.max_iterations);
    this.setNestedValue(optimizedConfig, 'agent.model.timeout', profile.timeout);
    this.setNestedValue(optimizedConfig, 'agent.cost_limit', profile.cost_limit);
    this.setNestedValue(optimizedConfig, 'env.docker.memory_limit', profile.memory_limit);
    this.setNestedValue(optimizedConfig, 'env.docker.cpu_limit', profile.cpu_limit);
    this.setNestedValue(optimizedConfig, 'env.modal.memory_mb', this.parseMemoryToMB(profile.memory_limit));
    this.setNestedValue(optimizedConfig, 'env.modal.cpu_count', profile.cpu_limit);

    return {
      optimized_config: optimizedConfig,
      profile_applied: profileName,
      profile_settings: profile,
      metadata: {
        applied_at: new Date().toISOString(),
        profile_version: '1.0.0'
      }
    };
  }
}

module.exports = PerformanceCostOptimizer;