#!/usr/bin/env node

const Benchmark = require('benchmark');
const autocannon = require('autocannon');
const express = require('express');
const WebhookSimulator = require('../utils/webhook-simulator');
const SWEAgentMock = require('../utils/swe-agent-mock');
const { getConfig } = require('../../src/config');
const fs = require('fs').promises;
const path = require('path');

class PerformanceBenchmarkRunner {
  constructor() {
    this.results = [];
    this.config = null;
    this.app = null;
    this.server = null;
    this.webhookSimulator = null;
    this.sweAgentMock = null;
    this.port = 0; // Random port
  }

  async initialize() {
    console.log('🚀 Initializing Performance Benchmark Suite');
    
    // Load configuration
    this.config = await getConfig();
    
    // Setup test server
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.raw({ type: 'application/json' }));
    
    // Initialize test utilities
    this.webhookSimulator = new WebhookSimulator({
      webhookSecret: this.config.github.webhookSecret
    });

    this.sweAgentMock = new SWEAgentMock({
      responseDelay: 100, // Fast for performance testing
      successRate: 1.0,
      enableRealFiles: false
    });

    // Setup routes
    this.setupRoutes();
    
    // Start server
    await this.startServer();
    
    console.log(`✅ Test server running on port ${this.port}`);
  }

  setupRoutes() {
    // Webhook endpoint
    this.app.post('/webhook', async (req, res) => {
      try {
        const startTime = process.hrtime();
        
        // Simulate webhook processing
        const result = await this.simulateWebhookProcessing(req);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000; // ms
        
        res.status(200).json({
          ...result,
          processing_time: duration
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: Date.now() });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.json({
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        executions: this.sweAgentMock.getExecutionStats()
      });
    });

    // Bulk webhook endpoint for load testing
    this.app.post('/bulk-webhook', async (req, res) => {
      const { count = 10, delay = 0 } = req.body;
      const results = [];
      
      for (let i = 0; i < count; i++) {
        const webhook = this.webhookSimulator.createIssuesWebhook('opened', {
          number: i + 1,
          title: `Bulk test issue ${i + 1}`
        });
        
        const startTime = process.hrtime();
        const result = await this.simulateWebhookProcessing({ 
          headers: webhook.headers, 
          body: webhook.rawPayload 
        });
        const [seconds, nanoseconds] = process.hrtime(startTime);
        
        results.push({
          issue: i + 1,
          duration: seconds * 1000 + nanoseconds / 1000000,
          result
        });
        
        if (delay > 0 && i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      res.json({
        processed: count,
        results,
        total_time: results.reduce((sum, r) => sum + r.duration, 0),
        average_time: results.reduce((sum, r) => sum + r.duration, 0) / count
      });
    });
  }

  async simulateWebhookProcessing(req) {
    // Simulate the actual webhook processing logic
    const webhook = JSON.parse(req.body || '{}');
    
    // Simulate SWE-agent execution
    const result = await this.sweAgentMock.execute('swe-agent', ['--fix', '--issue', '1']);
    
    return {
      status: 'success',
      webhook_type: req.headers['x-github-event'] || 'unknown',
      swe_agent_result: result.status
    };
  }

  async startServer() {
    return new Promise((resolve) => {
      this.server = this.app.listen(0, () => {
        this.port = this.server.address().port;
        resolve();
      });
    });
  }

  async stopServer() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }

  async runBenchmarks() {
    console.log('\n🏃‍♂️ Running Performance Benchmarks\n');

    try {
      // Run different types of benchmarks
      await this.runMicrobenchmarks();
      await this.runHttpLoadTests();
      await this.runWebhookProcessingBenchmarks();
      await this.runConcurrencyTests();
      await this.runMemoryBenchmarks();
      
      // Generate comprehensive report
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      throw error;
    }
  }

  async runMicrobenchmarks() {
    console.log('📊 Running Microbenchmarks...');
    
    const suite = new Benchmark.Suite();
    const results = {};

    return new Promise((resolve) => {
      suite
        .add('Webhook Signature Validation', () => {
          this.webhookSimulator.generateSignature('{"test": "payload"}');
        })
        .add('Issue Webhook Creation', () => {
          this.webhookSimulator.createIssuesWebhook('opened');
        })
        .add('PR Webhook Creation', () => {
          this.webhookSimulator.createPullRequestWebhook('opened');
        })
        .add('SWE-Agent Mock Response', async () => {
          await this.sweAgentMock.generateResponse('swe-agent', ['--fix'], {});
        })
        .add('Configuration Loading', async () => {
          await getConfig();
        })
        .on('cycle', (event) => {
          const benchmark = event.target;
          results[benchmark.name] = {
            ops_per_second: benchmark.hz,
            mean_time: benchmark.stats.mean * 1000, // ms
            margin_of_error: benchmark.stats.rme,
            samples: benchmark.stats.sample.length
          };
          console.log(`  ✓ ${benchmark.name}: ${benchmark.hz.toFixed(2)} ops/sec`);
        })
        .on('complete', () => {
          this.results.push({
            type: 'microbenchmarks',
            timestamp: new Date().toISOString(),
            results
          });
          resolve();
        })
        .run({ async: true });
    });
  }

  async runHttpLoadTests() {
    console.log('🌐 Running HTTP Load Tests...');
    
    const baseUrl = `http://localhost:${this.port}`;
    
    // Test 1: Health endpoint
    console.log('  Testing health endpoint...');
    const healthResult = await autocannon({
      url: `${baseUrl}/health`,
      connections: 10,
      duration: 5,
      pipelining: 1
    });

    // Test 2: Webhook endpoint
    console.log('  Testing webhook endpoint...');
    const webhook = this.webhookSimulator.createIssuesWebhook('opened');
    const webhookResult = await autocannon({
      url: `${baseUrl}/webhook`,
      method: 'POST',
      headers: webhook.headers,
      body: webhook.rawPayload,
      connections: 5,
      duration: 10,
      pipelining: 1
    });

    this.results.push({
      type: 'http_load_tests',
      timestamp: new Date().toISOString(),
      results: {
        health_endpoint: {
          requests_per_second: healthResult.requests.average,
          latency_avg: healthResult.latency.average,
          latency_p99: healthResult.latency.p99,
          throughput: healthResult.throughput.average,
          errors: healthResult.errors
        },
        webhook_endpoint: {
          requests_per_second: webhookResult.requests.average,
          latency_avg: webhookResult.latency.average,
          latency_p99: webhookResult.latency.p99,
          throughput: webhookResult.throughput.average,
          errors: webhookResult.errors
        }
      }
    });

    console.log(`  ✓ Health: ${healthResult.requests.average.toFixed(2)} req/sec, ${healthResult.latency.average.toFixed(2)}ms avg`);
    console.log(`  ✓ Webhook: ${webhookResult.requests.average.toFixed(2)} req/sec, ${webhookResult.latency.average.toFixed(2)}ms avg`);
  }

  async runWebhookProcessingBenchmarks() {
    console.log('🎣 Running Webhook Processing Benchmarks...');
    
    const scenarios = [
      { name: 'Single Issue Webhook', count: 1, type: 'issues' },
      { name: 'Batch Issue Webhooks', count: 10, type: 'issues' },
      { name: 'Mixed Webhook Types', count: 20, type: 'mixed' },
      { name: 'High Volume Simulation', count: 100, type: 'issues' }
    ];

    const results = {};

    for (const scenario of scenarios) {
      console.log(`  Testing: ${scenario.name}...`);
      
      const startTime = Date.now();
      const webhooks = scenario.type === 'mixed' 
        ? this.createMixedWebhooks(scenario.count)
        : this.webhookSimulator.createBulkWebhooks(scenario.count, scenario.type);
      
      const processingTimes = [];
      
      for (const webhook of webhooks) {
        const reqStart = process.hrtime();
        await this.simulateWebhookProcessing({
          headers: webhook.headers,
          body: webhook.rawPayload
        });
        const [seconds, nanoseconds] = process.hrtime(reqStart);
        processingTimes.push(seconds * 1000 + nanoseconds / 1000000);
      }
      
      const totalTime = Date.now() - startTime;
      
      results[scenario.name] = {
        total_webhooks: scenario.count,
        total_time: totalTime,
        average_processing_time: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
        min_processing_time: Math.min(...processingTimes),
        max_processing_time: Math.max(...processingTimes),
        throughput: scenario.count / (totalTime / 1000),
        p95_processing_time: this.calculatePercentile(processingTimes, 0.95),
        p99_processing_time: this.calculatePercentile(processingTimes, 0.99)
      };
      
      console.log(`  ✓ ${scenario.name}: ${results[scenario.name].throughput.toFixed(2)} webhooks/sec`);
    }

    this.results.push({
      type: 'webhook_processing',
      timestamp: new Date().toISOString(),
      results
    });
  }

  async runConcurrencyTests() {
    console.log('⚡ Running Concurrency Tests...');
    
    const concurrencyLevels = [1, 5, 10, 20, 50];
    const results = {};

    for (const concurrency of concurrencyLevels) {
      console.log(`  Testing concurrency level: ${concurrency}...`);
      
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < concurrency; i++) {
        const webhook = this.webhookSimulator.createIssuesWebhook('opened', {
          number: i + 1,
          title: `Concurrent test issue ${i + 1}`
        });
        
        promises.push(
          this.simulateWebhookProcessing({
            headers: webhook.headers,
            body: webhook.rawPayload
          })
        );
      }
      
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      results[`concurrency_${concurrency}`] = {
        concurrent_requests: concurrency,
        total_time: totalTime,
        successful_requests: responses.filter(r => r.status === 'success').length,
        average_time_per_request: totalTime / concurrency,
        throughput: concurrency / (totalTime / 1000),
        success_rate: responses.filter(r => r.status === 'success').length / concurrency
      };
      
      console.log(`  ✓ Concurrency ${concurrency}: ${results[`concurrency_${concurrency}`].throughput.toFixed(2)} req/sec`);
    }

    this.results.push({
      type: 'concurrency_tests',
      timestamp: new Date().toISOString(),
      results
    });
  }

  async runMemoryBenchmarks() {
    console.log('💾 Running Memory Benchmarks...');
    
    const initialMemory = process.memoryUsage();
    const memorySnapshots = [{ phase: 'initial', memory: initialMemory }];
    
    // Test memory usage during webhook processing
    console.log('  Testing memory during webhook processing...');
    const webhooks = this.webhookSimulator.createBulkWebhooks(100, 'issues');
    
    for (let i = 0; i < webhooks.length; i++) {
      await this.simulateWebhookProcessing({
        headers: webhooks[i].headers,
        body: webhooks[i].rawPayload
      });
      
      if (i % 10 === 0) {
        memorySnapshots.push({
          phase: `after_${i + 1}_requests`,
          memory: process.memoryUsage()
        });
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      memorySnapshots.push({
        phase: 'after_gc',
        memory: process.memoryUsage()
      });
    }
    
    const finalMemory = process.memoryUsage();
    memorySnapshots.push({ phase: 'final', memory: finalMemory });
    
    const results = {
      initial_memory: initialMemory,
      final_memory: finalMemory,
      memory_growth: {
        rss: finalMemory.rss - initialMemory.rss,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        external: finalMemory.external - initialMemory.external
      },
      snapshots: memorySnapshots,
      peak_memory: Math.max(...memorySnapshots.map(s => s.memory.rss)),
      average_memory: memorySnapshots.reduce((sum, s) => sum + s.memory.rss, 0) / memorySnapshots.length
    };
    
    this.results.push({
      type: 'memory_benchmarks',
      timestamp: new Date().toISOString(),
      results
    });
    
    console.log(`  ✓ Memory growth: ${(results.memory_growth.rss / 1024 / 1024).toFixed(2)} MB RSS`);
    console.log(`  ✓ Peak memory: ${(results.peak_memory / 1024 / 1024).toFixed(2)} MB`);
  }

  createMixedWebhooks(count) {
    const webhooks = [];
    const types = ['issues', 'pull_request', 'push', 'issue_comment'];
    
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      let webhook;
      
      switch (type) {
        case 'issues':
          webhook = this.webhookSimulator.createIssuesWebhook('opened', { number: i + 1 });
          break;
        case 'pull_request':
          webhook = this.webhookSimulator.createPullRequestWebhook('opened', { number: i + 1 });
          break;
        case 'push':
          webhook = this.webhookSimulator.createPushWebhook([{
            id: `commit${i + 1}`,
            message: `Commit ${i + 1}`,
            author: { name: 'test', email: 'test@example.com' }
          }]);
          break;
        case 'issue_comment':
          webhook = this.webhookSimulator.createIssueCommentWebhook('created', {
            body: `Comment ${i + 1}`
          });
          break;
      }
      
      webhooks.push(webhook);
    }
    
    return webhooks;
  }

  calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index];
  }

  async generateReport() {
    console.log('\n📊 Generating Performance Report...');
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        memory_limit: process.env.NODE_OPTIONS?.includes('--max-old-space-size') ? 
          process.env.NODE_OPTIONS : 'default'
      },
      summary: this.generateSummary(),
      benchmarks: this.results
    };
    
    // Save detailed report
    const reportPath = path.join(__dirname, `performance-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    this.printSummary(report.summary);
    
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    return report;
  }

  generateSummary() {
    const summary = {};
    
    // Extract key metrics from each benchmark type
    this.results.forEach(result => {
      switch (result.type) {
        case 'http_load_tests':
          summary.http_performance = {
            webhook_requests_per_second: result.results.webhook_endpoint.requests_per_second,
            webhook_latency_avg: result.results.webhook_endpoint.latency_avg,
            webhook_latency_p99: result.results.webhook_endpoint.latency_p99
          };
          break;
          
        case 'webhook_processing':
          const highVolumeResult = result.results['High Volume Simulation'];
          if (highVolumeResult) {
            summary.webhook_processing = {
              throughput: highVolumeResult.throughput,
              average_processing_time: highVolumeResult.average_processing_time,
              p99_processing_time: highVolumeResult.p99_processing_time
            };
          }
          break;
          
        case 'concurrency_tests':
          const maxConcurrency = Object.keys(result.results).reduce((max, key) => {
            const level = parseInt(key.split('_')[1]);
            return level > max ? level : max;
          }, 0);
          
          summary.concurrency = {
            max_tested_concurrency: maxConcurrency,
            max_throughput: Math.max(...Object.values(result.results).map(r => r.throughput)),
            success_rate_at_max: result.results[`concurrency_${maxConcurrency}`]?.success_rate
          };
          break;
          
        case 'memory_benchmarks':
          summary.memory = {
            memory_growth_mb: result.results.memory_growth.rss / 1024 / 1024,
            peak_memory_mb: result.results.peak_memory / 1024 / 1024,
            average_memory_mb: result.results.average_memory / 1024 / 1024
          };
          break;
      }
    });
    
    return summary;
  }

  printSummary(summary) {
    console.log('\n🎯 Performance Summary:');
    console.log('========================');
    
    if (summary.http_performance) {
      console.log('\n🌐 HTTP Performance:');
      console.log(`  Webhook Throughput: ${summary.http_performance.webhook_requests_per_second.toFixed(2)} req/sec`);
      console.log(`  Average Latency: ${summary.http_performance.webhook_latency_avg.toFixed(2)}ms`);
      console.log(`  99th Percentile: ${summary.http_performance.webhook_latency_p99.toFixed(2)}ms`);
    }
    
    if (summary.webhook_processing) {
      console.log('\n🎣 Webhook Processing:');
      console.log(`  Processing Throughput: ${summary.webhook_processing.throughput.toFixed(2)} webhooks/sec`);
      console.log(`  Average Processing: ${summary.webhook_processing.average_processing_time.toFixed(2)}ms`);
      console.log(`  99th Percentile: ${summary.webhook_processing.p99_processing_time.toFixed(2)}ms`);
    }
    
    if (summary.concurrency) {
      console.log('\n⚡ Concurrency:');
      console.log(`  Max Tested Level: ${summary.concurrency.max_tested_concurrency} concurrent requests`);
      console.log(`  Peak Throughput: ${summary.concurrency.max_throughput.toFixed(2)} req/sec`);
      console.log(`  Success Rate: ${(summary.concurrency.success_rate_at_max * 100).toFixed(1)}%`);
    }
    
    if (summary.memory) {
      console.log('\n💾 Memory Usage:');
      console.log(`  Memory Growth: ${summary.memory.memory_growth_mb.toFixed(2)} MB`);
      console.log(`  Peak Memory: ${summary.memory.peak_memory_mb.toFixed(2)} MB`);
      console.log(`  Average Memory: ${summary.memory.average_memory_mb.toFixed(2)} MB`);
    }
    
    // Performance assessment
    this.assessPerformance(summary);
  }

  assessPerformance(summary) {
    console.log('\n🏆 Performance Assessment:');
    console.log('==========================');
    
    const assessments = [];
    
    // Assess webhook processing speed
    if (summary.webhook_processing?.average_processing_time) {
      const avgTime = summary.webhook_processing.average_processing_time;
      if (avgTime < 100) {
        assessments.push('✅ Excellent webhook processing speed (<100ms)');
      } else if (avgTime < 500) {
        assessments.push('✅ Good webhook processing speed (<500ms)');
      } else if (avgTime < 1000) {
        assessments.push('⚠️  Acceptable webhook processing speed (<1s)');
      } else {
        assessments.push('❌ Slow webhook processing speed (>1s)');
      }
    }
    
    // Assess throughput
    if (summary.http_performance?.webhook_requests_per_second) {
      const rps = summary.http_performance.webhook_requests_per_second;
      if (rps > 100) {
        assessments.push('✅ High throughput capability (>100 req/sec)');
      } else if (rps > 50) {
        assessments.push('✅ Good throughput capability (>50 req/sec)');
      } else if (rps > 20) {
        assessments.push('⚠️  Moderate throughput capability (>20 req/sec)');
      } else {
        assessments.push('❌ Low throughput capability (<20 req/sec)');
      }
    }
    
    // Assess memory usage
    if (summary.memory?.memory_growth_mb) {
      const growth = summary.memory.memory_growth_mb;
      if (growth < 50) {
        assessments.push('✅ Low memory footprint (<50MB growth)');
      } else if (growth < 100) {
        assessments.push('✅ Reasonable memory usage (<100MB growth)');
      } else if (growth < 200) {
        assessments.push('⚠️  High memory usage (<200MB growth)');
      } else {
        assessments.push('❌ Very high memory usage (>200MB growth)');
      }
    }
    
    assessments.forEach(assessment => console.log(`  ${assessment}`));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    await this.stopServer();
    this.sweAgentMock.reset();
  }
}

// Main execution
async function main() {
  const runner = new PerformanceBenchmarkRunner();
  
  try {
    await runner.initialize();
    await runner.runBenchmarks();
  } catch (error) {
    console.error('❌ Benchmark suite failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
  
  console.log('\n✅ Performance benchmarks completed successfully!');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = PerformanceBenchmarkRunner;