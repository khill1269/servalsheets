# Claude Code Rules (ServalSheets)

**Auto-read file for Claude Code** - These rules are enforced by CI.

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

## Full Documentation

See `docs/development/CLAUDE_CODE_RULES.md` for complete rules with examples.
