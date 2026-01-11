# Claude Code Rules for ServalSheets

**Version:** 1.0
**Applies to:** All contributions via Claude Code
**Last Updated:** 2026-01-11
**Enforcement:** CI checks + manual review

---

## Overview

These rules emerged from analyzing 16,851 lines of production code and 1761 tests in ServalSheets. They ensure consistent quality, maintainability, and verifiability of all changes.

**Quick Navigation:**
- [Core Principles (5 Rules)](#core-principles)
- [ServalSheets-Specific Patterns](#servalsheets-specific-patterns)
- [Enforcement Mechanisms](#enforcement-mechanisms)
- [Common Violations & Fixes](#common-violations--fixes)
- [Quick Reference Card](#quick-reference-card)

---

## Core Principles

### Rule 1: Verify Before Claiming ✓

**Policy:** Every factual claim must be backed by evidence.

**Requirements:**
- File paths with line ranges: `src/handlers/values.ts:123-145`
- Command outputs: Show the actual command + relevant output
- Test results: Include test name + assertion that passed

**Examples:**

✅ **Good:**
```
Changed error handling in src/handlers/values.ts:234-239:
  if (!result.values) {
    logger.warn('Empty values array', { spreadsheetId, range });
    return { success: true, values: [], rowCount: 0 };
  }
```

❌ **Bad:**
```
Fixed error handling in the values handler
```

**Enforcement:**
- Manual code review checks for evidence
- PR template requires "Evidence" section

---

### Rule 2: Trace Execution Paths from Entrypoint ↓

**Policy:** Understand the full call stack before making changes.

**Requirements:**
- Start from one of these entrypoints:
  - **STDIO:** `src/cli.ts` → `src/server.ts` → handler
  - **HTTP:** `src/http-server.ts` → handler
  - **Remote:** `src/remote-server.ts` → handler
- Document the path: CLI → Server → Registration → Handler → Service → API
- Verify data transformations at each layer

**Examples:**

✅ **Good:**
```
Traced sheets_values read action:
1. cli.ts:75 - Parse args, load env
2. server.ts:123 - Create McpServer, register tools
3. registration/tool-handlers.ts:45 - Route to ValuesHandler
4. handlers/values.ts:89 - Extract range, call service
5. services/google-api.ts:234 - Make API call
6. handlers/values.ts:112 - Format response per schema
```

❌ **Bad:**
```
The handler calls the API and returns the result
```

**Why it matters:**
- ServalSheets uses layered validation (fast → full → shape checking)
- Schema transformations happen at multiple layers
- Response builders enforce MCP protocol compliance

**Enforcement:**
- Code review requirement for changes touching >1 layer
- Add test that exercises full stack

---

### Rule 3: No "Fixes" Without Failing Proof 🔴

**Policy:** Reproduce the bug OR write a failing test before fixing.

**Requirements:**
- For bug fixes: Include reproduction steps + error message
- For refactors: Include test showing current behavior
- For new features: Include test showing missing functionality

**Examples:**

✅ **Good:**
```
Bug: sheets_values returns undefined for empty ranges

Reproduction:
  1. npm test tests/handlers/values.test.ts:45
  2. Error: Expected { values: [] } but got undefined

Test added: tests/handlers/values.test.ts:123-145
```

❌ **Bad:**
```
Fixed a bug where empty ranges weren't handled properly
```

**Acceptable Exceptions:**
- Typos in comments/docs (provide git diff)
- Formatting-only changes (show prettier output)
- Dependency updates (show npm audit output)

**Enforcement:**
- CI: Run tests before and after change
- Pre-commit hook: Warn if no test files modified

---

### Rule 4: Minimal Change Policy (≤3 files) 📝

**Policy:** Limit scope to 3 files in `src/` unless tests require more.

**Requirements:**
- Changes to `src/`: ≤3 files
- **Exception:** Tests can add unlimited test files
- **Exception:** Docs can add unlimited markdown files
- **Exception:** Schema changes trigger metadata regeneration (5 files)

**When to break this rule:**
- Large refactors: Get approval in issue/PR description
- Schema changes: Expected to touch generated files (package.json, src/schemas/index.ts, src/mcp/completions.ts, server.json)
- Test infrastructure: Can add test helpers, mocks, fixtures

**Examples:**

✅ **Good (3 files):**
```
Modified:
  src/handlers/values.ts (add null check)
  src/schemas/values.ts (update type)
  tests/handlers/values.test.ts (add test case)
```

✅ **Good (schema change with generated files):**
```
Modified:
  src/schemas/values.ts (add new action)
Generated (by npm run gen:metadata):
  package.json (action count)
  src/schemas/index.ts (ACTION_COUNT)
  src/mcp/completions.ts (TOOL_ACTIONS)
  server.json (full metadata)
Added:
  tests/handlers/values.test.ts (test new action)
```

❌ **Bad (8 files):**
```
Modified in commit 1bf75a4:
  8 src/ files changed, 1873 insertions
  Mixed concerns: metrics server + heap monitor + session store + docs

Recommendation: Split into 4 PRs (one per concern)
```

**Enforcement:**
- Pre-commit hook: Warn if >3 `src/` files modified
- CI: Fail if >10 `src/` files modified (after excluding generated)
- Manual review: Large commits require justification in PR

---

### Rule 5: No Silent Fallbacks (Log + Fail) 🚨

**Policy:** Empty objects/undefined must be logged and intentional.

**Requirements:**
- Never return `{}` or `undefined` silently
- Always log warnings/errors before returning empty values
- Use structured errors with `ErrorCode` enum
- Document why empty return is acceptable

**Problem Pattern:**
```typescript
// ❌ Silent fallback - violates rule
function getConfig(): Config {
  try {
    return loadConfig();
  } catch (error) {
    return {};  // Silent failure!
  }
}
```

**Correct Patterns:**
```typescript
// ✅ Logged fallback - follows rule
function getConfig(): Config {
  try {
    return loadConfig();
  } catch (error) {
    logger.error('Failed to load config, using defaults', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return getDefaultConfig();  // Explicit default
  }
}

// ✅ Explicit failure - follows rule
function getConfig(): Config {
  const config = loadConfig();
  if (!config) {
    throw new ConfigurationError(
      'CONFIG_MISSING',
      'Configuration file not found'
    );
  }
  return config;
}
```

**Acceptable Silent Returns:**
- Optional chaining: `user?.preferences?.theme` (TypeScript enforces)
- Explicitly typed as optional: `function findUser(): User | undefined`
- Empty arrays for "no results": `return []` (with comment explaining)

**Enforcement:**
- Script: `npm run check:silent-fallbacks`
- Code review: Check for silent fallbacks
- Test coverage: Verify error paths log appropriately

---

## ServalSheets-Specific Patterns

### Pattern 1: Layered Validation

ServalSheets uses three validation tiers for performance:

1. **Fast validators** (`src/schemas/fast-validators.ts`): Quick checks before Zod
2. **Zod schemas** (`src/schemas/*.ts`): Full validation with parsing
3. **Shape checking** (handlers): Verify API responses match expected structure

**Rule:** Always use fast validators first for performance-critical paths.

**Example:**
```typescript
// Fast validation (0.1ms)
fastValidateSpreadsheet(input);

// Full Zod validation (1-2ms)
const validated = SheetsSpreadsheetInputSchema.parse(input);

// Shape checking (handler)
if (!result.response || typeof result.response !== 'object') {
  throw new ResponseValidationError('Invalid response shape');
}
```

### Pattern 2: Schema Compatibility Layer

**File:** `src/utils/schema-compat.ts`

**Purpose:** Bridge between Zod v3/v4, handle MCP SDK transformations.

**Rule:** Never call `schema.parse()` directly in handlers - use schema-compat helpers.

**Example:**
```typescript
// ❌ Bad: Direct parse
const result = schema.parse(input);

// ✅ Good: Use helper
const result = await safeParseAsync(schema, input);
```

### Pattern 3: Response Builders

**File:** `src/mcp/response-builder.ts`

**Purpose:** Ensure MCP protocol compliance (content + structuredContent).

**Rule:** Always use `buildToolResponse()` in handlers.

**Example:**
```typescript
// ❌ Bad: Manual response construction
return {
  content: [{ type: 'text', text: JSON.stringify(data) }],
  structuredContent: data
};

// ✅ Good: Use response builder
return buildToolResponse({
  response: {
    success: true,
    action: 'read',
    data
  }
});
```

### Pattern 4: Structured Errors

**File:** `src/utils/enhanced-errors.ts`

**Enum:** `ErrorCode` with 40+ codes (SHEET_NOT_FOUND, RATE_LIMITED, etc.)

**Rule:** Always throw typed errors, never generic `Error`.

**Example:**
```typescript
// ❌ Bad: Generic error
throw new Error('Sheet not found');

// ✅ Good: Structured error
throw new SheetNotFoundError(
  `Sheet "${sheetName}" not found in spreadsheet ${spreadsheetId}`,
  { spreadsheetId, sheetName, availableSheets }
);
```

### Pattern 5: Contract Tests

**Files:** `tests/contracts/schema-*.test.ts`

**Purpose:** Verify schema transformations preserve semantics.

**Rule:** Add contract test when modifying schema transformations.

**Example:**
```typescript
it('should preserve discriminated union structure', () => {
  const zodSchema = SheetsValuesInputSchema;
  const jsonSchema = zodToJsonSchemaCompat(zodSchema);

  expect(jsonSchema.oneOf).toBeDefined();
  expect(jsonSchema.oneOf[0].properties.action.const).toBe('read');
  verifyJsonSchema(jsonSchema); // No Zod properties
});
```

---

## Enforcement Mechanisms

### 1. CI Checks (Automated)

**File:** `.github/workflows/ci.yml`

**Existing checks:**
- `npm run typecheck` - TypeScript strict mode
- `npm run lint` - ESLint
- `npm run format:check` - Prettier
- `npm test` - 1761 tests
- `npm run check:drift` - Metadata synchronization
- `npm run check:placeholders` - No TODO/FIXME in `src/`

**New checks (added):**
- `npm run check:silent-fallbacks` - Detect `return {}` without logging
- `npm run check:debug-prints` - Detect console.log in `src/`
- `npm run check:commit-size` - Warn on >3 files changed

### 2. Verification Pipeline

**Command:** `npm run verify`

Runs in sequence:
1. check:drift
2. check:placeholders
3. typecheck
4. lint
5. format:check
6. test

**Always run before committing:**
```bash
npm run verify  # Must pass before git push
```

### 3. PR Template (Future)

**File:** `.github/PULL_REQUEST_TEMPLATE.md` (to be added)

**Required sections:**
- Evidence (file paths + line ranges)
- Execution path (if multi-layer change)
- Test coverage (link to test file)
- Checklist (rules 1-5)

### 4. Code Review Guidelines (Future)

**File:** `docs/development/CODE_REVIEW_GUIDELINES.md` (to be added)

**Review checklist:**
- [ ] Evidence provided for all claims
- [ ] Execution path documented for multi-layer changes
- [ ] Tests added/modified (no fixes without tests)
- [ ] ≤3 `src/` files modified (or justified)
- [ ] No silent fallbacks (log + fail)
- [ ] ServalSheets patterns followed

---

## Common Violations & Fixes

### Violation 1: Debug Prints in src/

**Count:** ~140 instances

**Analysis:**
- **Intentional (keep):** STDIO startup messages (~50 instances)
  - `src/resources/*.ts` - Resource registration (console.error to stderr)
  - `src/storage/session-store.ts:313,317` - Session store mode
- **Debugging (remove):** Debug prints (~15 instances)
  - `src/services/semantic-range.ts:427` - console.error in catch
  - `src/oauth-provider.ts:159` - console.warn
- **CLI Output (keep):** Interactive messages (~75 instances)
  - `src/cli.ts` - Version output
  - `src/cli/auth-setup.ts` - Setup wizard

**Fix for debugging prints:**
```typescript
// Before
console.error('Failed to get sheet structure:', error);

// After
logger.error('Failed to get sheet structure', {
  spreadsheetId,
  sheetId,
  error: error instanceof Error ? error.message : String(error)
});
```

**Detection:**
```bash
npm run check:debug-prints
```

---

### Violation 2: Silent Fallbacks

**Count:** 26 files

**Example locations:**
- `src/server.ts:773` - returns {} on error
- `src/mcp/registration/tool-handlers.ts:394` - returns {} without logging

**Fix:**
```typescript
// Before
} catch (error) {
  return {};
}

// After
} catch (error) {
  logger.error('Operation failed, returning empty result', {
    operation: 'getToolDefinition',
    error: error instanceof Error ? error.message : String(error)
  });
  return getDefaultToolDefinition(); // Explicit default
}
```

**Detection:**
```bash
npm run check:silent-fallbacks
```

---

### Violation 3: Large Commits

**Recent examples:**
- `1bf75a4` - 8 files, 1873 insertions (metrics + heap + session + docs)
- `eeb56fa` - 18 files, 5994 insertions (test fixes + optimizations)

**Recommendation:** Break into smaller PRs
```
# Instead of 1 large PR with 8 files:
PR #1: feat(metrics): add metrics server (2 files)
PR #2: feat(monitoring): add heap monitor (1 file)
PR #3: feat(session): enhance session store (1 file)
PR #4: docs: add production guides (docs only)
```

**Detection:**
```bash
npm run check:commit-size
```

---

## Quick Reference Card

### Pre-Commit Checklist

```bash
[ ] npm run verify          # All checks pass
[ ] ≤3 src/ files changed   # Or documented exception
[ ] Tests added/updated     # No fixes without tests
[ ] Evidence in commit msg  # File paths + line ranges
[ ] Follows 5 core rules    # Review above
```

### Common Commands

```bash
# Full verification
npm run verify

# Individual checks
npm run check:drift
npm run check:placeholders
npm run check:silent-fallbacks
npm run typecheck
npm run lint
npm test

# Build
npm run build
npm run verify:build
```

### Rule Summary

| Rule | Check | Fix |
|------|-------|-----|
| 1. Verify | File paths + line ranges provided? | Add evidence |
| 2. Trace | Execution path documented? | Document call stack |
| 3. Prove | Test fails before fix? | Add failing test |
| 4. Minimal | ≤3 src/ files modified? | Split into smaller PRs |
| 5. No Silent | Returns {} with logging? | Add logger.error() |

### When in Doubt

- **Ask in PR or issue** before making large changes
- **Reference this doc** for patterns and examples
- **Check audit report** (`AUDIT_REPORT_2026-01-11.md`) for anti-patterns

---

## Version History

**v1.0 (2026-01-11):** Initial rules based on codebase analysis

---

## Related Documentation

- **[Developer Workflow Guide](./DEVELOPER_WORKFLOW.md)** - Practical guide for contributors
- **[Codebase Audit Report](./AUDIT_REPORT_2026-01-11.md)** - Current violations and fixes
- **[Handler Patterns](./HANDLER_PATTERNS.md)** - Handler implementation patterns
- **[Testing Guide](./TESTING.md)** - Comprehensive testing strategies

---

## Questions?

- **Issue tracker:** https://github.com/khill1269/servalsheets/issues
- **Discussions:** https://github.com/khill1269/servalsheets/discussions
