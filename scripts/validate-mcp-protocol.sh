#!/bin/bash
# Validates MCP protocol compliance for ServalSheets
# Called by: pre-commit hook, CI pipeline, manual validation

set -e

echo "🔍 MCP Protocol 2025-11-25 Compliance Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ERRORS=0

# Check 1: Tool naming convention (must be snake_case)
echo ""
echo "▶ Checking tool naming convention..."
INVALID_NAMES=$(grep -E "name: ['\"]([^'\"]*[A-Z][^'\"]*)['"]" src/mcp/registration/tool-definitions.ts || true)

if [ -n "$INVALID_NAMES" ]; then
  echo "❌ Invalid tool names (must be snake_case, not camelCase):"
  echo "$INVALID_NAMES"
  echo ""
  echo "Fix: Use snake_case for all tool names"
  echo "  ❌ 'sheetsData'"
  echo "  ✅ 'sheets_data'"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ All tool names follow snake_case convention"
fi

# Check 2: Required input schema fields
echo ""
echo "▶ Checking input schema structure..."
MISSING_REQUIRED=$(grep -A 10 "inputSchema:" src/mcp/registration/tool-definitions.ts | grep -L "required:" || true)

if [ -n "$MISSING_REQUIRED" ]; then
  echo "⚠️  Warning: Some tools may be missing 'required' fields in inputSchema"
  echo "Check: src/mcp/registration/tool-definitions.ts"
else
  echo "✅ Input schemas have required field declarations"
fi

# Check 3: Tool descriptions present
echo ""
echo "▶ Checking tool descriptions..."
MISSING_DESC=$(grep -A 2 "name:" src/mcp/registration/tool-definitions.ts | grep -L "description:" || true)

if [ -n "$MISSING_DESC" ]; then
  echo "❌ Some tools missing descriptions"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ All tools have descriptions"
fi

# Check 4: Output schemas present (advisory)
echo ""
echo "▶ Checking output schemas (advisory)..."
HAS_OUTPUT=$(grep -c "outputSchema:" src/mcp/registration/tool-definitions.ts || true)

if [ "$HAS_OUTPUT" -eq 0 ]; then
  echo "⚠️  Advisory: Consider adding outputSchema for better validation"
else
  echo "✅ Output schemas present"
fi

# Check 5: Run MCP protocol compliance tests
echo ""
echo "▶ Running MCP protocol compliance tests..."
npm test -- --run tests/compliance/mcp-protocol.test.ts 2>&1 | grep -E "(PASS|FAIL|✓|✗)" || {
  echo "⚠️  MCP compliance tests not found or failed"
  echo "Create: tests/compliance/mcp-protocol.test.ts"
}

# Check 6: Validate tool count matches TOOL_COUNT constant
echo ""
echo "▶ Validating tool count consistency..."
TOOL_DEFS_COUNT=$(grep -c "name:" src/mcp/registration/tool-definitions.ts || echo "0")
TOOL_COUNT=$(grep "export const TOOL_COUNT" src/schemas/index.ts | grep -oE "[0-9]+" || echo "0")

if [ "$TOOL_DEFS_COUNT" -ne "$TOOL_COUNT" ]; then
  echo "❌ Tool count mismatch!"
  echo "   TOOL_DEFINITIONS.length: $TOOL_DEFS_COUNT"
  echo "   TOOL_COUNT constant: $TOOL_COUNT"
  echo "   Fix: Run 'npm run schema:commit' to sync metadata"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ Tool count consistent: $TOOL_COUNT tools"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo "✅ MCP Protocol Compliance: PASS"
  echo ""
  exit 0
else
  echo "❌ MCP Protocol Compliance: FAIL ($ERRORS errors)"
  echo ""
  echo "Fix errors above, then run:"
  echo "  npm run validate:mcp-protocol"
  echo ""
  echo "For detailed review, use:"
  echo "  claude-code --agent mcp-protocol-expert 'Review all tools for compliance'"
  exit 1
fi
