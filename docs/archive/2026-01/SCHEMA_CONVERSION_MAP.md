# Schema Conversion Master Plan

**Date:** 2026-01-11
**Goal:** Convert all 20 discriminated union input schemas to flattened z.object() pattern
**Status:** Ready for parallel execution

---

## Conversion Checklist Template

For each schema conversion:

1. ✅ **Read current schema** - Understand all action variants
2. ✅ **Extract actions** - List all z.literal() action values
3. ✅ **Collect fields** - Merge all fields from all variants (make optional)
4. ✅ **Write refine()** - Add validation logic for action-specific requirements
5. ✅ **TypeCheck** - `npm run typecheck` must pass
6. ✅ **Unit test** - Handler tests must pass
7. ✅ **Integration test** - tools/list must show non-empty schema

---

## Batch 1: Simple Schemas (3-5 actions) - HIGH PRIORITY

### 1. sheets_confirm (confirm.ts)
- **Actions:** 3 (request_confirmation, approve, reject)
- **File:** `src/schemas/confirm.ts` (line 70)
- **Handler:** `src/handlers/confirm.ts`
- **Test:** `tests/handlers/confirm.test.ts`
- **Est. Time:** 20 min

### 2. sheets_conflict (conflict.ts)
- **Actions:** 4 (detect, list, resolve, get)
- **File:** `src/schemas/conflict.ts` (line 15)
- **Handler:** `src/handlers/conflict.ts`
- **Test:** `tests/handlers/conflict.test.ts`
- **Est. Time:** 20 min

### 3. sheets_filter_sort (filter-sort.ts)
- **Actions:** 4 (set_basic_filter, clear_basic_filter, sort_range, clear_sort)
- **File:** `src/schemas/filter-sort.ts` (line 42)
- **Handler:** `src/handlers/filter-sort.ts`
- **Test:** `tests/handlers/filter-sort.test.ts`
- **Est. Time:** 20 min

### 4. sheets_impact (impact.ts)
- **Actions:** 3 (analyze, get, list)
- **File:** `src/schemas/impact.ts` (line 15)
- **Handler:** `src/handlers/impact.ts`
- **Test:** `tests/handlers/impact.test.ts`
- **Est. Time:** 20 min

### 5. sheets_validation (validation.ts)
- **Actions:** 3 (validate, get, clear)
- **File:** `src/schemas/validation.ts` (line 15)
- **Handler:** `src/handlers/validation.ts`
- **Test:** `tests/handlers/validation.test.ts`
- **Est. Time:** 20 min

---

## Batch 2: Medium Schemas (5-6 actions)

### 6. sheets_cells (cells.ts)
- **Actions:** 5 (read, write, clear, merge, unmerge)
- **File:** `src/schemas/cells.ts` (line 32)
- **Handler:** `src/handlers/cells.ts`
- **Test:** `tests/handlers/cells.test.ts`
- **Est. Time:** 30 min

### 7. sheets_comments (comments.ts)
- **Actions:** 5 (add, update, delete, list, get)
- **File:** `src/schemas/comments.ts` (line 47)
- **Handler:** `src/handlers/comments.ts`
- **Test:** `tests/handlers/comments.test.ts`
- **Est. Time:** 30 min

### 8. sheets_charts (charts.ts)
- **Actions:** 6 (create, update, delete, list, get, move)
- **File:** `src/schemas/charts.ts` (line 74)
- **Handler:** `src/handlers/charts.ts`
- **Test:** `tests/handlers/charts.test.ts`
- **Est. Time:** 30 min

### 9. sheets_dimensions (dimensions.ts)
- **Actions:** 6 (insert_rows, insert_columns, delete_rows, delete_columns, resize_rows, resize_columns)
- **File:** `src/schemas/dimensions.ts` (line 29)
- **Handler:** `src/handlers/dimensions.ts`
- **Test:** `tests/handlers/dimensions.test.ts`
- **Est. Time:** 30 min

### 10. sheets_history (history.ts)
- **Actions:** 5 (list, get, revert, compare, clear)
- **File:** `src/schemas/history.ts` (line 15)
- **Handler:** `src/handlers/history.ts`
- **Test:** `tests/handlers/history.test.ts`
- **Est. Time:** 30 min

### 11. sheets_pivot (pivot.ts)
- **Actions:** 5 (create, update, delete, list, get)
- **File:** `src/schemas/pivot.ts` (line 99)
- **Handler:** `src/handlers/pivot.ts`
- **Test:** `tests/handlers/pivot.test.ts`
- **Est. Time:** 30 min

### 12. sheets_sharing (sharing.ts)
- **Actions:** 6 (share, update_permission, revoke, list_permissions, get_permission, transfer_ownership)
- **File:** `src/schemas/sharing.ts` (line 34)
- **Handler:** `src/handlers/sharing.ts`
- **Test:** `tests/handlers/sharing.test.ts`
- **Est. Time:** 30 min

### 13. sheets_transaction (transaction.ts)
- **Actions:** 6 (begin, commit, rollback, status, list, get)
- **File:** `src/schemas/transaction.ts` (line 15)
- **Handler:** `src/handlers/transaction.ts`
- **Test:** `tests/handlers/transaction.test.ts`
- **Est. Time:** 30 min

---

## Batch 3: Complex Schemas (8-10 actions)

### 14. sheets_sheet (sheet.ts) - PILOT
- **Actions:** 8 (add, delete, update, get, list, rename, copy, hide)
- **File:** `src/schemas/sheet.ts` (line 26)
- **Handler:** `src/handlers/sheet.ts`
- **Test:** `tests/handlers/sheet.test.ts`
- **Est. Time:** 40 min
- **NOTE:** Use as pilot to validate pattern

### 15. sheets_analysis (analysis.ts)
- **Actions:** 8 (data_quality, formula_audit, dependency_map, performance, coverage, consistency, outliers, trends)
- **File:** `src/schemas/analysis.ts` (line 69)
- **Handler:** `src/handlers/analysis.ts`
- **Test:** `tests/handlers/analysis.test.ts`
- **Est. Time:** 40 min

### 16. sheets_analyze (analyze.ts)
- **Actions:** 8 (submit, get, list, cancel, configure, preview, validate, get_stats)
- **File:** `src/schemas/analyze.ts` (line 53)
- **Handler:** `src/handlers/analyze.ts`
- **Test:** `tests/handlers/analyze.test.ts`
- **Est. Time:** 40 min

### 17. sheets_values (values.ts)
- **Actions:** 9 (read, write, update, append, clear, batch_read, batch_update, batch_clear, copy)
- **File:** `src/schemas/values.ts` (line 32)
- **Handler:** `src/handlers/values.ts`
- **Test:** `tests/handlers/values.test.ts`
- **Est. Time:** 40 min

### 18. sheets_versions (versions.ts)
- **Actions:** 10 (list_revisions, get_revision, restore_revision, create_snapshot, list_snapshots, get_snapshot, restore_snapshot, delete_snapshot, compare_versions, export_version)
- **File:** `src/schemas/versions.ts` (line 45)
- **Handler:** `src/handlers/versions.ts`
- **Test:** `tests/handlers/versions.test.ts`
- **Est. Time:** 45 min

### 19. sheets_format (format.ts)
- **Actions:** 10+ (set_background, set_text_format, set_borders, set_number_format, set_alignment, clear_format, copy_format, merge_cells, set_column_width, set_row_height, ...)
- **File:** `src/schemas/format.ts` (line 32)
- **Handler:** `src/handlers/format.ts`
- **Test:** `tests/handlers/format.test.ts`
- **Est. Time:** 50 min

---

## Batch 4: Large Schema (20+ actions)

### 20. sheets_advanced (advanced.ts)
- **Actions:** 20+ (add_named_range, update_named_range, delete_named_range, list_named_ranges, get_named_range, add_protected_range, update_protected_range, delete_protected_range, list_protected_ranges, get_protected_range, set_data_validation, clear_data_validation, add_developer_metadata, get_metadata, delete_metadata, list_metadata, create_filter_view, update_filter_view, delete_filter_view, list_filter_views, get_filter_view, ...)
- **File:** `src/schemas/advanced.ts` (line 54)
- **Handler:** `src/handlers/advanced.ts`
- **Test:** `tests/handlers/advanced.test.ts`
- **Est. Time:** 60+ min

---

## Parallel Execution Strategy

### Wave 1: Batch 1 (5 schemas in parallel)
- Launch 5 agents simultaneously
- Each handles 1 simple schema (3-5 actions)
- **Total time: ~20 min (parallelized)**

### Wave 2: Batch 2 (8 schemas in parallel)
- Launch 8 agents simultaneously
- Each handles 1 medium schema (5-6 actions)
- **Total time: ~30 min (parallelized)**

### Wave 3: Batch 3 (6 schemas in parallel)
- Launch 6 agents simultaneously
- Each handles 1 complex schema (8-10 actions)
- **Total time: ~50 min (parallelized)**

### Wave 4: Batch 4 (1 schema)
- Single agent for largest schema
- **Total time: ~60 min**

**Total estimated time: ~2.5 hours (parallelized) vs ~8+ hours (sequential)**

---

## Validation Checklist (Per Schema)

After each conversion, verify:

### ✅ Compilation
```bash
npm run typecheck
# Must pass with zero errors
```

### ✅ Unit Tests
```bash
npm test -- tests/handlers/[handler-name].test.ts
# All tests must pass
```

### ✅ Integration Test
```bash
npm test -- tests/integration/mcp-tools-list.test.ts
# Schema must be non-empty in tools/list
```

### ✅ Manual Verification
```bash
npm run build
node dist/cli.js &
# Check tools/list shows proper schema
```

---

## Success Criteria (Final)

- ✅ All 20 input schemas converted to flattened pattern
- ✅ Zero TypeScript errors
- ✅ All 2,208+ tests passing
- ✅ All 26 tools show non-empty schemas in tools/list
- ✅ Build succeeds
- ✅ No monkey-patches in codebase
- ✅ Clean, production-ready code

---

## Rollback Plan

If any conversion fails:
1. Revert that specific schema file
2. Keep successfully converted schemas
3. Debug the failing conversion
4. Retry with fixes

Git workflow:
```bash
# After each successful conversion
git add src/schemas/[schema-name].ts
git commit -m "refactor(schemas): flatten [schema-name] to native MCP SDK pattern"
```
