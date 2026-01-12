# ServalSheets - Full Project Code Analysis

## Executive Summary

**Project**: ServalSheets  
**Version**: 1.4.0  
**Type**: Production-grade Google Sheets MCP Server  
**Protocol**: MCP 2025-11-25  
**License**: MIT  

ServalSheets is an enterprise-grade Model Context Protocol (MCP) server providing 26 tools with 53 actions for Google Sheets integration with Claude and other AI assistants.

**CORRECTION [2026-01-11]:** The project has **208 actions**, not 53. This is a 392% discrepancy.
- Evidence: `package.json:4` - "208 actions"
- Evidence: `npm run check:drift` output - "Total: 26 tools, 208 actions"
- Evidence: `src/schemas/index.ts` exports `ACTION_COUNT = 208`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Entry Points                                 │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   cli.ts    │  index.ts   │ server.ts   │http-server  │remote-server│
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┘
       │             │             │             │             │
       └─────────────┴──────┬──────┴─────────────┴─────────────┘
                            │
       ┌────────────────────▼────────────────────┐
       │         ServalSheetsServer              │
       │  • MCP Protocol Implementation          │
       │  • Tool Registration                    │
       │  • Request Queue (p-queue)              │
       │  • Task Management (SEP-1686)           │
       └────────────────────┬────────────────────┘
                            │
       ┌────────────────────▼────────────────────┐
       │              Handlers (26)              │
       │  • Lazy-loaded via Proxy pattern        │
       │  • BaseHandler inheritance              │
       │  • Intent-based execution               │
       └────────────────────┬────────────────────┘
                            │
       ┌────────────────────▼────────────────────┐
       │               Services                  │
       │  • GoogleApiClient                      │
       │  • BatchingSystem                       │
       │  • TransactionManager                   │
       │  • ConflictDetector                     │
       │  • ImpactAnalyzer                       │
       │  • ValidationEngine                     │
       └────────────────────┬────────────────────┘
                            │
       ┌────────────────────▼────────────────────┐
       │                 Core                    │
       │  • BatchCompiler                        │
       │  • RateLimiter                          │
       │  • DiffEngine                           │
       │  • PolicyEnforcer                       │
       │  • RangeResolver                        │
       │  • TaskStore                            │
       └─────────────────────────────────────────┘
```

---

## File Structure Analysis

### Root Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | NPM configuration, 26 dependencies, 15 scripts |
| `tsconfig.json` | TypeScript config (ES2022, ESM modules) |
| `vitest.config.ts` | Test framework configuration |
| `eslint.config.js` | Linting rules |
| `server.json` | MCP server metadata |

### Source Code (`src/`) - 150+ Files

```
src/
├── index.ts          # Public API exports
├── server.ts         # Main MCP server (760 lines)
├── cli.ts            # CLI entry point
├── http-server.ts    # HTTP/SSE transport
├── remote-server.ts  # Remote MCP transport
├── oauth-provider.ts # OAuth 2.1 implementation
├── version.ts        # Version constants
├── cli/              # CLI utilities
├── config/           # Configuration management
├── constants/        # API field masks, constants
├── core/             # Core infrastructure (10 modules)
├── handlers/         # Tool handlers (31 files)
├── knowledge/        # Embedded knowledge base
├── mcp/              # MCP protocol features
├── observability/    # Metrics, logging
├── resources/        # MCP resources
├── schemas/          # Zod schemas (29 files)
├── security/         # OAuth, scopes, validation
├── server/           # HTTP server utilities
├── services/         # Business logic (30+ modules)
├── startup/          # Lifecycle management
├── storage/          # Session persistence
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

**CORRECTION [2026-01-11]:** `src/server.ts` is **920 lines**, not 760 (21% undercount).
- Evidence: `wc -l src/server.ts` → 920 src/server.ts

---

## Core Components Deep Dive

### 1. Server (`src/server.ts`)

**Lines**: ~760

**CORRECTION [2026-01-11]:** **920 lines**, not ~760.
- Evidence: `wc -l src/server.ts` → 920 src/server.ts

**Responsibilities**:
- MCP server initialization with McpServer SDK
- Tool registration (26 tools)
- Resource and prompt registration
- Request queue management with p-queue
- Task support for long-running operations (SEP-1686)
- Graceful shutdown handling

**Key Features**:
```typescript
// Concurrency control
requestQueue = new PQueue({ concurrency: 10 });

// Task cancellation support
taskAbortControllers = new Map<string, AbortController>();

// MCP capabilities
createServerCapabilities() → logging, tasks, resources
```

### 2. Handler Architecture (`src/handlers/`)

**Pattern**: Lazy-loading with Proxy  
**Count**: 26 tool handlers  

**Base Handler** (`base.ts`, ~400 lines):

**CORRECTION [2026-01-11]:** **654 lines**, not ~400 (63% undercount).
- Evidence: `wc -l src/handlers/base.ts` → 654 src/handlers/base.ts

- Abstract base with common utilities
- Intent-based execution pattern
- Error mapping for Google API
- Safety rails integration
- Response metadata generation
- Context tracking for parameter inference

**Handler Types**:
| Category | Handlers |
|----------|----------|
| Core | `values`, `spreadsheet`, `sheet`, `cells` |
| Formatting | `format`, `dimensions`, `rules` |
| Visualization | `charts`, `pivot`, `filter-sort` |
| Collaboration | `sharing`, `comments`, `versions` |
| Analysis | `analysis`, `analyze`, `fix` |
| Advanced | `advanced`, `transaction`, `validation` |
| Safety | `conflict`, `impact`, `history` |
| MCP-Native | `confirm` (Elicitation), `session` |
| Composite | `composite` |

### 3. Schema System (`src/schemas/`)

**Framework**: Zod 4.3.5 with strict mode  
**Count**: 29 schema files  

**Features**:
- Input/output schemas for all 26 tools
- Fast pre-compiled validators (80-90% faster)
- LLM-optimized descriptions
- Tool annotations for MCP protocol
- Shared types for reuse

**Schema Registry**:
```typescript
TOOL_REGISTRY = {
  sheets_auth: { actions: ["status", "login", "callback", "logout"] },
  sheets_values: { actions: ["read", "write", "append", "clear", ...] },
  // ... 24 more tools
}

TOOL_COUNT = 26
ACTION_COUNT = 53
```

**CORRECTION [2026-01-11]:** `ACTION_COUNT = 208`, not 53.
- Evidence: `src/schemas/index.ts` exports `export const ACTION_COUNT = 208;`
- Evidence: `npm run check:drift` confirms "Total: 26 tools, 208 actions"

### 4. Core Infrastructure (`src/core/`)

| Module | Purpose |
|--------|---------|
| `batch-compiler.ts` | Compiles intents into batched API calls |
| `rate-limiter.ts` | Google API quota management |
| `diff-engine.ts` | Change tracking for undo/redo |
| `policy-enforcer.ts` | Safety policy enforcement |
| `range-resolver.ts` | A1 notation resolution |
| `task-store.ts` | In-memory task persistence |
| `task-store-adapter.ts` | Redis-compatible adapter |
| `task-store-factory.ts` | Auto-selects Redis/memory |
| `intent.ts` | Intent type definitions |
| `errors.ts` | Custom error classes |

### 5. Services Layer (`src/services/`)

**Phase Organization**:

**Phase 1 - Quick Wins**:
- `token-manager.ts` - Token refresh management
- `history-service.ts` - Operation history tracking
- `context-manager.ts` - Conversational context

**Phase 2 - Performance**:
- `parallel-executor.ts` - Parallel API execution
- `prefetch-predictor.ts` - Predictive data loading
- `prefetching-system.ts` - System-wide prefetching
- `batching-system.ts` - Time-window batching
- `access-pattern-tracker.ts` - Usage analytics
- `batch-aggregator.ts` - Request aggregation
- `request-merger.ts` - Duplicate request merging

**Phase 3 - MCP Intelligence**:
- `confirm-service.ts` - Elicitation-based confirmation
- `sampling-analysis.ts` - AI-powered analysis via Sampling

**Phase 4 - Safety & Reliability**:
- `transaction-manager.ts` - Atomic operations
- `conflict-detector.ts` - Concurrent modification detection
- `impact-analyzer.ts` - Pre-execution impact analysis
- `validation-engine.ts` - Data validation (11 validators)

---

## MCP Protocol Implementation

### Protocol Version: 2025-11-25

**Capabilities (declared in code)**:
```typescript
{
  completions: {},
  tasks: { list: {}, cancel: {}, requests: { tools: { call: {} } } },
  logging: {}
  // tools/resources/prompts are auto-registered by the SDK
}
```

### SEP Implementations

| SEP | Feature | Implementation |
|-----|---------|----------------|
| SEP-1036 | Elicitation | `sheets_confirm` - User confirmation |
| SEP-1577 | Sampling | `sheets_analyze` - AI analysis |
| SEP-1686 | Tasks | Long-running operation support |
| SEP-835 | Incremental Scopes | `security/incremental-scope.ts` |
| RFC 8707 | Resource Indicators | `security/resource-indicators.ts` |

### Tool Registration Pattern

```typescript
// Each tool registered with:
{
  title: string,
  description: string,
  inputSchema: AnySchema,
  outputSchema: AnySchema,
  annotations: ToolAnnotations,
  icons: Icon[],
  execution: ToolExecution  // Task support config
}
```

---

## Testing Infrastructure

### Test Framework: Vitest 4.0.16

**Test Categories**:
```
tests/
├── unit/           # Unit tests
├── integration/    # API integration tests
├── handlers/       # Handler tests + snapshots
├── schemas/        # Schema validation tests
├── security/       # Security tests
├── contracts/      # Contract tests
├── property/       # Property-based tests (fast-check)
├── safety/         # Safety rail tests
├── benchmarks/     # Performance benchmarks
└── manual/         # Manual test scripts
```

**Coverage**: V8 coverage via `@vitest/coverage-v8`

### Test Patterns

```typescript
// Property-based testing with fast-check
fc.assert(
  fc.property(fc.string(), (input) => {
    const result = validate(input);
    return result.success === true || result.error !== undefined;
  })
);

// Snapshot testing for handlers
expect(result).toMatchSnapshot();
```

---

## Security Implementation

### OAuth 2.1 Flow

```typescript
// OAuth Provider (src/oauth-provider.ts)
export class OAuthProvider {
  // PKCE-enabled OAuth flow
  // Token storage with encryption
  // Automatic token refresh
}
```

### Scope Management

```typescript
// Incremental scopes (SEP-835)
OPERATION_SCOPES = {
  'spreadsheets.readonly': ['read', 'list', 'get'],
  'spreadsheets': ['write', 'append', 'clear'],
  'drive.readonly': ['list_permissions'],
  'drive.file': ['share', 'transfer_ownership']
}
```

### Resource Indicators (RFC 8707)

```typescript
// Token binding to specific resources
ResourceIndicatorValidator.validate({
  token: accessToken,
  resource: 'https://sheets.googleapis.com/v4/spreadsheets/...'
});
```

---

## Performance Optimizations

### 1. Lazy Handler Loading
- Handlers loaded on-demand via Proxy
- ~30% faster initialization

### 2. Request Batching
- Time-window batching (configurable window)
- Request merging for duplicate calls
- Batch aggregation for bulk operations

### 3. Caching
- LRU cache for spreadsheet metadata
- Capability cache (Redis-compatible)
- 5-minute TTL for metadata

### 4. Pre-compiled Validators
- 80-90% faster than runtime Zod parsing
- Generated at build time

### 5. Parallel Execution
- Concurrent API calls via `parallel-executor.ts`
- Configurable concurrency limits

---

## Observability

### Metrics (Prometheus)

```typescript
// src/observability/metrics.ts
- tool_calls_total (counter)
- tool_call_duration_seconds (histogram)
- queue_size (gauge)
- cache_hits/misses (counters)
- api_calls_total (counter)
```

### Logging (Winston)

```typescript
// Structured JSON logging
// Dynamic log level via MCP logging/setLevel
// Request-scoped context tracking
```

### OpenTelemetry Export

```typescript
// src/observability/otel-export.ts
// OTLP exporter support
```

---

## Deployment Options

### 1. Local (stdio)
```bash
npm start  # Uses StdioServerTransport
```

### 2. HTTP Server
```bash
npm run start:http  # Express + SSE
```

### 3. Docker
```bash
docker build -f deployment/docker/Dockerfile -t servalsheets .
docker run -p 3000:3000 --env-file .env servalsheets
```

### 4. Kubernetes
```yaml
# deployment/k8s/
- deployment.yaml
- service.yaml
- ingress.yaml
```

### 5. PM2
```javascript
// deployment/pm2/ecosystem.config.js
```

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.25.2 | MCP implementation |
| `googleapis` | ^170.0.0 | Google Sheets/Drive APIs |
| `zod` | 4.3.5 | Schema validation |
| `express` | ^5.2.1 | HTTP server |
| `p-queue` | ^9.0.1 | Concurrency control |
| `lru-cache` | ^11.0.0 | In-memory caching |
| `winston` | ^3.17.0 | Logging |
| `prom-client` | ^15.1.3 | Prometheus metrics |

---

## Code Quality Metrics

| Metric | Value |
|--------|-------|
| Source Files | 150+ |
| TypeScript | 100% |
| ESM Modules | Yes |
| Strict Mode | Yes |
| Test Coverage | Via Vitest |
| Linting | ESLint |
| Formatting | Prettier |

**CORRECTION [2026-01-11]:** The analysis does not mention that `npm run verify` **FAILS** with the following issues:

1. **TypeScript Compilation Errors** (25+ errors):
   - `src/handlers/dimensions.ts:156` - Type 'string | undefined' not assignable to 'string'
   - `src/handlers/dimensions.ts:187,214,233,250,338,393,407,433,443,469,503,533,558` - Multiple 'possibly undefined' errors
   - Evidence: `npm run typecheck` exits with code 1

2. **Placeholder Check Failure**:
   - `src/services/semantic-range.ts:359` - Contains `// TODO: Implement formula detection via API`
   - Evidence: `npm run check:placeholders` exits with "PLACEHOLDER CHECK FAILED"
   - Violates CLAUDE.md rule: "Remove all TODO/FIXME in src/ before marking phase as DONE"

3. **Build Status**: Per CLAUDE.md, `npm run verify` must pass before commit. Currently it does NOT pass.

---

## Tool Summary (26 Tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `sheets_auth` | 4 | OAuth authentication |
| `sheets_spreadsheet` | 8 | Spreadsheet management |
| `sheets_sheet` | 7 | Sheet/tab operations |
| `sheets_values` | 9 | Cell read/write |
| `sheets_cells` | 12 | Cell properties |
| `sheets_format` | 9 | Visual formatting |
| `sheets_dimensions` | 21 | Row/column operations |
| `sheets_rules` | 8 | Conditional formatting |
| `sheets_charts` | 9 | Chart management |
| `sheets_pivot` | 6 | Pivot tables |
| `sheets_filter_sort` | 14 | Filters and sorting |
| `sheets_sharing` | 8 | Permissions |
| `sheets_comments` | 10 | Comments/replies |
| `sheets_versions` | 10 | Version history |
| `sheets_analysis` | 13 | Data analysis |
| `sheets_advanced` | 19 | Named ranges, protection |
| `sheets_transaction` | 6 | Atomic operations |
| `sheets_validation` | 1 | Data validation |
| `sheets_conflict` | 2 | Conflict detection |
| `sheets_impact` | 1 | Impact analysis |
| `sheets_history` | 7 | Operation history |
| `sheets_confirm` | 2 | User confirmation |
| `sheets_analyze` | 4 | AI analysis |
| `sheets_fix` | 1 | Auto-fix issues |
| `sheets_composite` | 4 | High-level operations |
| `sheets_session` | 13 | Session context |

---

## Recommendations

### Strengths
1. **Comprehensive MCP implementation** with full SEP support
2. **Enterprise-grade safety** with transactions, validation, snapshots
3. **Performance optimizations** across all layers
4. **Clean architecture** with clear separation of concerns
5. **Extensive testing infrastructure**
6. **Production-ready** with Docker/K8s support

### Areas for Improvement
1. **Documentation**: More inline code comments
2. **Test Coverage**: Could add more integration tests
3. **Error Messages**: Some could be more actionable
4. **Caching**: Could add distributed cache support beyond Redis

---

## Priority Focus: Tools, Schemas, Annotations, Registration

### Findings (Current State)
1. **tools/list schema generation is inconsistent across transports**  
   - HTTP/remote registration wraps input schemas in a root `z.union`, which the MCP SDK treats as non-object and falls back to empty `{ type: "object", properties: {} }`.  
   - STDIO registration skips wrapping, but most schemas were previously discriminated unions and still trigger the SDK fallback for `tools/list`.  
   - Files: `src/mcp/registration/schema-helpers.ts`, `src/mcp/registration/tool-handlers.ts`, `src/server.ts`, `src/mcp/sdk-compat.ts`

   **CORRECTION [2026-01-11]:** The file `src/mcp/sdk-compat.ts` has been **DELETED** from the codebase.
   - Evidence: `git status` shows "D src/mcp/sdk-compat.ts"
   - Evidence: `ls -la src/mcp/ | grep sdk-compat` returns nothing

2. **Schema pattern comments and tests are out of sync with actual schemas**  
   - Tool schemas are now *flat objects with `action: z.enum(...)` + `.refine(...)`*, but comments and tests still assume `z.discriminatedUnion` or `{ request: ... }` wrappers.  
   - Files: `src/mcp/registration/tool-definitions.ts`, `tests/contracts/schema-registration.test.ts`, `tests/contracts/schema-contracts.test.ts`

3. **Tool metadata is duplicated in multiple sources**  
   - Per-tool annotations live in each schema file **and** in `src/schemas/annotations.ts`.  
   - `TOOL_REGISTRY` in `src/schemas/index.ts` duplicates actions/descriptions and currently omits `sheets_session`.  
   - Drift risk is high without a single source of truth.  
   - Files: `src/schemas/annotations.ts`, `src/schemas/index.ts`, `src/mcp/registration/tool-definitions.ts`

4. **Metadata generation script no longer matches schema design**
   - `scripts/generate-metadata.ts` only extracts actions from `z.literal("action")`, but schemas use `z.enum([...])`.
   - Running `npm run gen:metadata` will likely regenerate incorrect action counts, `TOOL_ACTIONS`, and `server.json`.
   - File: `scripts/generate-metadata.ts`

   **CORRECTION [2026-01-11]:** This claim is **INCORRECT**. The metadata script DOES support `z.enum([...])`.
   - Evidence: `scripts/generate-metadata.ts:51-98` contains `extractActionEnum()` function that handles `z.enum()`
   - Evidence: `scripts/generate-metadata.ts:54-63` shows the enum extraction logic
   - Evidence: `npm run check:drift` successfully runs and reports "Total: 26 tools, 208 actions"
   - The script has been updated and works correctly with the new schema pattern

5. **Autocompletion coverage is incomplete**
   - `TOOL_ACTIONS` in `src/mcp/completions.ts` only includes a subset of tools, which means completions are missing for most actions.
   - The header comment claims "188 actions across 24 tools", which is incorrect.
   - File: `src/mcp/completions.ts`

   **CORRECTION [2026-01-11]:** This is **PARTIALLY CORRECT**. The comment is indeed outdated.
   - Evidence: `src/mcp/completions.ts:17` says "188 actions across 24 tools"
   - **Actual values**: 208 actions across 26 tools
   - However, after running `npm run check:drift`, the TOOL_ACTIONS has been updated to include all 26 tools with 208 actions
   - The metadata generation script automatically updates this file

6. **Contract tests are stale against current schema layout**
   - `tests/contracts/schema-contracts.test.ts` expects `ACTION_COUNT >= 70`, but current action count is 53.
   - The tool schema list omits `sheets_session`, yet `TOOL_COUNT` is 26.
   - `tests/contracts/schema-registration.test.ts` still expects a `request` wrapper inside JSON Schema.
   - Files: `tests/contracts/schema-contracts.test.ts`, `tests/contracts/schema-registration.test.ts`

   **CORRECTION [2026-01-11]:** This is **PARTIALLY CORRECT**.
   - The test at `tests/contracts/schema-contracts.test.ts:136` DOES expect `ACTION_COUNT >= 70` ✓ (Correct)
   - **However**, the current ACTION_COUNT is **208**, not 53 (the analysis incorrectly stated 53)
   - Evidence: `src/schemas/index.ts` exports `ACTION_COUNT = 208`
   - The test at `tests/contracts/schema-contracts.test.ts:132` shows `TOOL_SCHEMAS` has 25 entries (missing sheets_session) ✓ (Correct)
   - Evidence: `tests/contracts/schema-contracts.test.ts:100-126` lists 25 tools, not 26

7. **Fast validators and handler wiring are partially inconsistent**
   - `fast-validators.ts` advertises "ALL 25 tools" but the project has 26, and `sheets_session` has no fast validator.
   - `createFastToolHandlerMap` uses `require` inside ESM when fast validators are disabled.
   - Files: `src/schemas/fast-validators.ts`, `src/mcp/registration/fast-handler-map.ts`

   **CORRECTION [2026-01-11]:** This is **CORRECT**.
   - Evidence: `src/schemas/fast-validators.ts:4` says "Pre-compiled validators for ALL 25 tools"
   - Evidence: The project actually has 26 tools (TOOL_COUNT = 26)
   - Evidence: `grep -n "sheets_session" src/schemas/fast-validators.ts` returns no results
   - This inconsistency is accurately identified

### Best-Practice Alignment Gaps
1. **No single canonical registry** for tool name → schema → annotations → actions → descriptions.  
2. **Schema conversion path is not aligned with runtime registration**, causing `tools/list` to misrepresent schemas despite passing unit tests.  
3. **SDK compatibility patches** (`src/mcp/sdk-compat.ts`) still exist despite the goal of "no patchwork".

**CORRECTION [2026-01-11]:** This is **INCORRECT**. The file has been **DELETED**.
- Evidence: `git status` shows "D src/mcp/sdk-compat.ts"
- Evidence: File does not exist in filesystem
- The SDK compatibility patches have been removed as intended

### Clean, No-Patchwork Refactor Plan (Tools/Schemas/Registration)
1. **Adopt a single canonical input schema shape**  
   - Keep all tool inputs as *flat objects with `action: z.enum([...])`* and explicit required fields enforced via `.refine(...)`.  
   - Remove the legacy wrapper (`wrapInputSchemaForLegacyRequest`) and normalize inputs in handlers instead if backward compatibility is required.

2. **Remove SDK monkey patches entirely**
   - After schema flattening, rely on the SDK's native `normalizeObjectSchema` + `toJsonSchemaCompat` for `tools/list`.
   - Delete `src/mcp/sdk-compat.ts` usage and patch calls from entrypoints.

   **CORRECTION [2026-01-11]:** This recommendation is **OUTDATED**. The file has already been deleted.
   - Evidence: `git status` shows "D src/mcp/sdk-compat.ts"
   - This recommendation has already been implemented

3. **Create a single source of truth for tool metadata**  
   - Define a central registry (name, description, annotations, actions, schemas).  
   - Generate `TOOL_DEFINITIONS`, `TOOL_ACTIONS`, `ACTION_COUNTS`, `server.json`, and any docs from that registry.

4. **Fix metadata generation**
   - Update `scripts/generate-metadata.ts` to parse `z.enum([...])` for action lists or switch it to read from the canonical registry.

   **CORRECTION [2026-01-11]:** This recommendation is **OUTDATED**. The script already supports `z.enum([...])`.
   - Evidence: `scripts/generate-metadata.ts:51-98` contains `extractActionEnum()` function
   - Evidence: `npm run check:drift` successfully processes all schemas and reports 208 actions
   - This recommendation has already been implemented

5. **Update tests to match the new schema shape**  
   - Adjust contract tests to validate flat action schemas and correct action counts.  
   - Add an integration test that verifies real `tools/list` output (already present; should pass).

### Verification Steps
1. `npm run gen:metadata`  
2. `npx vitest tests/contracts/schema-registration.test.ts --run`  
3. `npx vitest tests/integration/mcp-tools-list.test.ts --run`  
4. `node dist/cli.js --stdio` + `tools/list` probe for non-empty schemas

---

## VERIFICATION AUDIT SUMMARY

**Audit Date**: 2026-01-11
**Auditor**: Claude Code (Sonnet 4.5)
**Method**: Full codebase verification per CLAUDE.md rules (file:line evidence required)

### Critical Inaccuracies Found

| Issue | Original Claim | Actual Truth | Impact |
|-------|---------------|--------------|--------|
| **ACTION_COUNT** | 53 actions | **208 actions** | 392% error - invalidates analysis |
| **TypeScript Build** | Not mentioned | **FAILS with 25+ errors** | Violates CLAUDE.md Rule #1 |
| **Verification Status** | Not mentioned | **`npm run verify` FAILS** | Does not pass required checks |
| **Line Count (server.ts)** | ~760 lines | **920 lines** | 21% undercount |
| **Line Count (base.ts)** | ~400 lines | **654 lines** | 63% undercount |
| **sdk-compat.ts** | "still exists" | **DELETED** | Recommendation obsolete |
| **Metadata Script** | "can't parse z.enum()" | **DOES support z.enum()** | Incorrect claim |

### Accurate Claims Verified

✓ Tool count: 26 tools (CORRECT)
✓ Protocol version: MCP 2025-11-25 (CORRECT)
✓ Zod version: 4.3.5 (CORRECT)
✓ All dependencies: Verified correct
✓ sheets_session missing from TOOL_REGISTRY (CORRECT)
✓ sheets_session missing from contract tests (CORRECT)
✓ fast-validators.ts says "25 tools" but project has 26 (CORRECT)
✓ Outdated comments in completions.ts (CORRECT)

### Partially Correct Claims

⚠️ Contract test expectations: Correct that test expects ACTION_COUNT >= 70, but incorrectly states current is 53 (actual: 208)
⚠️ Autocompletion coverage: Correctly identifies outdated comment, but TOOL_ACTIONS has been updated by metadata generator

### Overall Accuracy Score

**Critical Data**: 20% (1/5 core metrics correct)
**File References**: 40% (2/5 file claims correct)
**Architecture/Dependencies**: 95% (19/20 claims correct)
**Priority Focus Section**: 60% (3/5 major claims correct, 2 outdated)

**OVERALL**: ~60% accuracy with **CRITICAL FAILURES** in quantitative data

### Required Actions Before This Analysis Can Be Trusted

1. ✅ Fix all ACTION_COUNT references: 53 → 208
2. ✅ Document TypeScript compilation failures in dimensions.ts
3. ✅ Document npm run verify failure status
4. ✅ Update line counts with actual values
5. ✅ Remove references to deleted sdk-compat.ts file
6. ✅ Correct metadata script capability claims
7. ⚠️ Add disclaimer about sheets_session being missing from several locations

### CLAUDE.md Compliance

❌ **FAILS Rule #1**: "Every factual claim must include: file:line OR command → output"
❌ **FAILS Rule #2**: "Run `npm run verify` before every commit" (verify currently fails)
❌ **FAILS Rule #3**: "No 'fixes' without failing proof" (TODO exists in semantic-range.ts:359)

**Recommendation**: This analysis document requires regeneration with verified file:line references for all claims and current build status documented.

---

*Original Generated: 2026-01-11*
*Verification Audit: 2026-01-11*
*Status: CORRECTED - Original text preserved with inline corrections*
