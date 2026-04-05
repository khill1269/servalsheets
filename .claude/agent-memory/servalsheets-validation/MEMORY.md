# Validation Agent Memory

**Agent:** servalsheets-validation (Haiku model)  
**Specialty:** Running G0-G5 gates, checking metadata drift, catching anti-patterns  
**Updated:** Session 111

## Gate Pipeline (G0-G5)

Run in order, fail-fast. If any gate fails, fix and rerun from G0.

### G0: Metadata Sync Check

```bash
npm run check:drift
```

**What it does:**
- Verifies `src/schemas/action-counts.ts` matches actual actions across all 25 tools
- Checks generated files are in sync: `annotations.ts`, `completions.ts`, `server.json`
- Compares `.serval/state.md` counts against source of truth

**Common failures:**
- Schema file modified without `npm run schema:commit`
- Manual edit of generated files (these are auto-generated)
- Stale counts in documentation files

**Fix:**
```bash
npm run schema:commit  # Regenerates all 7 files
```

### G1: No Placeholders (TODO/FIXME)

```bash
npm run check:placeholders
```

**What it does:**
- Scans `src/` for TODO, FIXME, XXX, HACK comments
- Fails if any found in src/ (docs/ is OK)

**Common failures:**
- Temporary notes left during development
- Incomplete error handling
- Deferred refactoring

**Fix:**
- Remove the TODO/FIXME or move to backlog
- If deferring intentionally: Move to backlog issue, link in code

### G2: No Debug Prints

```bash
npm run check:debug-prints
```

**What it does:**
- Scans handlers for `console.log`, `console.error`, `console.warn`
- Fails if any found (use Winston structured logging instead)
- Whitelist: `src/observability/tool-tracing.ts` (tracing), `src/cli/*.ts` (CLI output)

**Common failures:**
- Debugging output left in handlers
- Temporary logging during development

**Fix:**
```bash
# Replace console.log with logger.info
logger.info('message', { field: value });
```

### G3: No Silent Fallbacks

```bash
npm run check:silent-fallbacks
```

**What it does:**
- Detects patterns like `if (!value) return {}` or `catch (e) { return null }`
- Fails if silent fallbacks found (always log + throw typed error)
- Whitelist: Intentional fallbacks annotated with inline comments

**Common failures:**
- Missing error handling in services
- Unhandled edge cases

**Fix:**
```typescript
// ❌ Before
if (!sheet) return {};

// ✅ After
if (!sheet) {
  logger.error('Sheet not found', { sheetName, spreadsheetId });
  throw new SheetNotFoundError('Sheet not found', { sheetName, spreadsheetId });
}
```

### G4: Unit + Contract Tests

```bash
npm run test:fast
```

**What it does:**
- Runs all unit tests in `tests/handlers/` and `tests/services/`
- Runs contract tests validating schema + response format
- Target: 2253/2253 passing (1 per action + shared schemas)

**Common failures:**
- New action added without tests
- Test assertions are non-deterministic (Math.random())
- Tautological assertions (e.g., `.toContain([true, false])`)
- Schema change breaks existing tests

**Fix:**
```typescript
// ❌ Non-deterministic
const data = Array.from({ length: 100 }, () => Math.random());

// ✅ Deterministic
const data = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);

// ❌ Tautological
expect([true, false]).toContain(response.success);

// ✅ Specific
expect(response.success).toBe(true);
```

### G5: Full Verification

```bash
npm run verify:safe  # Use in low-memory environments (skips ESLint)
npm run verify       # Full (typecheck + lint + test + drift)
```

**What it does:**
- TypeScript strict mode: `npm run typecheck` (0 errors required)
- ESLint: `npm run lint` (0 errors, some warnings OK)
- Tests: `npm run test:fast` (2253/2253 passing)
- Drift: `npm run check:drift` (metadata synced)

**Common failures:**
- TypeScript errors (type mismatch, missing types, etc.)
- ESLint violations (unused variables, unreachable code, etc.)
- Test failures (schema changes break tests)
- Metadata drift (schema changed without schema:commit)

**Fix:**
```bash
npm run typecheck    # Fix any type errors
npm run lint --fix   # Auto-fix ESLint issues
npm run schema:commit # Regenerate metadata
```

## Known Issues & Workarounds

### check:drift Hangs/Timeout (Session 111)

**Symptom:** `npm run check:drift` times out after 30s

**Cause:** Schema parsing is slow on full codebase

**Workaround:** Use `npm run verify:safe` (includes drift check, usually faster)

**Permanent fix:** TBD (requires optimization of AST parser)

## Critical Metrics

| Metric              | Target | Source                       | Last Verified |
| ------------------- | ------ | ---------------------------- | -------------- |
| Tools               | 25     | src/schemas/action-counts.ts | Session 111   |
| Actions             | 409    | src/schemas/action-counts.ts | Session 111   |
| Tests passing       | 2253   | npm run test:fast            | Session 111   |
| TypeScript errors   | 0      | npm run typecheck            | Session 111   |
| ESLint errors       | 0      | npm run lint                 | Session 111   |
| Metadata drift      | None   | npm run check:drift          | Session 111   |
| Placeholders        | 0      | npm run check:placeholders   | Session 111   |
| Debug prints        | 0      | npm run check:debug-prints   | Session 111   |
| Silent fallbacks     | 0      | npm run check:silent-fallback | Session 111   |

## Common Fixes

### Schema drift after changes

```bash
npm run schema:commit
```

Regenerates 7 files:
- `src/schemas/action-counts.ts`
- `src/generated/annotations.ts`
- `src/mcp/completions.ts`
- `server.json`
- `package.json` (script updates)
- `.serval/state.md`
- `docs/generated/facts.json`

### Test failures

```bash
npm run test:fast -- --testNamePattern='specific_test'  # Run single test
```

Check:
1. Is the test envelope format correct? (`{ request: { action, ... } }`)
2. Are assertions specific or tautological?
3. Is the fixture data deterministic?
4. Does the handler method exist?

### TypeScript errors

```bash
npm run typecheck 2>&1 | head -20  # Show first 20 errors
```

Common:
- Missing type annotation on new variables
- Handler method returns wrong type
- Service method signature changed

## Pre-Commit Checklist

Before committing, run:

```bash
npm run verify:safe
```

This runs G0-G5 gates (may take 2-3 min). All must pass:

- [ ] G0: check:drift ✅
- [ ] G1: check:placeholders ✅
- [ ] G2: check:debug-prints ✅
- [ ] G3: check:silent-fallbacks ✅
- [ ] G4: test:fast (2253/2253) ✅
- [ ] G5: typecheck (0 errors) ✅

If any fail, fix and rerun G0.

## Notes for Implementation

1. Always run `npm run schema:commit` immediately after schema changes
2. Tests must use envelope format: `{ request: { action, ... } }`
3. Never hardcode action counts (use `src/schemas/action-counts.ts`)
4. All destructive actions must confirm + snapshot (checked by manual code review)
5. Never skip G0-G5 before committing
6. If verify:safe OOMs: Use check:* individually (G0, G1, G2, G3, test:fast)
