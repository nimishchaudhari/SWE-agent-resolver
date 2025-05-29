#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * Test setup script
 * Prepares the testing environment and installs dependencies
 */
class TestSetup {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..', '..');
    this.testRoot = path.resolve(__dirname, '..');
    this.tempDir = path.join(this.testRoot, 'temp');
  }

  async run() {
    console.log('🧪 Setting up SWE-Agent Test Environment\n');

    try {
      await this.checkNodeVersion();
      await this.installDependencies();
      await this.createDirectories();
      await this.setupEnvironment();
      await this.validateSetup();
      
      console.log('\n✅ Test environment setup completed successfully!');
      console.log('\nAvailable test commands:');
      console.log('  npm test                 - Run all tests');
      console.log('  npm run test:unit        - Run unit tests');
      console.log('  npm run test:integration - Run integration tests');
      console.log('  npm run test:performance - Run performance benchmarks');
      console.log('  npm run test:coverage    - Run tests with coverage');
      
    } catch (error) {
      console.error('\n❌ Test setup failed:', error.message);
      process.exit(1);
    }
  }

  async checkNodeVersion() {
    console.log('🔍 Checking Node.js version...');
    
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
    }
    
    console.log(`  ✓ Node.js ${nodeVersion} (compatible)`);
  }

  async installDependencies() {
    console.log('📦 Installing test dependencies...');
    
    try {
      // Check if package.json exists
      const packagePath = path.join(this.projectRoot, 'package.json');
      await fs.access(packagePath);
      
      // Install dependencies
      console.log('  Installing npm packages...');
      execSync('npm install', { 
        cwd: this.projectRoot, 
        stdio: ['ignore', 'pipe', 'pipe'] 
      });
      
      console.log('  ✓ Dependencies installed');
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('package.json not found. Are you in the correct directory?');
      }
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }

  async createDirectories() {
    console.log('📁 Creating test directories...');
    
    const directories = [
      this.tempDir,
      path.join(this.tempDir, 'workspace'),
      path.join(this.tempDir, 'logs'),
      path.join(this.tempDir, 'reports'),
      path.join(this.testRoot, 'coverage'),
      path.join(this.testRoot, 'results')
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`  ✓ Created ${path.relative(this.projectRoot, dir)}`);
      } catch (error) {
        console.warn(`  ⚠️  Could not create ${dir}: ${error.message}`);
      }
    }
  }

  async setupEnvironment() {
    console.log('⚙️  Setting up test environment...');
    
    // Load test environment variables
    const testEnvPath = path.join(this.testRoot, 'config', 'test.env');
    try {
      const envContent = await fs.readFile(testEnvPath, 'utf8');
      const envVars = this.parseEnvFile(envContent);
      
      // Set environment variables
      Object.entries(envVars).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
      
      console.log(`  ✓ Loaded test environment from ${path.relative(this.projectRoot, testEnvPath)}`);
      
    } catch (error) {
      console.warn(`  ⚠️  Could not load test.env: ${error.message}`);
    }

    // Ensure required environment variables are set
    const requiredVars = [
      'GITHUB_WEBHOOK_SECRET',
      'GITHUB_TOKEN',
      'SWE_AGENT_PATH',
      'NODE_ENV'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.warn(`  ⚠️  Missing environment variables: ${missingVars.join(', ')}`);
      console.warn('  Using default test values...');
      
      // Set default values for missing variables
      const defaults = {
        'GITHUB_WEBHOOK_SECRET': 'test-webhook-secret',
        'GITHUB_TOKEN': 'test-github-token',
        'SWE_AGENT_PATH': '/usr/local/bin/swe-agent',
        'NODE_ENV': 'test'
      };
      
      missingVars.forEach(varName => {
        process.env[varName] = defaults[varName];
      });
    }

    console.log('  ✓ Environment variables configured');
  }

  parseEnvFile(content) {
    const envVars = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) return;
      
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return envVars;
  }

  async validateSetup() {
    console.log('✅ Validating test setup...');
    
    // Check Jest is available
    try {
      execSync('npx jest --version', { stdio: 'ignore' });
      console.log('  ✓ Jest test runner available');
    } catch (error) {
      throw new Error('Jest not found. Please install Jest.');
    }

    // Check test files exist
    const criticalTestFiles = [
      'test/setup.js',
      'test/utils/webhook-simulator.js',
      'test/utils/swe-agent-mock.js',
      'jest.config.js'
    ];

    for (const testFile of criticalTestFiles) {
      const filePath = path.join(this.projectRoot, testFile);
      try {
        await fs.access(filePath);
        console.log(`  ✓ ${testFile} exists`);
      } catch (error) {
        throw new Error(`Critical test file missing: ${testFile}`);
      }
    }

    // Test basic configuration loading
    try {
      const config = require(path.join(this.projectRoot, 'src', 'config'));
      console.log('  ✓ Configuration module loads correctly');
    } catch (error) {
      console.warn(`  ⚠️  Configuration loading issue: ${error.message}`);
    }

    // Check temp directory is writable
    try {
      const testFile = path.join(this.tempDir, 'write-test.tmp');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      console.log('  ✓ Temp directory is writable');
    } catch (error) {
      throw new Error(`Temp directory not writable: ${this.tempDir}`);
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Remove temp directory
      await fs.rmdir(this.tempDir, { recursive: true });
      console.log('  ✓ Temp directory cleaned');
    } catch (error) {
      console.warn(`  ⚠️  Could not clean temp directory: ${error.message}`);
    }
  }
}

// CLI handling
if (require.main === module) {
  const command = process.argv[2];
  const setup = new TestSetup();

  switch (command) {
    case 'cleanup':
      setup.cleanup().then(() => {
        console.log('✅ Cleanup completed');
      }).catch(error => {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
      });
      break;
      
    case 'validate':
      setup.validateSetup().then(() => {
        console.log('✅ Validation completed');
      }).catch(error => {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
      });
      break;
      
    default:
      setup.run();
  }
}

module.exports = TestSetup;