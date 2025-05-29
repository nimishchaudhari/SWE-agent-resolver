/**
 * Modal.com deployment configuration
 * Optimized for serverless GPU/CPU compute environments
 */

module.exports = {
  // Modal-specific settings
  modal: {
    // Modal environment detection
    environment: process.env.MODAL_ENVIRONMENT || 'modal',
    taskId: process.env.MODAL_TASK_ID,
    gpuEnabled: process.env.MODAL_GPU_TYPE !== undefined,
    gpuType: process.env.MODAL_GPU_TYPE || null,
    
    // Resource allocation
    cpu: process.env.MODAL_CPU_COUNT ? parseInt(process.env.MODAL_CPU_COUNT) : 4,
    memory: process.env.MODAL_MEMORY_MB ? parseInt(process.env.MODAL_MEMORY_MB) : 4096,
    disk: process.env.MODAL_DISK_SIZE_GB ? parseInt(process.env.MODAL_DISK_SIZE_GB) : 20,
    
    // Modal-specific optimizations
    enableSharedVolumes: process.env.MODAL_ENABLE_SHARED_VOLUMES !== 'false',
    enableSecrets: process.env.MODAL_ENABLE_SECRETS !== 'false',
    timeoutGrace: 30000, // 30 seconds grace period for cleanup
  },

  // SWE-Agent configuration optimized for Modal
  sweAgent: {
    path: '/usr/local/bin/swe-agent',
    timeout: 600000, // 10 minutes - Modal can handle longer tasks
    maxConcurrentJobs: process.env.MODAL_CPU_COUNT ? Math.min(parseInt(process.env.MODAL_CPU_COUNT), 20) : 10,
    workspaceDir: '/tmp/modal-swe-agent',
    configTemplatesDir: './src/swe-agent/templates',
    
    // Modal-specific SWE-Agent settings
    enableGpuAcceleration: process.env.MODAL_GPU_TYPE !== undefined,
    cacheStrategy: 'aggressive', // Aggressive caching for Modal's ephemeral nature
    parallelization: 'high', // Take advantage of Modal's scaling
  },

  // Performance optimizations for Modal
  performance: {
    enableCaching: true,
    cacheTimeout: 900000, // 15 minutes - longer cache for Modal
    enableCompression: true,
    compressionLevel: 6, // Balance between compression and CPU usage
    memoryLimit: process.env.MODAL_MEMORY_MB ? parseInt(process.env.MODAL_MEMORY_MB) * 0.8 : 3072, // 80% of available
    cpuLimit: process.env.MODAL_CPU_COUNT ? parseInt(process.env.MODAL_CPU_COUNT) * 0.9 : 3.6, // 90% of available
    
    // Modal-specific performance settings
    preloadModules: true, // Preload common modules to reduce cold start time
    enableWarmup: true, // Keep instance warm between requests
    batchOptimization: true, // Optimize for batch processing
  },

  // Logging configuration for Modal
  logging: {
    level: 'info',
    format: 'json', // Structured logging for Modal's log aggregation
    output: 'console', // Modal captures console output
    includeTimestamp: true,
    includeHostname: false, // Not relevant in Modal
    includeProcessId: true,
    
    // Modal-specific logging
    enableModalMetrics: true,
    logResourceUsage: true,
    logGpuUsage: process.env.MODAL_GPU_TYPE !== undefined,
  },

  // Resource monitoring for Modal
  monitoring: {
    enabled: true,
    interval: 10000, // 10 seconds - more frequent monitoring
    thresholds: {
      memory: 85, // Higher threshold due to Modal's resource guarantees
      cpu: 90,
      gpu: process.env.MODAL_GPU_TYPE ? 95 : null,
    },
    
    // Modal-specific monitoring
    trackModalMetrics: true,
    enableAlerts: true,
    autoScale: true, // Enable auto-scaling suggestions
  },

  // Security settings for Modal
  security: {
    enableRateLimit: false, // Modal handles scaling, less need for rate limiting
    validateWebhooks: true,
    secretsPath: process.env.MODAL_SECRETS_PATH || '/secrets',
    enableSecretScanning: true,
    
    // Modal-specific security
    enableModalSecrets: process.env.MODAL_ENABLE_SECRETS !== 'false',
    secretsProvider: 'modal',
  },

  // Modal-specific environment variables
  env: {
    nodeEnv: process.env.NODE_ENV || 'production',
    modalEnvironment: process.env.MODAL_ENVIRONMENT || 'production',
    isModal: true,
    supportParallelExecution: true,
    supportsGpu: process.env.MODAL_GPU_TYPE !== undefined,
  },

  // Modal deployment optimizations
  deployment: {
    mode: 'modal',
    scalingStrategy: 'auto',
    coldStartOptimization: true,
    enablePreloading: true,
    maxInstanceLifetime: 3600000, // 1 hour max instance lifetime
    
    // Resource allocation strategy
    resourceAllocation: {
      strategy: 'dynamic',
      minInstances: 0,
      maxInstances: process.env.MODAL_MAX_INSTANCES ? parseInt(process.env.MODAL_MAX_INSTANCES) : 100,
      scaleUpThreshold: 0.7,
      scaleDownThreshold: 0.3,
    },
  },

  // Modal-specific features
  features: {
    enableSharedStorage: process.env.MODAL_ENABLE_SHARED_VOLUMES !== 'false',
    enableGpuAcceleration: process.env.MODAL_GPU_TYPE !== undefined,
    enableDistributedProcessing: true,
    enableAutoScaling: true,
    enableCostOptimization: true,
    
    // Advanced Modal features
    enableSpotInstances: process.env.MODAL_ENABLE_SPOT !== 'false',
    enablePreemptionHandling: true,
    enableResourcePools: true,
  },

  // Cost optimization for Modal
  costOptimization: {
    enableSpotInstances: process.env.MODAL_ENABLE_SPOT !== 'false',
    maxSpotPrice: process.env.MODAL_MAX_SPOT_PRICE ? parseFloat(process.env.MODAL_MAX_SPOT_PRICE) : null,
    enableIdleShutdown: true,
    idleTimeout: 300000, // 5 minutes idle before shutdown
    
    // Resource usage optimization
    enableResourceSharing: true,
    enableBatchProcessing: true,
    preferColdStarts: false, // Modal handles this efficiently
  },

  // Modal API configuration
  api: {
    endpoint: process.env.MODAL_API_ENDPOINT || 'https://modal.com/api',
    token: process.env.MODAL_TOKEN,
    enableWebhooks: true,
    webhookEndpoint: process.env.MODAL_WEBHOOK_ENDPOINT,
    
    // API optimization
    enableRetries: true,
    maxRetries: 3,
    retryDelay: 1000,
    requestTimeout: 30000,
  },

  // Modal-specific error handling
  errorHandling: {
    enableGracefulShutdown: true,
    shutdownTimeout: 30000,
    enableErrorRecovery: true,
    enablePreemptionHandling: true,
    
    // Modal-specific error scenarios
    handleColdStarts: true,
    handleResourceLimits: true,
    handleSpotTermination: process.env.MODAL_ENABLE_SPOT !== 'false',
  },
};