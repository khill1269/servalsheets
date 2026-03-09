#!/usr/bin/env bash
# Check file sizes and alert on growth beyond thresholds
#
# Two-tier threshold system:
#   Standard: Handlers 800 lines, Services 800 lines, Servers 1500 lines
#   Budget overrides: Known large files have explicit size budgets (current size + ~10%)
#     These budgets prevent further growth while decomposition work in TASKS.md P18-D reduces them.
#     Reduce a file's budget override when its actual decomposition is complete.
#
# Warn at 80% of threshold, fail at 100%.

set -euo pipefail

# ANSI colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Standard thresholds (for files not in budget overrides)
SERVER_THRESHOLD=1500
HANDLER_THRESHOLD=800
SERVICE_THRESHOLD=800
WARNING_PERCENT=80

EXIT_CODE=0
WARNINGS=0
ERRORS=0
TOTAL=0
LEGACY_OVERRIDES=0

echo -e "${BLUE}📏 Checking file sizes...${NC}"
echo ""

# Per-file budget overrides for known large files.
# Each value is set to current line count + ~10% (rounded up to nearest 50).
# These prevent further growth while the decomposition work tracked in TASKS.md P18-D is in progress.
# When a file is decomposed, remove its override here.
#
# Format: bash 3-compatible case statement (macOS default bash is v3)
get_budget_override() {
  local file="$1"
  local default_threshold="$2"
  case "$file" in
    # ── Servers ──────────────────────────────────────────────────────────────
    # ── Abstract Base (not a handler, not decomposable the same way) ─────────
    # base.ts: 1569 lines — BaseHandler abstract class; inherently large
    "src/handlers/base.ts")    echo 1750 ;;

    # ── Handlers — large due to action count (TASKS.md P18-D) ────────────────
    # Action counts are the primary driver of handler size.
    # bigquery.ts: 1878 lines, 17 actions
    "src/handlers/bigquery.ts")      echo 2100 ;;
    # dimensions.ts: 2070 lines, 30 actions
    "src/handlers/dimensions.ts")    echo 2300 ;;
    # appsscript.ts: 1447 lines, 18 actions
    "src/handlers/appsscript.ts")    echo 1600 ;;
    # analyze.ts: 970 lines, 21 actions
    "src/handlers/analyze.ts")       echo 1100 ;;
    # compute.ts: 1341 lines, 10 actions
    "src/handlers/compute.ts")       echo 1500 ;;
    # fix.ts: 1178 lines, 6 actions
    "src/handlers/fix.ts")           echo 1300 ;;
    # dependencies.ts: 985 lines, 10 actions
    "src/handlers/dependencies.ts")  echo 1100 ;;
    # session.ts: 909 lines, 27 actions
    "src/handlers/session.ts")       echo 1000 ;;
    # history.ts: 806 lines, 10 actions
    "src/handlers/history.ts")       echo 900  ;;

    # ── Services — complex stateful services (not decomposed yet) ────────────
    # google-api.ts: 1827 lines — core API client with retry/circuit breaker
    "src/services/google-api.ts")           echo 2050 ;;
    # transaction-manager.ts: 1577 lines — transaction state machine
    "src/services/transaction-manager.ts")  echo 1750 ;;
    # session-context.ts: 1428 lines — session state manager
    "src/services/session-context.ts")      echo 1600 ;;
    # impact-analyzer.ts: 1287 lines — dependency impact analysis
    "src/services/impact-analyzer.ts")      echo 1450 ;;
    # agent-engine.ts: 1165 lines — agent plan/execute engine
    "src/services/agent-engine.ts")         echo 1300 ;;
    # batching-system.ts: 1028 lines — intent → batchUpdate compiler
    "src/services/batching-system.ts")      echo 1150 ;;
    # webhook-manager.ts: 894 lines — webhook delivery
    "src/services/webhook-manager.ts")      echo 1000 ;;

    # All other files: use the standard threshold passed in
    *) echo "$default_threshold" ;;
  esac
}

check_file() {
  local file="$1"
  local default_threshold="$2"
  local category="$3"

  if [ ! -f "$file" ]; then
    return
  fi

  TOTAL=$((TOTAL + 1))

  local threshold
  threshold=$(get_budget_override "$file" "$default_threshold")

  local is_override=0
  if [ "$threshold" != "$default_threshold" ]; then
    is_override=1
  fi

  local lines
  lines=$(wc -l < "$file" | tr -d ' ')
  local warning_at=$((threshold * WARNING_PERCENT / 100))
  local percent=$((lines * 100 / threshold))

  if [ "$lines" -gt "$threshold" ]; then
    if [ "$is_override" -eq 1 ]; then
      echo -e "${RED}❌ $file: $lines lines (budget: $threshold) [$percent%] - $category [BUDGET EXCEEDED — update budget or decompose]${NC}"
    else
      echo -e "${RED}❌ $file: $lines lines (threshold: $threshold) [$percent%] - $category${NC}"
    fi
    ERRORS=$((ERRORS + 1))
    EXIT_CODE=1
  elif [ "$lines" -gt "$warning_at" ]; then
    if [ "$is_override" -eq 1 ]; then
      echo -e "${YELLOW}⚠  $file: $lines lines (budget: $threshold) [$percent%] - $category [size-budgeted]${NC}"
      LEGACY_OVERRIDES=$((LEGACY_OVERRIDES + 1))
    else
      echo -e "${YELLOW}⚠  $file: $lines lines (threshold: $threshold) [$percent%] - $category${NC}"
    fi
    WARNINGS=$((WARNINGS + 1))
  else
    if [ "$is_override" -eq 1 ]; then
      echo -e "${GREEN}✓  $file: $lines lines (budget: $threshold) [$percent%] - $category [size-budgeted]${NC}"
      LEGACY_OVERRIDES=$((LEGACY_OVERRIDES + 1))
    else
      echo -e "${GREEN}✓  $file: $lines lines (threshold: $threshold) [$percent%] - $category${NC}"
    fi
  fi
}

# Check server files
echo -e "${BLUE}Servers (standard threshold: ${SERVER_THRESHOLD} lines):${NC}"
check_file "src/server.ts" $SERVER_THRESHOLD "STDIO Server"
check_file "src/http-server.ts" $SERVER_THRESHOLD "HTTP Server"
check_file "src/remote-server.ts" $SERVER_THRESHOLD "Remote Server"
echo ""

# Check handler files
echo -e "${BLUE}Handlers (standard threshold: ${HANDLER_THRESHOLD} lines):${NC}"
for handler in src/handlers/*.ts; do
  if [ -f "$handler" ] && [ "$handler" != "src/handlers/index.ts" ]; then
    check_file "$handler" $HANDLER_THRESHOLD "Handler"
  fi
done
echo ""

# Check service files
echo -e "${BLUE}Services (standard threshold: ${SERVICE_THRESHOLD} lines):${NC}"
for service in src/services/*.ts; do
  if [ -f "$service" ] && [ "$service" != "src/services/index.ts" ]; then
    check_file "$service" $SERVICE_THRESHOLD "Service"
  fi
done
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Summary:${NC}"
echo "  Total files checked: $TOTAL"
echo "  Errors:   $ERRORS"
echo "  Warnings: $WARNINGS"
echo "  Passing:  $((TOTAL - ERRORS - WARNINGS))"
if [ "$LEGACY_OVERRIDES" -gt 0 ]; then
  echo "  Size-budgeted (decomp debt tracked in TASKS.md P18-D): $LEGACY_OVERRIDES"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All files within size limits${NC}"
  else
    echo -e "${YELLOW}⚠️  Some files approaching limits${NC}"
  fi
else
  echo -e "${RED}❌ Some files exceed size limits${NC}"
  echo ""
  echo "Suggested actions:"
  echo "  1. If this is a new file: extract helpers to separate modules"
  echo "  2. If this is a legacy file: update the budget in scripts/check-file-sizes.sh"
  echo "     and add a decomposition task to TASKS.md P18-D"
fi

exit $EXIT_CODE
