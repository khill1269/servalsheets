# ServalSheets Testing Guide

## Common Errors & Solutions

### Error 1: "No result received from client-side tool execution"
**Cause:** Authentication required but not completed, or spreadsheet ID is invalid

**Solutions:**
1. First run auth status to check authentication:
   ```json
   {
     "action": "status"
   }
   ```
2. If not authenticated, run the login flow:
   ```json
   {
     "action": "login"
   }
   ```
3. Verify the spreadsheet ID exists and you have access to it

---

### Error 2: "Expected object, received string" for range
**Cause:** Range parameter must be an object, not a string

**WRONG:**
```json
{
  "action": "read",
  "spreadsheetId": "abc123",
  "range": "Sheet1!A1:D10"  ❌ String format
}
```

**CORRECT:**
```json
{
  "action": "read",
  "spreadsheetId": "abc123",
  "range": { "a1": "Sheet1!A1:D10" }  ✅ Object format
}
```

**Range Format Options:**
1. **A1 Notation** (most common):
   ```json
   { "a1": "Sheet1!A1:D10" }
   ```

2. **Named Range**:
   ```json
   { "namedRange": "SalesData" }
   ```

3. **Semantic Query**:
   ```json
   {
     "semantic": {
       "sheet": "Sheet1",
       "column": "Revenue",
       "includeHeader": true,
       "rowStart": 2,
       "rowEnd": 100
     }
   }
   ```

4. **Grid Range**:
   ```json
   {
     "grid": {
       "sheetId": 0,
       "startRowIndex": 0,
       "endRowIndex": 10,
       "startColumnIndex": 0,
       "endColumnIndex": 4
     }
   }
   ```

---

## Correct Tool Usage Examples

### 1. Authentication (No Auth Required)

**Check Status:**
```json
{
  "action": "status"
}
```

**Login:**
```json
{
  "action": "login"
}
```

### 2. Spreadsheet Operations

**Get Metadata:**
```json
{
  "action": "get",
  "spreadsheetId": "1abc...xyz"
}
```

**Create New:**
```json
{
  "action": "create",
  "title": "My New Spreadsheet"
}
```

### 3. Values Operations

**Read Values:**
```json
{
  "action": "read",
  "spreadsheetId": "1abc...xyz",
  "range": { "a1": "Sheet1!A1:D10" }
}
```

**Write Values (with dry run):**
```json
{
  "action": "write",
  "spreadsheetId": "1abc...xyz",
  "range": { "a1": "Sheet1!A1:B2" },
  "values": [
    ["Header 1", "Header 2"],
    ["Value 1", "Value 2"]
  ],
  "safety": {
    "dryRun": true,
    "createSnapshot": true
  }
}
```

**Append Rows:**
```json
{
  "action": "append",
  "spreadsheetId": "1abc...xyz",
  "range": { "a1": "Sheet1" },
  "values": [
    ["New Row 1 Col A", "New Row 1 Col B"],
    ["New Row 2 Col A", "New Row 2 Col B"]
  ]
}
```

### 4. Analysis Operations

**Data Quality Check:**
```json
{
  "action": "data_quality",
  "spreadsheetId": "1abc...xyz",
  "range": { "a1": "Sheet1!A1:Z100" }
}
```

**Formula Audit:**
```json
{
  "action": "formula_audit",
  "spreadsheetId": "1abc...xyz"
}
```

### 5. Format Operations

**Set Colors:**
```json
{
  "action": "set_colors",
  "spreadsheetId": "1abc...xyz",
  "range": { "a1": "Sheet1!A1:D1" },
  "backgroundColor": { "red": 0.26, "green": 0.52, "blue": 0.96 },
  "foregroundColor": { "red": 1.0, "green": 1.0, "blue": 1.0 }
}
```

### 6. Transaction Operations

**Begin Transaction:**
```json
{
  "action": "begin",
  "spreadsheetId": "1abc...xyz",
  "autoRollback": true
}
```

**Queue Operation:**
```json
{
  "action": "queue",
  "transactionId": "txn_12345",
  "operation": {
    "tool": "sheets_values",
    "action": "write",
    "args": {
      "range": { "a1": "Sheet1!A1:A1" },
      "values": [["Test"]]
    }
  }
}
```

**Commit:**
```json
{
  "action": "commit",
  "transactionId": "txn_12345"
}
```

---

## Testing with MCP Inspector

### Option 1: Use Inspector UI
```bash
npx @modelcontextprotocol/inspector inspector.json
```

Then use the UI to:
1. Select a tool from the dropdown
2. Fill in parameters using the correct format
3. Click "Execute"

### Option 2: Direct CLI Testing
```bash
# Test a tool directly
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sheets_auth","arguments":{"action":"status"}},"id":1}' | node dist/cli.js --stdio
```

### Option 3: Quick Test Script
```bash
chmod +x test-tools.sh
./test-tools.sh
```

---

## Testing New Prompts

### List All Prompts (should show 16):
```bash
echo '{"jsonrpc":"2.0","method":"prompts/list","id":1}' | node dist/cli.js --stdio | jq '.result.prompts'
```

### Test Performance Audit Prompt:
```bash
echo '{
  "jsonrpc":"2.0",
  "method":"prompts/get",
  "params":{
    "name":"performance_audit",
    "arguments":{
      "spreadsheetId":"1abc...xyz"
    }
  },
  "id":2
}' | node dist/cli.js --stdio | jq '.result'
```

### Test Advanced Migration Prompt:
```bash
echo '{
  "jsonrpc":"2.0",
  "method":"prompts/get",
  "params":{
    "name":"advanced_data_migration",
    "arguments":{
      "sourceSpreadsheetId":"1abc...xyz",
      "targetSpreadsheetId":"1def...uvw",
      "migrationType":"full"
    }
  },
  "id":3
}' | node dist/cli.js --stdio | jq '.result'
```

### Test Batch Optimizer Prompt:
```bash
echo '{
  "jsonrpc":"2.0",
  "method":"prompts/get",
  "params":{
    "name":"batch_optimizer",
    "arguments":{
      "operationType":"read",
      "operationCount":10,
      "spreadsheetId":"1abc...xyz"
    }
  },
  "id":4
}' | node dist/cli.js --stdio | jq '.result'
```

---

## Troubleshooting Checklist

### If tools don't work:
- ✅ Check authentication: `sheets_auth` with `action: "status"`
- ✅ Verify spreadsheet ID is valid and accessible
- ✅ Use correct parameter format (objects for ranges, not strings)
- ✅ Check that you have required permissions on the spreadsheet

### If prompts don't show up:
- ✅ Verify build completed: `npm run build`
- ✅ Check prompt count: Should be 16 total
- ✅ Verify dist/mcp/registration/prompt-registration.js exists

### If validation errors occur:
- ✅ Check schema format matches expectations
- ✅ Use `{ a1: "..." }` for ranges, not plain strings
- ✅ Ensure all required fields are provided
- ✅ Check that enum values match exactly (case-sensitive)

---

## Quick Reference: All 16 Prompts

### Onboarding (3):
1. `welcome` - First-time user intro
2. `test_connection` - Verify setup
3. `first_operation` - Guided first use

### Analysis & Transformation (4):
4. `analyze_spreadsheet` - Comprehensive analysis
5. `transform_data` - Safe data transformation
6. `create_report` - Generate formatted reports
7. `clean_data` - Data standardization

### Workflow (5):
8. `migrate_data` - Basic migration
9. `setup_budget` - Budget tracking setup
10. `import_data` - External data import
11. `setup_collaboration` - Sharing & permissions
12. `diagnose_errors` - Troubleshooting

### Error Recovery (1):
13. `recover_from_error` - AI-powered recovery

### Advanced Workflow (3) ⭐ NEW:
14. `advanced_data_migration` - Enterprise migration
15. `performance_audit` - Performance optimization
16. `batch_optimizer` - Batch operation conversion

---

## Need Help?

- 📖 Documentation: [README.md](README.md)
- 🐛 Issues: [GitHub Issues](https://github.com/khill1269/servalsheets/issues)
- 💡 Examples: [inspector.json](inspector.json) (60+ sample requests)
- 📊 MCP Spec: [modelcontextprotocol.io](https://spec.modelcontextprotocol.io)
