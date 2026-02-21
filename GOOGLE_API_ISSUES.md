# Google API Issues — ServalSheets Living Document

Last updated: 2026-02-18
Protocol: MCP 2025-11-25 | Sheets API v4 | Drive API v3 | BigQuery API v2

This is a living audit document. Update `Status` as issues are resolved.
Priority: **P0** = correctness/data-loss risk | **P1** = significant performance | **P2** = best-practice gap | **P3** = minor/optional

---

## SUMMARY

| #   | Issue                                                     | Priority | Status       | Est. Impact                                                                                                |
| --- | --------------------------------------------------------- | -------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | Field masks not applied in `data.ts`                      | P1       | ✅ Resolved  | All API calls confirmed to have `fields` param; `handleClearHyperlink` was missing — fixed                 |
| 2   | `getFieldMaskStats()` returns zeros (no instrumentation)  | P2       | ✅ Fixed     | Added module-level counters to `injectFieldMask()`; `getFieldMaskStats()` now returns live data            |
| 3   | BatchingSystem removed from `data.ts`                     | P1       | ⚪ Won't Fix | Intentional design decision per `data.ts` header comment                                                   |
| 4   | Gzip not requested on outbound Google API calls           | P2       | ✅ Resolved  | Merged with Issue 12 — User-Agent fix covers both                                                          |
| 5   | `batchUpdate` replies index not always validated          | P1       | ✅ Resolved  | Grep confirms no direct `replies[` indexing in handlers                                                    |
| 6   | Same-batch sheetId pattern not used in `composite`        | P2       | ✅ Fixed     | `setup_sheet` now pre-determines sheetId; new sheets merge addSheet + formats into 1 batchUpdate            |
| 7   | `format.ts` batch_format limit not enforced pre-call      | P1       | ✅ Fixed     | Added `requests.length > 100` guard before batchUpdate in `handleBatchFormat`                              |
| 8   | Apps Script timeout values not verified vs. current docs  | P2       | ✅ Fixed     | Raised `SCRIPT_RUN_TIMEOUT_MS` to 1,860,000 ms (31 min) to cover Workspace 30-min execution limit         |
| 9   | BigQuery async job polling strategy not verified          | P1       | ✅ Resolved  | `executeQueryWithJobPolling` at line 263 handles `jobComplete: false` with full polling loop + backoff     |
| 10  | `drive.appdata` scope lost on incremental consent upgrade | P0       | ✅ Resolved  | `include_granted_scopes: true` confirmed in auth.ts:221, oauth-provider.ts:541, incremental-scope.ts:1907  |
| 11  | `injectBatchFieldMask` uses `fields` not `responseFields` | P2       | ✅ Fixed     | Google API uses `fields` for all endpoints; fixed misleading comment in `injectBatchFieldMask`             |
| 12  | No gzip User-Agent string on STDIO transport              | P2       | ✅ Fixed     | Added `'User-Agent': 'ServalSheets/1.7.0 (gzip)'` to transporter defaults in `google-api.ts:313-322` block |

---

## DETAILED ISSUES

---

### ISSUE 1 — Field masks not applied in `data.ts` (PRIMARY HANDLER)

**Priority:** P1
**Status:** ❌ Open
**Source:** Google docs → "Partial response / fields parameter"

**Finding:**
`src/utils/field-mask-injection.ts` and `src/config/action-field-masks.ts` exist and map all 305 actions to optimal field masks. However, `data.ts` — the highest-traffic handler — does **not call `injectFieldMask()`** anywhere.

Confirmed via:

```
Grep("injectFieldMask", path="src/handlers/data.ts") → No matches found
```

The 4 places in `data.ts` that DO use `fields` are hand-coded for niche actions only (`get_merges`, `get_formulas`, two property lookups). The primary actions are unmasked:

- `read_range` → `spreadsheets.values.get({spreadsheetId, range, ...})` — **no `fields` param**
- `batch_read` → `spreadsheets.values.get({...})` — **no `fields` param**
- `find_replace` read pass → `spreadsheets.values.get({...})` — **no `fields` param**
- `get_hyperlink` → `spreadsheets.values.get({...})` — **no `fields` param**
- `get_note` → `spreadsheets.get({spreadsheetId, ranges, includeGridData: true})` — **no `fields` param**

**Google Best Practice:**

> "You can ask the server to send only the fields you really need and get a partial response instead."
> `spreadsheets.values.get?fields=values,range,majorDimension` reduces payload by ~40% vs. full response.

**What to Fix:**
Apply `injectFieldMask()` (already built at `src/utils/field-mask-injection.ts:55`) to all `spreadsheets.values.get` calls in `data.ts`. At minimum:

- `read_range`: `fields=values,range,majorDimension`
- `batch_read`: `fields=valueRanges(values,range,majorDimension)`
- `get_note`: `fields=sheets.data.rowData.values.note`

**Handlers also lacking field masks (lower priority):**

- `analyze.ts` — `spreadsheets.get` without fields (returns full metadata including all grid data)
- `fix.ts` — diagnostic read pass has no field mask

---

### ISSUE 2 — `getFieldMaskStats()` returns hardcoded zeros

**Priority:** P2
**Status:** ❌ Open

**Finding:**
`src/utils/field-mask-injection.ts:233-249` — `getFieldMaskStats()` returns all zeros because "Stats tracking requires instrumentation layer (future enhancement)."

```typescript
// Confirmed in file:
return {
  totalCalls: 0,
  maskedCalls: 0,
  unmaskedCalls: 0,
  coveragePercent: 0, // Always 0 — cannot audit coverage
  estimatedBytesSaved: 0,
};
```

**Impact:** No way to know in production what percentage of API calls actually have field masks. Issue 1 would have been caught earlier with working stats.

**What to Fix:**
Add a module-level counter map. Increment in `injectFieldMask()` for both masked and unmasked paths. Expose via `GET /metrics` (Prometheus counter already exists in `src/observability/metrics.ts`).

---

### ISSUE 3 — BatchingSystem removed from `data.ts`

**Priority:** P1
**Status:** ❌ Open
**Source:** Google docs → "Each batch request is counted as one API request toward your usage limit"

**Finding:**
`data.ts` was explicitly refactored to remove batching:

```
// From data.ts header comment:
"Refactored to remove:
 - Batching system integration
 ..."
"Now uses: Direct Google API calls"
```

The `BatchingSystem` (`src/services/batching-system.ts`) collects operations within a 50–100ms window and merges them into a single `batchUpdate`. Without it, concurrent MCP tool calls (e.g., `write` + `format` in same conversation turn) make 2 separate API calls instead of 1.

**Google Best Practice:**

> "Batching can improve an application's efficiency by decreasing network round trips and increasing throughput."
> "Each batch request, including all subrequests, is counted as one API request toward your usage limit."

**Context:**
`sheets_transaction` (`src/services/transaction-manager.ts`) correctly batches via a single `batchUpdate` commit. But that requires the user to explicitly begin/queue/commit. Auto-batching for direct `write` + `write` sequences within one conversation turn is gone.

**What to Fix:**
Re-integrate `BatchingSystem` for at least the `values:update` and `cells:update` operation types, or document as intentional with a comment explaining why the trade-off was made.

---

### ISSUE 4 — Gzip on outbound Google API requests not verified

**Priority:** P2
**Status:** ⚠️ Verify

**Finding:**
Inbound HTTP responses ARE gzip-compressed (`src/http-server.ts:379-389` — `compression()` middleware). However, outbound requests to `sheets.googleapis.com` need to explicitly request gzip from Google's servers.

Google docs state:

> "Set an Accept-Encoding header, and modify your user agent to contain the string gzip."

The `googleapis` Node.js library typically sends `Accept-Encoding: gzip` automatically via the underlying `gaxios` HTTP client. But it is NOT verified that the `User-Agent` string includes `(gzip)` as required by the docs.

**What to Verify:**

```bash
# Check what HTTP headers are sent to Google
DEBUG=googleapis npm run start 2>&1 | grep -i "accept-encoding\|user-agent"
```

**If missing:** Set `gaxios` default headers in `src/services/google-api.ts` during client initialization.

---

### ISSUE 5 — `batchUpdate` replies[] index mapping not consistently validated

**Priority:** P1
**Status:** ⚠️ Verify
**Source:** Google docs → "Some requests don't have responses and the response at that array index is empty."

**Finding:**
`src/core/response-parser.ts` correctly documents and handles the empty-object reply pattern:

```
replies: [
  { addSheet: { properties: {...} } },
  {},  // <-- UpdateCells has no response
  { addNamedRange: { namedRange: {...} } }
]
```

However, handlers that call `batchUpdate` directly (not through `response-parser.ts`) may assume non-empty replies at all indexes.

**Files to audit:**

- `src/handlers/advanced.ts` (many direct `batchUpdate` calls, 15+ occurrences)
- `src/handlers/format.ts` (batch_format)
- `src/handlers/dimensions.ts`
- `src/handlers/visualize.ts`

**What to Verify:**
Any handler accessing `response.data.replies[n]?.someField` without the optional chain `?.` on the reply itself will throw on empty `{}` replies. Run:

```bash
grep -n "replies\[" src/handlers/*.ts
```

---

### ISSUE 6 — Same-batch sheetId pattern not used in `composite.ts`

**Priority:** P2
**Status:** ❌ Open
**Source:** Google docs → "By adding the sheet ID in the request, users can use the sheet ID for other subrequests in the same API call. This improves performance by avoiding a write-read-write cycle."

**Finding:**
The Google docs example shows the optimal pattern:

```json
{ "addSheet": { "properties": { "sheetId": 123456 } } },
{ "updateCells": { "start": { "sheetId": 123456 }, "rows": [...] } }
```

Both in **one** `batchUpdate` call — the sheet is created AND populated atomically.

`src/handlers/composite.ts` (and `setup_sheet` action) likely does this as two sequential API calls: create sheet → get ID from response → populate. This is a write-read-write cycle per operation.

**What to Fix:**
Where the composite handler calls `addSheet` followed by `updateCells`, merge them into a single `batchUpdate` using a pre-determined `sheetId` (any unique integer, since Google accepts client-specified IDs in `addSheet`).

---

### ISSUE 7 — `batch_format` limit not pre-validated

**Priority:** P1
**Status:** ⚠️ Verify

**Finding:**
`src/config/google-limits.ts:101` — `BATCH_REQUEST_LIMIT = 100` is defined.
MCP instructions state: "batch_format max 100 operations per call."
But it must be confirmed that `src/handlers/format.ts` enforces this before calling the API (not after getting a Google error).

**What to Verify:**

```bash
grep -n "BATCH_REQUEST_LIMIT\|100\|batchSize" src/handlers/format.ts
```

If missing, the API will return a 400 error on >100 subrequests rather than a clean validation error from ServalSheets.

---

### ISSUE 8 — Apps Script timeout values not verified against current docs

**Priority:** P2
**Status:** ⚠️ Verify

**Finding:**
`src/handlers/appsscript.ts:59` has "Timeout constants per Google Apps Script API documentation" but the current official limits from Google are:

- Script execution timeout: 6 minutes (consumer accounts) / 30 minutes (Workspace accounts)
- Web app timeout: 30 seconds
- `script.run` API call timeout: Must be ≤ the script execution limit

The `APPS_SCRIPT_API_BASE = 'https://script.googleapis.com/v1'` is correct. Verify the timeout constants in the handler match current documentation, especially since Workspace accounts have different limits.

**Also critical:**
Apps Script API does **not work with service accounts**. The handler notes this (`IMPORTANT: Does NOT work with service accounts - requires OAuth user auth`), but verify the authentication check is enforced before making any `script.googleapis.com` call.

---

### ISSUE 9 — BigQuery async job polling not verified

**Priority:** P1
**Status:** ⚠️ Verify

**Finding:**
BigQuery SQL queries (`sheets_bigquery → query` action) are asynchronous. Google's BigQuery API returns a `jobReference` for queries. The caller must poll `jobs.get` until `status.state === 'DONE'`.

`src/handlers/bigquery.ts` uses `bigquery.jobs.query` (synchronous endpoint) which has a built-in timeout (`timeoutMs`). However:

- If `timeoutMs` is exceeded, the response contains `jobComplete: false` and requires polling
- The polling loop (if any) needs backoff to avoid quota exhaustion

**What to Verify:**

```bash
grep -n "jobComplete\|pollJob\|timeoutMs\|jobs\.get" src/handlers/bigquery.ts
```

If `jobComplete: false` is not handled, large queries will silently return incomplete results.

---

### ISSUE 10 — `drive.appdata` scope may be lost on incremental consent upgrade

**Priority:** P0
**Status:** ⚠️ Verify

**Finding:**
`src/config/oauth-scopes.ts` defines:

- `STANDARD_SCOPES` includes `drive.appdata` (used for template storage)
- `FULL_ACCESS_SCOPES` also includes `drive.appdata`

`src/security/incremental-scope.ts` handles incremental consent for features requiring `drive` or `bigquery` scopes.

**Risk:** When a user upgrades from STANDARD → FULL scopes via incremental consent, if the OAuth flow does not include `drive.appdata` in the incremental request (since it was already granted), some OAuth providers drop previously-granted scopes during re-authorization flows.

**What to Verify:**
Confirm `src/security/incremental-scope.ts` always includes the current granted scopes in the incremental consent URL, not just the new requested scopes (use `include_granted_scopes=true` OAuth parameter).

---

### ISSUE 11 — `injectBatchFieldMask` uses wrong property name

**Priority:** P2
**Status:** ⚠️ Verify
**Source:** Google docs → batchUpdate response structure

**Finding:**
`src/utils/field-mask-injection.ts:126-143` — `injectBatchFieldMask` has this comment:

```typescript
// For batchUpdate, use responseFields
// For batchGet, use fields
return {
  ...params,
  fields: fieldMask, // <-- Uses 'fields' for both cases
};
```

The comment says to use `responseFields` for `batchUpdate` but the code uses `fields`. This means the field mask for `batchUpdate` responses may not be applied correctly.

**What to Verify:**
Check Google Sheets API v4 `batchUpdate` whether the response filtering parameter is `fields` or `responseFields`. If `responseFields` is the correct parameter, update the implementation.

---

### ISSUE 12 — No gzip User-Agent string on STDIO transport

**Priority:** P2
**Status:** ❌ Open

**Finding:**
Google docs require the User-Agent header to contain `(gzip)` for gzip-encoded responses:

> "modify your user agent to contain the string gzip"

The STDIO transport (`src/server.ts`) initializes `GoogleApiClient` without setting a custom User-Agent. The HTTP transport (`src/http-server.ts`) has inbound compression but also does not configure the outbound googleapis User-Agent.

**What to Fix:**
In `src/services/google-api.ts`, set a custom User-Agent during `google.sheets()` / `google.drive()` initialization:

```typescript
// Add to googleapis initialization options
headers: {
  'User-Agent': `ServalSheets/1.7.0 (gzip)`,
}
```

---

## ALREADY CORRECT — Do Not Change

These areas were audited and are compliant with Google best practices:

| Area                                      | File                                  | Compliant Pattern                                   |
| ----------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| batchUpdate atomicity                     | `src/services/transaction-manager.ts` | N ops → 1 `batchUpdate` via `commit()`              |
| `replies[]` index parsing                 | `src/core/response-parser.ts`         | Handles `{}` empty replies correctly                |
| Rate limits defined                       | `src/config/google-limits.ts`         | 300 req/min, 500 req/100s with official source refs |
| Circuit breaker on 429/5xx                | `src/services/google-api.ts`          | Opens after 5 failures, half-opens after 30s        |
| Auto-retry with backoff                   | `src/utils/retry.ts`                  | 3x exponential + jitter, correct status code list   |
| HTTP/2 enabled                            | `src/services/google-api.ts:290`      | `http2: true` on all API clients                    |
| OAuth scope principle of least privilege  | `src/config/oauth-scopes.ts`          | STANDARD_SCOPES uses `drive.file` not `drive`       |
| Incremental consent for restricted scopes | `src/security/incremental-scope.ts`   | Sharing, BigQuery, AppsScript gated separately      |
| Token refresh proactive                   | `src/services/token-manager.ts`       | Refreshes 5 min before expiry                       |
| ETag caching on reads                     | `src/services/etag-cache.ts`          | Avoids redundant reads on unchanged data            |
| Inbound gzip compression                  | `src/http-server.ts:379`              | `compression()` middleware, threshold 1KB           |
| Field mask constants defined              | `src/config/action-field-masks.ts`    | All 305 actions mapped (even if not all wired in)   |
| Batch request limit constant              | `src/config/google-limits.ts:101`     | `BATCH_REQUEST_LIMIT = 100` per Google docs         |
| BigQuery SQL injection guard              | `src/handlers/bigquery.ts:58+`        | Blocks dangerous SQL patterns                       |
| AppsScript service account block          | `src/handlers/appsscript.ts`          | Documented + noted in handler                       |
| Request merging (overlapping reads)       | `src/services/request-merger.ts`      | Merges ranges within 50ms window                    |
| Connection pooling                        | `src/services/google-api.ts:126-143`  | `keepAlive`, `maxSockets=50`, configurable          |

---

## REFERENCE

### Google Docs Ingested

- [Batch Requests](https://developers.google.com/sheets/api/guides/batch) — atomicity, replies[] format, sheetId reuse
- [Improve Performance](https://developers.google.com/sheets/api/guides/performance) — gzip, partial response (fields param)
- [API Limits](https://developers.google.com/sheets/api/limits) — quotas, batch limits, grid limits

### Key Files

- `src/config/google-limits.ts` — All API limits as typed constants
- `src/config/oauth-scopes.ts` — Scope sets + incremental consent strategy
- `src/utils/field-mask-injection.ts` — Field mask utility (built, partially wired)
- `src/config/action-field-masks.ts` — 305-action field mask registry
- `src/services/batching-system.ts` — Time-window batching (50–100ms)
- `src/services/transaction-manager.ts` — Explicit atomic batching
- `src/core/response-parser.ts` — batchUpdate replies[] parsing
- `src/services/google-api.ts` — All Google API client initialization

### Verification Commands

```bash
# Check field mask coverage in a handler
grep -n "fields\|injectFieldMask" src/handlers/data.ts

# Check batchUpdate replies handling
grep -n "replies\[" src/handlers/*.ts

# Check quota/rate limit references
grep -rn "BATCH_REQUEST_LIMIT\|READ_REQUESTS" src/handlers/

# Verify incremental scope includes granted scopes
grep -n "include_granted_scopes" src/security/incremental-scope.ts
```
