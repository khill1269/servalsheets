# Phase 2: Quick Wins - Implementation Plan

**Date**: 2026-01-06
**Estimated Time**: 3-4 hours
**Status**: STARTING
**Goal**: Complete tool coverage + advanced enablement features

---

## Overview

Phase 1 enhanced 4 critical tools. Phase 2 expands to all 23 tools and adds:
1. **Complete Tool Coverage** - Apply template to remaining 19 tools
2. **Tool Chaining Hints** - Help Claude know what to do next
3. **Additional Recovery Prompts** - Performance, data quality, formula diagnostics
4. **Workflow Optimization Prompts** - Common multi-step tasks

---

## Task 1: Apply Template to Remaining 19 Tools

### Tools to Enhance (in priority order)

**High Priority** (7 tools - frequently used):
1. ✅ sheets_values (DONE in Phase 1)
2. ✅ sheets_auth (DONE in Phase 1)
3. ✅ sheets_spreadsheet (DONE in Phase 1)
4. ✅ sheets_analysis (DONE in Phase 1)
5. sheets_sheet - Sheet operations (add, delete, copy, hide, rename)
6. sheets_cells - Cell-level operations (merge, unmerge, copy, paste)
7. sheets_format - Formatting (bold, colors, borders, number formats)
8. sheets_dimensions - Rows/columns (insert, delete, resize, freeze)
9. sheets_transaction - Multi-operation transactions
10. sheets_validation - Pre-flight validation
11. sheets_history - Operation history and rollback

**Medium Priority** (8 tools - moderate use):
12. sheets_rules - Data validation rules
13. sheets_charts - Chart creation and management
14. sheets_pivot - Pivot table operations
15. sheets_filter_sort - Filtering and sorting
16. sheets_sharing - Permissions and sharing
17. sheets_comments - Comments and notes
18. sheets_versions - Version control
19. sheets_advanced - Advanced operations (find/replace, formulas)

**Low Priority** (4 tools - specialized):
20. sheets_conflict - Conflict detection
21. sheets_impact - Impact analysis
22. sheets_confirm - Elicitation (already has examples)
23. sheets_analyze - Sampling (already has examples)

### Template Application Strategy

For each tool:
1. Identify 3-5 most common actions
2. Write realistic JSON examples
3. Add 3 performance tips
4. Add 3 common workflows (tool chaining)
5. Add 3 error recovery scenarios
6. Keep under 1000 characters per tool

---

## Task 2: Tool Chaining Hints

Add `nextSteps` to tool annotations to guide Claude on what to do after success/failure.

### Example Pattern

```typescript
annotations: {
  // ... existing annotations ...
  nextSteps: {
    afterSuccess: [
      'sheets_analysis - Verify data quality after bulk writes',
      'sheets_validation - Check for conflicts',
      'sheets_history - Record operation for audit trail'
    ],
    onError: [
      'sheets_history - Check recent operations',
      'recover_from_error - Get troubleshooting guidance'
    ],
    commonCombinations: [
      'sheets_spreadsheet (get) → sheets_values (read) → sheets_analysis',
      'sheets_validation → sheets_transaction → sheets_values (write)',
      'sheets_analysis → sheets_format → sheets_charts'
    ]
  }
}
```

### Tools to Annotate (Priority Order)

1. sheets_values - Most used, needs chaining to analysis/validation
2. sheets_transaction - Needs pre-validation and post-verification
3. sheets_analysis - Needs follow-up formatting/charting
4. sheets_format - Often followed by charts
5. sheets_spreadsheet - Entry point, needs chaining to values/sheet
6. All remaining tools

---

## Task 3: Additional Recovery Prompts

### New Prompts to Create

#### 3.1 troubleshoot_performance
**Purpose**: Diagnose and fix slow operations

**Args**:
- spreadsheetId (required)
- operation (optional) - What was slow
- responseTime (optional) - How long it took

**Recovery Strategies**:
- Large range detection → Use batch operations
- Formula recalculation → Optimize formulas
- Network latency → Enable caching
- Quota approaching → Reduce request frequency

#### 3.2 fix_data_quality
**Purpose**: Identify and fix data quality issues

**Args**:
- spreadsheetId (required)
- range (required)
- issues (optional) - Known issues

**Fixes**:
- Empty cells → Fill strategies
- Duplicate headers → Rename
- Inconsistent formats → Normalize
- Invalid values → Validation rules

#### 3.3 optimize_formulas
**Purpose**: Improve formula performance

**Args**:
- spreadsheetId (required)
- range (optional)
- slowFormulas (optional) - Known slow formulas

**Optimizations**:
- VLOOKUP → INDEX/MATCH
- Array formulas → Split into columns
- Circular references → Break cycles
- Volatile functions → Replace with static

#### 3.4 resolve_conflicts
**Purpose**: Handle concurrent edit conflicts

**Args**:
- spreadsheetId (required)
- conflictType (optional)
- affectedRange (optional)

**Strategies**:
- Version comparison
- Merge strategies
- Rollback options
- Lock recommendations

---

## Task 4: Workflow Optimization Prompts

### New Workflow Prompts

#### 4.1 bulk_import_data
**Purpose**: Efficiently import large datasets

**Workflow**:
1. Validate source data format
2. Create target sheet with proper structure
3. Use batch_write for chunks <1000 rows
4. Apply formatting in single request
5. Create charts if needed
6. Run data quality analysis

#### 4.2 create_dashboard
**Purpose**: Build interactive dashboard

**Workflow**:
1. Analyze data structure
2. Create summary calculations
3. Add pivot tables for aggregation
4. Create 3-5 charts
5. Apply conditional formatting
6. Setup data validation

#### 4.3 cleanup_spreadsheet
**Purpose**: Clean up messy spreadsheet

**Workflow**:
1. Run sheets_analysis for issues
2. Fix data quality problems
3. Remove empty rows/columns
4. Standardize formatting
5. Optimize formulas
6. Add data validation rules

#### 4.4 setup_collaboration
**Purpose**: Prepare spreadsheet for team use

**Workflow**:
1. Add documentation sheet
2. Setup named ranges
3. Create validation rules
4. Apply protection to headers
5. Share with team members
6. Enable version history

---

## Implementation Order

### Hour 1: High Priority Tools (7 tools)
- sheets_sheet (15 min)
- sheets_cells (15 min)
- sheets_format (15 min)
- sheets_dimensions (15 min)

### Hour 2: High Priority Continued + Tool Chaining
- sheets_transaction (10 min)
- sheets_validation (10 min)
- sheets_history (10 min)
- Add nextSteps to all 11 high-priority tools (30 min)

### Hour 3: Recovery Prompts
- troubleshoot_performance (20 min)
- fix_data_quality (20 min)
- optimize_formulas (20 min)

### Hour 4: Medium Priority Tools + Workflow Prompts
- Medium priority tools (8 tools × 10 min = 80 min)
- bulk_import_data prompt (20 min)
- create_dashboard prompt (20 min)

### Final: Build and Verify
- Build and test (20 min)
- Documentation (20 min)

---

## Success Criteria

- [ ] All 23 tools have enhanced descriptions
- [ ] All high-priority tools (11) have nextSteps annotations
- [ ] 4 new recovery prompts created
- [ ] 4 new workflow prompts created
- [ ] Build succeeds with 0 errors
- [ ] Total prompts: 21 (was 13)
- [ ] Average tool description: 600-900 characters

---

## Files to Modify

1. `src/mcp/registration.ts` - All tool descriptions + annotations
2. `src/mcp/registration.ts` - 4 new recovery prompts (lines ~1800-2200)
3. `src/mcp/registration.ts` - 4 new workflow prompts (lines ~2200-2600)
4. `PHASE_2_COMPLETE.md` - Documentation (NEW)

---

## Estimated Impact

**Before Phase 2**:
- 4 tools with examples (17%)
- 13 prompts
- No tool chaining guidance

**After Phase 2**:
- 23 tools with examples (100%)
- 21 prompts (62% increase)
- Tool chaining for common workflows
- Performance troubleshooting
- Data quality fixes

**Claude Benefits**:
- Always knows correct JSON format
- Knows what to do next
- Can self-diagnose performance issues
- Can fix data quality problems
- Can optimize formulas automatically

---

## Risk Mitigation

**Risk**: Too much text, descriptions get truncated
**Mitigation**: Keep each tool under 1000 characters, prioritize examples over prose

**Risk**: Inconsistent quality across 19 new tools
**Mitigation**: Use template strictly, review before commit

**Risk**: Build failures from syntax errors
**Mitigation**: Enhance in batches, build after each batch

---

**Ready to Start**: ✅
**First Task**: Enhance sheets_sheet tool
**Target**: All 23 tools enhanced + 8 new prompts
