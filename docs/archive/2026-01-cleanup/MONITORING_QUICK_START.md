---
title: 🚀 Monitoring Quick Start
category: archived
last_updated: 2026-01-31
description: Everything you need to test health monitoring when you restart Claude.
tags: [monitoring, observability]
---

# 🚀 Monitoring Quick Start

Everything you need to test health monitoring when you restart Claude.

## Quick Commands

```bash
# Start comprehensive monitoring (recommended)
npm run monitor:start

# Or just live monitor
npm run monitor:live

# Or errors only
npm run monitor:errors

# Or analyze existing logs
npm run monitor:stats

# Or test health monitoring standalone
npm run test:health
```

## What You'll See

### When Monitor Starts

```
╔═══════════════════════════════════════════════════════════════════════════╗
║            🦁 ServalSheets Live Monitor v2.1 (Anomaly Detection)           ║
╚═══════════════════════════════════════════════════════════════════════════╝

Monitoring features:
  📊 Real-time tool call tracking
  🔍 Error pattern detection
  ⚡ Performance metrics (slow call threshold: 2000ms)
  🚨 Anomaly detection (error spikes)
  ⏸️  Silence detection (idle >60s)
  📈 Validation error hot spots

Health monitoring (automatic):
  💾 Heap health (warns at 70%, critical at 85%)
  🔗 Connection health (warns at 60s, critical at 120s)
  ⏰ Checks every 30 seconds
```

### When Claude Connects

```
[10:30:15] → sheets_auth.status
[10:30:15] ← ✓ sheets_auth.status (125ms)
```

Server logs:

```
[INFO] Health monitoring started
[INFO] Request queue initialized
[DEBUG] Health check passed: heap
[DEBUG] Health check passed: connection
```

### When You Make Tool Calls

```
[10:31:45] → sheets_core.list
[10:31:46] ← ✓ sheets_core.list (1.2s)

[10:32:10] → sheets_data.read [1abc...xyz]
[10:32:11] ← ✓ sheets_data.read (856ms)
```

### When Errors Occur

```
[10:35:20] → sheets_data.read [invalid-id]
[10:35:21] ← ✗ sheets_data.read (234ms) ╔══════════════╗
                                          ║ NOT_FOUND    ║
                                          ╚══════════════╝
    └─ Spreadsheet not found: invalid-id
```

### When Memory is High (>70%)

```
[WARN] Health check WARNING: heap {
  message: 'Heap usage at 73.2% (warning)',
  heapUsedMB: 1456.2
}
```

### When Connection is Idle (>60s)

```
[WARN] Health check WARNING: connection {
  message: 'Connection idle for 65000ms (warning)',
  lastActivity: 'sheets_core'
}
```

### When Anomaly Detected

```
╔════════════════════════════════════════════════╗
║ ⚠️  ANOMALY DETECTED                           ║
╚════════════════════════════════════════════════╝
  Error rate spike: 60% (baseline: 15%)
  Affected tools: sheets_data(75%)
```

### Final Report (Ctrl+C)

```
═══════════════════════════════════════════════════════════════════════════
                              📊 ANALYSIS REPORT
═══════════════════════════════════════════════════════════════════════════

Overview
  Runtime:         5.2m
  Tool Calls:      42 (8.1/min)
  Errors:          5 (11.9%)
  Slow Calls:      2 (>2000ms)

Tool Performance
  sheets_core      15 calls    0 errors     234ms avg
  sheets_data      12 calls    3 errors     1.2s avg
  sheets_analyze    7 calls    2 errors     3.5s avg

Error Categories
  NOT_FOUND    3 (60%)
  VALIDATION   1 (20%)
  TIMEOUT      1 (20%)

📄 Exported report to: monitor-report-2026-01-24T15-30-45.json
```

## Test Checklist

When you restart Claude:

1. ✅ **Start monitor** - Run `npm run monitor:start` first
2. ✅ **Restart Claude** - Quit and reopen Claude Desktop
3. ✅ **Check connection** - See `sheets_auth.status` call
4. ✅ **Make tool calls** - Ask Claude to do operations
5. ✅ **Check health logs** - "Health monitoring started" appears
6. ✅ **Wait 65s idle** - Connection health warning triggers
7. ✅ **Make more calls** - Health returns to normal
8. ✅ **Stop monitor** - Press Ctrl+C for full report

## What's Being Monitored

| System | Feature | Threshold | Action |
|--------|---------|-----------|--------|
| **Health** | Heap usage | 70% warn, 85% critical | Auto-logged every 30s |
| **Health** | Connection idle | 60s warn, 120s critical | Tracks tool call heartbeats |
| **Live Monitor** | Tool calls | All | Real-time display |
| **Live Monitor** | Errors | All | Categorized + logged |
| **Live Monitor** | Performance | >2000ms | Highlighted as slow |
| **Live Monitor** | Anomalies | Error rate >2x baseline | Alert displayed |
| **Live Monitor** | Silence | >60s no activity | Idle warning |

## Files Reference

- **Health Monitor**: [src/server.ts:161-181](src/server.ts#L161-L181)
- **Live Monitor**: [scripts/live-monitor.ts](scripts/live-monitor.ts)
- **Full Guide**: [TEST_ALL_MONITORING.md](TEST_ALL_MONITORING.md)
- **Health Guide**: [HEALTH_MONITORING.md](HEALTH_MONITORING.md)

## Troubleshooting

**Monitor says "Log file not found"**

- Make sure Claude Desktop is running
- Check config: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Log location: `~/Library/Logs/Claude/mcp-server-ServalSheets.log`

**No health monitoring logs**

- Health logs go to server console (INFO/DEBUG level)
- In Claude Code, check the server output panel
- Or watch: `tail -f ~/Library/Logs/Claude/mcp-server-ServalSheets.log`

**Monitor running but no tool calls**

- Claude must be actively using ServalSheets
- Ask Claude: "Can you list my spreadsheets?"
- Check auth status first: "What's my ServalSheets connection status?"

---

**Ready to test?** Run: `npm run monitor:start` 🚀
