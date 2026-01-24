# Health Monitoring System

ServalSheets includes an integrated health monitoring system for production observability.

## What's Monitored

### 1. Heap Health Check
- **What**: Monitors Node.js heap memory usage
- **Thresholds**:
  - ⚠️ **Warning**: 70% heap usage
  - 🚨 **Critical**: 85% heap usage
- **Interval**: Every 30 seconds
- **Snapshots**: Optional heap snapshots on critical (set `ENABLE_HEAP_SNAPSHOTS=true`)

### 2. Connection Health Check
- **What**: Tracks MCP connection activity via tool call heartbeats
- **Thresholds**:
  - ⚠️ **Warning**: 60 seconds idle
  - 🚨 **Critical**: 120 seconds idle
- **Interval**: Every 30 seconds
- **Heartbeats**: Recorded on every tool call

## How It Works

### Automatic Startup
Health monitoring starts automatically when the server initializes:

```typescript
// In src/server.ts
await this.healthMonitor.start();
// Logs: "Health monitoring started"
```

### Heartbeat Tracking
Every tool call records a heartbeat to track connection health:

```typescript
// In src/server.ts handleToolCall()
this.connectionHealthCheck.recordHeartbeat(toolName);
```

### Graceful Shutdown
Health monitoring stops cleanly on server shutdown:

```typescript
await this.healthMonitor.stop();
// Logs: "Health monitoring stopped"
```

## Testing Health Monitoring

### Quick Test
Run the health monitoring test script:

```bash
npm run test:health
```

This will:
1. ✅ Start the server and health monitoring
2. ✅ Wait for health checks to execute
3. ✅ Display health status for all checks
4. ✅ Simulate tool calls to test heartbeat tracking
5. ✅ Show connection health after activity
6. ✅ Gracefully shutdown

### Expected Output
```
🏥 Health Monitoring Test

1️⃣  Initializing server...
✅ Server initialized

2️⃣  Waiting for health checks to execute (5 seconds)...
✅ Health checks running

3️⃣  Checking health status...
✅ Health Status:
   - Healthy: ✅
   - Total checks: 2
   - Healthy checks: 2
   - Warning checks: 0
   - Critical checks: 0

4️⃣  Individual Check Results:
   ✅ heap: healthy
      Heap usage: 42.3% (healthy)
      Metadata: heapUsedMB: 145.2, heapTotalMB: 343.5, heapUsagePercent: 42.3

   ✅ connection: healthy
      Connection active: last activity 2s ago
      Metadata: lastActivity: sheets_core, idleTimeMs: 2134, lastToolCall: sheets_core

5️⃣  Simulating tool calls to test heartbeat tracking...
✅ Heartbeats recorded: sheets_core, sheets_data, sheets_analyze

6️⃣  Checking connection health after heartbeats...
✅ Connection Health:
   Status: healthy
   Message: Connection active: last activity 1s ago
   Last activity: sheets_analyze
   Idle time: 1024ms

7️⃣  Shutting down server...
✅ Server shutdown complete

🎉 All health monitoring tests passed!
```

## Production Monitoring

### Environment Variables

Configure health check thresholds:

```bash
# Connection health thresholds
export MCP_DISCONNECT_THRESHOLD_MS=120000  # 2 minutes
export MCP_WARN_THRESHOLD_MS=60000         # 1 minute

# Heap snapshot settings
export ENABLE_HEAP_SNAPSHOTS=true
export HEAP_SNAPSHOT_PATH=./heap-snapshots
```

### Log Messages

Health monitoring logs to console with different levels:

- **DEBUG**: Health check passed
- **INFO**: Health monitoring started/stopped
- **WARN**: Health check WARNING (heap >70%, connection >60s idle)
- **ERROR**: Health check CRITICAL (heap >85%, connection >120s idle)

### Example Logs

```
[INFO] Health monitoring started
[DEBUG] Health check passed: heap { status: 'healthy' }
[DEBUG] Health check passed: connection { status: 'healthy' }
[WARN] Health check WARNING: heap { message: 'Heap usage at 73.2% (warning)', ... }
[ERROR] Health check CRITICAL: heap { message: 'Heap usage at 87.5% (critical)', ... }
[INFO] Health monitoring stopped
```

## When Claude Restarts

When you restart Claude Desktop:

1. ✅ **Server starts** - Health monitoring initializes
2. ✅ **Health checks run** - Heap and connection checks execute every 30s
3. ✅ **Heartbeats tracked** - Every tool call updates connection health
4. ✅ **Warnings logged** - Memory pressure or idle connections trigger alerts
5. ✅ **Graceful shutdown** - Monitoring stops cleanly on exit

## Architecture

### Health Monitor (Central Coordinator)
- File: [src/server/health-monitor.ts](src/server/health-monitor.ts)
- Manages multiple health check plugins
- Runs checks on schedule (30s default)
- Aggregates results into overall health status

### Health Check Plugins
1. **HeapHealthCheck**: [src/server/heap-health-check.ts](src/server/heap-health-check.ts)
   - Monitors `process.memoryUsage().heapUsed`
   - Warns at 70%, critical at 85%
   - Optional heap snapshots on critical

2. **ConnectionHealthCheck**: [src/server/connection-health-check.ts](src/server/connection-health-check.ts)
   - Tracks last tool call timestamp
   - Warns after 60s idle, critical after 120s
   - Records tool names for debugging

### Integration Points
- **Startup**: [src/server.ts:284](src/server.ts#L284)
- **Heartbeats**: [src/server.ts:571](src/server.ts#L571)
- **Shutdown**: [src/server.ts:927](src/server.ts#L927)

## Benefits

✅ **Early Warning** - Detect memory leaks before crashes
✅ **Connection Monitoring** - Know when MCP connection is idle/stale
✅ **Production Ready** - Automatic monitoring with no configuration needed
✅ **Graceful Degradation** - Warnings before critical failures
✅ **Observability** - Detailed logs for debugging

## Next Steps

1. **Run the test**: `npm run test:health`
2. **Restart Claude** - Health monitoring starts automatically
3. **Monitor logs** - Watch for health check messages
4. **Use tools** - See heartbeats update connection health
5. **Check memory** - Verify heap warnings work (simulate high memory usage)

---

**Note**: Health monitoring is already integrated and active. No additional setup required!
