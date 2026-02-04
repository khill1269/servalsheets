#!/bin/bash
# Run all live API tests sequentially with delays to avoid quota issues

cd "/Users/thomascahill/Documents/servalsheets 2"

declare -a results

test_files=(
  "sheets-auth.live.test.ts"
  "sheets-core.live.test.ts"
  "sheets-data.live.test.ts"
  "sheets-format.live.test.ts"
  "sheets-dimensions.live.test.ts"
  "sheets-visualize.live.test.ts"
  "sheets-collaborate.live.test.ts"
  "sheets-advanced.live.test.ts"
  "sheets-analyze.live.test.ts"
  "sheets-quality.live.test.ts"
  "sheets-fix.live.test.ts"
  "sheets-history.live.test.ts"
  "sheets-session.live.test.ts"
  "sheets-templates.live.test.ts"
  "sheets-webhook.live.test.ts"
  "sheets-transaction.live.test.ts"
  "sheets-composite.live.test.ts"
  "sheets-confirm.live.test.ts"
  "sheets-dependencies.live.test.ts"
  "sheets-appsscript.live.test.ts"
  "sheets-bigquery.live.test.ts"
)

echo "Starting Live API Test Suite at $(date)"
echo "========================================"
echo ""

for file in "${test_files[@]}"; do
  echo "--- Testing: $file ---"
  result=$(TEST_REAL_API=true npm test -- --run "tests/live-api/tools/$file" 2>&1 | grep -E "Test Files|Tests\s" | tail -2)
  echo "$result"
  echo ""
  
  # Extract pass/fail counts
  if echo "$result" | grep -q "failed"; then
    status="FAILED"
  else
    status="PASSED"
  fi
  
  results+=("$file: $status")
  
  echo "Waiting 15 seconds before next test..."
  sleep 15
done

echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
for r in "${results[@]}"; do
  echo "$r"
done
