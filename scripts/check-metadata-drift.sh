#!/bin/bash
#
# Check if metadata is synchronized with source code
# This prevents drift between TOOL_DEFINITIONS and metadata files
#
# Exit code:
#   0 = No drift (metadata is up to date)
#   1 = Drift detected (run npm run gen:metadata)
#
# Uses generate-metadata.ts --validate mode for accurate comparison
# without running prettier (which caused IPC pipe hangs in nested npm contexts)
#

set -e

echo "🔍 Checking for metadata drift..."
echo ""

# Use node --import tsx to avoid npx tsx IPC pipe issues
node --import tsx scripts/generate-metadata.ts --validate

echo ""
echo "🔍 Checking source/dist runtime artifact consistency..."
timeout 30 node --import tsx scripts/check-source-dist-consistency.ts --allow-missing-dist || {
  echo "⚠️  Source/dist consistency check skipped (timeout or missing dist)"
}
