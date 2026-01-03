# Claude Desktop Setup Guide

This guide helps you configure ServalSheets to work with Claude Desktop.

## ✅ Prerequisites

- [ ] Claude Desktop installed
- [ ] Node.js 18+ installed
- [ ] Google Cloud project with Sheets API enabled
- [ ] Service account JSON key OR OAuth tokens

## 🔧 Quick Setup (5 minutes)

### Step 1: Get Google Credentials

**Option A: Service Account (Recommended)**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project or select existing one
3. Enable Google Sheets API and Google Drive API
4. Create a Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Name: `servalsheets-mcp`
   - Skip role assignment (we'll use per-spreadsheet sharing)
5. Create and download JSON key
6. Save to: `~/.config/google/servalsheets-service-account.json`

**Option B: OAuth Token (Quick Testing)**

1. Go to [OAuth Playground](https://developers.google.com/oauthplayground/)
2. Select scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
3. Click "Authorize APIs"
4. Exchange authorization code for tokens
5. Copy the access token

### Step 2: Configure Claude Desktop

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Using local build** (for testing):

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": [
        "/Users/thomascahill/Documents/mcp-servers/servalsheets/dist/cli.js"
      ],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/Users/thomascahill/.config/google/servalsheets-service-account.json"
      }
    }
  }
}
```

**Using npm package** (after publishing):

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/Users/thomascahill/.config/google/servalsheets-service-account.json"
      }
    }
  }
}
```

**Using OAuth token** (temporary):

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": [
        "/Users/thomascahill/Documents/mcp-servers/servalsheets/dist/cli.js"
      ],
      "env": {
        "GOOGLE_ACCESS_TOKEN": "ya29.a0AfB_..."
      }
    }
  }
}
```

### Step 3: Share Spreadsheets with Service Account

**Important**: Service accounts can't access your personal spreadsheets unless you share them!

1. Open your Google Sheet
2. Click "Share" button
3. Add service account email (from JSON key file):
   - Example: `servalsheets-mcp@your-project.iam.gserviceaccount.com`
4. Grant appropriate permission:
   - **Viewer**: For read-only operations
   - **Editor**: For read/write operations

### Step 4: Restart Claude Desktop

1. Quit Claude Desktop completely (⌘+Q)
2. Reopen Claude Desktop
3. Look for the 🔨 icon in bottom-right (indicates MCP servers loaded)

### Step 5: Test It Works

In Claude Desktop, try:

```
List all sheets in this spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

Expected: Claude should use the `sheets_spreadsheet` tool and return sheet names.

## 🧪 Troubleshooting

### Issue: "Authentication failed"

**Symptoms**: Tool calls fail with permission errors

**Fixes**:
1. Verify JSON path is correct in config
2. Check JSON file is valid (not corrupted)
3. Ensure APIs are enabled in Google Cloud Console
4. For service accounts: Share spreadsheet with service account email

### Issue: "MCP server not loading" (no 🔨 icon)

**Symptoms**: Tools don't appear in Claude Desktop

**Fixes**:
1. Check config file syntax (must be valid JSON)
2. Verify file path to cli.js is correct
3. Check logs: `~/Library/Logs/Claude/mcp-server-servalsheets.log`
4. Test CLI manually:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=~/.config/google/servalsheets-service-account.json
   node /Users/thomascahill/Documents/mcp-servers/servalsheets/dist/cli.js
   ```
   Should start and wait for input (Ctrl+C to exit)

### Issue: "Permission denied" when accessing spreadsheet

**Symptoms**: Tool works but can't access specific spreadsheet

**Fixes**:
1. Share the spreadsheet with your service account email
2. Grant appropriate permissions (Viewer or Editor)
3. Wait 30 seconds for Google's cache to update
4. Try again

### Issue: "Tool returned error: SHEET_NOT_FOUND"

**Symptoms**: Spreadsheet ID is correct but sheet name isn't found

**Fixes**:
1. Check sheet name matches exactly (case-sensitive)
2. Verify spreadsheet ID is correct
3. Ensure you have access to the spreadsheet
4. Try listing sheets first:
   ```
   List all sheets in spreadsheet: <id>
   ```

### Issue: "QUOTA_EXCEEDED"

**Symptoms**: After many operations, tools start failing

**Fixes**:
1. Wait a few minutes for quota to reset
2. Use batch operations to reduce API calls
3. Check [Google API quotas](https://console.cloud.google.com/apis/api/sheets.googleapis.com/quotas)
4. Consider requesting quota increase if needed

## 📊 Verify Tools Are Loaded

You should see **15 tools** available:

1. `sheets_spreadsheet` (6 actions)
2. `sheets_sheet` (7 actions)
3. `sheets_values` (9 actions)
4. `sheets_cells` (12 actions)
5. `sheets_format` (9 actions)
6. `sheets_dimensions` (21 actions)
7. `sheets_rules` (8 actions)
8. `sheets_charts` (9 actions)
9. `sheets_pivot` (8 actions)
10. `sheets_filter_sort` (14 actions)
11. `sheets_sharing` (8 actions)
12. `sheets_comments` (10 actions)
13. `sheets_versions` (10 actions)
14. `sheets_analysis` (8 actions)
15. `sheets_advanced` (19 actions)

**Total**: 158 actions

## 🎯 Example Tasks

Try asking Claude:

### Basic Operations
```
Read cells A1:D10 from spreadsheet: <your-spreadsheet-id>
```

```
Write "Hello World" to cell A1 in spreadsheet: <your-spreadsheet-id>
```

### Data Analysis
```
Analyze the data quality in spreadsheet: <your-spreadsheet-id>
Range: Sheet1!A1:Z100
```

```
Calculate statistics for the Revenue column in my sales spreadsheet: <your-spreadsheet-id>
```

### Advanced Operations
```
Create a bar chart showing monthly sales from spreadsheet: <your-spreadsheet-id>
Data range: Sales!A1:B12
```

```
Add conditional formatting to highlight values > 1000 in column B
Spreadsheet: <your-spreadsheet-id>
```

### Using Safety Features
```
Preview what would happen if I cleared all data in range Sheet1!A1:Z100
Use dry-run mode
Spreadsheet: <your-spreadsheet-id>
```

## 🔐 Security Best Practices

### Service Account Security

1. **Minimal sharing**: Only share spreadsheets that need automation
2. **Least privilege**: Use Viewer role if only reading data
3. **Key rotation**: Rotate service account keys annually
4. **Secure storage**: Keep JSON keys in `~/.config/google/` with 600 permissions:
   ```bash
   chmod 600 ~/.config/google/servalsheets-service-account.json
   ```

### OAuth Token Security

1. **Short-lived**: OAuth access tokens expire (use service accounts for automation)
2. **Refresh tokens**: Store refresh tokens securely if using OAuth flow
3. **Encrypted storage**: Enable encrypted token store:
   ```bash
   export GOOGLE_TOKEN_STORE_PATH=~/.config/servalsheets/tokens.enc
   export GOOGLE_TOKEN_STORE_KEY=$(openssl rand -hex 32)
   ```

## 📝 Configuration Reference

### All Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON path | One of these | `~/.config/google/sa.json` |
| `GOOGLE_ACCESS_TOKEN` | OAuth access token | One of these | `ya29.xxx` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | With secret | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | With ID | `GOCSPX-xxx` |
| `GOOGLE_TOKEN_STORE_PATH` | Encrypted token file | Optional | `~/.config/servalsheets/tokens.enc` |
| `GOOGLE_TOKEN_STORE_KEY` | 64-char hex encryption key | With path | `openssl rand -hex 32` |

### Example Configurations

**Production (Service Account)**:
```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/Users/you/.config/google/servalsheets-prod.json"
      }
    }
  }
}
```

**Development (Local Build)**:
```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["/path/to/servalsheets/dist/cli.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/dev-credentials.json",
        "DEBUG": "servalsheets:*"
      }
    }
  }
}
```

**Multiple Environments**:
```json
{
  "mcpServers": {
    "servalsheets-prod": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/prod-sa.json"
      }
    },
    "servalsheets-dev": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/dev-sa.json"
      }
    }
  }
}
```

## 🔍 Viewing Logs

Logs are written to:
```
~/Library/Logs/Claude/mcp-server-servalsheets.log
```

View live logs:
```bash
tail -f ~/Library/Logs/Claude/mcp-server-servalsheets.log
```

View errors only:
```bash
grep ERROR ~/Library/Logs/Claude/mcp-server-servalsheets.log
```

## 🚀 Performance Tips

### Batch Operations
Instead of:
```
Read A1:A10, then read B1:B10, then read C1:C10
```

Use:
```
Read A1:C10 in one call
```

### Caching
ServalSheets caches:
- Spreadsheet metadata (5 minutes)
- Sheet structure (5 minutes)
- Named ranges (10 minutes)

Clear cache if structure changes:
```
Refresh metadata for spreadsheet: <id>
```

### Rate Limiting
Built-in rate limiter respects Google's quotas:
- 100 requests per 100 seconds per user
- Automatic backoff on 429 errors
- Queue management with retry

## 📚 Additional Resources

- [ServalSheets Documentation](https://github.com/khill1269/servalsheets)
- [SKILL.md](./SKILL.md) - Guide for Claude on using ServalSheets
- [Google Sheets API Docs](https://developers.google.com/sheets/api)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.com/desktop)

## ✅ Checklist

- [ ] Google Cloud project created
- [ ] Sheets API and Drive API enabled
- [ ] Service account created and JSON key downloaded
- [ ] JSON key saved to `~/.config/google/`
- [ ] File permissions set to 600
- [ ] Claude Desktop config updated
- [ ] Claude Desktop restarted
- [ ] 🔨 icon appears in Claude Desktop
- [ ] Test spreadsheet shared with service account
- [ ] Test query successful

You're ready to use ServalSheets with Claude Desktop! 🎉
