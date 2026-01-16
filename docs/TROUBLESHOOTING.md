# Troubleshooting Guide

Common issues, solutions, and debugging tips for ServalSheets.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Google API Errors](#google-api-errors)
- [Performance Issues](#performance-issues)
- [Connection Issues](#connection-issues)
- [Data Issues](#data-issues)
- [MCP Protocol Issues](#mcp-protocol-issues)
- [Production Issues](#production-issues)

---

## Authentication Issues

### "Invalid credentials" or "Authentication failed"

**Symptom:** Authentication fails when starting server or making requests

**Causes & Solutions:**

1. **Service Account Key Issues**
   ```bash
   # Verify file exists and is readable
   ls -la ~/.config/google/servalsheets-prod.json
   # Should show: -rw------- (600 permissions)

   # Check file format
   cat ~/.config/google/servalsheets-prod.json | jq .
   # Should have: type, project_id, private_key_id, private_key, client_email
   ```

   **Fix:**
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to valid JSON file
   - Verify file permissions: `chmod 600 <keyfile.json>`
   - Re-download key from Google Cloud Console if corrupted

2. **OAuth Token Expired**
   ```bash
   # Delete cached tokens
   rm -rf ~/.config/servalsheets/tokens.enc

   # Re-authenticate
   npm start
   # Follow OAuth flow
   ```

3. **Wrong Google Cloud Project**
   ```bash
   # Check which project the service account belongs to
   cat service-account.json | jq .project_id

   # Verify Sheets API is enabled for that project
   # Google Cloud Console → APIs & Services → Enabled APIs
   ```

**Prevention:**
- Use separate service accounts per environment (dev/staging/prod)
- Rotate keys annually
- Store keys in secrets manager, not in code repository

---

## Google API Errors

### "Sheet not found" (404)

**Symptom:** `SHEET_NOT_FOUND` error when accessing spreadsheet

**Causes & Solutions:**

1. **Spreadsheet not shared with service account**
   ```bash
   # In Google Sheets, click Share
   # Add: your-service-account@project-id.iam.gserviceaccount.com
   # Role: Viewer or Editor
   ```

2. **Invalid spreadsheet ID**
   ```javascript
   // Correct format:
   spreadsheetId: "1ABC-123xyz_..." // From spreadsheet URL

   // Common mistakes:
   spreadsheetId: "https://docs.google.com/..." // ❌ Don't use full URL
   spreadsheetId: "My Spreadsheet" // ❌ Don't use title
   ```

3. **Sheet name doesn't exist**
   ```javascript
   // List available sheets first
   await sheets_core({ action: 'get', spreadsheetId: '...' });
   // Check response.sheets array for valid sheet names
   ```

**Prevention:**
- Always use sheets_core.get first to verify spreadsheet exists
- Store spreadsheet IDs in environment variables, not hardcoded
- Use sheets_session to track active spreadsheet

---

### "Quota exceeded" (429)

**Symptom:** `RATE_LIMIT_EXCEEDED` or `RESOURCE_EXHAUSTED` errors

**Causes & Solutions:**

1. **Too many individual API calls**
   ```javascript
   // ❌ Bad: Multiple individual calls
   for (const range of ranges) {
     await sheets_data({ action: 'read', range });
   }

   // ✅ Good: Single batch call
   await sheets_data({
     action: 'batch_read',
     ranges: ranges
   });
   // Saves 80-99% quota!
   ```

2. **Missing batching/transactions**
   ```javascript
   // ❌ Bad: 100 individual writes
   for (const cell of cells) {
     await sheets_data({ action: 'write', ... });
   }

   // ✅ Good: Single transaction
   await sheets_transaction({ action: 'begin' });
   for (const cell of cells) {
     await sheets_transaction({ action: 'queue', operation: ... });
   }
   await sheets_transaction({ action: 'commit' });
   // 100 calls → 2 calls (98% reduction)
   ```

3. **Need higher quota**
   ```bash
   # Check current quota usage
   # Google Cloud Console → APIs & Services → Quotas

   # Request quota increase if needed
   # Google Cloud Console → APIs & Services → Quotas → Request increase
   ```

**Prevention:**
- Always use batch operations for multiple ranges
- Use transactions for related writes
- Read optimization guide: `servalsheets://guides/quota-optimization`
- Monitor quota usage via Google Cloud Console

---

### "Transaction timeout" (DEADLINE_EXCEEDED)

**Symptom:** Transaction fails with timeout after 30 seconds

**Causes & Solutions:**

1. **Too many operations in single transaction**
   ```javascript
   // ❌ Bad: 500 operations in one transaction
   for (let i = 0; i < 500; i++) {
     await sheets_transaction({ action: 'queue', operation: ... });
   }

   // ✅ Good: Batch into smaller transactions
   const BATCH_SIZE = 50;
   for (let i = 0; i < operations.length; i += BATCH_SIZE) {
     await sheets_transaction({ action: 'begin' });
     for (let j = 0; j < BATCH_SIZE && i + j < operations.length; j++) {
       await sheets_transaction({ action: 'queue', operation: operations[i + j] });
     }
     await sheets_transaction({ action: 'commit' });
   }
   ```

**Prevention:**
- Keep transactions under 50 operations
- Break large updates into multiple transactions
- Use composite operations for common patterns

---

## Performance Issues

### "Server taking too long to respond"

**Symptom:** Requests timeout or take >10 seconds

**Causes & Solutions:**

1. **Not using caching**
   ```javascript
   // Check cache configuration
   const config = {
     CACHE_TTL_MS: 300000, // 5 minutes
     PREFETCH_ENABLED: true,
   };

   // Verify cache is working
   // Should see "Cache hit" in logs after first request
   ```

2. **Missing prefetching**
   ```javascript
   // Enable prefetching for frequently accessed ranges
   await sheets_data({
     action: 'read',
     range: 'A1:Z1000',
     prefetch: true  // Enables background prefetch
   });
   ```

3. **Large data transfers**
   ```javascript
   // ❌ Bad: Reading 100K cells at once
   await sheets_data({ action: 'read', range: 'A1:Z100000' });

   // ✅ Good: Use pagination or specific ranges
   await sheets_data({ action: 'read', range: 'A1:Z1000' });
   ```

**Prevention:**
- Use batch operations to reduce round trips
- Enable request deduplication (default: enabled)
- Use connection pooling (configured automatically)
- Monitor metrics: `/metrics` endpoint

---

### "High memory usage"

**Symptom:** Server using >500MB RAM

**Causes & Solutions:**

1. **Too many cached results**
   ```bash
   # Check cache sizes
   # LRU caches have automatic eviction, but check configuration

   # Reduce cache sizes if needed
   export CACHE_MAX_SIZE=500  # Default: 1000
   ```

2. **Memory leak in long-running process**
   ```bash
   # Restart server periodically (every 24h recommended)
   # Use PM2 or systemd for automatic restarts

   # Monitor with:
   npm run metrics
   ```

**Prevention:**
- Use Redis for distributed caching in production
- Set `NODE_ENV=production` to reduce debug overhead
- Monitor memory with Prometheus/Grafana

---

## Connection Issues

### "ECONNREFUSED" or "ENOTFOUND"

**Symptom:** Cannot connect to Redis or external services

**Causes & Solutions:**

1. **Redis not running**
   ```bash
   # Check Redis status
   redis-cli ping
   # Should return: PONG

   # Start Redis if not running
   redis-server
   ```

2. **Wrong Redis URL**
   ```bash
   # Verify Redis URL
   echo $REDIS_URL
   # Should be: redis://localhost:6379 or redis://<host>:<port>

   # Test connection
   redis-cli -u $REDIS_URL ping
   ```

3. **Production mode requires Redis**
   ```bash
   # Error: Redis is required in production mode

   # Solution 1: Provide Redis URL
   export REDIS_URL=redis://localhost:6379

   # Solution 2: Use development mode
   export NODE_ENV=development
   ```

**Prevention:**
- Always use Redis in production (`NODE_ENV=production`)
- Use health checks to monitor Redis connectivity
- Configure Redis persistence (RDB or AOF)

---

## Data Issues

### "Cannot read range" or "Invalid range"

**Symptom:** Range resolution fails

**Causes & Solutions:**

1. **Invalid A1 notation**
   ```javascript
   // ❌ Wrong formats:
   range: "1:10" // Missing column
   range: "A-Z" // Wrong syntax
   range: "Sheet 1!A1" // Space in name (must be quoted)

   // ✅ Correct formats:
   range: "A1:Z10"
   range: "'Sheet 1'!A1:Z10" // Quoted sheet name with space
   range: "Sheet1" // Entire sheet
   ```

2. **Semantic range not found**
   ```javascript
   // Semantic range requires matching header
   {
     semantic: { column: "Revenue" } // Must match column header exactly
   }

   // Debug: Check available headers first
   await sheets_data({ action: 'read', range: 'A1:Z1' });
   ```

**Prevention:**
- Use sheets_data.get to verify range exists
- Use semantic ranges for flexible column references
- Handle RangeResolutionError gracefully

---

### "Formula not calculating"

**Symptom:** Formula shows as text or #ERROR

**Causes & Solutions:**

1. **Wrong value input option**
   ```javascript
   // ❌ Wrong: Treats formula as literal text
   await sheets_data({
     action: 'write',
     values: [['=SUM(A1:A10)']],
     valueInputOption: 'RAW'  // ❌ Wrong
   });

   // ✅ Correct: Interprets as formula
   await sheets_data({
     action: 'write',
     values: [['=SUM(A1:A10)']],
     valueInputOption: 'USER_ENTERED'  // ✅ Correct (default)
   });
   ```

**Prevention:**
- Always use `USER_ENTERED` for formulas (default)
- Use `RAW` only for literal text values
- Validate formulas with sheets_advanced.formula_validate

---

## MCP Protocol Issues

### "Sampling not working"

**Symptom:** sheets_analyze doesn't provide insights

**Causes & Solutions:**

1. **Client doesn't support sampling**
   ```
   Error: SAMPLING_UNAVAILABLE

   # Check client capabilities:
   # MCP client must support sampling SEP-1577
   ```

2. **Fallback to deterministic analysis**
   ```javascript
   // Server automatically falls back to rule-based analysis
   // No action needed - check logs for "Sampling fallback" message
   ```

**Prevention:**
- Use latest MCP client (Claude Desktop 1.0+)
- Check server capabilities with tools/list

---

### "Confirmation rejected by user"

**Symptom:** `USER_REJECTED` error from sheets_confirm

**Causes & Solutions:**

1. **User declined operation**
   ```javascript
   try {
     const result = await sheets_confirm({
       action: 'request',
       operation: 'delete_rows',
       impact: { rowsAffected: 100 }
     });
   } catch (error) {
     if (error.code === 'USER_REJECTED') {
       console.log('User cancelled operation');
       // Don't proceed with deletion
       return;
     }
   }
   ```

**Prevention:**
- Always check confirmation result before proceeding
- Handle USER_REJECTED gracefully
- Provide clear impact descriptions in confirmation requests

---

## Production Issues

### "High CPU usage"

**Symptom:** Server CPU >80%

**Causes & Solutions:**

1. **Too many concurrent requests**
   ```bash
   # Check rate limiting configuration
   export RATE_LIMIT_MAX=100  # Requests per minute

   # Scale horizontally
   # Deploy multiple instances behind load balancer
   # All instances must use Redis for shared state
   ```

2. **Complex computations**
   ```javascript
   // Offload heavy computations to client
   // Use batch operations to reduce processing overhead
   ```

**Prevention:**
- Enable rate limiting (default: 100 req/min)
- Use Redis for distributed caching
- Monitor with Prometheus/Grafana
- Set up horizontal scaling with load balancer

---

### "Circuit breaker open"

**Symptom:** `CIRCUIT_BREAKER_OPEN` error

**Causes & Solutions:**

1. **Too many failures**
   ```bash
   # Circuit breaker opens after 5 consecutive failures
   # Waits 30 seconds before trying again

   # Check metrics
   curl http://localhost:3000/metrics/circuit-breakers
   ```

2. **Google API issues**
   ```bash
   # Check Google API status
   # https://status.cloud.google.com/

   # Wait for circuit breaker to reset (30s)
   # Or restart server to force reset
   ```

**Prevention:**
- Monitor circuit breaker metrics
- Set up alerts for circuit breaker opens
- Implement fallback strategies
- Check Google API quotas

---

## Debugging Tips

### Enable Debug Logging

```bash
export LOG_LEVEL=debug
npm start
```

Debug logs show:
- Cache hits/misses
- API call details
- Request deduplication
- Circuit breaker state changes

### Check Server Health

```bash
# Liveness (is server running?)
curl http://localhost:3000/health/live

# Readiness (is server ready?)
curl http://localhost:3000/health/ready

# Startup (is server fully initialized?)
curl http://localhost:3000/health/startup
```

### View Metrics

```bash
# Prometheus metrics
curl http://localhost:3000/metrics

# Circuit breaker status
curl http://localhost:3000/metrics/circuit-breakers
```

### Test Mode

```bash
# Run in test mode (no external API calls)
export NODE_ENV=test
npm start
```

---

## Getting Help

### Before Creating an Issue

1. **Check this troubleshooting guide**
2. **Search existing issues**: https://github.com/khill1269/servalsheets/issues
3. **Enable debug logging** and capture relevant logs
4. **Check Google API status**: https://status.cloud.google.com/

### Creating an Issue

Include:
- ServalSheets version (`npm list servalsheets`)
- Node version (`node --version`)
- Operating system
- Full error message and stack trace
- Steps to reproduce
- Relevant configuration (redact secrets!)

### Community Support

- GitHub Issues: https://github.com/khill1269/servalsheets/issues
- Documentation: https://github.com/khill1269/servalsheets/tree/main/docs

---

## See Also

- [Security Guide](../SECURITY.md) - Security best practices
- [Quota Optimization](guides/quota-optimization.md) - How to minimize API usage
- [Error Recovery](guides/error-recovery.md) - Automatic error recovery patterns
- [Deployment Guide](deployment/README.md) - Production deployment checklist
