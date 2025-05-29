#!/usr/bin/env node

/**
 * Local test runner for SWE-Agent Resolver
 * Run this script to test the action locally without GitHub Actions
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const TestUtils = require('./helpers/test-utils');

async function runLocalTest(scenario = 'issue_comment') {
  console.log('🧪 SWE-Agent Resolver Local Test Runner');
  console.log('=====================================\n');

  try {
    // Load test environment
    const envPath = path.join(__dirname, '..', '.env.test.local');
    const envExists = await fs.access(envPath).then(() => true).catch(() => false);
    
    if (!envExists) {
      console.log('⚠️  No .env.test.local found. Creating from template...');
      await fs.copyFile(
        path.join(__dirname, '..', '.env.test'),
        envPath
      );
      console.log('✅ Created .env.test.local - Please add your API keys!\n');
      process.exit(0);
    }

    // Load environment variables
    require('dotenv').config({ path: envPath });

    // Validate required environment variables
    const requiredVars = ['GITHUB_TOKEN'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars.join(', '));
      console.log('\nPlease update .env.test.local with your values.');
      process.exit(1);
    }

    // Check for at least one AI provider key
    const providerKeys = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'DEEPSEEK_API_KEY',
      'OPENROUTER_API_KEY',
      'GROQ_API_KEY'
    ];
    
    const hasProvider = providerKeys.some(key => process.env[key]);
    if (!hasProvider) {
      console.error('❌ No AI provider API key found!');
      console.log('\nPlease add at least one provider key to .env.test.local:');
      providerKeys.forEach(key => console.log(`  - ${key}`));
      process.exit(1);
    }

    // Display test configuration
    console.log('📋 Test Configuration:');
    console.log(`  Scenario: ${scenario}`);
    console.log(`  Model: ${process.env.INPUT_MODEL_NAME || 'gpt-4o'}`);
    console.log(`  Trigger: ${process.env.INPUT_TRIGGER_PHRASE || '@swe-agent'}`);
    console.log(`  Max Cost: $${process.env.INPUT_MAX_COST || '5.00'}`);
    console.log(`  Debug Mode: ${process.env.INPUT_DEBUG_MODE || 'false'}`);
    
    // Show available providers
    console.log('\n🔌 Available Providers:');
    providerKeys.forEach(key => {
      if (process.env[key]) {
        console.log(`  ✅ ${key.replace('_API_KEY', '')}`);
      }
    });
    console.log();

    // Create test event based on scenario
    let eventData;
    switch (scenario) {
      case 'issue_comment':
        eventData = TestUtils.createMockEvent('issue_comment', {
          comment: {
            body: `${process.env.INPUT_TRIGGER_PHRASE || '@swe-agent'} analyze this issue and suggest a fix`
          }
        });
        break;
      
      case 'pr_review':
        eventData = TestUtils.createMockEvent('pull_request', {
          action: 'opened'
        });
        process.env.GITHUB_EVENT_NAME = 'pull_request';
        break;
      
      case 'issue_opened':
        eventData = TestUtils.createMockEvent('issues', {
          action: 'opened'
        });
        process.env.GITHUB_EVENT_NAME = 'issues';
        break;
      
      default:
        console.error(`❌ Unknown scenario: ${scenario}`);
        console.log('\nAvailable scenarios:');
        console.log('  - issue_comment (default)');
        console.log('  - pr_review');
        console.log('  - issue_opened');
        process.exit(1);
    }

    // Write event data to temporary file
    const eventPath = await TestUtils.createTempEventFile(eventData);
    process.env.GITHUB_EVENT_PATH = eventPath;

    // Run the action
    console.log('🚀 Running SWE-Agent Action...\n');
    
    // Import and run the action
    const SWEAgentAction = require('../action/entrypoint');
    const action = new SWEAgentAction();
    
    // Override logger for better local output
    action.logger = {
      log: (...args) => console.log('  ', ...args),
      error: (...args) => console.error('  ❌', ...args)
    };

    await action.run();
    
    console.log('\n✅ Test completed successfully!');
    
    // Cleanup
    await fs.unlink(eventPath).catch(() => {});

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (process.env.INPUT_DEBUG_MODE === 'true') {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const scenario = process.argv[2] || 'issue_comment';

// Run test
runLocalTest(scenario);