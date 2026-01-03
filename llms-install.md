# ServalSheets Installation Guide for AI Agents

This guide provides structured installation instructions for AI coding assistants like Claude Code and Cline.

## Prerequisites

- Node.js >= 18.0.0
- npm or pnpm
- Google Cloud project with Sheets API enabled
- Service account or OAuth credentials

## Installation Methods

### Method 1: Claude Desktop (Recommended)

1. Install via npx (no manual install needed):

```json
// Add to ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
// Add to %APPDATA%/Claude/claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "servalsheets": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "${HOME}/path/to/service-account.json"
      }
    }
  }
}
```

2. Restart Claude Desktop

### Method 2: Claude Code CLI

```bash
# Add with service account
claude mcp add --transport stdio servalsheets -- \
  npx servalsheets \
  --service-account ~/path/to/service-account.json

# Or with access token
claude mcp add --transport stdio servalsheets -- \
  npx servalsheets \
  --access-token $GOOGLE_ACCESS_TOKEN
```

### Method 3: Global Installation

```bash
npm install -g servalsheets

# Verify installation
servalsheets --help
```

### Method 4: Project-Local Installation

```bash
npm install servalsheets

# Run via npx
npx servalsheets --service-account ./credentials.json
```

## Google Authentication Setup

### Option A: Service Account (Recommended for automation)

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create a new service account
3. Grant "Editor" role to the service account
4. Create and download JSON key
5. Set environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Option B: OAuth2 for User Authentication

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Desktop app type)
3. Download client configuration
4. Set environment variables:

```bash
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret
```

## Verification

After installation, verify the server is working:

```bash
# Test STDIO transport
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npx servalsheets
```

Expected response includes `serverInfo` with `name: "servalsheets"`.

## Common Issues

### Issue: "Cannot find module googleapis"
**Solution:** Clear npm cache and reinstall:
```bash
npm cache clean --force
npm install servalsheets
```

### Issue: "PERMISSION_DENIED: The caller does not have permission"
**Solution:** Share the spreadsheet with your service account email (found in the JSON key file).

### Issue: "Quota exceeded"
**Solution:** Enable the Google Sheets API in your Google Cloud project and check quota limits.

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | One auth method required |
| `GOOGLE_ACCESS_TOKEN` | OAuth2 access token | One auth method required |
| `GOOGLE_CLIENT_ID` | OAuth2 client ID | With CLIENT_SECRET |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret | With CLIENT_ID |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 refresh token | Optional |

## Feature Verification

Test that all 15 tools are available:

```javascript
// In Claude, ask:
"List all available ServalSheets tools"

// Expected: 15 tools
// - sheets_spreadsheet (6 actions)
// - sheets_sheet (7 actions)
// - sheets_values (9 actions)
// - sheets_cells (12 actions)
// - sheets_format (9 actions)
// - sheets_dimensions (21 actions)
// - sheets_rules (8 actions)
// - sheets_charts (9 actions)
// - sheets_pivot (8 actions)
// - sheets_filter_sort (14 actions)
// - sheets_sharing (8 actions)
// - sheets_comments (10 actions)
// - sheets_versions (10 actions)
// - sheets_analysis (8 actions)
// - sheets_advanced (19 actions)
```

## Uninstallation

```bash
# Remove from Claude Desktop config manually

# Or if globally installed:
npm uninstall -g servalsheets
```
