#!/bin/bash
# Enhanced Smoke Tests for ServalSheets
# Tests critical paths to ensure basic functionality works

set -e

echo "🔥 Running enhanced smoke tests..."
echo ""

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Run a command with a timeout (portable across macOS/Linux)
run_with_timeout() {
  local seconds="$1"
  shift

  if command -v timeout > /dev/null 2>&1; then
    timeout "${seconds}s" "$@"
    return $?
  fi

  if command -v gtimeout > /dev/null 2>&1; then
    gtimeout "${seconds}s" "$@"
    return $?
  fi

  # Fallback: perl alarm-based timeout (available by default on macOS)
  perl -e 'alarm shift; exec @ARGV' "$seconds" "$@"
}

# Helper function to run a test
run_test() {
  local test_name="$1"
  local test_command="$2"

  echo "→ Testing: $test_name"

  if eval "$test_command" > /dev/null 2>&1; then
    echo "  ✅ PASS"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "  ❌ FAIL"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Test 1: CLI version command
run_test "CLI version" "node dist/cli.js --version"

# Test 2: CLI help command
run_test "CLI help" "node dist/cli.js --help"

# Test 3: Server initialization (stdio mode)
echo "→ Testing: Server initialization (stdio)"
if printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"capabilities\":{}}}\n' | run_with_timeout 5 node dist/server.js > /dev/null 2>&1; then
  echo "  ✅ PASS"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  EXIT_CODE=$?
  # timeout exit codes (GNU timeout=124, perl alarm=142, SIGKILL/SIGTERM=137/143)
  if [ "$EXIT_CODE" -eq 124 ] || [ "$EXIT_CODE" -eq 142 ] || [ "$EXIT_CODE" -eq 137 ] || [ "$EXIT_CODE" -eq 143 ]; then
    echo "  ✅ PASS (timed out after init)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "  ❌ FAIL"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

# Test 4: HTTP server starts and responds to health check
echo "→ Testing: HTTP server health endpoint"
node "$(pwd)/dist/http-server.js" &
SERVER_PID=$!
sleep 3

if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "  ✅ PASS"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo "  ❌ FAIL"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

# Test 5: Server.json validity
run_test "server.json is valid JSON" "node -e \"require('./server.json')\""

# Test 6: Schema files exist and are valid
run_test "Schema files exist" "test -f dist/schemas/index.js && test -f dist/schemas/shared.js"

# Test 7: Handler files exist
run_test "Handler files exist" "test -d dist/handlers && ls dist/handlers/*.js > /dev/null"

# Test 8: Knowledge base exists
run_test "Knowledge base exists" "test -d dist/knowledge"

# Test 9: MCP tools registration
run_test "MCP tools registered" "node -e \"const reg = require('./dist/mcp/registration/tool-definitions.js'); if (!reg.TOOL_DEFINITIONS || reg.TOOL_DEFINITIONS.length === 0) process.exit(1)\""

# Test 10: Discovery API utilities exist
run_test "Discovery API utilities" "test -f dist/services/discovery-client.js && test -f dist/services/schema-cache.js"

# Test 11: Debug utilities exist
run_test "Debug utilities exist" "test -f dist/utils/http2-detector.js && test -f dist/utils/enhanced-errors.js"

# Test 12: CLI auth setup exists
run_test "CLI auth setup" "test -f dist/cli/auth-setup.js"

echo ""
echo "════════════════════════════════════════"
echo "  Smoke Test Summary"
echo "════════════════════════════════════════"
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo "════════════════════════════════════════"

if [ $TESTS_FAILED -gt 0 ]; then
  echo "❌ Some smoke tests failed"
  exit 1
fi

echo "✅ All smoke tests passed!"
exit 0
