# PROJECT_TRACEABILITY.md Audit Report

> **Audit Date:** January 5, 2026
> **Auditor:** Claude (Automated Verification)
> **Status:** ⚠️ Issues Found - Corrections Required

---

## Summary

| Check | Status | Details |
|-------|--------|---------|
| Tool Count | ✅ Pass | 16 tools confirmed |
| Action Count | ❌ Fail | Document says 159, actual is **165** |
| Knowledge Resources | ⚠️ Partial | Count correct (14), URIs incomplete |
| Core Services | ⚠️ Partial | Says 6, actual is 9 files |
| Handler Mapping | ✅ Pass | All 16 handlers mapped correctly |
| Build Flow | ✅ Pass | Copy assets working |
| Mermaid Diagrams | ✅ Pass | Syntactically correct |

---

## Critical Issue #1: Action Count Mismatch

### annotations.ts vs Actual Schemas

| Tool | annotations.ts | Actual Schema | Diff |
|------|----------------|---------------|------|
| sheets_auth | 4 | 4 | ✅ |
| sheets_spreadsheet | 6 | 6 | ✅ |
| sheets_sheet | 7 | 7 | ✅ |
| sheets_values | 9 | 9 | ✅ |
| sheets_cells | 12 | 12 | ✅ |
| sheets_format | 9 | 9 | ✅ |
| sheets_dimensions | 21 | 21 | ✅ |
| sheets_rules | 8 | 8 | ✅ |
| sheets_charts | 9 | 9 | ✅ |
| sheets_pivot | 6 | 6 | ✅ |
| sheets_filter_sort | 14 | 14 | ✅ |
| sheets_sharing | 8 | 8 | ✅ |
| sheets_comments | 10 | 10 | ✅ |
| sheets_versions | 10 | 10 | ✅ |
| **sheets_analysis** | **8** | **13** | ❌ **+5** |
| sheets_advanced | 19 | 19 | ✅ |
| **TOTAL** | **160** | **165** | ❌ **+5** |

### Missing Actions in sheets_analysis

The following 5 actions are in the schema but not counted in annotations.ts:

1. `detect_patterns` - AI-powered pattern detection
2. `column_analysis` - Deep column analysis  
3. `suggest_templates` - AI-powered template suggestions (SEP-1577)
4. `generate_formula` - AI-powered formula generation (SEP-1577)
5. `suggest_chart` - AI-powered chart recommendations (SEP-1577)

### Required Fix

```typescript
// In src/schemas/annotations.ts, line ~179
export const ACTION_COUNTS: Record<string, number> = {
  // ... other tools ...
  sheets_analysis: 13,  // Was 8, add: detect_patterns, column_analysis, suggest_templates, generate_formula, suggest_chart
  // ...
};
```

---

## Issue #2: Knowledge Resources Table Incomplete

### Missing Resource URIs

| Category | File | Status |
|----------|------|--------|
| Root | README.md | ❌ Missing from table |
| Root | DELIVERABLES.md | ❌ Missing from table |
| API/limits | quotas.json | ❌ Missing from table |

### Correct Knowledge Resource URIs (14 total)

| # | Category | File | MCP Resource URI |
|---|----------|------|------------------|
| 1 | root | README.md | `knowledge:///README.md` |
| 2 | root | DELIVERABLES.md | `knowledge:///DELIVERABLES.md` |
| 3 | api | charts.md | `knowledge:///api/charts.md` |
| 4 | api | pivot-tables.md | `knowledge:///api/pivot-tables.md` |
| 5 | api | conditional-formatting.md | `knowledge:///api/conditional-formatting.md` |
| 6 | api | data-validation.md | `knowledge:///api/data-validation.md` |
| 7 | api | batch-operations.md | `knowledge:///api/batch-operations.md` |
| 8 | api | named-ranges.md | `knowledge:///api/named-ranges.md` |
| 9 | api/limits | quotas.json | `knowledge:///api/limits/quotas.json` |
| 10 | formulas | functions-reference.md | `knowledge:///formulas/functions-reference.md` |
| 11 | formulas | financial.json | `knowledge:///formulas/financial.json` |
| 12 | formulas | lookup.json | `knowledge:///formulas/lookup.json` |
| 13 | formulas | key-formulas.json | `knowledge:///formulas/key-formulas.json` |
| 14 | templates | common-templates.json | `knowledge:///templates/common-templates.json` |

---

## Issue #3: Core Services Count

### Document States: "6 Core Services"
### Actual: 9 service files in /src/core/

| File | Purpose |
|------|---------|
| batch-compiler.ts | Batches multiple operations into single API call |
| diff-engine.ts | Computes differences for safety reporting |
| intent.ts | Intent classification for operations |
| policy-enforcer.ts | Enforces safety policies and effect limits |
| range-resolver.ts | Resolves semantic ranges to A1 notation |
| rate-limiter.ts | Enforces API rate limits |
| task-store.ts | In-memory task storage (SEP-1686) |
| task-store-adapter.ts | Adapter for MCP SDK TaskStore interface |
| task-store-factory.ts | Factory for creating task stores (memory/redis) |

Plus utility files: `index.ts`, `errors.ts`

---

## Issue #4: Stale Build Artifact

### dist/knowledge/SKILL.md exists but src/knowledge/SKILL.md does not

This file was likely manually copied or is from an old build. The build script:
```bash
cp -r src/knowledge dist/
```
Will not remove files that no longer exist in source.

### Fix
```bash
rm -rf dist/knowledge && npm run build:copy-assets
```

---

## Files Requiring Updates

### 1. src/schemas/annotations.ts
- Update `ACTION_COUNTS.sheets_analysis` from 8 to 13

### 2. docs/PROJECT_TRACEABILITY.md
- Update "159 Actions" to "165 Actions"
- Add missing knowledge resource URIs
- Update core services count from 6 to 9
- Add new sheets_analysis actions to Tool→Actions table

### 3. package.json
- Update description from "159 actions" to "165 actions"

### 4. src/mcp/registration.ts
- Comment at line 87 says "160 actions" - update to "165 actions"

---

## Verification Commands

```bash
# Verify action count per schema
for f in src/schemas/*.ts; do 
  echo "=== $f ===" 
  grep -E "action: z\.literal\(" "$f" 2>/dev/null | wc -l
done

# Total action count
grep -rE "action: z\.literal\(" src/schemas/*.ts | wc -l

# Knowledge file count
find src/knowledge -type f \( -name "*.md" -o -name "*.json" \) | wc -l

# Core service files
ls -la src/core/*.ts | wc -l
```

---

## Recommended Actions

1. **Priority 1**: Fix annotations.ts ACTION_COUNTS (code-documentation sync)
2. **Priority 2**: Update PROJECT_TRACEABILITY.md with correct numbers
3. **Priority 3**: Clean dist/knowledge stale files
4. **Priority 4**: Update package.json description

---

*Audit complete. Total issues: 4 (1 critical, 3 minor)*
