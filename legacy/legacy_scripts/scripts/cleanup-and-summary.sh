#!/bin/bash
# Cleanup and Summary for SWE-Agent AIO Workflow
# Provides execution summary and cleanup

set -e

echo "📊 SWE-Agent AIO Execution Summary"
echo "=================================="
echo "🔍 Context Type: $CONTEXT_TYPE"
echo "⏱️ Execution Time: $EXECUTION_TIME"
echo "🔧 Patch Generated: $PATCH_GENERATED"
echo "🤖 Model Used: $MODEL_NAME"
echo "✅ AIO Workflow Complete"

echo "🧹 Cleaning up temporary files..."
rm -f /tmp/swe_agent_fix.patch

echo "🔔 SWE-Agent AIO workflow completed successfully!"
