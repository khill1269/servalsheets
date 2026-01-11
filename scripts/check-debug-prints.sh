#!/bin/bash
# Check for debug prints (console.log/error/warn) in source code
# Part of Claude Code Rules best practices
# Excludes intentional console usage (CLI, resources, STDIO mode)

set -e

echo "🔍 Checking for debug prints in src/..."

# Create temporary file for results
TEMP_FILE=$(mktemp)

# Search for console.* in src/
# Exclude intentional usage:
#   - src/cli.ts (CLI output)
#   - src/cli/*.ts (CLI commands)
#   - src/resources/*.ts (MCP resource registration to stderr)
#   - src/storage/session-store.ts (session mode selection)
rg "console\.(log|error|warn)" src/ --type ts \
  --glob '!src/cli.ts' \
  --glob '!src/cli/*.ts' \
  --glob '!src/cli/**/*.ts' \
  --glob '!src/resources/*.ts' \
  --glob '!src/storage/session-store.ts' \
  -n 2>/dev/null > "$TEMP_FILE" || true

if [ -s "$TEMP_FILE" ]; then
  echo ""
  echo "⚠️  Found potential debug prints:"
  echo ""
  cat "$TEMP_FILE"
  echo ""
  echo "Fix: Replace with structured logging (logger.debug/error/warn)"
  echo "Example:"
  echo "  // Before"
  echo "  console.error('Failed:', error);"
  echo ""
  echo "  // After"
  echo "  logger.error('Failed to complete operation', { error });"
  echo ""
  echo "See: docs/development/CLAUDE_CODE_RULES.md"
  rm "$TEMP_FILE"
  exit 1
else
  echo "✅ No debug prints detected"
  rm "$TEMP_FILE"
  exit 0
fi
