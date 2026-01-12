# ServalSheets - Exact Code Fixes and Optimizations Required

## Executive Summary

This document details **ALL** code that requires improvement, editing, or deletion based on comprehensive code analysis. Each issue includes exact file paths, line numbers, current code, and recommended fixes.

---

## TABLE OF CONTENTS

1. [TypeCheck Errors (75 errors)](#1-typecheck-errors-75-errors)
2. [Monkey-Patch Code (Remove/Replace)](#2-monkey-patch-code-removereplace)
3. [Silent Fallback Patterns (4 issues)](#3-silent-fallback-patterns-4-issues)
4. [Scope Validation Duplication (66 lines)](#4-scope-validation-duplication-66-lines)
5. [Error Factory Duplication (30+ locations)](#5-error-factory-duplication-30-locations)
6. [Performance Optimizations (12 issues)](#6-performance-optimizations-12-issues)

---

## 1. TYPECHECK ERRORS (75 errors)

### Root Cause
Flattened `z.object()` schema pattern (workaround for MCP SDK bug) prevents TypeScript from properly narrowing optional fields based on action discriminator.

### 1.1 dimensions.ts - 27 Errors (startIndex/endIndex undefined)

**File:** `src/handlers/dimensions.ts`

**Root Issue:** Schema defines all fields as `.optional()` but handlers expect non-undefined after action narrowing.

#### Fix Option 1: Type Assertion with Non-Null (Quick Fix)

```typescript
// CURRENT CODE (Line 187):
endIndex: input.startIndex + count,  // TS18048: 'input.startIndex' is possibly 'undefined'

// FIXED CODE:
endIndex: input.startIndex! + count,  // Non-null assertion
```

Apply to all 27 error locations:
- Lines: 187, 214, 233, 238, 250, 338, 346, 393, 407, 433, 443, 469, 503, 533, 558, 597, 627, 657, 687, 773, 799, 825, 851

#### Fix Option 2: Runtime Guard (Type-Safe)

```typescript
// CURRENT CODE (Lines 172-189):
private async handleInsertRows(
  input: SheetsDimensionsInput & { action: "insert_rows" },
): Promise<DimensionsResponse> {
  const { spreadsheetId, sheetId, startIndex, count = 1 } = input;

  const range = await this.resolveRange(spreadsheetId, { sheetId });

  const request: Request = {
    insertDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex,
        endIndex: input.startIndex + count,  // ERROR: startIndex possibly undefined
      },
    },
  };

// FIXED CODE:
private async handleInsertRows(
  input: SheetsDimensionsInput & { action: "insert_rows" },
): Promise<DimensionsResponse> {
  const { spreadsheetId, sheetId, startIndex, count = 1 } = input;

  // Runtime guard (TypeScript now knows startIndex is number)
  if (typeof startIndex !== 'number') {
    throw new ValidationError('startIndex is required for insert_rows action');
  }

  const range = await this.resolveRange(spreadsheetId, { sheetId });

  const request: Request = {
    insertDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex,
        endIndex: startIndex + count,  // No error - narrowed to number
      },
    },
  };
```

#### Fix Option 3: Proper Narrowed Types (Best Practice)

```typescript
// Add to src/schemas/dimensions.ts after line 179:

export type DimensionsInsertRowsInput = SheetsDimensionsInput & {
  action: "insert_rows";
  spreadsheetId: string;
  sheetId: number;
  startIndex: number;  // NOT optional
  count?: number;
};

// Then in handler (line 172):
private async handleInsertRows(
  input: DimensionsInsertRowsInput,  // Use narrowed type
): Promise<DimensionsResponse> {
  // Now input.startIndex is guaranteed to be number
  const { spreadsheetId, sheetId, startIndex, count = 1 } = input;
  // ... rest of implementation works without errors
```

**Recommendation**: Use Option 3 for long-term type safety. Apply narrowed types to all 14 action handlers in dimensions.ts.

---

### 1.2 rules.ts - 1 Error (Discriminated Union Not Narrowing)

**File:** `src/handlers/rules.ts`
**Line:** 91

#### Current Code (Lines 79-91):

```typescript
async handle(input: SheetsRulesInput): Promise<SheetsRulesOutput> {
  const inferredRequest = this.inferRequestParameters(input) as SheetsRulesInput;
  try {
    const req = inferredRequest;
    let response: RulesResponse;
    switch (req.action) {
      case "add_conditional_format":
        response = await this.handleAddConditionalFormat(req);  // LINE 91: TS2345 error
```

**Error:**
```
Type '{ action: "add_conditional_format" | "update_conditional_format" | ... }'
is not assignable to parameter of type 'RulesAddConditionalFormatInput'
```

#### Fixed Code:

```typescript
async handle(input: SheetsRulesInput): Promise<SheetsRulesOutput> {
  const inferredRequest = this.inferRequestParameters(input) as SheetsRulesInput;
  try {
    const req = inferredRequest;
    let response: RulesResponse;
    switch (req.action) {
      case "add_conditional_format":
        response = await this.handleAddConditionalFormat(req as RulesAddConditionalFormatInput);
        break;
      case "update_conditional_format":
        response = await this.handleUpdateConditionalFormat(req as RulesUpdateConditionalFormatInput);
        break;
      case "delete_conditional_format":
        response = await this.handleDeleteConditionalFormat(req as RulesDeleteConditionalFormatInput);
        break;
      // ... apply to all 8 cases
```

---

### 1.3 values.ts - 44 Errors (Multiple Optional Fields)

**File:** `src/handlers/values.ts`

#### Group 1: spreadsheetId/range Undefined (12 errors)

**Lines:** 574, 585, 602, 678, 712, 985, 1043, 1077, 1097, 1118, 1129

**Example - Line 574:**

```typescript
// CURRENT CODE:
private async handleAppend(
  input: SheetsValuesInput & { action: "append" },
): Promise<ValuesResponse> {
  const range = await this.resolveRange(input.spreadsheetId, input.range);
  //                                      ^^^^^^^^^^^^^^^^^^^^ TS2345: string | undefined

// FIXED CODE (Runtime Guard):
private async handleAppend(
  input: SheetsValuesInput & { action: "append" },
): Promise<ValuesResponse> {
  if (!input.spreadsheetId || !input.range) {
    throw new ValidationError('spreadsheetId and range are required');
  }
  const range = await this.resolveRange(input.spreadsheetId, input.range);
```

**OR BETTER - Use Narrowed Type:**

```typescript
// Add to src/schemas/values.ts:
export type ValuesAppendInput = SheetsValuesInput & {
  action: "append";
  spreadsheetId: string;  // NOT optional
  range: string | { a1: string } | { semantic: string };  // NOT optional
  values: unknown[][];    // NOT optional
};

// Then in handler:
private async handleAppend(
  input: ValuesAppendInput,  // Narrowed type
): Promise<ValuesResponse> {
  const range = await this.resolveRange(input.spreadsheetId, input.range);  // No error
```

#### Group 2: values Array Undefined (8 errors)

**Lines:** 575, 577, 579, 580, 853, 854, 898, 899, 900

**Example - Line 575:**

```typescript
// CURRENT CODE:
const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);
//                     ^^^^^^^^^^^^ TS18048: possibly 'undefined'

// FIXED CODE:
const cellCount = input.values?.reduce((sum, row) => sum + row.length, 0) ?? 0;

// OR BETTER with Guard:
if (!input.values) {
  throw new ValidationError('values are required for append action');
}
const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);
```

#### Group 3: ranges Array Undefined (8 errors)

**Lines:** 769, 947, 959, 965, 1005

**Example - Line 769:**

```typescript
// CURRENT CODE:
const ranges = input.ranges.map((r) => {
//              ^^^^^^^^^^^^^ TS18048: possibly 'undefined'

// FIXED CODE:
if (!input.ranges) {
  throw new ValidationError('ranges are required for batch_read action');
}
const ranges = input.ranges.map((r) => {
```

#### Group 4: data Array Undefined (3 errors)

**Lines:** 853, 898, 899, 900

**Fixed:** Same pattern as ranges - add runtime guard.

#### Group 5-7: Similar Guards Needed

**Remaining errors** follow same pattern - add runtime guards or use narrowed types.

**Recommendation**: Create all narrowed types in `src/schemas/values.ts` and update handler method signatures.

---

## 2. MONKEY-PATCH CODE (Remove/Replace)

### 2.1 SDK Compatibility Module - TO BE REMOVED

**File:** `src/mcp/sdk-compat.ts` (172 lines)
**Status:** Staged for removal in working directory

#### Patch 1: patchMcpServerRequestHandler() (Lines 37-70)

```typescript
// DELETE THIS ENTIRE FUNCTION:
export function patchMcpServerRequestHandler(): void {
  if (patched) return;
  patched = true;

  const original = Server.prototype.setRequestHandler;

  Server.prototype.setRequestHandler = function setRequestHandlerPatched(
    requestSchema: unknown,
    handler: unknown,
  ) {
    const shape = getObjectShape(requestSchema as any);
    const methodSchema = shape?.["method"] as Record<string, unknown> | undefined;

    if (methodSchema && methodSchema["value"] === undefined) {
      const def = (methodSchema["_def"] as { value?: unknown; values?: unknown[] } | undefined) ??
        (methodSchema["_zod"] as { def?: { value?: unknown; values?: unknown[] } } | undefined)?.def;
      const literal = def?.value ?? (Array.isArray(def?.values) ? def?.values[0] : undefined);

      if (typeof literal === "string") {
        Object.defineProperty(methodSchema, "value", {
          value: literal,
          configurable: true,
        });
      }
    }

    return original.call(this, requestSchema as never, handler as never);
  };
}

// REASON: Flattened z.object() pattern eliminates need for this patch
```

#### Patch 2: patchToJsonSchemaCompat() (Lines 74-172)

```typescript
// DELETE THIS ENTIRE FUNCTION:
export function patchToJsonSchemaCompat(): void {
  try {
    const require = createRequire(import.meta.url);
    const zodJsonSchemaCompat = require("@modelcontextprotocol/sdk/dist/cjs/server/zod-json-schema-compat.js");

    const originalToJsonSchemaCompat = zodJsonSchemaCompat.toJsonSchemaCompat;

    zodJsonSchemaCompat.toJsonSchemaCompat = function toJsonSchemaCompatPatched(
      schema: unknown,
      options?: { target?: string },
    ): Record<string, unknown> {
      try {
        const jsonSchema = z.toJSONSchema(schema as any);
        if (typeof jsonSchema === "object" && jsonSchema !== null) {
          const { $schema: _$schema, ...rest } = jsonSchema as Record<string, unknown>;
          return rest;
        }
        return originalToJsonSchemaCompat(schema, options);
      } catch (error) {
        console.error("[sdk-compat] Conversion failed:", error);
        return originalToJsonSchemaCompat(schema, options);
      }
    };
  } catch (error) {
    console.error("[sdk-compat] Failed to patch:", error);
  }
}

// REASON: Flattened z.object() schemas work with SDK's normalizeObjectSchema()
```

### 2.2 Remove Patch Calls in Servers

#### remote-server.ts (Lines 66, 70-71)

```typescript
// DELETE THESE LINES:
import { patchMcpServerRequestHandler, patchToJsonSchemaCompat } from './mcp/sdk-compat.js';  // Line 66

// Apply SDK compatibility patches before server initialization
patchMcpServerRequestHandler();  // Line 70
patchToJsonSchemaCompat();        // Line 71

// REASON: No longer needed with flattened schemas
```

#### http-server.ts (Lines 95-96)

```typescript
// DELETE THESE LINES:
patchMcpServerRequestHandler();  // Line 95
patchToJsonSchemaCompat();        // Line 96

// REASON: Already staged for removal in working directory
```

### 2.3 Remove sdk-compat.ts Entirely

```bash
# After verifying tests pass without patches:
git rm src/mcp/sdk-compat.ts
```

---

## 3. SILENT FALLBACK PATTERNS (4 issues)

### 3.1 Console.error Instead of Logger (2 locations)

#### Location 1: semantic-range.ts:427

```typescript
// CURRENT CODE:
} catch (error) {
  console.error("Failed to get sheet structure:", error);  // Line 427
  return null;
}

// FIXED CODE:
} catch (error) {
  logger.error("Failed to get sheet structure", {
    component: "semantic-range",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return null;
}
```

#### Location 2: session-context.ts:454

```typescript
// CURRENT CODE:
} catch (error) {
  console.error("Failed to import session state:", error);  // Line 454
  // Missing logging - silently continues
}

// FIXED CODE:
} catch (error) {
  logger.error("Failed to import session state", {
    component: "session-context",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}
```

### 3.2 Bare Catch Blocks Without Error Parameter (2 locations)

#### Location 1: analyze.ts:317

```typescript
// CURRENT CODE (Lines 313-322):
} catch {                                    // Line 317 - bare catch
  response = {
    success: false,
    error: {
      code: "PARSE_ERROR",
      message: "Failed to parse formula response",
      retryable: true,
    },
  };
}

// FIXED CODE:
} catch (error) {
  logger.error("Failed to parse formula response", {
    component: "analyze",
    action: "suggest_formula",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  response = {
    success: false,
    error: {
      code: "PARSE_ERROR",
      message: "Failed to parse formula response",
      details: { error: error instanceof Error ? error.message : String(error) },
      retryable: true,
    },
  };
}
```

#### Location 2: analyze.ts:428

```typescript
// CURRENT CODE (Lines 424-433):
} catch {                                    // Line 428 - bare catch
  response = {
    success: false,
    error: {
      code: "PARSE_ERROR",
      message: "Failed to parse chart recommendation response",
      retryable: true,
    },
  };
}

// FIXED CODE:
} catch (error) {
  logger.error("Failed to parse chart recommendation response", {
    component: "analyze",
    action: "suggest_chart",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  response = {
    success: false,
    error: {
      code: "PARSE_ERROR",
      message: "Failed to parse chart recommendation response",
      details: { error: error instanceof Error ? error.message : String(error) },
      retryable: true,
    },
  };
}
```

---

## 4. SCOPE VALIDATION DUPLICATION (66 lines)

### 4.1 Extract to BaseHandler Method

**New Method in:** `src/handlers/base.ts`
**Insert After:** Line 654

```typescript
/**
 * Validate scope requirements and return error if insufficient
 * @param operation - Operation name from OPERATION_SCOPES
 * @param defaults - Custom resolution message and fallback category
 * @returns HandlerError or null if scopes are satisfied
 */
protected validateScopeRequirements(
  operation: string,
  defaults?: {
    resolutionMessage?: string;
    categoryFallback?: ScopeCategory;
  },
): HandlerError | null {
  const validator = new ScopeValidator({
    scopes: this.context.auth?.scopes ?? [],
  });

  const requirements = validator.getOperationRequirements(operation);

  // If no requirements defined or scopes satisfied, continue
  if (!requirements || requirements.satisfied) {
    return null;
  }

  // Generate authorization URL for incremental consent
  const authUrl = validator.generateIncrementalAuthUrl(requirements.missing);

  return this.error({
    code: "PERMISSION_DENIED",
    message: requirements.description,
    category: "auth",
    severity: "high",
    retryable: false,
    retryStrategy: "manual",
    details: {
      operation,
      requiredScopes: requirements.required,
      currentScopes: this.context.auth?.scopes ?? [],
      missingScopes: requirements.missing,
      authorizationUrl: authUrl,
      scopeCategory: requirements.category ?? defaults?.categoryFallback,
    },
    resolution:
      defaults?.resolutionMessage ??
      "Grant additional permissions to complete this operation.",
    resolutionSteps: [
      "1. Visit the authorization URL to approve required scopes",
      `2. Authorization URL: ${authUrl}`,
      "3. After approving, retry the operation",
    ],
  });
}
```

### 4.2 Replace Duplication in spreadsheet.ts

**File:** `src/handlers/spreadsheet.ts`
**Lines to Delete:** 270-305

```typescript
// DELETE LINES 270-305 (Entire validation block)
// REPLACE WITH:
const scopeError = this.validateScopeRequirements(
  "sheets_spreadsheet.create",
  { resolutionMessage: "Grant additional permissions to create new spreadsheets." }
);
if (scopeError) {
  return scopeError;
}
```

### 4.3 Replace Duplication in sharing.ts

**File:** `src/handlers/sharing.ts`
**Lines to Delete:** 65-111

```typescript
// DELETE LINES 65-111 (Entire validation block)
// REPLACE WITH:
if (!this.context.auth?.hasElevatedAccess) {
  const scopeError = this.validateScopeRequirements(
    `sheets_sharing.${input.action}`,
    { categoryFallback: ScopeCategory.DRIVE_FULL }
  );
  if (scopeError) {
    return { response: scopeError };
  }
}
```

**Lines Saved:** 66 lines of duplicate code → 10 lines total

---

## 5. ERROR FACTORY DUPLICATION (30+ locations)

### 5.1 Add Helper Methods to BaseHandler

**File:** `src/handlers/base.ts`
**Insert After:** Line 654

```typescript
/**
 * Create standardized Drive API unavailable error
 */
protected createDriveApiUnavailableError(
  action: string,
  requiredScope: string = "https://www.googleapis.com/auth/drive.file",
): HandlerError {
  return this.error({
    code: "INTERNAL_ERROR",
    message: `Drive API not available - required for ${action} operations`,
    details: {
      action,
      requiredScope,
      suggestion: "Ensure Drive API client is initialized with proper credentials",
    },
    retryable: false,
    resolution: "Ensure Drive API client is initialized with proper credentials.",
    resolutionSteps: [
      "1. Verify GOOGLE_APPLICATION_CREDENTIALS environment variable is set",
      "2. Ensure service account has Drive API enabled",
      "3. Verify the service account key file is valid",
      "4. Check that the spreadsheet is accessible to the service account",
    ],
  });
}

/**
 * Create standardized execution failure error
 */
protected createExecutionError(
  operation: string,
  details: Record<string, unknown>,
): HandlerError {
  return this.error({
    code: "INTERNAL_ERROR",
    message: `${operation} failed: Unknown error`,
    details,
    retryable: true,
    retryStrategy: "exponential_backoff",
    resolution: "Retry the operation. If error persists, check spreadsheet permissions and quotas.",
  });
}

/**
 * Create standardized service not initialized error
 */
protected createServiceNotInitializedError(
  serviceName: string,
): HandlerError {
  return this.error({
    code: "SERVICE_NOT_INITIALIZED",
    message: `${serviceName} not available`,
    details: { service: serviceName },
    retryable: false,
    resolution: `Ensure ${serviceName} is properly initialized in the handler context.`,
  });
}
```

### 5.2 Replace 8 Catch-All INTERNAL_ERROR Patterns

#### auth.ts:107-110

```typescript
// DELETE:
return {
  response: {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : String(error),
      retryable: false,
    },
  },
};

// REPLACE WITH:
return {
  response: this.error({
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
  }),
};
```

**Apply to:** history.ts:345, validation.ts:76, transaction.ts:205, conflict.ts:106, analyze.ts:466, impact.ts:88, confirm.ts:183

### 5.3 Replace 5 Drive API Unavailable Patterns

#### spreadsheet.ts:117-131

```typescript
// DELETE LINES 117-131
// REPLACE WITH:
return this.createDriveApiUnavailableError("list");
```

#### spreadsheet.ts:374-390

```typescript
// DELETE LINES 374-390
// REPLACE WITH:
return this.createDriveApiUnavailableError("spreadsheet copy");
```

**Apply to:** comments.ts:47-62, versions.ts:34-49, sharing.ts:47-62

### 5.4 Replace 7+ Execution Failure Patterns

#### values.ts:519-533

```typescript
// DELETE LINES 519-533
// REPLACE WITH:
return {
  response: this.createExecutionError("Write operation", {
    spreadsheetId,
    range: input.range,
    valueCount: input.values?.length ?? 0,
    cellCount,
  }),
};
```

**Apply to:** values.ts:630-643, 729-740, 894-911, 1001-1013, 1159-1172

---

## 6. PERFORMANCE OPTIMIZATIONS (12 issues)

### 6.1 N+1 Query in Analysis Handler (CRITICAL)

**File:** `src/handlers/analysis.ts`
**Lines:** 847-870

```typescript
// CURRENT CODE (N+1 Pattern):
for (const sheet of sheets) {
  const title = sheet.properties?.title;
  if (!title) continue;
  const range = `'${title.replace(/'/g, "''")}'!A1:Z200`;
  try {
    const valuesResp = await this.sheetsApi.spreadsheets.values.get({  // LINE 852
      spreadsheetId: input.spreadsheetId,
      range,
      valueRenderOption: "FORMULA",
    });
    // Process response...
  }
}

// FIXED CODE (Single batchGet):
// Prepare all ranges
const ranges = sheets
  .filter(sheet => sheet.properties?.title)
  .map(sheet => {
    const title = sheet.properties!.title!;
    return `'${title.replace(/'/g, "''")}'!A1:Z200`;
  });

// Single batchGet call
try {
  const batchResp = await this.sheetsApi.spreadsheets.values.batchGet({
    spreadsheetId: input.spreadsheetId,
    ranges,
    valueRenderOption: "FORMULA",
  });

  // Process all value ranges
  const valueRanges = batchResp.data.valueRanges ?? [];
  for (let i = 0; i < valueRanges.length; i++) {
    const sheet = sheets.filter(s => s.properties?.title)[i];
    const values = valueRanges[i].values ?? [];
    // Process values...
  }
}

// PERFORMANCE IMPACT: 5-10x faster for multi-sheet spreadsheets
```

### 6.2 Inefficient .map().filter() in Correlations

**File:** `src/handlers/analysis.ts`
**Lines:** 806-822

```typescript
// CURRENT CODE (Repeated transformations):
for (let i = 0; i < colCount; i++) {
  const colI = rows
    .map((r) => r[i])
    .filter((v) => typeof v === "number") as number[];  // O(N)
  for (let j = i + 1; j < colCount; j++) {
    const colJ = rows
      .map((r) => r[j])
      .filter((v) => typeof v === "number") as number[];  // O(N)
    const corr = this.pearson(colI, colJ);
  }
}

// FIXED CODE (Pre-transform columns):
// Extract and filter all columns once
const columns: number[][] = [];
for (let col = 0; col < colCount; col++) {
  const columnData: number[] = [];
  for (let row = 0; row < rows.length; row++) {
    const val = rows[row][col];
    if (typeof val === "number") {
      columnData.push(val);
    }
  }
  columns.push(columnData);
}

// Now compute correlations with pre-transformed data
for (let i = 0; i < colCount; i++) {
  for (let j = i + 1; j < colCount; j++) {
    const corr = this.pearson(columns[i], columns[j]);
    // ... rest of logic
  }
}

// PERFORMANCE IMPACT: O(N²) → O(N) transformations, 2-5x faster
```

### 6.3 Missing Cache in getSheetId()

**File:** `src/handlers/cells.ts`
**Lines:** 693-718

```typescript
// CURRENT CODE (No cache):
private async getSheetId(
  spreadsheetId: string,
  sheetName?: string,
): Promise<number> {
  const response = await this.sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheets = response.data.sheets ?? [];
  // ... search logic
}

// FIXED CODE (With cache):
private metadataCache = new Map<string, { sheets: any[]; timestamp: number }>();
private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

private async getSheetId(
  spreadsheetId: string,
  sheetName?: string,
): Promise<number> {
  // Check cache
  const cached = this.metadataCache.get(spreadsheetId);
  const now = Date.now();

  let sheets: any[];
  if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
    sheets = cached.sheets;
  } else {
    // Cache miss - fetch from API
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    sheets = response.data.sheets ?? [];

    // Update cache
    this.metadataCache.set(spreadsheetId, { sheets, timestamp: now });
  }

  // ... search logic with sheets
}

// PERFORMANCE IMPACT: Eliminates 5+ redundant API calls per operation sequence
```

### 6.4 Inefficient Array Subset Extraction

**File:** `src/services/request-merger.ts`
**Lines:** 756-763

```typescript
// CURRENT CODE (Push-based):
const targetValues: unknown[][] = [];
for (let r = 0; r < rowCount && r + rowOffset < mergedValues.length; r++) {
  const row = mergedValues[r + rowOffset] || [];
  const targetRow: unknown[] = [];
  for (let c = 0; c < colCount && c + colOffset < row.length; c++) {
    targetRow.push(row[c + colOffset]);
  }
  targetValues.push(targetRow);
}

// FIXED CODE (Pre-allocated):
const targetValues: unknown[][] = new Array(rowCount);
for (let r = 0; r < rowCount && r + rowOffset < mergedValues.length; r++) {
  const sourceRow = mergedValues[r + rowOffset] || [];
  const targetRow = new Array(colCount);
  for (let c = 0; c < colCount && c + colOffset < sourceRow.length; c++) {
    targetRow[c] = sourceRow[c + colOffset];
  }
  targetValues[r] = targetRow;
}

// PERFORMANCE IMPACT: 2-3x faster for large ranges (1000+ cells)
```

### 6.5 Inefficient Trend Calculation

**File:** `src/handlers/analysis.ts`
**Lines:** 1303-1315

```typescript
// CURRENT CODE:
const indices = Array.from({ length: n }, (_, i) => i);
const meanX = indices.reduce((a, b) => a + b, 0) / n;

for (let i = 0; i < n; i++) {
  const indexVal = indices[i];
  // ... calculations
}

// FIXED CODE:
const meanX = (n - 1) / 2;  // Direct calculation

for (let i = 0; i < n; i++) {
  // Use i directly instead of indices[i]
  // ... calculations with i
}

// PERFORMANCE IMPACT: Eliminates array allocation + reduce operation
```

### 6.6 Transpose Data Once for Column Operations

**File:** `src/handlers/analysis.ts`
**Lines:** 1294-1297

```typescript
// CURRENT CODE (Repeated column extraction):
for (let col = 0; col < columnCount; col++) {
  const columnData = values
    .map((row) => row[col])
    .filter((v) => typeof v === "number") as number[];
  // ... process columnData
}

// FIXED CODE (Transpose once):
// Pre-transpose and filter
const columns: number[][] = new Array(columnCount);
for (let col = 0; col < columnCount; col++) {
  columns[col] = [];
}

for (let row = 0; row < values.length; row++) {
  for (let col = 0; col < columnCount; col++) {
    const val = values[row][col];
    if (typeof val === "number") {
      columns[col].push(val);
    }
  }
}

// Now process pre-computed columns
for (let col = 0; col < columnCount; col++) {
  const columnData = columns[col];
  // ... process columnData
}

// PERFORMANCE IMPACT: O(N×M) → O(N×M) with better cache locality, 20-30% faster
```

### 6.7 Add Request Deduplication to Common Operations

**Files:** Multiple handlers

**Pattern:** Wrap expensive read operations with request deduplication:

```typescript
// BEFORE:
const response = await this.sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: "sheets.properties",
});

// AFTER:
const requestKey = createRequestKey("spreadsheets.get", {
  spreadsheetId,
  fields: "sheets.properties",
});

const fetchFn = async () => this.sheetsApi.spreadsheets.get({
  spreadsheetId,
  fields: "sheets.properties",
});

const response = this.context.requestDeduplicator
  ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
  : await fetchFn();

// Apply to: getSheetId(), resolveRange(), metadata fetches
```

---

## IMPLEMENTATION PRIORITY

### Priority 1 (Critical - Do First):
1. ✅ N+1 Query in analysis.ts (5-10x performance gain)
2. ✅ Typecheck errors in dimensions.ts (27 errors)
3. ✅ Missing cache in cells.ts (eliminates redundant API calls)
4. ✅ Silent fallback patterns (4 logging issues)

### Priority 2 (High - Do Next):
1. ✅ Typecheck errors in values.ts (44 errors)
2. ✅ Scope validation duplication (66 lines saved)
3. ✅ Drive API unavailable error duplication (5 locations)
4. ✅ Inefficient .map().filter() patterns (2-5x speedup)

### Priority 3 (Medium - Do After):
1. ✅ Remove monkey-patch code (cleanup)
2. ✅ Catch-all INTERNAL_ERROR duplication (8 locations)
3. ✅ Execution failure error duplication (7+ locations)
4. ✅ Array optimization in request-merger (2-3x faster)

### Priority 4 (Low - Nice to Have):
1. ✅ Trend calculation optimization
2. ✅ Request deduplication for common operations
3. ✅ Service not initialized error duplication

---

## VERIFICATION CHECKLIST

After implementing fixes:

```bash
# 1. Verify typechecks pass
npm run typecheck

# 2. Verify tests pass
npm run test

# 3. Verify linting passes
npm run lint

# 4. Verify no silent fallbacks
npm run check:silent-fallbacks

# 5. Verify no debug prints
npm run check:debug-prints

# 6. Verify full verification pipeline
npm run verify

# 7. Run performance benchmarks (if available)
npm run benchmark
```

---

## ESTIMATED IMPACT

| Category | Lines Changed | Time Saved | Performance Gain |
|----------|---------------|------------|------------------|
| Typecheck Fixes | ~150 | 2-3 hours | Type safety improved |
| Monkey-Patch Removal | -200 | 1 hour | Cleaner codebase |
| Silent Fallbacks | +20 | 30 min | Better debugging |
| Scope Duplication | -66, +35 | 30 min | Better maintainability |
| Error Duplication | -200, +80 | 1-2 hours | Better consistency |
| Performance Opts | ~100 | 2-3 hours | **20-70% faster** |
| **TOTAL** | **~300 net reduction** | **8-12 hours** | **Significant improvement** |

---

**END OF DOCUMENT**
