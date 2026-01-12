# Debugging ServalSheets Tool Issues

## Your Current Errors

### Error 1: `sheets_spreadsheet` - "No result received from client-side tool execution"
### Error 2: `sheets_values` - MCP error -32602: "Expected object, received string" for range
### Error 3: `sheets_analysis` - "No result received from client-side tool execution"

---

## Root Causes & Solutions

### Issue #1: "No result received from client-side tool execution"

**What this means:**
The MCP client (Claude Desktop, Inspector, etc.) sent a request but didn't get a response from the server.

**Possible Causes:**
1. **Authentication tokens not properly loaded**
   - Auth status shows "authenticated" but tokens aren't actually being used
   - Token file is corrupt or unreadable
   - Encryption key mismatch

2. **Spreadsheet ID is invalid**
   - ID doesn't exist
   - You don't have access to it
   - ID format is wrong

3. **Server timeout**
   - Request took too long (>30s default)
   - Google API is slow/unavailable

4. **Unhandled exception in handler**
   - Code crashed before returning response
   - Error was swallowed

**How to Debug:**

#### Step 1: Verify Authentication Status
```bash
# Check token file exists
ls -la ~/.config/servalsheets/tokens.enc

# Check ENCRYPTION_KEY is set
echo $ENCRYPTION_KEY
```

#### Step 2: Check Server Logs
Start the server with debug logging:
```bash
LOG_LEVEL=debug node dist/cli.js --stdio 2>server-debug.log &

# In another terminal, tail the logs:
tail -f server-debug.log
```

#### Step 3: Test with Simple Request
Try the simplest possible request:
```json
{
  "action": "get",
  "spreadsheetId": "REPLACE_WITH_VALID_ID"
}
```

Make sure:
- The spreadsheet ID is valid (from a real Google Sheet URL)
- You own the spreadsheet or have edit access
- ID format: `1abc...xyz` (starts with 1, long random string)

#### Step 4: Test Authentication Actually Works
```bash
# Run this command - it should show your auth details
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sheets_auth","arguments":{"action":"status"}},"id":1}' | node dist/cli.js --stdio 2>&1 | grep -A 30 authenticated
```

If you see `authenticated: false`, you need to re-auth:
1. Delete token file: `rm ~/.config/servalsheets/tokens.enc`
2. Run `sheets_auth` with `action: "login"`
3. Complete OAuth flow in browser
4. Retry original request

---

### Issue #2: Range Parameter Format (Already Fixed in inspector.json!)

**Good news:** The `inspector.json` already has the correct format:
```json
✅ CORRECT (already in inspector.json):
{
  "range": { "a1": "Sheet1!A1:D10" }
}

❌ WRONG (if client is sending this):
{
  "range": "Sheet1!A1:D10"
}
```

**If you're still getting this error:**
The MCP client you're using isn't respecting the schema format. This could happen if:
1. Using Claude Desktop with an older version
2. Using a custom client with incorrect serialization
3. Manually typing requests and using wrong format

**Solution:**
Always use the object format. If using Claude Desktop, make sure it's using the correct schema from `inspector.json`.

---

## Complete Debugging Checklist

### ✅ Prerequisites
- [ ] Built successfully: `npm run build` (no errors)
- [ ] Tests pass: `npm test` (1,761/1,761 passing)
- [ ] Server starts: `node dist/cli.js --stdio` (no crashes)

### ✅ Authentication
- [ ] `ENCRYPTION_KEY` environment variable is set
- [ ] Token file exists: `~/.config/servalsheets/tokens.enc`
- [ ] `sheets_auth` with `action: "status"` returns `authenticated: true`
- [ ] Token file is readable (not corrupted)

### ✅ Spreadsheet Access
- [ ] Using a real spreadsheet ID from Google Sheets
- [ ] You have edit access to the spreadsheet
- [ ] Spreadsheet isn't deleted or private
- [ ] ID format is correct: starts with `1`, 40+ characters

### ✅ Request Format
- [ ] Range uses object format: `{ "a1": "..." }`
- [ ] All required fields are provided
- [ ] Action enum values match exactly (case-sensitive)
- [ ] No typos in tool names

---

## Quick Diagnostic Script

```bash
#!/bin/bash
# Save as: diagnose.sh

echo "=== ServalSheets Diagnostics ==="
echo ""

echo "1. Check build..."
if [ -f "dist/cli.js" ]; then
  echo "✅ Build exists"
else
  echo "❌ Build missing - run: npm run build"
  exit 1
fi

echo ""
echo "2. Check token file..."
if [ -f ~/.config/servalsheets/tokens.enc ]; then
  echo "✅ Token file exists"
  ls -lh ~/.config/servalsheets/tokens.enc
else
  echo "❌ Token file missing - need to authenticate"
fi

echo ""
echo "3. Check ENCRYPTION_KEY..."
if [ -n "$ENCRYPTION_KEY" ]; then
  echo "✅ ENCRYPTION_KEY is set"
else
  echo "❌ ENCRYPTION_KEY not set"
  echo "   Fix: export ENCRYPTION_KEY=\$(openssl rand -hex 32)"
fi

echo ""
echo "4. Test server starts..."
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":0}' | node dist/cli.js --stdio 2>&1 | grep -q '"result"'
if [ $? -eq 0 ]; then
  echo "✅ Server starts and responds"
else
  echo "❌ Server failed to start"
fi

echo ""
echo "5. List tools..."
TOOL_COUNT=$(echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/cli.js --stdio 2>&1 | grep -o '"name":"sheets_' | wc -l)
echo "   Found $TOOL_COUNT tools (expected: 25)"

if [ "$TOOL_COUNT" -eq 25 ]; then
  echo "✅ All 25 tools registered"
else
  echo "⚠️  Tool count mismatch"
fi

echo ""
echo "6. List prompts..."
PROMPT_COUNT=$(echo '{"jsonrpc":"2.0","method":"prompts/list","id":1}' | node dist/cli.js --stdio 2>&1 | grep -o '"name":"' | wc -l)
echo "   Found $PROMPT_COUNT prompts (expected: 16)"

if [ "$PROMPT_COUNT" -eq 16 ]; then
  echo "✅ All 16 prompts registered"
else
  echo "⚠️  Prompt count mismatch"
fi

echo ""
echo "=== Diagnostics Complete ==="
```

Run it:
```bash
chmod +x diagnose.sh
./diagnose.sh
```

---

## Testing Individual Tools

### Test Auth (No Google API required)
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sheets_auth","arguments":{"action":"status"}},"id":1}' | node dist/cli.js --stdio 2>&1 | jq '.result'
```

Expected output includes:
```json
{
  "authenticated": true,  // or false
  "tokenLocation": "~/.config/servalsheets/tokens.enc",
  ...
}
```

### Test Spreadsheet Get (Requires valid ID)
```bash
SPREADSHEET_ID="YOUR_ACTUAL_SPREADSHEET_ID"

echo "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"sheets_spreadsheet\",\"arguments\":{\"action\":\"get\",\"spreadsheetId\":\"$SPREADSHEET_ID\"}},\"id\":2}" | node dist/cli.js --stdio 2>&1 | jq '.result'
```

Expected output:
- **Success:** Returns spreadsheet title, sheets, properties
- **Auth error:** "Not authenticated" message with instructions
- **Not found:** "SPREADSHEET_NOT_FOUND" or "PERMISSION_DENIED"

### Test Values Read (Requires valid ID + range)
```bash
SPREADSHEET_ID="YOUR_ACTUAL_SPREADSHEET_ID"

echo "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"sheets_values\",\"arguments\":{\"action\":\"read\",\"spreadsheetId\":\"$SPREADSHEET_ID\",\"range\":{\"a1\":\"Sheet1!A1:A1\"}}},\"id\":3}" | node dist/cli.js --stdio 2>&1 | jq '.result'
```

---

## Common Issues & Fixes

### "PERMISSION_DENIED"
**Cause:** Your OAuth tokens don't have Sheets API access
**Fix:**
1. Delete tokens: `rm ~/.config/servalsheets/tokens.enc`
2. Re-authenticate with proper scopes
3. Make sure OAuth consent screen includes Sheets API

### "SPREADSHEET_NOT_FOUND"
**Cause:** Invalid ID or no access
**Fix:**
1. Verify ID from Google Sheets URL
2. Make sure you have at least "viewer" access
3. Check spreadsheet isn't deleted

### "Token expired"
**Cause:** Access token expired, refresh token invalid
**Fix:**
1. Run `sheets_auth` with `action: "status"`
2. If expired, token should auto-refresh
3. If refresh fails, delete tokens and re-auth

### Server hangs/no response
**Cause:** Network issue, Google API timeout, or infinite loop
**Fix:**
1. Check internet connection
2. Try with simpler request (auth status)
3. Look for errors in debug logs: `LOG_LEVEL=debug node dist/cli.js --stdio 2>debug.log`
4. Check if Google Sheets API is down: https://www.google.com/appsstatus/dashboard/

---

## Still Not Working?

### Collect Debug Info
```bash
# 1. Get full server output
LOG_LEVEL=debug node dist/cli.js --stdio 2>full-debug.log &
PID=$!

# 2. Send test request
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sheets_auth","arguments":{"action":"status"}},"id":1}' | nc localhost 3000

# 3. Wait a moment
sleep 2

# 4. Kill server
kill $PID

# 5. Check logs
cat full-debug.log
```

### Share This Info
When reporting issues, include:
1. Output of `./diagnose.sh`
2. Any error messages from `full-debug.log`
3. Exact tool name, action, and arguments you're using
4. MCP client you're using (Claude Desktop, Inspector, custom)
5. Whether `sheets_auth` works or not

---

## Summary

**The Good News:**
- ✅ Build is successful (25 tools, 195 actions)
- ✅ All tests pass (1,761/1,761)
- ✅ `inspector.json` has correct format
- ✅ New prompts are registered (16 total)

**Your Issue:**
- Tools not returning responses (except auth)
- Most likely: Authentication tokens not properly loaded/used
- Or: Invalid spreadsheet ID

**Next Steps:**
1. Run `./diagnose.sh` to identify the issue
2. Verify authentication status shows `authenticated: true`
3. Test with a valid spreadsheet ID you own
4. Check debug logs for actual error messages
5. Use correct object format for ranges: `{ "a1": "..." }`

---

Need more help? Check:
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Comprehensive testing examples
- [README.md](README.md) - Setup and configuration
- [GitHub Issues](https://github.com/khill1269/servalsheets/issues)
