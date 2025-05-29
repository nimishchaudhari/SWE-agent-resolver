const sweAgent = require('../src/swe-agent');

async function demonstrateOrchestrator() {
  console.log('SWE-Agent Orchestrator Demo');
  console.log('============================\n');

  try {
    // Check initial status
    console.log('Initial Status:');
    console.log(JSON.stringify(sweAgent.getStatus(), null, 2));
    console.log('\n');

    // Example 1: Issue Analysis
    console.log('Example 1: Issue Analysis');
    console.log('-------------------------');
    
    const issueContext = {
      repository: {
        fullName: 'example/repo',
        cloneUrl: 'https://github.com/example/repo.git',
        defaultBranch: 'main',
        language: 'JavaScript'
      },
      issue: {
        number: 123,
        title: 'Bug in user authentication',
        body: 'Users are unable to log in with valid credentials',
        state: 'open'
      },
      event: {
        type: 'issues',
        action: 'opened'
      }
    };

    try {
      const issueResult = await sweAgent.processIssue({
        repository: 'example/repo',
        issueNumber: 123,
        issueTitle: 'Bug in user authentication',
        issueBody: 'Users are unable to log in with valid credentials',
        context: issueContext
      });

      console.log('Issue analysis completed:');
      console.log('Success:', issueResult.success);
      console.log('Duration:', issueResult.duration + 'ms');
      console.log('Validation:', issueResult.validation?.valid);
      console.log('Primary output type:', issueResult.primary?.type);
      console.log('\n');
    } catch (error) {
      console.log('Issue analysis failed:', error.message);
      console.log('\n');
    }

    // Example 2: PR Review
    console.log('Example 2: PR Review');
    console.log('--------------------');
    
    const prContext = {
      repository: {
        fullName: 'example/repo',
        cloneUrl: 'https://github.com/example/repo.git',
        defaultBranch: 'main',
        language: 'JavaScript'
      },
      pullRequest: {
        number: 456,
        title: 'Add new user management features',
        body: 'This PR adds user role management and permissions',
        head: { sha: 'abc123', ref: 'feature/user-management' },
        base: { sha: 'def456', ref: 'main' }
      },
      event: {
        type: 'pull_request',
        action: 'opened'
      }
    };

    try {
      const prResult = await sweAgent.processPullRequest({
        repository: 'example/repo',
        prNumber: 456,
        prTitle: 'Add new user management features',
        prBody: 'This PR adds user role management and permissions',
        headSha: 'abc123',
        baseSha: 'def456',
        context: prContext
      });

      console.log('PR review completed:');
      console.log('Success:', prResult.success);
      console.log('Duration:', prResult.duration + 'ms');
      console.log('Validation:', prResult.validation?.valid);
      console.log('\n');
    } catch (error) {
      console.log('PR review failed:', error.message);
      console.log('\n');
    }

    // Example 3: Comment Processing with Trigger
    console.log('Example 3: Comment Processing');
    console.log('-----------------------------');
    
    const commentContext = {
      repository: {
        fullName: 'example/repo',
        cloneUrl: 'https://github.com/example/repo.git',
        defaultBranch: 'main',
        language: 'JavaScript'
      },
      issue: {
        number: 789,
        title: 'Performance optimization needed',
        state: 'open'
      },
      comment: {
        id: 12345,
        body: '@swe-agent analyze files: src/utils/performance.js depth: deep',
        author: 'developer'
      },
      trigger: {
        triggered: true,
        primaryCommand: {
          type: 'analyze',
          text: 'files: src/utils/performance.js depth: deep',
          args: {
            files: ['src/utils/performance.js'],
            depth: 'deep'
          }
        },
        context: {
          fileRefs: ['src/utils/performance.js'],
          isUrgent: false
        }
      },
      event: {
        type: 'issue_comment',
        action: 'created'
      }
    };

    try {
      const commentResult = await sweAgent.processComment({
        repository: 'example/repo',
        issueNumber: 789,
        commentBody: '@swe-agent analyze files: src/utils/performance.js depth: deep',
        trigger: commentContext.trigger,
        context: commentContext
      });

      console.log('Comment processing completed:');
      console.log('Success:', commentResult.success);
      console.log('Duration:', commentResult.duration + 'ms');
      console.log('Command type:', commentContext.trigger.primaryCommand.type);
      console.log('\n');
    } catch (error) {
      console.log('Comment processing failed:', error.message);
      console.log('\n');
    }

    // Status check
    console.log('Final Status:');
    console.log(JSON.stringify(sweAgent.getStatus(), null, 2));
    console.log('\n');

    // Health check
    console.log('Health Check:');
    const health = await sweAgent.healthCheck();
    console.log('Healthy:', health.healthy);
    if (health.issues.length > 0) {
      console.log('Issues:', health.issues);
    }

  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Example of monitoring active jobs
async function monitorJobs() {
  console.log('\nMonitoring Jobs');
  console.log('===============');
  
  const activeJobs = sweAgent.getActiveJobs();
  console.log(`Active jobs: ${activeJobs.length}`);
  
  for (const job of activeJobs) {
    console.log(`- Job ${job.id}: ${job.type} (${job.status}) - ${job.duration}ms`);
  }
}

// Example of configuration generation
async function demonstrateConfigGeneration() {
  console.log('\nConfiguration Generation Demo');
  console.log('=============================');
  
  const { ConfigGenerator } = sweAgent;
  const configGen = new ConfigGenerator();
  
  const context = {
    repository: {
      fullName: 'example/repo',
      language: 'JavaScript'
    },
    trigger: {
      primaryCommand: {
        type: 'fix',
        args: { files: ['src/bug.js'] }
      }
    },
    event: { type: 'issue_comment' }
  };
  
  try {
    const config = await configGen.generateConfig(context);
    console.log('Generated config:');
    console.log('- Type:', config.task.type);
    console.log('- Tools:', config.environment.tools.length);
    console.log('- Timeout:', config.resources.timeout);
    console.log('- Valid:', configGen.validateConfig(config).valid);
  } catch (error) {
    console.log('Config generation failed:', error.message);
  }
}

// Run the demo
if (require.main === module) {
  demonstrateOrchestrator()
    .then(() => monitorJobs())
    .then(() => demonstrateConfigGeneration())
    .then(() => {
      console.log('\nDemo completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}

module.exports = {
  demonstrateOrchestrator,
  monitorJobs,
  demonstrateConfigGeneration
};