const os = require('os');
const fs = require('fs');
const path = require('path');

class DeploymentDetector {
  constructor() {
    this.detectionCache = new Map();
    this.resourceCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Detect the current deployment environment
   * @returns {Object} Deployment context with mode, platform, and capabilities
   */
  detectDeployment() {
    const cacheKey = 'deployment_mode';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const context = {
      mode: this.detectDeploymentMode(),
      platform: this.detectPlatform(),
      containerized: this.isContainerized(),
      resources: this.detectResources(),
      capabilities: this.detectCapabilities(),
      environment: this.detectEnvironmentType()
    };

    this.setCachedResult(cacheKey, context);
    return context;
  }

  /**
   * Detect deployment mode (local, docker, modal, kubernetes, etc.)
   */
  detectDeploymentMode() {
    // Check for Modal environment
    if (process.env.MODAL_ENVIRONMENT || process.env.MODAL_TASK_ID) {
      return 'modal';
    }

    // Check for Kubernetes
    if (process.env.KUBERNETES_SERVICE_HOST || fs.existsSync('/var/run/secrets/kubernetes.io')) {
      return 'kubernetes';
    }

    // Check for Docker
    if (this.isContainerized()) {
      return 'docker';
    }

    // Check for GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      return 'github-actions';
    }

    // Check for AWS Lambda
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return 'aws-lambda';
    }

    // Default to local development
    return 'local';
  }

  /**
   * Detect if running in a containerized environment
   */
  isContainerized() {
    try {
      // Check for Docker-specific files
      return fs.existsSync('/.dockerenv') || 
             fs.existsSync('/proc/1/cgroup') && 
             fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
    } catch {
      return false;
    }
  }

  /**
   * Detect platform details
   */
  detectPlatform() {
    return {
      os: os.platform(),
      arch: os.arch(),
      node: process.version,
      pid: process.pid,
      uptime: process.uptime()
    };
  }

  /**
   * Detect available resources
   */
  detectResources() {
    const cacheKey = 'system_resources';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const resources = {
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown',
        speed: os.cpus()[0]?.speed || 0
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
      },
      disk: this.getDiskSpace(),
      network: os.networkInterfaces()
    };

    this.setCachedResult(cacheKey, resources, 5000); // Cache for 5 seconds
    return resources;
  }

  /**
   * Get disk space information
   */
  getDiskSpace() {
    try {
      const stats = fs.statSync(process.cwd());
      return {
        available: true,
        path: process.cwd(),
        // Note: More detailed disk info would require additional libraries
        writable: fs.constants.W_OK
      };
    } catch {
      return { available: false };
    }
  }

  /**
   * Detect environment capabilities
   */
  detectCapabilities() {
    const capabilities = {
      git: this.hasCommand('git'),
      python: this.hasCommand('python3') || this.hasCommand('python'),
      docker: this.hasCommand('docker'),
      npm: this.hasCommand('npm'),
      curl: this.hasCommand('curl'),
      bash: this.hasCommand('bash'),
      fileSystem: {
        canWrite: this.canWriteToTemp(),
        tempDir: os.tmpdir(),
        workDir: process.cwd()
      }
    };

    return capabilities;
  }

  /**
   * Check if a command is available
   */
  hasCommand(command) {
    try {
      require('child_process').execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if we can write to temp directory
   */
  canWriteToTemp() {
    try {
      const testFile = path.join(os.tmpdir(), `test-${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect environment type (development, staging, production)
   */
  detectEnvironmentType() {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv) return nodeEnv;

    // Infer from other indicators
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      return 'ci';
    }

    if (process.env.VERCEL || process.env.NETLIFY) {
      return 'production';
    }

    return 'development';
  }

  /**
   * Get optimal configuration based on detected environment
   */
  getOptimalConfig() {
    const deployment = this.detectDeployment();
    const baseConfig = {
      maxConcurrentJobs: this.calculateOptimalConcurrency(deployment),
      timeout: this.calculateOptimalTimeout(deployment),
      memoryLimit: this.calculateMemoryLimit(deployment),
      tempDir: this.getOptimalTempDir(deployment)
    };

    return {
      ...baseConfig,
      deployment,
      optimizations: this.getOptimizations(deployment)
    };
  }

  /**
   * Calculate optimal concurrency based on resources
   */
  calculateOptimalConcurrency(deployment) {
    const { cpu, memory } = deployment.resources;
    
    // Base calculation on CPU cores and available memory
    let concurrency = Math.floor(cpu.cores * 0.8); // Leave some headroom
    
    // Adjust based on memory (assume 512MB per job minimum)
    const memoryBasedLimit = Math.floor(memory.free / (512 * 1024 * 1024));
    concurrency = Math.min(concurrency, memoryBasedLimit);

    // Mode-specific adjustments
    switch (deployment.mode) {
      case 'modal':
        return Math.min(concurrency, 10); // Modal handles scaling
      case 'aws-lambda':
        return 1; // Lambda is single-threaded
      case 'local':
        return Math.max(1, Math.min(concurrency, 3)); // Conservative for development
      default:
        return Math.max(1, concurrency);
    }
  }

  /**
   * Calculate optimal timeout based on environment
   */
  calculateOptimalTimeout(deployment) {
    switch (deployment.mode) {
      case 'modal':
        return 600000; // 10 minutes - Modal can handle longer tasks
      case 'aws-lambda':
        return 300000; // 5 minutes - Lambda timeout limit
      case 'github-actions':
        return 300000; // 5 minutes - Reasonable for CI
      case 'local':
        return 180000; // 3 minutes - Faster feedback in development
      default:
        return 300000;
    }
  }

  /**
   * Calculate memory limit based on available resources
   */
  calculateMemoryLimit(deployment) {
    const { memory } = deployment.resources;
    const availableGB = memory.total / (1024 * 1024 * 1024);
    
    // Use up to 70% of available memory
    return Math.floor(availableGB * 0.7 * 1024); // Return in MB
  }

  /**
   * Get optimal temp directory
   */
  getOptimalTempDir(deployment) {
    switch (deployment.mode) {
      case 'modal':
        return '/tmp/modal-swe-agent';
      case 'docker':
        return '/tmp/swe-agent-jobs';
      case 'aws-lambda':
        return '/tmp';
      default:
        return path.join(os.tmpdir(), 'swe-agent-jobs');
    }
  }

  /**
   * Get environment-specific optimizations
   */
  getOptimizations(deployment) {
    const optimizations = {
      caching: true,
      compression: false,
      parallelism: true,
      resourceMonitoring: false
    };

    switch (deployment.mode) {
      case 'modal':
        optimizations.caching = true;
        optimizations.compression = true;
        optimizations.resourceMonitoring = true;
        break;
      case 'aws-lambda':
        optimizations.parallelism = false;
        optimizations.caching = false; // Stateless
        break;
      case 'local':
        optimizations.resourceMonitoring = true;
        break;
    }

    return optimizations;
  }

  /**
   * Cache management
   */
  getCachedResult(key) {
    const cached = this.detectionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedResult(key, data, timeout = this.cacheTimeout) {
    this.detectionCache.set(key, {
      data,
      timestamp: Date.now(),
      timeout
    });
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.detectionCache.clear();
    this.resourceCache.clear();
  }
}

module.exports = DeploymentDetector;