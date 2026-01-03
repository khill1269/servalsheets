# ServalSheets Examples

Welcome to the ServalSheets examples directory! These examples demonstrate how to use ServalSheets as a library in your Node.js applications.

## Overview

This directory contains 5 comprehensive, runnable examples:

1. **01-basic-read-write.js** - Basic spreadsheet operations
2. **02-semantic-ranges.js** - Semantic range queries (header-based)
3. **03-safety-rails.js** - Safety features (dry-run, effect scope)
4. **04-batch-operations.js** - Efficient batch operations
5. **05-oauth-setup.js** - OAuth authentication flow

## Prerequisites

### 1. Node.js 22+
```bash
node --version  # Should be v22.0.0 or higher
```

### 2. Install ServalSheets
```bash
npm install servalsheets
```

### 3. Google Credentials

You need Google Sheets API credentials. Choose one method:

#### Option A: Service Account (Recommended for automation)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable Google Sheets API
4. Create a Service Account
5. Download JSON key file
6. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```

#### Option B: OAuth Access Token (For user accounts)
1. Get an OAuth access token from Google OAuth 2.0 playground
2. Set environment variable:
   ```bash
   export GOOGLE_ACCESS_TOKEN=ya29.xxx
   ```

See [QUICKSTART_CREDENTIALS.md](../QUICKSTART_CREDENTIALS.md) for detailed instructions.

### 4. Prepare a Test Spreadsheet

Create a Google Spreadsheet and note its ID from the URL:
```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
                                      ^^^^^^^^^^^^^^^^^^^
```

For service accounts, share the spreadsheet with the service account email.

## Running Examples

Each example is a standalone Node.js script using ES modules.

### Basic Read/Write
```bash
node examples/01-basic-read-write.js
```
Demonstrates:
- Reading cell values
- Writing data to cells
- Error handling
- Basic operations

### Semantic Ranges
```bash
node examples/02-semantic-ranges.js
```
Demonstrates:
- Header-based queries ("Revenue" column)
- Named range resolution
- Semantic vs A1 notation
- Resolution metadata

### Safety Rails
```bash
node examples/03-safety-rails.js
```
Demonstrates:
- Dry-run mode (preview changes)
- Effect scope limits
- Expected state validation
- Auto-snapshots

### Batch Operations
```bash
node examples/04-batch-operations.js
```
Demonstrates:
- Batch reading (multiple ranges)
- Batch writing (atomic updates)
- Performance best practices
- Error handling in batches

### OAuth Setup
```bash
node examples/05-oauth-setup.js
```
Demonstrates:
- OAuth 2.0 authentication flow
- Token management
- Refresh token handling
- Token storage

## Expected Output

Each example includes detailed console output showing:
- What operation is being performed
- Request parameters
- Response data
- Success/failure status
- Timing information

Example output:
```
=== ServalSheets: Basic Read/Write Example ===

[1/3] Reading data from spreadsheet...
✓ Successfully read 10 rows from Sales!A1:D10

[2/3] Writing data to spreadsheet...
✓ Successfully wrote 5 rows to Data!A1:C5

[3/3] Verifying write...
✓ Data verified successfully

=== Example Complete ===
Time taken: 2.3s
```

## Configuration

### Using Your Spreadsheet

Edit the spreadsheet ID in each example:
```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

### Adjusting for Your Data

Examples use placeholder sheet names like "Sales", "Data", etc. Update these to match your actual sheet names:
```javascript
const SHEET_NAME = 'YourSheetName';
```

## Troubleshooting

### "Permission denied"
- Ensure the spreadsheet is shared with your service account email
- Or ensure your OAuth token has correct scopes

### "Sheet not found"
- Verify the sheet name matches exactly (case-sensitive)
- Check the spreadsheet ID is correct

### "Invalid credentials"
- Check `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Ensure the JSON file is valid and readable

### "Module not found"
- Run `npm install servalsheets` in your project directory
- Ensure Node.js version is 22+

## Next Steps

After running these examples:

1. Read the [USAGE_GUIDE.md](../USAGE_GUIDE.md) for complete API reference
2. Explore [PROMPTS_GUIDE.md](../PROMPTS_GUIDE.md) for Claude Desktop usage
3. Review [SECURITY.md](../SECURITY.md) for production best practices
4. Check [PERFORMANCE.md](../PERFORMANCE.md) for optimization tips

## Using with Claude Desktop

These examples show library usage. To use ServalSheets with Claude Desktop:

1. Install globally:
   ```bash
   npm install -g servalsheets
   ```

2. Configure Claude Desktop (see [CLAUDE_DESKTOP_SETUP.md](../CLAUDE_DESKTOP_SETUP.md)):
   ```json
   {
     "mcpServers": {
       "servalsheets": {
         "command": "npx",
         "args": ["servalsheets"],
         "env": {
           "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop

4. Use natural language to interact with your spreadsheets!

## Additional Resources

- [ServalSheets Documentation](../DOCUMENTATION.md)
- [Google Sheets API Reference](https://developers.google.com/sheets/api)
- [MCP Protocol](https://modelcontextprotocol.io)

## Support

Having issues? Check:
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common problems
- [GitHub Issues](https://github.com/khill1269/servalsheets/issues) for bug reports
- [SECURITY.md](../SECURITY.md) for security concerns

## License

MIT - See [LICENSE](../LICENSE) for details
