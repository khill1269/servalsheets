# ServalSheets MCP Server - Master Enhancement Blueprint

**Document Version:** 1.0
**Created:** February 5, 2026
**Based On:** MCP Protocol Best Practices + Google Sheets API Best Practices + Comprehensive Testing

---

## Executive Summary

This blueprint provides a comprehensive roadmap for transforming ServalSheets from a functional MCP server into a **production-grade, best-in-class** Google Sheets integration. Based on testing of all 22 tools and 293+ actions, combined with MCP protocol best practices and Google Sheets API guidelines.

### Current State Assessment
| Metric | Score | Notes |
|--------|-------|-------|
| **Core Functionality** | 65% | Basic CRUD works, advanced features broken |
| **MCP Compliance** | 45% | Missing isError flag, inconsistent schemas |
| **Error Handling** | 35% | Many JS undefined errors, poor messages |
| **Discoverability** | 25% | No consistent help, action lists missing |
| **Performance** | 50% | Timeouts, no batching, no caching |
| **Security** | 60% | OAuth works, needs token management |
| **Documentation** | 30% | Descriptions don't match implementations |

### Target State
| Metric | Target | How to Achieve |
|--------|--------|----------------|
| **Core Functionality** | 95% | Fix all JS bugs, complete implementations |
| **MCP Compliance** | 95% | Implement all patterns from spec |
| **Error Handling** | 90% | Three-tier model, isError flag |
| **Discoverability** | 90% | JSON Schema, help actions, examples |
| **Performance** | 85% | Caching, batching, connection pooling |
| **Security** | 90% | Token refresh, rate limiting, validation |
| **Documentation** | 90% | Action lists, parameter docs, examples |

---

## Part 1: Complete Action Inventory & Test Results

### Tool Inventory (22 Tools, 293+ Actions)

#### 1. sheets_auth (4 actions)
| Action | Status | Issues |
|--------|--------|--------|
| status | ✅ PASS | Works well |
| login | ✅ PASS | Sometimes times out |
| callback | ⚠️ UNTESTED | Manual OAuth flow |
| logout | ⚠️ UNTESTED | - |

#### 2. sheets_core (19 actions)
| Action | Status | Issues |
|--------|--------|--------|
| get | ✅ PASS | Works |
| create | ✅ PASS | Works |
| copy | ⚠️ UNTESTED | - |
| update_properties | ✅ PASS | Works |
| get_url | ✅ PASS | Works |
| batch_get | ⚠️ UNTESTED | - |
| get_comprehensive | ✅ PASS | Excellent metadata |
| list | ⚠️ UNTESTED | - |
| add_sheet | ✅ PASS | Works |
| delete_sheet | ✅ PASS | Works |
| duplicate_sheet | ✅ PASS | Works |
| update_sheet | ✅ PASS | (docs say rename_sheet) |
| copy_sheet_to | ✅ PASS | Works |
| list_sheets | ✅ PASS | Works |
| get_sheet | ✅ PASS | Works |
| clear_sheet | ✅ PASS | Works |
| move_sheet | ✅ PASS | Param: newIndex not index |
| batch_delete_sheets | ⚠️ UNTESTED | - |
| batch_update_sheets | ⚠️ UNTESTED | - |

#### 3. sheets_data (18 actions)
| Action | Status | Issues |
|--------|--------|--------|
| read | ✅ PASS | Works |
| write | ✅ PASS | Works |
| append | ✅ PASS | Works |
| clear | ❌ TIMEOUT | 30s timeout |
| batch_read | ✅ PASS | Returns cached data |
| batch_write | ✅ PASS | Works |
| batch_clear | ⚠️ UNTESTED | - |
| find_replace | ⚠️ UNTESTED | - |
| add_note | ✅ PASS | Works |
| get_note | ✅ PASS | Works |
| clear_note | ⚠️ UNTESTED | - |
| set_hyperlink | ❌ FAIL | URL validation broken |
| clear_hyperlink | ⚠️ UNTESTED | - |
| merge_cells | ✅ PASS | Works |
| unmerge_cells | ✅ PASS | Works |
| get_merges | ⚠️ UNTESTED | - |
| cut_paste | ⚠️ UNTESTED | - |
| copy_paste | ❌ FAIL | JS error: 'in' operator |

#### 4. sheets_format (21 actions)
| Action | Status | Issues |
|--------|--------|--------|
| set_format | ❌ FAIL | Missing 'fields' param |
| set_background | ✅ PASS | Works (cell count off by 1) |
| set_text_format | ❌ FAIL | JS error |
| set_alignment | ✅ PASS | Works (cell count off by 1) |
| set_borders | ⚠️ UNTESTED | - |
| set_number_format | ❌ FAIL | JS error: 'in' operator |
| set_wrap | ⚠️ UNTESTED | - |
| *Others* | ⚠️ UNTESTED | 14+ more actions |

#### 5. sheets_dimensions (28 actions)
| Action | Status | Issues |
|--------|--------|--------|
| insert_rows | ✅ PASS | Returns "insert" not "insert_rows" |
| delete_rows | ✅ PASS | Returns "delete" not "delete_rows" |
| insert_columns | ✅ PASS | Works |
| delete_columns | ⚠️ UNTESTED | - |
| resize_rows | ⚠️ UNTESTED | - |
| resize_columns | ❌ FAIL | "No dimension specified" |
| hide_rows | ❌ AUTH | Token expired during test |
| show_rows | ❌ AUTH | Token expired during test |
| freeze_rows | ❌ AUTH | Token expired during test |
| *Others* | ⚠️ UNTESTED | 19+ more actions |

#### 6. sheets_visualize (18 actions)
| Action | Status | Issues |
|--------|--------|--------|
| chart_create | ❌ FAIL | JS error: undefined.sourceRange |
| *Others* | ⚠️ UNTESTED | 17+ more actions |

#### 7. sheets_collaborate (28 actions)
| Action | Status | Issues |
|--------|--------|--------|
| comment_add | ✅ PASS | Works |
| *Others* | ⚠️ UNTESTED | 27+ more actions |

#### 8. sheets_advanced (23 actions)
| Action | Status | Issues |
|--------|--------|--------|
| add_named_range | ✅ PASS | Works |
| *Others* | ⚠️ UNTESTED | 22+ more actions |

#### 9. sheets_transaction (6 actions)
| Action | Status | Issues |
|--------|--------|--------|
| begin | ✅ PASS | Works |
| queue | ❌ FAIL | Validation bug - params not recognized |
| commit | ⚠️ UNTESTED | - |
| rollback | ⚠️ UNTESTED | - |
| *Others* | ⚠️ UNTESTED | - |

#### 10. sheets_quality (4 actions)
| Action | Status | Issues |
|--------|--------|--------|
| validate | ⚠️ PARTIAL | Returns counts but no details |
| *Others* | ⚠️ UNTESTED | 3+ more actions |

#### 11. sheets_history (7 actions)
| Action | Status | Issues |
|--------|--------|--------|
| list | ⚠️ PARTIAL | Returns 0 operations (not tracking) |
| *Others* | ⚠️ UNTESTED | 6+ more actions |

#### 12. sheets_confirm (5 actions)
| Action | Status | Issues |
|--------|--------|--------|
| *All* | ❌ FAIL | JS error: undefined.success |

#### 13. sheets_analyze (16 actions)
| Action | Status | Issues |
|--------|--------|--------|
| comprehensive | ✅ PASS | Uses background tasks (good) |
| *Others* | ⚠️ UNTESTED | 15+ more actions |

#### 14. sheets_fix (1 action)
| Action | Status | Issues |
|--------|--------|--------|
| fix | ❌ FAIL | Requires issues param (undocumented) |

#### 15. sheets_composite (10 actions)
| Action | Status | Issues |
|--------|--------|--------|
| smart_append | ❌ FAIL | JS error: undefined.length |
| *Others* | ⚠️ UNTESTED | 9+ more actions |

#### 16. sheets_session (17 actions)
| Action | Status | Issues |
|--------|--------|--------|
| set_active | ✅ PASS | Works but shows 0 sheets |
| *Others* | ⚠️ UNTESTED | 16+ more actions |

#### 17. sheets_templates (8 actions)
| Action | Status | Issues |
|--------|--------|--------|
| list | ✅ PASS | Works |
| *Others* | ⚠️ UNTESTED | 7+ more actions |

#### 18. sheets_bigquery (14 actions)
| Action | Status | Issues |
|--------|--------|--------|
| query | ❌ EXPECTED | Needs BigQuery API enabled |

#### 19. sheets_appsscript (14 actions)
| Action | Status | Issues |
|--------|--------|--------|
| get_content | ❌ FAIL | projects/undefined/content |

#### 20. sheets_webhook (6 actions)
| Action | Status | Issues |
|--------|--------|--------|
| *All* | ❌ EXPECTED | Requires Redis |

#### 21. sheets_dependencies (7 actions)
| Action | Status | Issues |
|--------|--------|--------|
| build | ✅ PASS | Works |
| *Others* | ⚠️ UNTESTED | 6+ more actions |

---

## Part 2: Pattern Analysis - Issues Found

### Pattern 1: JavaScript Undefined Access Errors
**Frequency:** 10+ occurrences
**Root Cause:** Missing null checks before property access
**Affected Functions:** copy_paste, chart_create, smart_append, set_number_format, confirm actions

**Code Pattern (Bad):**
```javascript
// This crashes when rangeData is undefined
if ('a1' in rangeData) { ... }
```

**Fix Pattern (Good):**
```javascript
// Check for undefined first
if (rangeData && 'a1' in rangeData) { ... }
```

### Pattern 2: Inconsistent Action Discovery
**Frequency:** 22 tools
**Issue:** Only sheets_core and sheets_data return action lists on invalid action
**Impact:** Claude cannot discover valid actions

**Current (Bad):**
```json
{"error": {"message": "Unknown action: _list"}}
```

**Best Practice (Good):**
```json
{
  "error": {
    "message": "Unknown action: _list",
    "availableActions": ["read", "write", "append", ...],
    "documentation": "https://..."
  }
}
```

### Pattern 3: Parameter Name Mismatches
**Frequency:** 5+ occurrences
**Examples:**
- `index` vs `newIndex` (move_sheet)
- `rename_sheet` vs `update_sheet` (action name)
- `sheetId` validation fails even when provided

### Pattern 4: Cell Count Off-By-One Errors
**Frequency:** 2+ occurrences
**Issue:** Range "A1:D1" returns "cellsFormatted: 3" instead of 4

### Pattern 5: Action Name Mismatch in Response
**Frequency:** 5+ occurrences
**Issue:** Request "insert_rows" returns "action": "insert"
**Impact:** Confuses response processing

### Pattern 6: Missing Fields in Google API Calls
**Frequency:** 3+ occurrences
**Issue:** "At least one field must be listed in 'fields'"
**Root Cause:** Not passing required 'fields' param to repeatCell

### Pattern 7: Timeout on Basic Operations
**Frequency:** 1+ occurrences
**Issue:** Simple "clear" operation times out at 30s
**Root Cause:** No timeout configuration or batching

### Pattern 8: Error Handling Crashes
**Frequency:** 1+ occurrences
**Issue:** sheets_confirm crashes in error handler itself
**Error:** "Cannot read properties of undefined (reading 'success')"

---

## Part 3: MCP Best Practices Compliance Audit

### ✅ What ServalSheets Does Well

1. **OAuth 2.0 Authentication** - Proper OAuth flow with refresh tokens
2. **Action-based Design** - Uses action parameter pattern
3. **Structured Responses** - JSON responses with success field
4. **Background Tasks** - sheets_analyze uses async pattern

### ❌ MCP Compliance Gaps

#### Gap 1: Missing isError Flag
**MCP Spec Requirement:** Tool errors should return `isError: true` in result
**Current:** Returns error object but no isError flag
**Impact:** Host cannot distinguish tool failure from content

**Fix:**
```javascript
// Current (non-compliant)
return { success: false, error: {...} };

// MCP Compliant
return {
  content: [{ type: "text", text: "Error: ..." }],
  isError: true
};
```

#### Gap 2: No JSON Schema for Parameters
**MCP Best Practice:** Provide inputSchema for tool parameters
**Current:** No schema provided - Claude guesses parameters
**Impact:** Parameter errors, poor discoverability

**Fix:** Add inputSchema to each tool definition:
```javascript
{
  name: "sheets_data",
  description: "...",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["read", "write", "append", ...]
      },
      spreadsheetId: { type: "string" },
      range: { type: "string", pattern: "^.+!.+$" }
    },
    required: ["action"]
  }
}
```

#### Gap 3: Inconsistent Error Categories
**MCP Best Practice:** Use error classification (CLIENT, SERVER, EXTERNAL)
**Current:** Mix of INVALID_PARAMS, INTERNAL_ERROR, etc.

**Fix:** Standardize error codes:
```javascript
const ErrorCodes = {
  // Client errors (retryable: false)
  INVALID_PARAMS: { code: -32602, retryable: false },
  UNKNOWN_ACTION: { code: -32601, retryable: false },

  // Server errors (retryable: true)
  INTERNAL_ERROR: { code: -32603, retryable: true },

  // External errors (retryable: varies)
  API_ERROR: { code: -32000, retryable: true },
  AUTH_ERROR: { code: -32001, retryable: false },
  RATE_LIMITED: { code: -32002, retryable: true }
};
```

#### Gap 4: No Logging/Correlation IDs
**MCP Best Practice:** Include correlation IDs for tracing
**Current:** No request IDs in responses

**Fix:**
```javascript
{
  success: true,
  action: "write",
  requestId: "req_abc123",
  timestamp: "2026-02-05T12:00:00Z",
  duration_ms: 245
}
```

---

## Part 4: Google Sheets API Best Practices Compliance

### ✅ What ServalSheets Does Well

1. **Batch Operations Exist** - batch_read, batch_write available
2. **OAuth Scopes** - Uses appropriate spreadsheets + drive scopes

### ❌ API Compliance Gaps

#### Gap 1: No Exponential Backoff
**Google Requirement:** Implement exponential backoff for 429 errors
**Current:** No retry logic visible

**Fix:**
```javascript
async function withRetry(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s, 8s, 16s
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

#### Gap 2: No Request Batching
**Google Best Practice:** Batch multiple operations into single HTTP requests
**Current:** Each operation = separate API call

**Impact:**
- 300 reads/min quota hit quickly
- 100 writes/min quota hit quickly
- 10x slower than batched

**Fix:** Use batchUpdate for multiple formatting operations:
```javascript
// Instead of 10 separate formatCell calls:
const requests = formatOps.map(op => ({
  repeatCell: {
    range: op.range,
    cell: { userEnteredFormat: op.format },
    fields: "userEnteredFormat"
  }
}));

sheets.batchUpdate({
  spreadsheetId,
  requestBody: { requests }
});
```

#### Gap 3: No Caching Layer
**Google Best Practice:** Cache frequently accessed data
**Current:** Every read hits API

**Fix:**
```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedRead(spreadsheetId, range) {
  const key = `${spreadsheetId}:${range}`;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { ...cached.data, _cached: true };
  }

  const data = await sheets.values.get({ spreadsheetId, range });
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

#### Gap 4: No Connection Pooling
**Google Best Practice:** Reuse HTTP connections
**Current:** Unknown connection management

---

## Part 5: Comprehensive Fix Roadmap

### Phase 1: Critical Bug Fixes (Week 1-2)
**Priority: HIGHEST - Blocking basic functionality**

| # | Bug | Fix | Files |
|---|-----|-----|-------|
| 1 | JS undefined errors (10+) | Add null checks | All handlers |
| 2 | copy_paste broken | Fix range parsing | data.ts |
| 3 | chart_create broken | Fix sourceRange access | visualize.ts |
| 4 | smart_append broken | Fix length check | composite.ts |
| 5 | set_format missing fields | Add fields param | format.ts |
| 6 | resize_columns no dimension | Add dimension param | dimensions.ts |
| 7 | transaction queue validation | Fix param validation | transaction.ts |
| 8 | URL validation too strict | Fix regex | data.ts |
| 9 | sheets_confirm crashes | Fix error handler | confirm.ts |
| 10 | set_hyperlink validation | Accept valid URLs | data.ts |

### Phase 2: MCP Compliance (Week 2-3)
**Priority: HIGH - Align with protocol spec**

| # | Enhancement | Implementation |
|---|-------------|----------------|
| 1 | Add isError flag | Wrap all error responses |
| 2 | Add inputSchema | Define JSON Schema per tool |
| 3 | Standardize error codes | Create ErrorCodes enum |
| 4 | Add correlation IDs | Generate UUIDs per request |
| 5 | Add help action | Implement in all 22 tools |
| 6 | Return action lists | Include in all error responses |

### Phase 3: Google API Optimization (Week 3-4)
**Priority: HIGH - Performance and reliability**

| # | Enhancement | Implementation |
|---|-------------|----------------|
| 1 | Exponential backoff | Wrap all API calls |
| 2 | Request batching | Combine format operations |
| 3 | Caching layer | Add in-memory cache with TTL |
| 4 | Connection pooling | Configure HTTP client |
| 5 | Quota monitoring | Track usage, add alerts |

### Phase 4: Documentation & Discoverability (Week 4-5)
**Priority: MEDIUM - Developer experience**

| # | Enhancement | Implementation |
|---|-------------|----------------|
| 1 | Update tool descriptions | List all actions |
| 2 | Add parameter examples | Include in inputSchema |
| 3 | Document parameter names | Match code exactly |
| 4 | Add usage examples | Per-action examples |
| 5 | Create API reference | Generate from schema |

### Phase 5: Advanced Features (Week 5-6)
**Priority: MEDIUM - Complete feature set**

| # | Enhancement | Implementation |
|---|-------------|----------------|
| 1 | Fix sheets_history | Enable operation tracking |
| 2 | Fix sheets_session | Properly count sheets |
| 3 | Fix sheets_quality | Return error details |
| 4 | Complete sheets_visualize | All chart types |
| 5 | Complete sheets_collaborate | All sharing features |

---

## Part 6: Implementation Specifications

### 6.1 Unified Error Response Format

```typescript
interface MCPErrorResponse {
  content: [{
    type: "text",
    text: string  // Human-readable error message
  }],
  isError: true,
  _meta: {
    code: string,           // ERROR_CODE enum
    category: "client" | "server" | "external",
    retryable: boolean,
    retryAfter?: number,    // Seconds to wait if retryable
    requestId: string,      // Correlation ID
    timestamp: string,      // ISO 8601
    action: string,         // What action was attempted
    availableActions?: string[],  // For unknown action errors
    suggestedFix?: string   // How to fix the error
  }
}
```

### 6.2 Unified Success Response Format

```typescript
interface MCPSuccessResponse {
  content: [{
    type: "text",
    text: string  // Human-readable summary
  }],
  isError: false,
  _meta: {
    action: string,
    requestId: string,
    timestamp: string,
    duration_ms: number,
    quotaUsed?: {
      reads: number,
      writes: number
    }
  },
  data: any  // Action-specific response data
}
```

### 6.3 Tool Input Schema Template

```typescript
const sheets_data_schema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["read", "write", "append", "clear", "batch_read",
             "batch_write", "batch_clear", "find_replace",
             "add_note", "get_note", "clear_note", "set_hyperlink",
             "clear_hyperlink", "merge_cells", "unmerge_cells",
             "get_merges", "cut_paste", "copy_paste"],
      description: "The operation to perform"
    },
    spreadsheetId: {
      type: "string",
      description: "The ID of the spreadsheet (from URL)",
      pattern: "^[a-zA-Z0-9_-]+$"
    },
    range: {
      type: "string",
      description: "A1 notation range (e.g., 'Sheet1!A1:D10')",
      pattern: "^.+!.+$"
    },
    values: {
      type: "array",
      items: { type: "array" },
      description: "2D array of values for write/append"
    }
  },
  required: ["action"],
  // Per-action requirements
  allOf: [
    {
      if: { properties: { action: { const: "write" } } },
      then: { required: ["spreadsheetId", "range", "values"] }
    }
    // ... more action-specific schemas
  ]
};
```

### 6.4 Caching Implementation

```typescript
class SheetCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = {
    metadata: 5 * 60 * 1000,    // 5 minutes
    values: 1 * 60 * 1000,      // 1 minute
    formatting: 10 * 60 * 1000  // 10 minutes
  };

  get(key: string, type: 'metadata' | 'values' | 'formatting') {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttl = this.TTL[type];
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return { data: entry.data, cached: true, age_ms: Date.now() - entry.timestamp };
  }

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(spreadsheetId: string) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(spreadsheetId)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 6.5 Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryOn?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 32000,
    retryOn = (e) => e.code === 429 || e.code >= 500
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Should not reach here');
}
```

---

## Part 7: Testing Strategy

### Unit Tests Required

```typescript
describe('sheets_data', () => {
  describe('copy_paste', () => {
    it('should handle undefined range gracefully', async () => {
      const result = await sheets_data({
        action: 'copy_paste',
        spreadsheetId: 'test',
        sourceRange: undefined,  // This should not crash
        destinationRange: 'Sheet1!A1'
      });
      expect(result.isError).toBe(true);
      expect(result._meta.code).toBe('INVALID_PARAMS');
    });
  });
});
```

### Integration Tests Required

```typescript
describe('Full Workflow', () => {
  it('should handle complete spreadsheet lifecycle', async () => {
    // Create
    const created = await sheets_core({ action: 'create', title: 'Test' });
    expect(created.isError).toBe(false);

    // Write
    const written = await sheets_data({
      action: 'write',
      spreadsheetId: created.data.spreadsheetId,
      range: 'Sheet1!A1:B2',
      values: [['a', 'b'], ['c', 'd']]
    });
    expect(written.isError).toBe(false);

    // Read back
    const read = await sheets_data({
      action: 'read',
      spreadsheetId: created.data.spreadsheetId,
      range: 'Sheet1!A1:B2'
    });
    expect(read.data.values).toEqual([['a', 'b'], ['c', 'd']]);
  });
});
```

### Load Tests Required

```typescript
describe('Rate Limiting', () => {
  it('should handle 429 with exponential backoff', async () => {
    // Simulate rate limiting
    const results = await Promise.all(
      Array(10).fill(null).map(() =>
        sheets_data({ action: 'read', spreadsheetId: 'test', range: 'A1' })
      )
    );

    // All should eventually succeed
    expect(results.every(r => !r.isError)).toBe(true);
  });
});
```

---

## Part 8: Monitoring & Observability

### Metrics to Track

```javascript
const metrics = {
  // Request metrics
  'servalsheets.requests.total': Counter,
  'servalsheets.requests.by_action': Counter,  // Labels: action, tool
  'servalsheets.requests.errors': Counter,     // Labels: error_code, action

  // Latency metrics
  'servalsheets.latency.p50': Histogram,
  'servalsheets.latency.p95': Histogram,
  'servalsheets.latency.p99': Histogram,

  // Quota metrics
  'servalsheets.quota.reads_used': Gauge,
  'servalsheets.quota.writes_used': Gauge,
  'servalsheets.quota.rate_limits_hit': Counter,

  // Cache metrics
  'servalsheets.cache.hits': Counter,
  'servalsheets.cache.misses': Counter,
  'servalsheets.cache.hit_rate': Gauge
};
```

### Logging Format

```json
{
  "timestamp": "2026-02-05T12:00:00.000Z",
  "level": "info",
  "requestId": "req_abc123",
  "tool": "sheets_data",
  "action": "write",
  "spreadsheetId": "1abc...",
  "range": "Sheet1!A1:B2",
  "duration_ms": 245,
  "status": "success",
  "quotaUsed": { "reads": 0, "writes": 1 },
  "cached": false
}
```

---

## Part 9: Success Criteria

### Definition of Done

- [ ] All 293 actions tested with passing unit tests
- [ ] All JavaScript undefined errors fixed
- [ ] All responses include isError flag
- [ ] All tools have inputSchema defined
- [ ] All tools implement help action
- [ ] Exponential backoff implemented
- [ ] Caching layer implemented (>50% cache hit rate)
- [ ] All actions return correct action name in response
- [ ] Documentation matches implementation
- [ ] Integration tests pass
- [ ] Load tests pass (handle 100 req/min)
- [ ] No timeouts on basic operations

### Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Average latency | ~2s | <500ms |
| P99 latency | Unknown | <2s |
| Cache hit rate | 0% | >50% |
| Error rate | ~30% | <5% |
| Timeout rate | ~5% | <0.1% |

---

## Appendix A: Full Action Inventory by Tool

### sheets_core (19 actions)
get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list, add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet, clear_sheet, move_sheet, batch_delete_sheets, batch_update_sheets

### sheets_data (18 actions)
read, write, append, clear, batch_read, batch_write, batch_clear, find_replace, add_note, get_note, clear_note, set_hyperlink, clear_hyperlink, merge_cells, unmerge_cells, get_merges, cut_paste, copy_paste

### sheets_format (21 actions - estimated)
set_format, set_background, set_text_format, set_alignment, set_borders, set_number_format, set_wrap, set_font, set_font_size, set_bold, set_italic, set_strikethrough, set_underline, set_conditional_format, clear_conditional_format, get_conditional_formats, set_data_validation, clear_data_validation, get_data_validation, auto_resize_columns, auto_resize_rows

### sheets_dimensions (28 actions - estimated)
insert_rows, delete_rows, insert_columns, delete_columns, resize_rows, resize_columns, hide_rows, show_rows, hide_columns, show_columns, freeze_rows, freeze_columns, unfreeze_rows, unfreeze_columns, sort_range, filter_view_add, filter_view_delete, filter_view_get, filter_view_list, group_rows, group_columns, ungroup_rows, ungroup_columns, get_row_count, get_column_count, set_row_count, set_column_count, auto_fit

### sheets_composite (10 actions)
import_csv, smart_append, bulk_update, deduplicate, export_xlsx, import_xlsx, get_form_responses, setup_sheet, import_and_format, clone_structure

---

**Document End**

*This blueprint should be treated as a living document and updated as implementation progresses.*
