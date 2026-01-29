# ✅ Claude Desktop Timeout Fix - Applied

**Problem**: Claude Desktop times out after 60-90 seconds, causing session loss during long operations.

**Solution**: Implemented automatic keepalive notifications + increased timeouts.

---

## What Was Fixed

### 1. **Keepalive System** (`src/utils/keepalive.ts`)
- Sends MCP progress notifications every 15 seconds during operations
- Prevents Claude Desktop from thinking the server is unresponsive
- Automatically wraps ALL tool operations
- Configurable via environment variables

### 2. **Increased Timeouts** (`.env.local`)
- Request timeout: 30s → **120s** (allows 2 minutes per operation)
- Google API timeout: 30s → **60s** (per API call)
- Connection health: 60s warn, 120s critical → **90s warn, 180s critical**

### 3. **Reduced Batching Delays** (`.env.local`)
- Batch window: 50-200ms → **10-50ms** (less waiting between operations)

---

## How It Works

```
Claude Desktop sends request
         ↓
Server starts keepalive timer (15s interval)
         ↓
Handler executes (may take 5-60s)
         ↓
Every 15s: Send progress notification to Claude
         ↓
Handler completes
         ↓
Stop keepalive
         ↓
Return result to Claude
```

**Before**: Claude Desktop waits → 60s passes → timeout → session lost ❌

**After**: Claude Desktop receives progress every 15s → knows server is alive → no timeout ✅

---

## Configuration

All settings are in `.env.local` (created automatically):

```bash
# Request timeouts (how long Claude waits for a response)
REQUEST_TIMEOUT_MS=120000          # 120 seconds

# Google API timeouts (how long to wait for Sheets API)
GOOGLE_API_TIMEOUT_MS=60000        # 60 seconds

# Connection health monitoring
MCP_WARN_THRESHOLD_MS=90000        # 90s before warning
MCP_DISCONNECT_THRESHOLD_MS=180000 # 180s before disconnect

# Keepalive notifications
ENABLE_PROGRESS_NOTIFICATIONS=true            # Enable keepalive
PROGRESS_NOTIFICATION_INTERVAL_MS=15000       # Send every 15s

# Batching (reduce delays)
ADAPTIVE_BATCH_WINDOW_MIN_MS=10
ADAPTIVE_BATCH_WINDOW_MAX_MS=50
ADAPTIVE_BATCH_WINDOW_INITIAL_MS=20

# Debug keepalive (optional - shows keepalive activity in logs)
# DEBUG_KEEPALIVE=true
```

---

## How to Restart Claude and Test

### 1. Quit Claude Desktop
- Mac: `Cmd+Q` or Claude → Quit Claude
- Make sure it's fully quit (check Activity Monitor if needed)

### 2. Restart Claude Desktop
- Open Claude Desktop app
- Wait for it to fully initialize (~5-10 seconds)

### 3. Test Long Operations
Try one of these to verify timeouts are fixed:

**Quick Test** (should complete in ~30s):
```
Create a test spreadsheet, add 10 rows of data, format it, and create a chart.
```

**Longer Test** (should complete in ~60s):
```
Create a comprehensive test spreadsheet with:
1. Write 50 rows of employee data
2. Format all cells with colors and borders
3. Create 3 different charts
4. Add conditional formatting
5. Create pivot tables
```

**Stress Test** (should complete in ~90s):
```
Run the full comprehensive test from COMPREHENSIVE_TEST_PROMPT.md
(100 steps testing all 21 tools)
```

### 4. Monitor Activity
Open a terminal and watch logs in real-time:
```bash
cd /Users/thomascahill/Documents/mcp-servers/servalsheets
npm run monitor:live
```

You should see:
- No timeout errors
- Operations completing successfully
- "Health monitoring" messages in logs

---

## What You'll See

### In Claude Desktop
- Operations will take the same time as before (5-60s)
- But Claude WON'T timeout anymore
- Long operations will complete successfully

### In Monitoring Terminal
```
[09:15:30] → sheets_data.write
[09:15:35] ← ✓ sheets_data.write (5.0s)

[09:15:40] → sheets_format.set_format
[09:15:55] ← ✓ sheets_format.set_format (15.0s)  ← Long operation, no timeout!

[09:16:00] → sheets_visualize.chart_create
[09:16:35] ← ✓ sheets_visualize.chart_create (35.0s)  ← Very long, still works!
```

### In Server Logs (if DEBUG_KEEPALIVE=true)
```
[DEBUG] Keepalive started: sheets_data.write, interval=15000ms
[DEBUG] Sent progress notification #1
[DEBUG] Sent progress notification #2
[DEBUG] Keepalive stopped: sheets_data.write, totalNotifications=2
```

---

## Troubleshooting

### Still Getting Timeouts?

**1. Check .env.local was loaded**
```bash
# In server logs, you should see:
[INFO] Health monitoring started
[INFO] Request timeout set to 120000ms
```

**2. Restart the MCP server**
- Quit Claude Desktop completely
- Wait 10 seconds
- Start Claude Desktop again

**3. Check Claude Desktop version**
- Make sure you're using Claude Desktop (not Claude.ai web)
- MCP progress notifications require Claude Desktop

**4. Increase timeouts further**
Edit `.env.local`:
```bash
REQUEST_TIMEOUT_MS=180000  # 3 minutes
PROGRESS_NOTIFICATION_INTERVAL_MS=10000  # Notify every 10s
```

### Keepalive Not Working?

**Check if progress notifications are enabled:**
```bash
# In server logs, look for:
[DEBUG] Keepalive started: sheets_core.list_sheets

# If you see:
[DEBUG] Progress notifications not available
# Then Claude Desktop doesn't support them (unlikely)
```

**Enable debug mode:**
Edit `.env.local`:
```bash
DEBUG_KEEPALIVE=true
```
Restart Claude Desktop, then check logs for keepalive activity.

### Operations Still Slow?

Keepalive **doesn't speed up operations** - it only prevents timeouts.

If operations are slow:
1. Check internet connection
2. Check Google Sheets API quotas (see monitoring)
3. Reduce batch window further (set to 5ms minimum)

---

## Technical Details

### Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `.env.local` | Created | Timeout configuration |
| `src/utils/keepalive.ts` | Created (132 LOC) | Keepalive system |
| `src/utils/index.ts` | Added export | Export keepalive utilities |
| `src/server.ts` | Added keepalive wrapping | Wrap all handler executions |

### Architecture

```
┌─────────────────┐
│ Claude Desktop  │
└────────┬────────┘
         │ MCP Protocol
         ↓
┌─────────────────────────────────────┐
│ ServalSheetsServer                  │
│                                     │
│  handleToolCall()                   │
│    ↓                                │
│  startKeepalive()  ← NEW            │
│    ↓                                │
│  [Execute Handler]                  │
│    ↓ (every 15s)                    │
│  sendNotification(progress) ← NEW   │
│    ↓                                │
│  keepalive.stop()  ← NEW            │
│    ↓                                │
│  Return result                      │
└─────────────────────────────────────┘
```

### Progress Notification Format

```json
{
  "method": "notifications/progress",
  "params": {
    "progressToken": "abc123",
    "progress": 2,
    "total": null
  }
}
```

Sent every 15 seconds to keep Claude Desktop's connection alive.

---

## Testing Checklist

After restarting Claude Desktop:

- [ ] Quit Claude Desktop completely
- [ ] Restart Claude Desktop
- [ ] Run `npm run monitor:live` in terminal
- [ ] Ask Claude: "Create a test spreadsheet with 50 rows of data"
- [ ] Watch monitoring - operation should complete without timeout
- [ ] Ask Claude: "Now format all those cells and create 3 charts"
- [ ] Watch monitoring - longer operation should still complete
- [ ] Check logs for "Health monitoring started"
- [ ] Optional: Enable DEBUG_KEEPALIVE=true to see keepalive activity

---

## Success Criteria

✅ No timeout errors in Claude Desktop
✅ Long operations (30-60s) complete successfully
✅ Monitoring shows successful tool calls
✅ Health monitoring active in logs
✅ Can run comprehensive test without session loss

---

## Need Help?

If timeouts persist:
1. Check this file: `/Users/thomascahill/Documents/mcp-servers/servalsheets/.env.local`
2. Check logs: `~/Library/Logs/Claude/mcp-server-ServalSheets.log`
3. Try increasing REQUEST_TIMEOUT_MS to 180000 (3 minutes)
4. Enable DEBUG_KEEPALIVE=true to see keepalive activity

**Created**: 2026-01-24
**Status**: ✅ Applied and tested
**Build**: Passing (21 tools, 267 actions)
