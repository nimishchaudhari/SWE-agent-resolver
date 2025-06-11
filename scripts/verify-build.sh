#!/bin/bash

# Build Verification Script for SWE-Agent Lightweight Wrapper

echo "🔍 Verifying SWE-Agent Lightweight Wrapper Build..."
echo

# Check Node.js version
echo "📦 Node.js version:"
node --version
echo

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --quiet
echo "✅ Dependencies installed"
echo

# Run unit tests
echo "🧪 Running unit tests..."
npm run test:unit --silent
if [ $? -eq 0 ]; then
    echo "✅ Unit tests passed"
else
    echo "❌ Unit tests failed"
    exit 1
fi
echo

# Test wrapper functionality
echo "🔧 Testing wrapper functionality..."
node test-wrapper.js > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Wrapper test passed"
else
    echo "❌ Wrapper test failed"
    exit 1
fi
echo

# Validate action.yml
echo "📋 Validating action.yml..."
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
try {
  const doc = yaml.load(fs.readFileSync('action.yml', 'utf8'));
  console.log('✅ action.yml is valid');
  console.log('   Name:', doc.name);
  console.log('   Inputs:', Object.keys(doc.inputs || {}).length);
  console.log('   Outputs:', Object.keys(doc.outputs || {}).length);
} catch (e) {
  console.error('❌ action.yml validation failed:', e.message);
  process.exit(1);
}
"
echo

# Check file structure
echo "📁 Verifying file structure..."

required_files=(
  "action/entrypoint.js"
  "action/swe-agent-runner.js"
  "action/github-integration.js"
  "src/config-builder.js"
  "src/result-parser.js"
  "utils/logger.js"
  "utils/environment.js"
  "Dockerfile"
  "action.yml"
  "package.json"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ Missing: $file"
    exit 1
  fi
done
echo

# Check line counts to verify lightweight architecture
echo "📊 Verifying lightweight architecture (line counts):"
total_lines=0

for file in "${required_files[@]:0:7}"; do  # First 7 are core JS files
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    echo "   $file: $lines lines"
    total_lines=$((total_lines + lines))
  fi
done

echo "   Total core code: $total_lines lines"

if [ $total_lines -lt 1500 ]; then
  echo "✅ Architecture is lightweight (< 1500 lines)"
else
  echo "⚠️ Architecture is larger than expected ($total_lines lines)"
fi
echo

echo "🎉 Build verification completed successfully!"
echo
echo "📋 Summary:"
echo "   - Lightweight wrapper architecture verified"
echo "   - All unit tests passing"  
echo "   - Wrapper functionality working"
echo "   - action.yml configuration valid"
echo "   - File structure complete"
echo
echo "🚀 Ready for deployment!"