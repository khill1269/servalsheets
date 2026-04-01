#!/usr/bin/env bash
# Post-deployment verification for ServalSheets on Fly.io
# Usage: bash scripts/fly-verify.sh [HOST]
# Default HOST: servalsheets.fly.dev

set -euo pipefail

HOST="${1:-servalsheets.fly.dev}"
BASE="https://$HOST"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }

echo "🔍 Verifying ServalSheets deployment at $BASE"
echo ""

# 1. Health
echo "1. Health checks"
LIVE=$(curl -sf "$BASE/health/live" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "err")
READY=$(curl -sf "$BASE/health/ready" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "err")
[ "$LIVE" = "200" ] && pass "/health/live → 200" || fail "/health/live → $LIVE"
[ "$READY" = "200" ] && pass "/health/ready → 200" || warn "/health/ready → $READY (may be degraded)"

# 2. Server card
echo ""
echo "2. Discovery endpoints"
MCP_STATUS=$(curl -sf "$BASE/.well-known/mcp.json" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "err")
[ "$MCP_STATUS" = "200" ] && pass "/.well-known/mcp.json → 200" || fail "/.well-known/mcp.json → $MCP_STATUS"

# Check server card content
MCP_VERSION=$(curl -sf "$BASE/.well-known/mcp.json" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('mcp_version','?'))" 2>/dev/null || echo "err")
[ "$MCP_VERSION" = "2025-11-25" ] && pass "mcp_version = 2025-11-25" || fail "mcp_version = $MCP_VERSION (expected 2025-11-25)"

TOOL_COUNT=$(curl -sf "$BASE/.well-known/mcp.json" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('capabilities',{}).get('tools',{}).get('count','?'))" 2>/dev/null || echo "err")
[ "$TOOL_COUNT" = "25" ] && pass "tools.count = 25" || fail "tools.count = $TOOL_COUNT (expected 25)"

OAUTH_STATUS=$(curl -sf "$BASE/.well-known/oauth-authorization-server" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "err")
[ "$OAUTH_STATUS" = "200" ] && pass "/.well-known/oauth-authorization-server → 200" || fail "/.well-known/oauth-authorization-server → $OAUTH_STATUS"

# 3. Transport
echo ""
echo "3. Streamable HTTP transport"
MCP_GET=$(curl -sf -X GET "$BASE/mcp" -H "Accept: application/json" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "err")
# GET /mcp without session should return 400 (no session) or 200
[ "$MCP_GET" = "400" ] || [ "$MCP_GET" = "200" ] && pass "GET /mcp → $MCP_GET (expected 400 or 200)" || fail "GET /mcp → $MCP_GET"

# SSE should be disabled (410 Gone)
SSE_STATUS=$(curl -sf "$BASE/sse" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "err")
[ "$SSE_STATUS" = "410" ] && pass "GET /sse → 410 Gone (legacy disabled)" || warn "GET /sse → $SSE_STATUS (expected 410)"

# 4. Tool hash manifest
echo ""
echo "4. Security endpoints"
HASH_STATUS=$(curl -sf "$BASE/.well-known/mcp/tool-hashes" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "err")
[ "$HASH_STATUS" = "200" ] && pass "/.well-known/mcp/tool-hashes → 200" || fail "/.well-known/mcp/tool-hashes → $HASH_STATUS"

echo ""
echo "════════════════════════════════════"
echo "  Deployment verification complete"
echo "  Host: $BASE"
echo "════════════════════════════════════"
