#!/bin/bash
#
# Check if metadata is synchronized with source code
# This prevents drift between TOOL_DEFINITIONS and metadata files
#
# Exit code:
#   0 = No drift (metadata is up to date)
#   1 = Drift detected (run npm run gen:metadata)
#

set -e

echo "🔍 Checking for metadata drift..."

# Save current state
git add package.json src/schemas/index.ts server.json 2>/dev/null || true

# Run generator
npm run gen:metadata --silent

# Check for changes
if ! git diff --exit-code package.json src/schemas/index.ts server.json >/dev/null 2>&1; then
  echo ""
  echo "❌ METADATA DRIFT DETECTED!"
  echo ""
  echo "The following files are out of sync with TOOL_DEFINITIONS:"
  git diff --name-only package.json src/schemas/index.ts server.json 2>/dev/null || true
  echo ""
  echo "To fix:"
  echo "  npm run gen:metadata"
  echo "  git add package.json src/schemas/index.ts server.json"
  echo "  git commit -m 'chore: update metadata'"
  echo ""
  exit 1
fi

echo "✅ No metadata drift detected"
exit 0
