# P0 Requirements Implementation Guide

**Status**: Phase 1 Complete (Proof of Concept)
**Reference Implementation**: `values.ts` + handler
**Remaining Work**: 14 schemas, registration cleanup, tests, reliability guarantees

---

## A) Exact Diffs - Reference Implementation

### 1. Schema File (`src/schemas/values.ts`)

**DIFF**: Root discriminated union → Top-level z.object()

```diff
--- OLD
+++ NEW
@@ -1,5 +1,8 @@
 /**
  * Tool 3: sheets_values
  * Cell value operations (read/write)
+ *
+ * SCHEMA PATTERN: Top-level z.object() with union inside 'request' property
+ * This pattern is durable across MCP SDK upgrades - no custom patching needed.
  */

 import { z } from 'zod';
@@ -19,11 +22,13 @@
   spreadsheetId: SpreadsheetIdSchema,
 });

-export const SheetsValuesInputSchema = z.discriminatedUnion('action', [
+// Action union (nested inside top-level object)
+const ValuesActionSchema = z.discriminatedUnion('action', [
   // READ
   BaseSchema.extend({
     action: z.literal('read'),
     range: RangeInputSchema,
+    // ... (same as before)
   }),

   // WRITE (idempotent - set exact values)
@@ -31,6 +36,7 @@
     action: z.literal('write'),
     range: RangeInputSchema,
     values: ValuesArraySchema,
+    // ... (same as before)
   }),

   // ... all other actions (same structure)
 ]);

-export const SheetsValuesOutputSchema = z.discriminatedUnion('success', [
+// TOP-LEVEL INPUT SCHEMA (z.object with union inside)
+// This pattern works natively with MCP SDK - no custom transformation needed
+export const SheetsValuesInputSchema = z.object({
+  request: ValuesActionSchema,
+});
+
+// Output response union
+const ValuesResponseSchema = z.discriminatedUnion('success', [
   z.object({
     success: z.literal(true),
     action: z.string(),
+    // ... (same as before)
   }),
   z.object({
     success: z.literal(false),
@@ -110,6 +145,13 @@
   }),
 ]);

+// TOP-LEVEL OUTPUT SCHEMA (z.object with union inside)
+export const SheetsValuesOutputSchema = z.object({
+  response: ValuesResponseSchema,
+});
+
 export type SheetsValuesInput = z.infer<typeof SheetsValuesInputSchema>;
 export type SheetsValuesOutput = z.infer<typeof SheetsValuesOutputSchema>;
+
+// Type aliases for handler use
+export type ValuesAction = z.infer<typeof ValuesActionSchema>;
+export type ValuesResponse = z.infer<typeof ValuesResponseSchema>;
```

**Key Changes**:
1. Renamed export to intermediate const (`ValuesActionSchema`)
2. Wrapped in `z.object({ request: ... })`
3. Same for output: `ValuesResponseSchema` → wrapped in `z.object({ response: ... })`
4. Exported `ValuesAction` and `ValuesResponse` types for handlers

---

### 2. Handler File (`src/handlers/values.ts`)

**DIFF**: Direct access → Unwrap/wrap envelope

```diff
--- OLD
+++ NEW
@@ -11,6 +11,8 @@
 import type {
   SheetsValuesInput,
   SheetsValuesOutput,
+  ValuesAction,
+  ValuesResponse,
   ValuesArray,
 } from '../schemas/index.js';

@@ -25,18 +27,29 @@

   async handle(input: SheetsValuesInput): Promise<SheetsValuesOutput> {
     try {
-      switch (input.action) {
+      // Unwrap request from top-level envelope
+      const req = input.request;
+
+      let response: ValuesResponse;
+      switch (req.action) {
         case 'read':
-          return await this.handleRead(input);
+          response = await this.handleRead(req);
+          break;
         case 'write':
-          return await this.handleWrite(input);
+          response = await this.handleWrite(req);
+          break;
+        // ... (same pattern for all actions)
         default:
-          return this.error({
+          response = this.error({
             code: 'INVALID_PARAMS',
-            message: `Unknown action: ${(input as { action: string }).action}`,
+            message: `Unknown action: ${(req as { action: string }).action}`,
             retryable: false,
           });
       }
+
+      // Wrap response in envelope
+      return { response };
     } catch (err) {
-      return this.mapError(err);
+      return { response: this.mapError(err) };
     }
   }

   protected createIntents(input: SheetsValuesInput): Intent[] {
+    const req = input.request;
     const baseIntent = {
       target: {
-        spreadsheetId: input.spreadsheetId,
+        spreadsheetId: req.spreadsheetId,
       },
       metadata: {
         sourceTool: this.toolName,
-        sourceAction: input.action,
+        sourceAction: req.action,
         priority: 1,
         destructive: false,
       },
     };

-    switch (input.action) {
+    switch (req.action) {
       case 'write':
         return [{
           ...baseIntent,
           type: 'SET_VALUES' as const,
-          payload: { values: input.values },
+          payload: { values: req.values },
           metadata: {
             ...baseIntent.metadata,
-            estimatedCells: input.values.reduce((sum, row) => sum + row.length, 0),
+            estimatedCells: req.values.reduce((sum, row) => sum + row.length, 0),
           },
         }];
       // ... (same pattern for other actions)
@@ -107,8 +126,8 @@
   }

   private async handleRead(
-    input: Extract<SheetsValuesInput, { action: 'read' }>
-  ): Promise<SheetsValuesOutput> {
+    input: Extract<ValuesAction, { action: 'read' }>
+  ): Promise<ValuesResponse> {
     const range = await this.resolveRange(input.spreadsheetId, input.range);
     // ... rest of method unchanged
   }

   // Apply same pattern to ALL private handler methods:
   // - Change input type from SheetsValuesInput to ValuesAction
   // - Change return type from SheetsValuesOutput to ValuesResponse
```

**Key Changes**:
1. Import `ValuesAction` and `ValuesResponse` types
2. `handle()`: Unwrap `input.request`, dispatch, wrap `response`
3. `createIntents()`: Unwrap `req = input.request` at start
4. Private methods: Use `ValuesAction` extract, return `ValuesResponse`

---

## B) Pattern Application - Remaining 14 Schemas

### Quick Reference Table

| Schema File | Handler File | Actions | Complexity |
|------------|-------------|---------|-----------|
| ✅ values.ts | ✅ values.ts | 9 | High (reference) |
| spreadsheet.ts | spreadsheet.ts | 6 | Medium |
| sheet.ts | sheet.ts | 7 | Medium |
| cells.ts | cells.ts | 5 | Medium |
| format.ts | format.ts | 8 | High |
| dimensions.ts | dimensions.ts | 6 | Medium |
| rules.ts | rules.ts | 5 | Medium |
| charts.ts | charts.ts | 6 | Medium |
| pivot.ts | pivot.ts | 5 | Medium |
| filter-sort.ts | filter-sort.ts | 6 | Medium |
| sharing.ts | sharing.ts | 5 | Low |
| comments.ts | comments.ts | 5 | Low |
| versions.ts | versions.ts | 4 | Low |
| analysis.ts | analysis.ts | 6 | Medium |
| advanced.ts | advanced.ts | 8 | High |

### Systematic Approach

**For Each Schema**:

1. **Schema File** (5 minutes per file):
   ```bash
   # 1. Rename discriminated union
   const XActionSchema = z.discriminatedUnion('action', [...]);  // Remove export

   # 2. Wrap input
   export const SheetsXInputSchema = z.object({
     request: XActionSchema,
   });

   # 3. Wrap output
   const XResponseSchema = z.discriminatedUnion('success', [...]);
   export const SheetsXOutputSchema = z.object({
     response: XResponseSchema,
   });

   # 4. Export types
   export type XAction = z.infer<typeof XActionSchema>;
   export type XResponse = z.infer<typeof XResponseSchema>;
   ```

2. **Handler File** (10 minutes per file):
   ```bash
   # 1. Update imports
   import type { ..., XAction, XResponse } from '../schemas/index.js';

   # 2. Update handle()
   async handle(input: SheetsXInput): Promise<SheetsXOutput> {
     const req = input.request;
     let response: XResponse;
     // switch on req.action, call handlers with req
     return { response };
   }

   # 3. Update createIntents()
   protected createIntents(input: SheetsXInput): Intent[] {
     const req = input.request;
     // use req.action, req.spreadsheetId, etc.
   }

   # 4. Update private methods
   private async handleRead(input: Extract<XAction, { action: 'read' }>): Promise<XResponse> {
     // ...
   }
   ```

3. **Build Test** (1 minute):
   ```bash
   npm run build
   ```

**Estimated Time**: 14 schemas × 16 minutes = ~3.5 hours

---

## C) Tools/List Integration Test

**File**: `tests/integration/tools-list-validation.test.ts` (NEW)

```typescript
/**
 * MCP Tools/List Integration Test
 *
 * P0 REQUIREMENT: Verify every tool has non-empty schema
 * Fails CI if SDK ever regresses to empty schemas
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';

describe('tools/list Schema Validation', () => {
  it('must return non-empty schemas for all 15 tools', async () => {
    // Spawn MCP server
    const server = spawn('node', ['dist/cli.js']);

    // Send tools/list request
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    }) + '\n';

    server.stdin.write(request);
    server.stdin.end();

    // Collect response
    const response = await new Promise<string>((resolve, reject) => {
      let data = '';
      server.stdout.on('data', chunk => data += chunk.toString());
      server.stdout.on('end', () => resolve(data));
      server.on('error', reject);
      setTimeout(() => {
        server.kill();
        reject(new Error('Timeout'));
      }, 10000);
    });

    // Parse response
    const parsed = JSON.parse(response.trim().split('\n')[0]);
    expect(parsed.result.tools).toHaveLength(15);

    // CRITICAL CHECKS
    for (const tool of parsed.result.tools) {
      // 1. Schema must exist
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');

      // 2. Schema must NOT be empty
      expect(tool.inputSchema.properties).toBeDefined();
      const propCount = Object.keys(tool.inputSchema.properties).length;
      expect(propCount).toBeGreaterThan(0);

      // 3. Request property must exist (new pattern)
      expect(tool.inputSchema.properties.request).toBeDefined();

      // 4. Request must have oneOf or properties
      const requestSchema = tool.inputSchema.properties.request;
      const hasOneOf = Array.isArray(requestSchema.oneOf) && requestSchema.oneOf.length > 0;
      const hasProperties = requestSchema.properties && Object.keys(requestSchema.properties).length > 0;
      expect(hasOneOf || hasProperties).toBe(true);

      // 5. Must NOT be legacy empty schema
      const isEmptySchema = propCount === 0 ||
        JSON.stringify(tool.inputSchema) === '{"type":"object","properties":{}}';
      expect(isEmptySchema).toBe(false);
    }

    server.kill();
  }, 15000);

  it('must include discriminator information in oneOf schemas', async () => {
    const server = spawn('node', ['dist/cli.js']);
    const request = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n';

    server.stdin.write(request);
    server.stdin.end();

    const response = await new Promise<string>((resolve, reject) => {
      let data = '';
      server.stdout.on('data', chunk => data += chunk);
      server.stdout.on('end', () => resolve(data));
      setTimeout(() => { server.kill(); reject(new Error('Timeout')); }, 10000);
    });

    const parsed = JSON.parse(response.trim().split('\n')[0]);

    for (const tool of parsed.result.tools) {
      const requestSchema = tool.inputSchema.properties.request;

      if (requestSchema.oneOf) {
        // Verify each oneOf variant has proper structure
        for (const variant of requestSchema.oneOf) {
          expect(variant.type).toBe('object');
          expect(variant.properties).toBeDefined();
          expect(variant.properties.action).toBeDefined();
        }
      }
    }

    server.kill();
  }, 15000);
});
```

**Add to CI**:
```json
// package.json
{
  "scripts": {
    "test:tools-list": "vitest tests/integration/tools-list-validation.test.ts",
    "ci": "npm run build && npm run test:tools-list && npm test"
  }
}
```

---

## D) Registration Cleanup - Remove Custom Patching

### Step 1: Delete sdk-patch.ts

```bash
rm src/utils/sdk-patch.ts
```

**Removes**:
- `isDiscriminatedUnion()` - no longer needed
- `zodToJsonSchemaCompat()` - no longer needed
- `discriminatedUnionToJsonSchema()` - no longer needed
- `verifyJsonSchema()` - no longer needed
- 252 lines of workaround code

### Step 2: Update registration.ts

**File**: `src/mcp/registration.ts`

```diff
--- OLD
+++ NEW
@@ -10,7 +10,6 @@
 import type { Handlers } from '../handlers/index.js';
 import type { GoogleApiClient } from '../services/google-api.js';
 import { createRequestContext, runWithRequestContext } from '../utils/request-context.js';
-import { zodToJsonSchemaCompat, isDiscriminatedUnion, verifyJsonSchema } from '../utils/sdk-patch.js';
 import {
   SheetSpreadsheetInputSchema, SheetsSpreadsheetOutputSchema, SHEETS_SPREADSHEET_ANNOTATIONS,
   SheetsSheetInputSchema, SheetsSheetOutputSchema, SHEETS_SHEET_ANNOTATIONS,
@@ -210,26 +209,11 @@
   const handlerMap = handlers ? createToolHandlerMap(handlers) : null;

   for (const tool of TOOL_DEFINITIONS) {
-    // WORKAROUND: MCP SDK v1.25.1 doesn't handle discriminated unions in tools/list
-    // Convert to JSON Schema to ensure proper serialization
-    const inputSchemaForRegistration = isDiscriminatedUnion(tool.inputSchema)
-      ? (zodToJsonSchemaCompat(tool.inputSchema) as unknown as AnySchema)
-      : tool.inputSchema;
-
-    const outputSchemaForRegistration = isDiscriminatedUnion(tool.outputSchema)
-      ? (zodToJsonSchemaCompat(tool.outputSchema) as unknown as AnySchema)
-      : tool.outputSchema;
-
-    // SAFETY CHECK: Verify schemas are properly transformed JSON Schema objects (not Zod objects)
-    // This prevents "v3Schema.safeParseAsync is not a function" errors
-    // Only run in development to avoid performance overhead in production
-    if (process.env['NODE_ENV'] !== 'production') {
-      verifyJsonSchema(inputSchemaForRegistration);
-      verifyJsonSchema(outputSchemaForRegistration);
-    }
-
-    // Register tool with transformed schemas
-    // Note: Using type assertion to avoid TypeScript's "excessively deep type instantiation" error
+    // Register tool with native Zod schemas
+    // No transformation needed - schemas are top-level z.object() with nested unions
+    // MCP SDK handles this natively
+
+    // Type assertion avoids TypeScript's "excessively deep type instantiation" error
     // The schemas are correctly transformed at runtime, but TS can't infer the complex union types
     // after JSON Schema conversion. This is safe because:
     // 1. inputSchemaForRegistration and outputSchemaForRegistration are already validated
@@ -243,8 +227,8 @@
       {
         title: tool.annotations.title,
         description: tool.description,
-        inputSchema: inputSchemaForRegistration,
-        outputSchema: outputSchemaForRegistration,
+        inputSchema: tool.inputSchema,
+        outputSchema: tool.outputSchema,
         annotations: tool.annotations,
       },
       async (args: Record<string, unknown>, extra?: { requestId?: string | number }) => {
```

**Key Changes**:
1. Remove imports of custom schema utilities
2. Remove transformation logic (lines 212-228 in old code)
3. Remove verifyJsonSchema() safety checks
4. Pass schemas directly: `tool.inputSchema`, `tool.outputSchema`

### Step 3: Update server.ts

**File**: `src/server.ts`

```diff
--- OLD
+++ NEW
@@ -25,7 +25,6 @@
 import { createHandlers, type HandlerContext, type Handlers } from './handlers/index.js';
 import { logger as baseLogger } from './utils/logger.js';
 import { createRequestContext, runWithRequestContext } from './utils/request-context.js';
-import { zodToJsonSchemaCompat, isDiscriminatedUnion, verifyJsonSchema } from './utils/sdk-patch.js';
 import {
   TOOL_DEFINITIONS,
   createToolHandlerMap,
@@ -117,22 +116,7 @@
   private registerTools(): void {
     for (const tool of TOOL_DEFINITIONS) {
-      // WORKAROUND: MCP SDK v1.25.1 doesn't handle discriminated unions in tools/list
-      // Convert to JSON Schema to ensure proper serialization
-      const inputSchemaForRegistration = isDiscriminatedUnion(tool.inputSchema)
-        ? (zodToJsonSchemaCompat(tool.inputSchema) as unknown as AnySchema)
-        : tool.inputSchema;
-
-      const outputSchemaForRegistration = isDiscriminatedUnion(tool.outputSchema)
-        ? (zodToJsonSchemaCompat(tool.outputSchema) as unknown as AnySchema)
-        : tool.outputSchema;
-
-      // SAFETY CHECK: Verify schemas are properly transformed JSON Schema objects (not Zod objects)
-      // This prevents "v3Schema.safeParseAsync is not a function" errors
-      // Only run in development to avoid performance overhead in production
-      if (process.env['NODE_ENV'] !== 'production') {
-        verifyJsonSchema(inputSchemaForRegistration);
-        verifyJsonSchema(outputSchemaForRegistration);
-      }
-
-      // Register tool with transformed schemas
+      // Register tool with native Zod schemas
       // Note: Using type assertion to avoid TypeScript's "excessively deep type instantiation" error
       // See registration.ts for detailed explanation
       (this.server.registerTool as (
@@ -141,8 +125,8 @@
           title?: string;
           description?: string;
-          inputSchema?: unknown;
-          outputSchema?: unknown;
+          inputSchema?: AnySchema;
+          outputSchema?: AnySchema;
           annotations?: import('@modelcontextprotocol/sdk/types.js').ToolAnnotations;
         },
         cb: (args: Record<string, unknown>) => Promise<CallToolResult>
@@ -151,8 +135,8 @@
         {
           title: tool.annotations.title,
           description: tool.description,
-          inputSchema: inputSchemaForRegistration,
-          outputSchema: outputSchemaForRegistration,
+          inputSchema: tool.inputSchema,
+          outputSchema: tool.outputSchema,
           annotations: tool.annotations,
         },
         async (args: Record<string, unknown>) => {
```

---

## E) Reliability Guarantees

### E1: Per-Tool Timeout Wrapper

**File**: `src/utils/reliability.ts` (NEW)

```typescript
/**
 * Reliability Utilities
 *
 * P0 Requirements:
 * - Per-tool timeout wrapper
 * - Concurrency limiter
 * - Token refresh mutex
 */

import PQueue from 'p-queue';

/**
 * Timeout error for tool execution
 */
export class ToolTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool ${toolName} timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
  }
}

/**
 * Wrap handler with timeout
 *
 * @param handler - Handler function to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param toolName - Tool name for error messages
 * @returns Wrapped handler with timeout
 */
export function withTimeout<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  timeoutMs: number,
  toolName: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new ToolTimeoutError(toolName, timeoutMs)), timeoutMs);
    });

    return Promise.race([
      handler(...args),
      timeoutPromise,
    ]);
  }) as T;
}

/**
 * Global concurrency limiter
 *
 * Limits concurrent tool executions to prevent overwhelming Google API
 */
export const toolQueue = new PQueue({
  concurrency: 10,  // Max 10 concurrent tool executions
  timeout: 30000,   // 30s per tool
});

/**
 * Token refresh mutex
 *
 * Ensures only one token refresh happens at a time per user/session
 */
class TokenRefreshMutex {
  private locks = new Map<string, Promise<void>>();

  /**
   * Acquire lock for token refresh
   *
   * @param key - User/session identifier
   * @param refreshFn - Token refresh function
   * @returns Promise resolving when refresh completes
   */
  async withLock<T>(key: string, refreshFn: () => Promise<T>): Promise<T> {
    // Wait for existing refresh if in progress
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create new lock
    let resolveLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      // Execute refresh
      return await refreshFn();
    } finally {
      // Release lock
      this.locks.delete(key);
      resolveLock!();
    }
  }
}

export const tokenRefreshMutex = new TokenRefreshMutex();
```

### E2: Apply Timeout Wrapper

**File**: `src/handlers/base.ts`

```diff
--- OLD
+++ NEW
@@ -1,6 +1,7 @@
 import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
 import type { Intent } from '../core/intent.js';
 import { logger } from '../utils/logger.js';
+import { withTimeout } from '../utils/reliability.js';

 export interface HandlerContext {
   batchCompiler: BatchCompiler;
@@ -20,6 +21,15 @@
     this.toolName = toolName;
   }

+  /**
+   * Handle with timeout wrapper (30s default)
+   */
+  async handleSafe(input: TInput): Promise<TOutput> {
+    const handler = withTimeout(this.handle.bind(this), 30000, this.toolName);
+    return handler(input);
+  }
+
   /**
    * Main handler method (override in subclasses)
    */
```

### E3: Apply Concurrency Limiter

**File**: `src/mcp/registration.ts`

```diff
--- OLD
+++ NEW
@@ -10,6 +10,7 @@
 import type { Handlers } from '../handlers/index.js';
 import type { GoogleApiClient } from '../services/google-api.js';
 import { createRequestContext, runWithRequestContext } from '../utils/request-context.js';
+import { toolQueue } from '../utils/reliability.js';
 import {
   SheetSpreadsheetInputSchema, SheetsSpreadsheetOutputSchema, SHEETS_SPREADSHEET_ANNOTATIONS,
   // ...
@@ -245,7 +246,11 @@
       async (args: Record<string, unknown>, extra?: { requestId?: string | number }) => {
         const requestId = extra?.requestId ? String(extra.requestId) : undefined;
         const requestContext = createRequestContext({ requestId });
-        return runWithRequestContext(requestContext, async () => {
+
+        // Queue execution with concurrency limit
+        return toolQueue.add(async () => {
+          return runWithRequestContext(requestContext, async () => {
+
           if (!handlerMap) {
             return buildToolResponse({
               success: false,
@@ -270,6 +275,7 @@
           const result = await handler(args);
           return buildToolResponse(result);
         });
+        });
       }
     );
   }
```

### E4: Apply Token Refresh Mutex

**File**: `src/services/google-api.ts`

```diff
--- OLD
+++ NEW
@@ -1,5 +1,6 @@
 import { google, type Auth } from 'googleapis';
 import type { sheets_v4 } from 'googleapis';
+import { tokenRefreshMutex } from '../utils/reliability.js';

 export interface GoogleApiClientOptions {
   auth: Auth.OAuth2Client;
@@ -30,8 +31,18 @@
    * Refresh access token if needed
    */
   async refreshTokenIfNeeded(): Promise<void> {
-    // Check if token is expired
-    const credentials = await this.auth.getAccessToken();
+    const userId = this.getUserId();  // Implement based on your auth system
+
+    return tokenRefreshMutex.withLock(userId, async () => {
+      // Double-check token still needs refresh (may have been refreshed by concurrent request)
+      const needsRefresh = await this.checkTokenExpired();
+      if (!needsRefresh) {
+        return;
+      }
+
+      // Perform refresh
+      const credentials = await this.auth.getAccessToken();
+      // ... rest of refresh logic
+    });
   }
 }
```

---

## F) Verification Commands

### Build and Test
```bash
# 1. Clean build
npm run clean
npm run build

# 2. Run all tests
npm test

# 3. Run tools/list integration test
npm run test:tools-list

# 4. Verify schema structure
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  node dist/cli.js 2>/dev/null | \
  jq '.result.tools[0].inputSchema'

# Expected output:
# {
#   "type": "object",
#   "properties": {
#     "request": {
#       "oneOf": [...]
#     }
#   },
#   "required": ["request"]
# }
```

### Performance Check
```bash
# Startup time (should be faster without transformation)
time node dist/cli.js --help

# Memory usage (should be lower)
node --expose-gc dist/cli.js &
PID=$!
ps -o rss= -p $PID
kill $PID
```

---

## Summary

**Phase 1 Complete** ✅:
- Reference implementation: `values.ts` + handler
- Pattern documented: `DURABLE_SCHEMA_PATTERN.md`
- Diffs provided for replication

**Phase 2 Remaining** ⏳:
- 14 schemas to migrate (~3.5 hours)
- Registration cleanup (~30 minutes)
- Integration test (~30 minutes)
- Reliability guarantees (~1 hour)

**Total Remaining**: ~5.5 hours of systematic work

**Rollout Order**:
1. Migrate remaining 14 schemas (parallel work possible)
2. Delete `sdk-patch.ts` and update registration
3. Add tools/list integration test
4. Add reliability utilities
5. Full test suite verification

**Success Criteria** ✅:
- All 15 tools return non-empty schemas in tools/list
- No custom schema transformation code
- Per-tool timeouts, concurrency limits, token refresh mutex
- CI fails if empty schemas detected
