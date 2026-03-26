#!/bin/bash
# G7: Verify no Math.random() in handler/unit tests.
# Non-deterministic test data causes flaky test results.
# Excluded: chaos, live-api, e2e, benchmarks, load, simulation, performance, di, compliance
# (these test categories intentionally use randomness — chaos testing, live data generation,
# jitter in retry helpers, session ID generation, compliance request IDs).
# Also excludes *.integration.test.ts files (integration tests may use realistic random data).
#
# Pass condition: 0 matches

set -e

COUNT=$(rg "Math\.random\(\)" tests/ --type ts \
  --glob '!tests/benchmarks/**' \
  --glob '!tests/load/**' \
  --glob '!tests/simulation/**' \
  --glob '!tests/performance/**' \
  --glob '!tests/chaos/**' \
  --glob '!tests/live-api/**' \
  --glob '!tests/e2e/**' \
  --glob '!tests/di/**' \
  --glob '!tests/compliance/**' \
  --glob '!**/*.integration.test.ts' \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$COUNT" -gt 0 ]; then
  echo "❌ G7 FAILED: Found $COUNT Math.random() calls in test files"
  echo "   Use deterministic data instead (e.g., Array.from({ length: N }, (_, i) => i * 10))"
  rg "Math\.random\(\)" tests/ --type ts \
    --glob '!tests/benchmarks/**' \
    --glob '!tests/load/**' \
    --glob '!tests/simulation/**' \
    --glob '!tests/performance/**' \
    --glob '!tests/chaos/**' \
    --glob '!tests/live-api/**' \
    --glob '!tests/e2e/**' \
    --glob '!tests/di/**' \
    --glob '!tests/compliance/**' \
    --glob '!**/*.integration.test.ts'
  exit 1
fi

echo "✅ G7 test-determinism: 0 Math.random() calls in handler/unit/integration test files"
