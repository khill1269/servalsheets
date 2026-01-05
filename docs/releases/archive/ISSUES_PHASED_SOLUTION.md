# ServalSheets - Phased Issue Resolution Plan

**Date**: 2026-01-04
**Status**: 📋 Planning Complete
**Total Issues**: 23 identified
**Approach**: Strategic phased resolution

---

## Executive Summary

This document outlines a strategic, phased approach to resolve all identified issues in ServalSheets. Issues are grouped by impact and dependencies, with clear sequencing to prevent rework.

### Issue Categories
- **Critical/Blocking**: 4 issues (Version drift, tool registry mismatches, error codes)
- **API Contract**: 6 issues (Schema alignment, output contracts)
- **Feature Integration**: 5 issues (Response enhancer, dry-run utility)
- **Quality/Robustness**: 8 issues (Test coverage, security, config)

---

## Phase 1: Critical Fixes (MUST DO FIRST)

**Goal**: Fix blocking issues that cause runtime errors or misleading documentation
**Duration**: 1-2 hours
**Risk**: High - These issues can cause confusion and breakage

### 1.1 Version Alignment ⚠️ CRITICAL

**Issue**: Version numbers inconsistent across artifacts
- `package.json` = 1.1.0
- `server.json` line 21 = 1.0.0
- `mcpb.json` line 4 = 1.0.0
- Runtime default (http-server.ts:52, cli.ts) = "4.0.0"

**Impact**: Confusing for users, breaks semantic versioning
**Cause**: Multiple version declarations not synced

**Solution**:
```json
// Choose canonical version: package.json (1.1.0)
// Update all others to match

// server.json line 21
"version": "1.1.0"

// mcpb.json line 4
"version": "1.1.0"

// src/http-server.ts line 52, line 172
version: '1.1.0'

// src/cli.ts (wherever version is defined)
version: '1.1.0'
```

**Files to Modify**:
- `server.json` (line 21)
- `mcpb.json` (line 4)
- `src/http-server.ts` (lines 52, 172, 197, 529)
- `src/cli.ts` (version references)

---

### 1.2 Error Code Schema Completeness ⚠️ CRITICAL

**Issue**: `SESSION_NOT_FOUND` error emitted but not in schema
- Used in: `http-server.ts` lines 365, 369
- Missing from: `ErrorCodeSchema` in `shared.ts` line 175

**Impact**: Schema validation failures, TypeScript errors
**Cause**: HTTP server error codes not added to shared schema

**Solution**:
```typescript
// src/schemas/shared.ts - Add to ErrorCodeSchema
export const ErrorCodeSchema = z.enum([
  // MCP Standard
  'PARSE_ERROR', 'INVALID_REQUEST', 'METHOD_NOT_FOUND',
  'INVALID_PARAMS', 'INTERNAL_ERROR',
  // Sheets API
  'SHEET_NOT_FOUND', 'SPREADSHEET_NOT_FOUND', 'RANGE_NOT_FOUND',
  'PERMISSION_DENIED', 'QUOTA_EXCEEDED', 'RATE_LIMITED',
  'INVALID_RANGE', 'CIRCULAR_REFERENCE', 'FORMULA_ERROR',
  // Safety Rails
  'PRECONDITION_FAILED', 'EFFECT_SCOPE_EXCEEDED',
  'EXPLICIT_RANGE_REQUIRED', 'AMBIGUOUS_RANGE',
  // Features
  'FEATURE_UNAVAILABLE', 'FEATURE_DEGRADED',
  // Transactions
  'TRANSACTION_CONFLICT', 'TRANSACTION_EXPIRED',
  // HTTP Transport (NEW)
  'SESSION_NOT_FOUND',  // <-- ADD THIS
  // Generic
  'UNKNOWN_ERROR',
]);
```

**Files to Modify**:
- `src/schemas/shared.ts` (line 175 - add SESSION_NOT_FOUND)

---

### 1.3 Tool Registry - Pivot Actions Mismatch ⚠️ CRITICAL

**Issue**: Registry advertises pivot actions that aren't implemented
- Advertised in: `index.ts` line 105 (add_calculated_field, remove_calculated_field)
- Not implemented in: `pivot.ts` line 112 explicitly says "unsupported"
- Handler doesn't implement them

**Impact**: Users try to use non-existent features, get errors
**Cause**: Registry and handler out of sync

**Solution Option A** (Recommended): Remove from registry
```typescript
// src/handlers/index.ts - Remove unsupported actions
export const PIVOT_ACTIONS = [
  'create',
  'update',
  'delete',
  'list',
  // REMOVED: 'add_calculated_field', 'remove_calculated_field'
] as const;

// Update ACTION_COUNT accordingly
export const ACTION_COUNT = 156; // Was 158
```

**Solution Option B**: Implement the actions (more work)
- Add handlers for add_calculated_field and remove_calculated_field
- Add to pivot.ts switch statement
- Add schemas

**Recommended**: Option A (remove from registry)

**Files to Modify**:
- `src/handlers/index.ts` (line 105, ACTION_COUNT)
- `src/schemas/annotations.ts` (update action count if referenced)

---

### 1.4 Config/Env Variable Drift ⚠️ HIGH

**Issue**: Environment variables advertised but not used
- Advertised in: `mcpb.json` line 32 (SERVALSHEETS_*)
- Advertised in: README (SERVALSHEETS_RATE_LIMIT_*, SERVALSHEETS_CACHE_*, SERVALSHEETS_EFFECT_SCOPE_*)
- Actually used in code: PORT, LOG_LEVEL, OAUTH_*, GOOGLE_*

**Impact**: Users set env vars that don't work
**Cause**: Documentation drift from implementation

**Solution Option A** (Recommended): Update documentation to match code
```json
// mcpb.json - Replace SERVALSHEETS_* with actual env vars
{
  "name": "PORT",
  "description": "Port for HTTP server mode",
  "type": "number",
  "default": 3000
},
{
  "name": "LOG_LEVEL",
  "description": "Logging level (debug, info, warn, error)",
  "type": "string",
  "default": "info"
},
{
  "name": "OAUTH_CLIENT_ID",
  "description": "OAuth2 client ID for user authentication",
  "type": "string"
},
{
  "name": "OAUTH_CLIENT_SECRET",
  "description": "OAuth2 client secret for user authentication",
  "type": "string"
}
// ... continue for all actual vars
```

**Solution Option B**: Wire up SERVALSHEETS_* env vars in code (more work)
- Update rate-limiter.ts to read SERVALSHEETS_RATE_LIMIT_*
- Update cache-manager.ts to read SERVALSHEETS_CACHE_*
- Update policy-enforcer.ts to read SERVALSHEETS_EFFECT_SCOPE_*

**Recommended**: Option A (update docs to match reality)

**Files to Modify**:
- `mcpb.json` (lines 32-70)
- `README.md` (environment variables section)

---

## Phase 2: API Contract Alignment (DO SECOND)

**Goal**: Align schemas with actual implementation
**Duration**: 2-3 hours
**Dependency**: Must complete Phase 1 first

### 2.1 Output Schemas - Add _meta Support 🔧 HIGH

**Issue**: Handlers can generate _meta but output schemas don't support it
- `_meta` defined in: `base.ts` line 35, `shared.ts` line 465
- Not in output schemas: `values.ts`, `cells.ts`, etc.
- `generateMeta()` method exists but never called

**Impact**: TypeScript errors if handlers try to use _meta
**Cause**: Quick wins implementation incomplete

**Solution**:
```typescript
// Add _meta to all output schemas
// Example: src/schemas/tools/values.ts

import { ResponseMetaSchema } from '../shared.js';

export const ValuesOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // ... existing fields ...
    _meta: ResponseMetaSchema.optional(),  // <-- ADD THIS
  }),
  // ... error case ...
]);
```

**Files to Modify** (add _meta: ResponseMetaSchema.optional() to all):
- `src/schemas/tools/values.ts`
- `src/schemas/tools/cells.ts`
- `src/schemas/tools/spreadsheet.ts`
- `src/schemas/tools/sheet.ts`
- `src/schemas/tools/format.ts`
- `src/schemas/tools/charts.ts`
- `src/schemas/tools/pivot.ts`
- `src/schemas/tools/rules.ts`
- `src/schemas/tools/filter-sort.ts`
- `src/schemas/tools/dimensions.ts`
- `src/schemas/tools/advanced.ts`
- `src/schemas/tools/analysis.ts`
- `src/schemas/tools/sharing.ts`
- `src/schemas/tools/versions.ts`
- `src/schemas/tools/comments.ts`

---

### 2.2 Output Schemas - Add ResolvedRange Support 🔧 MEDIUM

**Issue**: ResolvedRange schema exists but not surfaced in outputs
- Schema exists: `shared.ts` line 378
- README implies it's returned: README.md line 185
- Not in any output schema

**Impact**: Users expect range resolution metadata but don't get it
**Cause**: Incomplete feature

**Solution Option A** (Recommended): Remove from README
```markdown
<!-- Remove or correct the claim about resolution metadata -->
```

**Solution Option B**: Add to output schemas (if actually used)
```typescript
// src/schemas/tools/values.ts
export const ValuesOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    values: ValuesArraySchema,
    range: z.string(),
    resolution: ResolvedRangeSchema.optional(),  // <-- ADD IF USED
  }),
  // ...
]);
```

**Recommended**: Option A (update docs) unless resolution is actually returned

**Files to Check**:
- README.md (line 185)
- Handler implementations (do they return resolution?)

---

### 2.3 Safety Options - Standardize Across Tools 🔧 MEDIUM

**Issue**: Some mutating actions lack safety options
- Have safety: sheets_values write/clear
- Missing safety: sheets_cells add_note/set_hyperlink/merge/unmerge/copy

**Impact**: Inconsistent API, some dangerous operations can't use dryRun
**Cause**: Inconsistent schema design

**Solution**:
```typescript
// Add safety to all mutating actions
// Example: src/schemas/tools/cells.ts

export const CellsInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add_note'),
    spreadsheetId: SpreadsheetIdSchema,
    range: z.string(),
    note: z.string(),
    safety: SafetyOptionsSchema.optional(),  // <-- ADD THIS
  }),
  // ... repeat for all mutating actions
]);
```

**Files to Modify**:
- `src/schemas/tools/cells.ts` (add safety to: add_note, set_hyperlink, merge, unmerge, copy)
- `src/schemas/tools/sheet.ts` (verify all mutating actions have safety)
- `src/schemas/tools/format.ts` (verify all mutating actions have safety)
- Any other tool schemas with mutating actions

---

### 2.4 Error Factory - Fix Tool References 🔧 HIGH

**Issue**: Error factory suggests non-existent tools
- Suggested tools: sheets_permission_list, sheets_permission_grant, sheets_values_get, sheets_spreadsheet_get, sheets_batch, sheets_file_search
- Actual tools: Different naming (sheets_sharing, sheets_values, sheets_spreadsheet, etc.)

**Impact**: Users follow suggestions that don't work
**Cause**: Tool names changed after error factory was written

**Solution**:
```typescript
// src/utils/error-factory.ts - Update suggested tools to match actual tool names

export function createPermissionError(params) {
  return {
    // ...
    suggestedTools: [
      'sheets_sharing',           // Was: sheets_permission_list
      'sheets_sharing',           // Was: sheets_permission_grant (same tool, different action)
      'sheets_values',            // Was: sheets_values_get
      'sheets_spreadsheet',       // Was: sheets_spreadsheet_get
    ],
    // ...
  };
}

export function createRateLimitError(params) {
  return {
    // ...
    suggestedTools: [
      'sheets_values',  // Was: sheets_batch (use batch_write action)
    ],
    // ...
  };
}

export function createNotFoundError(params) {
  // Remove sheets_file_search if it doesn't exist
  const suggestedTools: string[] = [];
  if (resourceType === 'sheet' || resourceType === 'range') {
    suggestedTools.push('sheets_spreadsheet', 'sheets_sheet');
  }
  // Don't suggest non-existent tools
  return { ...error, suggestedTools };
}
```

**Files to Modify**:
- `src/utils/error-factory.ts` (lines 22-141)

---

### 2.5 Idempotency Annotation Mismatch 🔧 MEDIUM

**Issue**: sheets_sheet marked idempotent in annotations but not in handler
- Annotations say: `idempotentHint: true` (server.json line 94, annotations.ts line 21)
- Handler says: `idempotentHint: false` (sheet.ts line 100)

**Impact**: MCP clients may cache incorrectly
**Cause**: Annotation and handler disagreement

**Solution**:
```typescript
// Choose the correct value (probably false for create/delete operations)
// Update annotations to match handler

// src/schemas/annotations.ts
export const SHEET_ANNOTATIONS: ToolAnnotations = {
  title: 'Sheet Operations',
  destructiveHint: true,
  idempotentHint: false,  // <-- CHANGE FROM true TO false
};

// server.json
// Find sheets_sheet tool and update
{
  "name": "sheets_sheet",
  "annotations": {
    "destructiveHint": true,
    "idempotentHint": false  // <-- CHANGE FROM true TO false
  }
}
```

**Files to Modify**:
- `src/schemas/annotations.ts` (line 21)
- `server.json` (line 94)

---

### 2.6 Annotation Duplication Risk 🔧 LOW

**Issue**: Annotations duplicated across server.json, annotations.ts, and tool schemas
**Impact**: Drift risk, maintenance burden
**Cause**: Multiple sources of truth

**Solution**: Create single source of truth
```typescript
// Keep annotations.ts as canonical source
// Generate server.json from code (add script)

// scripts/generate-server-json.ts
import { TOOL_ANNOTATIONS } from '../src/schemas/annotations.js';

// Generate server.json from annotations
// This ensures they stay in sync
```

**Recommended**: Accept as-is for now, address in future refactoring

---

## Phase 3: Feature Enablement (DO THIRD)

**Goal**: Wire up quick wins implementation
**Duration**: 2-3 hours
**Dependency**: Must complete Phase 2 first

### 3.1 Wire Up Response Enhancer 🔧 HIGH

**Issue**: generateMeta() method exists but never called
- Method defined: `base.ts` line 131
- No handlers call it

**Impact**: Quick wins feature not active
**Cause**: Implementation incomplete

**Solution**: Update all handlers to use it
```typescript
// Example: src/handlers/values.ts

async handleRead(input) {
  const startTime = Date.now();
  const result = await this.sheetsApi.values.get(...);

  // Generate metadata
  const meta = this.generateMeta(
    'read',
    input,
    { values: result.values },
    {
      cellsAffected: result.values.reduce((s, r) => s + r.length, 0),
      apiCallsMade: 1,
      duration: Date.now() - startTime,
    }
  );

  // Return with metadata
  return this.success('read', { values: result.values }, undefined, undefined, meta);
}
```

**Files to Modify** (add generateMeta call and pass to success):
- `src/handlers/values.ts` (all actions)
- `src/handlers/cells.ts` (all actions)
- `src/handlers/spreadsheet.ts` (all actions)
- `src/handlers/sheet.ts` (all actions)
- All other handlers

---

### 3.2 Fix Response Enhancer References 🔧 HIGH

**Issue**: Response enhancer references non-existent tools/actions
- References: scout, profile, apply, batch_format, snapshot, revert, grant, create
- Lines: response-enhancer.ts (53, 168, 231)

**Impact**: Suggestions point to non-existent features
**Cause**: Tool/action names wrong or features not implemented

**Solution**: Fix to use actual tool/action names
```typescript
// src/utils/response-enhancer.ts

// Change:
tool: 'sheets_analysis', action: 'scout'
// To:
tool: 'sheets_analysis', action: 'detect_patterns'  // Or whatever the real action is

// Change:
tool: 'sheets_format', action: 'apply'
// To:
tool: 'sheets_format', action: 'format_range'  // Or whatever the real action is

// Change:
tool: 'sheets_versions', action: 'snapshot'
// To:
tool: 'sheets_versions', action: 'create_snapshot'  // Or whatever the real action is

// Change:
tool: 'sheets_versions', action: 'revert'
// To:
tool: 'sheets_versions', action: 'restore_version'  // Or whatever the real action is
```

**Files to Modify**:
- `src/utils/response-enhancer.ts` (update all tool/action references)

---

### 3.3 Fix and Integrate Dry-Run Utility 🔧 MEDIUM

**Issue**: dry-run.ts exists but is unused
- No references in code (rg shows zero)
- Has bugs: invalid location strings, Math.max issue

**Impact**: Dry-run feature not working
**Cause**: Implementation not integrated

**Solution**:

**Step 1**: Fix bugs
```typescript
// src/utils/dry-run.ts

// Fix location string (line 89)
// Before:
location: `${range}!${getCellAddress(rowIdx, colIdx)}`
// After:
location: `${getCellAddress(rowIdx, colIdx)}`  // Range already includes sheet

// Fix Math.max with empty array (line 69)
// Before:
const maxColumns = Math.max(...values.map(row => row.length));
// After:
const maxColumns = values.length > 0
  ? Math.max(...values.map(row => row.length))
  : 0;

// Fix revert action reference (line 164)
// Before:
'Use sheets_versions:revert to restore data'
// After:
'Use sheets_versions restore_version action to restore data'
```

**Step 2**: Integrate into handlers
```typescript
// src/handlers/values.ts

import { simulateWrite, simulateClear } from '../utils/dry-run.js';

async handleWrite(input) {
  // Check for dry-run
  if (input.safety?.dryRun) {
    const dryRunResult = simulateWrite({
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      values: input.values,
    });

    const meta = this.generateMeta('write', input, { dryRunResult });
    return this.success('write', { dryRunResult }, undefined, true, meta);
  }

  // Normal execution...
}
```

**Files to Modify**:
- `src/utils/dry-run.ts` (fix bugs)
- `src/handlers/values.ts` (integrate dry-run for write/append/clear)
- `src/handlers/cells.ts` (integrate dry-run for mutating actions)
- Other handlers with mutating actions

---

### 3.4 Update Documentation to Match Reality 🔧 MEDIUM

**Issue**: Documentation claims features that don't match implementation

**Examples**:
- README line 185: Claims resolution metadata returned
- README line 413, 447: Claims SERVALSHEETS_* env vars

**Solution**: Update documentation
```markdown
<!-- README.md - Remove or correct incorrect claims -->

<!-- Before -->
Returns range resolution metadata showing how the range was resolved.

<!-- After -->
Returns the data from the specified range.
<!-- (Or add resolution metadata if actually implemented) -->

<!-- Before -->
Set SERVALSHEETS_RATE_LIMIT_MAX to configure rate limiting.

<!-- After -->
Rate limiting is configured with hard-coded defaults (60 requests/min).
<!-- (Or wire up env vars if preferred) -->
```

**Files to Modify**:
- `README.md` (multiple sections)

---

### 3.5 Fix PROMPTS_GUIDE Schema Issue 🔧 LOW

**Issue**: PROMPTS_GUIDE says prompt arg schemas are not Zod objects
- Claims: 7 prompts
- Registration matches count
- But arg schemas aren't Zod

**Impact**: Minor - prompts still work, just inconsistent
**Cause**: Prompts use plain objects instead of Zod schemas

**Solution Option A**: Document it correctly
```markdown
<!-- PROMPTS_GUIDE.md -->
Prompt arguments are defined as plain objects, not Zod schemas.
```

**Solution Option B**: Convert to Zod (more work)
```typescript
// src/mcp/prompts.ts
import { z } from 'zod';

export const PROMPTS = [
  {
    name: 'analyze-data',
    description: '...',
    arguments: z.object({  // <-- Use Zod
      spreadsheetId: z.string(),
      range: z.string().optional(),
    }).parse,  // Add parser
  },
  // ...
];
```

**Recommended**: Option A (document as-is)

**Files to Modify**:
- `PROMPTS_GUIDE.md` (clarify schema type)

---

## Phase 4: Quality & Robustness (DO LAST)

**Goal**: Improve test coverage, fix edge cases, secure config
**Duration**: 3-4 hours
**Dependency**: Can be done anytime after Phase 1

### 4.1 Diff Engine Column Limit 🔧 MEDIUM

**Issue**: FULL diff caps at column Z, but SAMPLE uses A1:ZZ
- FULL diff: `diff-engine.ts` line 122 stops at column Z
- SAMPLE: `diff-engine.ts` line 104 reads A1:ZZ (up to column ZZ)

**Impact**: Changes beyond column Z are missed in FULL diff
**Cause**: Hardcoded limit

**Solution**:
```typescript
// src/core/diff-engine.ts line 122

// Before:
const endCol = Math.min(after.columnCount, 26); // Z is the 26th column

// After:
const endCol = after.columnCount; // No artificial limit
// Or match SAMPLE range:
const endCol = Math.min(after.columnCount, 702); // ZZ is the 702nd column
```

**Files to Modify**:
- `src/core/diff-engine.ts` (line 122)

---

### 4.2 Test Coverage Gaps 🔧 MEDIUM

**Issue**: Missing tests for several handlers and core components
- No tests for: format, dimensions, rules handlers
- No tests for: diff-engine, rate-limiter

**Impact**: Bugs may go undetected
**Cause**: Incomplete test suite

**Solution**: Add tests
```typescript
// tests/handlers/format.test.ts
describe('FormatHandler', () => {
  it('should apply cell formatting', async () => {
    // ...
  });
});

// tests/core/diff-engine.test.ts
describe('DiffEngine', () => {
  it('should detect cell changes', async () => {
    // ...
  });
});
```

**Files to Create**:
- `tests/handlers/format.test.ts`
- `tests/handlers/dimensions.test.ts`
- `tests/handlers/rules.test.ts`
- `tests/core/diff-engine.test.ts`
- `tests/core/rate-limiter.test.ts`

---

### 4.3 Rate Limiter Configuration 🔧 LOW

**Issue**: Rate limiter has hard-coded defaults, no env overrides
- Hard-coded: `rate-limiter.ts` line 16

**Impact**: Can't adjust rate limits without code changes
**Cause**: No config integration

**Solution**:
```typescript
// src/core/rate-limiter.ts

export class RateLimiter {
  private maxPerMinute: number;

  constructor(config?: RateLimiterConfig) {
    // Read from env or use defaults
    this.maxPerMinute = parseInt(
      process.env['RATE_LIMIT_MAX'] ||
      config?.maxPerMinute?.toString() ||
      '60'
    );
  }
}
```

**Files to Modify**:
- `src/core/rate-limiter.ts` (add env var support)
- Update docs to reflect new env vars

---

### 4.4 Encryption Key Naming Consistency 🔧 LOW

**Issue**: Inconsistent encryption key environment variable names
- lifecycle.ts enforces: ENCRYPTION_KEY
- token-store.ts uses: GOOGLE_TOKEN_STORE_KEY

**Impact**: Confusion, potential misconfig
**Cause**: Different naming conventions

**Solution**: Standardize on one name
```typescript
// Choose: ENCRYPTION_KEY as canonical

// src/services/token-store.ts line 41
// Before:
const key = process.env['GOOGLE_TOKEN_STORE_KEY'];
// After:
const key = process.env['ENCRYPTION_KEY'];

// Update docs to reflect ENCRYPTION_KEY everywhere
```

**Files to Modify**:
- `src/services/token-store.ts` (line 41)
- Documentation (update env var references)

---

### 4.5 OAuth Env Var Naming Mismatch 🔧 LOW

**Issue**: mcpb.json lists different OAuth env var names than code uses
- mcpb.json: SERVALSHEETS_OAUTH_CLIENT_ID, SERVALSHEETS_OAUTH_CLIENT_SECRET
- Code: OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET

**Impact**: Users set wrong env vars
**Cause**: Documentation drift

**Solution**: Update mcpb.json to match code
```json
// mcpb.json - Use names that code actually reads
{
  "name": "OAUTH_CLIENT_ID",  // Was: SERVALSHEETS_OAUTH_CLIENT_ID
  "description": "OAuth2 client ID for user authentication",
  "type": "string"
}
```

**Files to Modify**:
- `mcpb.json` (OAuth env var names)

---

## Implementation Strategy

### Sequencing Rules
1. ✅ **Complete Phase 1 before Phase 2** - Critical fixes must be done first
2. ✅ **Complete Phase 2 before Phase 3** - Schemas must align before features can work
3. ⚠️ **Phase 4 can run in parallel** - Quality improvements are independent

### Testing Strategy
- ✅ Run `npm run build` after each phase
- ✅ Run `npm test` after each phase
- ✅ Manual smoke test for critical paths

### Rollback Strategy
- ✅ Commit after each major fix (git commit after each section)
- ✅ Tag after each phase (git tag phase-1-complete)
- ✅ Keep backups of server.json, mcpb.json before changes

---

## Estimated Effort

| Phase | Duration | Complexity | Risk |
|-------|----------|------------|------|
| Phase 1 | 1-2 hours | Low | High (breaking changes) |
| Phase 2 | 2-3 hours | Medium | Medium (API changes) |
| Phase 3 | 2-3 hours | Medium | Low (additive) |
| Phase 4 | 3-4 hours | Medium | Low (quality) |
| **Total** | **8-12 hours** | **Medium** | **Mixed** |

---

## Success Criteria

### Phase 1 Complete When:
- ✅ All versions align (1.1.0 everywhere)
- ✅ All error codes in schema
- ✅ Tool registry matches handlers
- ✅ Env vars documented correctly

### Phase 2 Complete When:
- ✅ All output schemas support _meta
- ✅ Safety options consistent across tools
- ✅ Error factory suggests correct tools
- ✅ Idempotency annotations match handlers

### Phase 3 Complete When:
- ✅ Response enhancer wired up in all handlers
- ✅ Dry-run utility integrated
- ✅ Documentation matches implementation

### Phase 4 Complete When:
- ✅ Test coverage >70% for all handlers
- ✅ Diff engine works beyond column Z
- ✅ Rate limiter configurable via env
- ✅ All env var names consistent

---

## Priority Matrix

### Must Fix (Phase 1)
1. Version alignment
2. Error code schema
3. Tool registry mismatch
4. Env var documentation

### Should Fix (Phase 2)
5. Output schema _meta support
6. Safety options standardization
7. Error factory tool references
8. Idempotency mismatch

### Nice to Fix (Phase 3)
9. Wire up response enhancer
10. Integrate dry-run utility
11. Update documentation
12. Fix response enhancer references

### Can Wait (Phase 4)
13. Test coverage gaps
14. Diff engine column limit
15. Rate limiter config
16. Encryption key naming
17. OAuth env var naming

---

## Next Steps

1. **Review this plan** - Ensure all issues are captured
2. **Get approval** - Confirm phasing approach
3. **Start Phase 1** - Begin with critical fixes
4. **Test after each phase** - Ensure stability
5. **Document changes** - Update CHANGELOG.md

**Ready to begin Phase 1?**
