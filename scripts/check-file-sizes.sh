#!/usr/bin/env bash
# Check file sizes and alert on growth beyond thresholds
# Servers: 1500 lines, Handlers: 800 lines
# Warn at 80%, fail at 100%

set -euo pipefail

# ANSI colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Thresholds
SERVER_THRESHOLD=1500
HANDLER_THRESHOLD=800
WARNING_PERCENT=80

EXIT_CODE=0
WARNINGS=0
ERRORS=0
TOTAL=0

echo -e "${BLUE}📏 Checking file sizes...${NC}"
echo ""

check_file() {
  local file="$1"
  local threshold="$2"
  local category="$3"

  if [ ! -f "$file" ]; then
    return
  fi

  TOTAL=$((TOTAL + 1))

  local lines
  lines=$(wc -l < "$file" | tr -d ' ')
  local warning_at=$((threshold * WARNING_PERCENT / 100))
  local percent=$((lines * 100 / threshold))

  if [ "$lines" -gt "$threshold" ]; then
    echo -e "${RED}❌ $file: $lines lines (threshold: $threshold) [$percent%] - $category${NC}"
    ERRORS=$((ERRORS + 1))
    EXIT_CODE=1
  elif [ "$lines" -gt "$warning_at" ]; then
    echo -e "${YELLOW}⚠  $file: $lines lines (threshold: $threshold) [$percent%] - $category${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${GREEN}✓  $file: $lines lines (threshold: $threshold) [$percent%] - $category${NC}"
  fi
}

# Check server files
echo -e "${BLUE}Servers (threshold: ${SERVER_THRESHOLD} lines):${NC}"
check_file "src/server.ts" $SERVER_THRESHOLD "STDIO Server"
check_file "src/http-server.ts" $SERVER_THRESHOLD "HTTP Server"
check_file "src/remote-server.ts" $SERVER_THRESHOLD "Remote Server"
echo ""

# Check handler files
echo -e "${BLUE}Handlers (threshold: ${HANDLER_THRESHOLD} lines):${NC}"
for handler in src/handlers/*.ts; do
  if [ -f "$handler" ] && [ "$handler" != "src/handlers/index.ts" ]; then
    check_file "$handler" $HANDLER_THRESHOLD "Handler"
  fi
done
echo ""

# Check service files
echo -e "${BLUE}Services (threshold: ${HANDLER_THRESHOLD} lines):${NC}"
for service in src/services/*.ts; do
  if [ -f "$service" ] && [ "$service" != "src/services/index.ts" ]; then
    check_file "$service" $HANDLER_THRESHOLD "Service"
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
  echo "  1. Extract helper functions to separate modules"
  echo "  2. Split large handlers into sub-handlers"
  echo "  3. Move shared logic to service layer"
  echo "  4. Consider using composition over inheritance"
  echo "  5. Review if threshold increase is justified"
fi

exit $EXIT_CODE
