#!/bin/bash
# Comprehensive MCP Server Diagnostic Script

set -e

echo "🔬 ServalSheets v1.3.0 - Comprehensive Diagnostics"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
}

fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠ WARN:${NC} $1"
}

section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 1. BUILD & VERSION CHECK
section "1. BUILD & VERSION CHECK"

if [ -f "dist/cli.js" ]; then
    pass "dist/cli.js exists"
else
    fail "dist/cli.js not found - run npm run build"
    exit 1
fi

VERSION=$(node dist/cli.js --version 2>&1 | grep -o 'v[0-9.]*' || echo "UNKNOWN")
if [ "$VERSION" = "v1.3.0" ]; then
    pass "Version: $VERSION"
else
    fail "Version mismatch: $VERSION (expected v1.3.0)"
fi

# 2. TYPESCRIPT CHECK
section "2. TYPESCRIPT COMPILATION"

echo "Running typecheck..."
if npm run typecheck > /dev/null 2>&1; then
    pass "TypeScript: 0 errors"
else
    fail "TypeScript errors found"
    npm run typecheck 2>&1 | grep "error TS" | head -10
fi

# 3. CODE QUALITY CHECKS
section "3. CODE QUALITY CHECKS"

# Check for taskStore usage issues
echo "Checking taskStore usage patterns..."
TASKSTORE_ISSUES=$(grep -n "extra\.taskStore\.isTaskCancelled\|extra\.taskStore\.getCancellationReason\|extra\.taskStore\.cancelTask" src/server.ts || true)
if [ -z "$TASKSTORE_ISSUES" ]; then
    pass "No incorrect taskStore usage (extra.taskStore for cancellation)"
else
    fail "Found incorrect taskStore usage:"
    echo "$TASKSTORE_ISSUES"
fi

# Check for proper this.taskStore usage
CORRECT_USAGE=$(grep -n "this\.taskStore\.isTaskCancelled\|this\.taskStore\.getCancellationReason\|this\.taskStore\.cancelTask" src/server.ts | wc -l | tr -d ' ')
if [ "$CORRECT_USAGE" -gt "0" ]; then
    pass "Found $CORRECT_USAGE correct cancellation method calls (this.taskStore)"
else
    warn "No cancellation method calls found (might not be implemented)"
fi

# 4. TASK HANDLING CHECK
section "4. TASK HANDLING IMPLEMENTATION"

# Check if createToolTaskHandler exists
if grep -q "private createToolTaskHandler" src/server.ts; then
    pass "createToolTaskHandler method exists"
else
    fail "createToolTaskHandler method not found"
fi

# Check if tools are registered with task support
if grep -q "registerToolTask" src/server.ts; then
    pass "Task tool registration code exists"
else
    warn "No task tool registration found"
fi

# Check TOOL_EXECUTION_CONFIG
if grep -q "sheets_values.*taskSupport.*optional" src/mcp/features-2025-11-25.ts; then
    pass "sheets_values has task support enabled"
else
    fail "sheets_values task support not configured"
fi

# 5. HANDLER REGISTRATION
section "5. HANDLER REGISTRATION"

echo "Checking handler existence..."
HANDLERS=("values" "spreadsheet" "analysis" "confirm" "analyze")
for handler in "${HANDLERS[@]}"; do
    if [ -f "src/handlers/${handler}.ts" ]; then
        pass "Handler exists: ${handler}.ts"
    else
        fail "Missing handler: ${handler}.ts"
    fi
done

# 6. CANCELLATION INFRASTRUCTURE
section "6. CANCELLATION INFRASTRUCTURE"

# Check TaskStore interface
if grep -q "isTaskCancelled.*Promise<boolean>" src/core/task-store.ts; then
    pass "TaskStore.isTaskCancelled() defined"
else
    fail "TaskStore.isTaskCancelled() not found"
fi

if grep -q "getCancellationReason.*Promise<string" src/core/task-store.ts; then
    pass "TaskStore.getCancellationReason() defined"
else
    fail "TaskStore.getCancellationReason() not found"
fi

if grep -q "cancelTask.*Promise<void>" src/core/task-store.ts; then
    pass "TaskStore.cancelTask() defined"
else
    fail "TaskStore.cancelTask() not found"
fi

# Check TaskStoreAdapter
if grep -q "isTaskCancelled.*taskId.*Promise<boolean>" src/core/task-store-adapter.ts; then
    pass "TaskStoreAdapter.isTaskCancelled() implemented"
else
    fail "TaskStoreAdapter.isTaskCancelled() not found"
fi

# 7. ABORTCONTROLLER TRACKING
section "7. ABORTCONTROLLER TRACKING"

if grep -q "private taskAbortControllers.*Map<string, AbortController>" src/server.ts; then
    pass "AbortController tracking map exists"
else
    fail "AbortController tracking map not found"
fi

if grep -q "this\.taskAbortControllers\.set.*abortController" src/server.ts; then
    pass "AbortController is stored for tasks"
else
    fail "AbortController not stored"
fi

if grep -q "abortSignal.*extra\.abortSignal" src/server.ts; then
    pass "AbortSignal propagated to handlers"
else
    fail "AbortSignal not propagated"
fi

# 8. HANDLER CONTEXT
section "8. HANDLER CONTEXT"

if grep -q "abortSignal.*AbortSignal" src/handlers/base.ts; then
    pass "HandlerContext has abortSignal field"
else
    fail "HandlerContext missing abortSignal"
fi

if grep -q "requestId.*string" src/handlers/base.ts; then
    pass "HandlerContext has requestId field"
else
    fail "HandlerContext missing requestId"
fi

# 9. BUILD ARTIFACTS
section "9. BUILD ARTIFACTS"

EXPECTED_HANDLERS=("values" "spreadsheet" "analysis" "logging" "confirm" "analyze")
for handler in "${EXPECTED_HANDLERS[@]}"; do
    if [ -f "dist/handlers/${handler}.js" ]; then
        pass "Built handler: ${handler}.js"
    else
        fail "Missing built handler: ${handler}.js"
    fi
done

# 10. CONFIGURATION CHECK
section "10. CLAUDE DESKTOP CONFIGURATION"

CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [ -f "$CONFIG_PATH" ]; then
    pass "Claude Desktop config exists"

    # Check if servalsheets is configured
    if grep -q "servalsheets" "$CONFIG_PATH"; then
        pass "ServalSheets server configured"

        # Check CLI path
        CLI_PATH=$(grep -A 5 "servalsheets" "$CONFIG_PATH" | grep "args" | grep -o '"/[^"]*dist/cli.js"' || echo "NOT_FOUND")
        if [ "$CLI_PATH" != "NOT_FOUND" ]; then
            pass "CLI path configured: $CLI_PATH"
        else
            fail "CLI path not found in config"
        fi
    else
        fail "ServalSheets not in Claude Desktop config"
    fi
else
    warn "Claude Desktop config not found (might not be installed)"
fi

# 11. RUNTIME TEST
section "11. RUNTIME SMOKE TEST"

echo "Testing server startup..."
export OAUTH_CLIENT_ID="650528178356-0h36h5unaah4rqahieflo20f062976rf.apps.googleusercontent.com"
export OAUTH_CLIENT_SECRET="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"
export OAUTH_REDIRECT_URI="http://localhost:3000/callback"
export ENCRYPTION_KEY="b2637c6cda2a1e621df51e54b97ccca92e23048e4149dadcfd9b9e9e82ee15ca"
export GOOGLE_TOKEN_STORE_PATH="./servalsheets.tokens.enc"
export LOG_LEVEL="error"
export MCP_TRANSPORT="stdio"

# Test if server starts without crashing
if node dist/cli.js < /dev/null 2>&1 | head -1 | grep -q "ServalSheets"; then
    pass "Server starts without immediate crash"
else
    warn "Server startup check inconclusive"
fi

# SUMMARY
section "DIAGNOSTIC SUMMARY"

echo ""
echo "Review the output above for any failures or warnings."
echo ""
echo "Common issues:"
echo "  1. taskStore.isTaskCancelled is not a function"
echo "     → Check that this.taskStore is used (not extra.taskStore)"
echo ""
echo "  2. Tools not appearing in Claude Desktop"
echo "     → Restart Claude Desktop after rebuilding"
echo ""
echo "  3. Authentication errors"
echo "     → Check OAuth credentials in config"
echo ""
echo "Next steps:"
echo "  1. Fix any FAIL items above"
echo "  2. Rebuild: npm run build"
echo "  3. Restart Claude Desktop"
echo "  4. Test with: 'List my spreadsheets'"
echo ""
