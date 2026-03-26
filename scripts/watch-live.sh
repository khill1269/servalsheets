#!/bin/bash
# Watch ServalSheets live activity

LOG_CANDIDATES=(
  "$HOME/Library/Logs/Claude/mcp-server-servalsheets.log"
  "$HOME/Library/Logs/Claude/mcp-server-ServalSheets.log"
  "$HOME/Library/Logs/Claude/mcp-server-servalsheets-new.log"
)
LOG_FILE="${LOG_CANDIDATES[0]}"
for candidate in "${LOG_CANDIDATES[@]}"; do
  if [ -f "$candidate" ]; then
    LOG_FILE="$candidate"
    break
  fi
done

echo "🔴 LIVE: Watching ServalSheets activity..."
echo "📁 Log: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Tail the log and filter for tool calls and responses
tail -f "$LOG_FILE" | grep --line-buffered -E "tools/call|Message from (client|server)" | while read -r line; do
  # Color code the output
  if echo "$line" | grep -q "tools/call"; then
    echo -e "\033[36m→\033[0m $line"
  else
    echo -e "\033[33m←\033[0m $line"
  fi
done
