---
title: Complete Monitoring Test Guide
category: archived
last_updated: 2026-01-31
description: When you restart Claude Desktop, use these tools to verify all monitoring systems.
tags: [testing, monitoring, observability]
---

# Complete Monitoring Test Guide

When you restart Claude Desktop, use these tools to verify all monitoring systems.

## 🔍 Monitoring Systems Overview

### 1. Health Monitoring (Built-in)

**File**: [src/server.ts](src/server.ts#L161-L181)

- ✅ Heap health (memory usage)
- ✅ Connection health (heartbeat tracking)
- ✅ Automatic startup/shutdown
- ✅ Logs to console

### 2. Live Monitor (Advanced Logging)

**File**: [scripts/live-monitor.ts](scripts/live-monitor.ts)

- 📊 Real-time tool call tracking
- 🔍 Error pattern detection
- ⚡ Performance metrics
- 🚨 Anomaly detection (error spikes)
- ⏸️  Silence detection (idle warnings)
- 📈 Validation error hot spots

---

## 🧪 Test Plan

### Step 1: Start Live Monitor (Before Restarting Claude)

In a terminal, start the live monitor to capture all logs:

```bash
# Live follow mode (shows all tool calls in real-time)
npx tsx scripts/live-monitor.ts

# Or errors only
npx tsx scripts/live-monitor.ts --errors

# Or verbose mode (shows full payloads)
npx tsx scripts/live-monitor.ts --verbose

# Or export to JSON file
npx tsx scripts/live-monitor.ts --export
```

**What you'll see**:

```
╔═══════════════════════════════════════════════════════════════════════════╗
║            🦁 ServalSheets Live Monitor v2.1 (Anomaly Detection)           ║
╚═══════════════════════════════════════════════════════════════════════════╝

Log: mcp-server-ServalSheets.log
Started: 1/24/2026, 10:30:00 AM
Mode: Normal | Slow threshold: 3000ms
Press Ctrl+C to stop and show full analysis

Legend: → call  ← response  ✓ success  ✗ error
─────────────────────────────────────────────────────────────────────────────
```

Leave this running in the background.

---

### Step 2: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. Open your ServalSheets conversation

**What the live monitor will show**:

When Claude connects to ServalSheets, you'll see:

```
[10:30:15] → sheets_auth.status
[10:30:15] ← ✓ sheets_auth.status (125ms)
```

**Server logs** (in Claude Code or MCP logs):

```
[INFO] Health monitoring started
[INFO] Request queue initialized { maxConcurrent: 10 }
[DEBUG] Health check passed: heap { status: 'healthy' }
[DEBUG] Health check passed: connection { status: 'healthy' }
```

---

### Step 3: Make Some Tool Calls in Claude

Ask Claude to do some operations:

```
Can you list my spreadsheets?
```

**Live monitor shows**:

```
[10:31:45] → sheets_core.list
[10:31:46] ← ✓ sheets_core.list (1.2s)
```

**Health monitoring tracks**:

- ✅ Heartbeat recorded for `sheets_core`
- ✅ Connection status updates to "active"
- ✅ Last activity timestamp refreshed

---

### Step 4: Test Memory Pressure (Optional)

Trigger high memory usage to test heap warnings:

```bash
# In another terminal - simulate memory allocation
node -e "const arr = []; for(let i=0; i<10000000; i++) arr.push(new Array(100).fill(0));"
```

**Health monitoring will log**:

```
[WARN] Health check WARNING: heap {
  message: 'Heap usage at 73.2% (warning)',
  heapUsedMB: 1456.2,
  heapTotalMB: 1990.4,
  heapUsagePercent: 73.2
}
```

Or if critical (>85%):

```
[ERROR] Health check CRITICAL: heap {
  message: 'Heap usage at 87.5% (critical)',
  recommendation: 'Consider restarting server or investigating memory leaks'
}
```

---

### Step 5: Test Connection Health

Wait 60-120 seconds without making any tool calls.

**After 60s** (warning threshold):

```
[WARN] Health check WARNING: connection {
  message: 'Connection idle for 65000ms (warning)',
  lastActivity: 'sheets_core',
  idleTimeMs: 65000
}
```

**After 120s** (critical threshold):

```
[ERROR] Health check CRITICAL: connection {
  message: 'Connection idle for 125000ms (critical)',
  recommendation: 'Connection may be stale or hung'
}
```

---

### Step 6: Test Anomaly Detection

Make several tool calls with errors to trigger anomaly detection:

```
Can you read data from spreadsheet "invalid-id-12345"?
Can you read data from spreadsheet "another-bad-id"?
Can you read data from spreadsheet "yet-another-bad"?
```

**Live monitor will alert**:

```
╔════════════════════════════════════════════════╗
║ ⚠️  ANOMALY DETECTED                           ║
╚════════════════════════════════════════════════╝
  Error rate spike: 60% (baseline: 15%)
  Affected tools: sheets_data(75%)
```

---

### Step 7: Stop and Analyze

Press **Ctrl+C** in the live monitor terminal.

**You'll get a full report**:

```
═══════════════════════════════════════════════════════════════════════════
                              📊 ANALYSIS REPORT
═══════════════════════════════════════════════════════════════════════════

Overview
  Runtime:         5.2m
  Total Messages:  156
  Tool Calls:      42 (8.1/min)
  Responses:       42
  Errors:          5 (11.9%)
  Cancellations:   0
  Slow Calls:      2 (>3000ms)

Error Categories
  NOT_FOUND    3 (60%)
  VALIDATION   1 (20%)
  TIMEOUT      1 (20%)

Anomaly Detection
  Recent error rate: 15.0% (baseline: 15%)
  Status: ✓ Normal
  Window: Last 20/20 calls

Tool Performance
  Tool                      Calls   Errors   Err%        Avg   Slow
  ------------------------------------------------------------
  sheets_core                  15        0      0%      234ms      0
  sheets_data                  12        3     25%      1.2s       1
  sheets_auth                   8        0      0%      156ms      0
  sheets_analyze                7        2     29%      3.5s       1

Top 20 Actions
  sheets_core.list                             8 (0 err)    243ms ████
  sheets_data.read                             6 (2 err)    1.4s  ███
  sheets_auth.status                           5 (0 err)    142ms ██
  ...

Validation Error Hot Spots
  sheets_data.read:spreadsheetId               3 errors
  sheets_core.get:range                        1 errors

Spreadsheets Accessed
  1abc...xyz                       15 calls (0 errors)
  2def...abc                        8 calls (2 errors)

Slow Calls (>3000ms)
  [10:32:15] sheets_analyze.comprehensive 5.2s
  [10:33:42] sheets_data.read 3.8s

Recent Errors (last 15)
  [10:31:50] sheets_data.read
    ╔══════════════════════╗
    ║ NOT_FOUND            ║
    ╚══════════════════════╝
    Spreadsheet not found: invalid-id-12345
```

---

## 📊 What Each System Monitors

### Health Monitoring (Built-in)

| Check | Metric | Warning | Critical | Interval |
|-------|--------|---------|----------|----------|
| Heap | Memory usage | 70% | 85% | 30s |
| Connection | Idle time | 60s | 120s | 30s |

**Logs to**: Server console (visible in Claude Code or MCP logs)

### Live Monitor (Advanced)

| Feature | What it tracks |
|---------|----------------|
| Tool Calls | Every `tools/call` request with action |
| Responses | Success/failure, duration, error category |
| Error Patterns | VALIDATION, NOT_FOUND, AUTH, RATE_LIMIT, TIMEOUT, API, SCHEMA |
| Performance | Avg duration per tool, slow calls (>3s), calls/min |
| Anomalies | Error rate spikes (>2x baseline), silence (>60s idle) |
| Validation | Which fields cause most errors |
| Spreadsheets | Access frequency per spreadsheet ID |

**Logs to**: Terminal (your live monitor window)

---

## 🚀 Quick Test Commands

Run these in separate terminals:

```bash
# Terminal 1: Live monitor
npx tsx scripts/live-monitor.ts --verbose

# Terminal 2: Health monitoring test (standalone)
npm run test:health

# Terminal 3: MCP Inspector (optional)
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## ✅ Success Criteria

After testing, you should see:

### Health Monitoring

- ✅ "Health monitoring started" log on server init
- ✅ Heap check runs every 30s (logs in DEBUG level)
- ✅ Connection check runs every 30s
- ✅ Heartbeats recorded on each tool call
- ✅ Warnings logged at 70% heap / 60s idle
- ✅ Critical alerts at 85% heap / 120s idle
- ✅ "Health monitoring stopped" on shutdown

### Live Monitor

- ✅ All tool calls captured with timestamps
- ✅ Error categorization working (NOT_FOUND, VALIDATION, etc.)
- ✅ Performance metrics accurate (duration, slow calls)
- ✅ Anomaly detection alerts on error spikes
- ✅ Silence detection warns after 60s idle
- ✅ Full report generated on Ctrl+C
- ✅ Export to JSON works (with --export flag)

---

## 🐛 Troubleshooting

### Live Monitor shows "Log file not found"

**Fix**: Make sure Claude Desktop is running and ServalSheets is configured
**Log location**: `~/Library/Logs/Claude/mcp-server-ServalSheets.log`

### Health monitoring not logging

**Fix**: Check log level is set to INFO or DEBUG
**Verify**: Look for "Health monitoring started" in server logs

### No heartbeats recorded

**Fix**: Make sure tool calls are actually executing
**Verify**: Check live monitor shows tool responses

### Memory warnings not triggering

**Fix**: Your heap usage is healthy (good!)
**Test**: Simulate high memory usage with the node command above

---

## 📝 Example Full Test Session

```bash
# Terminal 1: Start live monitor
npx tsx scripts/live-monitor.ts --verbose

# Terminal 2: Watch server logs (if running locally)
tail -f ~/Library/Logs/Claude/mcp-server-ServalSheets.log | grep -i health

# Now restart Claude Desktop and:
# 1. Open ServalSheets conversation
# 2. Ask "Can you list my spreadsheets?"
# 3. Ask "Can you read data from [your-spreadsheet-id] range A1:B10?"
# 4. Wait 65 seconds (no tool calls)
# 5. Make another tool call
# 6. Press Ctrl+C in live monitor terminal

# You should see:
# ✅ Health monitoring started
# ✅ Heap and connection checks running
# ✅ Heartbeats on each tool call
# ✅ Idle warning after 60s
# ✅ Full analysis report from live monitor
```

---

## 🎯 Key Verification Points

When Claude restarts:

1. **Server starts** → Check for "Health monitoring started" in logs
2. **First tool call** → Verify heartbeat recorded in health check
3. **After 30 seconds** → Health checks should have run 1x each
4. **After 60 seconds idle** → Connection health should warn
5. **After tool activity** → Connection health returns to normal
6. **High memory** → Heap check should warn/alert
7. **Error spike** → Live monitor anomaly detection alerts
8. **Ctrl+C in monitor** → Full analysis report generated

---

**Ready to test?** 🚀

1. Start live monitor: `npx tsx scripts/live-monitor.ts`
2. Restart Claude Desktop
3. Make some tool calls
4. Watch both monitoring systems work together!
