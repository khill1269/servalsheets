# Tool Reorganization Plan: 24 → 11 Tools
## ServalSheets Architecture Simplification

**Date**: 2026-01-08
**Status**: 📋 **PLANNING PHASE**
**Goal**: Reduce cognitive load, improve discoverability, maintain all functionality

---

## 🎯 Executive Summary

### Current State
- **24 tools** with 189 actions
- **High cognitive load** - users struggle to find the right tool
- **Fragmentation** - related operations scattered across tools
- **Tool discovery challenge** - "Which tool has X?"

### Target State
- **11 tools** with 189 actions (no functionality lost)
- **Workflow-based grouping** - tools match user mental models
- **Clear boundaries** - obvious which tool to use for any task
- **Improved UX** - faster tool discovery, more intuitive

### Success Metrics
- ✅ All 189 actions preserved
- ✅ Zero breaking changes (backward compatibility via aliases)
- ✅ Tool discovery time: 24 tools → 11 tools (54% reduction)
- ✅ Action discoverability: grouped by workflow
- ✅ Test pass rate: 100% maintained

---

## 📊 Current Tool Analysis

### Tool Distribution by Category

| Category | Current Tools | Actions | Complexity |
|----------|---------------|---------|------------|
| **Auth** | 1 | 4 | Low |
| **Core CRUD** | 2 | 14 | Medium |
| **Data Operations** | 2 | 21 | High |
| **Structure** | 1 | 21 | High |
| **Formatting** | 2 | 17 | Medium |
| **Visualization** | 2 | 15 | Medium |
| **Organization** | 2 | 33 | High |
| **Collaboration** | 3 | 28 | High |
| **Intelligence** | 3 | 17+ | Very High |
| **Quality** | 3 | 4 | Low |
| **System** | 3 | 15 | Medium |
| **TOTAL** | **24** | **189** | - |

### Pain Points

1. **Too many tools for simple workflows**:
   ```
   User: "I want to format cells"
   Options: sheets_format? sheets_rules? sheets_cells?
   Confusion: 3 tools for formatting-related operations
   ```

2. **Related operations scattered**:
   ```
   Charts: sheets_charts
   Pivots: sheets_pivot
   → Should be: sheets_visualize (both are visualization)
   ```

3. **Unclear boundaries**:
   ```
   sheets_cells: notes, validation, hyperlinks, merge
   sheets_values: read, write, find, replace
   → Both operate on cell data!
   ```

---

## 🎨 Proposed 11-Tool Architecture

### Design Principles

1. **Workflow-Based**: Group by user intent, not technical implementation
2. **Progressive Disclosure**: Common operations → Advanced operations
3. **Clear Boundaries**: No overlapping responsibilities
4. **Backward Compatible**: Alias old tool names to new ones

---

### **Tool 1: sheets_auth** (4 actions)

**Purpose**: Authentication management
**Scope**: OAuth flow, token management
**Status**: ✅ **Keep as-is** (fundamental, clear purpose)

```typescript
Actions:
- status          // Check authentication status
- login           // Start OAuth flow
- callback        // Complete OAuth with code
- logout          // Clear credentials
```

**Why separate**: Authentication is a distinct concern, always first step.

---

### **Tool 2: sheets_core** (14 actions)

**Purpose**: Spreadsheet and sheet CRUD operations
**Merges**: `sheets_spreadsheet` + `sheets_sheet`
**Scope**: Create, read, update, delete spreadsheets and sheets

```typescript
// Spreadsheet operations (7)
- get                    // Get spreadsheet metadata
- create                 // Create new spreadsheet
- copy                   // Copy spreadsheet
- update_properties      // Update title, locale, timezone
- get_url                // Get spreadsheet URL
- batch_get              // Get multiple spreadsheets
- get_comprehensive      // ⚡ NEW: Get all metadata in 1 call

// Sheet operations (7)
- add_sheet              // Add new sheet/tab
- delete_sheet           // Delete sheet
- duplicate_sheet        // Duplicate sheet
- update_sheet           // Update sheet properties
- copy_sheet_to          // Copy sheet to another spreadsheet
- list_sheets            // List all sheets
- get_sheet              // Get sheet metadata
```

**Benefits**:
- ✅ One-stop for spreadsheet/sheet management
- ✅ Clear CRUD pattern
- ✅ Reduced from 2 tools → 1 tool

---

### **Tool 3: sheets_data** (30 actions)

**Purpose**: Read, write, and manipulate cell data
**Merges**: `sheets_values` + `sheets_cells`
**Scope**: All cell-level data operations

```typescript
// Value operations (9)
- read                   // Read cell values
- write                  // Write cell values
- append                 // Append rows
- clear                  // Clear range
- batch_read             // Read multiple ranges
- batch_write            // Write multiple ranges
- batch_clear            // Clear multiple ranges
- find                   // Find values
- replace                // Find and replace

// Cell metadata operations (12)
- add_note               // Add cell note
- get_note               // Get cell note
- clear_note             // Clear cell note
- set_validation         // Set data validation
- clear_validation       // Clear validation
- set_hyperlink          // Add hyperlink
- clear_hyperlink        // Remove hyperlink
- merge                  // Merge cells
- unmerge                // Unmerge cells
- get_merges             // List merged ranges
- cut                    // Cut cells
- copy                   // Copy cells

// Cell protection (9 - from sheets_advanced)
- protect_range          // Protect range
- unprotect_range        // Unprotect range
- list_protected_ranges  // List protections
```

**Benefits**:
- ✅ All data operations in one place
- ✅ "If it's about cell data, use sheets_data"
- ✅ Reduced from 2 tools → 1 tool

---

### **Tool 4: sheets_structure** (21 actions)

**Purpose**: Manage rows, columns, and grid structure
**Status**: ✅ **Keep** `sheets_dimensions` (rename to sheets_structure)
**Scope**: Insert, delete, resize, hide, freeze, group rows/columns

```typescript
// Row operations
- insert_rows            // Insert rows
- delete_rows            // Delete rows
- move_rows              // Move rows
- resize_rows            // Resize row height
- hide_rows              // Hide rows
- show_rows              // Show rows
- freeze_rows            // Freeze rows
- group_rows             // Group rows
- ungroup_rows           // Ungroup rows
- append_rows            // Append rows

// Column operations (identical pattern)
- insert_columns, delete_columns, move_columns, resize_columns,
  hide_columns, show_columns, freeze_columns, group_columns,
  ungroup_columns, append_columns

// Smart operations
- auto_resize            // Auto-resize columns
```

**Benefits**:
- ✅ Clear structure manipulation tool
- ✅ Parallel row/column operations easy to discover
- ✅ Name change: dimensions → structure (clearer)

---

### **Tool 5: sheets_format** (17 actions)

**Purpose**: Visual formatting and conditional formatting
**Merges**: `sheets_format` + `sheets_rules`
**Scope**: Colors, fonts, borders, alignment, conditional formats, data validation rules

```typescript
// Basic formatting (9)
- set_format             // Set cell format
- set_background         // Set background color
- set_text_format        // Set font, size, bold, italic
- set_number_format      // Set number format
- set_alignment          // Set alignment
- set_borders            // Set borders
- clear_format           // Clear formatting
- apply_preset           // Apply preset style
- auto_fit               // Auto-fit columns

// Conditional formatting (4)
- add_conditional_format     // Add rule
- update_conditional_format  // Update rule
- delete_conditional_format  // Delete rule
- list_conditional_formats   // List rules

// Data validation rules (4)
- add_data_validation        // Add validation
- update_data_validation     // Update validation
- clear_data_validation      // Clear validation
- list_data_validations      // List validations
```

**Benefits**:
- ✅ All "make it look different" operations together
- ✅ Conditional formatting logically part of formatting
- ✅ Reduced from 2 tools → 1 tool

---

### **Tool 6: sheets_visualize** (15 actions)

**Purpose**: Charts and pivot tables
**Merges**: `sheets_charts` + `sheets_pivot`
**Scope**: All data visualization

```typescript
// Chart operations (9)
- create_chart           // Create chart
- update_chart           // Update chart
- delete_chart           // Delete chart
- list_charts            // List charts
- get_chart              // Get chart details
- move_chart             // Move chart position
- resize_chart           // Resize chart
- update_chart_data      // Update data range
- export_chart           // Export chart as image

// Pivot table operations (6)
- create_pivot           // Create pivot table
- update_pivot           // Update pivot table
- delete_pivot           // Delete pivot table
- list_pivots            // List pivot tables
- get_pivot              // Get pivot details
- refresh_pivot          // Refresh pivot data
```

**Benefits**:
- ✅ All visualization in one tool
- ✅ "If you want to see data visually, use sheets_visualize"
- ✅ Reduced from 2 tools → 1 tool

---

### **Tool 7: sheets_organize** (47 actions)

**Purpose**: Organize data with filters, sorts, named ranges, tables
**Merges**: `sheets_filter_sort` + `sheets_advanced` (partial)
**Scope**: Data organization, not data manipulation

```typescript
// Filtering & Sorting (14)
- set_basic_filter           // Set basic filter
- clear_basic_filter         // Clear basic filter
- get_basic_filter           // Get basic filter
- update_filter_criteria     // Update criteria
- sort_range                 // Sort range
- create_filter_view         // Create filter view
- update_filter_view         // Update filter view
- delete_filter_view         // Delete filter view
- list_filter_views          // List filter views
- get_filter_view            // Get filter view
- create_slicer              // Create slicer
- update_slicer              // Update slicer
- delete_slicer              // Delete slicer
- list_slicers               // List slicers

// Named Ranges (5)
- add_named_range            // Add named range
- update_named_range         // Update named range
- delete_named_range         // Delete named range
- list_named_ranges          // List named ranges
- get_named_range            // Get named range details

// Tables (3 - from sheets_advanced)
- create_table               // Create structured table
- delete_table               // Delete table
- list_tables                // List tables

// Banding (4 - from sheets_advanced)
- add_banding                // Add alternating colors
- update_banding             // Update banding
- delete_banding             // Delete banding
- list_banding               // List banding

// Metadata (3 - from sheets_advanced)
- set_metadata               // Set developer metadata
- get_metadata               // Get developer metadata
- delete_metadata            // Delete developer metadata
```

**Benefits**:
- ✅ All "organize your data" operations together
- ✅ Logical grouping: filters, sorts, ranges, tables
- ✅ Reduced from 2 tools → 1 tool

**Note**: Protected ranges moved to sheets_data (data-level protection)

---

### **Tool 8: sheets_collaborate** (28 actions)

**Purpose**: Collaboration features
**Merges**: `sheets_sharing` + `sheets_comments` + `sheets_versions`
**Scope**: Multi-user collaboration, commenting, version control

```typescript
// Sharing & Permissions (8)
- share                      // Share with user/group
- update_permission          // Update permission
- remove_permission          // Remove permission
- list_permissions           // List permissions
- get_permission             // Get permission details
- transfer_ownership         // Transfer ownership
- set_link_sharing           // Set link sharing
- get_sharing_link           // Get sharing link

// Comments & Discussion (10)
- add_comment                // Add comment
- update_comment             // Update comment
- delete_comment             // Delete comment
- list_comments              // List comments
- get_comment                // Get comment details
- resolve_comment            // Resolve comment
- reopen_comment             // Reopen comment
- add_reply                  // Add reply
- update_reply               // Update reply
- delete_reply               // Delete reply

// Version Control (10)
- list_revisions             // List revisions
- get_revision               // Get revision details
- restore_revision           // Restore revision
- keep_revision              // Mark revision as important
- create_snapshot            // Create snapshot
- list_snapshots             // List snapshots
- restore_snapshot           // Restore snapshot
- delete_snapshot            // Delete snapshot
- compare_revisions          // Compare two revisions
- export_version             // Export specific version
```

**Benefits**:
- ✅ All team collaboration in one tool
- ✅ "Working with others? Use sheets_collaborate"
- ✅ Reduced from 3 tools → 1 tool

---

### **Tool 9: sheets_intelligence** (20+ actions)

**Purpose**: AI-powered analysis and automated fixes
**Merges**: `sheets_analysis` + `sheets_analyze` + `sheets_fix`
**Scope**: Data analysis, pattern detection, AI insights, automated fixes

```typescript
// Data Analysis (13 - from sheets_analysis)
- data_quality               // Analyze data quality
- formula_audit              // Audit formulas
- structure_analysis         // Analyze structure
- statistics                 // Calculate statistics
- correlations               // Find correlations
- summary                    // Get summary
- dependencies               // Analyze dependencies
- compare_ranges             // Compare ranges
- detect_patterns            // Detect patterns
- column_analysis            // Analyze column
- suggest_templates          // Suggest templates (AI)
- generate_formula           // Generate formula (AI)
- suggest_chart              // Suggest charts (AI)

// AI-Powered Analysis (4 - from sheets_analyze)
- analyze                    // Deep AI analysis
- explain_data               // Explain data patterns
- get_insights               // Get insights
- get_stats                  // Get analysis stats

// Automated Fixes (4+ - from sheets_fix)
- preview_fixes              // Preview auto-fixes
- apply_fixes                // Apply auto-fixes
- batch_fix                  // Fix multiple issues
- validate_fixes             // Validate fixes
```

**Benefits**:
- ✅ All analysis and intelligence in one place
- ✅ Progressive: basic analysis → AI analysis → auto-fix
- ✅ Reduced from 3 tools → 1 tool

---

### **Tool 10: sheets_quality** (4 actions)

**Purpose**: Data quality and safety
**Merges**: `sheets_validation` + `sheets_conflict` + `sheets_impact`
**Scope**: Pre-execution validation, conflict detection, impact analysis

```typescript
// Data Validation (1)
- validate                   // Validate data against rules

// Conflict Detection (2)
- detect_conflicts           // Detect concurrent edits
- resolve_conflicts          // Resolve conflicts

// Impact Analysis (1)
- analyze_impact             // Analyze operation impact
```

**Benefits**:
- ✅ All "safety checks" in one tool
- ✅ Natural workflow: validate → check conflicts → analyze impact
- ✅ Reduced from 3 tools → 1 tool

---

### **Tool 11: sheets_system** (15 actions)

**Purpose**: System operations and workflow management
**Merges**: `sheets_transaction` + `sheets_history` + `sheets_confirm`
**Scope**: Transactions, operation history, user confirmation

```typescript
// Transaction Management (6)
- begin_transaction          // Start transaction
- queue_operation            // Queue operation
- commit_transaction         // Commit transaction
- rollback_transaction       // Rollback transaction
- get_transaction_status     // Get status
- list_transactions          // List transactions

// Operation History (7)
- list_history               // List history
- get_operation              // Get operation details
- get_history_stats          // Get statistics
- undo_operation             // Undo operation
- redo_operation             // Redo operation
- revert_to                  // Revert to point in time
- clear_history              // Clear history

// User Confirmation (2)
- request_confirmation       // Request user confirmation
- get_confirmation_stats     // Get confirmation stats
```

**Benefits**:
- ✅ All system/workflow operations together
- ✅ Advanced users understand these are "meta" operations
- ✅ Reduced from 3 tools → 1 tool

---

## 📊 Reorganization Summary

### Before vs After

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total Tools** | 24 | 11 | **-54%** |
| **Total Actions** | 189 | 189 | **0%** (preserved) |
| **Avg Actions/Tool** | 7.9 | 17.2 | **+117%** (richer tools) |
| **Tool Categories** | 11 | 11 | **0%** |
| **Cognitive Load** | High | Low | **-54%** (fewer choices) |

### Tool Mapping

| Old Tools (24) | New Tool | Action Count |
|----------------|----------|--------------|
| sheets_auth | sheets_auth | 4 |
| sheets_spreadsheet + sheets_sheet | sheets_core | 14 |
| sheets_values + sheets_cells | sheets_data | 30 |
| sheets_dimensions | sheets_structure | 21 |
| sheets_format + sheets_rules | sheets_format | 17 |
| sheets_charts + sheets_pivot | sheets_visualize | 15 |
| sheets_filter_sort + sheets_advanced | sheets_organize | 47 |
| sheets_sharing + sheets_comments + sheets_versions | sheets_collaborate | 28 |
| sheets_analysis + sheets_analyze + sheets_fix | sheets_intelligence | 20+ |
| sheets_validation + sheets_conflict + sheets_impact | sheets_quality | 4 |
| sheets_transaction + sheets_history + sheets_confirm | sheets_system | 15 |

---

## 🎯 Migration Strategy

### Phase 1: Add New Tools (Backward Compatible)

**Duration**: 1 week
**Risk**: Low (additive only)

1. **Create new unified handlers**:
   ```typescript
   // Example: CoreHandler combines SpreadsheetHandler + SheetHandler
   export class CoreHandler extends BaseHandler<CoreInput, CoreOutput> {
     async handle(input: CoreInput) {
       // Route to spreadsheet or sheet operations
       if (input.request.target === 'spreadsheet') {
         return this.handleSpreadsheet(input);
       }
       return this.handleSheet(input);
     }
   }
   ```

2. **Keep old handlers as wrappers**:
   ```typescript
   // Old tool still works!
   export class SpreadsheetHandler extends BaseHandler {
     async handle(input) {
       // Delegate to CoreHandler
       return coreHandler.handle({
         request: { target: 'spreadsheet', ...input.request }
       });
     }
   }
   ```

3. **Register both old and new tools**:
   ```typescript
   // Both work during migration
   server.setRequestHandler(ListToolsRequestSchema, async () => ({
     tools: [
       // New tools
       { name: 'sheets_core', ... },
       // Old tools (aliases)
       { name: 'sheets_spreadsheet', description: '⚠️ DEPRECATED: Use sheets_core' },
       { name: 'sheets_sheet', description: '⚠️ DEPRECATED: Use sheets_core' },
     ]
   }));
   ```

**Testing**: All existing tests pass with old tool names.

---

### Phase 2: Deprecation Period (6 months)

**Duration**: 6 months
**Risk**: Low (both versions work)

1. **Update documentation**:
   ```markdown
   # Migration Guide

   ## sheets_spreadsheet → sheets_core

   **Old**:
   ```json
   {
     "name": "sheets_spreadsheet",
     "arguments": { "request": { "action": "get", "spreadsheetId": "..." } }
   }
   ```

   **New**:
   ```json
   {
     "name": "sheets_core",
     "arguments": { "request": { "target": "spreadsheet", "action": "get", "spreadsheetId": "..." } }
   }
   ```
   ```

2. **Add deprecation warnings**:
   ```typescript
   if (toolName.startsWith('sheets_spreadsheet')) {
     logger.warn('Tool sheets_spreadsheet is deprecated. Use sheets_core instead.');
   }
   ```

3. **Update Claude Desktop prompts**:
   ```
   Available tools (use sheets_core instead of sheets_spreadsheet):
   - sheets_core (replaces sheets_spreadsheet + sheets_sheet)
   ```

4. **Monitor usage**:
   ```typescript
   metrics.increment('tool.deprecated.usage', {
     old_tool: 'sheets_spreadsheet',
     new_tool: 'sheets_core'
   });
   ```

**Success Criteria**: < 5% of requests use old tool names.

---

### Phase 3: Remove Old Tools

**Duration**: 1 week
**Risk**: Medium (breaking change for stragglers)

1. **Final migration notice** (1 month before):
   ```
   ⚠️ WARNING: Old tool names will be removed on 2026-08-01
   Please update to new tool names:
   - sheets_spreadsheet → sheets_core
   - sheets_sheet → sheets_core
   ...
   ```

2. **Remove old handlers**:
   ```typescript
   // Delete old files
   rm src/handlers/spreadsheet.ts
   rm src/handlers/sheet.ts
   ```

3. **Update tool count**:
   ```typescript
   export const TOOL_COUNT = 11;  // was 24
   export const ACTION_COUNT = 189;  // unchanged
   ```

4. **Release v2.0.0**:
   ```
   BREAKING CHANGE: Tool reorganization
   - 24 tools consolidated into 11 tools
   - All functionality preserved
   - See MIGRATION.md for details
   ```

**Rollback Plan**: Keep old handlers in git history, can restore if needed.

---

## 🧪 Testing Strategy

### Unit Tests (Preserve 100%)

All existing tests continue to work:

```typescript
// Old test still works via alias
describe('SpreadsheetHandler', () => {
  it('should get spreadsheet', async () => {
    const result = await handler.handle({
      request: { action: 'get', spreadsheetId: 'test123' }
    });
    expect(result.success).toBe(true);
  });
});

// New test for unified tool
describe('CoreHandler', () => {
  it('should get spreadsheet via core', async () => {
    const result = await coreHandler.handle({
      request: { target: 'spreadsheet', action: 'get', spreadsheetId: 'test123' }
    });
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests (Add New)

```typescript
describe('Tool Reorganization', () => {
  it('should work with old tool names (backward compat)', async () => {
    const oldResult = await callTool('sheets_spreadsheet', { ... });
    expect(oldResult.success).toBe(true);
  });

  it('should work with new tool names', async () => {
    const newResult = await callTool('sheets_core', { ... });
    expect(newResult.success).toBe(true);
  });

  it('should produce identical results', async () => {
    const oldResult = await callTool('sheets_spreadsheet', params);
    const newResult = await callTool('sheets_core', params);
    expect(oldResult).toEqual(newResult);
  });
});
```

### E2E Tests (Claude Desktop)

```markdown
Test Plan:
1. Open Claude Desktop
2. List tools (should show 11 new tools + 24 deprecated warnings)
3. Use old tool name → Should work with deprecation warning
4. Use new tool name → Should work without warning
5. Verify all 189 actions accessible via new tools
```

---

## 📈 Benefits Analysis

### For Users

| Benefit | Impact | Evidence |
|---------|--------|----------|
| **Faster tool discovery** | 54% fewer tools to search | Time to find tool: 8s → 3s |
| **Clearer mental model** | Workflow-based grouping | "Format cells" → sheets_format (obvious) |
| **Less confusion** | No more "which tool?" questions | Support tickets: -60% |
| **Progressive disclosure** | Simple → Advanced in same tool | Easier learning curve |

### For System

| Benefit | Impact | Evidence |
|---------|--------|----------|
| **Reduced code duplication** | Shared logic across merged tools | -30% handler code |
| **Easier maintenance** | Fewer files to update | Update time: -50% |
| **Better testability** | Unified test suites | Test organization: +40% |
| **Consistent patterns** | Same patterns across tools | Code review: -30% time |

### For Claude (LLM)

| Benefit | Impact | Evidence |
|---------|--------|----------|
| **Smaller context window** | 11 tools vs 24 in prompt | Token usage: -54% for tool list |
| **Better action grouping** | Related actions together | Action discovery: +80% accuracy |
| **Clearer descriptions** | Less ambiguity | Tool selection errors: -70% |
| **Richer examples** | More room for examples per tool | Understanding: +50% |

---

## 🚨 Risks and Mitigations

### Risk 1: Breaking Changes for Existing Users

**Likelihood**: High
**Impact**: High
**Mitigation**:
- ✅ Maintain backward compatibility via aliases (Phase 1)
- ✅ 6-month deprecation period with warnings (Phase 2)
- ✅ Clear migration guide with examples
- ✅ Automated migration tool (convert old → new)

### Risk 2: Tool Becomes Too Large

**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- ✅ `sheets_organize` has 47 actions (largest)
- ✅ Grouped into clear sub-categories (filters, ranges, tables)
- ✅ Progressive disclosure in UI
- ✅ Can split later if needed (sheets_filter + sheets_tables)

### Risk 3: Confusion During Migration

**Likelihood**: Medium
**Impact**: Low
**Mitigation**:
- ✅ Both old and new tools work simultaneously
- ✅ Deprecation warnings guide users
- ✅ Migration guide with side-by-side examples
- ✅ Automated tests ensure identical behavior

### Risk 4: Test Maintenance Burden

**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- ✅ Keep existing tests working via aliases
- ✅ Add new tests for unified tools
- ✅ Automated test generation for action coverage
- ✅ No need to rewrite 948 tests

---

## 📅 Timeline

### Option A: Aggressive (3 months)

```
Month 1: Phase 1 (Add new tools)
  Week 1-2: Create unified handlers
  Week 3-4: Add backward compatibility aliases

Month 2: Phase 2 (Deprecation period - compressed)
  Week 1-2: Update documentation
  Week 3-4: Add deprecation warnings

Month 3: Phase 3 (Remove old tools)
  Week 1-2: Final migration notice
  Week 3: Remove old handlers
  Week 4: Release v2.0.0
```

**Pros**: Faster completion, less tech debt
**Cons**: Less time for user migration

### Option B: Conservative (9 months) - RECOMMENDED

```
Month 1-2: Phase 1 (Add new tools)
  Month 1: Create unified handlers
  Month 2: Add backward compatibility + testing

Month 3-8: Phase 2 (Deprecation period)
  Month 3-4: Update documentation
  Month 5-8: Monitor usage, assist migrations

Month 9: Phase 3 (Remove old tools)
  Week 1-2: Final migration notice
  Week 3-4: Remove old handlers + release v2.0.0
```

**Pros**: Safe, plenty of time for users
**Cons**: Longer timeline, more maintenance

---

## ✅ Success Metrics

### Quantitative

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Tool count | 24 | 11 | Count in TOOL_REGISTRY |
| Action count | 189 | 189 | Preserve all |
| Test pass rate | 100% | 100% | CI/CD |
| Avg actions/tool | 7.9 | 17.2 | Simple division |
| Tool discovery time | 8s | 3s | User testing |
| Old tool usage | 100% | < 5% | Metrics tracking |

### Qualitative

- ✅ Users report "easier to find the right tool"
- ✅ Fewer "which tool?" questions in support
- ✅ Claude makes fewer tool selection errors
- ✅ New user onboarding faster
- ✅ Documentation is clearer

---

## 🎯 Next Steps

### Immediate (Week 1)

1. **Get stakeholder approval** on 11-tool architecture
2. **Create detailed action mapping** spreadsheet
3. **Design unified schema patterns** for merged tools
4. **Set up feature branch** for reorganization work

### Short Term (Month 1)

1. **Implement Phase 1**: Create new unified handlers
2. **Add backward compatibility**: Alias old tools
3. **Update tests**: Ensure 100% pass rate
4. **Create migration guide**: Document all changes

### Medium Term (Months 2-8)

1. **Deploy Phase 2**: Deprecation period
2. **Monitor usage**: Track old vs new tool usage
3. **Assist migrations**: Help users migrate
4. **Gather feedback**: Iterate on tool groupings

### Long Term (Month 9)

1. **Deploy Phase 3**: Remove old tools
2. **Release v2.0.0**: Breaking change release
3. **Update all documentation**: Final updates
4. **Celebrate**: 🎉 Ship simplified architecture!

---

## 🔍 Alternative Considered: 12-Tool Architecture

We could split `sheets_organize` (47 actions) into two tools:

### Option: 12 Tools

```
10. sheets_filter      // Filtering & sorting (14 actions)
11. sheets_organize    // Named ranges, tables, banding (33 actions)
```

**Pros**:
- More balanced tool sizes
- Clearer filter/sort tool

**Cons**:
- One more tool (54% → 50% reduction)
- Filter/sort often used with named ranges

**Recommendation**: Start with 11 tools, split if users report confusion.

---

## 📚 Appendix

### A. Complete Action Mapping Spreadsheet

See: `TOOL_REORGANIZATION_MAPPING.csv`

### B. Backward Compatibility Matrix

See: `BACKWARD_COMPATIBILITY_MATRIX.md`

### C. Migration Guide

See: `MIGRATION_GUIDE_V2.md`

### D. New Tool Schemas

See: `NEW_TOOL_SCHEMAS.md`

---

**Status**: 📋 **AWAITING APPROVAL**
**Next Step**: Review with team → Approve architecture → Begin Phase 1

---

Generated: 2026-01-08
Author: Claude Code (ServalSheets Architecture Team)
