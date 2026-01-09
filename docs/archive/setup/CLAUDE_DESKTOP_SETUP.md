# Claude Desktop Setup & Testing Guide

**Version**: 1.3.0
**Date**: 2026-01-06
**Status**: ✅ Ready for Testing

---

## ✅ Build Status

```
Build:        ✅ SUCCESS
Version:      servalsheets v1.3.0
TypeScript:   ✅ 0 errors
Tests:        836/841 passing (99.4%)
Security:     ✅ 0 vulnerabilities
```

---

## 📁 Current Configuration

**Config File Location** (macOS):
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Current Configuration**:
```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["/Users/thomascahill/Documents/mcp-servers/servalsheets/dist/cli.js"],
      "env": {
        "OAUTH_CLIENT_ID": "650528178356-0h36h5unaah4rqahieflo20f062976rf.apps.googleusercontent.com",
        "OAUTH_CLIENT_SECRET": "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",
        "OAUTH_REDIRECT_URI": "http://localhost:3000/callback",
        "ENCRYPTION_KEY": "b2637c6cda2a1e621df51e54b97ccca92e23048e4149dadcfd9b9e9e82ee15ca",
        "GOOGLE_TOKEN_STORE_PATH": "/Users/thomascahill/Documents/mcp-servers/servalsheets/servalsheets.tokens.enc",
        "LOG_LEVEL": "info",
        "MCP_TRANSPORT": "stdio",
        "CACHE_ENABLED": "true"
      }
    }
  }
}
```

---

## ✅ Configuration Verification

### Paths Verified
- ✅ CLI executable: `/Users/thomascahill/Documents/mcp-servers/servalsheets/dist/cli.js`
- ✅ Token store: `/Users/thomascahill/Documents/mcp-servers/servalsheets/servalsheets.tokens.enc`
- ✅ Config file: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Environment Variables
- ✅ `OAUTH_CLIENT_ID` - Configured
- ✅ `OAUTH_CLIENT_SECRET` - Configured
- ✅ `OAUTH_REDIRECT_URI` - Set to `http://localhost:3000/callback`
- ✅ `ENCRYPTION_KEY` - 64-character hex key
- ✅ `GOOGLE_TOKEN_STORE_PATH` - Absolute path
- ✅ `LOG_LEVEL` - Set to `info`
- ✅ `MCP_TRANSPORT` - Set to `stdio` (required)
- ✅ `CACHE_ENABLED` - Set to `true`

---

## 🧪 Testing Checklist

### 1. Restart Claude Desktop
```bash
# Quit Claude Desktop completely
# Then relaunch it
```

### 2. Verify Server Connection
In Claude Desktop, you should see:
- **Server Name**: `servalsheets`
- **Status**: Connected (green indicator)
- **Tools Available**: 23 tools

### 3. Test Basic Functionality

#### Test 1: List Spreadsheets
```
List all my Google Sheets spreadsheets
```
**Expected**: Should authenticate if first time, then list your spreadsheets

#### Test 2: Create Spreadsheet
```
Create a new spreadsheet called "Test v1.3.0"
```
**Expected**: Creates new spreadsheet and returns spreadsheet ID

#### Test 3: Write Data
```
Write "Hello v1.3.0" to cell A1 in the new spreadsheet
```
**Expected**: Writes data successfully

#### Test 4: Read Data
```
Read cell A1 from the spreadsheet
```
**Expected**: Returns "Hello v1.3.0"

#### Test 5: Test New Resources
```
Show me the charts in spreadsheet [ID]
```
**Expected**: Uses new `sheets:///[id]/charts` resource

#### Test 6: Test Task Cancellation (New in v1.3.0)
```
Start a large data operation, then cancel it
```
**Expected**: Task cancels gracefully with proper cleanup

---

## 🎯 v1.3.0 Features to Test

### MCP Logging (New)
Claude Desktop can now dynamically adjust log levels:
- Server supports `logging/setLevel` requests
- Useful for debugging without restart

### Expanded Resources (New)
Test these new resource URIs:
1. `sheets:///{id}/charts` - All charts in spreadsheet
2. `sheets:///{id}/charts/{chartId}` - Specific chart details
3. `sheets:///{id}/pivots` - All pivot tables
4. `sheets:///{id}/quality` - Data quality analysis

### Task Cancellation (New - SEP-1686)
- Long-running operations can be cancelled
- Proper cleanup with AbortController
- Request tracing with unique IDs

### Confirm & Analyze Tools
- `sheets_confirm` - Get user confirmations via MCP Elicitation
- `sheets_analyze` - AI-powered analysis via MCP Sampling

---

## 🐛 Troubleshooting

### Server Not Connecting

**Check 1: Verify Build**
```bash
cd /Users/thomascahill/Documents/mcp-servers/servalsheets
npm run build
node dist/cli.js --version
# Should output: servalsheets v1.3.0
```

**Check 2: Check Logs**
```bash
# Claude Desktop logs location (macOS)
~/Library/Logs/Claude/mcp*.log
```

**Check 3: Test Server Manually**
```bash
cd /Users/thomascahill/Documents/mcp-servers/servalsheets

# Set environment
export OAUTH_CLIENT_ID="650528178356-0h36h5unaah4rqahieflo20f062976rf.apps.googleusercontent.com"
export OAUTH_CLIENT_SECRET="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"
export OAUTH_REDIRECT_URI="http://localhost:3000/callback"
export ENCRYPTION_KEY="b2637c6cda2a1e621df51e54b97ccca92e23048e4149dadcfd9b9e9e82ee15ca"
export GOOGLE_TOKEN_STORE_PATH="./servalsheets.tokens.enc"
export LOG_LEVEL="debug"
export MCP_TRANSPORT="stdio"

# Run server
node dist/cli.js
```

### Authentication Issues

**Reset Authentication**
```bash
# Remove token file
rm /Users/thomascahill/Documents/mcp-servers/servalsheets/servalsheets.tokens.enc

# Restart Claude Desktop
# Next request will trigger re-authentication
```

### Permission Errors

**Check Token Store Permissions**
```bash
ls -la /Users/thomascahill/Documents/mcp-servers/servalsheets/servalsheets.tokens.enc
# Should be readable/writable by current user
```

---

## 📊 Expected Tool List

When connected, you should see these 23 tools:

### Authentication (1 tool)
- `sheets_auth` - OAuth authentication management

### Spreadsheet Management (4 tools)
- `sheets_spreadsheet` - Create, get, copy, delete spreadsheets
- `sheets_sheet` - Add, delete, rename, copy sheets
- `sheets_values` - Read/write cell values
- `sheets_cells` - Update cell properties

### Formatting (2 tools)
- `sheets_format` - Text/number/cell formatting
- `sheets_dimensions` - Rows, columns, ranges

### Data Management (5 tools)
- `sheets_rules` - Conditional formatting, data validation
- `sheets_charts` - Create and manage charts
- `sheets_pivot` - Pivot tables
- `sheets_filter_sort` - Filters and sorting
- `sheets_sharing` - Permissions

### Collaboration (3 tools)
- `sheets_comments` - Comments and notes
- `sheets_versions` - Version history
- `sheets_history` - Change tracking

### Analysis (2 tools)
- `sheets_analysis` - Data analysis operations
- `sheets_advanced` - Complex operations

### Safety & Orchestration (6 tools)
- `sheets_transaction` - Multi-step operations
- `sheets_validation` - Pre-flight validation
- `sheets_conflict` - Conflict detection
- `sheets_impact` - Impact analysis
- `sheets_confirm` - User confirmations (NEW in v1.3.0)
- `sheets_analyze` - AI analysis (NEW in v1.3.0)

---

## 🔍 Verification Commands

### Quick Test Script
```bash
cd /Users/thomascahill/Documents/mcp-servers/servalsheets
./quick-test.sh
```

### Manual Verification
```bash
# 1. Check version
node dist/cli.js --version

# 2. Check build
npm run build

# 3. Run tests
npm test

# 4. Type check
npm run typecheck

# 5. Security audit
npm audit
```

---

## 📚 Additional Resources

### Documentation
- **README.md** - Full user guide
- **CHANGELOG.md** - Version history
- **ADVANCED_TESTING_STRATEGY.md** - Comprehensive testing guide
- **RELEASE_READINESS_v1.3.0.md** - Release verification report
- **FINAL_SUMMARY.md** - Session accomplishments

### MCP Resources
- **Protocol Version**: 2025-11-25
- **SEP-1686**: Task cancellation support
- **SEP-1036**: Elicitation (user confirmations)
- **SEP-1577**: Sampling (AI analysis)

### Google Sheets API
- **API Version**: v4
- **OAuth**: 2.1 with PKCE
- **Best Practices**: Batching, caching, deduplication

---

## ✅ Ready to Test!

**Status**: All checks passed - Configuration is correct and ready for testing.

**Next Steps**:
1. Restart Claude Desktop
2. Verify server connects
3. Run through testing checklist above
4. Test v1.3.0 new features
5. Report any issues

**Support**: If you encounter issues, check:
- Build output: `npm run build`
- Server logs: `~/Library/Logs/Claude/`
- This configuration file

---

**Version**: 1.3.0
**Build Date**: 2026-01-06
**Configuration**: Verified ✅
**Ready for Testing**: YES ✅
