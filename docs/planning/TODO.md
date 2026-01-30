# ServalSheets TODO List - HISTORICAL ARCHIVE

**⚠️ DEPRECATED:** This document is a historical archive from January 2026 planning sessions.

**Current Production Status (2026-01-16):**
- ✅ **Version:** 1.6.0
- ✅ **Architecture:** 21 tools, 272 actions (current consolidated set)
- ✅ **Status:** Production ready, all verification checks passing
- ✅ **Phases 0-4 and Phase 7:** COMPLETE

**This TODO list references outdated architectures (23-26 tools).**
**For current project status, see:** [docs/development/PROJECT_STATUS.md](../development/PROJECT_STATUS.md)

---

## ARCHIVED CONTENT BELOW

*Generated: 2026-01-07 (Updated with comprehensive audit findings)*

**⚠️ NOTE:** This document contains historical planning information. Many tasks reference previous architectures with 24-26 tools. **Current production architecture: 21 tools, 272 actions** (as of v1.6.0).

## 🔥 IN PROGRESS

**Phase 5: Release Cleanup** - Final validation and production readiness

---

## ✅ PHASE 0: CRITICAL RUNTIME BREAKAGES (COMPLETE!)

### Task 0.1: Wire Sampling/Elicitation Capabilities ✅ COMPLETE
**Priority**: P0 | **Effort**: 4h | **Status**: ✅ Done (Commit: 9372dde)
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

**Solution Implemented**:
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

### Task 0.2: Fix Task Cancellation ✅ COMPLETE
**Priority**: P0 | **Effort**: 3h | **Status**: ✅ Done (Commit: 6b2387e)
**Finding**: #2 HIGH - SEP-1686 cancel is ineffective

```
Issue: tasks/cancel does not stop execution or set cancellation flags
Evidence: protocol.js:136 calls updateTaskStatus, task-store-adapter.ts:99 only delegates,
          server.ts:719 registerTaskCancelHandler is no-op
Files: src/core/task-store-adapter.ts, src/core/task-store.ts, src/server.ts
```

**Solution Implemented**:
- Updated TaskStoreAdapter.updateTaskStatus to detect status === 'cancelled'
- Calls this.cancelTask(taskId) to properly set cancellation flags
- Ensures cancelledTasks Map is populated
- isTaskCancelled() now returns true after cancellation
- Added test verification script

---

### Task 0.3: Initialize Services for HTTP/Remote Transports ✅ COMPLETE
**Priority**: P0 | **Effort**: 3h | **Status**: ✅ Done (Commit: 7d426b6)
**Finding**: #3 HIGH - HTTP/remote missing service initialization

```
Issue: sheets_transaction/conflict/impact/validation fail in HTTP/remote sessions
Evidence: server.ts:185-188 initializes services for stdio only,
          transaction.ts:25 calls getTransactionManager which throws if not initialized
Files: src/http-server.ts, src/remote-server.ts
```

**Solution Implemented**:
- Added service initialization to http-server.ts after googleClient creation
- Added service initialization to remote-server.ts after googleClient creation
- All 4 services now initialized: initTransactionManager, initConflictDetector, initImpactAnalyzer, initValidationEngine
- HTTP/remote transports now have full parity with stdio transport

---

### Task 0.4: Fix server.json Schema Validation ✅ COMPLETE
**Priority**: P0 | **Effort**: 2h | **Status**: ✅ Done (Commit: 3ed59af)
**Finding**: #4 HIGH - server.json fails validation

```
Issue: npm run validate:server-json fails, package metadata not registry-compliant
Evidence: validate-server-json.mjs:70-71 requires packages/tools arrays,
          validate-server-json.mjs:73 requires name match package.json.mcpName,
          server.json:2 uses "servalsheets", missing arrays
Files: server.json, scripts/generate-metadata.ts
```

**Solution Implemented**:
- Updated generate-metadata.ts to use pkg.mcpName for name field
- Generator now emits packages: [] and tools: [] arrays
- Added repository.source property for schema compliance
- Changed mcpName from "io.github.khill1269.servalsheets" to "khill1269/servalsheets" (namespace/name format)
- All validation now passes with Ajv

---

### Task 0.5: Fix stdout Logging in stdio Mode ✅ COMPLETE
**Priority**: P0 | **Effort**: 2h | **Status**: ✅ Done (Commit: 6c55e43)
**Finding**: #15 MED - stdout logging corrupts stdio protocol stream

```
Issue: Any stdout output in stdio mode breaks MCP framing
Evidence: task-store.ts had 5 console.error calls that would corrupt stdio transport
Files: src/core/task-store.ts
```

**Solution Implemented**:
- Replaced all console.error calls in task-store.ts with logger calls
- InMemoryTaskStore.cancelTask: console.error → logger.warn
- RedisTaskStore error handler: console.error → logger.error
- RedisTaskStore connection: console.error → logger.info
- RedisTaskStore parse error: console.error → logger.error
- Logger already routes all logs to stderr in stdio mode (MCP_TRANSPORT detection)

---

## 🟡 PHASE 1: MCP PROTOCOL COMPLIANCE (Week 1)

### Task 1.1: Forward Complete MCP Context ✅ COMPLETE
**Priority**: P1 | **Effort**: 3h | **Status**: ✅ Done
**Finding**: #6 MED - MCP call context forwarding incomplete

```
Issue: requestId/signal/sendNotification don't flow correctly
Evidence: server.ts:283 limits extra to sendNotification/progressToken/elicit/sample,
          protocol.d.ts:173 includes signal/requestId/sendRequest
Files: src/server.ts, src/mcp/registration.ts
```

**Checklist**:
- [x] Read server.ts:283 (stdio tool registration)
- [x] Read registration.ts:862 (HTTP/remote registration)
- [x] Update server.ts:283 to forward full `extra` object
- [x] Add requestId from extra.requestId || extra.requestInfo?._meta?.requestId
- [x] Add abortSignal from extra.signal
- [x] Preserve sendNotification, progressToken, elicit, sample
- [x] Update registration.ts:586 to build full request context
- [x] Test: Verify requestId flows through
- [x] Test: Verify signal propagates for cancellation
- [x] Test: Verify progress notifications work
- [x] Commit changes

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

### Task 1.2: Return MCP Tool Errors, Not Protocol Errors ✅ COMPLETE
**Priority**: P1 | **Effort**: 2h | **Status**: ✅ Done
**Finding**: #7 MED - HTTP/remote tools throw protocol errors

```
Issue: MCP clients receive protocol-level errors instead of structured tool failures
Evidence: registration.ts:717 throws error instead of returning CallToolResult with isError
Files: src/mcp/registration.ts
```

**Checklist**:
- [x] Read registration.ts:717 (createToolCallHandler error handling)
- [x] Read server.ts (stdio error handling for comparison)
- [x] Update createToolCallHandler to catch errors
- [x] Convert errors to buildToolResponse({ success: false, error: ... })
- [x] Return CallToolResult with isError: true
- [x] Test: Trigger tool error in HTTP/remote
- [x] Verify client receives structured error, not protocol error
- [x] Commit changes

**Best Fix**:
- [x] Extract shared error-mapping utility
- [x] Use in both stdio and HTTP/remote

---

### Task 1.3: Fix History Undo/Revert by Injecting SnapshotService ✅ COMPLETE
**Priority**: P1 | **Effort**: 2h | **Status**: ✅ Done
**Finding**: #8 MED - History undo/revert broken

```
Issue: sheets_history undo/revert operations fail even when snapshots exist
Evidence: index.ts:164 creates HistoryHandler with no options,
          history.ts:146 returns SERVICE_NOT_INITIALIZED when snapshotService missing
Files: src/handlers/index.ts, src/handlers/history.ts
```

**Checklist**:
- [x] Read index.ts:164 (HistoryHandler construction)
- [x] Read history.ts constructor (check for snapshotService parameter)
- [x] Update index.ts:164 to pass snapshotService into HistoryHandler
- [x] Verify SnapshotService is available in createHandlers context
- [x] Test: sheets_history undo operation
- [x] Test: sheets_history revert operation
- [x] Verify no SERVICE_NOT_INITIALIZED errors
- [x] Commit changes

**Best Fix**:
- [x] Include snapshot service in shared handler context
- [x] Add undo/revert integration tests

---

### Task 1.4: Register sheets_fix Tool ✅ COMPLETE
**Priority**: P1 | **Effort**: 1h | **Status**: ✅ Done
**Finding**: #9 MED - sheets_fix exists but not registered

```
Issue: sheets_fix is unreachable via MCP tools/list despite schema/handler present
Evidence: index.ts:48 exports Fix schema, index.ts:177 loads handler,
          registration.ts:286 ends at sheets_analyze (no sheets_fix entry)
Files: src/mcp/registration.ts, src/schemas/index.ts, src/handlers/index.ts
```

**Implementation**:
- [x] Add sheets_fix to TOOL_DEFINITIONS in registration.ts
- [x] Add sheets_fix to handler map
- [x] Add SHEETS_FIX_ANNOTATIONS to fix.ts and annotations.ts
- [x] Add sheets_fix description to descriptions.ts
- [x] Add ACTION_COUNTS entry for sheets_fix
- [x] Test: Verify build succeeds with 24 tools
- [x] Test: Verify typecheck passes
- [ ] Add to README.md tool list (deferred)
- [ ] Add CI check to ensure all schemas are registered (deferred)
- [ ] Commit changes (next step)

---

### Task 1.5: Register Logging Handler ✅ COMPLETE
**Priority**: P1 | **Effort**: 1h | **Status**: ✅ Done
**Finding**: #10 MED - Logging capability declared but not registered

```
Issue: Clients attempt logging/setLevel and receive unhandled request errors
Evidence: features-2025-11-25.ts:237 includes logging,
          well-known.ts:151 advertises logging,
          logging.ts:12 has handler, server.ts:208 never registers it
Files: src/server.ts, src/mcp/logging.ts
```

**Implementation**:
- [x] Read logging.ts:12 handler implementation
- [x] Register logging/setLevel handler in server.ts
- [x] Implement handler in all transports (stdio, HTTP, remote)
- [x] Import SetLevelRequestSchema from SDK types
- [x] Import handleLoggingSetLevel from handlers/logging
- [x] Use 'as any' to bypass TypeScript deep type inference issues
- [x] Test: Verify typecheck passes
- [x] Test: Verify build succeeds
- [x] Ensure consistent behavior across transports
- [x] Commit changes (next step)

---

### Task 1.6: Wire Completions and Update TOOL_ACTIONS ✅ COMPLETE
**Priority**: P1 | **Effort**: 3h | **Status**: ✅ Done
**Finding**: #11 MED - Completions not wired and stale

```
Issue: completions capability partially false, provides wrong action suggestions
Evidence: server.ts:197 comments out completions registration,
          completions.ts:15 claims source of truth but is incorrect for multiple tools
Files: src/server.ts, src/mcp/completions.ts
```

**Checklist**:
- [x] Read completions.ts:87 (sheets_confirm actions)
- [x] Compare with confirm.ts:53 (actual actions)
- [x] Update TOOL_ACTIONS for sheets_confirm: ['request', 'get_stats']
- [x] Read completions.ts:90 (sheets_analyze actions)
- [x] Compare with analyze.ts:49 (actual actions)
- [x] Update TOOL_ACTIONS for sheets_analyze: ['analyze', 'generate_formula', 'suggest_chart', 'get_stats']
- [x] Update sheets_analyze: Added 5 missing actions (detect_patterns, column_analysis, suggest_templates, generate_formula, suggest_chart)
- [x] Update sheets_history: Added 4 missing actions (undo, redo, revert_to, clear)
- [x] Add sheets_fix to TOOL_ACTIONS (no actions - single request mode)
- [x] Update total count to 188 actions
- [x] Update ACTION_COUNTS in annotations.ts
- [x] Update TOOL_REGISTRY in index.ts
- [x] Test: Verify typecheck and build pass
- [x] Commit changes

**Note on Completions Registration**:
- MCP SDK v1.25.1 only supports completions for prompts/resources, NOT tool arguments
- Completions capability is declared in createServerCapabilities() but no handler needed yet
- TOOL_ACTIONS data structure is ready for when SDK adds tool argument completion support

**Note on Metadata Generator**:
- scripts/generate-metadata.ts has a buggy action counting algorithm (shows 152 instead of 188)
- It only counts simple discriminated union patterns, misses many actions
- TOOL_REGISTRY in index.ts has correct manual counts (188 actions)
- This should be fixed separately with proper schema parsing

---

### Task 1.7: Add Resource Parity Across Transports ✅ COMPLETE
**Priority**: P1 | **Effort**: 2h | **Status**: ✅ Done
**Finding**: #12 MED - Resource registration lacks transport parity

```
Issue: Resource availability differs by transport
Evidence: server.ts:669 registers history/cache/transaction/conflict/impact/validation/metrics/confirm/analyze/reference,
          http-server.ts:140 only registers core resources/knowledge,
          remote-server.ts:364 same as HTTP
Files: src/server/http-server.ts, src/server/remote-server.ts
```

**Checklist**:
- [x] Read server.ts:672-711 (full resource registration list)
- [x] Read http-server.ts:157-159 (current HTTP resources - only core + knowledge)
- [x] Read remote-server.ts:382-384 (current remote resources - only core + knowledge)
- [x] Import all resource registration functions in HTTP server
- [x] Import all resource registration functions in remote server
- [x] Add missing resources to HTTP server:
  - [x] registerHistoryResources
  - [x] registerCacheResources
  - [x] registerTransactionResources (if googleClient)
  - [x] registerConflictResources (if googleClient)
  - [x] registerImpactResources (if googleClient)
  - [x] registerValidationResources (if googleClient)
  - [x] registerMetricsResources (if googleClient)
  - [x] registerConfirmResources
  - [x] registerAnalyzeResources
  - [x] registerReferenceResources
- [x] Add same resources to remote server
- [x] Test: Verify typecheck passes
- [x] Test: Verify build succeeds
- [x] Commit changes

**Result**:
All three transports now have identical resource registration, maintaining the same conditional logic (Phase 4 resources only registered if googleClient exists).

---

### Task 1.8: Wire sheets_auth to googleClient in HTTP/Remote ✅ COMPLETE
**Priority**: P1 | **Effort**: 2h | **Status**: ✅ Done
**Finding**: #13 MED - HTTP/remote sheets_auth not wired

```
Issue: sheets_auth status reports unauthenticated even when tokens exist
Evidence: registration.ts:795 uses options?.googleClient,
          http-server.ts:139 and remote-server.ts:363 call without options,
          auth.ts:101 relies on googleClient for status
Files: src/server/http-server.ts, src/server/remote-server.ts, src/mcp/registration.ts
```

**Checklist**:
- [x] Read registration.ts:817 (registerServalSheetsTools signature)
- [x] Read http-server.ts:168 (current call site)
- [x] Read remote-server.ts:393 (current call site)
- [x] Update http-server.ts:168 to pass `{ googleClient }`
- [x] Update remote-server.ts:393 to pass `{ googleClient: googleClient ?? null }`
- [x] Test: Verify typecheck passes
- [x] Test: Verify build succeeds
- [x] Commit changes

**Result**:
The AuthHandler in registerServalSheetsTools now receives the googleClient for HTTP and remote transports, enabling sheets_auth to report correct authentication status when tokens exist.

---

## 🟢 PHASE 2: SINGLE SOURCE OF TRUTH (COMPLETE!)

### Task 2.1: Generate Counts and Action Lists from Schemas ✅ COMPLETE
**Priority**: P1 | **Effort**: 6h | **Status**: ✅ Done (Commits: 47a29e3, 5832b8e)
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

## 🟣 PHASE 2.5: TOOL CONSOLIDATION (11 Tools Architecture) - DEFERRED

**Status**: ⏸️ **DEFERRED** - To be reconsidered after Phases 1-5 complete
**Priority**: P3 (Future Enhancement)
**Decision Date**: 2026-01-07

### Strategic Decision

**Deferred until after Phase 5 completion** to prioritize:
1. ✅ Fixing broken functionality (Phase 1)
2. ✅ Establishing single source of truth (Phase 2)
3. ✅ Documentation accuracy (Phase 3)
4. ✅ Security hardening (Phase 4)
5. ✅ Production readiness (Phase 5)

### Rationale for Deferral

**Why 11 tools might be better** (theoretical benefits):
- Better aligns with MCP best practices (fewer tools, more actions per tool)
- Reduces cognitive load for LLMs (fewer tool choices to evaluate)
- Improves context efficiency (related actions grouped together)
- Cleaner API surface (logical groupings vs granular capabilities)

**Why we're deferring**:
- ⚠️ Major breaking change requiring client migration
- ⚠️ Needs real-world usage feedback on current 24-tool architecture
- ⚠️ Requires backward compatibility layer
- ⚠️ Extensive documentation and migration guide needed
- ⚠️ Current architecture is MCP-compliant and functional
- ⚠️ Focus needed on fixing existing issues first

### Proposed 11-Tool Structure (for future reference)

**Current Architecture (24 tools)**: One tool per capability domain
- sheets_auth, sheets_core, sheets_core, sheets_data, sheets_data, sheets_format, sheets_dimensions, sheets_format, sheets_visualize, sheets_visualize, sheets_dimensions, sheets_collaborate, sheets_collaborate, sheets_collaborate, sheets_analyze, sheets_advanced, sheets_transaction, sheets_quality, sheets_quality, sheets_quality, sheets_history, sheets_confirm, sheets_analyze, sheets_fix
- Total: 24 tools with 188 actions

**Potential Target Architecture (11 tools)**: Grouped by workflow/feature set
1. **sheets_core** - Spreadsheet/sheet/range CRUD (combines: spreadsheet, sheet, values, cells)
2. **sheets_format** - Styling and appearance (combines: format, dimensions)
3. **sheets_data** - Data manipulation (combines: rules, charts, pivot, filter_sort)
4. **sheets_collab** - Collaboration features (combines: sharing, comments, versions)
5. **sheets_analyze** - AI-powered analysis (combines: analysis, advanced, analyze)
6. **sheets_enterprise** - Advanced features (combines: transaction, validation, conflict, impact, history)
7. **sheets_auth** - Authentication (keeps as-is)
8. **sheets_confirm** - User confirmation (keeps as-is)
9. **sheets_fix** - Auto-repair (keeps as-is)
10. **sheets_batch** - Batch operations (future enhancement)
11. **sheets_admin** - Server management (future enhancement)

### When to Revisit

**Reconsider after**:
- ✅ All Phases 1-5 tasks completed
- ✅ System stable in production
- ✅ User feedback collected on current architecture
- ✅ Performance metrics gathered
- ✅ LLM usage patterns analyzed

**Required before implementation**:
- [ ] User/stakeholder approval of consolidation strategy
- [ ] Backward compatibility plan
- [ ] Migration guide drafted
- [ ] Deprecation timeline established
- [ ] Feature flag strategy for gradual rollout

### Task 2.5.1: Design 11-Tool Schema Architecture
**Priority**: P3 | **Effort**: 8h+ | **Status**: ⏸️ Deferred

**NOTE**: This task is ON HOLD pending completion of Phases 1-5 and strategic review.

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

### Phase 0: Critical Runtime Breakages ✅ COMPLETE
**Duration**: 2-3 days
**Tasks**: 5 tasks (0.1-0.5)
**Severity**: All P0 (blocking)
**Goal**: System stable, no runtime errors, clean stdio output
**Status**: ✅ All tasks completed

### Phase 1: MCP Protocol Compliance ✅ COMPLETE
**Duration**: 1 week
**Tasks**: 8 tasks (1.1-1.8)
**Severity**: P1 (high priority)
**Goal**: Full MCP protocol compliance across all transports
**Status**: ✅ All 8 tasks completed (Commits: 4da448d, 47a29e3, f2da68b)

### Phase 2: Single Source of Truth ✅ COMPLETE
**Duration**: 1 week
**Tasks**: 3 tasks (2.1-2.3)
**Severity**: P1-P2
**Goal**: Metadata generated from schemas, zero drift
**Status**: ✅ All 3 tasks completed (Commits: 47a29e3, 5832b8e, ada27c0, a98db4b, a7c4a51)

### Phase 2.5: Tool Consolidation (11 Tools) ⏸️ DEFERRED
**Duration**: 8+ hours
**Tasks**: 1 task (2.5.1)
**Severity**: P3 (future enhancement)
**Goal**: Consolidate 24 tools into 11 logical groups
**Status**: ⏸️ Deferred until after Phases 1-5 complete

### Phase 3: Documentation & Consistency ✅ COMPLETE
**Duration**: 3 days
**Tasks**: 3 tasks (3.1-3.3)
**Severity**: P1
**Goal**: Docs accurate, counts correct, capabilities honest
**Status**: ✅ All 3 tasks completed (Commits: ada27c0, a98db4b, a7c4a51)

### Phase 4: Auth & API Hardening ⚠️ PARTIAL (2/3 Complete)
**Duration**: 1 week
**Tasks**: 3 tasks (4.1-4.3)
**Severity**: P2
**Goal**: Security verified, scopes correct, errors safe
**Status**: ⚠️ Tasks 4.2, 4.3 complete; Task 4.1 deferred (Commit: a7b82f8)
**Note**: Task 4.1 (scope coverage) requires 10-14h and deferred to future PR

### Phase 5: Release Cleanup 🔄 IN PROGRESS
**Duration**: 2-3 days
**Tasks**: 4 tasks (5.1-5.4)
**Severity**: P1
**Goal**: Clean release, validated build, automated checks
**Status**: 🔄 Starting final validation tasks

---

## 🎯 CURRENT SPRINT: PHASE 5 (Release Cleanup)

**Previous Sprints**:
- Phase 0 ✅ COMPLETE - All P0 blocking issues resolved
- Phase 1 ✅ COMPLETE - Full MCP protocol compliance achieved
- Phase 2 ✅ COMPLETE - Single source of truth established
- Phase 3 ✅ COMPLETE - Documentation updated and consistent
- Phase 4 ⚠️ PARTIAL - Security hardening (2/3 tasks, 4.1 deferred)

**Sprint Goal**: Finalize production readiness and validate release
**Sprint Duration**: 2-3 days (7 hours total)

**Tasks**:
1. Task 5.1: Verify TypeScript/Zod Compilation (1h) - ✅ Already verified
2. Task 5.2: Verify Dist Artifact Parity (2h)
3. Task 5.3: Update package.json Prepack Hook (1h)
4. Task 5.4: Final Validation Checklist (3h)

**Success Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Build artifacts match source code
- [ ] Metadata regenerates automatically on publish
- [ ] All HIGH/MED findings resolved or documented
- [ ] Version bumped and changelog updated
- [ ] Ready for npm publish

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
**Total Tasks**: 21 (5 P0 ✅, 11 P1, 5 P2)
**Estimated Duration**: 4-5 weeks for Phases 1-5 (Phase 2.5 deferred)
**Current Sprint**: Phase 1 (MCP Protocol Compliance)

**Strategic Decision**: Phase 2.5 (Tool Consolidation) deferred until after Phases 1-5 complete and system is production-stable. Focus is on fixing functionality and establishing reliable metadata generation first.

**Let's achieve MCP compliance and production readiness!** 🔧✨
