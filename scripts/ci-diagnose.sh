#!/bin/bash
# ci-diagnose.sh — Local CI diagnostic tool for ServalSheets
# Usage: bash scripts/ci-diagnose.sh [--fix]
#
# Runs all CI checks locally and reports which ones pass/fail.
# With --fix flag, attempts to auto-fix common issues.

set -uo pipefail

FIX_MODE=false
if [[ "${1:-}" == "--fix" ]]; then FIX_MODE=true; fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
RESULTS=()

check() {
  local name="$1"
  shift
  printf "  %-45s" "$name"
  if OUTPUT=$("$@" 2>&1); then
    echo -e " ${GREEN}✅ PASS${NC}"
    RESULTS+=("pass|$name")
    ((PASS++))
    return 0
  else
    echo -e " ${RED}❌ FAIL${NC}"
    RESULTS+=("fail|$name|$OUTPUT")
    ((FAIL++))
    return 1
  fi
}

check_warn() {
  local name="$1"
  shift
  printf "  %-45s" "$name"
  if OUTPUT=$("$@" 2>&1); then
    echo -e " ${GREEN}✅ PASS${NC}"
    RESULTS+=("pass|$name")
    ((PASS++))
  else
    echo -e " ${YELLOW}⚠️  WARN${NC}"
    RESULTS+=("warn|$name|$OUTPUT")
    ((WARN++))
  fi
}

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    ServalSheets CI Diagnostic Tool               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Phase 1: Pre-flight checks
echo -e "${BLUE}Phase 1: Pre-flight${NC}"
check "Node.js available"          node --version
check "npm available"              npm --version
check "package-lock.json exists"   test -f package-lock.json
check "node_modules installed"     test -d node_modules
echo ""

# Phase 2: Script existence (validates package.json scripts)
echo -e "${BLUE}Phase 2: Script wiring${NC}"
SCRIPTS=(
  "validate:actions" "check:drift" "check:placeholders" "check:debug-prints"
  "check:silent-fallbacks" "check:architecture" "check:jwt-scope" "check:secrets"
  "check:zod-markers" "typecheck" "lint" "test:fast" "test:snapshots"
  "test:integration" "test:mcp-http-task-contract" "test:http-transport-failover"
  "build" "smoke" "validate:server-json"
)

for script in "${SCRIPTS[@]}"; do
  check "npm run $script exists" node -e "
    const pkg = require('./package.json');
    if (!pkg.scripts['$script']) { process.exit(1); }
  "
done
echo ""

# Phase 3: Quick validation checks
echo -e "${BLUE}Phase 3: Quick validations${NC}"
check      "Action metadata"          npm run validate:actions
check      "No placeholders"          npm run check:placeholders
check      "No debug prints"          npm run check:debug-prints
check      "No silent fallbacks"      npm run check:silent-fallbacks
check      "Architecture isolation"   npm run check:architecture
check      "JWT scope"                npm run check:jwt-scope
check      "No hardcoded secrets"     npm run check:secrets
check      "Zod schema markers"       npm run check:zod-markers
check      "Metadata drift"           timeout 120 npm run check:drift
check_warn "Integration wiring"       npm run check:integration-wiring
check_warn "Format check"             npm run format:check
check_warn "Metadata strict"          npm run check:metadata-strict
echo ""

# Phase 4: TypeScript
echo -e "${BLUE}Phase 4: TypeScript${NC}"
check "Type check (strict)"   npm run typecheck
echo ""

# Phase 5: Build
echo -e "${BLUE}Phase 5: Build${NC}"
check "Build succeeds"        npm run build
check "server.json valid"     npm run validate:server-json
echo ""

# Phase 6: Tests (fast only for diagnostics)
echo -e "${BLUE}Phase 6: Tests (fast suite)${NC}"
check "Fast tests pass"       npm run test:fast
echo ""

# Summary
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Results                                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Warned:  $WARN${NC}"
TOTAL=$((PASS + FAIL + WARN))
if [ "$TOTAL" -gt 0 ]; then
  PCT=$((PASS * 100 / TOTAL))
  echo -e "  Score:   ${PCT}%"
fi
echo ""

# Show failure details
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Failed checks:${NC}"
  for result in "${RESULTS[@]}"; do
    IFS='|' read -r status name detail <<< "$result"
    if [ "$status" = "fail" ]; then
      echo -e "  ${RED}✗${NC} $name"
      if [ -n "${detail:-}" ]; then
        echo "$detail" | head -5 | sed 's/^/    /'
      fi
    fi
  done
  echo ""
fi

# Auto-fix suggestions
if [ "$FAIL" -gt 0 ]; then
  echo -e "${YELLOW}Suggested fixes:${NC}"
  for result in "${RESULTS[@]}"; do
    IFS='|' read -r status name detail <<< "$result"
    if [ "$status" = "fail" ]; then
      case "$name" in
        *"Metadata drift"*)
          echo "  → npm run schema:commit"
          if $FIX_MODE; then
            echo "    Auto-fixing..."
            npm run schema:commit 2>/dev/null && echo "    Fixed!" || echo "    Failed to auto-fix"
          fi
          ;;
        *"node_modules"*)
          echo "  → npm ci"
          if $FIX_MODE; then
            echo "    Auto-fixing..."
            npm ci 2>/dev/null && echo "    Fixed!" || echo "    Failed to auto-fix"
          fi
          ;;
        *"Type check"*)
          echo "  → Fix TypeScript errors: npm run typecheck 2>&1 | head -20"
          ;;
        *"Build"*)
          echo "  → Check build: NODE_OPTIONS='--max-old-space-size=4096' npm run build 2>&1 | tail -20"
          ;;
        *"Fast tests"*)
          echo "  → Run verbose: npm run test:fast -- --reporter=verbose 2>&1 | tail -30"
          ;;
        *"exists"*)
          echo "  → Add missing script to package.json"
          ;;
      esac
    fi
  done
  echo ""
  if ! $FIX_MODE; then
    echo -e "Run with ${BLUE}--fix${NC} to auto-fix where possible: bash scripts/ci-diagnose.sh --fix"
  fi
fi

# Exit code
if [ "$FAIL" -gt 0 ]; then exit 1; else exit 0; fi