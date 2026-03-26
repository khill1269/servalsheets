#!/bin/bash
# G6: Verify no .passthrough() calls remain on top-level response schemas.
# .passthrough() on discriminated union arms allows arbitrary fields to reach
# MCP clients, defeating output validation.
#
# Pass condition: 0 matches

set -e

COUNT=$(rg "\.passthrough\(\)" src/schemas/ --type ts 2>/dev/null | wc -l | tr -d ' ')

if [ "$COUNT" -gt 0 ]; then
  echo "❌ G6 FAILED: Found $COUNT .passthrough() calls in src/schemas/"
  echo "   Replace with Zod default (.strip()) or explicit .strict():"
  rg "\.passthrough\(\)" src/schemas/ --type ts
  exit 1
fi

echo "✅ G6 schema-passthrough: 0 .passthrough() calls in schemas"
