#!/usr/bin/env bash

set -euo pipefail

HOST="${1:-servalsheets.fly.dev}"
BASE_URL="https://${HOST}"
FAILURES=0

check_endpoint() {
  local path="$1"
  local expected="$2"
  local label="$3"
  local status

  status="$(curl --max-time 10 -sS -o /tmp/fly-verify-body.txt -w '%{http_code}' "${BASE_URL}${path}" || true)"
  if [[ "${status}" == "${expected}" ]]; then
    printf 'PASS %-36s %s\n' "${label}" "${status}"
  else
    printf 'FAIL %-36s expected %s got %s\n' "${label}" "${expected}" "${status}"
    FAILURES=$((FAILURES + 1))
  fi
}

printf 'Verifying %s\n' "${BASE_URL}"

check_endpoint "/.well-known/mcp.json" "200" "MCP server card"
check_endpoint "/.well-known/oauth-authorization-server" "200" "OAuth authorization metadata"
check_endpoint "/.well-known/oauth-protected-resource" "200" "OAuth protected-resource metadata"
check_endpoint "/health/live" "200" "Liveness"
check_endpoint "/health/ready" "200" "Readiness"
check_endpoint "/info" "200" "Info"
check_endpoint "/.well-known/mcp/tool-hashes" "200" "Tool hash manifest"

if [[ "${FAILURES}" -gt 0 ]]; then
  printf '\nVerification failed: %s endpoint checks failed.\n' "${FAILURES}"
  exit 1
fi

printf '\nAll Fly verification checks passed.\n'
