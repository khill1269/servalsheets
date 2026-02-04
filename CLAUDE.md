# Claude Code Rules (ServalSheets)

**Auto-read file for Claude Code** - These rules are enforced by CI.

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
| **ACTION_COUNT**     | `src/schemas/index.ts` | 293 actions    |
| **TOOL_COUNT**       | `src/schemas/index.ts` | 21 tools       |
| **Protocol Version** | `src/version.ts:14`    | MCP 2025-11-25 |
| **Zod Version**      | `package.json`         | 4.3.5          |
| **SDK Version**      | `package.json`         | ^1.25.2        |

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
5. Current state: 21 tools with 293 actions
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
- ✅ `src/mcp/completions.ts` - Comment updated to "293 actions across 21 tools"
- ✅ Tool is functional and working

**Note:** After Wave 5 consolidation and Tier 7 additions, we have 21 total tools with 293 actions (as of 2026-02-01)

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
