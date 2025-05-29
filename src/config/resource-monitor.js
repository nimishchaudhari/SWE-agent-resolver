const os = require('os');
const EventEmitter = require('events');

class ResourceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.interval = options.interval || 5000; // 5 seconds default
    this.enabled = options.enabled !== false;
    this.thresholds = {
      memory: options.memoryThreshold || 80, // 80% memory usage
      cpu: options.cpuThreshold || 90, // 90% CPU usage
      ...options.thresholds
    };
    
    this.metrics = {
      memory: [],
      cpu: [],
      timestamp: Date.now()
    };
    
    this.maxHistoryLength = options.maxHistoryLength || 100;
    this.intervalId = null;
    this.cpuUsage = process.cpuUsage();
    this.lastCpuCheck = Date.now();
  }

  /**
   * Start monitoring system resources
   */
  start() {
    if (!this.enabled || this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.interval);

    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.emit('stopped');
    }
  }

  /**
   * Collect current system metrics
   */
  collectMetrics() {
    const timestamp = Date.now();
    
    // Memory metrics
    const memoryUsage = this.getMemoryUsage();
    this.metrics.memory.push({ ...memoryUsage, timestamp });
    
    // CPU metrics
    const cpuUsage = this.getCpuUsage();
    this.metrics.cpu.push({ ...cpuUsage, timestamp });
    
    // Trim history
    this.trimHistory();
    
    // Check thresholds
    this.checkThresholds(memoryUsage, cpuUsage);
    
    // Emit metrics event
    this.emit('metrics', {
      memory: memoryUsage,
      cpu: cpuUsage,
      timestamp
    });
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const processUsage = process.memoryUsage();
    
    return {
      system: {
        total: total,
        free: free,
        used: used,
        percentage: Math.round((used / total) * 100)
      },
      process: {
        rss: processUsage.rss,
        heapTotal: processUsage.heapTotal,
        heapUsed: processUsage.heapUsed,
        external: processUsage.external,
        arrayBuffers: processUsage.arrayBuffers
      },
      percentage: Math.round((used / total) * 100)
    };
  }

  /**
   * Get CPU usage information
   */
  getCpuUsage() {
    const currentUsage = process.cpuUsage(this.cpuUsage);
    const currentTime = Date.now();
    const timeDiff = currentTime - this.lastCpuCheck;
    
    // Calculate CPU percentage
    const userPercent = (currentUsage.user / 1000) / timeDiff * 100;
    const systemPercent = (currentUsage.system / 1000) / timeDiff * 100;
    const totalPercent = userPercent + systemPercent;
    
    // Update for next calculation
    this.cpuUsage = process.cpuUsage();
    this.lastCpuCheck = currentTime;
    
    // Get system load averages
    const loadAverage = os.loadavg();
    
    return {
      process: {
        user: userPercent,
        system: systemPercent,
        total: totalPercent
      },
      system: {
        loadAverage: loadAverage,
        cores: os.cpus().length
      },
      percentage: Math.min(totalPercent, 100) // Cap at 100%
    };
  }

  /**
   * Trim history to maintain max length
   */
  trimHistory() {
    if (this.metrics.memory.length > this.maxHistoryLength) {
      this.metrics.memory = this.metrics.memory.slice(-this.maxHistoryLength);
    }
    if (this.metrics.cpu.length > this.maxHistoryLength) {
      this.metrics.cpu = this.metrics.cpu.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Check if any thresholds are exceeded
   */
  checkThresholds(memoryUsage, cpuUsage) {
    // Memory threshold check
    if (memoryUsage.percentage > this.thresholds.memory) {
      this.emit('threshold:memory', {
        current: memoryUsage.percentage,
        threshold: this.thresholds.memory,
        usage: memoryUsage
      });
    }

    // CPU threshold check
    if (cpuUsage.percentage > this.thresholds.cpu) {
      this.emit('threshold:cpu', {
        current: cpuUsage.percentage,
        threshold: this.thresholds.cpu,
        usage: cpuUsage
      });
    }
  }

  /**
   * Get current system status
   */
  getStatus() {
    const latest = this.getLatestMetrics();
    const averages = this.getAverages();
    
    return {
      status: this.getHealthStatus(latest),
      current: latest,
      averages: averages,
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics() {
    return {
      memory: this.metrics.memory[this.metrics.memory.length - 1] || null,
      cpu: this.metrics.cpu[this.metrics.cpu.length - 1] || null
    };
  }

  /**
   * Calculate averages over recent history
   */
  getAverages(periods = 10) {
    const recentMemory = this.metrics.memory.slice(-periods);
    const recentCpu = this.metrics.cpu.slice(-periods);
    
    const avgMemory = recentMemory.length > 0 
      ? recentMemory.reduce((sum, m) => sum + m.percentage, 0) / recentMemory.length
      : 0;
      
    const avgCpu = recentCpu.length > 0
      ? recentCpu.reduce((sum, c) => sum + c.percentage, 0) / recentCpu.length
      : 0;
      
    return {
      memory: Math.round(avgMemory),
      cpu: Math.round(avgCpu),
      periods: periods
    };
  }

  /**
   * Determine overall health status
   */
  getHealthStatus(latest) {
    if (!latest.memory || !latest.cpu) return 'unknown';
    
    const memoryOk = latest.memory.percentage < this.thresholds.memory;
    const cpuOk = latest.cpu.percentage < this.thresholds.cpu;
    
    if (memoryOk && cpuOk) return 'healthy';
    if (latest.memory.percentage > 95 || latest.cpu.percentage > 95) return 'critical';
    return 'warning';
  }

  /**
   * Get recommendations based on current usage
   */
  getRecommendations() {
    const status = this.getStatus();
    const recommendations = [];
    
    if (status.current.memory && status.current.memory.percentage > this.thresholds.memory) {
      recommendations.push({
        type: 'memory',
        severity: status.current.memory.percentage > 95 ? 'critical' : 'warning',
        message: `High memory usage: ${status.current.memory.percentage}%`,
        suggestions: [
          'Consider reducing concurrent jobs',
          'Check for memory leaks',
          'Increase available memory if possible'
        ]
      });
    }
    
    if (status.current.cpu && status.current.cpu.percentage > this.thresholds.cpu) {
      recommendations.push({
        type: 'cpu',
        severity: status.current.cpu.percentage > 95 ? 'critical' : 'warning',
        message: `High CPU usage: ${status.current.cpu.percentage}%`,
        suggestions: [
          'Reduce concurrent job limit',
          'Check for CPU-intensive operations',
          'Consider scaling horizontally'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Get optimal configuration adjustments
   */
  getOptimalAdjustments() {
    const status = this.getStatus();
    const adjustments = {};
    
    // Adjust concurrency based on resource usage
    if (status.current.memory && status.current.cpu) {
      const memoryPressure = status.current.memory.percentage / 100;
      const cpuPressure = status.current.cpu.percentage / 100;
      
      // Calculate suggested concurrency reduction
      const maxPressure = Math.max(memoryPressure, cpuPressure);
      
      if (maxPressure > 0.8) {
        adjustments.maxConcurrentJobs = Math.max(1, Math.floor(3 * (1 - maxPressure + 0.2)));
      } else if (maxPressure < 0.5) {
        adjustments.maxConcurrentJobs = Math.min(10, Math.ceil(3 * (1.5 - maxPressure)));
      }
      
      // Adjust timeout based on CPU pressure
      if (cpuPressure > 0.7) {
        adjustments.timeout = Math.floor(300000 * (1 + cpuPressure)); // Increase timeout
      }
    }
    
    return adjustments;
  }

  /**
   * Reset metrics history
   */
  reset() {
    this.metrics.memory = [];
    this.metrics.cpu = [];
    this.metrics.timestamp = Date.now();
    this.emit('reset');
  }

  /**
   * Get historical data for analysis
   */
  getHistory(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    return {
      memory: this.metrics.memory.filter(m => m.timestamp > cutoff),
      cpu: this.metrics.cpu.filter(c => c.timestamp > cutoff)
    };
  }
}

module.exports = ResourceMonitor;