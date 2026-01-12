# ServalSheets - Comprehensive Testing Guide

**Complete observability and tracing for all 208 actions across 26 tools**

## Overview

The test orchestrator provides systematic testing with:
- ✅ **Real-time progress tracking** - Live status updates during test execution
- ✅ **Structured logging** - Request tracing with full context
- ✅ **Test database** - All results stored in JSON format
- ✅ **Error analysis** - Detailed error logging throughout the flow
- ✅ **HTML reports** - Beautiful visualizations of test results
- ✅ **Observable execution** - See exactly what's happening in real-time

---

## Quick Start

### Run Full Test Suite

```bash
# Build the project
npm run build

# Run comprehensive test suite (all 208 actions)
npx tsx scripts/test-orchestrator.ts
```

### What You'll See

1. **Server Initialization**
   ```
   🚀 ServalSheets Comprehensive Test Suite
   Testing all 26 tools with 208 actions
   ================================================================================

   📋 Total tests: 208
   📁 Log file: test-logs/test-run-1234567890.jsonl
   💾 Database: test-results/test-run-1234567890.json

   🔧 Starting MCP server...
   ✅ MCP server ready
   ```

2. **Real-Time Progress Bar**
   ```
   [████████████████░░░░░░░░░░░░░░] 53.4% (111/208) ✓ 95 ✗ 12 ⊘ 3 🔐 1 | sheets_values.batch_write | ⏱ 2m 15s | ~1m 45s left
   ```

3. **Final Summary**
   ```
   ================================================================================
   📊 TEST RESULTS SUMMARY
   ================================================================================

   Total Tests:         208
   ✅ Passed:           150
   ❌ Failed:           10
   ⊘  Skipped:          3
   🔐 Auth Required:    45
   ⏱  Duration:         3m 42s
   ```

---

## Test Infrastructure Components

### 1. Enhanced Logger (`test-infrastructure/logger.ts`)

**Features:**
- Structured JSON logs (JSONL format)
- Request ID tracking
- Phase tracking (init, request, response, complete, error)
- Color-coded console output
- Automatic file writing

**Log Entry Structure:**
```typescript
{
  timestamp: "2026-01-12T10:30:45.123Z",
  level: "info",
  requestId: "req-1736679045123-abc123",
  tool: "sheets_values",
  action: "read",
  phase: "response",
  message: "Received MCP response",
  data: { hasResult: true, hasError: false },
  duration: 234
}
```

**Usage:**
```typescript
import { TestLogger } from './test-infrastructure/logger.js';

const logger = new TestLogger('./test-logs');

logger.info('req-123', 'sheets_auth', 'status', 'start', 'Starting test');
logger.error('req-123', 'sheets_values', 'read', 'error', 'API error', error);
```

---

### 2. Test Database (`test-infrastructure/test-db.ts`)

**Features:**
- JSON-based storage
- Real-time statistics
- Query by status, tool, or test ID
- Automatic duration calculation
- Retry tracking

**Test Case Structure:**
```typescript
{
  id: "sheets_values.read",
  tool: "sheets_values",
  action: "read",
  status: "pass",  // pending | running | pass | fail | skip | auth_required
  startTime: "2026-01-12T10:30:45.123Z",
  endTime: "2026-01-12T10:30:45.357Z",
  duration: 234,
  request: { action: "read", spreadsheetId: "...", range: "A1:D10" },
  response: { text: "Success..." },
  error: null,
  logs: ["req-123-entry-1", "req-123-entry-2"],
  retries: 0
}
```

**Usage:**
```typescript
import { TestDatabase } from './test-infrastructure/test-db.js';

const db = new TestDatabase('./test-results');

// Add test
db.addTestCase({ id: 'sheets_values.read', tool: 'sheets_values', action: 'read' });

// Update status
db.startTest('sheets_values.read', { action: 'read', ... });
db.passTest('sheets_values.read', { text: 'Success' });
db.failTest('sheets_values.read', new Error('Failed'));

// Query
const failures = db.getTestCasesByStatus('fail');
const valuesTests = db.getTestCasesByTool('sheets_values');
```

---

### 3. Progress Tracker (`test-infrastructure/progress.ts`)

**Features:**
- Real-time progress bar
- Live statistics (pass/fail/skip/auth)
- Time estimation (elapsed + remaining)
- Current test display
- Color-coded status

**Progress Bar Format:**
```
[████████████████░░░░░░░░░░░░░░] 53.4% (111/208) ✓ 95 ✗ 12 ⊘ 3 🔐 1 | sheets_values.batch_write | ⏱ 2m 15s | ~1m 45s left
```

- `████` = Completed tests
- `░` = Remaining tests
- `53.4%` = Progress percentage
- `(111/208)` = Current/Total tests
- `✓ 95` = Passed (green)
- `✗ 12` = Failed (red)
- `⊘ 3` = Skipped (yellow)
- `🔐 1` = Auth required (cyan)
- `sheets_values.batch_write` = Current test
- `⏱ 2m 15s` = Elapsed time
- `~1m 45s left` = Estimated remaining

---

## Test Results

### Output Files

After running tests, you'll find:

1. **Log File** (`test-logs/test-run-TIMESTAMP.jsonl`)
   - JSONL format (one JSON object per line)
   - Complete request/response tracing
   - All phases logged (init, request, response, error, complete)

2. **Log Summary** (`test-logs/test-run-TIMESTAMP-summary.json`)
   - Aggregated statistics
   - Error summary
   - Logs by level and tool

3. **Test Database** (`test-results/test-run-TIMESTAMP.json`)
   - All test cases with full details
   - Request/response data
   - Error details
   - Timing information

4. **HTML Report** (`test-results/report.html`)
   - Visual dashboard
   - Interactive table of all tests
   - Color-coded status badges
   - Statistics cards

---

## Understanding Test Statuses

### ✅ Pass
- Test executed successfully
- No errors in response
- Expected behavior confirmed

### ❌ Fail
- Test returned an error
- Unexpected behavior
- API/protocol errors

**Common failures:**
- Invalid spreadsheet ID
- Malformed request
- Missing required parameters
- API rate limits

### ⊘ Skip
- Test intentionally skipped
- Missing prerequisites
- Known issues

### 🔐 Auth Required
- Authentication needed
- Expected when no credentials configured
- Not counted as failures

**These are EXPECTED statuses** when running without authentication:
- Most write operations
- Spreadsheet creation
- Permission changes
- etc.

---

## Analyzing Results

### View Log Summary

```bash
cat test-logs/test-run-TIMESTAMP-summary.json | jq
```

Output:
```json
{
  "total": 2456,
  "byLevel": {
    "info": 1850,
    "debug": 500,
    "error": 106
  },
  "byTool": {
    "sheets_values": 450,
    "sheets_format": 380,
    ...
  },
  "errors": [...]
}
```

### Query Test Database

```bash
# Get all failures
cat test-results/test-run-TIMESTAMP.json | jq '.testCases[] | select(.status == "fail")'

# Get tests for specific tool
cat test-results/test-run-TIMESTAMP.json | jq '.testCases[] | select(.tool == "sheets_values")'

# Get tests with auth required
cat test-results/test-run-TIMESTAMP.json | jq '.testCases[] | select(.status == "auth_required")'

# Get average duration
cat test-results/test-run-TIMESTAMP.json | jq '[.testCases[].duration] | add / length'
```

### View HTML Report

```bash
open test-results/report.html
```

---

## Debugging Failed Tests

### Step 1: Check HTML Report

Open `test-results/report.html` and look for failed tests. Click on them to see error messages.

### Step 2: Find in Log File

```bash
# Search for specific test
grep "sheets_values.read" test-logs/test-run-TIMESTAMP.jsonl

# Find all errors
grep '"level":"error"' test-logs/test-run-TIMESTAMP.jsonl | jq
```

### Step 3: Analyze Request/Response

```bash
# Get full test case details
cat test-results/test-run-TIMESTAMP.json | jq '.testCases[] | select(.id == "sheets_values.read")'
```

This shows:
- Exact request sent
- Response received
- Error details
- Duration
- All associated log entries

### Step 4: Reproduce Manually

```bash
# Start MCP server
node dist/cli.js --stdio

# Send test request (use request from test database)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/cli.js --stdio

echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"sheets_values","arguments":{"action":"read","spreadsheetId":"...","range":"A1:D10"}}}' | node dist/cli.js --stdio
```

---

## Test Categories

### Read-Only Tests (60+ actions)
These should mostly pass without authentication if using a public spreadsheet:
- `sheets_spreadsheet.get`
- `sheets_spreadsheet.list`
- `sheets_sheet.list`
- `sheets_values.read`
- `sheets_analysis.*` (most actions)

### Write Tests (140+ actions)
These will show "auth_required" without credentials:
- `sheets_values.write`
- `sheets_format.*`
- `sheets_dimensions.*`
- `sheets_spreadsheet.create`

### MCP-Native Tests (8 actions)
Special tests using Elicitation/Sampling:
- `sheets_confirm.*`
- `sheets_analyze.*`
- `sheets_fix.*`

---

## Configuration

### Environment Variables

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Skip auth auto-open browser
export OAUTH_AUTO_OPEN_BROWSER=false

# Configure test spreadsheet
export TEST_SPREADSHEET_ID=your-spreadsheet-id
```

### Custom Test Arguments

Edit `scripts/test-orchestrator.ts` and modify the `getTestArgs()` function to customize test parameters:

```typescript
function getTestArgs(tool: string, action: string): any {
  const baseArgs = {
    sheets_values: {
      read: {
        action: 'read',
        spreadsheetId: process.env.TEST_SPREADSHEET_ID || TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      // ... more actions
    },
    // ... more tools
  };

  return baseArgs[tool]?.[action] || { action };
}
```

---

## Performance Benchmarking

The test orchestrator tracks duration for every test. Use this to:

1. **Identify slow operations**
   ```bash
   cat test-results/test-run-TIMESTAMP.json | jq '.testCases | sort_by(.duration) | reverse | .[0:10]'
   ```

2. **Calculate average by tool**
   ```bash
   cat test-results/test-run-TIMESTAMP.json | jq 'group_by(.tool) | map({tool: .[0].tool, avg: ([.[].duration] | add / length)})'
   ```

3. **Find timeout candidates** (tests > 5 seconds)
   ```bash
   cat test-results/test-run-TIMESTAMP.json | jq '.testCases[] | select(.duration > 5000)'
   ```

---

## Continuous Integration

### GitHub Actions

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npx tsx scripts/test-orchestrator.ts
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            test-results/
            test-logs/
```

---

## Troubleshooting

### Issue: MCP Server Timeout

**Symptom:** `Request timeout: initialize`

**Solution:**
1. Check server logs: `tail -f test-logs/test-run-TIMESTAMP.jsonl`
2. Increase timeout in `test-orchestrator.ts` (line ~85)
3. Check for port conflicts

### Issue: Too Many Failures

**Symptom:** Most tests failing

**Solutions:**
1. **Check authentication:** Most write operations need auth
2. **Verify spreadsheet ID:** Use a valid public spreadsheet
3. **Check API quota:** Google Sheets API has rate limits
4. **Review recent changes:** Did you modify handlers?

### Issue: Slow Test Execution

**Symptom:** Tests taking > 10 minutes

**Solutions:**
1. **Reduce delay between tests** (line ~450 in orchestrator)
2. **Run specific tool only** (filter `allTests` array)
3. **Increase MCP server timeout**
4. **Check network latency**

---

## Advanced Usage

### Test Specific Tool Only

Edit `test-orchestrator.ts`:

```typescript
// Only test sheets_values
const allTests = [];
const toolInfo = TOOL_REGISTRY.sheets_values;
for (const action of toolInfo.actions) {
  allTests.push({ tool: 'sheets_values', action });
}
```

### Retry Failed Tests

```bash
# Extract failed test IDs
cat test-results/test-run-TIMESTAMP.json | jq -r '.testCases[] | select(.status == "fail") | .id'

# Create retry script
cat test-results/test-run-TIMESTAMP.json | jq -r '.testCases[] | select(.status == "fail") | .id' > failed-tests.txt
```

### Custom Reporters

The test database is JSON, so you can create custom reports:

```typescript
import { TestDatabase } from './test-infrastructure/test-db.js';

const db = TestDatabase.load('./test-results/test-run-TIMESTAMP.json');

// Generate CSV
const csv = db.getTestCases().map(tc =>
  `${tc.tool},${tc.action},${tc.status},${tc.duration || 0}`
).join('\n');

console.log('tool,action,status,duration');
console.log(csv);
```

---

## Next Steps

1. **Run the full test suite** to establish a baseline
2. **Review HTML report** to identify patterns
3. **Fix high-priority failures** (non-auth related)
4. **Set up CI/CD** to run tests automatically
5. **Track metrics over time** (duration, success rate)

---

## Summary

The test orchestrator provides **complete observability** into ServalSheets testing:

- ✅ **208 tests** systematically executed
- ✅ **Real-time progress** with live updates
- ✅ **Structured logging** with request tracing
- ✅ **Test database** for deep analysis
- ✅ **HTML reports** for visual insights
- ✅ **Error tracking** throughout the entire flow

**Ready to test!** 🚀

```bash
npm run build && npx tsx scripts/test-orchestrator.ts
```
