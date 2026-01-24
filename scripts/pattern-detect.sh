#!/bin/bash
# ServalSheets Pattern Detection Script
# Purpose: Automatically detect anti-patterns that could cause issues
# Usage: ./pattern-detect.sh /path/to/servalsheets

set -e

SERVAL_PATH="${1:-/Users/thomascahill/Documents/mcp-servers/servalsheets}"
HANDLERS_PATH="$SERVAL_PATH/src/handlers"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        ServalSheets Anti-Pattern Detection Script           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Scanning: $HANDLERS_PATH"
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

issues_found=0

echo "═══════════════════════════════════════════════════════════════"
echo "PATTERN 1: Explicit null assignments (should be property omission)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

results=$(grep -rn ": null[,}]" "$HANDLERS_PATH"/*.ts 2>/dev/null || true)
if [ -n "$results" ]; then
    echo -e "${RED}⚠️  FOUND: Explicit null assignments${NC}"
    echo "$results"
    issues_found=$((issues_found + 1))
else
    echo -e "${GREEN}✅ PASS: No explicit null assignments found${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "PATTERN 2: Ternary expressions with null fallback"
echo "═══════════════════════════════════════════════════════════════"
echo ""

results=$(grep -rn "\? .* : null" "$HANDLERS_PATH"/*.ts 2>/dev/null || true)
if [ -n "$results" ]; then
    echo -e "${RED}⚠️  FOUND: Ternary with null fallback${NC}"
    echo "$results"
    issues_found=$((issues_found + 1))
else
    echo -e "${GREEN}✅ PASS: No ternary null fallbacks found${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "PATTERN 3: Non-null assertions on API responses"
echo "═══════════════════════════════════════════════════════════════"
echo ""

results=$(grep -rn "\.data\.[a-zA-Z]*!" "$HANDLERS_PATH"/*.ts 2>/dev/null || true)
if [ -n "$results" ]; then
    echo -e "${YELLOW}⚠️  FOUND: Non-null assertions on response data${NC}"
    echo "$results"
    issues_found=$((issues_found + 1))
else
    echo -e "${GREEN}✅ PASS: No dangerous non-null assertions${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "PATTERN 4: Drive API calls count by file"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Checking Drive API usage..."
for file in "$HANDLERS_PATH"/*.ts; do
    if grep -q "this\.driveApi" "$file" 2>/dev/null; then
        filename=$(basename "$file")
        drive_count=$(grep -c "this\.driveApi" "$file" 2>/dev/null || echo "0")
        try_count=$(grep -c "try {" "$file" 2>/dev/null || echo "0")
        catch_count=$(grep -c "catch" "$file" 2>/dev/null || echo "0")
        echo "  $filename:"
        echo "    - Drive API references: $drive_count"
        echo "    - try blocks: $try_count"
        echo "    - catch blocks: $catch_count"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "PATTERN 5: Optional API clients in constructors"  
echo "═══════════════════════════════════════════════════════════════"
echo ""

results=$(grep -rn "driveApi\?" "$HANDLERS_PATH"/*.ts 2>/dev/null || true)
if [ -n "$results" ]; then
    echo -e "${YELLOW}⚠️  FOUND: Optional driveApi declarations${NC}"
    echo "$results"
else
    echo -e "${GREEN}✅ PASS: No optional API client declarations${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ $issues_found -eq 0 ]; then
    echo -e "${GREEN}✅ All critical pattern checks passed!${NC}"
else
    echo -e "${RED}⚠️  Found $issues_found potential issue patterns${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "RECOMMENDED ACTIONS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "1. For null assignments:"
echo "   ❌ parents: condition ? value : null"
echo "   ✅ ...(condition ? { parents: value } : {})"
echo ""
echo "2. For API calls:"
echo "   ❌ const result = await api.call();"  
echo "   ✅ try { const result = await api.call(); } catch (e) { ... }"
echo ""
echo "3. For response data:"
echo "   ❌ const id = response.data.id!;"
echo "   ✅ if (!response.data?.id) return error; const id = response.data.id;"
echo ""
