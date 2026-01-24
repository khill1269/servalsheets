#!/bin/bash
# Watch monitoring output in real-time

echo "🔍 Watching ServalSheets Monitoring..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
  clear
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 ServalSheets Live Monitoring"
  echo "🕐 $(date '+%Y-%m-%d %H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  if [ -f /tmp/servalsheets_live_view.txt ]; then
    cat /tmp/servalsheets_live_view.txt
  else
    echo "⏳ Waiting for first tool call..."
    echo ""
    echo "Monitor PID: $(pgrep -f 'live-monitor' | head -1)"
    echo "Log file: ~/Library/Logs/Claude/mcp-server-ServalSheets.log"
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  sleep 3
done
