# ServalSheets TODO List
*Generated: 2026-01-07 (Updated with comprehensive audit findings)*

## 🔥 IN PROGRESS

None - Ready to start!

---

## 🔴 PHASE 0: CRITICAL RUNTIME BREAKAGES (DO NOW!)

### Task 0.1: Wire Sampling/Elicitation Capabilities ⚠️ BLOCKING
**Priority**: P0 | **Effort**: 4h | **Status**: ⬜ Not Started
**Finding**: #1 HIGH - Sampling/elicitation advertised but not wired
**Verified**: ⚠️ CORRECTED - See docs/development/TODO_VERIFICATION_REPORT.md

```
Issue: sheets_confirm/sheets_analyze return ELICITATION_UNAVAILABLE/SAMPLING_UNAVAILABLE
Evidence: server.json:13-14 advertises, confirm.ts:89 checks extra.elicit (doesn't exist!),
          SDK provides server.elicitInput() and server.createMessage() on Server class, NOT in extra
Files: src/handlers/confirm.ts, src/handlers/analyze.ts, src/server.ts
```

**⚠️ IMPORTANT**: MCP SDK 1.25.1 does NOT provide `extra.elicit` or `extra.sample` methods.
- RequestHandlerExtra only includes: signal, requestId, sendRequest, sendNotification
- Elicitation/sampling are methods on the Server class: `server.elicitInput()` and `server.createMessage()`
- See node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js:342-382

**Minimal Fix** (choose one path):
- [ ] **Option A: Remove capabilities until ready**
  - [ ] Remove `elicitation` from server.json:13
  - [ ] Remove `sampling` from server.json:14
  - [ ] Remove from well-known.ts
  - [ ] Hide sheets_confirm/sheets_analyze from tool registry
  - [ ] Test: Verify tools don't appear in tools/list
  - [ ] Commit changes

- [ ] **Option B: Implement capabilities correctly (recommended)**
  - [ ] Update server.ts to pass Server instance into handler context (not just extra)
  - [ ] Update HandlerContext type to include server: Server
  - [ ] Update confirm.ts:89 to check `server.getClientCapabilities()?.elicitation`
  - [ ] Replace `extra.elicit()` calls with `server.elicitInput({ mode: 'form', message, requestedSchema })`
  - [ ] Update analyze.ts:125 to check `server.getClientCapabilities()?.sampling`
  - [ ] Replace `extra.sample()` calls with `server.createMessage({ messages, ... })`
  - [ ] Test: sheets_confirm with elicitation
  - [ ] Test: sheets_analyze with sampling
  - [ ] Verify no UNAVAILABLE errors
  - [ ] Commit changes

**Correct Implementation Pattern** (verified against SDK):
```typescript
// In server.ts - pass Server instance to handlers
return this.handleToolCall(tool.name, args, {
  ...extra,
  server: this.server  // Add this!
});

// In handlers - use Server methods directly
if (!context.server) {
  return { error: 'SERVER_NOT_AVAILABLE' };
}
if (!context.server.getClientCapabilities()?.elicitation) {
  return { error: 'ELICITATION_UNAVAILABLE' };
}
const result = await context.server.elicitInput({
  mode: 'form',
  message: 'Confirm changes?',
  requestedSchema: confirmSchema
});
```

---

### Task 0.2: Fix Task Cancellation ⚠️ BLOCKING
**Priority**: P0 | **Effort**: 3h | **Status**: ⬜ Not Started
**Finding**: #2 HIGH - SEP-1686 cancel is ineffective

```
Issue: tasks/cancel does not stop execution or set cancellation flags
Evidence: protocol.js:136 calls updateTaskStatus, task-store-adapter.ts:99 only delegates,
          server.ts:719 registerTaskCancelHandler is no-op
Files: src/services/task-store-adapter.ts, src/services/task-store.ts, src/server.ts
```

**Minimal Fix**:
- [ ] Read task-store-adapter.ts:99 (updateTaskStatus method)
- [ ] Read task-store.ts:290 (cancelTask method)
- [ ] In TaskStoreAdapter.updateTaskStatus, detect status === 'cancelled'
- [ ] Call this.cancelTask(taskId) when cancelled
- [ ] Verify cancelledTasks Set is populated
- [ ] Read server.ts:337 (isTaskCancelled check)
- [ ] Test: Create task, cancel it, verify execution stops
- [ ] Test: Verify isTaskCancelled returns true
- [ ] Commit changes

**Best Fix** (if SDK supports it):
- [ ] Wire explicit cancel handler (if SDK supports it)
- [ ] Propagate extra.signal into handler execution
- [ ] Add AbortController support to handlers
- [ ] Test immediate abort on cancel

---

### Task 0.3: Initialize Services for HTTP/Remote Transports ⚠️ BLOCKING
**Priority**: P0 | **Effort**: 3h | **Status**: ⬜ Not Started
**Finding**: #3 HIGH - HTTP/remote missing service initialization

```
Issue: sheets_transaction/conflict/impact/validation fail in HTTP/remote sessions
Evidence: server.ts:185-188 initializes services for stdio only,
          transaction.ts:25 calls getTransactionManager which throws if not initialized
Files: src/server/http-server.ts, src/server/remote-server.ts
```

**Minimal Fix**:
- [ ] Read server.ts:185-188 (service initialization for stdio)
- [ ] Read http-server.ts:139 (tool registration)
- [ ] Read remote-server.ts:363 (tool registration)
- [ ] In http-server.ts, after creating googleClient:
  - [ ] Call initTransactionManager(googleClient)
  - [ ] Call initConflictDetector(googleClient)
  - [ ] Call initImpactAnalyzer(googleClient)
  - [ ] Call initValidationEngine(googleClient)
- [ ] Repeat for remote-server.ts
- [ ] Test: HTTP session with sheets_transaction
- [ ] Test: HTTP session with sheets_validation
- [ ] Verify no "not initialized" errors
- [ ] Commit changes

**Best Fix**:
- [ ] Extract shared bootstrap function
- [ ] Call from both stdio and HTTP/remote
- [ ] Ensure complete parity

---

### Task 0.4: Fix server.json Schema Validation ⚠️ BLOCKING
**Priority**: P0 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #4 HIGH - server.json fails validation

```
Issue: npm run validate:server-json fails, package metadata not registry-compliant
Evidence: validate-server-json.mjs:70-71 requires packages/tools arrays,
          validate-server-json.mjs:73 requires name match package.json.mcpName,
          server.json:2 uses "servalsheets", missing arrays
Files: server.json, scripts/generate-metadata.ts
```

**Minimal Fix**:
- [ ] Read package.json:34 (mcpName field)
- [ ] Edit server.json:2 to match mcpName exactly
- [ ] Add `"packages": []` to server.json
- [ ] Add `"tools": []` to server.json
- [ ] Run: npm run validate:server-json
- [ ] Verify validation passes
- [ ] Commit changes

**Best Fix**:
- [ ] Read generate-metadata.ts
- [ ] Make it emit schema-valid server.json
- [ ] Populate packages/tools arrays from registry
- [ ] Use pkg.mcpName for name field
- [ ] Run generator and verify output
- [ ] Commit changes

---

### Task 0.5: Fix stdout Logging in stdio Mode ⚠️ BLOCKING
**Priority**: P0 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #15 MED - stdout logging corrupts stdio protocol stream

```
Issue: Any stdout output in stdio mode breaks MCP framing
Evidence: oauth-callback-server.ts:158 uses console.log,
          transaction-manager.ts:715, conflict-detector.ts:700, etc. have verbose logs
Files: src/utils/oauth-callback-server.ts, src/services/*.ts
```

**Minimal Fix**:
- [ ] Search for all console.log/console.warn/console.error in src/
- [ ] Replace with logger.info/logger.warn/logger.error (goes to stderr)
- [ ] Add transport detection to logger
- [ ] Guard verbose logs behind process.env.STDIO_MODE !== 'true'
- [ ] Test: Run in stdio mode, verify clean output
- [ ] Test: Pipe stdout to file, verify only MCP JSON
- [ ] Commit changes

**Best Fix**:
- [ ] Centralize logging with transport-aware sinks
- [ ] Add test for clean stdio output
- [ ] Add CI check to prevent stdout usage

---

## 🟡 PHASE 1: MCP PROTOCOL COMPLIANCE (Week 1)

### Task 1.1: Forward Complete MCP Context
**Priority**: P1 | **Effort**: 3h | **Status**: ⬜ Not Started
**Finding**: #6 MED - MCP call context forwarding incomplete

```
Issue: requestId/signal/sendNotification don't flow correctly
Evidence: server.ts:283 limits extra to sendNotification/progressToken/elicit/sample,
          protocol.d.ts:173 includes signal/requestId/sendRequest
Files: src/server.ts, src/mcp/registration.ts
```

**Checklist**:
- [ ] Read server.ts:283 (stdio tool registration)
- [ ] Read registration.ts:862 (HTTP/remote registration)
- [ ] Update server.ts:283 to forward full `extra` object
- [ ] Add requestId from extra.requestId || extra.requestInfo?._meta?.requestId
- [ ] Add abortSignal from extra.signal
- [ ] Preserve sendNotification, progressToken, elicit, sample
- [ ] Update registration.ts:586 to build full request context
- [ ] Test: Verify requestId flows through
- [ ] Test: Verify signal propagates for cancellation
- [ ] Test: Verify progress notifications work
- [ ] Commit changes

**Diff Snippet**:
```typescript
// server.ts
-        async (args: Record<string, unknown>, extra) => {
-          const progressToken = extra.requestInfo?._meta?.progressToken;
-          return this.handleToolCall(tool.name, args, {
-            sendNotification: extra.sendNotification,
-            progressToken,
-            elicit: extra.elicit,
-            sample: extra.sample,
-          });
-        }
+        async (args: Record<string, unknown>, extra) => {
+          const progressToken = extra.requestInfo?._meta?.progressToken ?? extra._meta?.progressToken;
+          return this.handleToolCall(tool.name, args, {
+            ...extra,
+            sendNotification: extra.sendNotification,
+            progressToken,
+            abortSignal: extra.signal ?? undefined,
+          });
+        }
```

---

### Task 1.2: Return MCP Tool Errors, Not Protocol Errors
**Priority**: P1 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #7 MED - HTTP/remote tools throw protocol errors

```
Issue: MCP clients receive protocol-level errors instead of structured tool failures
Evidence: registration.ts:717 throws error instead of returning CallToolResult with isError
Files: src/mcp/registration.ts
```

**Checklist**:
- [ ] Read registration.ts:717 (createToolCallHandler error handling)
- [ ] Read server.ts (stdio error handling for comparison)
- [ ] Update createToolCallHandler to catch errors
- [ ] Convert errors to buildToolResponse({ success: false, error: ... })
- [ ] Return CallToolResult with isError: true
- [ ] Test: Trigger tool error in HTTP/remote
- [ ] Verify client receives structured error, not protocol error
- [ ] Commit changes

**Best Fix**:
- [ ] Extract shared error-mapping utility
- [ ] Use in both stdio and HTTP/remote

---

### Task 1.3: Fix History Undo/Revert by Injecting SnapshotService
**Priority**: P1 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #8 MED - History undo/revert broken

```
Issue: sheets_history undo/revert operations fail even when snapshots exist
Evidence: index.ts:164 creates HistoryHandler with no options,
          history.ts:146 returns SERVICE_NOT_INITIALIZED when snapshotService missing
Files: src/handlers/index.ts, src/handlers/history.ts
```

**Checklist**:
- [ ] Read index.ts:164 (HistoryHandler construction)
- [ ] Read history.ts constructor (check for snapshotService parameter)
- [ ] Update index.ts:164 to pass snapshotService into HistoryHandler
- [ ] Verify SnapshotService is available in createHandlers context
- [ ] Test: sheets_history undo operation
- [ ] Test: sheets_history revert operation
- [ ] Verify no SERVICE_NOT_INITIALIZED errors
- [ ] Commit changes

**Best Fix**:
- [ ] Include snapshot service in shared handler context
- [ ] Add undo/revert integration tests

---

### Task 1.4: Register sheets_fix Tool or Remove Dead Code
**Priority**: P1 | **Effort**: 1h | **Status**: ⬜ Not Started
**Finding**: #9 MED - sheets_fix exists but not registered

```
Issue: sheets_fix is unreachable via MCP tools/list despite schema/handler present
Evidence: index.ts:48 exports Fix schema, index.ts:177 loads handler,
          registration.ts:286 ends at sheets_analyze (no sheets_fix entry)
Files: src/mcp/registration.ts, src/schemas/index.ts, src/handlers/index.ts
```

**Minimal Fix** (choose one):
- [ ] **Option A: Remove dead code**
  - [ ] Remove Fix schema from index.ts:48
  - [ ] Remove FixHandler from index.ts:177
  - [ ] Remove src/schemas/fix.ts
  - [ ] Remove src/handlers/fix.ts
  - [ ] Commit changes

- [ ] **Option B: Register the tool**
  - [ ] Add sheets_fix to TOOL_DEFINITIONS in registration.ts
  - [ ] Add sheets_fix to TOOL_REGISTRY
  - [ ] Add to README.md tool list
  - [ ] Test: Verify sheets_fix appears in tools/list
  - [ ] Test: Execute sheets_fix action
  - [ ] Commit changes

**Best Fix**:
- [ ] Generate tool registries from schema files
- [ ] Prevent omissions with CI check

---

### Task 1.5: Register Logging Handler or Remove Capability
**Priority**: P1 | **Effort**: 1h | **Status**: ⬜ Not Started
**Finding**: #10 MED - Logging capability declared but not registered

```
Issue: Clients attempt logging/setLevel and receive unhandled request errors
Evidence: features-2025-11-25.ts:237 includes logging,
          well-known.ts:151 advertises logging,
          logging.ts:12 has handler, server.ts:208 never registers it
Files: src/server.ts, src/mcp/logging.ts
```

**Minimal Fix** (choose one):
- [ ] **Option A: Remove capability**
  - [ ] Remove logging from features-2025-11-25.ts:237
  - [ ] Remove logging from well-known.ts:151
  - [ ] Remove logging from server.json:10
  - [ ] Commit changes

- [ ] **Option B: Register handler**
  - [ ] Read logging.ts:12 handler implementation
  - [ ] Register logging/setLevel in server.ts:208
  - [ ] Test: Call logging/setLevel from client
  - [ ] Verify log level changes
  - [ ] Commit changes

**Best Fix**:
- [ ] Implement and test logging in all transports
- [ ] Ensure consistent behavior

---

### Task 1.6: Wire Completions and Update TOOL_ACTIONS
**Priority**: P1 | **Effort**: 3h | **Status**: ⬜ Not Started
**Finding**: #11 MED - Completions not wired and stale

```
Issue: completions capability partially false, provides wrong action suggestions
Evidence: server.ts:197 comments out completions registration,
          completions.ts:15 claims source of truth but is incorrect for multiple tools
Files: src/server.ts, src/mcp/completions.ts
```

**Checklist**:
- [ ] Read completions.ts:87 (sheets_confirm actions)
- [ ] Compare with confirm.ts:53 (actual actions)
- [ ] Update TOOL_ACTIONS for sheets_confirm: [request, get_stats]
- [ ] Read completions.ts:90 (sheets_analyze actions)
- [ ] Compare with analyze.ts:49 (actual actions)
- [ ] Update TOOL_ACTIONS for sheets_analyze
- [ ] Repeat for all tools with drift
- [ ] Read completions.ts:17 (total count claim)
- [ ] Update to match actual count (188 actions)
- [ ] Uncomment completions registration in server.ts:197
- [ ] Test: Request completions from client
- [ ] Verify correct action suggestions
- [ ] Commit changes

**Best Fix**:
- [ ] Generate TOOL_ACTIONS from schemas
- [ ] Add CI check to detect drift

---

### Task 1.7: Add Resource Parity Across Transports
**Priority**: P1 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #12 MED - Resource registration lacks transport parity

```
Issue: Resource availability differs by transport
Evidence: server.ts:669 registers history/cache/transaction/conflict/impact/validation/metrics/confirm/analyze/reference,
          http-server.ts:140 only registers core resources/knowledge,
          remote-server.ts:364 same as HTTP
Files: src/server/http-server.ts, src/server/remote-server.ts
```

**Checklist**:
- [ ] Read server.ts:669-680 (full resource registration list)
- [ ] Read http-server.ts:140 (current HTTP resources)
- [ ] Read remote-server.ts:364 (current remote resources)
- [ ] Add missing resources to HTTP/remote:
  - [ ] history://operations
  - [ ] cache://stats
  - [ ] transaction://active
  - [ ] conflict://recent
  - [ ] impact://analysis
  - [ ] validation://summary
  - [ ] metrics://performance
  - [ ] confirm://pending
  - [ ] analyze://cache
- [ ] Test: Request each resource via HTTP/remote
- [ ] Verify parity with stdio
- [ ] Commit changes

**Best Fix**:
- [ ] Centralize resource registration in shared function
- [ ] Call from all transports

---

### Task 1.8: Wire sheets_auth to googleClient in HTTP/Remote
**Priority**: P1 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #13 MED - HTTP/remote sheets_auth not wired

```
Issue: sheets_auth status reports unauthenticated even when tokens exist
Evidence: registration.ts:795 uses options?.googleClient,
          http-server.ts:139 and remote-server.ts:363 call without options,
          auth.ts:101 relies on googleClient for status
Files: src/server/http-server.ts, src/server/remote-server.ts, src/mcp/registration.ts
```

**Checklist**:
- [ ] Read registration.ts:795 (registerServalSheetsTools signature)
- [ ] Read http-server.ts:139 (current call site)
- [ ] Read remote-server.ts:363 (current call site)
- [ ] Update http-server.ts:139 to pass `{ googleClient }`
- [ ] Update remote-server.ts:363 to pass `{ googleClient }`
- [ ] Test: HTTP session, call sheets_auth status
- [ ] Verify correct auth state reported
- [ ] Commit changes

**Best Fix**:
- [ ] Provide remote-specific auth handler
- [ ] Or hide sheets_auth for OAuth-managed transports

---

## 🟢 PHASE 2: SINGLE SOURCE OF TRUTH (Week 2)

### Task 2.1: Generate Counts and Action Lists from Schemas
**Priority**: P1 | **Effort**: 6h | **Status**: ⬜ Not Started
**Finding**: #5 HIGH - Metadata/action list drift

```
Issue: Counts conflict: package.json:4 (152), server.json:18 (152), features-2025-11-25.ts:14 (179),
       registration.ts:1053 (180), completions.ts:17 (185+), actual: 188
Evidence: history.ts:13 includes undo/redo/revert/clear but index.ts:239 only lists list/get/stats
Files: scripts/generate-metadata.ts, src/schemas/index.ts, src/schemas/annotations.ts
```

**Checklist**:
- [ ] Read generate-metadata.ts (current implementation)
- [ ] Update generator to:
  - [ ] Scan all schema files in src/schemas/
  - [ ] Extract actions from discriminated unions
  - [ ] Count total actions per tool
  - [ ] Count total actions across all tools
  - [ ] Generate ACTION_COUNTS map for annotations.ts
  - [ ] Generate TOOL_ACTIONS list for completions.ts
  - [ ] Update TOOL_COUNT and ACTION_COUNT in index.ts
  - [ ] Update server.json with correct counts
  - [ ] Use pkg.mcpName for server.json.name
  - [ ] Add packages/tools arrays to server.json
- [ ] Run: npm run generate:metadata
- [ ] Verify generated counts match truth (23 tools, 188 actions)
- [ ] Update package.json:4 description with correct count
- [ ] Test: npm run build
- [ ] Test: npm run validate:server-json
- [ ] Commit generated files

**Expected Result**:
```
TOOL_COUNT = 23
ACTION_COUNT = 188
```

**Diff Snippet**:
```typescript
// generate-metadata.ts
-  schemasIndex = schemasIndex.replace(
-    /export const ACTION_COUNT = \d+;/,
-    `export const ACTION_COUNT = ${ACTION_COUNT};`
-  );
+  schemasIndex = schemasIndex.replace(
+    /export const ACTION_COUNT = .*?;/,
+    `export const ACTION_COUNT = ${ACTION_COUNT};`
+  );

-const serverJson = {
-  name: "servalsheets",
+const serverJson = {
+  name: pkg.mcpName ?? pkg.name,
   version: pkg.version,
+  packages: [],
+  tools: []
 };
```

---

### Task 2.2: Add CI Guard for Metadata Drift
**Priority**: P1 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #5 HIGH - Metadata drift prevention

```
Issue: Drift propagates to docs and discovery endpoints
Files: scripts/check-metadata-drift.sh
```

**Checklist**:
- [ ] Read check-metadata-drift.sh (current implementation)
- [ ] Update to track additional files:
  - [ ] src/schemas/annotations.ts
  - [ ] src/mcp/completions.ts
  - [ ] README.md
  - [ ] src/server/well-known.ts
- [ ] Update git diff check to include all tracked files
- [ ] Test: Modify action count manually
- [ ] Test: Run CI, verify it fails
- [ ] Test: Run generator, verify CI passes
- [ ] Add to package.json:75 (prepack script)
- [ ] Commit changes

**Diff Snippet**:
```bash
# check-metadata-drift.sh
-git add package.json src/schemas/index.ts server.json 2>/dev/null || true
+git add package.json src/schemas/index.ts src/schemas/annotations.ts src/mcp/completions.ts server.json README.md src/server/well-known.ts 2>/dev/null || true

-if ! git diff --exit-code package.json src/schemas/index.ts server.json >/dev/null 2>&1; then
+if ! git diff --exit-code package.json src/schemas/index.ts src/schemas/annotations.ts src/mcp/completions.ts server.json README.md src/server/well-known.ts >/dev/null 2>&1; then
```

---

### Task 2.3: Generate Tool Descriptions for /info Endpoint
**Priority**: P2 | **Effort**: 3h | **Status**: ⬜ Not Started
**Finding**: #16 LOW - /info tool descriptions blank

```
Issue: /info endpoint returns tools without descriptions
Evidence: annotations.ts:227 sets description: '',
          remote-server.ts:263 uses it for /info
Files: src/schemas/annotations.ts, src/schemas/descriptions.ts
```

**Checklist**:
- [ ] Read descriptions.ts (already exists!)
- [ ] Read annotations.ts:227 (getToolMetadata function)
- [ ] Update getToolMetadata to populate description from descriptions.ts
- [ ] Map TOOL_DESCRIPTIONS[toolName] to description field
- [ ] Test: GET /info endpoint
- [ ] Verify descriptions are populated
- [ ] Commit changes

**Best Fix**:
- [ ] Generate /info metadata from canonical tool registry
- [ ] Ensure consistency across all endpoints

---

## 🔵 PHASE 3: DOCUMENTATION & CONSISTENCY (Week 3)

### Task 3.1: Remove References to Deleted Tools
**Priority**: P1 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: #17 LOW - Docs reference removed tools

```
Issue: Documentation misleads users and downstream registries
Evidence: README.md:201-204 lists sheets_workflow/sheets_insights/sheets_plan,
          TOOLS_INTEGRATION_COMPLETE.md:36,58 describe them
Files: README.md, TOOLS_INTEGRATION_COMPLETE.md
```

**Checklist**:
- [ ] Search for "sheets_workflow" in all docs
- [ ] Search for "sheets_insights" in all docs
- [ ] Search for "sheets_plan" in all docs
- [ ] Remove all references to deleted tools
- [ ] Update tool counts in README.md (23 tools, 188 actions)
- [ ] Update action counts in TOOLS_INTEGRATION_COMPLETE.md
- [ ] Verify no other removed tools referenced
- [ ] Test: Build docs, verify no broken links
- [ ] Commit changes

---

### Task 3.2: Update Prompt Copy with Correct Counts
**Priority**: P1 | **Effort**: 1h | **Status**: ⬜ Not Started
**Finding**: #5 HIGH - Count drift in prompts

```
Issue: Prompt descriptions claim incorrect tool/action counts
Evidence: features-2025-11-25.ts:14 claims 179 actions,
          registration.ts:1053 claims 180 actions,
          actual: 188 actions
Files: src/mcp/features-2025-11-25.ts, src/mcp/registration.ts
```

**Checklist**:
- [ ] Read features-2025-11-25.ts:14 (prompt description)
- [ ] Update to "23 tools with 188 actions"
- [ ] Read registration.ts:1053 (prompt copy)
- [ ] Update to "188 actions across 23 tools"
- [ ] Search for other hardcoded counts
- [ ] Update all instances
- [ ] Test: Verify prompts display correct counts
- [ ] Commit changes

**Best Fix**:
- [ ] Import counts from generated constants
- [ ] Use `${TOOL_COUNT}` and `${ACTION_COUNT}` in strings

---

### Task 3.3: Update well-known.ts Capabilities
**Priority**: P1 | **Effort**: 1h | **Status**: ⬜ Not Started
**Finding**: #14 LOW - Well-known claims subscriptions without implementation

```
Issue: Discovery metadata advertises unsupported resource subscription behavior
Evidence: well-known.ts:132 sets subscriptions: true,
          only references are in that file (well-known.ts:44)
Files: src/server/well-known.ts
```

**Checklist**:
- [ ] Read well-known.ts:132 (subscriptions field)
- [ ] Set `subscriptions: false` (not implemented)
- [ ] Update prompt/resource counts to match reality
- [ ] Test: GET /.well-known/mcp
- [ ] Verify subscriptions: false in response
- [ ] Commit changes

**Best Fix**:
- [ ] Implement resource subscription handlers if intended
- [ ] Or keep false until ready

---

## 🟣 PHASE 4: AUTHENTICATION & API HARDENING (Week 4)

### Task 4.1: Verify Scope Coverage for All Operations
**Priority**: P2 | **Effort**: 4h | **Status**: ⬜ Not Started
**Finding**: Unproven - scope checks may be missing in some handlers

```
Issue: Need to verify all operations have appropriate scope requirements
Files: src/handlers/*.ts, src/auth/scopes.ts
```

**Checklist**:
- [ ] Read src/auth/scopes.ts (scope definitions)
- [ ] For each handler in src/handlers/:
  - [ ] Identify operations requiring specific scopes
  - [ ] Verify scope checks are present
  - [ ] Add missing scope validations
- [ ] Create scope requirement matrix
- [ ] Test: Attempt operation without required scope
- [ ] Verify proper error message
- [ ] Document scope requirements
- [ ] Commit changes

---

### Task 4.2: Add Token Redaction Assertions
**Priority**: P2 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: Unproven - need to verify tokens are never logged

```
Issue: Ensure tokens/secrets are never exposed in logs or errors
Files: src/utils/google-api.ts, src/utils/error-factory.ts
```

**Checklist**:
- [ ] Read google-api.ts (API client code)
- [ ] Search for all error.message/error.stack usages
- [ ] Add token redaction to error factory
- [ ] Redact: access_token, refresh_token, client_secret
- [ ] Add assertions in tests
- [ ] Test: Trigger errors with auth tokens
- [ ] Verify tokens are redacted in logs
- [ ] Commit changes

---

### Task 4.3: Validate Retry and Error Mapping with Integration Tests
**Priority**: P2 | **Effort**: 3h | **Status**: ⬜ Not Started
**Finding**: Unproven - live Google API request validation needed

```
Issue: Ensure retry logic and error mapping work correctly
Files: tests/integration/*.ts
```

**Checklist**:
- [ ] Run: npm run test:integration (with TEST_REAL_API=true)
- [ ] Verify retry logic for 429 errors
- [ ] Verify retry logic for 503 errors
- [ ] Verify exponential backoff
- [ ] Verify error mapping to MCP format
- [ ] Test: Rate limit handling
- [ ] Test: Quota exceeded handling
- [ ] Test: Network timeout handling
- [ ] Document integration test setup
- [ ] Commit changes

---

## 🟠 PHASE 5: RELEASE CLEANUP (Week 5)

### Task 5.1: Verify TypeScript/Zod Compile Status
**Priority**: P1 | **Effort**: 1h | **Status**: ⬜ Not Started
**Finding**: Unproven - need to verify build succeeds

```
Issue: Ensure all TypeScript and Zod schemas compile without errors
Files: All TypeScript files
```

**Checklist**:
- [ ] Run: npm run typecheck
- [ ] Fix any type errors
- [ ] Run: npm run build
- [ ] Verify dist/ is generated
- [ ] Check for any Zod validation errors
- [ ] Test: Import compiled modules
- [ ] Commit fixes

---

### Task 5.2: Verify Dist Artifact Parity
**Priority**: P1 | **Effort**: 2h | **Status**: ⬜ Not Started
**Finding**: Unproven - need to verify dist matches src

```
Issue: Ensure built artifacts match source code
Files: dist/*, src/*
```

**Checklist**:
- [ ] Run: npm run build
- [ ] Compare dist/mcp/registration.js to src/mcp/registration.ts
- [ ] Verify tool counts match
- [ ] Verify action lists match
- [ ] Check for any missing exports
- [ ] Test: Run dist/index.js
- [ ] Verify server starts correctly
- [ ] Commit any build config fixes

---

### Task 5.3: Update package.json for Prepack Hook
**Priority**: P1 | **Effort**: 1h | **Status**: ⬜ Not Started
**Finding**: Related to #5 HIGH - ensure generator runs before publish

```
Issue: Ensure metadata is regenerated before publishing
Files: package.json
```

**Checklist**:
- [ ] Read package.json:75 (scripts section)
- [ ] Add/update prepack script:
  ```json
  "prepack": "npm run generate:metadata && npm run build"
  ```
- [ ] Test: npm pack
- [ ] Verify generator runs automatically
- [ ] Verify build runs automatically
- [ ] Check tarball contents
- [ ] Commit changes

---

### Task 5.4: Final Validation and Release Checklist
**Priority**: P1 | **Effort**: 3h | **Status**: ⬜ Not Started

```
Final validation before release
```

**Checklist**:
- [ ] Run: npm run typecheck (must pass)
- [ ] Run: npm run build (must pass)
- [ ] Run: npm run validate:server-json (must pass)
- [ ] Run: npm run ci (must pass all checks)
- [ ] Verify all HIGH findings resolved
- [ ] Verify all MED findings resolved
- [ ] Document remaining LOW findings
- [ ] Update CHANGELOG.md
- [ ] Update version in package.json
- [ ] Create release tag
- [ ] Publish to npm (if ready)

---

## 📊 PHASE SUMMARY

### Phase 0: Critical Runtime Breakages
**Duration**: 2-3 days
**Tasks**: 5 tasks (0.1-0.5)
**Severity**: All P0 (blocking)
**Goal**: System stable, no runtime errors, clean stdio output

### Phase 1: MCP Protocol Compliance
**Duration**: 1 week
**Tasks**: 8 tasks (1.1-1.8)
**Severity**: P1 (high priority)
**Goal**: Full MCP protocol compliance across all transports

### Phase 2: Single Source of Truth
**Duration**: 1 week
**Tasks**: 3 tasks (2.1-2.3)
**Severity**: P1-P2
**Goal**: Metadata generated from schemas, zero drift

### Phase 3: Documentation & Consistency
**Duration**: 3 days
**Tasks**: 3 tasks (3.1-3.3)
**Severity**: P1
**Goal**: Docs accurate, counts correct, capabilities honest

### Phase 4: Auth & API Hardening
**Duration**: 1 week
**Tasks**: 3 tasks (4.1-4.3)
**Severity**: P2
**Goal**: Security verified, scopes correct, errors safe

### Phase 5: Release Cleanup
**Duration**: 2-3 days
**Tasks**: 4 tasks (5.1-5.4)
**Severity**: P1
**Goal**: Clean release, validated build, automated checks

---

## 🎯 CURRENT SPRINT: PHASE 0

**Sprint Goal**: Resolve all P0 blocking issues
**Sprint Duration**: 2-3 days (14-17 hours total)

**Must Complete**:
1. Task 0.1: Wire sampling/elicitation (4h)
2. Task 0.2: Fix task cancellation (3h)
3. Task 0.3: Initialize HTTP/remote services (3h)
4. Task 0.4: Fix server.json validation (2h)
5. Task 0.5: Fix stdout logging (2h)

**Success Criteria**:
- [ ] All HIGH severity findings resolved
- [ ] System starts without errors
- [ ] All transports functional (stdio, HTTP, remote)
- [ ] Clean stdio output (no protocol corruption)
- [ ] CI validation passes

---

## 🏷️ FINDING REFERENCE

| Finding | Severity | Task(s) | Status |
|---------|----------|---------|--------|
| #1 Sampling/elicitation not wired | HIGH | 0.1 | ⬜ Not Started |
| #2 Task cancel ineffective | HIGH | 0.2 | ⬜ Not Started |
| #3 HTTP/remote services missing | HIGH | 0.3 | ⬜ Not Started |
| #4 server.json validation fails | HIGH | 0.4 | ⬜ Not Started |
| #5 Metadata/action list drift | HIGH | 2.1, 2.2, 3.2 | ⬜ Not Started |
| #6 MCP context incomplete | MED | 1.1 | ⬜ Not Started |
| #7 Protocol errors not tool errors | MED | 1.2 | ⬜ Not Started |
| #8 History undo/revert broken | MED | 1.3 | ⬜ Not Started |
| #9 sheets_fix not registered | MED | 1.4 | ⬜ Not Started |
| #10 Logging not registered | MED | 1.5 | ⬜ Not Started |
| #11 Completions not wired | MED | 1.6 | ⬜ Not Started |
| #12 Resource parity missing | MED | 1.7 | ⬜ Not Started |
| #13 sheets_auth not wired HTTP | MED | 1.8 | ⬜ Not Started |
| #14 Subscriptions unsupported | LOW | 3.3 | ⬜ Not Started |
| #15 stdout corrupts stdio | MED | 0.5 | ⬜ Not Started |
| #16 /info descriptions blank | LOW | 2.3 | ⬜ Not Started |
| #17 Docs reference removed tools | LOW | 3.1 | ⬜ Not Started |

---

## 📝 NOTES

- **Original TODO preserved**: Tasks from original Phase 0-7 are still valid for future enhancements
- **Focus on fixes first**: Current plan prioritizes fixing broken functionality over new features
- **Dependency tracking**: Some tasks depend on others (noted in task headers)
- **Testing required**: Each task includes verification steps
- **Commit granularity**: Commit after each completed task

---

**Last Updated**: 2026-01-07
**Total Tasks**: 21 (5 P0, 11 P1, 5 P2)
**Estimated Duration**: 5-6 weeks for all phases
**Current Sprint**: Phase 0 (Critical Fixes)

**Let's fix the foundation first!** 🔧
