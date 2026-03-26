#!/bin/bash
# G8: Verify no tautological test assertions that always pass regardless of value.
# Pattern: expect([true, false]).toContain(someValue) always passes.
#
# Pass condition: 0 matches

set -e

COUNT=$(rg 'expect\(\[.*(true|false).*(true|false).*\]\)\.(toContain|toMatchObject)' \
  tests/ --type ts 2>/dev/null | wc -l | tr -d ' ')

if [ "$COUNT" -gt 0 ]; then
  echo "❌ G8 FAILED: Found $COUNT tautological assertion(s) in test files"
  echo "   Replace with: expect(value).toBe(true) or expect(value).toBe(false)"
  rg 'expect\(\[.*(true|false).*(true|false).*\]\)\.(toContain|toMatchObject)' \
    tests/ --type ts
  exit 1
fi

echo "✅ G8 tautologies: 0 tautological assertions in test files"
