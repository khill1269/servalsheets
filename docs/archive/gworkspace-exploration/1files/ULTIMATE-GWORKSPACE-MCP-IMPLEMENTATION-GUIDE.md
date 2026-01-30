# Ultimate GWorkspace MCP Server
## Complete Implementation Guide v1.0

**Generated:** January 13, 2026  
**MCP Version:** 2025-11-25  
**Sources:** Docs 11, 14, 15, 17, 18, 19, 20, 22 from canonical project documentation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Complete Tool Specifications](#3-complete-tool-specifications)
4. [Intelligence Layer](#4-intelligence-layer)
5. [MCP Compliance Requirements](#5-mcp-compliance-requirements)
6. [Google API Mapping](#6-google-api-mapping)
7. [Implementation Patterns](#7-implementation-patterns)
8. [Safety Features](#8-safety-features)
9. [Project Structure](#9-project-structure)
10. [Implementation Phases](#10-implementation-phases)
11. [Comparison: ServalSheets v2 vs GWorkspace MCP](#11-comparison)

---

## 1. Executive Summary

### Key Metrics

| Metric | Value |
|--------|-------|
| **Tools** | 16 |
| **Actions** | 211 (192 base + 19 MCP features) |
| **Resources** | 25+ URI patterns |
| **Prompts** | 12 workflow templates |
| **Google APIs** | 4 (Sheets v4, Drive v3, BigQuery, Apps Script) |
| **Estimated LOC** | 15,000-20,000 TypeScript |

### What Makes This Server Unique

1. **Full MCP Primitives** - Tools + Resources + Prompts (most servers only use Tools)
2. **Server-Side Intelligence** - Sampling for smart decisions (Server → LLM)
3. **User Confirmation** - Elicitation prevents mistakes (Server → User)
4. **Live Progress** - Streaming for long operations
5. **Safety Features** - Snapshot, diff preview, undo tracking, dry run
6. **MCP 2025-11-25 Compliance** - Annotations, cancellation, logging, pagination
7. **Workflow Engine** - Complex tasks in one call
8. **Knowledge System** - Context-aware documentation resources

### Core Packages

```bash
npm install @modelcontextprotocol/sdk@^1.22.0 googleapis@^140.0.0 \
            google-auth-library@^9.0.0 zod@^3.25.0 express@^4.18.0
```

---

## 2. Architecture Overview

### 4-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│              (Claude Desktop, IDE Extensions, Custom Apps)           │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    MCP Protocol (JSON-RPC 2.0)
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                       CAPABILITY LAYER                               │
│                                                                      │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│   │  16 TOOLS     │  │  RESOURCES    │  │   PROMPTS     │           │
│   │  ~190 actions │  │  25+ URIs     │  │ 12 workflows  │           │
│   └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                      │
│   Tool Annotations: readOnlyHint, destructiveHint, idempotentHint   │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                      INTELLIGENCE LAYER                              │
│                                                                      │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│   │   SAMPLING    │  │  ELICITATION  │  │   STREAMING   │           │
│   │  Server→LLM   │  │  Server→User  │  │   Progress    │           │
│   └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                      │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│   │   SNAPSHOT    │  │ DIFF PREVIEW  │  │  UNDO TRACK   │           │
│   │   Backup      │  │  Before/After │  │   Rollback    │           │
│   └───────────────┘  └───────────────┘  └───────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                       EXECUTION LAYER                                │
│                                                                      │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│   │    BATCH      │  │   SESSION     │  │     AUTH      │           │
│   │   Optimizer   │  │   Manager     │  │   OAuth2      │           │
│   └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                      │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│   │    ERROR      │  │ CANCELLATION  │  │   LOGGING     │           │
│   │   Recovery    │  │   Support     │  │  Structured   │           │
│   └───────────────┘  └───────────────┘  └───────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                          GOOGLE APIS                                 │
│                                                                      │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│   │  SHEETS v4    │  │  DRIVE v3     │  │  BIGQUERY     │           │
│   │  Core data    │  │  Files/Share  │  │  Analytics    │           │
│   └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                      │
│   ┌───────────────┐                                                  │
│   │ APPS SCRIPT   │                                                  │
│   │  Automation   │                                                  │
│   └───────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Tool Specifications

### Tool Categories Overview

| Category | Tools | Actions | Description |
|----------|-------|---------|-------------|
| **Core** | 4 | 50 | Spreadsheet, cells, rows, columns |
| **Formatting** | 2 | 34 | Style, rules (validation, conditional) |
| **Analysis** | 3 | 36 | Charts, formulas, filter |
| **Collaboration** | 2 | 26 | Share, files |
| **Automation** | 2 | 22 | Triggers, scripts |
| **Enterprise** | 1 | 16 | BigQuery integration |
| **Meta** | 2 | 18 | Workflow, help |
| **TOTAL** | **16** | **~202** | |

---

### 3.1 Core Tools (50 actions)

#### gw_spreadsheet (16 actions)
**Purpose:** Spreadsheet and sheet management

| Action | Description | Risk | API Method |
|--------|-------------|------|------------|
| open | Open/activate spreadsheet | 🟢 Read | spreadsheets.get |
| create | Create new spreadsheet | 🟢 Create | spreadsheets.create |
| get_metadata | Get spreadsheet info | 🟢 Read | spreadsheets.get |
| list_sheets | List all sheets | 🟢 Read | spreadsheets.get |
| add_sheet | Add new sheet | 🟢 Create | batchUpdate.addSheet |
| delete_sheet | Delete sheet | 🔴 Destructive | batchUpdate.deleteSheet |
| rename_sheet | Rename sheet | 🟡 Modify | batchUpdate.updateSheetProperties |
| duplicate_sheet | Copy sheet | 🟢 Create | batchUpdate.duplicateSheet |
| copy_to | Copy to another spreadsheet | 🟢 Create | sheets.copyTo |
| move_sheet | Reorder sheets | 🟢 Modify | batchUpdate.updateSheetProperties |
| hide_sheet | Hide sheet tab | 🟢 Modify | batchUpdate.updateSheetProperties |
| show_sheet | Show hidden sheet | 🟢 Modify | batchUpdate.updateSheetProperties |
| set_tab_color | Set sheet tab color | 🟢 Modify | batchUpdate.updateSheetProperties |
| protect_sheet | Add sheet protection | 🟡 Security | batchUpdate.addProtectedRange |
| unprotect_sheet | Remove protection | 🟡 Security | batchUpdate.deleteProtectedRange |
| get_url | Get spreadsheet URL | 🟢 Read | Local computation |

**Intelligence Requirements:**
- Elicitation: delete_sheet (confirm before deletion)
- Snapshot: delete_sheet (backup before delete)
- Undo: delete_sheet, rename_sheet

---

#### gw_cells (14 actions)
**Purpose:** Cell data operations - THE MOST USED TOOL

| Action | Description | Risk | API Method |
|--------|-------------|------|------------|
| read | Read cell range | 🟢 Read | values.get |
| write | Write to range | 🟡 Overwrite | values.update |
| append | Append rows | 🟢 Create | values.append |
| clear | Clear cell contents | 🔴 Destructive | values.clear |
| batch_read | Read multiple ranges | 🟢 Read | values.batchGet |
| batch_write | Write multiple ranges | 🟡 Overwrite | values.batchUpdate |
| batch_clear | Clear multiple ranges | 🔴 Destructive | values.batchClear |
| find | Search for values | 🟢 Read | Custom logic |
| find_replace | Find and replace | 🔴 Destructive | batchUpdate.findReplace |
| copy | Copy range | 🟢 Read | batchUpdate.copyPaste |
| cut | Cut range | 🟡 Modify | batchUpdate.cutPaste |
| fill | Auto-fill pattern | 🟡 Overwrite | batchUpdate.autoFill |
| sort | Sort range | 🟡 Modify | batchUpdate.sortRange |
| transpose | Flip rows/columns | 🟡 Modify | Custom logic |

**Intelligence Requirements:**
- Sampling: find (interpret natural language queries)
- Elicitation: find_replace (show affected count, confirm), clear (confirm)
- Streaming: batch operations (progress for large ranges)
- Snapshot: find_replace, clear, batch_clear (backup before)
- Diff Preview: find_replace (show before/after)
- Undo: All write operations

---

#### gw_rows (10 actions)
**Purpose:** Row operations

| Action | Description | Risk | API Method |
|--------|-------------|------|------------|
| insert | Insert rows | 🟢 Create | batchUpdate.insertDimension |
| delete | Delete rows | 🔴 Destructive | batchUpdate.deleteDimension |
| move | Move rows | 🟡 Modify | batchUpdate.moveDimension |
| resize | Set row height | 🟢 Modify | batchUpdate.updateDimensionProperties |
| auto_resize | Auto-fit height | 🟢 Modify | batchUpdate.autoResizeDimensions |
| hide | Hide rows | 🟢 Modify | batchUpdate.updateDimensionProperties |
| show | Show hidden rows | 🟢 Modify | batchUpdate.updateDimensionProperties |
| freeze | Freeze rows | 🟢 Modify | batchUpdate.updateSheetProperties |
| group | Group rows | 🟢 Modify | batchUpdate.addDimensionGroup |
| ungroup | Ungroup rows | 🟢 Modify | batchUpdate.deleteDimensionGroup |

**Intelligence Requirements:**
- Elicitation: delete REQUIRED (show count: "Delete 47 rows?", offer backup)
- Streaming: bulk delete (progress for large operations)
- Snapshot: delete (auto-backup before)
- Diff Preview: delete (show which rows will be removed)
- Undo: delete, move (store original state)

---

#### gw_columns (10 actions)
**Purpose:** Column operations (mirrors gw_rows)

| Action | Description | Risk | API Method |
|--------|-------------|------|------------|
| insert | Insert columns | 🟢 Create | batchUpdate.insertDimension |
| delete | Delete columns | 🔴 Destructive | batchUpdate.deleteDimension |
| move | Move columns | 🟡 Modify | batchUpdate.moveDimension |
| resize | Set column width | 🟢 Modify | batchUpdate.updateDimensionProperties |
| auto_resize | Auto-fit width | 🟢 Modify | batchUpdate.autoResizeDimensions |
| hide | Hide columns | 🟢 Modify | batchUpdate.updateDimensionProperties |
| show | Show hidden columns | 🟢 Modify | batchUpdate.updateDimensionProperties |
| freeze | Freeze columns | 🟢 Modify | batchUpdate.updateSheetProperties |
| group | Group columns | 🟢 Modify | batchUpdate.addDimensionGroup |
| ungroup | Ungroup columns | 🟢 Modify | batchUpdate.deleteDimensionGroup |

**Intelligence Requirements:** Same as gw_rows

---

### 3.2 Formatting Tools (34 actions)

#### gw_style (18 actions)
**Purpose:** Visual formatting

| Action | Description | Risk |
|--------|-------------|------|
| set_format | Apply full cell format | 🟢 Modify |
| set_background | Background color | 🟢 Modify |
| set_text_color | Text color | 🟢 Modify |
| set_font | Font family | 🟢 Modify |
| set_font_size | Font size | 🟢 Modify |
| set_bold | Bold text | 🟢 Modify |
| set_italic | Italic text | 🟢 Modify |
| set_underline | Underline text | 🟢 Modify |
| set_strikethrough | Strikethrough | 🟢 Modify |
| set_alignment | Text alignment | 🟢 Modify |
| set_wrap | Text wrapping | 🟢 Modify |
| set_borders | Cell borders | 🟢 Modify |
| set_number_format | Number format | 🟢 Modify |
| clear_format | Clear formatting | 🟡 Modify |
| copy_format | Copy formatting | 🟢 Modify |
| add_banding | Alternating colors | 🟢 Create |
| update_banding | Modify banding | 🟢 Modify |
| remove_banding | Remove banding | 🟢 Delete |

**Intelligence Requirements:**
- Sampling: Recommend colors based on data type/context
- Undo: All operations (store previous format state)

---

#### gw_rules (16 actions)
**Purpose:** Data validation and conditional formatting

| Action | Description | Risk |
|--------|-------------|------|
| add_validation | Add data validation | 🟢 Create |
| update_validation | Modify validation | 🟢 Modify |
| remove_validation | Remove validation | 🟢 Delete |
| list_validations | List all validations | 🟢 Read |
| add_dropdown | Add dropdown list | 🟢 Create |
| add_checkbox | Add checkbox | 🟢 Create |
| add_custom_validation | Custom formula validation | 🟢 Create |
| add_conditional_format | Add conditional formatting | 🟢 Create |
| update_conditional_format | Modify conditional format | 🟢 Modify |
| remove_conditional_format | Remove conditional format | 🟢 Delete |
| list_conditional_formats | List all rules | 🟢 Read |
| add_color_scale | Add color scale | 🟢 Create |
| add_data_bars | Add data bars | 🟢 Create |
| highlight_duplicates | Highlight duplicate values | 🟢 Create |
| clear_all_rules | Remove all rules | 🔴 Destructive |
| prioritize_rules | Reorder rule priority | 🟢 Modify |

**Intelligence Requirements:**
- Sampling ⭐HIGH: add_dropdown (generate options from data), add_conditional_format (generate rules from "highlight overdue items" → formula), add_color_scale (recommend colors based on data meaning)
- Elicitation: clear_all_rules REQUIRED ("This will remove 15 validation rules and 8 conditional formats")
- Diff Preview: add_conditional_format (preview affected cells)
- Dry Run: Test validation rules against existing data
- Undo: All add operations

---

### 3.3 Analysis Tools (36 actions)

#### gw_charts (14 actions)
**Purpose:** Charts and visualizations

| Action | Description | Risk |
|--------|-------------|------|
| create | Create chart | 🟢 Create |
| update | Modify chart | 🟢 Modify |
| delete | Delete chart | 🟡 Delete |
| list | List all charts | 🟢 Read |
| get | Get chart details | 🟢 Read |
| move | Reposition chart | 🟢 Modify |
| resize | Resize chart | 🟢 Modify |
| update_data_range | Change data source | 🟢 Modify |
| update_title | Change title | 🟢 Modify |
| update_legend | Modify legend | 🟢 Modify |
| export | Export as image | 🟢 Read |
| create_pivot | Create pivot table | 🟢 Create |
| update_pivot | Modify pivot | 🟢 Modify |
| delete_pivot | Delete pivot | 🟡 Delete |

**Intelligence Requirements:**
- Sampling ⭐⭐⭐CRITICAL: create (recommend chart type from data analysis - detect time series → line chart, categories → bar chart, parts of whole → pie chart), create_pivot (suggest dimensions/measures), update (suggest improvements)
- Elicitation: create (confirm chart type selection, data range, customization options), create_pivot (wizard for rows/columns/values/filters)
- Undo: All create/update/delete operations

---

#### gw_formulas (12 actions)
**Purpose:** Formula generation and management - KILLER FEATURE

| Action | Description | Risk |
|--------|-------------|------|
| generate | Generate formula from description | 🟢 Read |
| explain | Explain existing formula | 🟢 Read |
| optimize | Suggest performance improvements | 🟢 Read |
| fix | Fix formula errors | 🟢 Read |
| audit | Audit all formulas in sheet | 🟢 Read |
| find_errors | Find formula errors | 🟢 Read |
| find_circular | Find circular references | 🟢 Read |
| trace_precedents | Show formula inputs | 🟢 Read |
| trace_dependents | Show dependent cells | 🟢 Read |
| apply_formula | Apply formula to range | 🟡 Overwrite |
| add_named_range | Create named range | 🟢 Create |
| list_named_ranges | List named ranges | 🟢 Read |

**Intelligence Requirements:**
- Sampling ⭐⭐⭐CRITICAL: generate (formula from natural language "calculate compound interest" → formula), explain (natural language explanation of complex formulas), fix (analyze error, suggest correction), optimize (suggest performance improvements)
- Elicitation: apply_formula (confirm before applying to range), fix (confirm suggested fix)
- Dry Run ⭐⭐: Validate formula before apply (syntax check, test on sample data)
- Undo: apply_formula (store previous formulas), named range operations

---

#### gw_filter (10 actions)
**Purpose:** Filtering, sorting, deduplication

| Action | Description | Risk |
|--------|-------------|------|
| apply | Apply filter criteria | 🟢 Modify |
| clear | Clear filter | 🟢 Modify |
| get | Get filter settings | 🟢 Read |
| sort | Sort range | 🟡 Modify |
| create_view | Create filter view | 🟢 Create |
| update_view | Modify filter view | 🟢 Modify |
| delete_view | Delete filter view | 🟢 Delete |
| list_views | List filter views | 🟢 Read |
| find_duplicates | Find duplicate rows | 🟢 Read |
| deduplicate | Remove duplicate rows | 🔴 Destructive |

**Intelligence Requirements:**
- Sampling: apply (interpret "show only high-value deals" → analyze Value column, determine threshold), sort (determine column from context), find_duplicates (identify key columns)
- Elicitation ⭐⭐⭐CRITICAL: deduplicate REQUIRED (show count, sample duplicates, which copy to keep: first/last/most complete, offer backup)
- Streaming: find_duplicates (progress for large datasets), deduplicate (progress during removal)
- Snapshot ⭐⭐⭐REQUIRED: deduplicate (auto-backup before execution)
- Diff Preview: deduplicate (show rows that will be removed), sort (before/after order)
- Undo: deduplicate (store deleted rows), sort (store original order)

---

### 3.4 Collaboration Tools (26 actions)

#### gw_share (14 actions)
**Purpose:** Permissions and collaboration - SECURITY CRITICAL

| Action | Description | Risk |
|--------|-------------|------|
| add_permission | Grant access | 🔴 Security |
| update_permission | Modify access level | 🔴 Security |
| remove_permission | Revoke access | 🔴 Security |
| list_permissions | List who has access | 🟢 Read |
| transfer_ownership | Transfer ownership | ⚠️ IRREVERSIBLE |
| set_link_sharing | Configure link sharing | 🔴 Security |
| get_sharing_link | Get shareable link | 🟢 Read |
| add_comment | Add comment | 🟢 Create |
| reply_comment | Reply to comment | 🟢 Create |
| resolve_comment | Resolve comment | 🟢 Modify |
| delete_comment | Delete comment | 🟢 Delete |
| list_comments | List comments | 🟢 Read |
| protect_range | Protect cell range | 🟡 Security |
| unprotect_range | Remove protection | 🟡 Security |

**Intelligence Requirements:**
- Sampling: protect_range (suggest protection based on content - formulas → protect formulas only)
- Elicitation ⭐⭐⭐CRITICAL FOR SECURITY: 
  - add_permission REQUIRED especially for external users (WARNING for external email, permission level selection, notify option, expiration date)
  - transfer_ownership EXTREME confirmation ("THIS ACTION CANNOT BE UNDONE", show consequences, type "TRANSFER" to confirm)
- Undo: Most operations EXCEPT transfer_ownership (irreversible)

---

#### gw_files (12 actions)
**Purpose:** File operations via Drive API

| Action | Description | Risk |
|--------|-------------|------|
| export_pdf | Export as PDF | 🟢 Read |
| export_xlsx | Export as Excel | 🟢 Read |
| export_csv | Export as CSV | 🟢 Read |
| import_csv | Import CSV data | 🟡 Overwrite |
| import_xlsx | Import Excel file | 🟡 Overwrite |
| list_versions | List version history | 🟢 Read |
| get_version | Get specific version | 🟢 Read |
| restore_version | Restore old version | 🔴 Destructive |
| create_backup | Create named backup | 🟢 Create |
| list_backups | List backups | 🟢 Read |
| restore_backup | Restore from backup | 🔴 Destructive |
| delete_backup | Delete backup | 🟡 Delete |

**Intelligence Requirements:**
- Elicitation: import_csv/import_xlsx (confirm destination: new sheet/append/replace, column mapping), restore_version REQUIRED (show version details, changes preview)
- Streaming ⭐⭐: export/import operations (progress for large files)
- Snapshot: restore_version (auto-backup current state), import with replace (backup existing)
- Undo: restore_version (store current version ID), import (store previous state)

---

### 3.5 Automation Tools (22 actions)

#### gw_triggers (10 actions)
**Purpose:** Event-based automation

| Action | Description | Risk |
|--------|-------------|------|
| create_time | Time-based trigger | 🟡 Automation |
| create_on_edit | Edit trigger | 🟡 Automation |
| create_on_change | Change trigger | 🟡 Automation |
| create_on_open | Open trigger | 🟡 Automation |
| create_on_form | Form submit trigger | 🟡 Automation |
| list | List all triggers | 🟢 Read |
| get | Get trigger details | 🟢 Read |
| delete | Delete trigger | 🟢 Delete |
| enable | Enable trigger | 🟡 Automation |
| disable | Disable trigger | 🟢 Modify |

**Intelligence Requirements:**
- Sampling: create_time (suggest schedule from "every Monday morning" → cron)
- Elicitation: create_* (confirm trigger configuration, show what will happen), enable (confirm before enabling)
- Dry Run: Test trigger logic before enabling
- Undo: All operations (store trigger state)

---

#### gw_scripts (12 actions)
**Purpose:** Apps Script management - CODE EXECUTION

| Action | Description | Risk |
|--------|-------------|------|
| create | Create new script | 🟢 Create |
| get_content | Get script code | 🟢 Read |
| update_content | Modify script | 🟡 Modify |
| delete | Delete script | 🟡 Delete |
| run | Execute script | 🔴 Side Effects |
| run_function | Execute specific function | 🔴 Side Effects |
| list_functions | List available functions | 🟢 Read |
| deploy | Create deployment | 🔴 Security |
| undeploy | Remove deployment | 🟡 Delete |
| list_deployments | List deployments | 🟢 Read |
| get_logs | Get execution logs | 🟢 Read |
| debug | Debug script | 🟢 Read |

**Intelligence Requirements:**
- Sampling ⭐⭐⭐CRITICAL: create (generate Apps Script from description - "email me when stock drops below 10" → complete function), update (modify based on request), fix (debug errors)
- Elicitation ⭐⭐⭐CRITICAL: 
  - create (review generated code, show required permissions, Edit option)
  - run/run_function REQUIRED (show function name, potential side effects)
  - deploy REQUIRED (creating PUBLIC endpoint, access level warning)
- Streaming ⭐⭐: run (execution logs in real-time), deploy (progress)
- Dry Run: run in debug/preview mode
- Undo: create/update/delete (store code), run NOT UNDOABLE (side effects)

---

### 3.6 Enterprise Tool (16 actions)

#### gw_query (16 actions)
**Purpose:** BigQuery integration - COSTS MONEY

| Action | Description | Risk |
|--------|-------------|------|
| run_query | Execute BigQuery SQL | 🔴 Costs $ |
| preview_query | Dry run (cost estimate) | 🟢 Read |
| list_datasets | List available datasets | 🟢 Read |
| list_tables | List tables in dataset | 🟢 Read |
| get_schema | Get table schema | 🟢 Read |
| preview_table | Preview table data | 🟢 Read |
| query_to_sheet | Query results to sheet | 🟡 Overwrite |
| create_connected | Create Connected Sheet | 🟢 Create |
| refresh_connected | Refresh Connected Sheet | 🟡 Costs $ |
| schedule_refresh | Schedule auto-refresh | 🔴 Recurring $ |
| delete_connected | Delete Connected Sheet | 🟡 Delete |
| list_connected | List Connected Sheets | 🟢 Read |
| sheet_to_bigquery | Upload sheet to BQ | 🟢 Create |
| create_data_source | Add data source | 🟢 Create |
| update_data_source | Modify data source | 🟢 Modify |
| delete_data_source | Remove data source | 🟡 Delete |

**Intelligence Requirements:**
- Sampling ⭐⭐: run_query (generate SQL from natural language), create_connected (suggest refresh schedule)
- Elicitation ⭐⭐⭐CRITICAL: 
  - run_query REQUIRED (show generated SQL, estimated cost, data scanned)
  - schedule_refresh REQUIRED (show frequency, estimated monthly cost)
- Streaming ⭐⭐: run_query (progress for long queries)
- Dry Run ⭐⭐⭐CRITICAL: preview_query (estimate cost, validate SQL, sample results WITHOUT executing)
- Undo: create/update/delete operations (store config), run_query NOT UNDOABLE (costs incurred)

---

### 3.7 Meta Tools (18 actions)

#### gw_workflow (12 actions)
**Purpose:** High-level workflow automation - FLAGSHIP CAPABILITY

| Action | Description | Risk |
|--------|-------------|------|
| build_crm | Create CRM spreadsheet | 🟢 Create |
| build_dashboard | Create analytics dashboard | 🟢 Create |
| build_tracker | Create project tracker | 🟢 Create |
| build_budget | Create budget template | 🟢 Create |
| build_inventory | Create inventory system | 🟢 Create |
| build_report | Generate report | 🟢 Create |
| import_and_setup | Import + configure | 🟡 Overwrite |
| clean_data | Clean and normalize data | 🔴 Destructive |
| apply_template | Apply template to sheet | 🟡 Overwrite |
| analyze_and_recommend | Full analysis with suggestions | 🟢 Read |
| migrate_format | Convert format (dates, numbers) | 🟡 Modify |
| suggest_improvements | Suggest optimizations | 🟢 Read |

**Intelligence Requirements:**
- Sampling ⭐⭐⭐CRITICAL: All build_* (design complete workflow from requirements), clean_data (detect issues, suggest fixes), suggest_improvements (analyze spreadsheet, recommend optimizations)
- Elicitation ⭐⭐⭐CRITICAL: Multi-step wizard for all build_* (Step 1: Template, Step 2: Fields, Step 3: Options, Step 4: Dashboard, Step 5: Confirm), clean_data (confirm each operation)
- Streaming ⭐⭐⭐ESSENTIAL: All workflows provide detailed progress with checkmarks
- Snapshot ⭐⭐: clean_data (always backup), import_and_setup (backup if appending)
- Batching ⭐⭐⭐CRITICAL: All workflows heavily batch (build_crm: 50+ operations → 3-5 API calls)
- Undo: All build_* (store resource IDs for rollback), clean_data (store modified data)

---

#### gw_help (6 actions)
**Purpose:** Self-documentation and discovery

| Action | Description | Risk |
|--------|-------------|------|
| list_tools | List all available tools | 🟢 Read |
| describe_tool | Get tool documentation | 🟢 Read |
| suggest_tool | Recommend tool for task | 🟢 Read |
| list_actions | List actions for tool | 🟢 Read |
| explain_action | Explain specific action | 🟢 Read |
| search_docs | Search documentation | 🟢 Read |

**Intelligence Requirements:**
- Sampling ⭐⭐CORE PURPOSE: suggest_tool (recommend best tool for goal), explain_action (natural language explanation), search_docs (semantic search)
- Caching: All operations (static content)

---

## 4. Intelligence Layer

### 4.1 Sampling (Server → LLM)

Sampling allows the server to request help from the host LLM mid-operation.

```typescript
// Sampling implementation
interface SamplingService {
  createMessage(params: {
    messages: Message[];
    systemPrompt?: string;
    maxTokens: number;
  }): Promise<SamplingResult>;
}

// Example: Formula generation
async function generateFormula(description: string, context: SheetContext) {
  const result = await samplingService.createMessage({
    messages: [{
      role: "user",
      content: `Given spreadsheet columns: ${context.columns.join(", ")}
                Generate a Google Sheets formula for: "${description}"
                Return ONLY the formula, no explanation.`
    }],
    systemPrompt: "You are a Google Sheets expert. Generate valid formulas.",
    maxTokens: 500
  });
  return result.content;
}
```

**Sampling Use Cases:**

| Use Case | Server Samples LLM To... |
|----------|--------------------------|
| Formula generation | Write formula for natural language |
| Data analysis | Identify patterns, anomalies |
| Intent clarification | Parse ambiguous requests |
| Error recovery | Suggest fixes for failed operations |
| Optimization | Find better approaches |
| Chart recommendation | Suggest chart type for data |

---

### 4.2 Elicitation (Server → User)

Elicitation allows the server to request user input/confirmation.

```typescript
// Elicitation types
type ElicitationType = 
  | { type: "confirm"; message: string }
  | { type: "select"; message: string; options: string[] }
  | { type: "multiSelect"; message: string; options: string[] }
  | { type: "input"; message: string; schema: JSONSchema }
  | { type: "destructive"; message: string; itemCount: number; confirmWord: string };

// Example: Confirm destructive operation
async function confirmDelete(rowCount: number): Promise<boolean> {
  const result = await elicitationService.create({
    type: "destructive",
    message: `This will delete ${rowCount} rows. This cannot be undone.`,
    itemCount: rowCount,
    confirmWord: "DELETE"
  });
  return result.action === "accept";
}
```

**When to Elicit:**

| Scenario | Elicitation Type |
|----------|------------------|
| Delete > 100 rows | Confirmation |
| Ambiguous sheet reference | Selection |
| Destructive operation | Confirmation + details |
| Multiple valid interpretations | Selection |
| Missing required info | Free input |
| Sharing with external users | Confirmation |
| Costs money (BigQuery) | Confirmation |

---

### 4.3 Streaming (Progress Updates)

```typescript
// Progress streaming
interface StreamingService {
  createProgress(operationId: string): ProgressTracker;
  updateProgress(token: string, progress: number, message: string): Promise<void>;
  completeProgress(token: string, result: any): Promise<void>;
}

// Example: Workflow with progress
async function buildDashboard(request: BuildDashboardRequest) {
  const progress = streaming.createProgress("build-dashboard");
  progress.setTotalSteps(6);
  
  await progress.step("Analyzing data structure...");
  const context = await analyzeSheet(request.sourceSheet);
  
  await progress.step("Generating dashboard layout...");
  const layout = await generateLayout(context);
  
  await progress.step("Creating metrics...");
  await createMetrics(layout.metrics);
  
  await progress.step("Building charts...");
  await createCharts(layout.charts);
  
  await progress.step("Applying formatting...");
  await applyFormatting();
  
  await progress.complete({ sheetName: "Dashboard", url: "..." });
}
```

---

## 5. MCP Compliance Requirements

### 5.1 Tool Annotations (MCP 2025-11-25)

Every action MUST declare these hints:

```typescript
interface ToolAnnotations {
  title?: string;           // Human-readable title
  readOnlyHint?: boolean;   // Does NOT modify environment
  destructiveHint?: boolean; // May perform destructive updates
  idempotentHint?: boolean; // Repeated calls = no additional effect
  openWorldHint?: boolean;  // Interacts with external entities
}
```

**Annotation Guidelines:**

| Action Type | readOnly | destructive | idempotent | openWorld |
|-------------|----------|-------------|------------|-----------|
| read/get/list | ✅ true | false | ✅ true | ✅ true |
| write/update | false | false | varies | ✅ true |
| clear/delete | false | ✅ true | ✅ true | ✅ true |
| create | false | false | false | ✅ true |
| run_script | false | ⚠️ varies | ⚠️ varies | ✅ true |

---

### 5.2 Cancellation Support

Long-running operations must support cancellation:

```typescript
// Handle cancellation notification
server.onNotification("notifications/cancelled", (params) => {
  const { requestId, reason } = params;
  const operation = activeOperations.get(requestId);
  if (operation) {
    operation.abort(reason);
    activeOperations.delete(requestId);
  }
});

// Cancellable operation
async function deduplicateWithCancellation(request, abortSignal) {
  const batches = splitIntoBatches(request.rows);
  for (const batch of batches) {
    if (abortSignal.aborted) {
      return { status: "cancelled", processed: processedCount };
    }
    await processBatch(batch);
  }
  return { status: "complete" };
}
```

**Cancellable Operations:**

| Operation | Behavior on Cancel |
|-----------|-------------------|
| gw_workflow.build_* | Stop at current step, keep completed |
| gw_query.run_query | Cancel BigQuery job |
| gw_cells.find | Stop search, return partial |
| gw_filter.deduplicate | Stop after current batch |
| gw_files.import | Abort, cleanup partial |

---

### 5.3 Pagination

Cursor-based pagination for large results:

```typescript
// Pagination response
interface PaginatedResponse<T> {
  results: T[];
  nextCursor?: string;  // Opaque token, undefined = no more results
}

// Example: Paginated read
async function readRangePaginated(params: {
  spreadsheetId: string;
  range: string;
  cursor?: string;
}): Promise<PaginatedResponse<CellValue[]>> {
  const pageSize = 1000;
  const offset = params.cursor ? parseInt(atob(params.cursor)) : 0;
  
  const allData = await sheetsApi.get(params.range);
  const pageData = allData.slice(offset, offset + pageSize);
  const hasMore = offset + pageSize < allData.length;
  
  return {
    results: pageData,
    nextCursor: hasMore ? btoa(String(offset + pageSize)) : undefined
  };
}
```

---

### 5.4 Structured Logging

```typescript
enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  NOTICE = "notice",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical"
}

class MCPLogger {
  async log(level: LogLevel, message: string, data?: any) {
    await server.sendNotification("notifications/message", {
      level,
      logger: "gworkspace-mcp",
      data: { message, ...data }
    });
  }
}
```

---

## 6. Google API Mapping

### API Coverage by Tool

| Tool | Sheets API | Drive API | BigQuery | Apps Script |
|------|------------|-----------|----------|-------------|
| gw_spreadsheet | ✅ Primary | Copy/Delete | | |
| gw_cells | ✅ values.* | | | |
| gw_rows | ✅ batchUpdate | | | |
| gw_columns | ✅ batchUpdate | | | |
| gw_style | ✅ batchUpdate | | | |
| gw_rules | ✅ batchUpdate | | | |
| gw_charts | ✅ batchUpdate | | | |
| gw_formulas | ✅ batchUpdate | | | |
| gw_filter | ✅ batchUpdate | | | |
| gw_share | | ✅ permissions | | |
| gw_files | | ✅ files/revisions | | |
| gw_triggers | | | | ✅ triggers |
| gw_scripts | | | | ✅ projects |
| gw_query | | | ✅ Primary | |
| gw_workflow | ✅ All | ✅ Some | | |
| gw_help | Internal | | | |

### The Power of batchUpdate

```typescript
// Combine multiple operations into single API call
async function batchUpdate(spreadsheetId: string, requests: Request[]) {
  return await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

// Example: Format + add validation + create chart = 1 API call
const requests = [
  { repeatCell: { range, cell: { userEnteredFormat: headerFormat } } },
  { setDataValidation: { range: statusColumn, rule: dropdownRule } },
  { addChart: { chart: salesChart } }
];

await batchUpdate(spreadsheetId, requests);  // 1 call instead of 3!
```

---

## 7. Implementation Patterns

### 7.1 Server Setup

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const server = new McpServer({
  name: "gworkspace-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    tools: { listChanged: true },
    resources: { listChanged: true },
    prompts: { listChanged: true },
    logging: {}
  }
});
```

### 7.2 Tool Registration Pattern

```typescript
server.registerTool(
  "gw_cells.write_range",
  {
    title: "Write Cell Range",
    description: "Write values to a spreadsheet range",
    inputSchema: {
      spreadsheetId: z.string().describe("Spreadsheet ID or URL"),
      range: z.string().describe("A1 notation (e.g., Sheet1!A1:B10)"),
      values: z.array(z.array(z.any())).describe("2D array of values"),
      valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional()
    },
    outputSchema: {
      updatedRange: z.string(),
      updatedRows: z.number(),
      updatedCells: z.number()
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ spreadsheetId, range, values, valueInputOption = "USER_ENTERED" }) => {
    const result = await sheetsService.update(spreadsheetId, range, values, valueInputOption);
    return {
      content: [{ type: "text", text: `Updated ${result.updatedCells} cells` }],
      structuredContent: result
    };
  }
);
```

### 7.3 Resource Registration

```typescript
server.registerResource(
  "sheet-data",
  new ResourceTemplate("gworkspace://spreadsheets/{spreadsheetId}/sheets/{sheetName}", {
    list: async () => ({ resources: await listAvailableSheets() })
  }),
  {
    title: "Sheet Data",
    description: "Data from a specific sheet"
  },
  async (uri, { spreadsheetId, sheetName }) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify(await getSheetData(spreadsheetId, sheetName))
    }]
  })
);
```

### 7.4 Prompt Registration

```typescript
server.registerPrompt(
  "build-dashboard",
  {
    title: "Build Dashboard",
    description: "Create analytics dashboard from data",
    argsSchema: {
      spreadsheetId: z.string(),
      sourceSheet: z.string(),
      metrics: z.array(z.string()).optional()
    }
  },
  ({ spreadsheetId, sourceSheet, metrics }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Create a dashboard in ${spreadsheetId} from ${sourceSheet}${
          metrics ? ` including: ${metrics.join(", ")}` : ""
        }`
      }
    }]
  })
);
```

---

## 8. Safety Features

### 8.1 Snapshot Service

```typescript
interface SnapshotService {
  create(spreadsheetId: string, range?: string): Promise<SnapshotId>;
  restore(snapshotId: SnapshotId): Promise<void>;
  list(spreadsheetId: string): Promise<Snapshot[]>;
  delete(snapshotId: SnapshotId): Promise<void>;
}

// Auto-snapshot before destructive operations
async function deleteRowsWithSafety(request: DeleteRowsRequest) {
  // Create snapshot
  const snapshot = await snapshotService.create(
    request.spreadsheetId,
    request.range
  );
  
  try {
    await deleteRows(request);
  } catch (error) {
    // Auto-restore on failure
    await snapshotService.restore(snapshot);
    throw error;
  }
  
  return { success: true, snapshotId: snapshot };
}
```

### 8.2 Diff Preview

```typescript
interface DiffPreview {
  generatePreview(before: any, after: any): DiffResult;
  formatForUser(diff: DiffResult): string;
}

// Show what will change before executing
async function findReplaceWithPreview(request: FindReplaceRequest) {
  // Find all matches first
  const matches = await findMatches(request);
  
  // Generate preview
  const preview = diffService.generatePreview(
    matches.map(m => m.currentValue),
    matches.map(m => request.replacement)
  );
  
  // Show to user and get confirmation
  const confirmed = await elicitationService.confirm(
    `This will replace ${matches.length} occurrences:\n${preview.summary}`
  );
  
  if (!confirmed) return { cancelled: true };
  
  // Execute
  return await executeReplace(request);
}
```

### 8.3 Undo Tracking

```typescript
interface UndoService {
  recordOperation(operation: Operation, beforeState: any): UndoId;
  undo(undoId: UndoId): Promise<void>;
  canUndo(undoId: UndoId): boolean;
}

// Track operations for potential undo
async function writeRangeWithUndo(request: WriteRangeRequest) {
  // Capture before state
  const beforeState = await readRange(request.spreadsheetId, request.range);
  
  // Execute operation
  const result = await writeRange(request);
  
  // Record for undo
  const undoId = undoService.recordOperation(
    { type: "write_range", ...request },
    beforeState
  );
  
  return { ...result, undoId };
}
```

---

## 9. Project Structure

```
ultimate-gworkspace-mcp/
│
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 .env.example
│
├── 📁 src/
│   │
│   ├── 📄 index.ts                    # Entry point
│   ├── 📄 server.ts                   # MCP server class
│   ├── 📄 types.ts                    # Global types
│   │
│   ├── 📁 tools/                      # 16 Tool implementations
│   │   ├── 📄 index.ts                # Tool registry
│   │   │
│   │   ├── 📁 core/
│   │   │   ├── 📄 spreadsheet.ts      # gw_spreadsheet
│   │   │   ├── 📄 cells.ts            # gw_cells
│   │   │   ├── 📄 rows.ts             # gw_rows
│   │   │   └── 📄 columns.ts          # gw_columns
│   │   │
│   │   ├── 📁 formatting/
│   │   │   ├── 📄 style.ts            # gw_style
│   │   │   └── 📄 rules.ts            # gw_rules
│   │   │
│   │   ├── 📁 analysis/
│   │   │   ├── 📄 charts.ts           # gw_charts
│   │   │   ├── 📄 formulas.ts         # gw_formulas
│   │   │   └── 📄 filter.ts           # gw_filter
│   │   │
│   │   ├── 📁 collaboration/
│   │   │   ├── 📄 share.ts            # gw_share
│   │   │   └── 📄 files.ts            # gw_files
│   │   │
│   │   ├── 📁 automation/
│   │   │   ├── 📄 triggers.ts         # gw_triggers
│   │   │   └── 📄 scripts.ts          # gw_scripts
│   │   │
│   │   ├── 📁 enterprise/
│   │   │   └── 📄 query.ts            # gw_query
│   │   │
│   │   └── 📁 meta/
│   │       ├── 📄 workflow.ts         # gw_workflow
│   │       └── 📄 help.ts             # gw_help
│   │
│   ├── 📁 resources/                  # MCP Resources
│   │   ├── 📄 index.ts
│   │   ├── 📄 knowledge.ts            # Static knowledge
│   │   ├── 📄 context.ts              # Dynamic context
│   │   └── 📄 completions.ts          # Completion providers
│   │
│   ├── 📁 prompts/                    # MCP Prompts
│   │   ├── 📄 index.ts
│   │   ├── 📄 build.ts                # Build workflows
│   │   ├── 📄 data.ts                 # Data workflows
│   │   └── 📄 report.ts               # Report workflows
│   │
│   ├── 📁 intelligence/               # Intelligence layer
│   │   ├── 📄 sampling.ts             # Server→LLM
│   │   ├── 📄 elicitation.ts          # Server→User
│   │   └── 📄 streaming.ts            # Progress
│   │
│   ├── 📁 safety/                     # Safety features
│   │   ├── 📄 snapshot.ts             # Backup service
│   │   ├── 📄 diff.ts                 # Diff preview
│   │   └── 📄 undo.ts                 # Undo tracking
│   │
│   ├── 📁 execution/                  # Execution layer
│   │   ├── 📄 batch.ts                # Batch optimizer
│   │   ├── 📄 session.ts              # Session manager
│   │   ├── 📄 auth.ts                 # OAuth manager
│   │   └── 📄 errors.ts               # Error recovery
│   │
│   ├── 📁 google/                     # Google API clients
│   │   ├── 📄 sheets.ts
│   │   ├── 📄 drive.ts
│   │   ├── 📄 bigquery.ts
│   │   └── 📄 scripts.ts
│   │
│   └── 📁 utils/
│       ├── 📄 a1-notation.ts
│       ├── 📄 validation.ts
│       └── 📄 logging.ts
│
└── 📁 tests/
    ├── 📁 unit/
    ├── 📁 integration/
    └── 📁 e2e/
```

---

## 10. Implementation Phases

### Phase 0: Foundation (Week 1-2)
- [ ] Project setup with TypeScript + dependencies
- [ ] Tool annotations for all 21 tools
- [ ] Logging infrastructure (MCPLogger)
- [ ] Cancellation support framework
- [ ] OAuth2 authentication flow

### Phase 1: Core Tools (Week 3-6)
- [ ] gw_spreadsheet (16 actions)
- [ ] gw_cells (14 actions)
- [ ] gw_rows (10 actions)
- [ ] gw_columns (10 actions)
- [ ] Session manager
- [ ] Batch optimizer

### Phase 2: Intelligence Layer (Week 7-10)
- [ ] Sampling service integration
- [ ] Elicitation service
- [ ] Streaming/progress service
- [ ] gw_style (18 actions)
- [ ] gw_rules (16 actions)
- [ ] Snapshot service
- [ ] Diff preview service

### Phase 3: Full Features (Week 11-14)
- [ ] gw_charts (14 actions)
- [ ] gw_formulas (12 actions) ← Killer feature
- [ ] gw_filter (10 actions)
- [ ] gw_share (14 actions)
- [ ] gw_files (12 actions)
- [ ] gw_triggers (10 actions)
- [ ] gw_scripts (12 actions)
- [ ] gw_query (16 actions)
- [ ] gw_workflow (12 actions) ← Flagship capability
- [ ] gw_help (6 actions)

### Phase 4: Polish (Week 15-16)
- [ ] Resource system (25+ URIs)
- [ ] Prompt templates (12 workflows)
- [ ] Pagination for large results
- [ ] Completions for arguments
- [ ] listChanged notifications
- [ ] Comprehensive testing
- [ ] Documentation

---

## 11. Comparison: ServalSheets v2 vs GWorkspace MCP

| Aspect | ServalSheets v2 | GWorkspace MCP |
|--------|-----------------|----------------|
| **Status** | ✅ Implemented | 📋 Specification |
| **Tools/Handlers** | 11 handlers | 21 tools |
| **Actions** | 171 | 211 |
| **Source LOC** | 93,907 | ~15,000-20,000 (est) |
| **Test LOC** | 40,693 | TBD |
| **Test Files** | 106 | TBD |
| **MCP Version** | 2025-11-25 | 2025-11-25 |
| **Scope** | Sheets-focused | Full Workspace |
| **BigQuery** | ❌ | ✅ gw_query |
| **Apps Script** | ❌ | ✅ gw_scripts, gw_triggers |
| **Workflows** | Basic | ✅ gw_workflow (flagship) |
| **AI Analysis** | ✅ Built-in | ✅ Via sampling |
| **Transaction Support** | ✅ | ✅ |
| **OAuth2** | ✅ | ✅ |
| **HTTP + stdio** | ✅ | ✅ |

### Key Differences

1. **ServalSheets v2** is production-ready with extensive testing
2. **GWorkspace MCP** is a comprehensive specification covering full Workspace
3. GWorkspace adds BigQuery, Apps Script, advanced workflows
4. ServalSheets has more mature error handling and safety features
5. GWorkspace specification includes more detailed intelligence layer requirements

---

## References

| Resource | URL |
|----------|-----|
| MCP Specification | https://modelcontextprotocol.io/specification/2025-11-25 |
| MCP TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk |
| Google Sheets API | https://developers.google.com/sheets/api |
| Google Drive API | https://developers.google.com/drive/api |
| Google Apps Script API | https://developers.google.com/apps-script/api |
| BigQuery API | https://cloud.google.com/bigquery/docs/reference/rest |

---

*This document consolidates all canonical project documentation (Docs 11, 14, 15, 17, 18, 19, 20, 22) into a single implementation reference.*
