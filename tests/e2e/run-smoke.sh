#!/usr/bin/env bash

################################################################################
# ServalSheets - E2E Smoke Test Runner
#
# Runs comprehensive E2E smoke tests against a deployed MCP server.
# Supports local startup, health waiting, and CI/CD integration.
#
# Usage:
#   ./run-smoke.sh                          # Run against localhost:3000
#   ./run-smoke.sh http://staging:3000      # Run against custom URL
#   ./run-smoke.sh --wait http://localhost:8000  # Wait for server to be healthy
#   ./run-smoke.sh --start-server           # Start server locally first
#   ./run-smoke.sh --help                   # Show help
#
# Exit Codes:
#   0 - All tests passed
#   1 - Test failures
#   2 - Setup/configuration error
#   3 - Server connection error
#
################################################################################

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-30000}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-10000}"
HEALTH_CHECK_INTERVAL=1000  # ms
VITEST_CONFIG="${PROJECT_ROOT}/tests/config/vitest.config.e2e.ts"

# Flags
WAIT_FOR_HEALTHY=false
START_SERVER=false
VERBOSE=false
SHOW_HELP=false

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Functions
################################################################################

log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✓${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
  echo -e "${RED}✗${NC} $*"
}

print_help() {
  cat <<EOF
ServalSheets E2E Smoke Test Runner

USAGE:
  ./run-smoke.sh [OPTIONS] [BASE_URL]

OPTIONS:
  --wait              Wait for server to be healthy before running tests
  --start-server      Start the server locally (requires npm and Node.js)
  --verbose           Enable verbose output
  --help              Show this help message

ARGUMENTS:
  BASE_URL           Server base URL (default: http://localhost:3000)
                     Example: http://staging:8000

ENVIRONMENT VARIABLES:
  BASE_URL           Override default server URL
  WAIT_TIMEOUT       Health check timeout in ms (default: 30000)
  REQUEST_TIMEOUT    Individual request timeout in ms (default: 10000)
  CI                 Set to 'true' to disable browser opening on OAuth

EXAMPLES:
  # Run against default localhost
  ./run-smoke.sh

  # Run against staging with health wait
  ./run-smoke.sh --wait http://staging.example.com:3000

  # Start server locally and run tests
  ./run-smoke.sh --start-server --wait

  # Run with custom timeout
  WAIT_TIMEOUT=60000 ./run-smoke.sh --wait http://localhost:8000

EOF
  exit 0
}

wait_for_health() {
  local url="$1"
  local timeout_ms="${2:-30000}"
  local start_time=$(date +%s%N | cut -b1-13)

  log_info "Waiting for server to be healthy at ${BLUE}${url}/health/live${NC}..."

  while true; do
    local current_time=$(date +%s%N | cut -b1-13)
    local elapsed=$((current_time - start_time))

    if [ $elapsed -gt $timeout_ms ]; then
      log_error "Server did not become healthy within ${timeout_ms}ms"
      return 1
    fi

    if timeout 5 curl -s -f "${url}/health/live" >/dev/null 2>&1; then
      log_success "Server is healthy!"
      return 0
    fi

    sleep 1
  done
}

start_local_server() {
  log_info "Starting ServalSheets server locally..."

  if ! command -v npm &>/dev/null; then
    log_error "npm not found. Please install Node.js and npm."
    return 2
  fi

  # Check if server is already running
  if timeout 2 curl -s -f "http://localhost:3000/health/live" >/dev/null 2>&1; then
    log_warning "Server already running on http://localhost:3000"
    BASE_URL="http://localhost:3000"
    return 0
  fi

  # Build if needed
  if [ ! -d "${PROJECT_ROOT}/dist" ]; then
    log_info "Building project..."
    cd "${PROJECT_ROOT}"
    npm run build 2>&1 | tail -20 || {
      log_error "Build failed"
      return 2
    }
  fi

  # Start server in background
  log_info "Starting MCP server on http://localhost:3000..."
  cd "${PROJECT_ROOT}"
  npm run start:http-server >/tmp/servalsheets-e2e.log 2>&1 &
  SERVER_PID=$!

  # Wait for it to be healthy
  if ! wait_for_health "http://localhost:3000" "${WAIT_TIMEOUT}"; then
    log_error "Failed to start server (PID: $SERVER_PID)"
    kill $SERVER_PID 2>/dev/null || true
    tail -50 /tmp/servalsheets-e2e.log
    return 3
  fi

  BASE_URL="http://localhost:3000"
  return 0
}

run_smoke_tests() {
  local base_url="$1"

  log_info "Running E2E smoke tests..."
  log_info "Server URL: ${BLUE}${base_url}${NC}"

  # Export environment variables for tests
  export BASE_URL="$base_url"
  export REQUEST_TIMEOUT="${REQUEST_TIMEOUT}"

  # Prepare test command
  local test_cmd=(
    npm
    run
    test
    --
    --config="${VITEST_CONFIG}"
    "tests/e2e/**/*.test.ts"
  )

  if [ "$VERBOSE" = true ]; then
    test_cmd+=(--reporter=verbose)
  fi

  # Run tests
  cd "${PROJECT_ROOT}"
  if "${test_cmd[@]}"; then
    return 0
  else
    return 1
  fi
}

generate_report() {
  local status="$1"
  local test_count="${2:-0}"
  local duration="${3:-0}"

  echo ""
  echo "==============================================="
  echo "E2E Smoke Test Report"
  echo "==============================================="
  echo "Server URL:     ${BASE_URL}"
  echo "Status:         $([ "$status" = "0" ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}")"
  echo "Exit Code:      $status"
  if [ -n "$test_count" ] && [ "$test_count" != "0" ]; then
    echo "Tests:          $test_count"
  fi
  if [ -n "$duration" ] && [ "$duration" != "0" ]; then
    echo "Duration:       ${duration}ms"
  fi
  echo "Timestamp:      $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "==============================================="
  echo ""
}

################################################################################
# Main
################################################################################

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
  --wait)
    WAIT_FOR_HEALTHY=true
    shift
    ;;
  --start-server)
    START_SERVER=true
    WAIT_FOR_HEALTHY=true
    shift
    ;;
  --verbose)
    VERBOSE=true
    shift
    ;;
  --help)
    print_help
    ;;
  http://*)
    BASE_URL="$1"
    shift
    ;;
  https://*)
    BASE_URL="$1"
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    print_help
    ;;
  esac
done

log_info "ServalSheets E2E Smoke Test Runner"
log_info "Project: $(basename ${PROJECT_ROOT})"

# Start server if requested
if [ "$START_SERVER" = true ]; then
  if ! start_local_server; then
    log_error "Failed to start server"
    exit 3
  fi
fi

# Wait for health if requested
if [ "$WAIT_FOR_HEALTHY" = true ]; then
  if ! wait_for_health "$BASE_URL" "$WAIT_TIMEOUT"; then
    log_error "Server is not healthy"
    exit 3
  fi
fi

# Check connectivity
log_info "Checking server connectivity..."
if ! timeout 5 curl -s -f "${BASE_URL}/ping" >/dev/null 2>&1; then
  log_error "Cannot connect to server at ${BASE_URL}"
  log_error "Make sure the server is running and accessible"
  exit 3
fi
log_success "Connected to server"

# Run tests
TEST_START_TIME=$(date +%s%N | cut -b1-13)
if run_smoke_tests "$BASE_URL"; then
  TEST_END_TIME=$(date +%s%N | cut -b1-13)
  TEST_DURATION=$((TEST_END_TIME - TEST_START_TIME))
  log_success "All smoke tests passed!"
  generate_report 0 "" "$TEST_DURATION"
  exit 0
else
  TEST_END_TIME=$(date +%s%N | cut -b1-13)
  TEST_DURATION=$((TEST_END_TIME - TEST_START_TIME))
  log_error "Smoke tests failed"
  generate_report 1 "" "$TEST_DURATION"
  exit 1
fi
