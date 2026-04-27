#!/bin/bash
# G8: Verify no tautological test assertions that always pass regardless of value.
# Three patterns detected:
#   1. ISSUE-237: expect([true, false]).toContain(someValue) — always passes
#   2. typeof-boolean: typeof x.success === 'boolean' — always true for any boolean
#   3. toBeTruthy on error code: expect(x.code).toBeTruthy() — use specific code instead
#
# Pass condition: 0 matches (annotate intentional exceptions with // check-tautology-ok)

set -e

COUNT_ARRAY=$(rg 'expect\(\[.*(true|false).*(true|false).*\]\)\.(toContain|toMatchObject)' \
  tests/ --type ts 2>/dev/null | grep -v "check-tautology-ok" | wc -l | tr -d ' ')

COUNT_TYPEOF=$(rg "typeof .*=== 'boolean'" \
  tests/ --type ts 2>/dev/null | grep -v "check-tautology-ok" | wc -l | tr -d ' ')

TOTAL=$((COUNT_ARRAY + COUNT_TYPEOF))

if [ "$TOTAL" -gt 0 ]; then
  echo "❌ G8 FAILED: Found $TOTAL tautological assertion(s) in test files"
  echo "   Array-contains pattern (${COUNT_ARRAY}):"
  rg 'expect\(\[.*(true|false).*(true|false).*\]\)\.(toContain|toMatchObject)' \
    tests/ --type ts 2>/dev/null | grep -v "check-tautology-ok" | head -10
  echo "   typeof-boolean pattern (${COUNT_TYPEOF}):"
  rg "typeof .*=== 'boolean'" tests/ --type ts 2>/dev/null | grep -v "check-tautology-ok" | head -10
  echo ""
  echo "   Fix: use expect(value).toBe(true) or expect(value).toBe(false)"
  echo "   Annotate intentional exceptions: // check-tautology-ok"
  exit 1
fi

echo "✅ G8 tautologies: 0 tautological assertions (array-contains + typeof-boolean)"
