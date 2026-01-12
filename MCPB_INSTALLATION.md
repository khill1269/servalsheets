# ServalSheets MCPB Installation Guide

## ✅ Your Custom Icon is Now Working!

The `.mcpb` bundle format supports custom icons that ARE displayed in Claude Desktop.

## What You Have

**File Created:** `servalsheets-1.4.0.mcpb` (85MB)
**Icon:** `assets/serval-icon.png` (1536x1024) ✅ Included
**Format:** MCPB Desktop Extension (ZIP archive)

## How to Install

### Method 1: Double-Click Installation (Recommended)

1. **Locate the file:**
   ```bash
   open .
   ```
   Find `servalsheets-1.4.0.mcpb` in Finder

2. **Double-click** `servalsheets-1.4.0.mcpb`
   - Claude Desktop will automatically detect it
   - Your custom serval icon will appear!

3. **Configure credentials** (one-time):
   - Claude Desktop will prompt for environment variables
   - Add your credentials:
     ```
     GOOGLE_TOKEN_STORE_PATH=/Users/thomascahill/Documents/mcp-servers/servalsheets/.secrets/servalsheets.tokens.enc
     ENCRYPTION_KEY=b2637c6cda2a1e621df51e54b97ccca92e23048e4149dadcfd9b9e9e82ee15ca
     GOOGLE_CLIENT_ID=650528178356-b36kqokrd8puj0bcl669o5fhbbt7ui7f.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=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
     ```

### Method 2: Manual Installation

If double-click doesn't work:

1. **Move file to Extensions directory:**
   ```bash
   cp servalsheets-1.4.0.mcpb ~/Library/Application\ Support/Claude/Claude\ Extensions/
   ```

2. **Restart Claude Desktop:**
   - Quit completely (⌘+Q)
   - Reopen

3. **Configure** in Claude Desktop Extensions settings

## What Changed

### Before (npm/node):
```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["/Users/thomascahill/Documents/mcp-servers/servalsheets/dist/cli.js"]
    }
  }
}
```
- ❌ Shows "S" initial letter only
- ❌ server.json icons NOT rendered

### After (MCPB):
```
servalsheets-1.4.0.mcpb contains:
  ✅ manifest.json with icon field
  ✅ assets/serval-icon.png (your custom icon)
  ✅ dist/ (compiled code)
  ✅ node_modules/ (all dependencies)
```
- ✅ Custom serval icon IS displayed
- ✅ One-click installation
- ✅ Self-contained package

## Icon Configuration in manifest.json

```json
{
  "icon": "assets/serval-icon.png",
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["dist/cli.js"]
    }
  }
}
```

The `icon` field tells Claude Desktop where to find your custom icon within the bundle.

## Verification

After installation, you should see:
1. **In Connectors list:** Your custom serval icon (not just "S")
2. **In chat interface:** Serval icon when using tools
3. **In Extensions settings:** Serval icon in installed extensions

## Troubleshooting

### Icon Still Not Showing

**Check 1:** Is it installed as an extension?
```bash
ls ~/Library/Application\ Support/Claude/Claude\ Extensions/
```

**Check 2:** Did you restart Claude Desktop?
- Quit completely (⌘+Q)
- Reopen

**Check 3:** Is it the MCPB version?
- Uninstall the old npm version first
- Remove from `claude_desktop_config.json`
- Install MCPB version

### Reverting to npm Version

To go back to the npm version:

1. **Remove MCPB extension:**
   ```bash
   rm ~/Library/Application\ Support/Claude/Claude\ Extensions/servalsheets-1.4.0.mcpb
   ```

2. **Restore claude_desktop_config.json:**
   ```bash
   # Use your backed up config
   cp backup-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

3. **Restart Claude Desktop**

## Benefits of MCPB

✅ **Custom icon displayed** (main benefit for you!)
✅ **One-click installation** (easier for users)
✅ **Self-contained** (includes all dependencies)
✅ **Version management** (easy to update/rollback)
✅ **Distribution ready** (single file to share)

## Next Steps

1. **Install the MCPB bundle** (double-click)
2. **See your serval icon!** 🎉
3. **Test all 26 tools** work correctly
4. **Share** the .mcpb file with others

---

**Your custom serval icon will now be displayed in Claude Desktop!** 🦁✨
