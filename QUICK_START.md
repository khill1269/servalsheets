# ServalSheets Quick Start Guide

**Version:** 1.3.0
**Tools:** 25
**Actions:** 195

---

## 🚀 Installation & Setup

### 1. Install
```bash
npm install
npm run build
```

### 2. Configure OAuth
```bash
# Set environment variables
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GOOGLE_TOKEN_STORE_PATH="$HOME/.servalsheets/tokens"

# Or create .env file
echo "GOOGLE_CLIENT_ID=your-client-id" > .env
echo "GOOGLE_CLIENT_SECRET=your-client-secret" >> .env
echo "GOOGLE_TOKEN_STORE_PATH=$HOME/.servalsheets/tokens" >> .env
```

### 3. Start Server
```bash
# CLI mode (stdio)
npm start

# HTTP mode (port 3000)
npm run start:http

# Production mode
npm run start:http:prod
```

---

## 🆕 New Features (v1.3.0)

### Composite Operations

**4 NEW high-level operations** that combine multiple API calls:

#### 1. Import CSV
```json
{
  "action": "import_csv",
  "spreadsheetId": "1ABC...",
  "sheet": "Sheet1",
  "csvData": "Name,Age,Email\nAlice,30,alice@test.com\nBob,25,bob@test.com",
  "mode": "replace",
  "hasHeader": true,
  "delimiter": ",",
  "skipEmptyRows": true,
  "trimValues": true
}
```

**Modes:**
- `replace` - Clear sheet first, then import
- `append` - Add to end of existing data
- `new_sheet` - Create new sheet for data

#### 2. Smart Append
```json
{
  "action": "smart_append",
  "spreadsheetId": "1ABC...",
  "sheet": "Sheet1",
  "data": [
    {"Name": "Charlie", "Age": 35, "Email": "charlie@test.com"},
    {"Name": "Diana", "Age": 28, "Email": "diana@test.com"}
  ],
  "matchHeaders": true,
  "createMissingColumns": false
}
```

**Features:**
- Automatically matches columns by header name
- Handles column order differences
- Optionally creates missing columns
- Preserves existing data and formatting

#### 3. Bulk Update
```json
{
  "action": "bulk_update",
  "spreadsheetId": "1ABC...",
  "sheet": "Sheet1",
  "updates": [
    {"Name": "Alice", "Age": 31, "Email": "alice.new@test.com"},
    {"Name": "Bob", "Department": "Engineering"}
  ],
  "keyColumn": "Name",
  "createMissing": false
}
```

**Features:**
- Updates rows by matching key column (like a primary key)
- Only modifies specified fields
- Preserves other column values
- Optionally creates missing rows

#### 4. Deduplicate
```json
{
  "action": "deduplicate",
  "spreadsheetId": "1ABC...",
  "sheet": "Sheet1",
  "columns": ["Email", "Name"],
  "keepFirst": true
}
```

**Features:**
- Removes duplicate rows based on specified columns
- Choose to keep first or last occurrence
- Preserves original row order
- Returns count of duplicates removed

### Metrics Dashboard

**NEW command to view API efficiency:**

```bash
# View dashboard
npm run metrics

# Get JSON output
npm run metrics --json

# Access raw Prometheus metrics (when server running)
curl http://localhost:3000/metrics
```

**Dashboard shows:**
- Total API calls vs estimated without optimization
- Efficiency gain percentage (typically 50-60%)
- Batching statistics
- Cache hit rate
- Cost savings
- Tool usage analytics
- Performance metrics

---

## 📖 Common Use Cases

### 1. Import Data from CSV

**Scenario:** You have CSV data to import into a spreadsheet

```json
{
  "tool": "sheets_composite",
  "arguments": {
    "action": "import_csv",
    "spreadsheetId": "1ABC...",
    "sheet": "Data Import",
    "csvData": "Product,Price,Stock\niPhone,999,50\nMacBook,1999,30",
    "mode": "new_sheet",
    "newSheetName": "Q1 Inventory"
  }
}
```

### 2. Sync External Data

**Scenario:** Regularly update spreadsheet with data from external system

```json
{
  "tool": "sheets_composite",
  "arguments": {
    "action": "bulk_update",
    "spreadsheetId": "1ABC...",
    "sheet": "Inventory",
    "updates": [
      {"SKU": "PROD001", "Stock": 45, "LastUpdated": "2026-01-09"},
      {"SKU": "PROD002", "Stock": 12, "LastUpdated": "2026-01-09"}
    ],
    "keyColumn": "SKU",
    "createMissing": true
  }
}
```

### 3. Clean Duplicate Data

**Scenario:** Remove duplicate entries from customer list

```json
{
  "tool": "sheets_composite",
  "arguments": {
    "action": "deduplicate",
    "spreadsheetId": "1ABC...",
    "sheet": "Customers",
    "columns": ["Email"],
    "keepFirst": true
  }
}
```

### 4. Append Survey Results

**Scenario:** Add new survey responses to existing data

```json
{
  "tool": "sheets_composite",
  "arguments": {
    "action": "smart_append",
    "spreadsheetId": "1ABC...",
    "sheet": "Survey Results",
    "data": [
      {"Timestamp": "2026-01-09", "Name": "John", "Rating": 5, "Comment": "Great!"},
      {"Timestamp": "2026-01-09", "Name": "Jane", "Rating": 4, "Comment": "Good"}
    ],
    "matchHeaders": true
  }
}
```

---

## 🛠️ Available Tools

### Core Tools (16)
1. `sheets_auth` - OAuth 2.1 authentication
2. `sheets_spreadsheet` - Spreadsheet operations
3. `sheets_sheet` - Sheet/tab operations
4. `sheets_values` - Cell values (read, write, append, etc.)
5. `sheets_cells` - Cell operations (notes, validation, etc.)
6. `sheets_format` - Cell formatting
7. `sheets_dimensions` - Rows & columns
8. `sheets_rules` - Conditional formatting
9. `sheets_charts` - Charts
10. `sheets_pivot` - Pivot tables
11. `sheets_filter_sort` - Filtering & sorting
12. `sheets_sharing` - Permissions
13. `sheets_comments` - Comments
14. `sheets_versions` - Version history
15. `sheets_analysis` - Data analysis
16. `sheets_advanced` - Advanced features

### Enterprise Tools (5)
17. `sheets_transaction` - Transaction management
18. `sheets_validation` - Data validation
19. `sheets_conflict` - Conflict detection
20. `sheets_impact` - Impact analysis
21. `sheets_history` - Operation history

### MCP-Native Tools (3)
22. `sheets_confirm` - User confirmation (Elicitation)
23. `sheets_analyze` - AI analysis (Sampling)
24. `sheets_fix` - Automated issue fixing

### Composite Tools (1)
25. `sheets_composite` - **NEW** - High-level operations

---

## ⚡ Performance Features

### 1. Automatic Batching
ServalSheets automatically batches operations:
- **20-40% API call reduction**
- Adaptive batch windows (50-100ms)
- Cross-tool batching

### 2. Request Deduplication
Prevents duplicate API calls:
- **25-76% reduction** in redundant calls
- Automatic detection
- Transparent to users

### 3. Intelligent Caching
Caches frequently accessed data:
- **15-30% reduction** in API calls
- Cache hit rates: 60-80%
- Automatic invalidation

### 4. HTTP/2
Modern protocol support:
- **5-15% latency reduction**
- Multiplexing enabled
- Connection reuse

**Combined:** **50-60% total API efficiency improvement**

---

## 📊 Monitoring

### Real-time Metrics

```bash
npm run metrics
```

Shows:
- API efficiency gains
- Cost savings (based on Google Sheets API pricing)
- Tool usage statistics
- Performance metrics

### Prometheus Metrics

When server is running:
```bash
curl http://localhost:3000/metrics
```

Available metrics:
- `servalsheets_tool_calls_total` - Total tool calls
- `servalsheets_google_api_calls_total` - Total API calls
- `servalsheets_batch_requests_total` - Batch operations
- `servalsheets_cache_hits_total` - Cache hits
- `servalsheets_cache_misses_total` - Cache misses

---

## 🔒 Safety Features

### 1. Dry-Run Mode
Test operations without executing:
```json
{
  "action": "write",
  "dryRun": true
}
```

### 2. User Confirmations
Prompt for confirmation on destructive operations via MCP Elicitation

### 3. Impact Analysis
Analyze impact before executing:
```json
{
  "tool": "sheets_impact",
  "arguments": {
    "action": "analyze",
    "spreadsheetId": "1ABC...",
    "operation": {
      "type": "delete_rows",
      "tool": "sheets_dimensions",
      "action": "delete_rows",
      "params": {"range": "A5:A10"}
    }
  }
}
```

### 4. Transactions
Execute multiple operations atomically:
```json
// Begin transaction
{"action": "begin", "spreadsheetId": "1ABC..."}

// Queue operations
{"action": "queue", "operation": {...}}

// Commit or rollback
{"action": "commit"}
```

---

## 🐛 Troubleshooting

### Authentication Issues

**Problem:** `AUTH_EXPIRED` or `TOKEN_NOT_FOUND`

**Solution:**
```json
{
  "tool": "sheets_auth",
  "arguments": {"action": "status"}
}
```

If not authenticated:
```json
{
  "tool": "sheets_auth",
  "arguments": {"action": "login"}
}
```

### API Rate Limits

**Problem:** `RATE_LIMIT_EXCEEDED`

**Solution:** ServalSheets automatically handles rate limits with:
- Circuit breaker with exponential backoff
- Cached data fallback
- Degraded mode

**Check efficiency:**
```bash
npm run metrics
```

### Performance Issues

**Problem:** Slow operations

**Solutions:**
1. Check metrics dashboard for API efficiency
2. Enable batching (automatic)
3. Use composite operations for multi-step tasks
4. Leverage caching

---

## 📚 Additional Resources

- **Full Documentation:** See `OPTIMIZATION_COMPLETE.md`
- **Technical Report:** See `FULL_FIX_COMPLETE.md`
- **API Reference:** See tool descriptions in `src/schemas/descriptions.ts`
- **Examples:** See `tests/handlers/` for comprehensive examples

---

## 🆘 Getting Help

### Run Tests
```bash
npm test
```

### Check Server Health
```bash
curl http://localhost:3000/health
```

### View Logs
Logs include request IDs for tracing:
```json
{
  "timestamp": "2026-01-09T21:00:00.000Z",
  "level": "info",
  "requestId": "req_abc123",
  "message": "Tool call completed",
  "tool": "sheets_values",
  "duration": 234
}
```

---

## 🎯 Next Steps

1. ✅ Install and configure
2. ✅ Start server
3. ✅ Authenticate with Google
4. ✅ Try composite operations
5. ✅ Monitor with metrics dashboard
6. ✅ Optimize with performance features

**Happy Spreadsheeting! 🎉**

---

*ServalSheets v1.3.0 - Production-Ready*
*25 Tools | 195 Actions | 98.1% Test Coverage*
