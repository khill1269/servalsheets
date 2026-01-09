# Enhanced Tool Description Template

Use this template for ALL tool descriptions to maximize Claude's effectiveness.

## Template Structure

```
[One-line summary]. [Supported actions list].

Quick Examples:
• [Action 1]: {example JSON with realistic values}
• [Action 2]: {example JSON with realistic values}
• [Action 3]: {example JSON with realistic values}

Performance Tips:
• [Optimization 1 with specific numbers/percentages]
• [Optimization 2 with specific technique]
• [Optimization 3 with quota/limit awareness]

Common Workflows:
1. After success → Use [tool_name] for [purpose]
2. Before running → Use [tool_name] for [validation]
3. For [scenario] → Combine with [tool_name]

Error Recovery:
• ERROR_CODE → [Specific fix with tool/action]
• ERROR_CODE → [Recovery strategy]
• ERROR_CODE → [Preventive measure]
```

## Example: sheets_values (Enhanced)

```
Read, write, append, clear, find, and replace cell values in Google Sheets ranges. Actions: read, write, append, clear, batch_read, batch_write, find, replace.

Quick Examples:
• Read range: {"action":"read","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10"}
• Write cell: {"action":"write","spreadsheetId":"1ABC...","range":"A1","values":[["Hello World"]]}
• Append row: {"action":"append","spreadsheetId":"1ABC...","range":"Sheet1","values":[["Q4","2024","Revenue"]]}
• Batch read: {"action":"batch_read","spreadsheetId":"1ABC...","ranges":["A1:B2","D1:E2"]}
• Find/replace: {"action":"replace","spreadsheetId":"1ABC...","range":"A1:Z100","find":"old","replacement":"new"}

Performance Tips:
• Use batch_read/batch_write for multiple ranges - saves 80% of API quota
• Specify exact ranges instead of entire sheets to reduce data transfer
• Use semantic ranges {"semantic":{"column":"Revenue"}} to find by header name
• Reading >10K cells? Enable majorDimension:"ROWS" for better performance

Common Workflows:
1. After reading large data → Use sheets_analysis for data quality checks
2. Before bulk writes → Use sheets_validation to verify no conflicts
3. For critical changes → Wrap in sheets_transaction for atomicity
4. After errors → Use sheets_history to see recent operations

Error Recovery:
• QUOTA_EXCEEDED → Switch to batch operations, wait 60s, reduce request frequency
• RANGE_NOT_FOUND → Verify sheet name spelling with sheets_spreadsheet action="get"
• PERMISSION_DENIED → Call sheets_auth action="status" then "login" if needed
• INVALID_RANGE → Check A1 notation syntax, ensure sheet exists
```

## Before/After Comparison

### Before (Current - Vague):
```
description: 'Read, write, append, and manipulate cell values in Google Sheets ranges. Actions: read (fetch values), write (update cells), append (add rows), clear (delete values), find (search), replace (find & replace), batch operations supported.'
```

### After (Enhanced - Specific):
```
[Full template above with examples, tips, workflows, errors]
```

## Impact

**What Claude Sees Before**:
- "I guess I need action and range... but what format?"
- "Should I use batch_read or read?"
- "What if I get an error?"

**What Claude Sees After**:
- Sees exact JSON format with realistic spreadsheetId
- Knows batch operations save 80% quota
- Knows to use sheets_validation before writes
- Knows exact recovery steps for each error

## Rules

1. **Always include 3-5 concrete examples** with realistic IDs
2. **Always quantify performance tips** (80% savings, 10K cells, 60s wait)
3. **Always suggest next steps** (after success, before running, for scenarios)
4. **Always map errors to fixes** (specific tool + action)
5. **Use realistic values** (Sheet1, A1:D10, not placeholder text)
6. **Keep total under 2000 chars** (SDK limit consideration)

## Application Order

1. sheets_values (most used - flagship example)
2. sheets_spreadsheet (second most used)
3. sheets_auth (critical for first-time users)
4. All remaining 20 tools in alphabetical order

## Verification

After applying template, verify:
```bash
# Check description length
grep -A 50 "name: 'sheets_values'" src/mcp/registration.ts | wc -c

# Check has examples
grep -A 50 "name: 'sheets_values'" src/mcp/registration.ts | grep -c "Quick Examples"

# Check has recovery
grep -A 50 "name: 'sheets_values'" src/mcp/registration.ts | grep -c "Error Recovery"
```
