# Research Delta Report — Google API & MCP Protocol vs ServalSheets Findings

> Generated: 2026-03-24 | Cross-references audit-findings-session103.md
> Sources: Google Sheets API docs, MCP 2025-11-25 spec, MCP development guides, OAuth 2.1 spec

---

## 1. GOOGLE SHEETS API — COMPLIANCE GAPS

### 1.1 Quota Model Misalignment (HIGH)
**Google's actual limits (2025-11-25):**
- **Read requests:** 300 per minute per project
- **Write requests:** 300 per minute per project
- **Per-user limit:** 60 requests per minute per user per project
- **No daily cap** (only per-minute quotas, refilled each minute)

**ServalSheets current state:**
- `google-api.ts` circuit breaker threshold: 5 failures → OPEN (too aggressive for quota errors)
- QuotaCircuitBreaker exists but uses fixed 30s recovery — Google says retries can continue after max_backoff
- **GAP:** No per-user rate limiting enforcement (only per-project via circuit breaker)
- **GAP:** No distinction between read vs write quota buckets

**Fix needed:**
- Separate read/write quota counters (300/min each)
- Per-user sliding window (60/min) enforced BEFORE Google API call
- Circuit breaker for quota errors should use longer recovery (Google retries can go indefinitely)

### 1.2 Exponential Backoff Formula Mismatch (MEDIUM)
**Google's specified formula:**
```
wait = min(((2^n) + random_milliseconds), maximum_backoff)
where random_milliseconds ≤ 1000ms
```

**ServalSheets current (`src/utils/retry.ts`):**
- baseDelay=100ms, maxDelay=32s, jitter=0.1
- Formula: `baseDelay * (2^attempt) * (1 + jitter * random)`

**Gaps:**
- Google specifies random_milliseconds up to 1000ms (full jitter), not 0.1 multiplier
- Google says max_backoff typically 32s or 64s — ServalSheets uses 32s (lower bound)
- **Missing:** Retry-After header parsing — Google 429s may include Retry-After, which should override calculated backoff
- **Missing:** Continued retries after max_backoff (Google says clients can continue retrying at max_backoff interval)

### 1.3 Field Mask Best Practices (LOW — Already Good)
**Google recommends:**
- Always specify fields parameter (up to 80% payload reduction)
- Use specific field paths, never `*` wildcards
- 2 MB maximum payload recommendation

**ServalSheets current:**
- `ENABLE_AGGRESSIVE_FIELD_MASKS=true` with `getFieldMask()` in validation-helpers.ts
- Metadata: 95% reduction, Sheet list: 80% reduction
- ✅ Already exceeding most recommendations

**Minor gap:** No 2MB payload size enforcement on responses

### 1.4 Batch Update Optimization (LOW — Mostly Good)
**Google recommends:**
- Group operations into single batchUpdate (80%+ speedup vs sequential)
- Use field masks in update requests
- 10,000 cells in one updateCells call vs sequential setValue

**ServalSheets current:**
- Max batch: 100 operations per batchUpdate
- Adaptive window: 20-200ms
- ✅ Already well-implemented

**Gap:** Google says up to 10,000 cells per updateCells — ServalSheets caps at 100 operations. Could increase batch ceiling for bulk writes.

### 1.5 Connection Pooling (MEDIUM)
**Google recommends:**
- HTTP/2 for multiplexed concurrent requests on single socket
- HTTP/2 sessions auto-collected after 500ms idle
- HTTP/1.1 with keepAlive for non-HTTP/2 scenarios

**ServalSheets current:**
- HTTP/2 support enabled via `ENABLE_HTTP2=true`
- Custom HTTP agents with keepAlive
- Connection health monitoring (60s intervals)

**Gaps:**
- C-4 race condition in connection reset (audit finding)
- No HTTP/2 session idle timeout configuration (default 500ms may be too aggressive)
- No connection pool metrics emission (H-9 audit finding)

### 1.6 ETag Caching (LOW — Already Excellent)
**Best practice:** If-None-Match → 304 Not Modified → reuse cached response

**ServalSheets current:**
- Layer 1: ETag conditional requests via CachedSheetsApi
- Layer 2: Local LRU cache (5-min TTL)
- 80-100x API call reduction
- ✅ Best-in-class implementation

**Minor gap:** No stale-while-revalidate pattern (serve stale cache during background refresh)

---

## 2. MCP PROTOCOL — COMPLIANCE GAPS

### 2.1 Initialization Lifecycle (LOW — Compliant)
**Spec requires:** Three-phase lifecycle (init → message → terminate). Only ping and logging permitted before initialization.

**ServalSheets:** Staged registration (3 phases) in server.ts. ✅ Compliant.

### 2.2 Timeout & Cancellation (MEDIUM)
**Spec requires:**
- Implementations SHOULD enforce request timeouts
- MUST issue `$/cancelRequest` notification on timeout
- Progress notifications can reset timeout windows
- Maximum overall timeout MUST be enforced regardless

**ServalSheets current:**
- Task watchdog timers exist (server.ts:158)
- Per-request timeout from `getRequestContext().timeoutMs`

**Gaps:**
- `$/cancelRequest` notification not consistently issued on timeout (only AbortController abort)
- No progress-based timeout extension (progress resets window)
- H-1 audit finding: task abort controller cleanup incomplete

### 2.3 Sampling Protocol (MEDIUM)
**Spec requires:**
- Check client capabilities during initialization
- Gracefully degrade if sampling unavailable
- Servers MUST send sampling requests only in association with originating client request

**ServalSheets current:**
- Sampling capability checked (mcp/sampling.ts)
- GDPR consent checking before data transmission
- 30s timeout

**Gaps:**
- M-PR1 audit finding: Session context NOT injected into `generateFormula()`, `recommendChart()`, `explainFormula()`
- No sampling request association tracking (which client request triggered the sampling call)
- Sampling timeout (30s) should be configurable and respect progress-based extension

### 2.4 Elicitation Protocol (MEDIUM)
**Spec requires:**
- Form mode for non-sensitive data collection
- URL mode for sensitive data (OAuth, credentials, payments) — MUST NOT expose to MCP client
- State MUST NOT be associated with session IDs alone
- State storage MUST be protected against unauthorized access
- When URL-mode marked required, client MUST fail if unsupported (not silently skip)

**ServalSheets current:**
- Form mode: 5 schemas + wizard sessions (elicitation.ts, 1258 lines)
- URL mode: OAuth flows via api-key-server.ts (Session 88 fix)
- Graceful degradation when client doesn't support elicitation

**Gaps:**
- Elicitation state associated with session IDs (may violate MUST NOT requirement)
- No check for URL-mode `required` flag — currently always graceful degradation
- Need to verify state storage protection against unauthorized access

### 2.5 Tasks Protocol (LOW — Good)
**Spec requires:**
- Task augmentation restricted to: tools/call, sampling/createMessage, elicitation/create
- Durable state machines with lifecycle: working → input_required → completed/failed/cancelled
- Polling-based deferred result retrieval

**ServalSheets:** 9 task-capable tools. TaskStore with in-memory + Redis backends. ✅ Mostly compliant.

**Minor gap:** M-PR2 audit finding — event store max-size per-count (5K) with no per-bytes limit

### 2.6 Resource Subscriptions (LOW)
**Spec requires:**
- `notifications/resources/list_changed` when resource list changes
- `notifications/resources/updated` for specific resource content changes
- Cleanup for disconnected subscribers

**ServalSheets:** 68+ resources, 2 URI templates. ✅ Subscription support exists.

**Gap:** No explicit subscriber cleanup for disconnected clients (potential memory leak)

### 2.7 Tool Registration & List Changed (LOW — Compliant)
**Spec requires:**
- `listChanged` capability for dynamic tool discovery
- Pagination support for `tools/list`

**ServalSheets:** 25 tools with staged registration + list_changed notification. ✅ Compliant.

### 2.8 Security — OAuth 2.1 + PKCE (MEDIUM)
**Spec requires:**
- PKCE mandatory (S256 method when technically capable)
- Short-lived, scoped tokens
- Resource indicators (RFC 8707) so tokens scoped to one MCP server
- Token validation: signature, expiry, issuer, scopes, audience
- Metadata discovery for OAuth endpoints

**ServalSheets current:**
- OAuth 2.1 with PKCE S256 mandatory (oauth-provider.ts)
- JWT with scope validation
- Server-side Google token storage
- Redirect URI allowlist

**Gaps:**
- No RFC 8707 resource indicators (tokens not scoped to specific MCP server)
- No OAuth metadata discovery endpoint (`.well-known/oauth-authorization-server`)
- M-S1 audit: Admin auth falls back to JWT_SECRET when ADMIN_API_KEY unset
- M-S2/M-S3 audit: SAML configuration gaps

### 2.9 Error Handling (LOW — Good)
**Spec requires:**
- JSON-RPC error codes (-32602 invalid params, -32603 server error)
- Meaningful error messages without exposing internals
- Structured error data

**ServalSheets:** 60+ error codes in ErrorCodeSchema, error-factory with enriched context. ✅ Strong.

**Minor gap:** Some error messages may expose internal paths (need audit)

### 2.10 Logging & Observability (MEDIUM)
**Spec recommends:**
- `notifications/message` for MCP-level logging (visible in client UI)
- Request/response IDs in logs for tracing
- stderr for operational logs (stdio transport)

**ServalSheets:** Dynamic log level, structured logging.

**Gaps:**
- H-9 audit: No P50/P95/P99 latency percentile tracking
- H-10 audit: No trace propagation to Google API calls
- No correlation between MCP request IDs and Google API request IDs

---

## 3. CIRCUIT BREAKER & RESILIENCE — BEST PRACTICE GAPS

### 3.1 Exponential Recovery (HIGH)
**Best practice:** Circuit breaker recovery should use exponential backoff (30s → 60s → 120s → 300s max), not fixed timeout.

**ServalSheets:** Fixed 30s recovery for all circuit breakers.

**Fix:** Implement progressive recovery with backoff + jitter.

### 3.2 Bulkhead Pattern (MEDIUM)
**Best practice:** Isolate resources per dependency so one failing service can't exhaust all resources.

**ServalSheets:** Write-lock middleware provides per-spreadsheet isolation for writes. No bulkhead for reads.

**Fix:** Add per-spreadsheet read concurrency limits (e.g., max 5 concurrent reads per spreadsheet).

### 3.3 Global Retry Budget (HIGH)
**Best practice:** Cap total retries system-wide to prevent retry storms.

**ServalSheets:** No global budget — 100 concurrent ops × 3 retries = 300 potential retry attempts.

**Fix:** Implement permit-based retry budget (max 50 concurrent retries across all operations).

### 3.4 Circuit Breaker Observability (MEDIUM)
**Best practice:** Track state changes in logs AND metrics. Without observability, resilience is guesswork.

**ServalSheets:** Circuit breaker state logged but not emitted as metrics.

**Fix:** Emit Prometheus metrics for state transitions (closed→open, open→half_open, half_open→closed).

---

## 4. PRIORITY MATRIX — NEW FINDINGS FROM RESEARCH

| # | Finding | Source | Severity | Audit Cross-Ref |
|---|---------|--------|----------|-----------------|
| R-1 | Per-user rate limiting (60/min) not enforced | Google API limits | HIGH | NEW |
| R-2 | Read/write quota buckets not separated | Google API limits | HIGH | NEW |
| R-3 | Retry-After header not parsed from 429s | Google backoff spec | HIGH | M-P1 |
| R-4 | Jitter formula doesn't match Google spec | Google backoff spec | MEDIUM | NEW |
| R-5 | No `$/cancelRequest` on timeout | MCP spec | MEDIUM | H-1 |
| R-6 | Elicitation state tied to session IDs | MCP elicitation spec | MEDIUM | NEW |
| R-7 | No RFC 8707 resource indicators for tokens | MCP OAuth spec | MEDIUM | NEW |
| R-8 | No OAuth metadata discovery endpoint | MCP OAuth spec | MEDIUM | NEW |
| R-9 | No stale-while-revalidate cache pattern | HTTP caching spec | LOW | NEW |
| R-10 | Batch ceiling 100 ops vs Google's 10K cells | Google batch spec | LOW | NEW |
| R-11 | No subscriber cleanup for disconnected clients | MCP resources spec | LOW | NEW |
| R-12 | Circuit breaker metrics not emitted | Resilience patterns | MEDIUM | H-9 |

---

## 5. UPDATED IMPROVEMENT PLAN (Research-Informed)

### Phase 0 — Critical (Same Day)
1. C-1 through C-4 from audit (memory leaks + race condition)
2. **R-3: Parse Retry-After header** from Google 429 responses (override exponential backoff)

### Phase 1 — High Impact (1 Week)
1. **R-1: Per-user rate limiter** — sliding window 60 req/min per user
2. **R-2: Separate read/write quota counters** — 300/min each
3. **R-4: Fix jitter formula** — full jitter (random up to 1000ms) per Google spec
4. Global retry budget (max 50 concurrent retries)
5. Circuit breaker exponential recovery (30s → 60s → 120s → 300s)
6. P50/P95/P99 latency metrics

### Phase 2 — Protocol Compliance (2 Weeks)
1. **R-5: `$/cancelRequest` notification** on timeout
2. **R-6: Decouple elicitation state** from session IDs
3. **R-7: RFC 8707 resource indicators** for OAuth tokens
4. **R-8: OAuth metadata discovery** endpoint
5. Extend sampling session context to all sampling functions
6. Circuit breaker state transition metrics

### Phase 3 — Advanced (1-3 Months)
1. **R-9: Stale-while-revalidate** cache pattern
2. **R-10: Increase batch ceiling** for bulk write operations
3. **R-11: Subscriber cleanup** for disconnected MCP clients
4. Per-spreadsheet read bulkhead isolation
5. SpreadsheetLLM semantic mapping
6. Predictive forecasting + anomaly detection improvements
