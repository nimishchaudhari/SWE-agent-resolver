/**
 * Docker deployment configuration
 * Optimized for containerized environments
 */

module.exports = {
  // Docker-specific settings
  docker: {
    // Container detection
    isContainer: true,
    containerRuntime: process.env.CONTAINER_RUNTIME || 'docker',
    
    // Resource constraints (from Docker limits)
    memoryLimit: process.env.DOCKER_MEMORY_LIMIT ? parseInt(process.env.DOCKER_MEMORY_LIMIT) : null,
    cpuLimit: process.env.DOCKER_CPU_LIMIT ? parseFloat(process.env.DOCKER_CPU_LIMIT) : null,
    
    // Volume mounts
    volumeMounts: {
      workspace: process.env.DOCKER_WORKSPACE_MOUNT || '/tmp/swe-agent-jobs',
      logs: process.env.DOCKER_LOGS_MOUNT || '/app/logs',
      config: process.env.DOCKER_CONFIG_MOUNT || '/app/config',
    },
    
    // Container networking
    networkMode: process.env.DOCKER_NETWORK_MODE || 'bridge',
    exposedPorts: [3000],
    healthcheck: {
      enabled: true,
      interval: 30000,
      timeout: 10000,
      retries: 3,
    },
  },

  // Server configuration for containerized environment
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: '0.0.0.0', // Bind to all interfaces in container
    cors: {
      enabled: process.env.CORS_ENABLED !== 'false',
      origins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    },
    
    // Container-specific server settings
    keepAliveTimeout: 65000, // Slightly higher than default load balancer timeout
    headersTimeout: 66000,
    enableGracefulShutdown: true,
    shutdownTimeout: 30000,
  },

  // SWE-Agent configuration for Docker
  sweAgent: {
    path: '/usr/local/bin/swe-agent',
    timeout: 300000, // 5 minutes
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 3,
    workspaceDir: '/tmp/swe-agent-jobs',
    configTemplatesDir: './src/swe-agent/templates',
    
    // Docker-specific SWE-Agent settings
    enableContainerIsolation: true,
    useDockerInDocker: process.env.ENABLE_DOCKER_IN_DOCKER === 'true',
    containerUser: 'sweagent',
    securityOpts: ['no-new-privileges:true'],
  },

  // Performance optimizations for Docker
  performance: {
    enableCaching: true,
    cacheTimeout: 300000, // 5 minutes
    enableCompression: process.env.ENABLE_COMPRESSION === 'true',
    compressionLevel: 3, // Lower compression to save CPU in containers
    
    // Container resource management
    memoryLimit: process.env.DOCKER_MEMORY_LIMIT ? parseInt(process.env.DOCKER_MEMORY_LIMIT) * 0.85 : null,
    cpuLimit: process.env.DOCKER_CPU_LIMIT ? parseFloat(process.env.DOCKER_CPU_LIMIT) * 0.9 : null,
    
    // Docker-specific optimizations
    enableLayerCaching: true,
    optimizeForSize: true,
    enableMultiStage: false, // Single stage for runtime
  },

  // Logging configuration for Docker
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json', // Structured logging for container log drivers
    output: 'console', // Docker captures stdout/stderr
    includeTimestamp: true,
    includeHostname: false, // Container hostname not meaningful
    includeProcessId: true,
    
    // Docker-specific logging
    enableDockerLabels: true,
    logToStdout: true,
    enableLogRotation: false, // Let Docker handle log rotation
  },

  // Resource monitoring for containerized environment
  monitoring: {
    enabled: true,
    interval: 5000, // 5 seconds
    thresholds: {
      memory: 80, // Conservative due to container limits
      cpu: 85,
      disk: 90,
    },
    
    // Container-specific monitoring
    trackContainerMetrics: true,
    enableHealthChecks: true,
    monitorVolumes: true,
  },

  // Security settings for Docker
  security: {
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    rateLimitWindow: 900000, // 15 minutes
    rateLimitMax: 100,
    validateWebhooks: process.env.VALIDATE_WEBHOOKS !== 'false',
    
    // Container security
    runAsNonRoot: true,
    readOnlyRootfs: false, // Need write access for temp files
    enableSeccomp: true,
    enableAppArmor: true,
    dropCapabilities: ['ALL'],
    addCapabilities: [], // Minimal capabilities
  },

  // Environment configuration
  env: {
    nodeEnv: process.env.NODE_ENV || 'production',
    isContainer: true,
    containerRuntime: 'docker',
    supportsPersistence: process.env.ENABLE_PERSISTENCE === 'true',
  },

  // Docker deployment specifics
  deployment: {
    mode: 'docker',
    restartPolicy: process.env.RESTART_POLICY || 'unless-stopped',
    enableAutoRestart: true,
    maxRestartAttempts: 5,
    restartDelay: 10000,
    
    // Container lifecycle
    enableGracefulShutdown: true,
    shutdownSignal: 'SIGTERM',
    killTimeout: 30000,
    
    // Health monitoring
    healthcheck: {
      enabled: true,
      path: '/health',
      interval: 30000,
      timeout: 10000,
      unhealthyThreshold: 3,
      healthyThreshold: 2,
    },
  },

  // Volume and storage management
  storage: {
    enablePersistentVolumes: process.env.ENABLE_PERSISTENT_VOLUMES === 'true',
    workspaceVolume: {
      type: 'bind',
      source: process.env.HOST_WORKSPACE_DIR || '/tmp/swe-agent-jobs',
      target: '/tmp/swe-agent-jobs',
      readOnly: false,
    },
    
    logsVolume: {
      type: 'bind',
      source: process.env.HOST_LOGS_DIR || './logs',
      target: '/app/logs',
      readOnly: false,
    },
    
    // Temporary storage
    tmpfsSize: '100m',
    enableTmpfs: true,
  },

  // Network configuration
  networking: {
    mode: process.env.DOCKER_NETWORK_MODE || 'bridge',
    enableIpv6: false,
    dnsServers: process.env.DNS_SERVERS?.split(',') || ['8.8.8.8', '8.8.4.4'],
    
    // Port configuration
    ports: {
      http: 3000,
      health: 3000,
    },
    
    // Load balancer integration
    enableLoadBalancer: process.env.ENABLE_LOAD_BALANCER === 'true',
    loadBalancerHealthCheck: '/health',
  },

  // Resource limits and requests
  resources: {
    limits: {
      memory: process.env.DOCKER_MEMORY_LIMIT || '2G',
      cpu: process.env.DOCKER_CPU_LIMIT || '1.0',
    },
    
    requests: {
      memory: process.env.DOCKER_MEMORY_REQUEST || '512M',
      cpu: process.env.DOCKER_CPU_REQUEST || '0.5',
    },
    
    // Container resource behavior
    enableOOMKill: true,
    swappiness: 10, // Minimize swap usage
  },

  // Docker Compose specific settings
  compose: {
    version: '3.8',
    enableProfiles: true,
    profiles: {
      development: ['dev', 'debug'],
      production: ['prod', 'monitoring'],
    },
    
    // Service dependencies
    dependsOn: process.env.COMPOSE_DEPENDS_ON?.split(',') || [],
    
    // Docker Compose overrides
    enableOverrides: true,
    overrideFiles: [
      'docker-compose.override.yml',
      'docker-compose.local.yml',
    ],
  },
};