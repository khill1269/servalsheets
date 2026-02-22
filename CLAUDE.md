# Claude Code Rules (ServalSheets)

> **Size cap: 300 lines.** If this file exceeds 300 lines, move content to `docs/`.
> Architecture reference: `docs/development/ARCHITECTURE.md`

## Live State & Session Context

Live project state (auto-generated): @.serval/state.md
Session notes (decisions, next steps): @.serval/session-notes.md

## Project Overview

ServalSheets is a production-grade MCP server for Google Sheets with 22 tools and 315 actions.
Runtime: Node.js + TypeScript (strict). See `src/schemas/index.ts` for authoritative counts.

### Core Pipeline

```
MCP Request → src/server.ts:handleToolCall()
  → src/mcp/registration/tool-handlers.ts:createToolCallHandler()
    → normalizeToolArgs() → Zod validation → handler.executeAction()
      → src/services/google-api.ts (auto-retry + circuit breaker)
    → buildToolResponse() → CallToolResult
```

Full 4-layer trace with line numbers: `docs/development/ARCHITECTURE.md`

## Non-negotiable Workflow

1. **Verify before claiming** — every fact needs `file:line` OR `command → output`
2. **Trace execution paths** — prove reachability from entrypoint (STDIO/HTTP/Remote)
3. **No "fixes" without failing proof** — reproduce with script or failing test first
4. **Minimal change policy** — ≤3 src/ files unless tests require more; no refactors while debugging
5. **No silent fallbacks** — never `return {}` without logging; use `ErrorCode` enum
6. **Dead code claims need proof** — run `npm run validate:dead-code <file> <start> <end>`
7. **Schema-handler alignment** — run `npm run validate:alignment`; deviations must be in `src/schemas/handler-deviations.ts`
8. **Audit docs must validate** — `npm run validate:audit` with `.github/AUDIT_TEMPLATE.md` format

## Verification (single canonical reference)

```bash
# Before every commit
npm run verify              # Full pipeline (typecheck + lint + test + drift + checks)
npm run verify:safe         # Skips lint (use when ESLint OOMs in low-memory envs)

# After schema changes (ONE command)
npm run schema:commit       # Regenerate metadata + verify + test + stage

# Quick checks (< 15 seconds each)
npm run check:drift         # Metadata sync
npm run test:fast           # Unit + contract tests
npm run typecheck           # TypeScript strict mode

# Individual checks
npm run check:placeholders  # No TODO/FIXME in src/
npm run check:debug-prints  # No console.log in handlers
npm run check:silent-fallbacks  # No silent {} returns
npm run validate:alignment  # Schema-handler alignment
npm run validate:audit      # Audit document validation

# Full gate pipeline
npm run gates               # G0-G5 validation gates
npm run verify:build        # Build + validate + smoke
```

## No Documentation File Creation

Never create `*_REPORT.md`, `*_ANALYSIS.md`, `*_LOG.md`, `*_SUMMARY.md`, or session logs.
Report findings in chat. Code changes only — no meta-documentation.

## Common Gotchas

### 1. Metadata Drift After Schema Changes

Modified `src/schemas/*.ts` without regenerating → CI fails "metadata drift detected".
**Fix:** `npm run schema:commit` after ANY schema change. This is the #1 CI failure cause.
Generated files: `src/schemas/index.ts`, `annotations.ts`, `src/mcp/completions.ts`, `server.json`, `package.json`.

### 2. Response Builder Anti-Pattern

```typescript
// ❌ Handler returns MCP format directly
return { content: [{ type: 'text', text: 'result' }] };
// ✅ Handler returns data; tool layer converts
return buildToolResponse({ response: { success: true, data } });
```

### 3. Hardcoded Counts

Always reference `src/schemas/index.ts:63` for TOOL_COUNT/ACTION_COUNT. Never hardcode.

### 4. Line Count Claims

Always run `wc -l file.ts`. Never use "~", "approximately", or "around".

### 5. Silent Fallbacks

```typescript
// ❌ if (!sheet) return {};
// ✅ if (!sheet) throw new SheetNotFoundError('Sheet not found', { spreadsheetId, sheetName });
```

### 6. Legacy Envelope Wrapping

Tests need `{ request: { action: 'read_range', ... } }` not `{ action: 'read_range', ... }`.
See `normalizeToolArgs()` in `tool-handlers.ts:81-118`.

## Key Files

- `src/server.ts` — MCP server entrypoint
- `src/mcp/registration/*` — Tool + schema registration
- `src/handlers/*` — 22 tool handlers (13 extend BaseHandler, 9 standalone)
- `src/schemas/*` — Zod schemas (validation source of truth)
- `tests/contracts/*` — Contract tests (schema guarantees)

## Code Patterns

### Layered Validation

```typescript
fastValidateSpreadsheet(input);                              // 0.1ms pre-Zod
const validated = Schema.parse(input);                       // Full Zod
if (!result.response) throw new ResponseValidationError();   // Shape check
```

### Structured Errors

```typescript
// ✅ Typed: throw new SheetNotFoundError('...', { spreadsheetId, sheetName });
// ❌ Generic: throw new Error('Sheet not found');
```

### Response Patterns

```typescript
// BaseHandler (13 handlers): return this.success('action', data, mutation);
// Standalone (9 handlers):   return { response: { success: true, action, ...data } };
// Error (both):              return { response: this.mapError(error) };
```

## Coding Style

### Import Ordering

```typescript
// 1. Google APIs / external    2. Internal domain (base handler)
// 3. Core types                4. Config
// 5. Services                  6. Utils
// 7. Schemas / types           8. MCP layer
```

### Naming Conventions

- Handler methods: `private async handle{ActionName}(input): Promise<Response>`
- Test mocks: `createMock{Type}()`
- Converters: `{source}To{target}()`
- Validators: `validate{Thing}()`
- Types: `{Tool}{Action}Input`, `{Tool}Output`

## Adding a New Action

**Step 1:** Schema in `src/schemas/{tool}.ts` — add to discriminated union
**Step 2:** Handler in `src/handlers/{tool}.ts` — add case + private method
**Step 3:** Test in `tests/handlers/{tool}.test.ts` — success + error paths
**Step 4:** `npm run schema:commit`

## Source of Truth

| Metric           | Source File            |
| ---------------- | ---------------------- |
| ACTION_COUNT     | `src/schemas/index.ts` |
| TOOL_COUNT       | `src/schemas/index.ts` |
| Protocol Version | `src/version.ts:14`    |

Never hardcode these values — always reference the source file with `file:line`.

## Audit Mode

1. Show exact execution path (entrypoint → callsite)
2. Run `npm run verify` and report failures
3. Reproduce bug with failing test
4. Propose minimal patch (≤3 files)
5. No refactors in same PR

## Known Issues

- ESLint may OOM in low-memory environments (~3GB heap needed) — use `verify:safe`
- Silent fallback checker: 0 false positives (all annotated with inline comments)

## Further Reading

- Architecture & directory structure: `docs/development/ARCHITECTURE.md`
- Complete rules with examples: `docs/development/CLAUDE_CODE_RULES.md`
- Current build status: `docs/development/PROJECT_STATUS.md`
- Source of truth reference: `docs/development/SOURCE_OF_TRUTH.md`
