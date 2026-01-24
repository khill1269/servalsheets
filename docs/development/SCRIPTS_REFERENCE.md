# ServalSheets - Scripts Reference

**Last Updated:** 2026-01-12
**Purpose:** Comprehensive documentation of all scripts in `scripts/`

---

## 🎯 Quick Reference

| Script | Purpose | Usage | Part of Verify |
|--------|---------|-------|----------------|
| `generate-metadata.ts` | Generate tool/action counts | `npm run gen:metadata` | Via `check:drift` |
| `check-metadata-drift.sh` | Verify metadata sync | `npm run check:drift` | ✅ Yes |
| `no-placeholders.sh` | Check for TODO/FIXME | `npm run check:placeholders` | ✅ Yes |
| `check-silent-fallbacks.sh` | Find silent returns | `npm run check:silent-fallbacks` | ✅ Yes |
| `check-debug-prints.sh` | Find console.log | `npm run check:debug-prints` | ✅ Yes |
| `check-commit-size.sh` | Warn on large commits | `npm run check:commit-size` | ❌ No |
| `show-tools-list-schemas.ts` | Display tool schemas | `npm run show:tools` | ❌ No |
| `show-metrics.ts` | Display Prometheus metrics | `npm run metrics` | ❌ No |
| `export-openapi.ts` | Generate OpenAPI spec | `npm run export-openapi` | ❌ No |

---

## 📝 Metadata Generation Scripts

### `generate-metadata.ts` ⭐ CRITICAL

**Purpose:** Single source of truth for tool/action metadata generation

**What it does:**
1. Parses all `src/schemas/*.ts` files using TypeScript AST
2. Extracts action arrays from `z.enum([...])` or `z.literal('action')`
3. Updates 5 generated files with correct counts

**Input (Source of Truth):**
- `src/schemas/*.ts` (all current tool schemas)
- Looks for:
  ```typescript
  action: z.enum(['action1', 'action2', ...])
  // OR
  action: z.literal('single_action')
  ```

**Output (Generated - DO NOT edit manually):**
- `package.json` - Updates description with `"16 tools, 207 actions"`
- `src/schemas/index.ts` - Updates `TOOL_COUNT` and `ACTION_COUNT` constants
- `src/schemas/annotations.ts` - Updates `ACTION_COUNTS` object
- `src/mcp/completions.ts` - Updates `TOOL_ACTIONS` object
- `server.json` - Regenerates full MCP server metadata

**Special Cases Handled:**
- `fix.ts` - Single action tool (no enum)
- `analyze.ts` - 11 actions (comprehensive, analyze_data, suggest_visualization, generate_formula, detect_patterns, analyze_structure, analyze_quality, analyze_performance, analyze_formulas, query_natural_language, explain_analysis)
- `confirm.ts` - 2 actions (request, get_stats)

**Usage:**
```bash
# After modifying any schema file
npm run gen:metadata

# Output:
# 📊 Analyzing 16 schema files...
#   📝 advanced.ts → 19 actions [add_named_range, update_named_range, ...]
#   ...
# ✅ Total: 16 tools, 207 actions
# ✅ Updated src/schemas/index.ts constants
# ✅ Updated src/schemas/annotations.ts ACTION_COUNTS
# ✅ Updated src/mcp/completions.ts TOOL_ACTIONS
# ✅ Generated server.json
```

**Algorithm Details:**
- Uses TypeScript Compiler API (`ts.createSourceFile()`)
- Traverses AST to find `z.enum()` and `z.literal()` calls
- Handles method chaining (`.describe()`, `.optional()`, etc.)
- Falls back to special cases for tools not following standard pattern

**Line Reference:** `scripts/generate-metadata.ts:1-400`

**Critical:** This script MUST be run after ANY schema modification.

---

### `check-metadata-drift.sh`

**Purpose:** Verify metadata is synchronized across all 5 generated files

**What it does:**
1. Runs `generate-metadata.ts` in dry-run mode
2. Compares output against current file contents
3. Reports any drift (files out of sync)

**Checks:**
- ✅ `package.json` - Description matches tool/action counts
- ✅ `src/schemas/index.ts` - Constants match
- ✅ `src/schemas/annotations.ts` - ACTION_COUNTS matches
- ✅ `src/mcp/completions.ts` - TOOL_ACTIONS matches
- ✅ `server.json` - Full metadata matches

**Usage:**
```bash
npm run check:drift

# Success output:
# ✅ No metadata drift detected - all 5 files are synchronized

# Failure output:
# ❌ Metadata drift detected in 2 files:
#   - package.json (expected 207 actions, found 53)
#   - src/schemas/index.ts (expected ACTION_COUNT = 207, found 53)
# Run 'npm run gen:metadata' to fix
```

**Part of:** `npm run verify` pipeline (critical check)

**Exit codes:**
- `0` - No drift
- `1` - Drift detected

---

## 🚨 Quality Check Scripts (Part of `npm run verify`)

### `no-placeholders.sh`

**Purpose:** Ensure no TODO/FIXME/HACK markers in `src/`

**What it checks:**
- `TODO` - Incomplete work
- `FIXME` - Known bugs
- `XXX` - Urgent attention needed
- `HACK` - Temporary solutions
- `stub` - Stub implementations
- `placeholder` - Placeholder code
- `simulate` - Simulation code
- `not implemented` - Unimplemented features
- `NotImplementedError` - Error for unimplemented features

**Exclusions:** (allowed in comments/docs)
- `tests/` directory
- `docs/` directory
- `*.md` files

**Usage:**
```bash
npm run check:placeholders

# Success:
# ✅ No placeholders found in source code

# Failure:
# ❌ PLACEHOLDER CHECK FAILED
# Found 1 placeholder(s) in source code:
# src/services/semantic-range.ts:359: // TODO: Implement formula detection
```

**Part of:** `npm run verify` pipeline

**Why it matters:** Per CLAUDE.md Rule #3, no TODOs allowed in `src/` before commit.

**Line Reference:** `scripts/no-placeholders.sh:1-100`

---

### `check-silent-fallbacks.sh`

**Purpose:** Find `return {}` or `return undefined` without logging

**What it checks:**
- `return {}` without preceding `logger.warn()` or `logger.error()`
- `return undefined` without logging
- Empty returns that could hide errors

**Allowed patterns:**
```typescript
// ✅ Good - logged
logger.warn('Empty result', { reason: '...' });
return {};

// ❌ Bad - silent
return {};
```

**Usage:**
```bash
npm run check:silent-fallbacks

# Success:
# ✅ No silent fallbacks detected

# Failure:
# ❌ Found 3 silent fallback(s):
# src/handlers/values.ts:234: return {};
# src/handlers/cells.ts:567: return undefined;
```

**Part of:** `npm run verify` pipeline

**Why it matters:** Per CLAUDE.md Rule #5, silent fallbacks hide errors and make debugging impossible.

---

### `check-debug-prints.sh`

**Purpose:** Find `console.log` in handlers (should use `logger` instead)

**What it checks:**
- `console.log()`
- `console.warn()`
- `console.error()`
- `console.debug()`

**Allowed:**
- `tests/` directory (test output is fine)
- `scripts/` directory (script output is fine)

**Usage:**
```bash
npm run check:debug-prints

# Success:
# ✅ No console.log statements in handlers

# Failure:
# ❌ Found 2 console.log statement(s):
# src/handlers/values.ts:123: console.log('Debug:', data);
```

**Part of:** `npm run verify` pipeline

**Why it matters:** Production code must use structured logging (`logger.debug()`, not `console.log()`).

---

## 📊 Diagnostic Scripts (NOT part of verify)

### `show-tools-list-schemas.ts`

**Purpose:** Display JSON schemas returned by `tools/list` MCP call

**What it shows:**
- Tool names
- Input schemas (JSON Schema format)
- Output schemas
- Annotations (hints)

**Usage:**
```bash
npm run show:tools

# Output:
# ┌─────────────────────┬────────────────┬──────────────┐
# │ Tool                │ Input Schema   │ Annotations  │
# ├─────────────────────┼────────────────┼──────────────┤
# │ sheets_auth         │ 4 actions      │ readOnly     │
# │ sheets_core  │ 8 actions      │ idempotent   │
# ...
```

**Use case:** Debugging schema registration issues

---

### `show-metrics.ts`

**Purpose:** Display current Prometheus metrics

**What it shows:**
- `tool_calls_total` - Counter per tool
- `tool_call_duration_seconds` - Histogram
- `queue_size` - Current queue depth
- `cache_hits_total` - Cache hit rate
- `api_calls_total` - Google API calls

**Usage:**
```bash
npm run metrics

# Output:
# 📊 ServalSheets Metrics
#
# Tool Calls:
#   sheets_auth: 142 calls
#   sheets_data: 523 calls
#   ...
#
# Performance:
#   p50 latency: 123ms
#   p95 latency: 456ms
#   p99 latency: 789ms
```

**Use case:** Performance analysis and monitoring

---

### `export-openapi.ts`

**Purpose:** Generate OpenAPI 3.1 specification from Zod schemas

**What it generates:**
- `docs/openapi.json` - Full OpenAPI spec
- `docs/openapi.yaml` - YAML format (optional)

**Usage:**
```bash
# JSON format (default)
npm run export-openapi

# YAML format
npm run export-openapi:yaml
```

**Output:** `docs/openapi.json` (500+ lines)

**Use case:** API documentation generation, Swagger UI integration

---

## 🔧 Development Scripts

### `check-commit-size.sh`

**Purpose:** Warn if commit touches >3 `src/` files (per CLAUDE.md Rule #4)

**What it checks:**
- Number of modified files in `src/`
- Excludes generated files (package.json, server.json, etc.)
- Warns if >3 files
- Fails if >10 files

**Usage:**
```bash
npm run check:commit-size

# Success (<= 3 files):
# ✅ Commit size OK: 2 src/ files modified

# Warning (4-10 files):
# ⚠️  Large commit: 5 src/ files modified
# Consider splitting into smaller commits

# Failure (>10 files):
# ❌ Commit too large: 12 src/ files modified
# Split into multiple commits (Rule #4)
```

**NOT part of verify** - advisory only

**Why it matters:** Per CLAUDE.md Rule #4, prefer ≤3 file changes for reviewability.

---

## 🧪 Benchmark Scripts

### `benchmark-validators.ts`

**Purpose:** Compare fast validators vs full Zod validation performance

**What it measures:**
- Fast validator speed (µs)
- Full Zod validation speed (ms)
- Speedup ratio

**Usage:**
```bash
tsx scripts/benchmark-validators.ts

# Output:
# ⚡ Validator Benchmarks
#
# Fast validators:    0.1ms  (100 µs)
# Full Zod:           1.2ms  (1200 µs)
# Speedup:            12x faster
```

---

### `benchmark-handlers.ts`

**Purpose:** Measure handler execution time for all tools

**Usage:**
```bash
tsx scripts/benchmark-handlers.ts

# Output per tool:
# sheets_auth:        45ms
# sheets_data:      123ms
# sheets_core: 89ms
# ...
```

---

### `benchmark-optimizations.ts`

**Purpose:** Compare batched vs unbatched API call performance

**Usage:**
```bash
tsx scripts/benchmark-optimizations.ts

# Output:
# Unbatched: 2.3s (10 calls)
# Batched:   0.3s (1 batch)
# Speedup:   7.6x faster
```

---

## 🔍 Investigation Scripts

### `diagnose-all.sh`

**Purpose:** Run all diagnostic scripts and collect output

**What it runs:**
1. `npm run check:drift`
2. `npm run check:placeholders`
3. `npm run check:silent-fallbacks`
4. `npm run check:debug-prints`
5. `npm run typecheck`
6. `npm test`

**Usage:**
```bash
bash scripts/diagnose-all.sh > diagnosis.txt

# Generates comprehensive report in diagnosis.txt
```

**Use case:** Debugging CI failures, collecting evidence for bug reports

---

## 📦 Installation Scripts

### `setup-oauth.sh`

**Purpose:** Run OAuth auth flow and generate Claude Desktop config for local testing

**What it does:**
1. Runs `dist/cli/auth-setup.js` (browser OAuth)
2. Writes `claude_desktop_config.json` pointing to `dist/cli.js`
3. Verifies tokens and config files

**Usage:**
```bash
./setup-oauth.sh
```

---

## 🔄 Workflow Integration

### Verification Pipeline (`npm run verify`)

**Order of execution:**
```
1. check:drift          (metadata sync)
2. check:placeholders   (no TODOs)
3. typecheck            (TypeScript strict mode)
4. lint                 (ESLint)
5. format:check         (Prettier)
6. test                 (1700+ tests via Vitest)
```

**All must pass before commit per CLAUDE.md Rule #1**

### Pre-Commit Workflow

```bash
# 1. Make changes
code src/schemas/values.ts

# 2. Regenerate metadata (if schema changed)
npm run gen:metadata

# 3. Run verification
npm run verify

# 4. Only commit if verify passes
git add .
git commit -m "feat: add new action to sheets_data"
```

---

## 📚 Script Categories Summary

| Category | Scripts | Purpose |
|----------|---------|---------|
| **Metadata** | `generate-metadata.ts`, `check-metadata-drift.sh` | Keep tool/action counts synchronized |
| **Quality** | `no-placeholders.sh`, `check-silent-fallbacks.sh`, `check-debug-prints.sh` | Enforce code quality standards |
| **Diagnostics** | `show-tools-list-schemas.ts`, `show-metrics.ts`, `diagnose-all.sh` | Debugging and inspection |
| **Benchmarks** | `benchmark-*.ts` | Performance measurement |
| **Development** | `check-commit-size.sh`, `quick-test.sh` | Developer workflow aids |
| **Integration** | `setup-oauth.sh`, `setup-vscode.sh` | Setup and configuration |
| **Export** | `export-openapi.ts` | Documentation generation |

---

## 🤖 For AI Assistants

**When working with scripts:**

1. **ALWAYS run `npm run gen:metadata`** after modifying any `src/schemas/*.ts` file
2. **ALWAYS run `npm run verify`** before claiming "changes complete"
3. **NEVER edit generated files** (package.json description, src/schemas/index.ts, etc.) - use the script
4. **Check PROJECT_STATUS.md** for current verification status before running

**Common mistakes:**
- ❌ Manually updating `ACTION_COUNT` → ✅ Run `npm run gen:metadata`
- ❌ Skipping verification → ✅ Always run `npm run verify`
- ❌ Leaving TODOs in src/ → ✅ Remove or move to issues

---

## 📖 References

- **CLAUDE.md** - Rules that scripts enforce
- **PROJECT_STATUS.md** - Current verification status
- **SOURCE_OF_TRUTH.md** - Where scripts get authoritative data
- **package.json** - Script definitions and npm commands

---

**All scripts follow CLAUDE.md rules and are designed to enforce code quality, maintainability, and verifiability.**
