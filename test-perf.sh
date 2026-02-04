#!/bin/bash
# Test ServalSheets performance

echo "Testing MCP server initialization..."
START=$(date +%s%3N)
timeout 5s node dist/cli.js << 'EOF' 2>&1 | head -20
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
EOF
END=$(date +%s%3N)
DURATION=$((END - START))
echo "Init time: ${DURATION}ms"
