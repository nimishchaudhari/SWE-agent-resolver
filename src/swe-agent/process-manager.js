const { spawn, execFile } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ProcessManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.processes = new Map();
    this.processTimeouts = new Map();
    this.resourceMonitor = new ResourceMonitor();
    this.options = {
      maxConcurrent: options.maxConcurrent || 3,
      defaultTimeout: options.defaultTimeout || 300000,
      killTimeout: options.killTimeout || 10000,
      monitorInterval: options.monitorInterval || 5000,
      maxMemory: options.maxMemory || '2GB',
      maxCpu: options.maxCpu || 200, // 200% (2 cores)
      ...options
    };
    
    this.startResourceMonitoring();
  }

  async executeProcess(command, args, options = {}) {
    const processId = this.generateProcessId();
    const processOptions = this.buildProcessOptions(options, processId);
    
    try {
      this.validateResourceLimits();
      
      const process = await this.spawnProcess(command, args, processOptions);
      this.registerProcess(processId, process, processOptions);
      
      const result = await this.monitorProcess(processId, process, processOptions);
      
      this.emit('processCompleted', {
        processId,
        command,
        exitCode: result.exitCode,
        duration: result.duration,
        resourceUsage: result.resourceUsage
      });
      
      return result;
      
    } catch (error) {
      this.emit('processError', {
        processId,
        command,
        error: error.message,
        duration: Date.now() - (processOptions.startTime || Date.now())
      });
      
      throw error;
    } finally {
      this.cleanupProcess(processId);
    }
  }

  async spawnProcess(command, args, options) {
    return new Promise((resolve, reject) => {
      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        detached: false,
        ...options.spawnOptions
      };

      let child;
      try {
        child = spawn(command, args, spawnOptions);
      } catch (error) {
        reject(new Error(`Failed to spawn process: ${error.message}`));
        return;
      }

      const processData = {
        pid: child.pid,
        command,
        args,
        stdout: [],
        stderr: [],
        startTime: Date.now(),
        lastOutput: Date.now()
      };

      // Set up data collectors
      child.stdout.on('data', (data) => {
        processData.stdout.push(data);
        processData.lastOutput = Date.now();
        
        if (options.onStdout) {
          options.onStdout(data.toString());
        }
        
        this.emit('processOutput', {
          processId: options.processId,
          type: 'stdout',
          data: data.toString()
        });
      });

      child.stderr.on('data', (data) => {
        processData.stderr.push(data);
        processData.lastOutput = Date.now();
        
        if (options.onStderr) {
          options.onStderr(data.toString());
        }
        
        this.emit('processOutput', {
          processId: options.processId,
          type: 'stderr',
          data: data.toString()
        });
      });

      child.on('close', (code, signal) => {
        processData.exitCode = code;
        processData.signal = signal;
        processData.endTime = Date.now();
        processData.duration = processData.endTime - processData.startTime;
        
        resolve({
          ...processData,
          stdout: Buffer.concat(processData.stdout).toString(),
          stderr: Buffer.concat(processData.stderr).toString()
        });
      });

      child.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      // Store child process reference
      processData.child = child;
      resolve(processData);
    });
  }

  async monitorProcess(processId, processData, options) {
    const timeout = options.timeout || this.options.defaultTimeout;
    const startTime = Date.now();
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.killProcess(processId, 'TIMEOUT');
    }, timeout);
    
    this.processTimeouts.set(processId, timeoutId);
    
    // Set up resource monitoring
    const monitorId = setInterval(() => {
      this.checkProcessResources(processId, processData);
    }, this.options.monitorInterval);
    
    try {
      // Wait for process completion
      const result = await processData;
      
      // Calculate resource usage
      const resourceUsage = await this.getProcessResourceUsage(processData.pid);
      
      return {
        ...result,
        duration: Date.now() - startTime,
        resourceUsage,
        processId
      };
      
    } finally {
      clearTimeout(timeoutId);
      clearInterval(monitorId);
      this.processTimeouts.delete(processId);
    }
  }

  async checkProcessResources(processId, processData) {
    if (!processData.child || processData.child.killed) {
      return;
    }
    
    try {
      const usage = await this.getProcessResourceUsage(processData.pid);
      
      // Check memory limit
      if (usage.memory && this.exceedsMemoryLimit(usage.memory)) {
        logger.warn(`Process ${processId} exceeds memory limit`, usage);
        this.killProcess(processId, 'MEMORY_LIMIT');
        return;
      }
      
      // Check CPU limit
      if (usage.cpu && usage.cpu > this.options.maxCpu) {
        logger.warn(`Process ${processId} exceeds CPU limit`, usage);
        this.killProcess(processId, 'CPU_LIMIT');
        return;
      }
      
      // Check for hanging processes (no output for too long)
      const timeSinceOutput = Date.now() - processData.lastOutput;
      if (timeSinceOutput > 300000) { // 5 minutes
        logger.warn(`Process ${processId} appears to be hanging`);
        this.killProcess(processId, 'HANGING');
        return;
      }
      
      this.emit('resourceUpdate', {
        processId,
        usage
      });
      
    } catch (error) {
      logger.debug(`Failed to get resource usage for process ${processId}:`, error);
    }
  }

  async getProcessResourceUsage(pid) {
    try {
      // Use ps command to get resource usage
      const { stdout } = await this.execCommand('ps', [
        '-p', pid.toString(),
        '-o', 'pid,pcpu,pmem,rss,vsz,etime'
      ]);
      
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) return null;
      
      const data = lines[1].trim().split(/\s+/);
      
      return {
        pid: parseInt(data[0]),
        cpu: parseFloat(data[1]),
        memoryPercent: parseFloat(data[2]),
        rss: parseInt(data[3]) * 1024, // Convert KB to bytes
        vsz: parseInt(data[4]) * 1024,
        elapsedTime: data[5]
      };
    } catch (error) {
      return null;
    }
  }

  exceedsMemoryLimit(memoryBytes) {
    const limitBytes = this.parseMemoryLimit(this.options.maxMemory);
    return memoryBytes > limitBytes;
  }

  parseMemoryLimit(memoryString) {
    const match = memoryString.match(/^(\d+)(GB|MB|KB)?$/i);
    if (!match) return 2 * 1024 * 1024 * 1024; // 2GB default
    
    const [, amount, unit] = match;
    const bytes = parseInt(amount);
    
    switch (unit?.toUpperCase()) {
      case 'GB': return bytes * 1024 * 1024 * 1024;
      case 'MB': return bytes * 1024 * 1024;
      case 'KB': return bytes * 1024;
      default: return bytes;
    }
  }

  async killProcess(processId, reason = 'MANUAL') {
    const processData = this.processes.get(processId);
    if (!processData || !processData.child) {
      return false;
    }
    
    logger.info(`Killing process ${processId} (${reason})`);
    
    try {
      // Try graceful termination first
      processData.child.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await this.waitForProcessExit(processData.child, this.options.killTimeout);
      
    } catch (error) {
      // Force kill if graceful termination fails
      logger.warn(`Graceful termination failed for ${processId}, force killing`);
      
      try {
        processData.child.kill('SIGKILL');
      } catch (killError) {
        logger.error(`Failed to force kill process ${processId}:`, killError);
      }
    }
    
    this.emit('processKilled', {
      processId,
      reason,
      pid: processData.child.pid
    });
    
    return true;
  }

  async waitForProcessExit(childProcess, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Process exit timeout'));
      }, timeout);
      
      childProcess.on('exit', () => {
        clearTimeout(timeoutId);
        resolve();
      });
    });
  }

  registerProcess(processId, processData, options) {
    this.processes.set(processId, {
      ...processData,
      options,
      registeredAt: Date.now()
    });
    
    this.emit('processRegistered', {
      processId,
      pid: processData.pid,
      command: processData.command
    });
  }

  cleanupProcess(processId) {
    this.processes.delete(processId);
    
    const timeoutId = this.processTimeouts.get(processId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.processTimeouts.delete(processId);
    }
    
    this.emit('processCleanup', { processId });
  }

  buildProcessOptions(options, processId) {
    return {
      processId,
      timeout: options.timeout || this.options.defaultTimeout,
      cwd: options.cwd,
      env: options.env,
      startTime: Date.now(),
      onStdout: options.onStdout,
      onStderr: options.onStderr,
      spawnOptions: options.spawnOptions || {}
    };
  }

  validateResourceLimits() {
    if (this.processes.size >= this.options.maxConcurrent) {
      throw new Error(`Maximum concurrent processes limit reached (${this.options.maxConcurrent})`);
    }
    
    const systemUsage = this.resourceMonitor.getSystemUsage();
    if (systemUsage.memoryUsage > 90) {
      throw new Error('System memory usage too high to start new process');
    }
  }

  async execCommand(command, args) {
    return new Promise((resolve, reject) => {
      execFile(command, args, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  generateProcessId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startResourceMonitoring() {
    setInterval(() => {
      this.resourceMonitor.updateSystemUsage();
    }, this.options.monitorInterval);
  }

  getActiveProcesses() {
    return Array.from(this.processes.entries()).map(([id, data]) => ({
      id,
      pid: data.pid,
      command: data.command,
      args: data.args,
      startTime: data.startTime,
      duration: Date.now() - data.startTime
    }));
  }

  async killAllProcesses(reason = 'SHUTDOWN') {
    const processIds = Array.from(this.processes.keys());
    const killPromises = processIds.map(id => this.killProcess(id, reason));
    
    await Promise.allSettled(killPromises);
    
    logger.info(`Killed ${processIds.length} processes due to ${reason}`);
  }

  getStats() {
    return {
      activeProcesses: this.processes.size,
      maxConcurrent: this.options.maxConcurrent,
      systemUsage: this.resourceMonitor.getSystemUsage(),
      processHistory: this.getActiveProcesses()
    };
  }
}

class ResourceMonitor {
  constructor() {
    this.systemUsage = {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      lastUpdated: Date.now()
    };
  }

  async updateSystemUsage() {
    try {
      const [cpu, memory, disk] = await Promise.all([
        this.getCpuUsage(),
        this.getMemoryUsage(),
        this.getDiskUsage()
      ]);
      
      this.systemUsage = {
        cpuUsage: cpu,
        memoryUsage: memory,
        diskUsage: disk,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.debug('Failed to update system usage:', error);
    }
  }

  async getCpuUsage() {
    try {
      const { stdout } = await this.execCommand('top', ['-bn1']);
      const cpuLine = stdout.split('\n').find(line => line.includes('Cpu(s)'));
      
      if (cpuLine) {
        const match = cpuLine.match(/(\d+\.\d+)%\s*us/);
        return match ? parseFloat(match[1]) : 0;
      }
    } catch (error) {
      return 0;
    }
  }

  async getMemoryUsage() {
    try {
      const { stdout } = await this.execCommand('free', ['-m']);
      const lines = stdout.split('\n');
      const memLine = lines[1];
      
      if (memLine) {
        const parts = memLine.split(/\s+/);
        const total = parseInt(parts[1]);
        const used = parseInt(parts[2]);
        return (used / total) * 100;
      }
    } catch (error) {
      return 0;
    }
  }

  async getDiskUsage() {
    try {
      const { stdout } = await this.execCommand('df', ['-h', '/tmp']);
      const lines = stdout.split('\n');
      const diskLine = lines[1];
      
      if (diskLine) {
        const parts = diskLine.split(/\s+/);
        const usage = parts[4];
        return parseInt(usage.replace('%', ''));
      }
    } catch (error) {
      return 0;
    }
  }

  async execCommand(command, args) {
    return new Promise((resolve, reject) => {
      execFile(command, args, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  getSystemUsage() {
    return { ...this.systemUsage };
  }
}

module.exports = ProcessManager;