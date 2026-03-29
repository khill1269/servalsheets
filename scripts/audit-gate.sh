#!/usr/bin/env bash
##
## ServalSheets - CI Audit Gate
##
## Single command pre-commit check. Ordered by speed with aggregated failures.
##
## Usage:
##   npm run audit:gate
##
## Gates (ordered by speed):
##   A1: TypeScript compiles           (~10s)
##   A2: No metadata drift             (~3s)
##   A3: Architecture boundaries       (~2s)
##   A4: Integration wiring            (~1s)
##   A5: No silent fallbacks           (~2s)
##   A6: No debug prints               (~2s)
##   A7: Action coverage passes        (~5s)
##   A8: Memory leak tests pass        (~3s)
##   A9: Contract tests pass           (~8s)
##   A10: Google API compliance         (~2s)
##   A11: MCP protocol compliance       (~5s)
##   A12: Dead-code baseline            (~7s)
##
## Exit 0 = all pass. Exit 1 = failure with clear message.
##

set -euo pipefail

# Colors (only if terminal supports it)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  NC=''
fi

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_GATES=12
START_TIME=$SECONDS

gate_pass() {
  local gate_name="$1"
  local duration="$2"
  echo -e "  ${GREEN}✓${NC} ${gate_name} ${YELLOW}(${duration}s)${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
}

gate_fail() {
  local gate_name="$1"
  local duration="$2"
  local details="${3:-}"
  echo -e "  ${RED}✗${NC} ${gate_name} ${YELLOW}(${duration}s)${NC}"
  if [ -n "$details" ]; then
    echo -e "    ${RED}→ ${details}${NC}"
  fi
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

run_gate() {
  local gate_name="$1"
  local cmd="$2"
  local gate_start=$SECONDS

  if eval "$cmd" > /dev/null 2>&1; then
    gate_pass "$gate_name" "$((SECONDS - gate_start))"
    return 0
  else
    gate_fail "$gate_name" "$((SECONDS - gate_start))"
    return 1
  fi
}

echo ""
echo "ServalSheets Audit Gate"
echo "══════════════════════════════════════"

# A1: TypeScript
echo ""
echo "Running ${TOTAL_GATES} gates..."
echo ""

run_gate "A1: TypeScript compiles" "npx tsc --noEmit" || true

# A2: Metadata drift
run_gate "A2: No metadata drift" "npm run check:drift" || true

# A3: Architecture boundaries
run_gate "A3: Architecture boundaries" "npm run check:architecture" || true

# A4: Integration wiring
run_gate "A4: Integration wiring" "npm run check:integration-wiring" || true

# A5: Silent fallbacks
run_gate "A5: No silent fallbacks" "npm run check:silent-fallbacks" || true

# A6: Debug prints
run_gate "A6: No debug prints" "npm run check:debug-prints" || true

# A7: Action coverage
run_gate "A7: Action coverage passes" "npx vitest run tests/audit/action-coverage.test.ts" || true

# A8: Memory leak tests
run_gate "A8: Memory leak tests pass" "npx vitest run tests/audit/memory-leaks.test.ts" || true

# A9: Contract tests
run_gate "A9: Contract tests pass" "npx vitest run tests/contracts/" || true

# A10: Google API compliance (network-optional — uses cache if available)
run_gate "A10: Google API compliance" \
  "node scripts/audit-google-api-compliance.mjs --offline-ok" || true

# A11: MCP protocol compliance (protocol version, features, tool schemas, transport)
run_gate "A11: MCP protocol compliance" \
  "npx vitest run tests/compliance/mcp-2025-11-25.test.ts tests/compliance/mcp-features.test.ts tests/compliance/mcp-evaluation-suite.test.ts tests/contracts/mcp-protocol.test.ts tests/contracts/mcp-http-transport-auth-security.test.ts tests/contracts/mcp-audit-docs.test.ts" || true

# A12: Dead-code baseline (non-writing; prevents regressions without dirtying worktree)
run_gate "A12: Dead-code baseline" "npm run check:dead-code:baseline" || true

# Summary
TOTAL_DURATION=$((SECONDS - START_TIME))
echo ""
echo "══════════════════════════════════════"

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "${GREEN}All ${TOTAL_GATES} gates passed${NC} in ${TOTAL_DURATION}s"
  echo ""
  exit 0
else
  echo -e "${RED}${FAIL_COUNT}/${TOTAL_GATES} gates failed${NC} (${PASS_COUNT} passed) in ${TOTAL_DURATION}s"
  echo ""
  exit 1
fi
