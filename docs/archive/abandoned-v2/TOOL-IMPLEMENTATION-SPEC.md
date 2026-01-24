# ServalSheets 2.0 - Implementation Specification

## Quick Reference: 11 Super Tools

| Tool | Actions | Primary Use Case |
|------|---------|------------------|
| `sheets_auth` | 4 | OAuth authentication |
| `sheets_data` | 28 | Read/write all data |
| `sheets_style` | 18 | Formatting + rules |
| `sheets_structure` | 25 | Sheets, dims, named ranges |
| `sheets_visualize` | 20 | Charts, pivots, filters |
| `sheets_analyze` | 15 | AI + traditional analysis |
| `sheets_automate` | 12 | Fixes, bulk ops, import |
| `sheets_share` | 16 | Permissions + comments |
| `sheets_history` | 12 | Versions + operations |
| `sheets_safety` | 12 | Transactions + validation |
| `sheets_context` | 8 | Session + confirmation |

**Total: 11 tools, 170 actions**

---

## Tool 1: sheets_auth

**No changes from current implementation.**

```typescript
const SheetsAuthSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('login'), scopes: z.array(z.string()).optional() }),
  z.object({ action: z.literal('callback'), code: z.string() }),
  z.object({ action: z.literal('logout') }),
]);
```

---

## Tool 2: sheets_data

**The core data tool. Handles all CRUD operations.**

```typescript
// Safety options available on all write operations
const SafetyOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
  createSnapshot: z.boolean().default(false),
  requireConfirmation: z.boolean().default(false),
  transactionId: z.string().optional(), // Auto-queue to existing transaction
}).optional();

const SheetsDataSchema = z.discriminatedUnion('action', [
  // === SPREADSHEET LEVEL ===
  z.object({
    action: z.literal('create'),
    title: z.string(),
    sheets: z.array(z.object({
      title: z.string(),
      rowCount: z.number().optional(),
      columnCount: z.number().optional(),
    })).optional(),
  }),
  z.object({
    action: z.literal('get'),
    spreadsheetId: z.string(),
    includeGridData: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('get_url'),
    spreadsheetId: z.string(),
  }),
  z.object({
    action: z.literal('copy'),
    spreadsheetId: z.string(),
    title: z.string().optional(),
    folderId: z.string().optional(),
  }),
  z.object({
    action: z.literal('update_properties'),
    spreadsheetId: z.string(),
    title: z.string().optional(),
    locale: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  z.object({
    action: z.literal('batch_get'),
    spreadsheetIds: z.array(z.string()),
  }),
  z.object({
    action: z.literal('list'),
    query: z.string().optional(),
    limit: z.number().optional(),
    pageToken: z.string().optional(),
  }),

  // === CELL VALUES ===
  z.object({
    action: z.literal('read'),
    spreadsheetId: z.string(),
    range: z.string(),
    valueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional(),
  }),
  z.object({
    action: z.literal('write'),
    spreadsheetId: z.string(),
    range: z.string(),
    values: z.array(z.array(z.any())),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('append'),
    spreadsheetId: z.string(),
    range: z.string(),
    values: z.array(z.array(z.any())),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional(),
    insertDataOption: z.enum(['OVERWRITE', 'INSERT_ROWS']).optional(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('clear'),
    spreadsheetId: z.string(),
    range: z.string(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('batch_read'),
    spreadsheetId: z.string(),
    ranges: z.array(z.string()),
    valueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional(),
  }),
  z.object({
    action: z.literal('batch_write'),
    spreadsheetId: z.string(),
    data: z.array(z.object({
      range: z.string(),
      values: z.array(z.array(z.any())),
    })),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('find'),
    spreadsheetId: z.string(),
    range: z.string().optional(),
    searchValue: z.string(),
    matchCase: z.boolean().optional(),
    matchEntireCell: z.boolean().optional(),
    searchByRegex: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('replace'),
    spreadsheetId: z.string(),
    range: z.string().optional(),
    find: z.string(),
    replacement: z.string(),
    matchCase: z.boolean().optional(),
    matchEntireCell: z.boolean().optional(),
    safety: SafetyOptionsSchema,
  }),

  // === CELL OPERATIONS ===
  z.object({
    action: z.literal('add_note'),
    spreadsheetId: z.string(),
    range: z.string(),
    note: z.string(),
  }),
  z.object({
    action: z.literal('get_note'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('clear_note'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('set_hyperlink'),
    spreadsheetId: z.string(),
    range: z.string(),
    url: z.string(),
    displayText: z.string().optional(),
  }),
  z.object({
    action: z.literal('clear_hyperlink'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('merge'),
    spreadsheetId: z.string(),
    range: z.string(),
    mergeType: z.enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS']).optional(),
  }),
  z.object({
    action: z.literal('unmerge'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('get_merges'),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
  }),
  z.object({
    action: z.literal('cut'),
    spreadsheetId: z.string(),
    source: z.string(),
    destination: z.string(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('copy_cells'),
    spreadsheetId: z.string(),
    source: z.string(),
    destination: z.string(),
  }),
  z.object({
    action: z.literal('paste'),
    spreadsheetId: z.string(),
    source: z.string(),
    destination: z.string(),
    pasteType: z.enum(['PASTE_NORMAL', 'PASTE_VALUES', 'PASTE_FORMAT', 'PASTE_NO_BORDERS', 'PASTE_FORMULA', 'PASTE_DATA_VALIDATION', 'PASTE_CONDITIONAL_FORMATTING']).optional(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('get_properties'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
]);
```

---

## Tool 3: sheets_style

**All formatting and styling in one place.**

```typescript
const SheetsStyleSchema = z.discriminatedUnion('action', [
  // === FORMATTING ===
  z.object({
    action: z.literal('set_format'),
    spreadsheetId: z.string(),
    range: z.string(),
    format: z.object({
      backgroundColor: ColorSchema.optional(),
      textFormat: TextFormatSchema.optional(),
      numberFormat: NumberFormatSchema.optional(),
      horizontalAlignment: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
      verticalAlignment: z.enum(['TOP', 'MIDDLE', 'BOTTOM']).optional(),
      wrapStrategy: z.enum(['OVERFLOW_CELL', 'CLIP', 'WRAP']).optional(),
      borders: BordersSchema.optional(),
    }),
  }),
  z.object({
    action: z.literal('set_background'),
    spreadsheetId: z.string(),
    range: z.string(),
    color: ColorSchema,
  }),
  z.object({
    action: z.literal('set_text_format'),
    spreadsheetId: z.string(),
    range: z.string(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    foregroundColor: ColorSchema.optional(),
  }),
  z.object({
    action: z.literal('set_number_format'),
    spreadsheetId: z.string(),
    range: z.string(),
    pattern: z.string(), // e.g., "$#,##0.00", "yyyy-mm-dd"
  }),
  z.object({
    action: z.literal('set_alignment'),
    spreadsheetId: z.string(),
    range: z.string(),
    horizontal: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
    vertical: z.enum(['TOP', 'MIDDLE', 'BOTTOM']).optional(),
  }),
  z.object({
    action: z.literal('set_borders'),
    spreadsheetId: z.string(),
    range: z.string(),
    style: z.enum(['SOLID', 'DASHED', 'DOTTED', 'DOUBLE', 'NONE']),
    color: ColorSchema.optional(),
    sides: z.array(z.enum(['TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'INNER_HORIZONTAL', 'INNER_VERTICAL'])).optional(),
  }),
  z.object({
    action: z.literal('clear_format'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('apply_preset'),
    spreadsheetId: z.string(),
    range: z.string(),
    preset: z.enum(['header', 'subheader', 'data', 'currency', 'percentage', 'date', 'highlight', 'warning', 'error', 'success']),
  }),
  z.object({
    action: z.literal('auto_fit'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS']),
    startIndex: z.number().optional(),
    endIndex: z.number().optional(),
  }),

  // === CONDITIONAL FORMATTING ===
  z.object({
    action: z.literal('add_conditional'),
    spreadsheetId: z.string(),
    range: z.string(),
    rule: ConditionalFormatRuleSchema,
  }),
  z.object({
    action: z.literal('update_conditional'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    ruleIndex: z.number(),
    rule: ConditionalFormatRuleSchema,
  }),
  z.object({
    action: z.literal('delete_conditional'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    ruleIndex: z.number(),
  }),
  z.object({
    action: z.literal('list_conditionals'),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
  }),

  // === DATA VALIDATION ===
  z.object({
    action: z.literal('add_validation'),
    spreadsheetId: z.string(),
    range: z.string(),
    rule: DataValidationRuleSchema,
  }),
  z.object({
    action: z.literal('clear_validation'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('list_validations'),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
  }),

  // === ALTERNATING COLORS (BANDING) ===
  z.object({
    action: z.literal('add_alternating'),
    spreadsheetId: z.string(),
    range: z.string(),
    headerColor: ColorSchema.optional(),
    firstBandColor: ColorSchema.optional(),
    secondBandColor: ColorSchema.optional(),
  }),
]);
```

---

## Tool 4: sheets_structure

**Organize spreadsheet structure: sheets, dimensions, named ranges.**

```typescript
const SheetsStructureSchema = z.discriminatedUnion('action', [
  // === SHEET MANAGEMENT ===
  z.object({
    action: z.literal('add_sheet'),
    spreadsheetId: z.string(),
    title: z.string(),
    rowCount: z.number().optional(),
    columnCount: z.number().optional(),
    index: z.number().optional(),
  }),
  z.object({
    action: z.literal('delete_sheet'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('duplicate_sheet'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    newTitle: z.string().optional(),
    insertIndex: z.number().optional(),
  }),
  z.object({
    action: z.literal('rename_sheet'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    title: z.string(),
  }),
  z.object({
    action: z.literal('hide_sheet'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
  }),
  z.object({
    action: z.literal('show_sheet'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
  }),
  z.object({
    action: z.literal('move_sheet'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    newIndex: z.number(),
  }),
  z.object({
    action: z.literal('list_sheets'),
    spreadsheetId: z.string(),
  }),
  z.object({
    action: z.literal('copy_to'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    destinationSpreadsheetId: z.string(),
  }),

  // === DIMENSIONS (Rows & Columns) ===
  z.object({
    action: z.literal('insert_rows'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    startIndex: z.number(),
    count: z.number(),
  }),
  z.object({
    action: z.literal('insert_columns'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    startIndex: z.number(),
    count: z.number(),
  }),
  z.object({
    action: z.literal('delete_rows'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    startIndex: z.number(),
    count: z.number(),
    safety: SafetyOptionsSchema, // ALWAYS require confirmation for >10 rows
  }),
  z.object({
    action: z.literal('delete_columns'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    startIndex: z.number(),
    count: z.number(),
    safety: SafetyOptionsSchema,
  }),
  z.object({
    action: z.literal('resize'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS']),
    startIndex: z.number(),
    endIndex: z.number(),
    pixelSize: z.number(),
  }),
  z.object({
    action: z.literal('auto_resize'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS']),
    startIndex: z.number().optional(),
    endIndex: z.number().optional(),
  }),
  z.object({
    action: z.literal('freeze'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    rows: z.number().optional(),
    columns: z.number().optional(),
  }),
  z.object({
    action: z.literal('unfreeze'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS', 'BOTH']).optional(),
  }),
  z.object({
    action: z.literal('group'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS']),
    startIndex: z.number(),
    endIndex: z.number(),
  }),
  z.object({
    action: z.literal('ungroup'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS']),
    startIndex: z.number(),
    endIndex: z.number(),
  }),
  z.object({
    action: z.literal('hide_dimension'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS']),
    startIndex: z.number(),
    endIndex: z.number(),
  }),
  z.object({
    action: z.literal('show_dimension'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dimension: z.enum(['ROWS', 'COLUMNS']),
    startIndex: z.number(),
    endIndex: z.number(),
  }),

  // === ORGANIZATION ===
  z.object({
    action: z.literal('add_named_range'),
    spreadsheetId: z.string(),
    name: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('delete_named_range'),
    spreadsheetId: z.string(),
    namedRangeId: z.string(),
  }),
  z.object({
    action: z.literal('list_named_ranges'),
    spreadsheetId: z.string(),
  }),
  z.object({
    action: z.literal('add_protection'),
    spreadsheetId: z.string(),
    range: z.string().optional(), // If not provided, protect entire sheet
    sheetId: z.number().optional(),
    description: z.string().optional(),
    editors: z.array(z.string()).optional(),
    warningOnly: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('remove_protection'),
    spreadsheetId: z.string(),
    protectedRangeId: z.number(),
  }),
  z.object({
    action: z.literal('list_protections'),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
  }),
]);
```

---

## Tool 5: sheets_visualize

**Charts, pivot tables, and filtering.**

```typescript
const SheetsVisualizeSchema = z.discriminatedUnion('action', [
  // === CHARTS ===
  z.object({
    action: z.literal('create_chart'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    type: z.enum(['LINE', 'BAR', 'COLUMN', 'PIE', 'SCATTER', 'AREA', 'COMBO', 'HISTOGRAM', 'TREEMAP', 'WATERFALL']),
    dataRange: z.string(),
    title: z.string().optional(),
    position: ChartPositionSchema.optional(),
    options: ChartOptionsSchema.optional(),
  }),
  z.object({
    action: z.literal('update_chart'),
    spreadsheetId: z.string(),
    chartId: z.number(),
    title: z.string().optional(),
    dataRange: z.string().optional(),
    options: ChartOptionsSchema.optional(),
  }),
  z.object({
    action: z.literal('delete_chart'),
    spreadsheetId: z.string(),
    chartId: z.number(),
  }),
  z.object({
    action: z.literal('list_charts'),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
  }),
  z.object({
    action: z.literal('move_chart'),
    spreadsheetId: z.string(),
    chartId: z.number(),
    position: ChartPositionSchema,
  }),
  z.object({
    action: z.literal('export_chart'),
    spreadsheetId: z.string(),
    chartId: z.number(),
    format: z.enum(['PNG', 'PDF']).optional(),
  }),

  // === PIVOT TABLES ===
  z.object({
    action: z.literal('create_pivot'),
    spreadsheetId: z.string(),
    sourceRange: z.string(),
    destinationSheetId: z.number(),
    destinationCell: z.string(),
    rows: z.array(PivotGroupSchema),
    columns: z.array(PivotGroupSchema).optional(),
    values: z.array(PivotValueSchema),
    filters: z.array(PivotFilterSchema).optional(),
  }),
  z.object({
    action: z.literal('update_pivot'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    startRow: z.number(),
    startColumn: z.number(),
    // Updated config...
    rows: z.array(PivotGroupSchema).optional(),
    columns: z.array(PivotGroupSchema).optional(),
    values: z.array(PivotValueSchema).optional(),
  }),
  z.object({
    action: z.literal('delete_pivot'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    startRow: z.number(),
    startColumn: z.number(),
  }),
  z.object({
    action: z.literal('refresh_pivot'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
  }),
  z.object({
    action: z.literal('list_pivots'),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
  }),

  // === FILTERING & SORTING ===
  z.object({
    action: z.literal('set_filter'),
    spreadsheetId: z.string(),
    range: z.string(),
  }),
  z.object({
    action: z.literal('clear_filter'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
  }),
  z.object({
    action: z.literal('update_filter'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    columnIndex: z.number(),
    criteria: FilterCriteriaSchema,
  }),
  z.object({
    action: z.literal('sort_range'),
    spreadsheetId: z.string(),
    range: z.string(),
    sortSpecs: z.array(z.object({
      dimensionIndex: z.number(),
      sortOrder: z.enum(['ASCENDING', 'DESCENDING']),
    })),
  }),
  z.object({
    action: z.literal('create_filter_view'),
    spreadsheetId: z.string(),
    range: z.string(),
    title: z.string(),
    criteria: z.record(z.number(), FilterCriteriaSchema).optional(),
    sortSpecs: z.array(SortSpecSchema).optional(),
  }),
  z.object({
    action: z.literal('update_filter_view'),
    spreadsheetId: z.string(),
    filterViewId: z.number(),
    title: z.string().optional(),
    criteria: z.record(z.number(), FilterCriteriaSchema).optional(),
  }),
  z.object({
    action: z.literal('delete_filter_view'),
    spreadsheetId: z.string(),
    filterViewId: z.number(),
  }),
  z.object({
    action: z.literal('list_filter_views'),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
  }),
  z.object({
    action: z.literal('create_slicer'),
    spreadsheetId: z.string(),
    sheetId: z.number(),
    dataRange: z.string(),
    filterColumnIndex: z.number(),
    position: SlicerPositionSchema,
    title: z.string().optional(),
  }),
  z.object({
    action: z.literal('update_slicer'),
    spreadsheetId: z.string(),
    slicerId: z.number(),
    title: z.string().optional(),
    position: SlicerPositionSchema.optional(),
  }),
]);
```

---

## Remaining Tools (Summary)

### sheets_analyze (15 actions)
- comprehensive, data_quality, formula_audit, statistics, detect_patterns
- column_analysis, generate_formula, suggest_chart, explain_data, query_natural
- suggest_template, apply_recommendation, analyze_performance, analyze_formulas, compare_ranges

### sheets_automate (12 actions)  
- preview_fixes, apply_fixes, fix_formulas, fix_formatting
- import_csv, import_json, smart_append, bulk_update
- deduplicate, bulk_format, bulk_validate, migrate_data

### sheets_share (16 actions)
- share, update_permission, remove_permission, list_permissions
- get_permission, transfer_ownership, set_link_sharing, get_share_link
- add_comment, update_comment, delete_comment, list_comments
- get_comment, resolve_comment, reopen_comment, add_reply

### sheets_history (12 actions)
- list_revisions, get_revision, restore_revision, create_snapshot
- list_snapshots, restore_snapshot, compare_versions
- list_operations, get_operation, undo, redo, revert_to

### sheets_safety (12 actions)
- begin, queue, commit, rollback, status
- validate, check_conflicts, analyze_impact, preview
- estimate_quota, verify_range, list_transactions

### sheets_context (8 actions)
- set_active, get_context, find_reference, update_preferences
- request_confirm, get_confirmation, cancel_pending, get_stats

---

## File Structure

```
src/
├── handlers/
│   ├── auth.ts           # sheets_auth (unchanged)
│   ├── data.ts           # sheets_data (NEW - merged)
│   ├── style.ts          # sheets_style (NEW - merged)
│   ├── structure.ts      # sheets_structure (NEW - merged)
│   ├── visualize.ts      # sheets_visualize (NEW - merged)
│   ├── analyze.ts        # sheets_analyze (ENHANCED)
│   ├── automate.ts       # sheets_automate (NEW - merged)
│   ├── share.ts          # sheets_share (ENHANCED)
│   ├── history.ts        # sheets_history (ENHANCED)
│   ├── safety.ts         # sheets_safety (NEW - merged)
│   ├── context.ts        # sheets_context (NEW - merged)
│   └── index.ts          # Handler registry
├── schemas/
│   ├── auth.ts
│   ├── data.ts           # NEW
│   ├── style.ts          # NEW
│   ├── structure.ts      # NEW
│   ├── visualize.ts      # NEW
│   ├── analyze.ts
│   ├── automate.ts       # NEW
│   ├── share.ts
│   ├── history.ts
│   ├── safety.ts         # NEW
│   ├── context.ts        # NEW
│   └── index.ts
└── ...
```

---

## Migration Mapping

| Old Tool | New Tool | Notes |
|----------|----------|-------|
| sheets_auth | sheets_auth | Unchanged |
| sheets_core | sheets_data | Merged |
| sheets_data | sheets_data | Merged |
| sheets_data | sheets_data | Merged |
| sheets_format | sheets_style | Merged |
| sheets_format | sheets_style | Merged |
| sheets_core | sheets_structure | Merged |
| sheets_dimensions | sheets_structure | Merged |
| sheets_advanced (partial) | sheets_structure | Named ranges, protection |
| sheets_advanced (partial) | sheets_style | Banding |
| sheets_visualize | sheets_visualize | Merged |
| sheets_visualize | sheets_visualize | Merged |
| sheets_dimensions | sheets_visualize | Merged |
| sheets_analyze | sheets_analyze | Deprecated, merged |
| sheets_analyze | sheets_analyze | Enhanced |
| sheets_fix | sheets_automate | Merged |
| sheets_composite | sheets_automate | Merged |
| sheets_collaborate | sheets_share | Enhanced |
| sheets_collaborate | sheets_share | Merged |
| sheets_collaborate | sheets_history | Merged |
| sheets_history | sheets_history | Enhanced |
| sheets_transaction | sheets_safety | Merged |
| sheets_quality | sheets_safety | Merged |
| sheets_quality | sheets_safety | Merged |
| sheets_quality | sheets_safety | Merged |
| sheets_confirm | sheets_context | Merged |
| sheets_session | sheets_context | Merged |

---

## Next Steps

1. **Review this spec** - Get approval on the tool consolidation
2. **Create migration tests** - Ensure old → new mapping works
3. **Implement handlers** - Build new consolidated handlers
4. **Update schemas** - Create new schema files
5. **Update SKILL.md** - New orchestration patterns
6. **Deprecation period** - Run old and new in parallel
7. **Final cutover** - Remove deprecated tools
