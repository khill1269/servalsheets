#!/bin/bash
# Manual MCP Server Test Script

set -e

echo "🧪 ServalSheets MCP Server Manual Test"
echo "========================================"
echo ""

# Export environment
export OAUTH_CLIENT_ID="650528178356-0h36h5unaah4rqahieflo20f062976rf.apps.googleusercontent.com"
export OAUTH_CLIENT_SECRET="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"
export OAUTH_REDIRECT_URI="http://localhost:3000/callback"
export ENCRYPTION_KEY="b2637c6cda2a1e621df51e54b97ccca92e23048e4149dadcfd9b9e9e82ee15ca"
export GOOGLE_TOKEN_STORE_PATH="/Users/thomascahill/Documents/mcp-servers/servalsheets/servalsheets.tokens.enc"
export LOG_LEVEL="debug"
export MCP_TRANSPORT="stdio"
export CACHE_ENABLED="true"

echo "✅ Environment configured"
echo ""

# Create temp FIFO pipes for bidirectional communication
FIFO_TO_SERVER=$(mktemp -u)
FIFO_FROM_SERVER=$(mktemp -u)
mkfifo "$FIFO_TO_SERVER"
mkfifo "$FIFO_FROM_SERVER"

echo "📁 Created communication pipes"
echo ""

# Start server in background
echo "🚀 Starting MCP server..."
node dist/cli.js < "$FIFO_TO_SERVER" > "$FIFO_FROM_SERVER" 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"
echo ""

# Give server time to start
sleep 2

# Check if server is running
if ! ps -p $SERVER_PID > /dev/null; then
    echo "❌ Server failed to start"
    exit 1
fi

echo "✅ Server started successfully"
echo ""

# Test 1: Initialize
echo "📤 Test 1: Sending initialize request..."
cat > "$FIFO_TO_SERVER" << 'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{"listChanged":true},"sampling":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}}}
EOF

# Read response with timeout
echo "📥 Waiting for initialize response..."
if timeout 5 cat "$FIFO_FROM_SERVER"; then
    echo ""
    echo "✅ Initialize response received"
else
    echo "❌ No response within 5 seconds"
    kill $SERVER_PID 2>/dev/null
    rm -f "$FIFO_TO_SERVER" "$FIFO_FROM_SERVER"
    exit 1
fi

echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
rm -f "$FIFO_TO_SERVER" "$FIFO_FROM_SERVER"

echo ""
echo "✅ Test complete"
