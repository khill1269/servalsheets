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

# Rule 2: top-level handler files must not import sibling handler files
# Allowed: imports to *-actions/ submodules, base.ts, index.ts, helpers/
# Violation pattern: from './other-handler.js' (no slash in relative path → sibling file, not submodule)
HANDLER_CROSS=$(grep -rn "from '\./[a-zA-Z][a-zA-Z0-9-]*\.js'" src/handlers/*.ts 2>/dev/null \
  | grep -v "^src/handlers/index\.ts" \
  | grep -v "'./base\|'./index\|'./error-codes\|'./logging\|'./optimization" \
  || true)
if [ -n "$HANDLER_CROSS" ]; then
  echo "❌ Cross-handler sibling imports detected (use helpers/ for shared code):"
  echo "$HANDLER_CROSS"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ Architecture check failed with $ERRORS error(s)"
  exit 1
fi

echo "✅ Architecture constraints satisfied"
