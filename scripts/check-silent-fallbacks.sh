#!/bin/bash
# Check for silent fallbacks (return {} or return undefined without logging)
# Part of Claude Code Rules enforcement (Rule 5: No Silent Fallbacks)

set -e

echo "🔍 Checking for silent fallbacks..."

# Create temporary file for results
TEMP_FILE=$(mktemp)

# Search for return {} or return undefined patterns
# Exclude test files
# Look back 3 lines to check for logger calls
rg -n "return \{\}|return undefined" src/ --type ts \
  --glob '!*.test.ts' \
  -B 3 2>/dev/null | \
  grep -v "logger\." | \
  grep -v "// OK: Explicit empty" | \
  grep -v "// Acceptable empty return" > "$TEMP_FILE" || true

if [ -s "$TEMP_FILE" ]; then
  echo ""
  echo "❌ Found potential silent fallbacks:"
  echo ""
  cat "$TEMP_FILE"
  echo ""
  echo "Fix: Add logging before returning empty values, or add comment '// OK: Explicit empty'"
  echo "See: docs/development/CLAUDE_CODE_RULES.md (Rule 5)"
  rm "$TEMP_FILE"
  exit 1
else
  echo "✅ No silent fallbacks detected"
  rm "$TEMP_FILE"
  exit 0
fi
