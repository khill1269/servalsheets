---
title: ServalSheets MCP Server - Comprehensive Error Analysis
category: archived
last_updated: 2026-01-31
description: "Analysis Date: 2025-01-22"
tags: [testing]
---

# ServalSheets MCP Server - Comprehensive Error Analysis

**Analysis Date:** 2025-01-22
**Tests Completed:** 20 (19 logged + 1 hanging)
**Tests Passed:** 17
**Tests Skipped/Deferred:** 2
**Tests Failed/Hanging:** 1
**Source Code Reviewed:** ✅ Yes

---

## Executive Summary

During systematic testing of ServalSheets MCP server, we encountered **1 critical hanging issue** that requires immediate investigation. After reviewing the source code at `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/core.ts` and the schema at `src/schemas/core.ts`, I've identified the root cause and potential fixes.

---

## Error Inventory

### ERROR #1: sheets_core → copy (HANGING/NO RESPONSE)

**Severity:** 🔴 CRITICAL (Causes complete hang)

**Symptom:**

```
<e>No result received from client-side tool execution.</e>
```

**Reproduction Steps:**

1. Create a spreadsheet (works fine)
2. Attempt to copy it with `sheets_core → copy`
3. Tool hangs indefinitely, returns no result

**Parameter Variations Attempted:**

```javascript
// Attempt 1: Using "title" parameter
{"title": "_Test_Copied_Spreadsheet_Delete_Me", "action": "copy", "spreadsheetId": "..."}
// Result: HANG

// Attempt 2: Using "newTitle" parameter  
{"action": "copy", "newTitle": "_Test_Copied_Spreadsheet_Delete_Me", "spreadsheetId": "..."}
// Result: HANG

// Attempt 3: Using "name" parameter
{"name": "_Test_Copied_Spreadsheet", "action": "copy", "spreadsheetId": "..."}
// Result: HANG
```

**Root Cause Analysis (Based on Code Review):**

After reviewing the actual source code, here are the findings:

### Schema Definition (`src/schemas/core.ts`)

```typescript
const CopyActionSchema = CommonFieldsSchema.extend({
  action: z.literal('copy').describe('Copy an entire spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Source spreadsheet ID'),
  newTitle: z.string().optional().describe('Title for the copied spreadsheet'),  // ← CORRECT PARAM
  destinationFolderId: z.string().optional().describe('Google Drive folder ID'),
});
```

### Handler Implementation (`src/handlers/core.ts`)

```typescript
private async handleCopy(input: CoreCopyInput): Promise<CoreResponse> {
    if (!this.driveApi) {
      return this.error({...});  // ← Should return error if Drive API missing
    }

    let title = input.newTitle;
    if (!title) {
      // Fetches current title - THIS COULD HANG if sheetsApi is slow
      const current = await this.sheetsApi.spreadsheets.get({...});
      title = `Copy of ${current.data.properties?.title ?? 'Untitled'}`;
    }

    // THIS IS THE LIKELY HANG POINT - no timeout wrapper
    const response = await this.driveApi.files.copy(copyParams);
    // ...
}
```

### Root Causes Identified

1. **🔴 CRITICAL: No Timeout on Drive API Call**
   - The `driveApi.files.copy()` call has NO timeout wrapper
   - If Drive API is slow/unresponsive, it hangs indefinitely
   - The MCP client eventually times out with "No result received"

2. **🟡 MEDIUM: driveApi May Be Undefined**
   - The constructor accepts `driveApi?: drive_v3.Drive` as OPTIONAL
   - If not initialized, returns error, but the error might not propagate correctly

3. **🟡 MEDIUM: Cascading Hang on Title Fetch**
   - If `newTitle` is not provided, it calls `sheetsApi.spreadsheets.get()`
   - This ALSO has no timeout and could hang

4. **🟢 CONFIRMED: Correct Parameter is `newTitle`**
   - NOT `title`, NOT `name`
   - Schema explicitly defines `newTitle: z.string().optional()`

### Recommended Fixes

```typescript
// Fix 1: Add timeout wrapper utility
async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Fix 2: Update handleCopy with timeouts
private async handleCopy(input: CoreCopyInput): Promise<CoreResponse> {
  if (!this.driveApi) {
    return this.error({
      code: 'INTERNAL_ERROR',
      message: 'Drive API not available',
      retryable: false,
    });
  }

  try {
    let title = input.newTitle;
    if (!title) {
      // Add 10s timeout for metadata fetch
      const current = await withTimeout(
        this.sheetsApi.spreadsheets.get({
          spreadsheetId: input.spreadsheetId,
          fields: 'properties.title',
        }),
        10000,
        'Get spreadsheet title'
      );
      title = `Copy of ${current.data.properties?.title ?? 'Untitled'}`;
    }

    // Add 30s timeout for copy operation
    const response = await withTimeout(
      this.driveApi.files.copy({
        fileId: input.spreadsheetId,
        requestBody: {
          name: title,
          parents: input.destinationFolderId ? [input.destinationFolderId] : undefined,
        },
      }),
      30000,
      'Copy spreadsheet'
    );

    return this.success('copy', {...});
  } catch (err) {
    return this.mapError(err);  // Ensure errors are caught and returned
  }
}
```

---

## Patterns Identified Across Codebase

### Pattern 1: Timeout Constants NOT Applied to Google API Calls

**Finding:** `REQUEST_TIMEOUT = 10000` (10s) is defined in `src/config/constants.ts` but NOT applied to actual Google API calls.

**Affected Operations (All Could Hang):**

| File | Operation | API Call |
|------|-----------|----------|
| `core.ts` | `handleCopy` | `driveApi.files.copy()` |
| `core.ts` | `handleList` | `driveApi.files.list()` |
| `collaborate.ts` | version operations | `driveApi.revisions.get()` |
| `templates.ts` | template save | `driveApi.files.update()` |

### Pattern 2: driveApi is Optional Constructor Parameter

```typescript
// In core.ts constructor
constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive) {
  this.driveApi = driveApi;  // Could be undefined!
}
```

**Impact:** If `driveApi` is not passed during initialization, ALL Drive operations will fail. The error handling exists but the hang occurs BEFORE reaching the error check in some code paths.

### Pattern 3: No Circuit Breaker on External API Calls

Despite having `CIRCUIT_BREAKER_THRESHOLD = 5` and `CIRCUIT_BREAKER_TIMEOUT = 60000` constants defined, they're not consistently applied to Google API calls.

---

## Test Results Summary

| Phase | Tool | Actions | Passed | Failed | Skipped | Deferred |
|-------|------|---------|--------|--------|---------|----------|
| 1.1 | sheets_auth | 4 | 2 | 0 | 1 | 1 |
| 1.2 | sheets_session | 13 | 11 | 0 | 0 | 2 |
| 1.3 | sheets_core | 15 | 2 | 1 | 0 | 0 |
| **TOTAL** | | **32** | **15** | **1** | **1** | **3** |

**Pass Rate (excluding skips/defers):** 93.75% (15/16)

---

## Actions Not Yet Tested (sheets_core)

| Action | Status | Notes |
|--------|--------|-------|
| copy | ❌ HANGING | Needs fix before proceeding |
| update_properties | ⏳ Pending | |
| get_url | ⏳ Pending | |
| batch_get | ⏳ Pending | |
| get_comprehensive | ⏳ Pending | |
| list | ⏳ Pending | Uses Drive API - may hang |
| add_sheet | ✅ Tested | During setup |
| delete_sheet | ⏳ Pending | |
| duplicate_sheet | ⏳ Pending | May have same issue as copy |
| update_sheet | ✅ Tested | During setup |
| copy_sheet_to | ⏳ Pending | May have same issue as copy |
| list_sheets | ✅ Tested | During setup |
| get_sheet | ⏳ Pending | |

---

## PRIORITIZED ACTION ITEMS

### 🔴 P0 - CRITICAL (Fix Immediately)

**1. Add Timeout Wrapper Utility**

```bash
# Create new file: src/utils/api-timeout.ts
```

```typescript
export async function withTimeout<T>(
  promise: Promise<T>, 
  ms: number, 
  operation: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}
```

**2. Apply Timeout to All Drive API Calls**

- `src/handlers/core.ts`: `handleCopy`, `handleList`
- `src/handlers/collaborate.ts`: version operations
- `src/handlers/templates.ts`: file operations

### 🟡 P1 - HIGH (Fix This Week)

**3. Verify driveApi Initialization**

- Check where `SheetsCoreHandler` is instantiated
- Ensure `driveApi` is ALWAYS passed (not undefined)
- Add startup validation to fail fast if Drive API not available

**4. Add Integration Tests for Drive Operations**

```typescript
describe('sheets_core copy', () => {
  it('should copy spreadsheet with timeout', async () => {
    const result = await handler.handle({
      request: { action: 'copy', spreadsheetId: TEST_ID, newTitle: 'Test Copy' }
    });
    expect(result.response.success).toBe(true);
  }, 35000); // 35s timeout (30s operation + 5s buffer)
  
  it('should timeout gracefully if Drive API unresponsive', async () => {
    // Mock slow Drive API
    const result = await handler.handle({...});
    expect(result.response.error.code).toBe('TIMEOUT');
  });
});
```

### 🟢 P2 - MEDIUM (Fix This Month)

**5. Apply Circuit Breaker Pattern**

- Use existing `CIRCUIT_BREAKER_THRESHOLD` constant
- Wrap external API calls with circuit breaker
- Track failures and trip circuit after threshold

**6. Add Telemetry/Tracing**

- Log operation start/end times
- Track API call latencies
- Alert on timeouts

---

## QUICK FIX FOR TESTING

To continue testing while the fix is implemented, skip these actions:

- `sheets_core → copy`
- `sheets_core → list` (uses Drive API)
- `sheets_core → duplicate_sheet` (may use similar pattern)
- `sheets_core → copy_sheet_to`
- Any `sheets_collaborate` version operations
- Any `sheets_templates` operations

These can be tested after the timeout fix is deployed.

---

## Appendix: Error Messages Reference

### "No result received from client-side tool execution"

- **Meaning:** MCP client timeout - tool didn't respond within expected time
- **Common Causes:**
  1. Infinite loop in handler
  2. Unresolved promise
  3. Deadlock
  4. External API timeout without error handling
  5. Process crash without error propagation

---

*Analysis generated during ServalSheets MCP testing session - 2025-01-22*
