# 🔬 ServalSheets v1.3.0 - Advanced Testing & Tracing Strategy

**"Think Outside the Box" - Comprehensive Testing Plan**

This document outlines advanced testing strategies beyond standard unit/integration tests to ensure production readiness and uncover hidden issues.

---

## 1. 🔍 DISTRIBUTED TRACING & OBSERVABILITY

### Request Flow Tracing

**Goal**: Trace a request from Claude Desktop → MCP Server → Google Sheets API and back

**Implementation**:
```typescript
// Enable full request tracing
LOG_LEVEL=debug \
REQUEST_TRACING=true \
TRACE_ALL_API_CALLS=true \
npm run start:stdio
```

**What to trace**:
1. ✅ MCP JSON-RPC request received
2. ✅ Schema validation (Zod)
3. ✅ Handler invocation
4. ✅ Google API client call
5. ✅ Response transformation
6. ✅ MCP response sent
7. ✅ Total latency at each step

**Test cases**:
- [ ] Simple read operation (sheets_data get)
- [ ] Complex write with batching (sheets_data update_batch)
- [ ] Long-running task with cancellation
- [ ] Error scenario (invalid spreadsheet ID)
- [ ] Rate limit hit scenario

### OpenTelemetry Integration Test

**Create test harness**:
```bash
# Test with Jaeger or Zipkin
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Run server with OTEL
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
npm run start:stdio
```

**Verify**:
- [ ] Spans created for each operation
- [ ] Parent-child relationships correct
- [ ] Attributes populated (tool name, args, etc.)
- [ ] Error spans marked correctly

---

## 2. 🧪 EDGE CASE & BOUNDARY TESTING

### Data Extremes

**Test with**:
```typescript
// Test cases to create:
1. Empty spreadsheet (0 rows, 0 columns)
2. Massive spreadsheet (10M cells)
3. Single cell spreadsheet
4. 1000 column spreadsheet
5. Spreadsheet with special characters in all fields
6. Spreadsheet with emoji, unicode, RTL text
7. Spreadsheet with all formula types
8. Circular reference formulas
9. External reference formulas
10. Named ranges everywhere
```

**Automated test**:
```bash
# Create test script
cat > tests/extreme/edge-cases.test.ts << 'TEST'
describe('Edge Cases', () => {
  test('handles empty spreadsheet gracefully', async () => {
    // Create spreadsheet with 0 rows
    const result = await sheets_data.get({
      spreadsheetId: emptySheetId,
      range: 'A1:Z1000'
    });
    expect(result.values).toEqual([]);
  });

  test('handles massive range without crashing', async () => {
    // Request 1M cells
    const result = await sheets_data.get({
      spreadsheetId: testSheetId,
      range: 'A1:ZZZ100000'
    });
    // Should sample or paginate
    expect(result).toBeDefined();
  });

  test('handles special characters in all fields', async () => {
    const specialChars = '§±!@#$%^&*()[]{}|\\/:;"\'<>?,./~`';
    // Test with sheet names, cell values, formulas
  });
});
TEST
```

### Concurrency Testing

**Test parallel requests**:
```typescript
// Simulate 100 concurrent requests
async function concurrencyTest() {
  const requests = Array(100).fill(null).map((_, i) => 
    callTool('sheets_data', {
      action: 'get',
      spreadsheetId: testId,
      range: `A${i}:Z${i}`
    })
  );
  
  const results = await Promise.allSettled(requests);
  
  // Verify:
  // 1. No race conditions
  // 2. Rate limiting works
  // 3. Request deduplication effective
  // 4. No deadlocks
  // 5. All requests eventually succeed or fail gracefully
}
```

---

## 3. 🚨 CHAOS ENGINEERING

### Fault Injection

**Create chaos test suite**:
```typescript
// Test network failures
describe('Chaos: Network', () => {
  test('handles Google API timeout', async () => {
    // Mock slow API response (30s)
    nock('https://sheets.googleapis.com')
      .get(/.*/)
      .delayConnection(30000)
      .reply(200, {});
    
    // Should timeout and retry
    await expect(callTool('sheets_data', {...}))
      .rejects.toThrow('timeout');
  });

  test('handles intermittent connectivity', async () => {
    // Fail 3 times, then succeed
    let attempts = 0;
    nock('https://sheets.googleapis.com')
      .get(/.*/)
      .times(3)
      .reply(() => {
        attempts++;
        return [500, { error: 'Internal Server Error' }];
      })
      .get(/.*/)
      .reply(200, validResponse);
    
    // Should retry and eventually succeed
    const result = await callTool('sheets_data', {...});
    expect(attempts).toBe(3);
    expect(result.success).toBe(true);
  });
});

// Test resource exhaustion
describe('Chaos: Resources', () => {
  test('handles memory pressure', async () => {
    // Allocate 90% of available memory
    // Verify server continues functioning
  });

  test('handles CPU saturation', async () => {
    // Spin up CPU-intensive tasks
    // Verify request processing continues
  });
});

// Test cascading failures
describe('Chaos: Cascading Failures', () => {
  test('handles Redis connection loss', async () => {
    // Kill Redis mid-request
    // Should fall back to in-memory
  });

  test('handles circuit breaker trip', async () => {
    // Trigger circuit breaker
    // Verify fast-fail behavior
  });
});
```

---

## 4. 🔐 SECURITY TESTING

### Penetration Testing

**Test vectors**:
```typescript
// 1. Authentication bypass attempts
test('rejects requests without credentials', async () => {
  const server = createServer({ 
    googleClient: null // No credentials 
  });
  await expect(callTool('sheets_data', {...}))
    .rejects.toThrow('Authentication required');
});

// 2. Authorization escalation
test('respects scope limitations', async () => {
  // Create client with read-only scope
  const limitedClient = createClientWithScope(['drive.readonly']);
  // Attempt write operation
  await expect(sheets_data.update({...}))
    .rejects.toThrow('Insufficient permissions');
});

// 3. Injection attacks
test('sanitizes SQL-like inputs in ranges', async () => {
  const maliciousRange = "A1'; DROP TABLE users; --";
  await expect(sheets_data.get({ range: maliciousRange }))
    .rejects.toThrow('Invalid range');
});

// 4. Path traversal
test('prevents path traversal in spreadsheet IDs', async () => {
  const maliciousId = "../../etc/passwd";
  await expect(sheets_data.get({ spreadsheetId: maliciousId }))
    .rejects.toThrow('Invalid spreadsheet ID');
});

// 5. DoS via resource exhaustion
test('limits concurrent task creation', async () => {
  // Attempt to create 10,000 tasks
  const tasks = Array(10000).fill(null).map(() => 
    createTask('sheets_analyze', {...})
  );
  
  // Should rate limit after threshold
  const results = await Promise.allSettled(tasks);
  const rejected = results.filter(r => r.status === 'rejected');
  expect(rejected.length).toBeGreaterThan(0);
});

// 6. Token leakage
test('does not log sensitive data', async () => {
  const logSpy = jest.spyOn(console, 'error');
  await sheets_auth.setup({ accessToken: 'secret123' });
  
  // Verify token not in logs
  const logs = logSpy.mock.calls.flat().join(' ');
  expect(logs).not.toContain('secret123');
});
```

### OAuth Flow Security

**Test suite**:
```bash
# Run OAuth security tests
npm run test:oauth-security

# Tests:
# - CSRF token validation
# - State parameter verification
# - PKCE code verifier
# - Token encryption at rest
# - Redirect URI allowlist
# - Token refresh race conditions
```

---

## 5. ⚡ PERFORMANCE TESTING

### Load Testing

**Artillery.io config**:
```yaml
# load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10  # 10 requests/sec
      name: "Warm up"
    - duration: 300
      arrivalRate: 50  # 50 requests/sec
      name: "Sustained load"
    - duration: 120
      arrivalRate: 100 # 100 requests/sec
      name: "Spike test"

scenarios:
  - name: "Read operations"
    flow:
      - post:
          url: "/mcp"
          json:
            method: "tools/call"
            params:
              name: "sheets_data"
              arguments:
                action: "get"
                spreadsheetId: "{{ spreadsheetId }}"
                range: "A1:Z100"
          
  - name: "Write operations"
    flow:
      - post:
          url: "/mcp"
          json:
            method: "tools/call"
            params:
              name: "sheets_data"
              arguments:
                action: "update"
                spreadsheetId: "{{ spreadsheetId }}"
                range: "A1"
                values: [["test"]]
```

**Run tests**:
```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run load-test.yml

# Expected results:
# - P95 latency < 500ms
# - P99 latency < 1000ms
# - Error rate < 0.1%
# - Memory stays stable
# - CPU usage reasonable
```

### Stress Testing

**Find breaking points**:
```typescript
// Gradually increase load until failure
async function stressTest() {
  let requestsPerSecond = 1;
  let failed = false;
  
  while (!failed && requestsPerSecond < 1000) {
    console.log(`Testing at ${requestsPerSecond} req/s`);
    
    const results = await runLoadTest({
      duration: 60,
      rps: requestsPerSecond
    });
    
    if (results.errorRate > 0.05 || results.p99 > 5000) {
      console.log(`Breaking point: ${requestsPerSecond} req/s`);
      failed = true;
    }
    
    requestsPerSecond *= 2;
  }
}
```

---

## 6. 🎭 REAL-WORLD SCENARIO TESTING

### Claude Desktop Integration

**Manual test scenarios**:
```markdown
## Scenario 1: New User Onboarding
1. Fresh Claude Desktop install
2. Add ServalSheets config
3. Restart Claude Desktop
4. Ask Claude: "What spreadsheet tools do you have?"
5. Verify: Lists all 21 tools
6. Ask Claude: "Show me my spreadsheets"
7. Verify: Authentication prompt or spreadsheet list

## Scenario 2: Complex Workflow
User: "Create a sales dashboard"
Expected flow:
1. Claude asks for spreadsheet ID or offers to create new
2. Creates spreadsheet with sheets_core
3. Adds sheets (Data, Dashboard)
4. Requests confirmation via sheets_confirm
5. User approves
6. Populates data via sheets_data
7. Creates charts via sheets_visualize
8. Formats cells via sheets_format
9. Shows preview

Verify at each step:
- [ ] Proper tool selection
- [ ] Confirmation dialogs appear
- [ ] Data correctly written
- [ ] Charts created successfully
- [ ] No errors in Claude Desktop console

## Scenario 3: Error Recovery
User: "Update cell A1 in spreadsheet invalid-id"
Expected flow:
1. Tool call with invalid ID
2. Error returned with helpful message
3. Claude explains error to user
4. Claude asks for correct spreadsheet ID
5. Retry succeeds

Verify:
- [ ] Error message is user-friendly
- [ ] Claude understands the error
- [ ] Recovery path is clear

## Scenario 4: Task Cancellation
User: "Analyze this huge dataset" → cancels mid-analysis
Expected flow:
1. sheets_analyze starts
2. User cancels operation
3. Task receives cancellation signal
4. Task stops gracefully
5. Resources cleaned up
6. Claude reports cancellation to user

Verify:
- [ ] Cancellation detected quickly (< 1s)
- [ ] No orphaned tasks
- [ ] Memory released
- [ ] Can start new operations immediately
```

### Documentation Testing

**Follow your own docs**:
```bash
# Test README.md instructions literally
# Start from scratch, no assumptions

# Step 1: Installation (as written)
npm install servalsheets

# Step 2: Claude Desktop config (exactly as documented)
cat > ~/Library/Application\ Support/Claude/claude_desktop_config.json << 'JSON'
{
  "mcpServers": {
    "servalsheets": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
JSON

# Step 3: Service account setup (follow docs)
# - Does it work?
# - Are there missing steps?
# - Unclear instructions?

# Step 4: First tool call (as in examples)
# Does the example code actually work?
```

---

## 7. 📊 QUOTA & RATE LIMIT TESTING

### Google API Quota Testing

**Test scenarios**:
```typescript
describe('API Quota Handling', () => {
  test('handles quota exceeded gracefully', async () => {
    // Mock quota exceeded response
    nock('https://sheets.googleapis.com')
      .get(/.*/)
      .reply(429, {
        error: {
          code: 429,
          message: 'Quota exceeded',
          status: 'RESOURCE_EXHAUSTED'
        }
      });
    
    const result = await sheets_data.get({...});
    
    // Should return helpful error
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('quota');
    expect(result.error.retryAfter).toBeDefined();
  });

  test('implements exponential backoff', async () => {
    const timestamps = [];
    
    // Mock 3 rate limit responses
    nock('https://sheets.googleapis.com')
      .get(/.*/)
      .times(3)
      .reply(function() {
        timestamps.push(Date.now());
        return [429, { error: 'Rate limit' }];
      })
      .get(/.*/)
      .reply(200, validResponse);
    
    await sheets_data.get({...});
    
    // Verify backoff intervals increase exponentially
    const intervals = timestamps.slice(1).map((t, i) => 
      t - timestamps[i]
    );
    expect(intervals[1]).toBeGreaterThan(intervals[0] * 1.5);
  });

  test('respects Retry-After header', async () => {
    const retryAfter = 5; // seconds
    
    nock('https://sheets.googleapis.com')
      .get(/.*/)
      .reply(429, { error: 'Rate limit' }, {
        'Retry-After': String(retryAfter)
      });
    
    const startTime = Date.now();
    await sheets_data.get({...});
    const elapsed = (Date.now() - startTime) / 1000;
    
    // Should wait at least retryAfter seconds
    expect(elapsed).toBeGreaterThanOrEqual(retryAfter);
  });
});
```

### Rate Limiter Stress Test

**Test internal rate limiter**:
```typescript
test('rate limiter handles burst traffic', async () => {
  const limiter = new RateLimiter({
    tokensPerInterval: 100,
    interval: 'second'
  });
  
  // Send 1000 requests instantly
  const requests = Array(1000).fill(null).map(() => 
    limiter.removeTokens(1)
  );
  
  const results = await Promise.allSettled(requests);
  
  // First 100 should succeed immediately
  // Rest should be throttled
  const immediate = results.slice(0, 100)
    .every(r => r.status === 'fulfilled');
  expect(immediate).toBe(true);
  
  // Eventually all should succeed
  const allSucceeded = results
    .every(r => r.status === 'fulfilled');
  expect(allSucceeded).toBe(true);
});
```

---

## 8. 🧩 INTEGRATION TESTING MATRIX

### Cross-Version Compatibility

**Test with different Claude versions**:
```bash
# Test matrix
CLAUDE_VERSIONS=(
  "desktop-0.7.0"
  "desktop-0.7.1"
  "desktop-0.7.2"
  "desktop-latest"
)

for version in "${CLAUDE_VERSIONS[@]}"; do
  echo "Testing with Claude $version"
  # Run integration tests
  npm run test:integration:claude-$version
done
```

### MCP SDK Version Compatibility

**Test with multiple SDK versions**:
```json
// package.json variants
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.24.0" // Min supported
  }
}
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.1" // Current
  }
}
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0" // Future (if available)
  }
}
```

### Google API Version Compatibility

**Test with different googleapis versions**:
```bash
# Test with older version
npm install googleapis@168.0.0
npm test

# Test with current
npm install googleapis@169.0.0
npm test

# Test with beta (if available)
npm install googleapis@next
npm test
```

---

## 9. 🔬 OBSERVABILITY VALIDATION

### Structured Logging Test

**Verify log structure**:
```typescript
test('logs are properly structured', () => {
  const logCapture = captureStderr();
  
  // Trigger various operations
  callTool('sheets_data', {...});
  
  const logs = logCapture.getLogs();
  
  // Every log should be valid JSON
  logs.forEach(log => {
    const parsed = JSON.parse(log);
    
    // Required fields
    expect(parsed).toHaveProperty('level');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('message');
    
    // Context fields
    expect(parsed).toHaveProperty('service', 'servalsheets');
    expect(parsed).toHaveProperty('version', '1.3.0');
    
    // Request tracing
    if (parsed.requestId) {
      expect(parsed.requestId).toMatch(/^[a-f0-9-]{36}$/);
    }
  });
});
```

### Metrics Validation

**Test Prometheus metrics**:
```typescript
test('exposes Prometheus metrics', async () => {
  const response = await fetch('http://localhost:3000/metrics');
  const metrics = await response.text();
  
  // Required metrics
  expect(metrics).toContain('servalsheets_requests_total');
  expect(metrics).toContain('servalsheets_request_duration_seconds');
  expect(metrics).toContain('servalsheets_errors_total');
  expect(metrics).toContain('servalsheets_active_tasks');
  
  // Parse and validate
  const parsed = parsePrometheusMetrics(metrics);
  expect(parsed.servalsheets_requests_total).toBeGreaterThan(0);
});
```

---

## 10. 🎯 PRODUCTION SIMULATION

### 24-Hour Soak Test

**Long-running stability test**:
```bash
#!/bin/bash
# Run for 24 hours
# - Constant load (10 req/s)
# - Random operations
# - Monitor for memory leaks
# - Monitor for connection leaks
# - Monitor for file descriptor leaks

echo "Starting 24-hour soak test..."
START_TIME=$(date +%s)

while true; do
  ELAPSED=$(($(date +%s) - START_TIME))
  
  if [ $ELAPSED -gt 86400 ]; then
    echo "24 hours complete!"
    break
  fi
  
  # Make random request
  curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -d '{"method":"tools/list"}' \
    > /dev/null 2>&1
  
  sleep 0.1  # 10 req/s
  
  # Check health every hour
  if [ $((ELAPSED % 3600)) -eq 0 ]; then
    echo "Hour $((ELAPSED / 3600)): Checking health..."
    
    # Memory usage
    MEM=$(ps aux | grep node | awk '{print $6}' | head -1)
    echo "  Memory: $MEM KB"
    
    # Open files
    FILES=$(lsof -p $(pgrep -f servalsheets) | wc -l)
    echo "  Open files: $FILES"
    
    # Response time
    TIME=$(curl -w "%{time_total}" -X POST http://localhost:3000/mcp \
      -H "Content-Type: application/json" \
      -d '{"method":"tools/list"}' \
      -o /dev/null -s)
    echo "  Response time: ${TIME}s"
  fi
done
```

### Graceful Shutdown Test

**Test cleanup**:
```typescript
test('gracefully shuts down', async () => {
  const server = await createServer({...});
  
  // Start some operations
  const task1 = callTool('sheets_analyze', {...});
  const task2 = callTool('sheets_data', {...});
  
  // Send SIGTERM
  process.kill(server.pid, 'SIGTERM');
  
  // Should:
  // 1. Stop accepting new requests
  // 2. Complete in-flight requests
  // 3. Cancel long-running tasks
  // 4. Close connections
  // 5. Exit within timeout
  
  await expect(waitForExit(server, 30000))
    .resolves.toBe(0);
});
```

---

## 11. 🧪 CHAOS TESTING SCHEDULE

### Weekly Chaos Tests

**Automated chaos schedule**:
```bash
# Monday: Network chaos
npm run chaos:network

# Tuesday: Resource chaos
npm run chaos:resources

# Wednesday: Dependency chaos (Redis, etc.)
npm run chaos:dependencies

# Thursday: Load chaos
npm run chaos:load

# Friday: Security chaos
npm run chaos:security
```

---

## 12. 📋 TESTING CHECKLIST

### Pre-Release Testing

**Complete this checklist**:

- [ ] Unit tests: 99%+ passing
- [ ] Integration tests: All passing
- [ ] Contract tests: Schema validation passing
- [ ] Property tests: Edge cases covered
- [ ] Load tests: P99 < 1s under normal load
- [ ] Stress tests: Breaking point documented
- [ ] Chaos tests: All fault scenarios handled
- [ ] Security tests: No vulnerabilities
- [ ] Real-world scenarios: 10+ tested manually
- [ ] Documentation: Followed step-by-step
- [ ] Claude Desktop: Works in production
- [ ] OAuth flow: All paths tested
- [ ] Task cancellation: Tested under various conditions
- [ ] Observability: Logs/metrics/traces working
- [ ] 24-hour soak: Memory stable
- [ ] Graceful shutdown: Clean exit

### Continuous Testing

**Run these regularly**:
```bash
# Daily
npm run test:smoke           # Quick sanity check
npm run test:integration     # Full integration suite

# Weekly  
npm run test:chaos          # Chaos engineering
npm run test:load           # Performance testing
npm run test:security       # Security scan

# Monthly
npm run test:compatibility  # Version matrix
npm run test:soak          # 24-hour stability
```

---

## 13. 🚀 ADVANCED TRACING SETUP

### Full Stack Trace

**Enable maximum verbosity**:
```bash
# Environment setup for deep tracing
export LOG_LEVEL=silly
export DEBUG=*
export NODE_OPTIONS="--trace-warnings --trace-deprecation"
export TRACE_REQUESTS=true
export TRACE_API_CALLS=true
export TRACE_TASKS=true
export OTEL_TRACES_EXPORTER=console

# Run with tracing
npm run start:stdio 2>&1 | tee trace.log
```

**Analyze trace**:
```bash
# Extract timing data
grep "duration" trace.log | \
  awk '{sum+=$NF; count++} END {print "Avg:", sum/count "ms"}'

# Find slow operations
grep "duration" trace.log | \
  awk '$NF > 1000' | \
  sort -k2 -n

# Identify bottlenecks
grep "Google API" trace.log | wc -l  # Count API calls
```

---

## CONCLUSION

This advanced testing strategy ensures ServalSheets is:
- ✅ Production-ready under all conditions
- ✅ Resilient to failures
- ✅ Secure against attacks
- ✅ Performant under load
- ✅ Observable in production
- ✅ Compatible across versions
- ✅ User-friendly in real scenarios

**Next Steps**:
1. Implement priority tests (security, chaos, real-world)
2. Automate testing pipeline
3. Schedule regular chaos tests
4. Set up monitoring/alerting
5. Document findings and iterate
