# Claude Code Rules (ServalSheets)

**Auto-read file for Claude Code** - These rules are enforced by CI.

## Project Overview

ServalSheets is a production-grade MCP (Model Context Protocol) server for Google Sheets with 21 tools and 294 actions. It provides AI-powered spreadsheet operations with safety rails, transactions, batch operations, and enterprise features.

**Version:** 1.6.0 | **Protocol:** MCP 2025-11-25 | **Runtime:** Node.js + TypeScript (strict)

## Complete Architecture Map

### Entrypoints (3 transport modes)

| File | Transport | Usage |
|------|-----------|-------|
| `src/cli.ts` → `src/server.ts` | STDIO | Claude Desktop, CLI (default) |
| `src/http-server.ts` | HTTP/SSE/Streamable | Cloud deployment, connectors |
| `src/remote-server.ts` | HTTP + OAuth 2.1 | Multi-tenant remote access |

### Core Pipeline (request flow)

```
MCP Request → src/server.ts:handleToolCall()
  → src/mcp/registration/tool-handlers.ts:createToolCallHandler()
    → normalizeToolArgs() (legacy envelope handling)
    → Zod schema validation (src/schemas/*.ts)
    → src/handlers/*.ts:executeAction() (business logic)
      → src/services/google-api.ts (auto-retry + circuit breaker via Proxy)
        → Google Sheets/Drive/BigQuery API
    → buildToolResponse() (output schema validation + MCP formatting)
  → CallToolResult to client
```

### Directory Structure

```
src/
├── cli.ts                    # CLI entry + auth setup wizard
├── server.ts                 # STDIO MCP server (~900 lines)
├── http-server.ts            # HTTP MCP server + middleware chain
├── remote-server.ts          # OAuth wrapper over http-server
├── schemas/                  # Zod schemas (SOURCE OF TRUTH for actions)
│   ├── index.ts              # Re-exports + TOOL_COUNT/ACTION_COUNT constants
│   ├── annotations.ts        # Per-tool + per-action annotations (SEP-973)
│   ├── descriptions.ts       # LLM-optimized tool descriptions with decision guides
│   ├── fast-validators.ts    # Pre-Zod fast validation (0.1ms)
│   ├── auth.ts               # sheets_auth (4 actions)
│   ├── core.ts               # sheets_core (19 actions)
│   ├── data.ts               # sheets_data (18 actions)
│   ├── format.ts             # sheets_format (22 actions)
│   ├── dimensions.ts         # sheets_dimensions (28 actions)
│   ├── visualize.ts          # sheets_visualize (18 actions)
│   ├── collaborate.ts        # sheets_collaborate (35 actions)
│   ├── advanced.ts           # sheets_advanced (26 actions)
│   ├── transaction.ts        # sheets_transaction (6 actions)
│   ├── quality.ts            # sheets_quality (4 actions)
│   ├── history.ts            # sheets_history (7 actions)
│   ├── confirm.ts            # sheets_confirm (5 actions)
│   ├── analyze.ts            # sheets_analyze (16 actions)
│   ├── fix.ts                # sheets_fix (1 action)
│   ├── composite.ts          # sheets_composite (10 actions)
│   ├── session.ts            # sheets_session (26 actions)
│   ├── templates.ts          # sheets_templates (8 actions)
│   ├── bigquery.ts           # sheets_bigquery (14 actions)
│   ├── appsscript.ts         # sheets_appsscript (14 actions)
│   ├── webhook.ts            # sheets_webhook (6 actions)
│   └── dependencies.ts       # sheets_dependencies (7 actions)
├── handlers/                 # Business logic (1 per tool)
│   ├── base.ts               # BaseHandler (circuit breaker, instrumented API calls)
│   ├── auth.ts ... deps.ts   # 21 handler files matching schemas
│   └── index.ts              # Handler factory + registry
├── mcp/                      # MCP protocol layer
│   ├── registration/
│   │   ├── tool-definitions.ts    # TOOL_DEFINITIONS array (21 entries with input/output schemas)
│   │   ├── tool-handlers.ts       # createToolCallHandler + buildToolResponse
│   │   ├── schema-helpers.ts      # Zod → JSON Schema conversion + caching
│   │   ├── tools-list-compat.ts   # tools/list response formatting
│   │   └── extraction-helpers.ts  # Action/spreadsheetId/error extraction
│   ├── completions.ts        # TOOL_ACTIONS map for autocomplete
│   └── features-2025-11-25.ts # Server instructions + execution config
├── services/                 # Infrastructure services
│   ├── google-api.ts         # GoogleApiClient (auto-retry, circuit breaker, HTTP/2)
│   ├── transaction-manager.ts # Atomic batch operations
│   ├── user-rate-limiter.ts  # Per-user rate limiting (Redis)
│   ├── request-merger.ts     # Overlapping read merging
│   ├── circuit-breaker-registry.ts # Global circuit breaker tracking
│   ├── history-service.ts    # Operation history (undo/redo)
│   ├── session-context.ts    # Per-conversation state
│   ├── token-manager.ts      # Proactive OAuth token refresh
│   └── webhook-*.ts          # Webhook manager/queue/worker
├── middleware/               # HTTP middleware
│   └── redaction.ts          # Auto-redact tokens/keys from responses
├── utils/                    # Shared utilities
│   ├── retry.ts              # executeWithRetry (exponential backoff + jitter)
│   ├── circuit-breaker.ts    # CircuitBreaker (CLOSED/OPEN/HALF_OPEN)
│   ├── request-deduplication.ts # In-flight + result cache dedup
│   ├── action-intelligence.ts # Per-action hints, batch suggestions
│   ├── schema-compat.ts      # Zod v4 → JSON Schema conversion
│   ├── error-factory.ts      # Structured error creation (40+ codes)
│   ├── enhanced-errors.ts    # Google API error → ServalSheets error mapping
│   ├── request-context.ts    # Per-request context (tracing, deadline)
│   ├── response-compactor.ts # Context window pressure reduction
│   └── logger.ts             # Structured logging (Winston)
├── knowledge/                # AI knowledge base (40 files)
│   ├── api/                  # Google API guides
│   │   ├── error-handling.md           # Error recovery patterns (994 lines)
│   │   └── limits/quotas.json          # Quota details + optimization (622 lines)
│   ├── formulas/             # Spreadsheet formula reference
│   ├── masterclass/          # Deep-dive performance/security guides
│   ├── templates/            # Industry CRM/inventory/project templates
│   └── workflow-intelligence.json # Decision trees + anti-patterns (629 lines)
├── observability/            # Metrics + tracing
│   └── metrics.ts            # Prometheus metrics (prom-client)
├── resources/                # MCP resources
│   ├── schemas.ts            # schema://tools/{name} resource provider
│   └── temporary-storage.ts  # Large response overflow storage
├── config/                   # Configuration
│   ├── env.ts                # Environment variable parsing + defaults
│   └── oauth-scopes.ts       # Google OAuth scope management
└── core/                     # Core types + errors
    └── errors.ts             # Base error classes
```

### Test Structure

```
tests/
├── contracts/     # 667 schema guarantee tests (MUST always pass)
├── security/      # 34 security tests (redaction, input sanitization, resource indicators)
├── handlers/      # Handler unit tests (per-tool)
├── schemas/       # Schema validation tests
├── utils/         # Utility function tests
├── services/      # Service integration tests
├── unit/          # Pure unit tests
├── compliance/    # MCP protocol compliance tests
├── property/      # Property-based (fuzz) tests
├── safety/        # Safety rail tests
├── benchmarks/    # Performance benchmarks
├── live-api/      # Real Google API tests (requires TEST_REAL_API=true)
└── snapshots/     # Response snapshot tests
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `server.json` | MCP registry metadata + AI instructions (sent to all clients) |
| `package.json` | Dependencies, scripts, version |
| `tsconfig.json` | TypeScript strict mode config |
| `tsconfig.build.json` | Build-specific TS config |
| `eslint.config.js` | ESLint flat config |
| `vitest.config.ts` | Test runner config |
| `.dependency-cruiser.cjs` | Architecture rule enforcement |

### Reliability Infrastructure (automatic, opt-out)

| Feature | File | Default |
|---------|------|---------|
| Auto-retry (3x, exponential backoff) | `src/services/google-api.ts` via `wrapGoogleApi()` | ON |
| Circuit breaker (per-client) | `src/services/google-api.ts` via `wrapGoogleApi()` | ON |
| Request deduplication | `src/utils/request-deduplication.ts` | ON |
| Read merging (overlapping ranges) | `src/services/request-merger.ts` | ON |
| Output schema validation | `src/mcp/registration/tool-handlers.ts` | ON (advisory) |
| Response redaction (tokens/keys) | `src/middleware/redaction.ts` | ON in production |
| Per-user rate limiting | `src/http-server.ts` + `src/services/user-rate-limiter.ts` | ON (requires Redis) |
| HTTP/2 connection pooling | `src/services/google-api.ts` | ON |
| Proactive token refresh | `src/services/token-manager.ts` | ON |

## NO Documentation File Creation

**NEVER create these files:**

- Session logs, audit reports, analysis docs
- `*_REPORT.md`, `*_ANALYSIS.md`, `*_LOG.md`, `*_SUMMARY.md`
- Any markdown file documenting what you did
- Status updates, progress reports, implementation plans

**Instead:**

- Report findings directly in chat
- If user needs a file, they'll ask explicitly
- Code changes only - no meta-documentation

## Non-negotiable Workflow

1. **Verify before claiming:**
   - Every factual claim must include: `file:line` OR `command → output snippet`
   - Run `npm run verify` before every commit

2. **Trace execution paths:**
   - Prove reachability from an entrypoint:
     - STDIO: `src/cli.ts` → `src/server.ts` → handler
     - HTTP: `src/http-server.ts` → handler
     - Remote: `src/remote-server.ts` → handler

3. **No "fixes" without failing proof:**
   - Either reproduce with a script, or add a test that fails first
   - No exceptions for "obvious" fixes

4. **Minimal change policy:**
   - Prefer the smallest patch (≤3 src/ files unless tests require more)
   - Do NOT refactor while debugging
   - Schema changes may touch generated files (acceptable)

5. **No silent fallbacks:**
   - Never `return {}` or `return undefined` without logging
   - Use structured errors with `ErrorCode` enum
   - Run `npm run check:silent-fallbacks` to verify

## Required Verification Pipeline

```bash
# Full verification (MUST pass before commit)
npm run verify

# Individual checks
npm run typecheck           # TypeScript strict mode
npm run lint                # ESLint
npm run test                # 1700+ tests
npm run check:drift         # Metadata sync
npm run check:placeholders  # No TODO/FIXME in src/
npm run check:debug-prints  # No console.log in handlers
npm run check:silent-fallbacks  # No silent {} returns

# Build verification
npm run verify:build        # Build + validate + smoke
```

## Key Files to Focus On

- `src/server.ts` - MCP server entrypoint
- `src/mcp/registration/*` - Tool + schema registration
- `src/handlers/*` - Tool handlers (21 tools)
- `src/schemas/*` - Zod schemas (validation source of truth)
- `src/utils/schema-compat.ts` - Schema transformation layer
- `tests/contracts/*` - Contract tests (schema guarantees)

## ServalSheets-Specific Patterns

### Layered Validation (Performance Critical)

```typescript
// 1. Fast validators first (0.1ms)
fastValidateSpreadsheet(input);
// 2. Full Zod validation (1-2ms)
const validated = Schema.parse(input);
// 3. Shape checking in handler
if (!result.response) throw new ResponseValidationError(...);
```

### Response Builder (MCP Compliance)

```typescript
// ✅ Always use response builder
return buildToolResponse({ response: { success: true, data } });

// ❌ Never construct manually
return { content: [...], structuredContent: data };
```

### Structured Errors (40+ error codes)

```typescript
// ✅ Typed error
throw new SheetNotFoundError('Sheet not found', { spreadsheetId, sheetName });

// ❌ Generic error
throw new Error('Sheet not found');
```

## Audit Mode Prompt

When starting work, operate as an auditor:

1. Show the exact execution path (entrypoint → callsite)
2. Run `npm run verify` and report failures
3. Reproduce the bug with a failing test
4. Only then propose a minimal patch (≤3 files)
5. No refactors in the same PR

## Source of Truth Reference

**ALWAYS verify these values from their authoritative sources:**

| Metric               | Source File            | Current Value  |
| -------------------- | ---------------------- | -------------- |
| **ACTION_COUNT**     | `src/schemas/index.ts` | 294 actions    |
| **TOOL_COUNT**       | `src/schemas/index.ts` | 21 tools       |
| **Protocol Version** | `src/version.ts:14`    | MCP 2025-11-25 |
| **Zod Version**      | `package.json`         | 4.3.6          |
| **SDK Version**      | `package.json`         | 1.26.0         |

**How to verify:**

```bash
# Get current action/tool counts
npm run check:drift

# Get actual line counts
wc -l src/server.ts src/handlers/base.ts

# Verify protocol version
grep "MCP_PROTOCOL_VERSION" src/version.ts
```

**⚠️ NEVER hardcode these values in documentation** - always reference the source file with `file:line`.

---

## Metadata Generation (Automated)

The `scripts/generate-metadata.ts` script automatically updates these files:

**Input (Source of Truth):**

- `src/schemas/*.ts` - Individual tool schemas with `z.enum([...])` actions

**Output (Generated - DO NOT edit manually):**

- `package.json` - Description with tool/action counts
- `src/schemas/index.ts` - `TOOL_COUNT` and `ACTION_COUNT` constants
- `src/schemas/annotations.ts` - `ACTION_COUNTS` per-tool breakdown
- `src/mcp/completions.ts` - `TOOL_ACTIONS` for autocompletion
- `server.json` - Full MCP server metadata

**When to run:**

```bash
# After modifying any schema file
npm run gen:metadata

# Verify no drift
npm run check:drift
```

**The script supports:**

- ✅ `z.enum([...])` action arrays (current pattern)
- ✅ `z.literal('action')` single actions
- ✅ Special case tools (fix, validation, impact, analyze, confirm)

---

## Known Issues & Current Status

**Build Status:** ✅ **PASSING** (as of 2026-01-13)

All verification checks passing:

- TypeScript compilation: 0 errors
- Linting: Clean (0 errors, 41 warnings in CLI tool acceptable)
- Tests: 114 test files passing
- Metadata drift: None detected
- Placeholders: None found
- Silent fallbacks: None detected

**No Active Issues** - All previous TypeScript errors and verification issues have been resolved.

**Recent Improvements:**

1. Fixed all silent fallback warnings (6 instances across multiple files)
2. Added sheets_session tool to all registry locations
3. Completed Wave 5 consolidation (merged sheets_formulas into sheets_advanced)
4. Added Tier 7 enterprise tools (sheets_appsscript, sheets_bigquery, sheets_templates)
5. Current state: 21 tools with 294 actions
6. Synchronized metadata across all files
7. Fixed TypeScript strict mode issues in handlers

**Check current status:**

```bash
npm run verify 2>&1 | tee verify-output.txt
```

---

## Deleted Files (Do Not Reference)

**These files have been removed and should NOT be referenced:**

| File                                  | Deleted    | Reason                     | Replacement           |
| ------------------------------------- | ---------- | -------------------------- | --------------------- |
| `src/mcp/sdk-compat.ts`               | 2026-01-11 | Schema flattening complete | Native SDK conversion |
| `tests/contracts/sdk-compat.test.ts`  | 2026-01-11 | Test for deleted file      | N/A                   |
| `src/server-v2.ts`                    | 2026-01-14 | V2 architecture abandoned  | N/A                   |
| `src/server-compat.ts`                | 2026-01-14 | V2 architecture abandoned  | N/A                   |
| `src/migration-v1-to-v2.ts`           | 2026-01-14 | V2 architecture abandoned  | N/A                   |
| `src/schemas-v2/`                     | 2026-01-14 | V2 architecture abandoned  | N/A                   |
| `src/handlers-v2/`                    | 2026-01-14 | V2 architecture abandoned  | N/A                   |
| `src/services/snapshot-service.ts`    | 2026-01-14 | Unused V2 service          | N/A                   |
| `src/__tests__/handlers-v2.test.ts`   | 2026-01-14 | V2 test file               | N/A                   |
| `docs/archive/2026-01/`               | 2026-01-14 | Old debug logs             | N/A                   |
| `docs/archive/2026-01-debug-session/` | 2026-01-14 | Old debug logs             | N/A                   |

**Git evidence:** V2 files were never committed (untracked). Planning docs archived in `docs/archive/abandoned-v2/`

---

## sheets_session Tool

**Status:** ✅ Fully Implemented and Integrated

The `sheets_session` tool provides conversational context management.

**All locations now synchronized:**

- ✅ `src/schemas/session.ts` - Schema definition
- ✅ `src/handlers/session.ts` - Handler implementation
- ✅ `src/mcp/registration/tool-definitions.ts` - Registered
- ✅ `src/schemas/index.ts` - In `TOOL_REGISTRY` export
- ✅ `src/schemas/fast-validators.ts` - Comment updated to "ALL 21 tools"
- ✅ `tests/contracts/schema-contracts.test.ts` - TOOL_SCHEMAS array has 21 entries
- ✅ `src/mcp/completions.ts` - Comment updated to "294 actions across 21 tools"
- ✅ Tool is functional and working

**Note:** After Wave 5 consolidation and Tier 7 additions, we have 21 total tools with 294 actions (as of 2026-02-14)

---

## Server Consolidation (2026-01-14)

**Status:** ✅ Completed

The HTTP and OAuth servers have been consolidated into a single implementation.

**Current Architecture:**

- `src/server.ts` - STDIO transport (MCP over stdin/stdout)
- `src/http-server.ts` - HTTP/SSE transport with optional OAuth support
- `src/remote-server.ts` - Thin compatibility wrapper (calls http-server with OAuth enabled)

**Usage:**

```typescript
// Standard HTTP mode (token via Authorization header)
createHttpServer({ port: 3000 });

// OAuth mode (full OAuth 2.1 provider)
createHttpServer({
  port: 3000,
  enableOAuth: true,
  oauthConfig: {
    issuer: '...',
    clientId: '...',
    clientSecret: '...',
    jwtSecret: '...',
    stateSecret: '...',
    allowedRedirectUris: ['...'],
    googleClientId: '...',
    googleClientSecret: '...',
    accessTokenTtl: 3600,
    refreshTokenTtl: 604800,
  },
});

// Backward compatibility
startRemoteServer({ port: 3000 }); // Uses OAuth mode
```

**Code Reduction:** ~540 LOC of duplicated code eliminated

---

## Full Documentation

See `docs/development/CLAUDE_CODE_RULES.md` for complete rules with examples.
See `docs/development/PROJECT_STATUS.md` for detailed current build status.
See `docs/development/SOURCE_OF_TRUTH.md` for complete reference guide.
