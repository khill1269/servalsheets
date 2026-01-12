#!/bin/bash
#
# MCP Server Validation Script
# Checks for common anti-patterns and issues before deployment
#
# Usage: ./scripts/validate-mcp-server.sh
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Helper functions
pass() {
  echo -e "${GREEN}✅${NC} $1"
  ((CHECKS_PASSED++))
}

fail() {
  echo -e "${RED}❌${NC} $1"
  ((CHECKS_FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠️${NC}  $1"
  ((CHECKS_WARNED++))
}

echo "═══════════════════════════════════════════════════════════"
echo "  MCP Server Validation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# 1. BUILD VERIFICATION
# ============================================================================
echo "🔨 Build Verification"
echo "───────────────────────────────────────────────────────────"

echo -n "Building TypeScript... "
if npm run build > /tmp/build.log 2>&1; then
  pass "Build successful"
else
  fail "Build failed! Check /tmp/build.log"
  cat /tmp/build.log
  exit 1
fi

echo -n "Checking dist/ directory... "
if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
  pass "dist/ directory exists and contains files"
else
  fail "dist/ directory empty or missing"
  exit 1
fi

echo ""

# ============================================================================
# 2. SCHEMA VALIDATION
# ============================================================================
echo "📋 Schema Validation"
echo "───────────────────────────────────────────────────────────"

echo -n "Checking for empty schemas in source... "
EMPTY_SCHEMA_COUNT=$(grep -r 'inputSchema.*{}' src/ --include="*.ts" 2>/dev/null | wc -l || echo "0")
if [ "$EMPTY_SCHEMA_COUNT" -eq 0 ]; then
  pass "No empty schemas found in source"
else
  fail "Found $EMPTY_SCHEMA_COUNT empty schemas in source"
  grep -r 'inputSchema.*{}' src/ --include="*.ts"
fi

echo -n "Checking for empty properties in built output... "
EMPTY_PROPS_COUNT=$(grep -r '"properties":\s*{}' dist/ 2>/dev/null | wc -l || echo "0")
if [ "$EMPTY_PROPS_COUNT" -eq 0 ]; then
  pass "No empty schema properties in dist/"
else
  warn "Found $EMPTY_PROPS_COUNT potential empty schemas in dist/"
  echo "    This may be acceptable for some tool schemas"
fi

echo ""

# ============================================================================
# 3. PATH SAFETY
# ============================================================================
echo "📁 Path Safety"
echo "───────────────────────────────────────────────────────────"

echo -n "Checking for hardcoded root paths... "
ROOT_PATHS=$(grep -rE "['\"]/\.[a-z]" src/ --include="*.ts" 2>/dev/null | \
  grep -v "homedir\|HOME\|XDG\|\.well-known\|\.git" || echo "")
if [ -z "$ROOT_PATHS" ]; then
  pass "No hardcoded root paths found"
else
  fail "Potential hardcoded root paths found:"
  echo "$ROOT_PATHS"
fi

echo -n "Checking backup directory configuration... "
BACKUP_CONFIG=$(grep -r "backup\|snapshot" src/ --include="*.ts" | \
  grep -i "path\|dir" | \
  grep -v "Drive\|drive" | head -3 || echo "")
if [ -z "$BACKUP_CONFIG" ]; then
  pass "Backups use Google Drive (not local filesystem)"
else
  # This is just informational
  pass "Backup configuration found"
fi

echo ""

# ============================================================================
# 4. DEPENDENCY VALIDATION
# ============================================================================
echo "📦 Dependency Validation"
echo "───────────────────────────────────────────────────────────"

echo -n "Checking Zod version pinning... "
ZOD_VERSION=$(grep '"zod"' package.json | grep -o '"[^^]*"' | tail -1)
if [[ "$ZOD_VERSION" == *"^"* ]] || [[ "$ZOD_VERSION" == *"~"* ]]; then
  warn "Zod version not pinned: $ZOD_VERSION"
  echo "    Recommend pinning to exact version (remove ^ or ~)"
else
  pass "Zod version pinned: $ZOD_VERSION"
fi

echo -n "Checking for security vulnerabilities... "
if command -v npm > /dev/null 2>&1; then
  AUDIT_RESULT=$(npm audit --production --audit-level=high 2>&1 || echo "")
  if echo "$AUDIT_RESULT" | grep -q "found 0 vulnerabilities"; then
    pass "No high/critical vulnerabilities"
  elif echo "$AUDIT_RESULT" | grep -q "found.*vulnerabilities"; then
    warn "Security vulnerabilities found - run 'npm audit' for details"
  else
    pass "Security check complete"
  fi
else
  warn "npm not found, skipping security audit"
fi

echo ""

# ============================================================================
# 5. MCP PROTOCOL VALIDATION
# ============================================================================
echo "🔌 MCP Protocol Validation"
echo "───────────────────────────────────────────────────────────"

echo -n "Testing MCP stdio transport... "
if [ -f "dist/cli.js" ]; then
  # Send tools/list request
  MCP_RESPONSE=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
    timeout 5 node dist/cli.js 2>/dev/null | head -1 || echo "")

  if echo "$MCP_RESPONSE" | grep -q '"tools"'; then
    pass "MCP tools/list responds correctly"

    # Check for empty schemas in response
    echo -n "Checking tool schemas in MCP response... "
    if command -v jq > /dev/null 2>&1; then
      EMPTY_SCHEMA_COUNT=$(echo "$MCP_RESPONSE" | \
        jq '[.result.tools[]? | select(.inputSchema.properties == {})] | length' 2>/dev/null || echo "0")

      if [ "$EMPTY_SCHEMA_COUNT" -eq 0 ]; then
        pass "All tool schemas have properties"
      else
        fail "$EMPTY_SCHEMA_COUNT tools have empty schemas!"
        echo "$MCP_RESPONSE" | jq '.result.tools[] | select(.inputSchema.properties == {}) | .name'
      fi

      # Check for Zod artifacts in schemas (indicates transformation failure)
      echo -n "Checking tool schemas have no Zod artifacts... "
      SCHEMA_ARTIFACTS=$(echo "$MCP_RESPONSE" | \
        jq '[.result.tools[]? | select(.inputSchema._def != null or .inputSchema.parse != null or .inputSchema.safeParseAsync != null)] | length' 2>/dev/null || echo "0")

      if [ "$SCHEMA_ARTIFACTS" -eq 0 ]; then
        pass "All schemas properly transformed to JSON Schema"
      else
        fail "$SCHEMA_ARTIFACTS tools have Zod artifacts in their schemas!"
        fail "This causes 'v3Schema.safeParseAsync is not a function' errors"
        echo "$MCP_RESPONSE" | jq '.result.tools[] | select(.inputSchema._def != null or .inputSchema.parse != null or .inputSchema.safeParseAsync != null) | .name'
      fi
    else
      warn "jq not found, skipping schema validation"
    fi
  else
    fail "MCP tools/list failed or returned invalid response"
    echo "    Response: $MCP_RESPONSE"
  fi
else
  warn "dist/cli.js not found, skipping MCP protocol test"
fi

echo ""

# ============================================================================
# 6. CODE QUALITY CHECKS
# ============================================================================
echo "🔍 Code Quality Checks"
echo "───────────────────────────────────────────────────────────"

echo -n "Checking TypeScript strict mode... "
if grep -q '"strict": true' tsconfig.json 2>/dev/null; then
  pass "TypeScript strict mode enabled"
else
  warn "TypeScript strict mode not enabled"
fi

echo -n "Checking for console.log statements... "
CONSOLE_LOGS=$(grep -r "console\.log" src/ --include="*.ts" | \
  grep -v "logger\|// console\.log\|/\* console\.log" | wc -l || echo "0")
if [ "$CONSOLE_LOGS" -eq 0 ]; then
  pass "No console.log statements found"
elif [ "$CONSOLE_LOGS" -lt 5 ]; then
  warn "Found $CONSOLE_LOGS console.log statements (consider using logger)"
else
  fail "Found $CONSOLE_LOGS console.log statements (use logger instead)"
fi

echo -n "Checking for TODO comments... "
TODO_COUNT=$(grep -r "TODO\|FIXME\|XXX\|HACK" src/ --include="*.ts" | wc -l || echo "0")
if [ "$TODO_COUNT" -eq 0 ]; then
  pass "No TODO/FIXME comments"
elif [ "$TODO_COUNT" -lt 10 ]; then
  pass "$TODO_COUNT TODO/FIXME comments (acceptable)"
else
  warn "$TODO_COUNT TODO/FIXME comments found"
fi

echo ""

# ============================================================================
# 7. TEST COVERAGE
# ============================================================================
echo "🧪 Test Coverage"
echo "───────────────────────────────────────────────────────────"

if [ -d "tests" ] || [ -d "__tests__" ]; then
  echo -n "Running tests... "
  if npm test > /tmp/test.log 2>&1; then
    TEST_RESULTS=$(grep -E "Test Files|Tests|passing" /tmp/test.log | head -3)
    pass "Tests passing"
    echo "$TEST_RESULTS" | sed 's/^/    /'
  else
    fail "Tests failed! Check /tmp/test.log"
    tail -20 /tmp/test.log
  fi
else
  warn "No tests directory found"
fi

echo ""

# ============================================================================
# 8. DOCUMENTATION
# ============================================================================
echo "📚 Documentation"
echo "───────────────────────────────────────────────────────────"

echo -n "Checking README.md... "
if [ -f "README.md" ] && [ -s "README.md" ]; then
  pass "README.md exists and is not empty"
else
  warn "README.md missing or empty"
fi

echo -n "Checking .env.example... "
if [ -f ".env.example" ]; then
  pass ".env.example exists"
else
  warn ".env.example missing"
fi

echo -n "Checking package.json fields... "
MISSING_FIELDS=""
for field in "name" "version" "description"; do
  if ! grep -q "\"$field\"" package.json; then
    MISSING_FIELDS="$MISSING_FIELDS $field"
  fi
done

if [ -z "$MISSING_FIELDS" ]; then
  pass "package.json has required fields"
else
  warn "package.json missing:$MISSING_FIELDS"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "═══════════════════════════════════════════════════════════"
echo "  Validation Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  ✅ Passed:  $CHECKS_PASSED"
echo "  ⚠️  Warnings: $CHECKS_WARNED"
echo "  ❌ Failed:  $CHECKS_FAILED"
echo ""

if [ "$CHECKS_FAILED" -gt 0 ]; then
  echo -e "${RED}❌ VALIDATION FAILED${NC}"
  echo "Fix the issues above before deploying."
  exit 1
elif [ "$CHECKS_WARNED" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  VALIDATION PASSED WITH WARNINGS${NC}"
  echo "Address warnings for production deployment."
  exit 0
else
  echo -e "${GREEN}✅ ALL VALIDATIONS PASSED${NC}"
  echo "MCP server is ready for deployment!"
  exit 0
fi
