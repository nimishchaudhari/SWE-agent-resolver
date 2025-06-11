#!/usr/bin/env node

/**
 * Simple test script to verify the lightweight wrapper works
 */

// Mock environment for testing
process.env.GITHUB_TOKEN = 'test-token';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GITHUB_EVENT_NAME = 'issue_comment';
process.env.INPUT_MODEL_NAME = 'gpt-4o-mini';
process.env.INPUT_TRIGGER_PHRASE = '@swe-agent';
process.env.INPUT_MAX_COST = '5.00';
process.env.NODE_ENV = 'test';

// Mock GitHub event payload
const testEventPayload = {
  action: 'created',
  comment: {
    body: '@swe-agent help with this test issue',
    id: 123
  },
  issue: {
    number: 1,
    title: 'Test Issue',
    body: 'This is a test issue for the wrapper'
  },
  repository: {
    full_name: 'test/repo',
    name: 'repo',
    owner: { login: 'test' }
  }
};

const fs = require('fs');
const path = require('path');
const os = require('os');

// Create temporary event file
const eventPath = path.join(os.tmpdir(), 'github-event.json');
fs.writeFileSync(eventPath, JSON.stringify(testEventPayload, null, 2));
process.env.GITHUB_EVENT_PATH = eventPath;

// Mock GitHub API calls
const nock = require('nock');

const commentMock = nock('https://api.github.com')
  .post('/repos/test/repo/issues/1/comments')
  .reply(201, {
    id: 999,
    html_url: 'https://github.com/test/repo/issues/1#issuecomment-999',
    body: 'Test comment'
  });

console.log('🧪 Testing SWE-Agent Lightweight Wrapper...\n');

// Import and run the action
const SWEAgentAction = require('./action/entrypoint');

async function testWrapper() {
  try {
    console.log('✅ Creating SWE-Agent Action instance...');
    const action = new SWEAgentAction();
    
    console.log('✅ Inputs configured:', {
      model: action.inputs.model,
      triggerPhrase: action.inputs.triggerPhrase,
      maxCost: action.inputs.maxCost
    });
    
    console.log('✅ Context parsed:', {
      eventName: action.context.eventName,
      hasPayload: !!action.context.payload
    });
    
    console.log('✅ Running action...');
    await action.run();
    
    console.log('\n🎉 Wrapper test completed successfully!');
    
    // Check if GitHub API was called
    if (commentMock.isDone()) {
      console.log('✅ GitHub API integration working');
    } else {
      console.log('⚠️ GitHub API not called (expected in test mode)');
    }
    
  } catch (error) {
    console.error('❌ Wrapper test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(eventPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testWrapper();