---
title: Developer Workflow Guide
category: development
last_updated: 2026-01-31
description: 'Version: 1.0'
version: 1.6.0
tags: [sheets]
---

# Developer Workflow Guide

**Version:** 1.0
**For:** Contributors to ServalSheets
**Time to read:** 20-30 minutes
**Last Updated:** 2026-01-11

---

## Table of Contents

1. [Quick Start (5 minutes)](#quick-start-5-minutes)
2. [Setup (First Time)](#setup-first-time)
3. [Development Loop](#development-loop)
4. [Testing Discipline](#testing-discipline)
5. [Pre-PR Checklist](#pre-pr-checklist)
6. [Common Tasks](#common-tasks)
7. [Debugging Patterns](#debugging-patterns)
8. [Anti-Patterns](#anti-patterns)

---

## Quick Start (5 minutes)

**Goal:** Make your first contribution in 5 minutes.

```bash
# 1. Clone and setup
git clone https://github.com/khill1269/servalsheets.git
cd servalsheets
npm install

# 2. Create feature branch
git checkout -b fix/your-bug-name

# 3. Make changes (≤3 files recommended)
# Example: Edit src/handlers/values.ts

# 4. Verify locally
npm run verify  # typecheck + lint + format + test + drift

# 5. Commit and push
git add .
git commit -m "fix(values): handle empty arrays gracefully"
git push origin fix/your-bug-name

# 6. Create PR
# GitHub will show PR template - fill it out
```

**That's it!** The CI will run checks. See sections below for details.

---

## Setup (First Time)

### Prerequisites

```bash
# Required
node --version    # v20.0.0 or higher
npm --version     # v10.0.0 or higher
git --version     # v2.0 or higher

# Recommended
brew install ripgrep  # Faster search for verification scripts
```

### Environment Variables

**For local development:**

```bash
# Copy example (if it exists)
cp .env.example .env

# Or create .env with these values:
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export NODE_ENV=development
export LOG_LEVEL=debug
```

**For testing:**

Tests use mock Google APIs by default (no real API calls required).

To test against real API (optional):

```bash
export TEST_REAL_API=true
npm run test:integration
```

### Verify Setup

```bash
npm run build     # Should complete without errors
npm test          # Should show 1761 passing tests
npm run verify    # Should pass all checks
```

If all three commands succeed, you're ready to contribute!

---

## Development Loop

Follow the **Red-Green-Refactor Cycle:**

### 1. Write Failing Test (Red 🔴)

```bash
# Create or edit test file
vim tests/handlers/values.test.ts

# Write test that fails
describe('values handler', () => {
  it('should handle empty arrays', async () => {
    const result = await handler.handle({
      action: 'read',
      spreadsheetId: 'test123',
      range: { a1: 'A1:A1' }
    });
    expect(result.values).toEqual([]);  // Currently fails
  });
});

# Run test to verify it fails
npm test tests/handlers/values.test.ts
# ❌ Expected [] but got undefined
```

### 2. Make It Pass (Green ✅)

```bash
# Edit handler
vim src/handlers/values.ts

# Add fix
if (!result.values || result.values.length === 0) {
  logger.debug('Empty values array', { spreadsheetId, range });
  return {
    response: {
      success: true,
      action: 'read',
      values: [],
      rowCount: 0
    }
  };
}

# Run test to verify it passes
npm test tests/handlers/values.test.ts
# ✅ 1 test passed
```

### 3. Refactor (Clean 🧹)

```bash
# Improve code quality
npm run lint       # Fix linting issues
npm run format     # Auto-format with Prettier
npm run typecheck  # Verify types

# Run all tests to ensure no regressions
npm test           # Should show 1762 passing tests now
```

### 4. Verify Before Commit

```bash
# Run full verification pipeline
npm run verify

# Output should show:
# ✅ Drift check passed
# ✅ No placeholders found
# ✅ Type check passed
# ✅ Lint passed
# ✅ Format check passed
# ✅ Tests passed (1762/1762)
```

---

## Testing Discipline

### Test Types

ServalSheets uses three types of tests:

#### 1. Unit Tests (70% of tests)

- **Location:** `tests/handlers/`, `tests/services/`, `tests/schemas/`
- **Purpose:** Test individual functions/classes in isolation
- **Speed:** <100ms each
- **Mocks:** Mock Google APIs, external services

**Example:**

```typescript
// tests/handlers/values.test.ts
describe('ValuesHandler', () => {
  it('should return empty array for empty range', async () => {
    // Arrange
    mockApi.spreadsheets.values.get.mockResolvedValue({ data: {} });

    // Act
    const result = await handler.handle({
      action: 'read',
      spreadsheetId: 'test123',
      range: { a1: 'A1:A1' },
    });

    // Assert
    expect(result.response.values).toEqual([]);
  });
});
```

#### 2. Integration Tests (25% of tests)

- **Location:** `tests/integration/`
- **Purpose:** Test handler + service + schema interactions
- **Speed:** <1s each
- **Mocks:** Minimal (may use real API with `TEST_REAL_API=true`)

**Example:**

```typescript
// tests/integration/mcp-tools-list.test.ts
describe('MCP tools/list integration', () => {
  it('should return all 21 tools with valid schemas', async () => {
    const tools = await server.listTools();

    expect(tools.tools).toHaveLength(16);
    tools.tools.forEach((tool) => {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.name).toMatch(/^sheets_/);
    });
  });
});
```

#### 3. Contract Tests (5% of tests)

- **Location:** `tests/contracts/`
- **Purpose:** Verify schema transformations preserve semantics
- **Speed:** <100ms each

**Example:**

```typescript
// tests/contracts/schema-transformation.test.ts
describe('Zod → JSON Schema → MCP transformation', () => {
  it('should preserve discriminated union structure', () => {
    const zodSchema = SheetsValuesInputSchema;
    const jsonSchema = zodToJsonSchemaCompat(zodSchema);

    expect(jsonSchema.oneOf).toBeDefined();
    expect(jsonSchema.oneOf.length).toBeGreaterThan(0);
    expect(jsonSchema.oneOf[0].properties.action.const).toBe('read');

    // Verify no Zod properties leaked through
    verifyJsonSchema(jsonSchema);
  });
});
```

### When to Write Tests

**Before fixing a bug (TDD):**

1. Write test that reproduces the bug (fails)
2. Fix the bug
3. Verify test now passes

**When adding a feature:**

1. Write test for new functionality (fails)
2. Implement feature
3. Verify test passes

**When refactoring:**

1. Ensure existing tests pass
2. Refactor code
3. Verify tests still pass (no behavior change)

### Test Naming Convention

```typescript
describe('[Module/Class name]', () => {
  describe('[method/function name]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

**Examples:**

- `should return values when range exists`
- `should return empty array when range is empty`
- `should throw NotFoundError when spreadsheet missing`

---

## Pre-PR Checklist

Before creating a pull request, verify:

### 1. Code Quality ✓

```bash
- [ ] npm run typecheck       # No TypeScript errors
- [ ] npm run lint            # No linting issues
- [ ] npm run format:check    # Code is formatted
```

### 2. Tests ✓

```bash
- [ ] npm test                # All tests pass (1761+)
- [ ] npm run test:coverage   # Coverage meets thresholds (75%+)
- [ ] Added tests for new code
- [ ] Added tests for bug fixes
```

### 3. Build ✓

```bash
- [ ] npm run build           # Compiles successfully
- [ ] npm run verify:build    # Build + validation + smoke test
```

### 4. Verification Scripts ✓

```bash
- [ ] npm run check:drift          # Metadata synchronized
- [ ] npm run check:placeholders   # No TODO/FIXME in src/
- [ ] npm run check:silent-fallbacks  # No silent {} returns
```

### 5. Clean Diff ✓

```bash
- [ ] git status              # Only relevant files staged
- [ ] git diff --staged       # Diff is clean and focused
- [ ] ≤3 src/ files modified (or justified in PR)
```

### 6. Commit Message ✓

```bash
- [ ] Follows convention: type(scope): description

Examples:
  fix(values): handle empty arrays gracefully
  feat(charts): add bar chart support
  docs(readme): update installation steps
  test(values): add edge case coverage
```

### 7. PR Description ✓

```markdown
- [ ] Evidence provided (file paths + line ranges)
- [ ] Execution path documented (if multi-layer)
- [ ] Test coverage linked
- [ ] Follows Claude Code Rules (see CLAUDE_CODE_RULES.md)
```

---

## Common Tasks

### Task 1: Add New Tool

**Time:** 30-60 minutes

```bash
# 1. Define schema
vim src/schemas/my-tool.ts

export const MyToolInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('do_thing'),
    spreadsheetId: z.string(),
    param: z.string()
  }),
]);

export const MyToolOutputSchema = z.object({
  response: z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      action: z.string(),
      data: z.unknown()
    }),
    z.object({
      success: z.literal(false),
      error: ErrorDetailSchema
    })
  ])
});

# 2. Create handler
vim src/handlers/my-tool.ts

export class MyToolHandler extends BaseHandler<MyToolInput, MyToolOutput> {
  async handle(input: MyToolInput): Promise<HandlerResult<MyToolOutput>> {
    // Implementation
    const result = await this.apiService.doSomething();

    return {
      response: {
        success: true,
        action: input.action,
        data: result
      }
    };
  }
}

# 3. Register tool
vim src/mcp/registration/tool-definitions.ts

// Add to TOOL_DEFINITIONS array
{
  name: 'sheets_mytool',
  description: 'Does something with spreadsheets',
  inputSchema: MyToolInputSchema,
  outputSchema: MyToolOutputSchema
}

# 4. Generate metadata
npm run gen:metadata
# Updates: package.json, src/schemas/index.ts, src/mcp/completions.ts, server.json

# 5. Add tests
vim tests/handlers/my-tool.test.ts

describe('MyToolHandler', () => {
  it('should do thing successfully', async () => {
    // Test implementation
  });
});

# 6. Verify
npm run verify
```

### Task 2: Modify Schema

**Time:** 15-30 minutes

```bash
# 1. Update schema
vim src/schemas/values.ts

# Add new optional field
export const ReadValuesInput = z.object({
  action: z.literal('read'),
  spreadsheetId: z.string(),
  range: RangeInputSchema,
  newField: z.string().optional(),  # ← New field
});

# 2. Regenerate metadata
npm run gen:metadata
# ✅ Updates 5 generated files automatically

# 3. Check drift
npm run check:drift
# ✅ No drift detected

# 4. Update tests
vim tests/handlers/values.test.ts

it('should handle new field', async () => {
  const result = await handler.handle({
    action: 'read',
    spreadsheetId: 'test123',
    range: { a1: 'A1:B10' },
    newField: 'test-value'
  });
  // Assertions
});

# 5. Update handler (if needed)
vim src/handlers/values.ts

# 6. Verify
npm run verify
```

### Task 3: Fix Bug

**Time:** 20-40 minutes

```bash
# 1. Reproduce bug with test (fails first)
vim tests/handlers/values.test.ts

it('should handle edge case X', async () => {
  const result = await handler.handle({
    action: 'read',
    spreadsheetId: 'test123',
    range: { a1: '' }  # Edge case: empty range
  });
  expect(result.response.success).toBe(true);
});

npm test tests/handlers/values.test.ts
# ❌ Fails as expected

# 2. Fix bug
vim src/handlers/values.ts

if (!input.range || !input.range.a1) {
  throw new ValidationError(
    'INVALID_RANGE',
    'Range A1 notation is required'
  );
}

# 3. Verify test passes
npm test tests/handlers/values.test.ts
# ✅ Passes now

# 4. Run full suite
npm test
# ✅ All tests pass (1762/1762)

# 5. Commit
git add tests/handlers/values.test.ts src/handlers/values.ts
git commit -m "fix(values): validate range A1 notation before processing"
```

---

## Debugging Patterns

### Pattern 1: Trace from Entrypoint

**Problem:** Handler returns unexpected result.

**Solution:** Trace execution path from CLI → handler.

```bash
# 1. Enable debug logging
export LOG_LEVEL=debug
export NODE_ENV=development

# 2. Add strategic logging (remove after debugging)
# Entry: src/cli.ts:75
console.log('[DEBUG] CLI input:', process.argv);

# Server: src/server.ts:123
console.log('[DEBUG] Tool call:', toolName, args);

# Handler: src/handlers/values.ts:89
console.log('[DEBUG] Handler input:', input);

# Service: src/services/google-api.ts:234
console.log('[DEBUG] API response:', result);

# 3. Run with debugger (optional)
node --inspect-brk dist/cli.js

# 4. Or examine logs
npm run dev | grep DEBUG
```

### Pattern 2: Verify Schemas

**Problem:** Zod validation fails unexpectedly.

**Solution:** Use schema inspection utilities.

```bash
# 1. Inspect schema in REPL
npm run dev

> import { SheetsValuesInputSchema } from './src/schemas/values.js';
> const result = SheetsValuesInputSchema.safeParse({
    action: 'read',
    spreadsheetId: 'test123'
  });
> console.log(result);
# { success: false, error: [ZodError: Missing range] }

# 2. Use verifyJsonSchema in development mode
# File: src/utils/schema-compat.ts

if (process.env.NODE_ENV === 'development') {
  verifyJsonSchema(inputSchema, 'SheetsValuesInput');
}

# 3. Run contract tests
npm test tests/contracts/
```

### Pattern 3: Isolate with Unit Test

**Problem:** Integration test fails, unclear which component.

**Solution:** Write focused unit test.

```bash
# 1. Create minimal reproduction
vim tests/debug/reproduce-bug.test.ts

describe('Bug isolation', () => {
  it('isolates the specific issue', () => {
    const handler = new ValuesHandler(mockContext, mockApi);

    const result = handler.formatResponse({ values: [] });

    expect(result).toBeDefined();  // Fails here - found the issue!
    expect(result.values).toEqual([]);
  });
});

npm test tests/debug/reproduce-bug.test.ts

# 2. Fix the isolated issue in src/handlers/values.ts

# 3. Remove debug test (or move to regular tests)
rm tests/debug/reproduce-bug.test.ts
```

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Silent Fallbacks

**Bad:**

```typescript
function getConfig(): Config {
  try {
    return loadConfig();
  } catch {
    return {}; // Silent failure - no logging!
  }
}
```

**Good:**

```typescript
function getConfig(): Config {
  try {
    return loadConfig();
  } catch (error) {
    logger.error('Failed to load config', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ConfigurationError('CONFIG_LOAD_FAILED', 'Unable to load configuration');
  }
}
```

### ❌ Anti-Pattern 2: Generic Errors

**Bad:**

```typescript
throw new Error('Something went wrong');
```

**Good:**

```typescript
throw new SheetNotFoundError(`Sheet "${sheetName}" not found in spreadsheet ${spreadsheetId}`, {
  spreadsheetId,
  sheetName,
  availableSheets,
});
```

### ❌ Anti-Pattern 3: Direct API Calls

**Bad:**

```typescript
const result = await googleapis.sheets.spreadsheets.values.get({
  spreadsheetId,
  range,
});
```

**Good:**

```typescript
const result = await this.sheetsService.readValues(spreadsheetId, range, {
  valueRenderOption: 'FORMATTED_VALUE',
});
```

**Why:** Service layer provides:

- Rate limiting
- Caching
- Error handling
- Retry logic
- Logging

### ❌ Anti-Pattern 4: Skipping Verification

**Bad:**

```bash
# Make changes
git add .
git commit -m "fix"
git push
# CI fails - wastes time
```

**Good:**

```bash
# Make changes
npm run verify  # Run locally first (2-3 minutes)
git add .
git commit -m "fix(values): handle empty arrays gracefully"
git push
# CI passes - saves time
```

---

## IDE Setup (Optional)

### VS Code

**Recommended extensions:**

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- TypeScript (`ms-vscode.vscode-typescript-next`)
- GitLens (`eamodio.gitlens`)
- Vitest (`vitest.explorer`)

**Settings (.vscode/settings.json):**

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "vitest.enable": true
}
```

### Debug Configuration (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/src/cli.ts",
      "runtimeArgs": ["-r", "tsx"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "${file}"]
    }
  ]
}
```

---

## Resources

### Internal Documentation

- **[Claude Code Rules](./CLAUDE_CODE_RULES.md)** - Contribution guidelines (required reading)
- **[Codebase Audit Report](./AUDIT_REPORT_2026-01-11.md)** - Current violations + good patterns
- **[Handler Patterns](./HANDLER_PATTERNS.md)** - Handler implementation guide
- **[Testing Guide](./TESTING.md)** - Comprehensive testing strategies
- **[Documentation Index](./DOCUMENTATION.md)** - Complete documentation map

### External Resources

- **[MCP Protocol Spec](https://spec.modelcontextprotocol.io)** - Model Context Protocol specification
- **[Google Sheets API v4](https://developers.google.com/sheets/api)** - Official API documentation
- **[Zod Documentation](https://zod.dev)** - Schema validation library
- **[Vitest Documentation](https://vitest.dev)** - Test framework

### Getting Help

- **GitHub Issues:** https://github.com/khill1269/servalsheets/issues
- **Discussions:** https://github.com/khill1269/servalsheets/discussions

---

## Version History

**v1.0 (2026-01-11):** Initial workflow guide

---

## Feedback

Found an issue or have a suggestion? Open an issue or PR!
