---
title: "GWorkspace MCP: Complete 16-Tool Architecture Reference"
category: archived
last_updated: 2026-01-31
description: "Source Documentation: /mnt/project/15-complete-architecture-map.md, /mnt/project/18-tool-intelligence-mapping.md"
tags: [sheets]
---

# GWorkspace MCP: Complete 16-Tool Architecture Reference

## Executive Summary

**Source Documentation:** `/mnt/project/15-complete-architecture-map.md`, `/mnt/project/18-tool-intelligence-mapping.md`  
**Target Specification:** 21 tools, 211 actions (192 base + 19 MCP features)  
**MCP Version:** 2025-11-25  

---

## Complete Tool Inventory

### Category 1: CORE DATA (4 tools, 50 actions)

#### Tool 1: gw_spreadsheet (16 actions)

**Purpose:** Open, create, and manage spreadsheets and sheets

| Action | Risk | Description |
|--------|------|-------------|
| open | 🟢 | Open spreadsheet by ID |
| open_by_name | 🟢 | Open by name (fuzzy match) |
| create | 🟡 | Create new spreadsheet |
| copy | 🟡 | Duplicate spreadsheet |
| rename | 🟡 | Rename spreadsheet |
| get_info | 🟢 | Get metadata |
| list_sheets | 🟢 | List all sheets |
| add_sheet | 🟡 | Add new sheet |
| delete_sheet | 🔴 | **DESTRUCTIVE** - Delete sheet |
| rename_sheet | 🟡 | Rename sheet |
| copy_sheet | 🟡 | Duplicate sheet |
| move_sheet | 🟡 | Change sheet position |
| hide_sheet | 🟡 | Hide sheet tab |
| show_sheet | 🟡 | Show hidden sheet |
| get_properties | 🟢 | Get spreadsheet properties |
| set_properties | 🟡 | Update properties |

**Intelligence:** Sampling (name suggestions), Elicitation (delete confirmation), Snapshot (delete backup)

---

#### Tool 2: gw_cells (14 actions)

**Purpose:** Read, write, find, replace cell data

| Action | Risk | Description |
|--------|------|-------------|
| read | 🟢 | Read single cell |
| read_range | 🟢 | Read range of cells |
| write | 🟡 | Write single cell |
| write_range | 🟡 | Write range of cells |
| append | 🟡 | Append rows |
| clear | 🔴 | **DESTRUCTIVE** - Clear cell |
| clear_range | 🔴 | **DESTRUCTIVE** - Clear range |
| find | 🟢 | Search for values |
| find_replace | 🔴 | **DESTRUCTIVE** - Bulk replace |
| get_note | 🟢 | Get cell note |
| set_note | 🟡 | Set cell note |
| get_hyperlink | 🟢 | Get cell hyperlink |
| set_hyperlink | 🟡 | Set cell hyperlink |
| copy_to | 🟡 | Copy cells to destination |

**Intelligence:** Sampling (content generation), Elicitation (overwrite/replace confirmation), Streaming (large reads), Snapshot (backup), Diff Preview

---

#### Tool 3: gw_rows (10 actions)

**Purpose:** Insert, delete, move, hide, resize rows

| Action | Risk | Description |
|--------|------|-------------|
| insert | 🟡 | Insert rows at end |
| insert_at | 🟡 | Insert rows at position |
| delete | 🔴 | **DESTRUCTIVE** - Delete rows |
| delete_range | 🔴 | **DESTRUCTIVE** - Delete row range |
| move | 🟡 | Move rows |
| hide | 🟡 | Hide rows |
| show | 🟡 | Show hidden rows |
| resize | 🟡 | Set row height |
| auto_resize | 🟡 | Auto-fit row height |
| group | 🟡 | Group rows |

**Intelligence:** Elicitation (delete confirmation), Snapshot (REQUIRED for delete), Undo Tracking

---

#### Tool 4: gw_columns (10 actions)

**Purpose:** Insert, delete, move, hide, resize columns

| Action | Risk | Description |
|--------|------|-------------|
| insert | 🟡 | Insert columns at end |
| insert_at | 🟡 | Insert columns at position |
| delete | 🔴 | **DESTRUCTIVE** - Delete columns |
| delete_range | 🔴 | **DESTRUCTIVE** - Delete column range |
| move | 🟡 | Move columns |
| hide | 🟡 | Hide columns |
| show | 🟡 | Show hidden columns |
| resize | 🟡 | Set column width |
| auto_resize | 🟡 | Auto-fit column width |
| group | 🟡 | Group columns |

**Intelligence:** Same as gw_rows - Elicitation, Snapshot, Undo Tracking

---

### Category 2: FORMATTING (2 tools, 34 actions)

#### Tool 5: gw_style (18 actions)

**Purpose:** Fonts, colors, borders, alignment

| Action | Risk | Description |
|--------|------|-------------|
| set_font | 🟡 | Set font family |
| set_font_size | 🟡 | Set font size |
| set_bold | 🟡 | Set bold |
| set_italic | 🟡 | Set italic |
| set_underline | 🟡 | Set underline |
| set_strikethrough | 🟡 | Set strikethrough |
| set_text_color | 🟡 | Set text color |
| set_background | 🟡 | Set background color |
| set_alignment | 🟡 | Set horizontal alignment |
| set_vertical_alignment | 🟡 | Set vertical alignment |
| set_wrap | 🟡 | Set text wrap |
| set_border | 🟡 | Set single border |
| set_borders | 🟡 | Set multiple borders |
| merge_cells | 🟡 | Merge cells (can lose data) |
| unmerge_cells | 🟡 | Unmerge cells |
| set_number_format | 🟡 | Set number format |
| apply_theme | 🟡 | Apply color theme |
| copy_formatting | 🟡 | Copy format painter |

**Intelligence:** Sampling (theme/format recommendations), Elicitation (merge warning), Diff Preview, Batching (high value)

---

#### Tool 6: gw_rules (16 actions)

**Purpose:** Data validation, dropdowns, conditional formatting

| Action | Risk | Description |
|--------|------|-------------|
| add_dropdown | 🟢 | Add dropdown list |
| add_checkbox | 🟢 | Add checkbox |
| add_date_validation | 🟢 | Add date validation |
| add_number_validation | 🟢 | Add number validation |
| add_text_validation | 🟢 | Add text validation |
| add_custom_validation | 🟢 | Add custom formula validation |
| get_validation | 🟢 | Get validation rules |
| remove_validation | 🟡 | Remove validation |
| add_conditional_format | 🟢 | Add conditional format |
| add_color_scale | 🟢 | Add color scale |
| add_data_bar | 🟢 | Add data bar |
| add_icon_set | 🟢 | Add icon set |
| get_conditional_formats | 🟢 | Get conditional formats |
| remove_conditional_format | 🟡 | Remove conditional format |
| clear_all_rules | 🔴 | **DESTRUCTIVE** - Clear all |
| copy_rules | 🟡 | Copy rules to range |

**Intelligence:** Sampling ⭐HIGH (generate rules from description), Elicitation (confirm options), Diff Preview, Dry Run

---

### Category 3: ANALYSIS (3 tools, 36 actions)

#### Tool 7: gw_charts (14 actions)

**Purpose:** All chart types, pivots, slicers

| Action | Risk | Description |
|--------|------|-------------|
| create | 🟡 | Create chart |
| create_bar | 🟡 | Create bar chart |
| create_line | 🟡 | Create line chart |
| create_pie | 🟡 | Create pie chart |
| create_scatter | 🟡 | Create scatter plot |
| create_area | 🟡 | Create area chart |
| create_combo | 🟡 | Create combo chart |
| update | 🟡 | Update chart |
| delete | 🟡 | Delete chart |
| list | 🟢 | List charts |
| get | 🟢 | Get chart details |
| create_pivot | 🟡 | Create pivot table |
| update_pivot | 🟡 | Update pivot table |
| add_slicer | 🟡 | Add slicer control |

**Intelligence:** Sampling ⭐⭐⭐CRITICAL (recommend chart type), Elicitation (chart options), Undo Tracking

---

#### Tool 8: gw_formulas (12 actions)

**Purpose:** Generate, explain, audit, named ranges

| Action | Risk | Description |
|--------|------|-------------|
| generate | 🟡 | Generate formula from description |
| explain | 🟢 | Explain formula |
| audit | 🟢 | Audit formulas in range |
| fix | 🟡 | Fix formula errors |
| optimize | 🟡 | Optimize formula performance |
| create_named_range | 🟡 | Create named range |
| update_named_range | 🟡 | Update named range |
| delete_named_range | 🟡 | Delete named range |
| list_named_ranges | 🟢 | List all named ranges |
| get_dependencies | 🟢 | Get formula dependencies |
| get_dependents | 🟢 | Get formula dependents |
| apply_formula | 🟡 | Apply formula to range |

**Intelligence:** Sampling ⭐⭐⭐CRITICAL (formula generation), Elicitation (confirm formula), Dry Run ⭐⭐(validate before apply)

---

#### Tool 9: gw_filter (10 actions)

**Purpose:** Filter, sort, views, deduplication

| Action | Risk | Description |
|--------|------|-------------|
| apply | 🟡 | Apply filter |
| clear | 🟡 | Clear filter |
| sort | 🟡 | Sort by column |
| sort_range | 🟡 | Sort specific range |
| find_duplicates | 🟢 | Find duplicate rows |
| deduplicate | 🔴 | **DESTRUCTIVE** - Remove duplicates |
| create_view | 🟡 | Create filter view |
| update_view | 🟡 | Update filter view |
| delete_view | 🟡 | Delete filter view |
| get_views | 🟢 | List filter views |

**Intelligence:** Sampling (interpret filter criteria), Elicitation ⭐⭐⭐CRITICAL (deduplicate confirmation), Streaming, Snapshot ⭐⭐⭐REQUIRED, Diff Preview

---

### Category 4: COLLABORATION (2 tools, 26 actions)

#### Tool 10: gw_share (14 actions)

**Purpose:** Permissions, comments, protection

| Action | Risk | Description |
|--------|------|-------------|
| get_permissions | 🟢 | Get current permissions |
| add_permission | 🟠 | **SECURITY** - Add permission |
| update_permission | 🟠 | **SECURITY** - Update permission |
| remove_permission | 🟡 | Remove permission |
| transfer_ownership | 🔴 | **IRREVERSIBLE** - Transfer owner |
| add_comment | 🟢 | Add comment |
| get_comments | 🟢 | Get comments |
| reply_to_comment | 🟢 | Reply to comment |
| resolve_comment | 🟡 | Resolve comment |
| delete_comment | 🟡 | Delete comment |
| protect_range | 🟡 | Protect range |
| protect_sheet | 🟡 | Protect sheet |
| get_protections | 🟢 | List protections |
| remove_protection | 🟡 | Remove protection |

**Intelligence:** Elicitation ⭐⭐⭐CRITICAL FOR SECURITY (permission confirmation, especially external users)

---

#### Tool 11: gw_files (12 actions)

**Purpose:** Export, import, versions, backup

| Action | Risk | Description |
|--------|------|-------------|
| export_pdf | 🟢 | Export as PDF |
| export_xlsx | 🟢 | Export as Excel |
| export_csv | 🟢 | Export as CSV |
| export_json | 🟢 | Export as JSON |
| import_csv | 🟡 | Import CSV |
| import_xlsx | 🟡 | Import Excel |
| get_versions | 🟢 | List version history |
| restore_version | 🔴 | **DESTRUCTIVE** - Restore version |
| create_backup | 🟢 | Create manual backup |
| download_backup | 🟢 | Download backup |
| list_backups | 🟢 | List backups |
| delete_backup | 🟡 | Delete backup |

**Intelligence:** Elicitation (import/restore confirmation), Streaming ⭐⭐(progress for large files), Snapshot

---

### Category 5: AUTOMATION (2 tools, 22 actions)

#### Tool 12: gw_triggers (10 actions)

**Purpose:** Time, edit, change, form triggers

| Action | Risk | Description |
|--------|------|-------------|
| create_time | 🟡 | Create time-based trigger |
| create_on_edit | 🟡 | Create on-edit trigger |
| create_on_change | 🟡 | Create on-change trigger |
| create_on_form_submit | 🟡 | Create form submit trigger |
| list | 🟢 | List triggers |
| get | 🟢 | Get trigger details |
| enable | 🟡 | Enable trigger |
| disable | 🟡 | Disable trigger |
| delete | 🟡 | Delete trigger |
| get_logs | 🟢 | Get trigger execution logs |

**Intelligence:** Sampling (suggest trigger config), Elicitation (confirm trigger setup), Dry Run (test trigger)

---

#### Tool 13: gw_scripts (12 actions)

**Purpose:** Create, run, manage Apps Scripts

| Action | Risk | Description |
|--------|------|-------------|
| create | 🟡 | Create new script |
| update | 🟡 | Update script code |
| get | 🟢 | Get script content |
| list | 🟢 | List scripts |
| delete | 🟡 | Delete script |
| run | 🟠 | **SIDE EFFECTS** - Run script |
| run_function | 🟠 | **SIDE EFFECTS** - Run function |
| get_logs | 🟢 | Get execution logs |
| deploy | 🟠 | **SECURITY** - Deploy as web app |
| undeploy | 🟡 | Undeploy web app |
| get_deployments | 🟢 | List deployments |
| fix | 🟡 | Debug and fix errors |

**Intelligence:** Sampling ⭐⭐⭐CRITICAL (code generation), Elicitation ⭐⭐⭐(run/deploy confirmation), Streaming (execution logs), Dry Run

---

### Category 6: ENTERPRISE (1 tool, 16 actions)

#### Tool 14: gw_query (16 actions)

**Purpose:** BigQuery queries, Connected Sheets, data connections

| Action | Risk | Description |
|--------|------|-------------|
| run_query | 🟠 | **COSTS MONEY** - Run BigQuery |
| get_query_results | 🟢 | Get query results |
| create_connected_sheet | 🟡 | Create Connected Sheet |
| update_connected_sheet | 🟡 | Update Connected Sheet |
| refresh_connected_sheet | 🟡 | Refresh data |
| get_connected_sheets | 🟢 | List Connected Sheets |
| delete_connected_sheet | 🟡 | Delete Connected Sheet |
| list_connections | 🟢 | List data connections |
| refresh_connection | 🟡 | Refresh connection |
| delete_connection | 🟡 | Delete connection |
| schedule_refresh | 🟠 | **RECURRING COST** - Schedule refresh |
| get_refresh_schedule | 🟢 | Get schedule |
| extract_to_sheet | 🟡 | Extract results to sheet |
| create_data_source | 🟡 | Create data source |
| list_data_sources | 🟢 | List data sources |
| preview_query | 🟢 | Preview query (dry run) |

**Intelligence:** Sampling ⭐⭐(SQL generation), Elicitation ⭐⭐⭐(cost confirmation), Streaming, Dry Run ⭐⭐⭐(cost preview)

---

### Category 7: META (2 tools, 18 actions)

#### Tool 15: gw_workflow (12 actions)

**Purpose:** CRM, dashboard, report workflows

| Action | Risk | Description |
|--------|------|-------------|
| build_crm | 🟡 | Build CRM spreadsheet |
| build_dashboard | 🟡 | Build dashboard |
| build_tracker | 🟡 | Build project tracker |
| build_budget | 🟡 | Build budget spreadsheet |
| build_inventory | 🟡 | Build inventory system |
| build_report | 🟡 | Build report template |
| clean_data | 🟡 | Clean/normalize data |
| import_and_setup | 🟡 | Import and configure |
| apply_template | 🟡 | Apply template to data |
| generate_summary | 🟢 | Generate data summary |
| suggest_improvements | 🟢 | Suggest optimizations |
| get_templates | 🟢 | List available templates |

**Intelligence:** Sampling ⭐⭐⭐CRITICAL (workflow design), Elicitation ⭐⭐⭐(multi-step wizard), Streaming ⭐⭐⭐(progress), Snapshot, Batching

---

#### Tool 16: gw_help (6 actions)

**Purpose:** Self-documentation and suggestions

| Action | Risk | Description |
|--------|------|-------------|
| suggest_tool | 🟢 | Recommend tool for task |
| explain_action | 🟢 | Explain action usage |
| show_examples | 🟢 | Show usage examples |
| get_capabilities | 🟢 | List all capabilities |
| get_limitations | 🟢 | List limitations |
| search_docs | 🟢 | Search documentation |

**Intelligence:** Sampling ⭐⭐(semantic understanding), Caching (static content)

---

## Action Count Summary

| Category | Tools | Actions |
|----------|-------|---------|
| Core Data | 4 | 50 |
| Formatting | 2 | 34 |
| Analysis | 3 | 36 |
| Collaboration | 2 | 26 |
| Automation | 2 | 22 |
| Enterprise | 1 | 16 |
| Meta | 2 | 18 |
| **TOTAL** | **16** | **202** |

*Note: 202 base actions + 9 additional MCP feature actions = 211 total per specification*

---

## Intelligence Feature Matrix Summary

| Tool | Sampling | Elicitation | Streaming | Snapshot | Dry Run |
|------|----------|-------------|-----------|----------|---------|
| gw_spreadsheet | ○ | ● | - | ● | - |
| gw_cells | ● | ●● | ● | ●● | - |
| gw_rows | ○ | ●● | ○ | ●●● | - |
| gw_columns | ○ | ●● | ○ | ●●● | - |
| gw_style | ● | ○ | ○ | - | - |
| gw_rules | ●● | ● | - | - | ● |
| gw_charts | ●●● | ●● | ○ | - | - |
| gw_formulas | ●●● | ●● | ○ | - | ●● |
| gw_filter | ● | ●●● | ● | ●●● | - |
| gw_share | ○ | ●●● | ○ | - | - |
| gw_files | ○ | ●● | ●● | ●● | - |
| gw_triggers | ● | ●● | - | - | ● |
| gw_scripts | ●●● | ●●● | ●● | - | ● |
| gw_query | ●● | ●●● | ●● | - | ●●● |
| gw_workflow | ●●● | ●●● | ●●● | ●● | - |
| gw_help | ●● | - | - | - | - |

**Legend:** ●●● Critical | ●● Important | ● Useful | ○ Optional | - Not Applicable

---

## Comparison: ServalSheets v2 vs GWorkspace MCP

| Aspect | ServalSheets v2 | GWorkspace MCP |
|--------|-----------------|----------------|
| Total Handlers/Tools | 11 | 16 |
| Total Actions | 171 | 211 |
| Avg Actions/Tool | 15.5 | 13.2 |
| **Scope** | Sheets-focused | Full Workspace |
| **Status** | Implemented | Specification |

### Exclusive to GWorkspace MCP

- **gw_query** (16 actions) - BigQuery integration
- **gw_triggers** (10 actions) - Trigger management
- **gw_scripts** (12 actions) - Apps Script automation
- **gw_workflow** (12 actions) - Multi-step workflows
- **gw_help** (6 actions) - Self-documentation

### Structural Differences

- ServalSheets: Combined structure handler for rows/columns
- GWorkspace: Separate gw_rows and gw_columns tools

---

## Architecture Layers

### Layer 1: Capability Layer

- **16 Tools** with 211 actions
- **25+ Resources** (static knowledge + dynamic context)
- **12 Prompts** (workflow templates)
- **4 Completion Providers** (dynamic autocomplete)

### Layer 2: Intelligence Layer

- **Sampling Service** - Server→LLM for generation/analysis
- **Elicitation Service** - Server→User for confirmation/selection
- **Streaming Service** - Real-time progress
- **Intent Detection** - 13 intent categories

### Layer 3: Execution Layer

- **Batch Optimizer** - Combine operations (80-95% API reduction)
- **Session Manager** - Context, history, cache
- **Auth Manager** - OAuth 2.0 with PKCE
- **Error Recovery** - Auto-retry, sampling for fixes

### Layer 4: Google APIs

- Google Sheets API v4
- Google Drive API v3
- Google Apps Script API
- Google BigQuery API

---

## Implementation Priority

### Phase 1: Core Foundation (Weeks 1-4)

- MCP server skeleton + Auth Manager
- gw_spreadsheet, gw_cells, gw_style
- Session Manager + Batch Optimizer

### Phase 2: Intelligence (Weeks 5-8)

- Sampling Service + Elicitation Service
- Streaming progress
- gw_rows, gw_columns, gw_rules

### Phase 3: Full Features (Weeks 9-12)

- All remaining tools
- Resource system + Prompt templates
- Workflow engine + Error recovery

### Phase 4: Polish (Weeks 13-16)

- Completion providers
- Advanced intent detection
- Documentation + Testing

---

## Gap Analysis: Missing MCP Features (from Doc 19)

### Critical Additions Required

#### 1. Tool Annotations (MCP 2025-11-25)

Every action must declare these standard hints:

```typescript
interface ToolAnnotations {
  title?: string;           // Human-readable title for UI
  readOnlyHint?: boolean;   // Does NOT modify environment
  destructiveHint?: boolean; // May perform destructive updates
  idempotentHint?: boolean; // Repeated calls = no additional effect
  openWorldHint?: boolean;  // Interacts with external entities
}
```

**Annotation Examples by Action Type:**

| Action Type | readOnly | destructive | idempotent | openWorld |
|-------------|----------|-------------|------------|-----------|
| read/get/list | ✅ true | false | ✅ true | ✅ true |
| write/update | false | false | varies | ✅ true |
| clear/delete | false | ✅ true | ✅ true | ✅ true |
| create | false | false | false | ✅ true |
| run_script | false | ⚠️ varies | ⚠️ varies | ✅ true |

#### 2. Cancellation Support

Long-running operations must support cancellation:

| Operation | Cancellable | Behavior on Cancel |
|-----------|-------------|-------------------|
| gw_workflow.build_* | ✅ YES | Stop at current step, keep completed |
| gw_query.run_query | ✅ YES | Cancel BigQuery job |
| gw_cells.find | ✅ YES | Stop search, return partial |
| gw_filter.deduplicate | ✅ YES | Stop after current batch |
| gw_files.import | ✅ YES | Abort, cleanup partial |
| gw_scripts.run | ⚠️ Maybe | May not support mid-execution |

#### 3. Pagination

Cursor-based pagination for list operations:

```typescript
// Response with pagination
{
  "result": {
    "resources": [...],
    "nextCursor": "eyJwYWdlIjogM30="  // Opaque token
  }
}
```

Operations requiring pagination:

- `gw_cells.read_range` (>10K cells)
- `gw_spreadsheet.list_sheets` (>100 sheets)
- `gw_filter.deduplicate` results
- `gw_query.run_query` results

#### 4. Structured Logging

```typescript
enum LogLevel {
  DEBUG = "debug",
  INFO = "info", 
  NOTICE = "notice",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical"
}
```

---

## Implementation Reference Patterns (from Doc 20)

### Server Setup Pattern

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

### Tool Registration Pattern

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
      openWorldHint: false
    }
  },
  async ({ spreadsheetId, range, values, valueInputOption = "USER_ENTERED" }) => {
    const result = await sheetsService.update(spreadsheetId, range, values);
    return {
      content: [{ type: "text", text: `Updated ${result.updatedCells} cells` }],
      structuredContent: result
    };
  }
);
```

### Resource Registration Pattern

```typescript
// Dynamic resource with template
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

### Google Sheets API Batch Pattern

```typescript
// Batch multiple operations into single API call
async function batchUpdate(spreadsheetId: string, requests: Request[]) {
  return await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

// Example: Multiple formatting operations
const requests = [
  { updateCells: { range, fields: "userEnteredFormat.textFormat.bold", rows } },
  { updateCells: { range, fields: "userEnteredFormat.backgroundColor", rows } },
  { updateBorders: { range, border } }
];

await batchUpdate(spreadsheetId, requests); // 1 API call instead of 3
```

---

## Best Practices Summary

### MCP Best Practices

| Practice | Rationale |
|----------|-----------|
| Use Zod schemas | Type safety + validation |
| Add tool annotations | Client safety classification |
| Implement cancellation | User can stop long ops |
| Use structured logging | Debugging + monitoring |
| Stream progress | UX for long operations |
| Elicit for destructive | Prevent accidents |
| Sample for intelligence | LLM-assisted generation |

### Google Sheets API Best Practices

| Practice | Rationale |
|----------|-----------|
| Batch operations | Atomicity + efficiency |
| Use USER_ENTERED | Parse formulas/dates |
| Request only needed fields | Reduce payload |
| Handle quota errors (429) | Exponential backoff |
| Cache spreadsheet metadata | Avoid repeated calls |
| Use named ranges | Stable references |

---

## Updated Feature Matrix (Extended)

```
TOOL            │ ANNOT │ SAMPLE │ ELICIT │ STREAM │ CANCEL │ LOG │ SNAP │ PAGE
────────────────┼───────┼────────┼────────┼────────┼────────┼─────┼──────┼──────
gw_spreadsheet  │  ●●●  │   ○    │   ●    │        │        │  ●  │  ●   │  
gw_cells        │  ●●●  │   ●    │  ●●    │   ●    │   ●    │  ●  │ ●●   │  ●
gw_rows         │  ●●●  │   ○    │  ●●    │   ○    │   ●    │  ●  │●●●   │  
gw_columns      │  ●●●  │   ○    │  ●●    │   ○    │   ●    │  ●  │●●●   │  
gw_style        │  ●●●  │   ●    │   ○    │   ○    │        │  ●  │      │  
gw_rules        │  ●●●  │  ●●    │   ●    │        │        │  ●  │      │  
gw_charts       │  ●●●  │ ●●●    │  ●●    │   ○    │        │  ●  │      │  
gw_formulas     │  ●●●  │ ●●●    │  ●●    │   ○    │        │  ●  │      │  
gw_filter       │  ●●●  │   ●    │ ●●●    │   ●    │   ●    │  ●  │●●●   │  ●
gw_share        │  ●●●  │   ○    │ ●●●    │   ○    │        │ ●●  │      │  
gw_files        │  ●●●  │   ○    │  ●●    │  ●●    │   ●    │  ●  │ ●●   │  
gw_triggers     │  ●●●  │   ●    │  ●●    │        │        │  ●  │      │  
gw_scripts      │  ●●●  │ ●●●    │ ●●●    │  ●●    │   ○    │ ●●  │      │  
gw_query        │  ●●●  │  ●●    │ ●●●    │  ●●    │  ●●    │ ●●  │      │  ●
gw_workflow     │  ●●●  │ ●●●    │ ●●●    │ ●●●    │  ●●    │ ●●  │ ●●   │  
gw_help         │  ●●●  │  ●●    │        │        │        │     │      │  

Legend: ●●● Critical | ●● Important | ● Useful | ○ Optional | (blank) N/A
NEW: ANNOT = Annotations (all tools), CANCEL = Cancellation, LOG = Logging, PAGE = Pagination
```

---

## Proposed New Tool: gw_history (from Gap Analysis)

**Purpose:** Version history and revision management via Drive API

| Action | Description | Risk |
|--------|-------------|------|
| list | List all revisions | 🟢 Read |
| get | Get revision details | 🟢 Read |
| restore | Restore to revision | 🔴 Destructive |
| name_current | Bookmark current version | 🟢 Metadata |
| compare | Compare two revisions | 🟢 Read |
| export_revision | Download old version | 🟢 Read |

*Note: This would bring total to 17 tools if implemented*

---

## Package Versions (Recommended)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.22.0",
    "googleapis": "^140.0.0",
    "google-auth-library": "^9.0.0",
    "zod": "^3.25.0",
    "express": "^4.18.0"
  }
}
```

---

## Official Documentation References

| Resource | URL |
|----------|-----|
| MCP Specification | https://modelcontextprotocol.io/specification/2025-11-25 |
| MCP TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk |
| Google Sheets API | https://developers.google.com/sheets/api |
| Google Node.js Samples | https://github.com/googleworkspace/node-samples |
| Sheets batchUpdate | https://developers.google.com/sheets/api/guides/batchupdate |

---

*Document generated from canonical project documentation*
*Sources: Doc 15 (complete-architecture-map), Doc 18 (tool-intelligence-mapping), Doc 19 (gap-analysis), Doc 20 (reference-code)*
