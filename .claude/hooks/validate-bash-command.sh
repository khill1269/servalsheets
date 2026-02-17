#!/bin/bash
# Validates bash commands before execution
# Prevents destructive operations without explicit user approval

COMMAND="$1"

# Block destructive commands
if echo "$COMMAND" | grep -qE "(rm -rf /|git reset --hard|git clean -fd|git push --force|git push -f)"; then
  echo "❌ Destructive command blocked: $COMMAND" >&2
  echo "This command requires explicit user approval." >&2
  exit 2
fi

# Warn on risky commands but allow
if echo "$COMMAND" | grep -qE "(rm -rf|DROP TABLE|DELETE FROM)"; then
  echo "⚠️  Warning: Potentially risky command: $COMMAND" >&2
fi

# Allow all other commands
exit 0
