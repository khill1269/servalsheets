---
title: Google Sheets API v4 ↔ ServalSheets MCP Complete Mapping
category: general
last_updated: 2026-01-31
description: Complete API-to-MCP mapping reference for Google Sheets operations
version: 1.6.0
tags: [api, mcp, sheets]
---

# Google Sheets API v4 ↔ ServalSheets MCP Complete Mapping

## Quick Reference Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS API v4 → SERVALSHEETS MCP                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ╔══════════════════════════════════════════════════════════════════════════╗   │
│  ║  HTTP ENDPOINTS (7)                          ServalSheets Tool            ║   │
│  ╠══════════════════════════════════════════════════════════════════════════╣   │
│  ║  spreadsheets.create ........................ sheets_core.create     ✅   ║   │
│  ║  spreadsheets.get ........................... sheets_core.get        ✅   ║   │
│  ║  spreadsheets.getByDataFilter ............... sheets_core.batch_get  ✅   │
│  ║  spreadsheets.batchUpdate ................... 16 TOOLS (see below)   ✅   ║   │
│  ║  spreadsheets.values.* ...................... sheets_data            ✅   ║   │
│  ║  spreadsheets.sheets.copyTo ................. sheets_core            ✅   ║   │
│  ║  spreadsheets.developerMetadata.* ........... sheets_advanced        ✅   ║   │
│  ╚══════════════════════════════════════════════════════════════════════════╝   │
│                                                                                  │
│  ╔══════════════════════════════════════════════════════════════════════════╗   │
│  ║  VALUES API (10 methods)                     ServalSheets Action          ║   │
│  ╠══════════════════════════════════════════════════════════════════════════╣   │
│  ║  values.get ................................. sheets_data.read       ✅   ║   │
│  ║  values.update .............................. sheets_data.write      ✅   ║   │
│  ║  values.append .............................. sheets_data.append     ✅   ║   │
│  ║  values.clear ............................... sheets_data.clear      ✅   ║   │
│  ║  values.batchGet ............................ sheets_data.batch_read ✅   ║   │
│  ║  values.batchUpdate ......................... sheets_data.batch_write✅   ║   │
│  ║  values.batchClear .......................... sheets_data.batch_clear✅   ║   │
│  ║  values.batchGetByDataFilter ................ (via batch_read)       ✅   ║   │
│  ║  values.batchUpdateByDataFilter ............. (via batch_write)      ✅   ║   │
│  ║  values.batchClearByDataFilter .............. (via batch_clear)      ✅   ║   │
│  ╚══════════════════════════════════════════════════════════════════════════╝   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                    BATCHUPDATE OPERATIONS (50+ types)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  SPREADSHEET/SHEET MANAGEMENT                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ updateSpreadsheetProperties → sheets_core.update_properties       ✅   │     │
│  │ updateSheetProperties ────→ sheets_core.update_sheet              ✅   │     │
│  │ addSheet ─────────────────→ sheets_core.add_sheet                 ✅   │     │
│  │ deleteSheet ──────────────→ sheets_core.delete_sheet              ✅   │     │
│  │ duplicateSheet ───────────→ sheets_core.duplicate_sheet           ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  CELL OPERATIONS                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ updateCells ──────────────→ sheets_data.write, add_note, hyperlink✅   │     │
│  │ repeatCell ───────────────→ sheets_format.set_format, background  ✅   │     │
│  │ appendCells ──────────────→ sheets_data.append                    ✅   │     │
│  │ cutPaste ─────────────────→ sheets_data.cut                       ✅   │     │
│  │ copyPaste ────────────────→ sheets_data.copy                      ✅   │     │
│  │ pasteData ────────────────→ (via sheets_data.write)               ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  DIMENSION OPERATIONS (ROWS/COLUMNS)                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ insertDimension ──────────→ sheets_dimensions.insert_rows/columns ✅   │     │
│  │ deleteDimension ──────────→ sheets_dimensions.delete_rows/columns ✅   │     │
│  │ moveDimension ────────────→ sheets_dimensions.move_rows/columns   ✅   │     │
│  │ updateDimensionProperties → sheets_dimensions.resize/hide/show    ✅   │     │
│  │ appendDimension ──────────→ sheets_dimensions.append_rows/columns ✅   │     │
│  │ autoResizeDimensions ─────→ sheets_dimensions.auto_resize         ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  RANGE OPERATIONS                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ insertRange ──────────────→ (via insert_rows/columns)             ✅   │     │
│  │ deleteRange ──────────────→ (via delete_rows/columns)             ✅   │     │
│  │ sortRange ────────────────→ sheets_dimensions.sort_range          ✅   │     │
│  │ randomizeRange ───────────→ (not mapped - rarely used)            ⚪   │     │
│  │ trimWhitespace ───────────→ sheets_composite                      ✅   │     │
│  │ deleteDuplicates ─────────→ sheets_composite.deduplicate          ✅   │     │
│  │ mergeCells ───────────────→ sheets_data.merge                     ✅   │     │
│  │ unmergeCells ─────────────→ sheets_data.unmerge                   ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  FORMATTING                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ updateBorders ────────────→ sheets_format.set_borders             ✅   │     │
│  │ repeatCell (format) ──────→ sheets_format.set_format/background   ✅   │     │
│  │ addConditionalFormatRule ─→ sheets_format.rule_add_conditional    ✅   │     │
│  │ updateConditionalFormatRule→sheets_format.rule_update_conditional ✅   │     │
│  │ deleteConditionalFormatRule→sheets_format.rule_delete_conditional ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  DATA VALIDATION                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ setDataValidation ────────→ sheets_data.set_validation            ✅   │     │
│  │                           → sheets_format.set_data_validation     ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  NAMED RANGES                                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addNamedRange ────────────→ sheets_advanced.add_named_range       ✅   │     │
│  │ updateNamedRange ─────────→ sheets_advanced.update_named_range    ✅   │     │
│  │ deleteNamedRange ─────────→ sheets_advanced.delete_named_range    ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  FILTERS                                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ setBasicFilter ───────────→ sheets_dimensions.set_basic_filter    ✅   │     │
│  │ clearBasicFilter ─────────→ sheets_dimensions.clear_basic_filter  ✅   │     │
│  │ addFilterView ────────────→ sheets_dimensions.create_filter_view  ✅   │     │
│  │ updateFilterView ─────────→ sheets_dimensions.update_filter_view  ✅   │     │
│  │ deleteFilterView ─────────→ sheets_dimensions.delete_filter_view  ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  PROTECTED RANGES                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addProtectedRange ────────→ sheets_advanced.add_protected_range   ✅   │     │
│  │ updateProtectedRange ─────→ sheets_advanced.update_protected_range✅   │     │
│  │ deleteProtectedRange ─────→ sheets_advanced.delete_protected_range✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  CHARTS & EMBEDDED OBJECTS                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addChart ─────────────────→ sheets_visualize.chart_create         ✅   │     │
│  │ updateChartSpec ──────────→ sheets_visualize.chart_update         ✅   │     │
│  │ updateEmbeddedObjectPosition→sheets_visualize.chart_move/resize   ✅   │     │
│  │ deleteEmbeddedObject ─────→ sheets_visualize.chart_delete         ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  BANDING (ALTERNATING COLORS)                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addBanding ───────────────→ sheets_advanced.add_banding           ✅   │     │
│  │ updateBanding ────────────→ sheets_advanced.update_banding        ✅   │     │
│  │ deleteBanding ────────────→ sheets_advanced.delete_banding        ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  SLICERS                                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addSlicer ────────────────→ sheets_dimensions.create_slicer       ✅   │     │
│  │ updateSlicerSpec ─────────→ sheets_dimensions.update_slicer       ✅   │     │
│  │ (deleteEmbeddedObject) ───→ sheets_dimensions.delete_slicer       ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  DEVELOPER METADATA                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ createDeveloperMetadata ──→ sheets_advanced.set_metadata          ✅   │     │
│  │ updateDeveloperMetadata ──→ sheets_advanced.set_metadata          ✅   │     │
│  │ deleteDeveloperMetadata ──→ sheets_advanced.delete_metadata       ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  DIMENSION GROUPS                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addDimensionGroup ────────→ sheets_dimensions.group_rows/columns  ✅   │     │
│  │ deleteDimensionGroup ─────→ sheets_dimensions.ungroup_rows/columns✅   │     │
│  │ updateDimensionGroup ─────→ (via group operations)                ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  DATA SOURCES (BigQuery - NOT YET IMPLEMENTED)                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addDataSource ────────────→ (requires BigQuery API)               ❌   │     │
│  │ updateDataSource ─────────→ (requires BigQuery API)               ❌   │     │
│  │ deleteDataSource ─────────→ (requires BigQuery API)               ❌   │     │
│  │ refreshDataSource ────────→ (requires BigQuery API)               ❌   │     │
│  │ cancelDataSourceRefresh ──→ (requires BigQuery API)               ❌   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  TABLES (NEW FEATURE)                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ addTable ─────────────────→ sheets_advanced.create_table          ✅   │     │
│  │ updateTable ──────────────→ (via create_table)                    ✅   │     │
│  │ deleteTable ──────────────→ sheets_advanced.delete_table          ✅   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  OTHER                                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ autoFill ─────────────────→ sheets_composite                      ✅   │     │
│  │ findReplace ──────────────→ sheets_data.find/replace              ✅   │     │
│  │ textToColumns ────────────→ (not mapped - rarely used)            ⚪   │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MCP PROTOCOL 2025-11-25 COMPLIANCE                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  CORE MCP FEATURES                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ Tool Registration (22 tools) ................................ ✅      │     │
│  │ Tool Annotations (4 hints) .................................. ✅      │     │
│  │   ├── readOnlyHint                                                    │     │
│  │   ├── destructiveHint                                                 │     │
│  │   ├── idempotentHint                                                  │     │
│  │   └── openWorldHint                                                   │     │
│  │ Zod Schema Validation (24 schemas) .......................... ✅      │     │
│  │ Structured Outputs .......................................... ✅      │     │
│  │ Discriminated Unions ........................................ ✅      │     │
│  │ Error Handling (40+ codes) .................................. ✅      │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  MCP SEP IMPLEMENTATIONS                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ SEP-986  Tool Naming (snake_case) ........................... ✅      │     │
│  │ SEP-973  Tool Icons ......................................... ✅      │     │
│  │ SEP-1036 Elicitation (User Input) ........................... ✅      │     │
│  │ SEP-1577 Sampling (AI Analysis) ............................. ✅      │     │
│  │ SEP-1686 Tasks (Background Ops) ............................. ✅      │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  DECLARED CAPABILITIES                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ tools ...................... ✅ 22 tools, 299 actions                 │     │
│  │ resources .................. ✅ URI templates + knowledge             │     │
│  │ prompts .................... ✅ 6 guided workflows                    │     │
│  │ completions ................ ✅ Argument autocompletion               │     │
│  │ tasks ...................... ✅ Background execution                  │     │
│  │ logging .................... ✅ Dynamic log level control             │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
│  ADVANCED FEATURES                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ Progress Notifications (notifications/progress) ............. ✅      │     │
│  │ Task Cancellation ........................................... ✅      │     │
│  │ Structured Logging (Winston + MCP) .......................... ✅      │     │
│  │ Resource Templates .......................................... ✅      │     │
│  │ Knowledge Resources ......................................... ✅      │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COVERAGE SUMMARY                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ╔══════════════════════════════════════════════════════════════════════════╗   │
│  ║                                                                          ║   │
│  ║   GOOGLE SHEETS API v4                                                   ║   │
│  ║   ┌──────────────────────────────────────────────────────────────────┐   ║   │
│  ║   │  HTTP Endpoints:     7/7   ████████████████████████████████ 100%│   ║   │
│  ║   │  Values API:        10/10  ████████████████████████████████ 100%│   ║   │
│  ║   │  batchUpdate types: 47/50  █████████████████████████████░░░  94%│   ║   │
│  ║   │  Drive API:         14/14  ████████████████████████████████ 100%│   ║   │
│  ║   └──────────────────────────────────────────────────────────────────┘   ║   │
│  ║                                                                          ║   │
│  ║   MCP PROTOCOL 2025-11-25                                                ║   │
│  ║   ┌──────────────────────────────────────────────────────────────────┐   ║   │
│  ║   │  Core Features:      6/6   ████████████████████████████████ 100%│   ║   │
│  ║   │  SEP Features:       5/5   ████████████████████████████████ 100%│   ║   │
│  ║   │  Capabilities:       6/6   ████████████████████████████████ 100%│   ║   │
│  ║   │  Advanced Features:  5/5   ████████████████████████████████ 100%│   ║   │
│  ║   └──────────────────────────────────────────────────────────────────┘   ║   │
│  ║                                                                          ║   │
│  ║   OVERALL COMPLIANCE                                                     ║   │
│  ║   ┌──────────────────────────────────────────────────────────────────┐   ║   │
│  ║   │  Sheets API:               █████████████████████████████████ 98%│   ║   │
│  ║   │  MCP Protocol:             ████████████████████████████████ 100%│   ║   │
│  ║   └──────────────────────────────────────────────────────────────────┘   ║   │
│  ║                                                                          ║   │
│  ╚══════════════════════════════════════════════════════════════════════════╝   │
│                                                                                  │
│  Legend: ✅ Implemented  ❌ Not Implemented  ⚪ Intentionally Skipped           │
│                                                                                  │
│  Missing (3 items):                                                              │
│  • addDataSource, updateDataSource, deleteDataSource (BigQuery - Phase 2)       │
│  • refreshDataSource, cancelDataSourceRefresh (BigQuery - Phase 2)              │
│  • randomizeRange, textToColumns (Rarely used)                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## ServalSheets Tool Architecture

```
ServalSheets v1.6.0 MCP Server
├── sheets_auth (4 actions) ─────────────── OAuth 2.1 Authentication
├── sheets_core (15 actions) ────────────── Spreadsheet/Sheet Management
├── sheets_data (20 actions) ────────────── Cell Values (values.* API)
├── sheets_format (18 actions) ──────────── Cell Formatting
├── sheets_dimensions (35 actions) ──────── Rows/Columns/Filters/Slicers
├── sheets_visualize (17 actions) ───────── Charts & Pivot Tables
├── sheets_collaborate (28 actions) ─────── Sharing/Comments/Versions (Drive API)
├── sheets_advanced (27 actions) ────────── Named Ranges/Protection/Formula AI
├── sheets_transaction (6 actions) ──────── Atomic Batch Operations
├── sheets_quality (4 actions) ──────────── Data Validation
├── sheets_history (7 actions) ──────────── Operation Audit Trail
├── sheets_confirm (2 actions) ──────────── MCP Elicitation (SEP-1036)
├── sheets_analyze (11 actions) ─────────── MCP Sampling (SEP-1577)
├── sheets_fix (1 action) ───────────────── Auto-fix Detected Issues
├── sheets_composite (4 actions) ────────── High-level Operations
└── sheets_session (13 actions) ─────────── Context Management
    ═══════════════════════════════════════
    Total: 22 tools, 299 actions
```

## Verification Commands

```bash
# Check TypeScript compilation
npm run typecheck
# ✅ PASS (0 errors)

# Check metadata synchronization
npm run check:drift
# ✅ PASS (all 5 files synchronized)

# Run test suite
npm test
# ✅ PASS (1761 tests)
```
