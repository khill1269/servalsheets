# P1 Action Plan - ServalSheets

**Generated:** 2026-01-10
**Status:** Ready for Implementation
**Total P1 Issues:** 12
**Estimated Total Effort:** ~40-50 hours
**Quick Wins Effort:** ~15-20 hours

---

## Executive Summary

Based on the comprehensive validation (overall grade: **A / 92/100**), the following P1 improvements are recommended to elevate the project from **A → A+** and enhance production operations.

**Deployment Status:** ✅ **APPROVED** - All P1 issues are non-blocking for production deployment.

---

## Phase 1: Quick Wins (6-10 hours) - This Week

High-value, low-effort improvements to implement first.

### ✅ P1-3: Externalize Rate Limit Configuration
**Priority:** HIGHEST
**Effort:** 1 hour
**Impact:** HIGH (enables enterprise users to utilize higher quotas)
**Risk:** VERY LOW

**Implementation:**
```typescript
// File: src/core/rate-limiter.ts:15-25

// Current (hardcoded):
private static readonly DEFAULT_READ_CAPACITY = 300;
private static readonly DEFAULT_WRITE_CAPACITY = 60;

// Change to:
constructor() {
  this.readCapacity = parseInt(
    process.env["SHEETS_READ_QUOTA_PER_MIN"] || "300",
    10
  );
  this.writeCapacity = parseInt(
    process.env["SHEETS_WRITE_QUOTA_PER_MIN"] || "60",
    10
  );
}
```

**Documentation Update (README.md):**
```markdown
### Rate Limit Configuration

Configure Google Sheets API rate limits based on your Workspace edition:

| Edition | Read Quota | Write Quota | Environment Variables |
|---------|------------|-------------|----------------------|
| Free | 300/min | 60/min | (default) |
| Business | 600/min | 120/min | `SHEETS_READ_QUOTA_PER_MIN=600 SHEETS_WRITE_QUOTA_PER_MIN=120` |
| Enterprise | 1200/min | 240/min | `SHEETS_READ_QUOTA_PER_MIN=1200 SHEETS_WRITE_QUOTA_PER_MIN=240` |
```

**Testing:**
- Test with different quota values
- Verify default values (300/60)
- Verify rejection of invalid values (> 2000 reads, > 300 writes)

---

### ✅ P1-9: Add HTTP/2 Connection Pool Monitoring
**Priority:** HIGH
**Effort:** 1 hour
**Impact:** MEDIUM (improves observability)
**Risk:** VERY LOW

**Implementation:**
```typescript
// File: src/services/google-api.ts

export class GoogleAPIClient {
  private httpAgent: HttpsAgent;

  constructor() {
    this.httpAgent = new HttpsAgent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
    });

    // Monitor every 5 minutes
    if (process.env["ENABLE_POOL_MONITORING"] === "true") {
      setInterval(() => this.logConnectionPoolStats(), 5 * 60 * 1000);
    }
  }

  private logConnectionPoolStats(): void {
    const stats = {
      total_sockets: Object.keys(this.httpAgent.sockets).length,
      free_sockets: Object.keys(this.httpAgent.freeSockets).length,
      pending_requests: Object.keys(this.httpAgent.requests).length,
    };

    logger.info(stats, "HTTP/2 connection pool statistics");

    if (stats.total_sockets >= 50) {
      logger.warn("Connection pool at max capacity");
    }
  }
}
```

---

### ✅ P1-5: Define Token/Session Retention Policy
**Priority:** HIGH
**Effort:** 2 hours
**Impact:** MEDIUM (compliance requirement)
**Risk:** LOW

**Implementation:**

**File: src/storage/session-store.ts**
```typescript
export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionData>();
  private readonly MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    // Cleanup every hour
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.sessions.entries()) {
      if (now - data.createdAt > this.MAX_SESSION_AGE_MS) {
        this.sessions.delete(sessionId);
        logger.info({ sessionId }, "Expired session cleaned up");
      }
    }
  }
}
```

**File: src/services/token-store.ts**
```typescript
export class EncryptedTokenStore {
  private readonly TOKEN_RETENTION_DAYS =
    parseInt(process.env["TOKEN_RETENTION_DAYS"] || "30", 10);

  async cleanupExpiredTokens(): Promise<void> {
    // Implement based on storage backend
  }
}
```

**Documentation (SECURITY.md):**
```markdown
## Data Retention

### Session Data
- **Retention Period:** 7 days after last activity
- **Automatic Cleanup:** Hourly
- **Storage:** In-memory (lost on restart)

### Token Data
- **Retention Period:** 30 days (configurable via `TOKEN_RETENTION_DAYS`)
- **Automatic Cleanup:** Daily at midnight UTC
- **Storage:** Encrypted at rest with AES-256-GCM
```

---

### ✅ P1-12: Create CONTRIBUTING.md
**Priority:** MEDIUM
**Effort:** 2 hours
**Impact:** MEDIUM (helps external contributors)
**Risk:** VERY LOW

**Create:** CONTRIBUTING.md

Content should include:
- Code of Conduct
- Development setup
- Coding standards (TypeScript, ESLint, Prettier)
- Testing requirements (coverage, patterns)
- Commit message format (Conventional Commits)
- Pull request process
- Documentation standards (TSDoc)

**Template provided in validation report** - see VALIDATION_REPORT_2026-01-10_FINAL.md P1-12 section.

---

### ✅ P1-7: Add Memory Leak Detection
**Priority:** MEDIUM
**Effort:** 2 hours
**Impact:** MEDIUM (prevents production issues)
**Risk:** LOW

**Implementation:**
```typescript
// File: src/server.ts

import v8 from "node:v8";

if (process.env["ENABLE_HEAP_MONITORING"] === "true") {
  setInterval(() => {
    const heapStats = v8.getHeapStatistics();
    const heapUsedMB = heapStats.used_heap_size / 1024 / 1024;
    const heapTotalMB = heapStats.total_heap_size / 1024 / 1024;

    logger.info({
      heap_used_mb: heapUsedMB.toFixed(2),
      heap_total_mb: heapTotalMB.toFixed(2),
      heap_usage_percent: ((heapUsedMB / heapTotalMB) * 100).toFixed(2),
    }, "Heap statistics");

    // Alert if > 80% usage
    if (heapUsedMB / heapTotalMB > 0.8) {
      logger.warn("High heap usage detected - potential memory leak");
    }
  }, 30 * 60 * 1000); // 30 minutes
}
```

**Alerting thresholds:**
- Warning: Heap > 70% for 15 minutes
- Critical: Heap > 85% for 5 minutes

---

### ✅ P1-8: Expose Performance Metrics
**Priority:** MEDIUM
**Effort:** 2 hours
**Impact:** MEDIUM (improves observability)
**Risk:** VERY LOW

**Implementation:**

**Create: src/services/metrics-exporter.ts**
```typescript
export class MetricsExporter {
  exportPrometheus(): string {
    const lines: string[] = [];

    // Cache metrics
    lines.push(`# HELP cache_hit_rate Cache hit rate by type`);
    lines.push(`# TYPE cache_hit_rate gauge`);
    for (const [type, stats] of Object.entries(cacheStats)) {
      const hitRate = stats.hits / (stats.hits + stats.misses);
      lines.push(`cache_hit_rate{type="${type}"} ${hitRate.toFixed(4)}`);
    }

    // Batch window metrics
    lines.push(`# HELP batch_window_ms Current adaptive batch window`);
    lines.push(`# TYPE batch_window_ms gauge`);
    lines.push(`batch_window_ms ${batchStats.currentWindowMs}`);

    return lines.join("\n");
  }
}
```

**Create: src/server/metrics.ts**
```typescript
export function startMetricsServer(port: number, exporter: MetricsExporter) {
  const server = createServer((req, res) => {
    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(exporter.exportPrometheus());
    }
  });

  server.listen(port);
}
```

**Environment Variable:**
- `ENABLE_METRICS_SERVER=true`
- `METRICS_PORT=9090` (default)

**Access:** http://localhost:9090/metrics (Prometheus-compatible)

---

## Phase 2: Medium Effort (10-15 hours) - Next 2 Weeks

### ✅ P1-6: Create Threat Model Documentation
**Priority:** MEDIUM
**Effort:** 3-4 hours
**Impact:** MEDIUM (security best practice)
**Risk:** VERY LOW

**Create:** docs/THREAT_MODEL.md

**Content (STRIDE methodology):**
- Trust boundaries diagram
- Spoofing threats (OAuth, token theft)
- Tampering threats (malicious edits, batch injection)
- Repudiation (audit trail gaps)
- Information disclosure (token exposure, field masking)
- Denial of service (quota exhaustion, large responses)
- Elevation of privilege (scope escalation, redirect manipulation)
- OWASP Top 10:2021 compliance mapping
- Residual risks assessment

**Full template provided in validation report** - see P1-6 section.

---

### ✅ P1-4: Add Security Alerting
**Priority:** HIGH
**Effort:** 4 hours
**Impact:** HIGH (production security monitoring)
**Risk:** LOW

**Option 1: Sentry (Recommended)**
```bash
npm install @sentry/node
```

```typescript
// src/server.ts
import * as Sentry from "@sentry/node";

if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    environment: process.env["NODE_ENV"] || "development",
    beforeSend(event, hint) {
      // Filter sensitive data
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
      }
      return event;
    },
  });
}
```

**Events to monitor:**
- Authentication failures (> 10 per 5 minutes)
- Token decryption failures (any occurrence)
- Invalid redirect URIs (any occurrence)
- Scope validation failures (any occurrence)
- Rate limit violations (> 50 per hour)

**Option 2: CloudWatch Alarms (AWS users)**
- Log security events in structured format
- Create CloudWatch metric filters
- Configure alarms with SNS notifications

---

### ✅ P1-2: Complete Field Masking
**Priority:** HIGH
**Effort:** 4-6 hours
**Impact:** HIGH (reduces quota usage)
**Risk:** LOW

**Affected Files (15-20 call sites):**
1. src/handlers/sharing.ts (3 sites)
2. src/handlers/sheet.ts (4 sites)
3. src/handlers/versions.ts (2 sites)
4. src/handlers/charts.ts (2 sites)
5. src/handlers/history.ts (3 sites)
6. src/handlers/format.ts (1 site)
7. src/services/sheet-resolver.ts (3-5 sites)

**Example fixes:**

```typescript
// src/handlers/sharing.ts:95
// Before:
await sheets.spreadsheets.get({ spreadsheetId });

// After:
await sheets.spreadsheets.get({
  spreadsheetId,
  fields: "properties(title),spreadsheetUrl",
});
```

```typescript
// src/handlers/sheet.ts:180
// Before:
await sheets.spreadsheets.getDeveloperMetadata({
  spreadsheetId,
  metadataId,
});

// After:
await sheets.spreadsheets.getDeveloperMetadata({
  spreadsheetId,
  metadataId,
  fields: "metadataId,metadataKey,metadataValue,location",
});
```

**Testing:**
- Run integration tests to verify correct data returned
- Measure payload size reduction
- Verify no functionality breaks

**Verification:**
```bash
# Run audit script (if exists)
npm run audit:field-masks

# Or manually search for missing fields
grep -r "spreadsheets\.get\|values\.get\|revisions\.get" src/ | \
  grep -v "fields:"
```

---

### ✅ P1-11: Add TSDoc Comments
**Priority:** MEDIUM
**Effort:** 6-8 hours
**Impact:** MEDIUM (improves developer experience)
**Risk:** VERY LOW

**Priority order:**
1. **Handlers** (highest user-facing impact) - 4 hours
2. **Services** (internal APIs) - 2-3 hours
3. **Utilities** (helper functions) - 1-2 hours

**Required TSDoc tags:**
- `@param` - Parameter descriptions
- `@returns` - Return value description
- `@throws` - Possible error types
- `@example` - Usage examples
- `@see` - Related documentation links

**Example:**
```typescript
/**
 * Handler for Google Sheets values operations.
 *
 * Supports reading, writing, updating, and clearing cell values with:
 * - Automatic batching for multiple operations
 * - Field masking to minimize data transfer
 * - ValueInputOption support (USER_ENTERED, RAW)
 * - Range validation and normalization
 *
 * @example
 * ```typescript
 * const handler = new ValuesHandler(apiClient, batchCompiler);
 * const result = await handler.handle({
 *   action: "get_values",
 *   spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
 *   range: "Sheet1!A1:B10",
 * });
 * ```
 *
 * @see {@link https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values}
 */
export class ValuesHandler extends BaseHandler {
  /**
   * Handle a values operation.
   *
   * @param params - Values operation parameters
   * @returns Promise resolving to operation result
   * @throws {ValidationError} If parameters are invalid
   * @throws {QuotaExceededError} If Google API quota exceeded
   * @throws {NotFoundError} If spreadsheet or range not found
   */
  async handle(params: ValuesActionParams): Promise<unknown> {
    // ...
  }
}
```

**Enable TSDoc linting:**
```bash
npm install -D eslint-plugin-tsdoc
```

```javascript
// eslint.config.js
import tsdoc from "eslint-plugin-tsdoc";

export default [
  {
    plugins: { tsdoc },
    rules: {
      "tsdoc/syntax": "warn",
    },
  },
];
```

**Generate API docs (optional):**
```bash
npm install -D typedoc
```

```json
// package.json
{
  "scripts": {
    "docs:api": "typedoc --out docs/api src/index.ts"
  }
}
```

---

## Phase 3: Long-Term (1-3 Months)

### ✅ P1-10: Increase Test Coverage (53% → 75%)
**Priority:** MEDIUM
**Effort:** 20-30 hours (phased approach)
**Impact:** HIGH (improves maintainability)
**Risk:** LOW

**Current Coverage:**
- Statements: 53.12% (target: 75%)
- Branches: 42.8% (target: 70%)
- Functions: 58.3% (target: 75%)
- Lines: 53.45% (target: 75%)

**Phased Approach:**

**Phase 3a: High-Impact Coverage (10 hours)**
1. Handler error paths (4 hours)
   - Invalid input validation
   - Quota exceeded scenarios
   - Network failures
2. Service edge cases (3 hours)
   - Cache eviction
   - Batch window adjustments
   - Circuit breaker transitions
3. Security path coverage (3 hours)
   - OAuth error scenarios
   - Token decryption failures
   - Scope validation edge cases

**Phase 3b: Complete Coverage (10-20 hours)**
1. Property-based tests (5 hours)
   - Data transformation tests
   - Batch compilation with random inputs
   - Cache behavior under load
2. Integration tests (5 hours)
   - End-to-end workflows
   - Multi-step operations
   - Error recovery paths
3. Performance tests (5 hours)
   - Benchmarks for critical paths
   - Memory usage over time
   - Concurrent request handling

**Implementation Strategy:**
1. Set coverage floor at 60% in CI (current + 7%)
2. Add coverage check: `npm run test:coverage --min-coverage=60`
3. Gradually increase floor by 5% every 2 weeks
4. Focus on critical paths first (Phase 3a)
5. Document coverage strategy in CONTRIBUTING.md

---

### ⏳ P1-1: MCP SDK Limitations (Not Actionable Yet)
**Priority:** LOW (awaiting SDK updates)
**Effort:** N/A
**Impact:** LOW
**Risk:** N/A

**Issues:**
1. Task cancellation (SEP-1686) - SDK doesn't expose request IDs
2. Tool icons (SEP-973) - Zod-to-JSON-Schema doesn't preserve metadata

**Action:**
- Monitor MCP SDK releases
- Watch GitHub issues for SEP implementation
- Implement when SDK support available

**References:**
- https://github.com/modelcontextprotocol/typescript-sdk/issues
- SEP-1686: https://github.com/modelcontextprotocol/specification/pull/1686
- SEP-973: https://github.com/modelcontextprotocol/specification/pull/973

---

## Implementation Checklist

### Week 1 (6-10 hours)
- [ ] P1-3: Externalize rate limit config (1h)
- [ ] P1-9: Add HTTP/2 pool monitoring (1h)
- [ ] P1-5: Define token/session retention (2h)
- [ ] P1-12: Create CONTRIBUTING.md (2h)
- [ ] P1-7: Add memory leak detection (2h)
- [ ] P1-8: Expose performance metrics (2h)

### Week 2 (10-15 hours)
- [ ] P1-6: Create threat model docs (3-4h)
- [ ] P1-4: Add security alerting (4h)
- [ ] P1-2: Complete field masking (4-6h)
- [ ] P1-11: Add TSDoc comments (6-8h)

### Month 1-3 (20-30 hours)
- [ ] P1-10: Increase test coverage to 75% (20-30h)
- [ ] P1-1: Monitor SDK updates (ongoing)

---

## Priority Matrix

### Impact vs Effort

```
High Impact │ P1-2 (field masking)    │ P1-3 (rate limits)
           │ P1-4 (alerting)         │ P1-9 (pool monitor)
           │ P1-10 (coverage)        │
           │                         │
Medium     │ P1-11 (TSDoc)           │ P1-5 (retention)
Impact     │ P1-6 (threat model)     │ P1-7 (memory)
           │                         │ P1-8 (metrics)
           │                         │ P1-12 (contrib)
           │                         │
Low Impact │ P1-1 (SDK limits)       │
           │                         │
           └─────────────────────────┴────────────────
             High Effort (10+ hrs)    Low Effort (1-4 hrs)
```

### Recommended Order

**By Value (Impact / Effort):**
1. P1-3: Rate limits (HIGH / 1h) = 🌟🌟🌟🌟🌟
2. P1-9: Pool monitoring (MED / 1h) = 🌟🌟🌟🌟
3. P1-5: Retention (MED / 2h) = 🌟🌟🌟
4. P1-12: CONTRIBUTING (MED / 2h) = 🌟🌟🌟
5. P1-7: Memory detection (MED / 2h) = 🌟🌟🌟
6. P1-8: Metrics (MED / 2h) = 🌟🌟🌟
7. P1-4: Alerting (HIGH / 4h) = 🌟🌟🌟
8. P1-2: Field masking (HIGH / 4-6h) = 🌟🌟
9. P1-6: Threat model (MED / 3-4h) = 🌟🌟
10. P1-11: TSDoc (MED / 6-8h) = 🌟
11. P1-10: Coverage (HIGH / 20-30h) = 🌟
12. P1-1: SDK limits (LOW / N/A) = ⏳

---

## Success Metrics

### After Phase 1 (Week 1)
- ✅ Rate limits externalized (enterprise-ready)
- ✅ HTTP/2 pool monitored (observability)
- ✅ Token/session retention defined (compliance)
- ✅ CONTRIBUTING.md created (contributor-ready)
- ✅ Memory leak detection active (reliability)
- ✅ Performance metrics exposed (observability)

### After Phase 2 (Week 2)
- ✅ Threat model documented (security posture clear)
- ✅ Security alerting active (incident response ready)
- ✅ Field masking complete (quota optimized)
- ✅ TSDoc coverage high (developer experience improved)

### After Phase 3 (Month 1-3)
- ✅ Test coverage ≥ 75% (maintainability improved)
- ✅ Overall grade: A+ (95+/100)

---

## Notes

- All P1 items are **non-blocking** for production deployment
- Focus on Phase 1 quick wins first (highest ROI)
- Phase 2 can be done in parallel with production operations
- Phase 3 (test coverage) can be spread over 2-3 months
- Monitor P1-1 (SDK limitations) but don't block on it

---

**Status:** Ready for Implementation
**Next Action:** Start with P1-3 (rate limit configuration)
**Estimated Time to A+ Grade:** 2-3 months with phased approach

