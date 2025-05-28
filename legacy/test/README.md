# SWE-Agent Test Suite

This directory contains comprehensive test scripts for validating the SWE-Agent setup and functionality.

## Available Tests

### 🚀 Quick Validation
- **`final-status-report.sh`** - Complete status report of the setup
- **`quick-sanity-check.sh`** - Fast validation of key components

### 🔍 Component Tests
- **`context-test.sh`** - Tests context detection functionality
- **`docker-test.sh`** - Tests Docker build and container functionality
- **`validate-docker-setup.sh`** - Comprehensive Docker setup validation
- **`integration-test.sh`** - End-to-end integration tests

### 📊 Comprehensive Tests
- **`validate-full-setup.sh`** - Complete system validation
- **`run-all-tests.sh`** - Master test runner for all test suites

## Usage

### Quick Check
```bash
# Run a quick status report
./test/final-status-report.sh

# Run basic sanity check
./test/quick-sanity-check.sh
```

### Comprehensive Validation
```bash
# Full system validation
./test/validate-full-setup.sh

# Docker-specific tests
./test/validate-docker-setup.sh

# Run all tests
./test/run-all-tests.sh
```

### Component-Specific Tests
```bash
# Test context detection
./test/context-test.sh

# Test Docker functionality
./test/docker-test.sh

# Test integrations
./test/integration-test.sh
```

## Test Results

Test results are automatically saved to `test/results/` with timestamps for tracking and debugging.

## What The Tests Validate

- ✅ File structure and permissions
- ✅ GitHub Actions workflow configuration
- ✅ Docker build and image functionality
- ✅ Script execution and dependencies
- ✅ Environment variable consistency
- ✅ Context detection accuracy
- ✅ Integration with GitHub APIs
- ✅ Error handling and fallback logic

## Recent Fixes Validated

The test suite validates the recent fixes that resolved the "No such file or directory" error:

1. **Build Workflow Restoration** - Docker images are built properly
2. **Workflow Order Fix** - Repository checkout happens before script execution
3. **Image Selection Logic** - Branch-specific images with fallback
4. **Parameter Consistency** - All timeout and environment variables aligned

## Continuous Integration

These tests can be integrated into CI/CD pipelines to ensure the SWE-Agent remains functional across changes.
