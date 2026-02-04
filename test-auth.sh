#!/bin/bash
set -e

echo "=== ServalSheets OAuth Test ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ No .env file found"
  echo "Run: npm run auth"
  exit 1
fi

# Check OAuth credentials
if ! grep -q "OAUTH_CLIENT_ID" .env; then
  echo "❌ Missing OAUTH_CLIENT_ID in .env"
  exit 1
fi

if ! grep -q "OAUTH_CLIENT_SECRET" .env; then
  echo "❌ Missing OAUTH_CLIENT_SECRET in .env"
  exit 1
fi

echo "✅ OAuth credentials configured"
echo ""

# Check tokens
if [ -f ~/.servalsheets/tokens.encrypted ]; then
  echo "✅ Tokens found: ~/.servalsheets/tokens.encrypted"
else
  echo "⚠️  No tokens found"
  echo "Run: npm run auth"
  exit 0
fi

echo ""
echo "=== Starting server for 5 seconds ==="
npm run start:http &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test health endpoint
echo ""
echo "=== Testing /health endpoint ==="
HEALTH=$(curl -s http://localhost:3000/health || echo "failed")

if [ "$HEALTH" = "failed" ]; then
  echo "❌ Server not responding"
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

echo "$HEALTH" | jq .

# Extract scope count
SCOPE_COUNT=$(echo "$HEALTH" | jq '.scopes | length' 2>/dev/null || echo "0")

echo ""
if [ "$SCOPE_COUNT" -eq 8 ]; then
  echo "✅ Full scopes configured ($SCOPE_COUNT/8)"
elif [ "$SCOPE_COUNT" -gt 0 ]; then
  echo "⚠️  Partial scopes ($SCOPE_COUNT/8)"
  echo "Re-authenticate: rm ~/.servalsheets/tokens.encrypted && npm run auth"
else
  echo "❌ No scopes or not authenticated"
fi

# Cleanup
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "=== Test Complete ==="
