#!/bin/bash
# Check for silent fallbacks (return {} or return undefined without logging)
# Part of Claude Code Rules enforcement (Rule 5: No Silent Fallbacks)

set -e

echo "🔍 Checking for silent fallbacks..."

# Create temporary files
TEMP_FILE=$(mktemp)
FILTERED_FILE=$(mktemp)

# Search for return {} or return undefined patterns
# Exclude test files
# Look back 3 lines to check for logger calls or OK comments
rg -n "return \{\}|return undefined" src/ --type ts \
  --glob '!*.test.ts' \
  -B 3 2>/dev/null > "$TEMP_FILE" || true

# Filter out blocks that contain logger calls, explicit OK comments, or JSDoc comments
# Process in blocks separated by --
awk '
BEGIN { block = "" }
/^--$/ {
  if (block != "" && block !~ /logger\./ && block !~ /\/\/ OK: Explicit empty/ && block !~ /\/\/ Acceptable empty return/ && block !~ / \* /) {
    print block
    print ""
  }
  block = ""
  next
}
{ block = block $0 "\n" }
END {
  if (block != "" && block !~ /logger\./ && block !~ /\/\/ OK: Explicit empty/ && block !~ /\/\/ Acceptable empty return/ && block !~ / \* /) {
    print block
  }
}
' "$TEMP_FILE" > "$FILTERED_FILE"

if [ -s "$FILTERED_FILE" ]; then
  echo ""
  echo "❌ Found potential silent fallbacks:"
  echo ""
  cat "$FILTERED_FILE"
  echo ""
  echo "Fix: Add logging before returning empty values, or add comment '// OK: Explicit empty'"
  echo "See: docs/development/CLAUDE_CODE_RULES.md (Rule 5)"
  rm "$TEMP_FILE" "$FILTERED_FILE"
  exit 1
else
  echo "✅ No silent fallbacks detected"
  rm "$TEMP_FILE" "$FILTERED_FILE"
  exit 0
fi
