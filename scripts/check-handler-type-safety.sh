#!/bin/bash
# G9: Verify no 'as any' casts in src/handlers/.
# Type casts hide runtime errors and defeat TypeScript's safety guarantees.
# Fix the type definition instead of casting.
#
# Pass condition: 0 matches

set -e

COUNT=$(rg " as any" src/handlers/ --type ts 2>/dev/null | wc -l | tr -d ' ')

if [ "$COUNT" -gt 0 ]; then
  echo "❌ G9 FAILED: Found $COUNT 'as any' cast(s) in src/handlers/"
  echo "   Fix the type definition instead of casting to any."
  rg " as any" src/handlers/ --type ts
  exit 1
fi

echo "✅ G9 handler-types: 0 'as any' casts in src/handlers/"
