#!/bin/bash
# G12 (Advisory): Verify spreadsheets.get() calls outside cached-sheets-api.ts
# include a fields param to prevent full-payload fetches (5-50MB).
# Advisory only — does not fail the gate, but logs a warning.
#
# Pass condition: advisory warning (non-blocking)

VIOLATIONS=$(rg "spreadsheets\.get\(" src/ --type ts \
  --glob '!src/services/cached-sheets-api.ts' \
  -l 2>/dev/null)

if [ -n "$VIOLATIONS" ]; then
  echo "⚠️  G12 ADVISORY: Direct spreadsheets.get() calls found outside cached-sheets-api.ts"
  echo "   Ensure each call passes a 'fields' parameter to limit payload size."
  echo "   Files:"
  echo "$VIOLATIONS" | sed 's/^/     /'
else
  echo "✅ G12 sheets-fields: all spreadsheets.get() calls go through cached-sheets-api.ts"
fi

# Always exit 0 — advisory only
exit 0
