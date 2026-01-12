#!/bin/bash
# Script to add parameter inference to remaining handlers

# List of handlers that need parameter inference
HANDLERS="rules.ts analysis.ts advanced.ts charts.ts pivot.ts filter-sort.ts"

echo "Checking which handlers need parameter inference integration..."

cd src/handlers

for handler in $HANDLERS; do
  if [ -f "$handler" ]; then
    if grep -q "inferRequestParameters" "$handler"; then
      echo "✓ $handler - Already has inference"
    else
      echo "✗ $handler - Needs inference integration"
    fi
  else
    echo "? $handler - File not found"
  fi
done

echo ""
echo "To integrate manually:"
echo "1. Add after 'async handle(input:...' line:"
echo "   const inferredRequest = this.inferRequestParameters(input.request) as ActionType;"
echo ""
echo "2. Replace 'input.request' or 'request' with 'inferredRequest' in the handler logic"
echo ""
echo "3. Add after response is generated (before return):"
echo "   if (response.success) {"
echo "     this.trackContextFromRequest({"
echo "       spreadsheetId: inferredRequest.spreadsheetId,"
echo "       sheetId: 'sheetId' in inferredRequest ? ... : undefined,"
echo "       range: 'range' in inferredRequest ? ... : undefined,"
echo "     });"
echo "   }"
