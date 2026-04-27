#!/bin/bash
# confidence-check.sh — PostToolUse hook
# Extracts file:line references from the last agent/tool output and verifies them.
# Injects additionalContext warning for any unverifiable reference.
#
# Fires on: all tool completions (matcher: "*")
# Exit 0 with JSON = inject additionalContext into conversation
# Exit 0 without JSON = allow silently

INPUT=$(cat)

# Only run for Agent tool completions (expensive check)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
if [ "$TOOL_NAME" != "Agent" ]; then
  exit 0
fi

# Extract file:line patterns from tool output
OUTPUT=$(echo "$INPUT" | python3 -c "
import json, sys, re
d = json.load(sys.stdin)
output = str(d.get('tool_output', ''))
# Match patterns like src/handlers/data.ts:342 or packages/mcp-http/src/foo.ts:100
refs = re.findall(r'(?:src|packages|tests|scripts)/[a-zA-Z0-9/_.-]+\.ts:([0-9]+)', output)
for ref in set(refs):
    print(ref)
" 2>/dev/null || echo "")

if [ -z "$OUTPUT" ]; then
  exit 0
fi

FAILURES=""
CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Verify each file:line reference
echo "$INPUT" | python3 -c "
import json, sys, re
d = json.load(sys.stdin)
output = str(d.get('tool_output', ''))
refs = re.findall(r'((?:src|packages|tests|scripts)/[a-zA-Z0-9/_.-]+\.ts):([0-9]+)', output)
for file_path, line_num in set(refs):
    print(f'{file_path}:{line_num}')
" 2>/dev/null | while IFS=: read -r FILE LINE; do
  FULL_PATH="$CWD/$FILE"
  if [ ! -f "$FULL_PATH" ]; then
    FAILURES="${FAILURES}⚠️  UNVERIFIED: $FILE:$LINE (file not found)\n"
    continue
  fi
  ACTUAL_LINE=$(sed -n "${LINE}p" "$FULL_PATH" 2>/dev/null || echo "")
  if [ -z "$ACTUAL_LINE" ]; then
    FAILURES="${FAILURES}⚠️  UNVERIFIED: $FILE:$LINE (line does not exist — file has $(wc -l < "$FULL_PATH") lines)\n"
  fi
done

if [ -n "$FAILURES" ]; then
  MSG="Agent output contains unverified file:line references:\n${FAILURES}\nBefore acting on these findings, verify with: Read(file, offset=LINE-2, limit=8)"
  python3 -c "
import json, sys
msg = sys.argv[1]
print(json.dumps({
    'hookSpecificOutput': {
        'hookEventName': 'PostToolUse',
        'additionalContext': msg
    }
}))
" "$MSG"
fi

exit 0
