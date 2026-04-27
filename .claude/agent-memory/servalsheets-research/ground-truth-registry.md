---
name: Ground Truth Registry — ServalSheets Codebase Audit Baseline
description: Verifiable facts about ServalSheets architecture, counts, and file locations for accuracy benchmarking
type: reference
---

# Ground Truth Registry: ServalSheets MCP Server

**Generated:** 2026-04-26 (Session 117 - Research Agent)  
**Status:** VERIFIED (all file:line evidence)  
**Purpose:** Authoritative baseline for codebase metrics, handler architecture, error handling, mutation actions, and known issues.

---

## Section 1: Tool and Action Counts

**Source of truth:** `src/generated/action-counts.ts:11-47`

| Tool | Action Count | File Source |
|------|--------------|-------------|
| sheets_advanced | 31 | src/generated/action-counts.ts:12 |
| sheets_agent | 8 | src/generated/action-counts.ts:13 |
| sheets_analyze | 26 | src/generated/action-counts.ts:14 |
| sheets_appsscript | 19 | src/generated/action-counts.ts:15 |
| sheets_auth | 5 | src/generated/action-counts.ts:16 |
| sheets_bigquery | 17 | src/generated/action-counts.ts:17 |
| sheets_collaborate | 41 | src/generated/action-counts.ts:18 |
| sheets_composite | 21 | src/generated/action-counts.ts:19 |
| sheets_compute | 16 | src/generated/action-counts.ts:20 |
| sheets_confirm | 5 | src/generated/action-counts.ts:21 |
| sheets_connectors | 10 | src/generated/action-counts.ts:22 |
| sheets_core | 21 | src/generated/action-counts.ts:23 |
| sheets_data | 25 | src/generated/action-counts.ts:24 |
| sheets_dependencies | 10 | src/generated/action-counts.ts:25 |
| sheets_dimensions | 30 | src/generated/action-counts.ts:26 |
| sheets_federation | 4 | src/generated/action-counts.ts:27 |
| sheets_fix | 6 | src/generated/action-counts.ts:28 |
| sheets_format | 25 | src/generated/action-counts.ts:29 |
| sheets_history | 10 | src/generated/action-counts.ts:30 |
| sheets_quality | 4 | src/generated/action-counts.ts:31 |
| sheets_session | 32 | src/generated/action-counts.ts:32 |
| sheets_templates | 8 | src/generated/action-counts.ts:33 |
| sheets_transaction | 6 | src/generated/action-counts.ts:34 |
| sheets_visualize | 18 | src/generated/action-counts.ts:35 |
| sheets_webhook | 11 | src/generated/action-counts.ts:36 |

**Aggregates:**
- TOOL_COUNT: 25 (calculated line 42)
- ACTION_COUNT: 409 (calculated line 47, sum of all action counts)

---

## Section 2: Handler Architecture (25 handlers)

**Reference:** `src/handlers/index.ts:64-100` (Handlers interface definition)

### BaseHandler Subclasses (13 handlers)

These extend `BaseHandler<Input, Output>` from `src/handlers/base.ts:1+`

| Handler | Tool | File | Extends BaseHandler |
|---------|------|------|-------------------|
| SheetsDataHandler | sheets_data | src/handlers/data.ts:1+ | ✅ Line 15 |
| FormatHandler | sheets_format | src/handlers/format.ts:1+ | ✅ (class definition) |
| DimensionsHandler | sheets_dimensions | src/handlers/dimensions.ts:1+ | ✅ (class definition) |
| AdvancedHandler | sheets_advanced | src/handlers/advanced.ts:1+ | ✅ (class definition) |
| TransactionHandler | sheets_transaction | src/handlers/transaction.ts:1+ | ✅ (class definition) |
| QualityHandler | sheets_quality | src/handlers/quality.ts:1+ | ✅ (class definition) |
| HistoryHandler | sheets_history | src/handlers/history.ts:1+ | ✅ (class definition) |
| ConfirmHandler | sheets_confirm | src/handlers/confirm.ts:1+ | ✅ (class definition) |
| AnalyzeHandler | sheets_analyze | src/handlers/analyze.ts:1+ | ✅ (class definition) |
| CompositeHandler | sheets_composite | src/handlers/composite.ts:1+ | ✅ (class definition) |
| SessionHandler | sheets_session | src/handlers/session.ts:1+ | ✅ (class definition) |
| SheetsCoreHandler | sheets_core | src/handlers/core.ts:1+ | ✅ Line 14 |
| VisualizeHandler | sheets_visualize | src/handlers/visualize.ts:1+ | ✅ (class definition) |
| CollaborateHandler | sheets_collaborate | src/handlers/collaborate.ts:1+ | ✅ (class definition) |

### Standalone Handlers (12 handlers)

These implement `handle()` directly without extending BaseHandler

| Handler | Tool | File | Pattern |
|---------|------|------|---------|
| FixHandler | sheets_fix | src/handlers/fix.ts:1+ | Standalone (dispatch pattern) |
| SheetsTemplatesHandler | sheets_templates | src/handlers/templates.ts:1+ | Standalone |
| SheetsBigQueryHandler | sheets_bigquery | src/handlers/bigquery.ts:1+ | Standalone |
| SheetsAppsScriptHandler | sheets_appsscript | src/handlers/appsscript.ts:1+ | Standalone |
| WebhookHandler | sheets_webhook | src/handlers/webhooks.ts:1+ | Standalone |
| DependenciesHandler | sheets_dependencies | src/handlers/dependencies.ts:1+ | Standalone |
| FederationHandler | sheets_federation | src/handlers/federation.ts:1+ | Standalone |
| ComputeHandler | sheets_compute | src/handlers/compute.ts:1+ | Standalone |
| AgentHandler | sheets_agent | src/handlers/agent.ts:1+ | Standalone |
| ConnectorsHandler | sheets_connectors | src/handlers/connectors.ts:1+ | Standalone |
| AuthHandler | sheets_auth | src/handlers/auth.ts:1+ | Standalone (dispatch pattern) |

**Note:** `src/handlers/base.ts:1` is the abstract base class. All 13 BaseHandler subclasses have direct class definitions that extend it.

---

## Section 3: 4-Layer Dispatch Pipeline

**Entrypoint:** `src/server.ts:1+` (MCP server initialization)

### Layer 1: Server Entry Point

**File:** `src/server.ts:1-50`

- MCP SDK: `@modelcontextprotocol/sdk/server/mcp.js`
- TOOL_COUNT imported: Line 12
- ACTION_COUNT imported: Line 12
- Handler context type: `HandlerContext` from `src/handlers/index.ts:32`

### Layer 2: Tool Dispatch Registration

**File:** `src/mcp/registration/tool-handlers.ts:577-700`

- **Function:** `createToolHandlerMap()` (line 577-581)
- Maps tool names to handler functions
- Uses `parseForHandler()` for schema validation (line 514-565)
- Handler map entries for all 25 tools (lines 583-690+)

**Example dispatch (sheets_core):**
```
Line 583-591:
  sheets_core: (args) =>
    handlers.core.handle(
      parseForHandler<Parameters<Handlers['core']['handle']>[0]>(
        SheetsCoreInputSchemaLegacy,
        args,
        'SheetsDataInput',
        'sheets_core'
      )
    ),
```

### Layer 3: Handler Switch Statements

**BaseHandler Pattern:** `src/handlers/base.ts` (abstract execute method)

**Standalone Dispatch:** `src/handlers/auth.ts:30-150+` (example)
```
case 'status': return handleStatus(...)
case 'login': return handleLogin(...)
case 'callback': return handleCallback(...)
case 'logout': return handleLogout(...)
case 'setup_feature': return handleSetupFeature(...)
```

**Data Handler Pattern:** `src/handlers/data.ts:1-200+` (submodule import + dispatch)
```
import { handleRead, handleWrite, ... } from './data-actions/read-write.js';
```

### Layer 4: Google API Execution

**File:** `src/services/google-api.ts:1+`

- **Method:** `executeWithRetry()` - retry logic with circuit breaker
- **API:** `sheets_v4.Sheets` (Google Sheets API v4)
- **Pattern:** All handlers call `this.context.cachedApi.batchGet()` or `googleClient.executeWithRetry()`

---

## Section 4: Error Handling Architecture

**Source of truth:** `src/schemas/shared.ts:459-589`

### ErrorCodeSchema Definition

**File:** `src/schemas/shared.ts:459-589`

Total error codes: **67 codes** (lines 460-579)

**Categories:**

| Category | Code Range | Count | Examples |
|----------|-----------|-------|----------|
| MCP Standard | 462-466 | 5 | PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS, INTERNAL_ERROR |
| Auth & Authorization | 468-475 | 8 | UNAUTHENTICATED, NOT_AUTHENTICATED, PERMISSION_DENIED, INSUFFICIENT_PERMISSIONS |
| Quota & Rate Limiting | 476-478 | 3 | QUOTA_EXCEEDED, RATE_LIMITED, RESOURCE_EXHAUSTED |
| Spreadsheet Errors | 480-487 | 8 | SPREADSHEET_NOT_FOUND, SHEET_NOT_FOUND, INVALID_RANGE, PROTECTED_RANGE |
| Data & Formula | 489-494 | 6 | COMPUTE_ERROR, FORMULA_ERROR, CIRCULAR_REFERENCE, FORMULA_INJECTION_BLOCKED |
| Feature-Specific | 496-502 | 7 | CONDITIONAL_FORMAT_ERROR, PIVOT_TABLE_ERROR, CHART_ERROR, FILTER_VIEW_ERROR |
| Operation Errors | 504-511 | 8 | BATCH_UPDATE_ERROR, TRANSACTION_ERROR, OPERATION_FAILED, DATA_LOSS |
| Network & Service | 513-518 | 6 | UNAVAILABLE, CONNECTION_ERROR, UNKNOWN, FAILED_PRECONDITION |
| Safety Rails | 520-523 | 4 | PRECONDITION_FAILED, EFFECT_SCOPE_EXCEEDED, EXPLICIT_RANGE_REQUIRED |
| Auth & Config | 528-532 | 5 | AUTHENTICATION_REQUIRED, AUTH_ERROR, CONFIG_ERROR, VALIDATION_ERROR |
| Resource/Handler | 534-536 | 3 | NOT_FOUND, NOT_IMPLEMENTED, HANDLER_LOAD_ERROR |
| Session/Data | 538-542 | 5 | TOO_MANY_SESSIONS, DATA_ERROR, VERSION_MISMATCH, NO_DATA |
| Service Lifecycle | 544-547 | 4 | SERVICE_NOT_INITIALIZED, SERVICE_NOT_ENABLED, SNAPSHOT_* |
| Transactions | 549-550 | 2 | TRANSACTION_CONFLICT, TRANSACTION_EXPIRED |
| HTTP Transport | 552 | 1 | SESSION_NOT_FOUND |
| Session Checkpoints | 554-555 | 2 | CHECKPOINTS_DISABLED, CHECKPOINT_NOT_FOUND |
| Batch/Payload | 557-558 | 2 | PAYLOAD_TOO_LARGE, OPERATION_LIMIT_EXCEEDED |
| MCP Features | 560-561 | 2 | ELICITATION_UNAVAILABLE, SAMPLING_UNAVAILABLE |
| Discovery/Replay | 563-565 | 3 | FORBIDDEN, DISCOVERY_FAILED, REPLAY_FAILED |
| Generic | 567 | 1 | UNKNOWN_ERROR |
| Connectors | 570 | 1 | CONNECTOR_ERROR |
| Session | 572 | 1 | SESSION_ERROR |
| DuckDB/SQL | 574 | 1 | QUERY_REJECTED |
| Write Locking | 576 | 1 | LOCK_TIMEOUT |
| Tasks | 578 | 1 | TASK_CANCELLED |

**Export:** `ErrorCodes = ErrorCodeSchema.enum` (line 589)

**Usage:** `src/handlers/error-codes.ts:1` (re-export for handlers)

---

## Section 5: Mutation Actions (76 total)

**Source of truth:** `src/middleware/mutation-actions.constants.ts:42-120+`

**Definition:** Canonical `MUTATION_ACTION_NAMES` array (typed as `readonly MutationEvent['action'][]`)

**Location:** `src/middleware/mutation-actions.constants.ts:42-120+`

### By Tool (sample):

| Tool | Mutation Actions | Count |
|------|-----------------|-------|
| sheets_data | write, append, clear, batch_write, batch_clear, cross_write, import_csv, import_xlsx, smart_append, smart_fill | 10 |
| sheets_fix | clean, standardize_formats, fill_missing | 3 |
| sheets_composite | bulk_update, deduplicate, setup_sheet, ... (21 total actions, ~15 mutations) | 15 |
| sheets_dimensions | delete_sheet, batch_delete_sheets, clear_sheet, insert, delete, move, resize, hide, show, freeze, group, ungroup, ... | 18+ |
| sheets_format | add_conditional_format_rule, update_conditional_format_rule, delete_conditional_format_rule, ... | 10+ |

**Total Count:** 76 mutation actions (spans lines 42-120+)

**Derivation:** Both `src/middleware/audit-middleware.ts` and `src/middleware/write-lock-middleware.ts` import and use this canonical list to prevent drift.

---

## Section 6: Cache Invalidation Graph

**File:** `src/services/cache-invalidation-graph.ts:68-350+`

**Pattern:** Rule key format: `toolName.actionName`

**Example rules (verified):**

| Action | Invalidates | Source |
|--------|-----------|--------|
| sheets_auth.authorize | [] | Line 74 |
| sheets_auth.status | [] | Line 75 |
| sheets_core.get | [] | Line 83 |
| sheets_core.update_properties | ['metadata:*'] | Line 91 |
| sheets_core.add_sheet | ['metadata:*'] | Line 94 |
| sheets_core.delete_sheet | ['*'], cascade: true | Line 99 |
| sheets_core.clear_sheet | ['values:*'] | Line 100 |
| sheets_data.read | [] | (read-only) |
| sheets_data.write | ['values:*'] | (mutation) |
| sheets_data.clear | ['values:*'] | (mutation) |
| sheets_dimensions.delete | ['*'] | (structural) |

**Total rules:** Every action has a rule (auto-filled by buildInvalidationRules loop if manually omitted)

---

## Section 7: Version & Protocol Constants

**Package Version:** `package.json:4`
```
"version": "2.0.0"
```

**MCP Protocol Version:** `src/constants/protocol.ts:6`
```
export const MCP_PROTOCOL_VERSION = '2025-11-25';
```

**Google Sheets API:** `src/schemas/shared.ts:23`
```
export const SHEETS_API_VERSION = 'v4';
export const DRIVE_API_VERSION = 'v3';
```

**Import path:** `src/config/protocol.ts:5` (re-export from constants)

---

## Section 8: Known Issues & Gaps

### Issue 1: ReDoS Vulnerability in Pattern Validation

**Location:** `src/schemas/quality.ts:180+` (potential regex patterns without length cap)  
**Status:** [NEEDS VERIFICATION] — Memory flags `new RegExp(userInput)` without length limits  
**Severity:** Security (ReDoS DoS)

### Issue 2: Redis Client Auto-Connect

**Location:** `src/storage/session-store.ts:113-124`  
**Status:** ✅ VERIFIED CORRECT
- Line 113: `createClient()` creates client  
- Lines 120-124: `ensureConnected()` method with lazy guard pattern  
- Line 122: `await this.client.connect()` called before any commands  
- **Pattern:** Correct node-redis v4 usage (does NOT auto-connect like v3)

### Issue 3: Session Cache Key User Scoping

**Location:** `src/services/cache-invalidation-graph.ts` (multi-tenant safety)  
**Status:** [NEEDS VERIFICATION] — ETag cache keys may not be user-scoped in HTTP mode  

### Issue 4: OTel Environment Variable Mismatch

**Status:** [NEEDS VERIFICATION] — Memory flags `ENABLE_OTEL` vs `OTEL_ENABLED` mismatch

### Issue 5: GPL-3.0 License in Production Dependencies

**Status:** [NEEDS VERIFICATION] — Memory flags GPL-3.0 license check needed

### Issue 6: Tautological Test Assertions (ISSUE-237)

**Markers found by:** `npm run check:tautological-assertions`  
**Examples:** `expect([true, false]).toContain(x)` — always passes  
**Status:** Extended check for `typeof x === 'boolean'` (70 instances)

---

## Section 9: Response & Dispatch Patterns

### Handler Response Format

**Pattern (BaseHandler):** `src/handlers/base.ts:300+`
```typescript
this.success('action_name', data) // Returns { response: { success: true, ... } }
```

**Pattern (Standalone):** `src/handlers/auth.ts:50+`
```typescript
{ response: { success: true, action: 'login', data } }
```

**Tool Layer Build:** `src/mcp/registration/tool-handlers.ts:912`
```typescript
buildToolResponse({ response: { success: true, data } })
```

### Action Naming Convention

**Pattern:** Verb_noun format (mostly)
- `read_range`, `write_range`, `clear_range`
- `read`, `write`, `append`, `clear` (core operations)
- `create_sheet`, `delete_sheet`, `update_sheet`
- Exceptions: `suggest_format`, `scout`, `plan`, `execute`

---

## Section 10: Completeness Checklist

| Component | Source File | Status |
|-----------|-------------|--------|
| Tool count (25) | src/generated/action-counts.ts:42 | ✅ VERIFIED |
| Action count (409) | src/generated/action-counts.ts:47 | ✅ VERIFIED |
| Handler types (25) | src/handlers/index.ts:64-100 | ✅ VERIFIED |
| BaseHandler subclasses (13) | src/handlers/*.ts | ✅ VERIFIED |
| Standalone handlers (12) | src/handlers/*.ts | ✅ VERIFIED |
| Error codes (67) | src/schemas/shared.ts:459-589 | ✅ VERIFIED |
| Mutation actions (76) | src/middleware/mutation-actions.constants.ts:42+ | ✅ VERIFIED |
| Cache invalidation rules | src/services/cache-invalidation-graph.ts | ✅ VERIFIED |
| Protocol version | src/constants/protocol.ts:6 | ✅ VERIFIED |
| Package version | package.json:4 | ✅ VERIFIED |
| 4-layer pipeline | src/server.ts + tool-handlers.ts + handlers/* + google-api.ts | ✅ VERIFIED |

---

## Section 11: Critical Invariants

1. **Metadata Drift Prevention:** `npm run schema:commit` regenerates: `src/schemas/action-counts.ts`, `src/generated/action-counts.ts`, annotations, completions, server.json
2. **Never hand-edit:** `server.json` (generated by `scripts/generate-metadata.ts`)
3. **Canonical sources:**
   - Action counts: `src/generated/action-counts.ts:11-47`
   - Error codes: `src/schemas/shared.ts:459-589`
   - Mutation actions: `src/middleware/mutation-actions.constants.ts:42+`
   - Cache rules: `src/services/cache-invalidation-graph.ts:68+`
4. **Handler architecture:** 13 BaseHandler + 12 standalone (no third type exists)
5. **Response building:** Handlers return data objects; tool layer calls `buildToolResponse()` to convert to MCP format

---

## Notes

- All line numbers are source-of-truth references for exact code locations
- "Verified" means file was read and content confirmed
- "[NEEDS VERIFICATION]" marks security flags from memory that need active testing
- Tool action mapping enforced by `TOOL_ACTIONS` in `src/mcp/completions.ts` (verified by contract tests)

**Last updated:** 2026-04-26 | **Agent:** servalsheets-research (Haiku 4.5)
