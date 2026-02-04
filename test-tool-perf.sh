#!/bin/bash
# Profile ServalSheets tool execution to identify bottlenecks (macOS compatible)

echo "=== Testing Server Initialization Time ==="
time node dist/cli.js << 'EOF' 2>&1 | head -5
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
EOF
echo ""

echo "=== Testing Auth Status Call ==="
time node dist/cli.js << 'EOF' 2>&1 | grep -A 15 '"id":3' | head -20
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"notifications/initialized"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sheets_auth","arguments":{"request":{"action":"status"}}}}
EOF
