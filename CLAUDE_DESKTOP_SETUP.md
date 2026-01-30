# Claude Desktop Setup Guide

**ServalSheets v1.6.0** - Ready to test in Claude Desktop!

---

## ✅ Build Complete

Your ServalSheets MCP server is compiled and ready:
- **Version:** 1.6.0
- **Tools:** 21
- **Actions:** 272
- **Files:** 859 compiled files in `dist/`

---

## 🔧 Quick Setup (4 Steps)

### Step 1: Authenticate with Google (OAuth)

**Run the OAuth setup:**
```bash
cd /Users/thomascahill/Downloads/servalsheets
node dist/cli/auth-setup.js
```

This will:
1. Open your browser for Google authentication
2. Ask you to authorize ServalSheets
3. Save tokens to `~/.servalsheets/tokens.json`

**⚠️ Do this BEFORE configuring Claude Desktop!**

### Step 2: Locate Claude Desktop Config

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### Step 3: Add ServalSheets Configuration

Open the config file and add:

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": [
        "/Users/thomascahill/Downloads/servalsheets/dist/cli.js"
      ]
    }
  }
}
```

**⚠️ IMPORTANT:** Update the path:
- Change `/Users/thomascahill/Downloads/servalsheets/dist/cli.js` to your actual path

**Note:** No `GOOGLE_APPLICATION_CREDENTIALS` needed with OAuth! Tokens are stored in `~/.servalsheets/tokens.json`

### Step 4: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. ServalSheets should appear in the MCP servers list

---

## 🎯 Quick Configuration Script (OAuth)

Run this to authenticate and configure Claude Desktop automatically:

```bash
# Navigate to ServalSheets directory
cd /Users/thomascahill/Downloads/servalsheets

# Step 1: Authenticate with Google OAuth
echo "🔐 Starting OAuth authentication..."
node dist/cli/auth-setup.js

# Step 2: Generate Claude Desktop config
echo "⚙️ Creating Claude Desktop config..."
cat > ~/Library/Application\ Support/Claude/claude_desktop_config.json << EOF
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": [
        "$(pwd)/dist/cli.js"
      ]
    }
  }
}
EOF

echo "✅ Setup complete!"
echo "📋 Next step: Restart Claude Desktop"
echo "🔍 Tokens saved to: ~/.servalsheets/tokens.json"
```

---

## 🧪 Testing

### 1. Check Server is Available

After restarting Claude Desktop, you should see ServalSheets in the server list.

### 2. Test Basic Commands

Try these prompts in Claude Desktop:

```
"List all available tools"
"What can ServalSheets do?"
"Show me sheets_auth actions"
```

### 3. Test Authentication

```
"Check my Google Sheets authentication status"
```

Expected response should show auth status.

### 4. Test Spreadsheet Creation

```
"Create a simple test spreadsheet with 3 columns: Name, Email, Phone"
```

### 5. Test Modern Features

```
"Import this CSV data: Name,Email\nJohn,john@example.com"
"Run quality validation on the spreadsheet"
"Show me the operation history"
```

---

## 📋 Full Configuration Options

### Basic Configuration (STDIO Transport)

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["/path/to/servalsheets/dist/cli.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

### With Custom Environment Variables

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["/path/to/servalsheets/dist/cli.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "LOG_LEVEL": "debug",
        "REQUEST_TIMEOUT_MS": "30000",
        "DIFF_ENGINE_CONCURRENCY": "10"
      }
    }
  }
}
```

### Using Global Installation

If you install globally with `npm install -g`:

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "servalsheets",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

---

## 🔐 Google Authentication Setup

### Option 1: OAuth (Recommended for Claude Desktop) ✅

**This is the easiest method and works automatically with Claude Desktop!**

1. **Run the OAuth setup once:**
   ```bash
   cd /Users/thomascahill/Downloads/servalsheets
   node dist/cli/auth-setup.js
   ```

2. **Follow the browser prompts:**
   - Your browser will open automatically
   - Log in to your Google account
   - Click "Allow" to grant permissions
   - You'll see "Authentication successful!" in the terminal

3. **Tokens are saved automatically:**
   - Stored in `~/.servalsheets/tokens.json`
   - Used automatically by Claude Desktop
   - Refreshed automatically when they expire

**That's it!** No environment variables needed. Claude Desktop will use the saved tokens.

### Option 2: Service Account (For Production/Team Use)

1. **Create Service Account:**
   - Go to https://console.cloud.google.com/
   - Navigate to IAM & Admin → Service Accounts
   - Create new service account
   - Download JSON key file

2. **Enable Google Sheets API:**
   - Go to APIs & Services → Library
   - Search for "Google Sheets API"
   - Click "Enable"

3. **Share Spreadsheets:**
   - Open any spreadsheet you want to access
   - Click "Share"
   - Add service account email (found in JSON file)
   - Grant "Editor" permissions

4. **Update Claude Desktop Config:**
   ```json
   {
     "mcpServers": {
       "servalsheets": {
         "command": "node",
         "args": ["/path/to/servalsheets/dist/cli.js"],
         "env": {
           "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
         }
       }
     }
   }
   ```

---

## 🐛 Troubleshooting

### Claude Desktop Not Showing ServalSheets

1. **Check config file syntax:**
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq
   ```
   Should parse without errors.

2. **Verify paths are absolute:**
   ```bash
   ls -la /Users/thomascahill/Downloads/servalsheets/dist/cli.js
   ```
   File should exist.

3. **Check Claude Desktop logs:**
   - macOS: `~/Library/Logs/Claude/`
   - Look for MCP server startup errors

### Authentication Errors

1. **Verify service account file exists:**
   ```bash
   ls -la /path/to/your/service-account.json
   cat /path/to/your/service-account.json | jq
   ```

2. **Check service account email:**
   ```bash
   cat /path/to/your/service-account.json | jq -r '.client_email'
   ```

3. **Verify spreadsheet sharing:**
   - Open spreadsheet in browser
   - Check that service account email has access

### Server Not Starting

1. **Test manually:**
   ```bash
   cd /Users/thomascahill/Downloads/servalsheets
   node dist/cli.js --version
   ```
   Should print: `servalsheets v1.6.0`

2. **Check for missing dependencies:**
   ```bash
   npm install
   ```

3. **Rebuild if needed:**
   ```bash
   npm run build:clean
   ```

---

## 📊 What You Can Test

### Core Features (17 Tools)
- ✅ **sheets_auth** - Authentication status
- ✅ **sheets_core** - Create/get/update spreadsheets
- ✅ **sheets_data** - Read/write cell data
- ✅ **sheets_format** - Cell formatting and styles
- ✅ **sheets_dimensions** - Row/column operations
- ✅ **sheets_visualize** - Charts and pivot tables

### Modern Features (v1.6.0)
- ✅ **sheets_session** - "the spreadsheet", "undo that"
- ✅ **sheets_composite** - import_csv, deduplicate, bulk_update
- ✅ **sheets_quality** - validate, detect_conflicts
- ✅ **sheets_fix** - Auto-repair broken spreadsheets
- ✅ **sheets_analyze** - AI-powered analysis
- ✅ **sheets_history** - undo, redo, revert
- ✅ **sheets_transaction** - Multi-operation atomicity

### Phase 7 Performance
- ✅ **10-20x faster** diff operations
- ✅ **50-100x fewer** sheet extraction operations
- ✅ **W3C Trace Context** for debugging
- ✅ **71 error codes** with resolution steps

---

## 🎯 Example Prompts to Try

### Basic Operations
```
"Create a spreadsheet called 'Test Data' with columns: ID, Name, Email"
"Read data from Sheet1!A1:C10"
"Write 'Hello World' to cell A1"
```

### Modern Features
```
"Import this CSV: Name,Age\nAlice,30\nBob,25"
"Deduplicate the data in Sheet1 based on the Email column"
"Run quality validation on this spreadsheet"
"Fix any broken formulas in the spreadsheet"
```

### Conversational Context
```
"Set this as the active spreadsheet: [spreadsheet-id]"
"Show me the active context"
"Undo that last operation"
"What's in the operation history?"
```

### AI Analysis
```
"Analyze the data and give me insights"
"Suggest the best chart type for this data"
"Run a comprehensive analysis on the entire spreadsheet"
```

### Complex Workflows
```
"Create a CRM with Contacts, Companies, and Deals sheets"
"Add data validation dropdowns for Status column"
"Create a pivot table showing sales by region"
"Add conditional formatting to highlight values over 1000"
```

---

## 📚 Additional Resources

### Included in Package
- **SKILL.md** - Claude skill file (v1.6.0, updated 2026-01-26)
- **README.md** - Complete documentation
- **TESTING_GUIDE.md** - Comprehensive testing guide
- **docs/** - Full documentation directory

### Key Files
- **server.json** - MCP metadata (21 tools, 272 actions)
- **dist/cli.js** - STDIO server entrypoint
- **dist/server.js** - Server core
- **dist/http-server.js** - HTTP/SSE transport

### Online Resources
- **GitHub:** https://github.com/khill1269/servalsheets
- **Issues:** https://github.com/khill1269/servalsheets/issues

---

## ✅ Success Checklist

Your setup is successful when:

- [ ] Claude Desktop shows "servalsheets" in MCP servers list
- [ ] Can list available tools (21 tools)
- [ ] Can check auth status
- [ ] Can create a test spreadsheet
- [ ] Can read/write cell data
- [ ] Modern features work (composite, quality, fix, history)
- [ ] Conversational context works ("the spreadsheet", "undo that")
- [ ] Error messages are clear with resolution steps

---

## 🚀 You're Ready!

ServalSheets v1.6.0 is now configured for Claude Desktop testing. Restart Claude Desktop and start building sophisticated Google Sheets applications!

**Happy testing!** 🎉
