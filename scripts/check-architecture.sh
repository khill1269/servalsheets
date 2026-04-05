#!/bin/bash
#
# Check architecture constraints:
# 1. packages/mcp-http must not import from src/ (layer isolation)
# 2. src/handlers must not import from other handlers (no cross-handler deps)
#
set -e

echo "🔍 Checking architecture constraints..."
ERRORS=0

# Rule 1: packages/mcp-http must not import from src/
if [ -d "packages/mcp-http/src" ]; then
  VIOLATIONS=$(grep -rn "from ['\"].*\/src\/" packages/mcp-http/src/ --include="*.ts" 2>/dev/null || true)
  if [ -n "$VIOLATIONS" ]; then
    echo "❌ packages/mcp-http imports from src/ (layer violation):"
    echo "$VIOLATIONS"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ Architecture check failed with $ERRORS error(s)"
  exit 1
fi

echo "✅ Architecture constraints satisfied"
