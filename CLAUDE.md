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
- `src/handlers/*` - Tool handlers (26 tools)
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

| Metric | Source File | Current Value |
|--------|-------------|---------------|
| **ACTION_COUNT** | `src/schemas/index.ts` | 208 actions |
| **TOOL_COUNT** | `src/schemas/index.ts` | 26 tools |
| **Protocol Version** | `src/version.ts:14` | MCP 2025-11-25 |
| **Zod Version** | `package.json` | 4.3.5 |
| **SDK Version** | `package.json` | ^1.25.2 |

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

**Build Status:** ⚠️ **FAILING** (as of 2026-01-12)

**Active Issues:**
1. **TypeScript Compilation** (25+ errors)
   - File: `src/handlers/dimensions.ts:156,187,214,233,250,338,393,407,433,443,469,503,533,558`
   - Issue: `'string | undefined' not assignable to 'string'` and `'possibly undefined'` errors
   - Impact: Blocks `npm run typecheck`

2. **Placeholder Check** (1 TODO)
   - File: `src/services/semantic-range.ts:359`
   - Issue: `// TODO: Implement formula detection via API`
   - Impact: Blocks `npm run check:placeholders`

3. **Verification Pipeline**
   - Status: `npm run verify` currently **FAILS**
   - Per CLAUDE.md Rule #1: Must pass before commit
   - Blockers: TypeScript errors + placeholder check

**Check current status:**
```bash
npm run verify 2>&1 | tee verify-output.txt
```

---

## Deleted Files (Do Not Reference)

**These files have been removed and should NOT be referenced:**

| File | Deleted | Reason | Replacement |
|------|---------|--------|-------------|
| `src/mcp/sdk-compat.ts` | 2026-01-11 | Schema flattening complete | Native SDK conversion |
| `tests/contracts/sdk-compat.test.ts` | 2026-01-11 | Test for deleted file | N/A |

**Git evidence:** `git status` shows `D src/mcp/sdk-compat.ts`

---

## sheets_session Tool (26th Tool)

**Status:** ✅ Implemented, ⚠️ Missing from some locations

The `sheets_session` tool was added as the 26th tool for conversational context management.

**Locations where it EXISTS:**
- ✅ `src/schemas/session.ts` - Schema definition
- ✅ `src/handlers/session.ts` - Handler implementation
- ✅ `src/mcp/registration/tool-definitions.ts` - Registered
- ✅ Tool is functional and working

**Locations where it's MISSING** (needs fixing):
- ❌ `src/schemas/index.ts` - Not in `TOOL_REGISTRY` export
- ❌ `src/schemas/fast-validators.ts` - Comment says "ALL 25 tools" (should be 26)
- ❌ `tests/contracts/schema-contracts.test.ts` - TOOL_SCHEMAS array has 25 entries (missing session)
- ❌ `src/mcp/completions.ts` - Comment says "188 actions across 24 tools" (should be 208/26)

**TODO:** Add `sheets_session` to all registry locations and update comments.

---

## Full Documentation

See `docs/development/CLAUDE_CODE_RULES.md` for complete rules with examples.
See `docs/development/PROJECT_STATUS.md` for detailed current build status.
See `docs/development/SOURCE_OF_TRUTH.md` for complete reference guide.
