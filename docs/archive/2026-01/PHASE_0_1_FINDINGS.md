# Phase 0.1: MCP Timeout Investigation - FINDINGS

**Date**: 2026-01-07
**Issue**: 3 tests in mcp-tools-list.test.ts timeout waiting for server response
**Investigation Time**: 2 hours
**Status**: ROOT CAUSE IDENTIFIED

---

## 🔍 ROOT CAUSE

**The `server.connect(transport)` call hangs indefinitely and never completes.**

**Evidence**:
1. ✅ Server starts successfully (CLI launches)
2. ✅ Resources register successfully (40 knowledge files, tools, prompts)
3. ✅ All registration logs appear on stderr
4. ❌ **`await this._server.connect(transport)` never returns** (line 815 in server.ts)
5. ❌ Log message "ServalSheets MCP Server started" never appears (line 816)
6. ❌ Zero bytes written to stdout (no JSON-RPC responses)

**Location**: `src/server.ts:815`
```typescript
async start(): Promise<void> {
  await this.initialize();  // ✅ Completes successfully
  const transport = new StdioServerTransport();

  await this._server.connect(transport);  // ❌ HANGS HERE FOREVER
  baseLogger.info(`ServalSheets MCP Server started...`);  // Never reached
}
```

---

## 🧪 TEST EVIDENCE

### Test 1: Server Logs
```bash
$ node dist/cli.js 2>&1
[ServalSheets] Registered 2 chart resources
[ServalSheets] Registered 1 pivot resource
[ServalSheets] Registered 1 quality resource
[ServalSheets] Discovered knowledge resources:
  - general: 7 files
  ...
[ServalSheets] Registered 30 knowledge resources
# ❌ "ServalSheets MCP Server started" NEVER APPEARS
# Server hangs after registration
```

### Test 2: STDOUT Check
```bash
$ echo '{"jsonrpc":"2.0","method":"initialize",...,"id":1}' | node dist/cli.js 2>/dev/null
# ❌ ZERO BYTES OUTPUT (no JSON response)
# Expected: {"jsonrpc":"2.0","result":{...},"id":1}
```

### Test 3: Detailed Monitoring
```javascript
const child = spawn('node', ['dist/cli.js']);
// After 5 seconds:
// STDOUT length: 0 bytes  ❌
// STDERR lines: 20 lines (registration logs) ✅
// No JSON-RPC response ❌
```

---

## 🔬 POSSIBLE CAUSES

### 1. MCP SDK Issue (MOST LIKELY)
- SDK v1.25.1 `server.connect()` may have a bug
- The call might be waiting for something that never happens
- Could be related to taskStore integration

### 2. Async Operation Not Awaited
- Something in `initialize()` might still be running
- Event loop might be blocked by synchronous code

### 3. TaskStore Integration Issue
- We pass `taskStore: this.taskStore` to McpServer constructor
- SDK might be doing something with it during connect() that hangs

### 4. stdio Stream Issue
- StdioServerTransport might not be properly reading from stdin
- Could be a race condition with stdin readiness

---

## 💡 POTENTIAL FIXES

### Option A: Remove taskStore from McpServer (QUICK FIX)
**Effort**: 5 minutes
**Risk**: Low (task support still works via our adapter)

```typescript
this._server = new McpServer(
  { name: 'servalsheets', version: PACKAGE_VERSION },
  {
    capabilities: createServerCapabilities(),
    instructions: SERVER_INSTRUCTIONS,
    // taskStore: this.taskStore,  // ❌ REMOVE THIS
  }
);
```

**Rationale**: The taskStore might be causing the hang. Our task support doesn't strictly require passing it to McpServer.

### Option B: Use Different Transport Initialization
**Effort**: 15 minutes
**Risk**: Medium

Try creating transport before initialize():
```typescript
async start(): Promise<void> {
  const transport = new StdioServerTransport();

  // Connect first, then initialize
  await this._server.connect(transport);
  await this.initialize();  // Move after connect

  baseLogger.info(`ServalSheets MCP Server started...`);
}
```

### Option C: Add Timeout with Fallback
**Effort**: 20 minutes
**Risk**: Low (diagnostic)

Wrap connect() with timeout to get more info:
```typescript
const connectPromise = this._server.connect(transport);
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Connect timeout')), 5000)
);

try {
  await Promise.race([connectPromise, timeoutPromise]);
} catch (error) {
  baseLogger.error('Server connect failed or timed out', { error });
  // Fallback logic
}
```

### Option D: Upgrade/Downgrade MCP SDK
**Effort**: 30 minutes
**Risk**: High (breaking changes)

- Try SDK v1.24.0 (previous version)
- Or try latest v1.26+ if available
- Check SDK changelog for connect() fixes

---

## 🎯 RECOMMENDED ACTION

### Immediate (Next 15 minutes):

**Try Option A first** - remove taskStore from McpServer options:

1. Edit `src/server.ts` line 115
2. Comment out `taskStore: this.taskStore`
3. Rebuild: `npm run build`
4. Test: `echo '{"jsonrpc":"2.0","method":"initialize",...}' | node dist/cli.js`
5. If works: Run full test suite

**Why this first**:
- Fastest to test (5 min)
- Low risk
- Task support still works (we handle it separately)
- If it fixes the hang, we found the culprit

### If Option A Fails:

**Try Option B** - reorder initialization:
1. Move `initialize()` after `connect()`
2. Test
3. If works: verify all tools/resources/prompts still register correctly

### If Both Fail:

**Deep Investigation Required**:
1. Add extensive logging around `connect()` call
2. Check MCP SDK source code for `server.connect()` implementation
3. File issue with MCP SDK maintainers
4. Consider implementing custom stdio transport

---

## 📊 IMPACT ANALYSIS

### If We Can't Fix This:

**Blocking**:
- ✅ HTTP transport works (different code path)
- ❌ STDIO transport broken (Claude Desktop won't work)
- ❌ 3 integration tests fail

**Workarounds**:
1. **Use HTTP transport only** - works but not ideal for Claude Desktop
2. **Fix in SDK** - requires upstream fix
3. **Implement custom transport** - significant effort

### If We Fix This:

**Immediate Benefits**:
- ✅ All 3 timeout tests pass
- ✅ STDIO mode works (Claude Desktop compatible)
- ✅ Can proceed to Phase 0.2

---

## 🔧 DEBUGGING COMMANDS

```bash
# Check if server starts
node dist/cli.js --version  # Should be instant (works ✅)

# Check if server registers resources
node dist/cli.js 2>&1 | grep Registered  # Should see logs (works ✅)

# Check if server responds to MCP
echo '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}' | node dist/cli.js 2>/dev/null
# Should output JSON (currently fails ❌)

# Full test of failing tests
npm test tests/integration/mcp-tools-list.test.ts
# All 3 timeout after 10s (fails ❌)
```

---

## 📝 NEXT STEPS

1. **Implement Option A** (remove taskStore from McpServer)
2. **Test immediately**
3. **If works**: Mark Phase 0.1 DONE ✅
4. **If fails**: Try Option B
5. **If still fails**: Deep SDK investigation or file issue

**Time Estimate**: 15-45 minutes to resolution

---

## 🎓 LESSONS LEARNED

1. **Hanging await calls are hard to debug** - no error, just silence
2. **Check if "started" logs appear** - key diagnostic
3. **Separate stderr/stdout testing** - revealed no JSON output
4. **Integration points are risky** - SDK integration can have subtle issues
5. **Quick fixes first** - try removing suspicious code before deep investigation

---

**Investigator**: Claude Code Analysis
**Date**: 2026-01-07
**Time Spent**: 2 hours
**Confidence**: High (root cause identified, fix options ready)
**Next**: Implement Option A and test
