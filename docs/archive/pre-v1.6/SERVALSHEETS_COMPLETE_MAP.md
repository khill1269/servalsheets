# ServalSheets Complete Architecture Map

> **Version**: 1.6.0 | **MCP Protocol**: 2025-11-25 | **Last Updated**: 2026-02-01

This document provides a comprehensive map of every component in the ServalSheets MCP server.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tools & Schemas](#tools--schemas-21-tools-291-actions)
3. [Resources](#resources-23-resource-files-50-uris)
4. [Prompts](#prompts-20-guided-workflows)
5. [Knowledge Base](#knowledge-base-38-files)
6. [Documentation](#documentation-241-files)
7. [Improvement Roadmap](#improvement-roadmap)

---

## Executive Summary

| Component | Count | Description |
|-----------|-------|-------------|
| **Tools** | 21 | MCP tools with Zod schemas |
| **Actions** | 291 | Individual tool actions |
| **Resources** | 50+ | MCP resources (data, knowledge, observability) |
| **Prompts** | 20 | Guided workflow templates |
| **Knowledge Files** | 38 | Embedded AI knowledge base |
| **Documentation** | 241 | Markdown docs, guides, references |
| **Tests** | 1,400+ | Unit, integration, contract tests |

---

## Tools & Schemas (21 Tools, 291 Actions)

### Tool Registry Overview (Source: `npm run check:drift`)

| Tool | Actions | Category | MCP Features |
|------|---------|----------|--------------|
| `sheets_collaborate` | 35 | Collaboration | Sharing, comments, versions, approvals |
| `sheets_dimensions` | 28 | Structure | Rows, columns, filters, slicers |
| `sheets_advanced` | 26 | Advanced | Named ranges, protection, chips, tables |
| `sheets_session` | 26 | Context | NL references, checkpoints, alerts |
| `sheets_format` | 21 | Formatting | Styles, validation, sparklines |
| `sheets_data` | 18 | Data | Read/write/batch, notes, merges |
| `sheets_visualize` | 18 | Visualization | Charts, pivots, trendlines |
| `sheets_core` | 17 | Core | CRUD operations |
| `sheets_analyze` | 16 | MCP-Native | Sampling (SEP-1577), AI analysis |
| `sheets_appsscript` | 14 | Enterprise | Script automation |
| `sheets_bigquery` | 14 | Enterprise | Connected Sheets |
| `sheets_composite` | 10 | High-Level | CSV, dedupe, clone |
| `sheets_templates` | 8 | Enterprise | Template library |
| `sheets_dependencies` | 7 | Enterprise | Formula analysis |
| `sheets_history` | 7 | Enterprise | Undo/redo, audit |
| `sheets_webhook` | 6 | Enterprise | Change notifications |
| `sheets_transaction` | 6 | Enterprise | Atomic operations |
| `sheets_confirm` | 5 | MCP-Native | Elicitation (SEP-1036) |
| `sheets_auth` | 4 | Core | OAuth 2.0 flow |
| `sheets_quality` | 4 | Enterprise | Validation, conflicts |
| `sheets_fix` | 1 | Automation | Auto-fix issues |
| **TOTAL** | **291** | | |

### Detailed Tool Actions

#### 1. `sheets_auth` (4 actions)

```
status      - Check authentication status (ALWAYS call first)
login       - Get OAuth URL for user login
callback    - Complete OAuth with authorization code
logout      - Clear stored credentials
```

#### 2. `sheets_core` (17 actions)

```
get                 - Get spreadsheet metadata
create              - Create new spreadsheet
copy                - Copy spreadsheet
update_properties   - Update title, locale, timezone
get_url             - Get spreadsheet URL
batch_get           - Batch get multiple spreadsheets
get_comprehensive   - Full metadata with sheets
list                - List user's spreadsheets
add_sheet           - Add new sheet
delete_sheet        - Delete sheet
duplicate_sheet     - Duplicate sheet
update_sheet        - Update sheet properties
copy_sheet_to       - Copy sheet to another spreadsheet
list_sheets         - List all sheets
get_sheet           - Get sheet metadata
batch_delete_sheets - Delete multiple sheets
batch_update_sheets - Update multiple sheets
```

#### 3. `sheets_data` (19 actions)

```
read          - Read cell values
write         - Write cell values
append        - Append rows
clear         - Clear range
batch_read    - Read multiple ranges (1 API call)
batch_write   - Write multiple ranges (1 API call)
batch_clear   - Clear multiple ranges
find_replace  - Find and replace text
add_note      - Add cell note
get_note      - Get cell note
clear_note    - Clear cell note
set_hyperlink - Set cell hyperlink
clear_hyperlink - Clear hyperlink
merge_cells   - Merge cells
unmerge_cells - Unmerge cells
get_merges    - Get merged regions
cut_paste     - Cut and paste
copy_paste    - Copy and paste
```

#### 4. `sheets_format` (18 actions)

```
set_format                   - Set cell format
suggest_format               - AI-suggested format
set_background               - Set background color
set_text_format              - Set text style
set_number_format            - Set number format
set_alignment                - Set alignment
set_borders                  - Set borders
clear_format                 - Clear formatting
apply_preset                 - Apply preset (header, total)
auto_fit                     - Auto-fit columns
sparkline_add                - Add sparkline
sparkline_get                - Get sparkline
sparkline_clear              - Clear sparkline
rule_add_conditional_format  - Add conditional format rule
rule_update_conditional_format - Update rule
rule_delete_conditional_format - Delete rule
rule_list_conditional_formats  - List rules
set_data_validation          - Set data validation
clear_data_validation        - Clear validation
list_data_validations        - List validations
add_conditional_format_rule  - Add rule (alias)
```

#### 5. `sheets_dimensions` (23 actions)

```
insert              - Insert rows/columns
delete              - Delete rows/columns
move                - Move rows/columns
resize              - Resize dimension
auto_resize         - Auto-fit to content
hide                - Hide rows/columns
show                - Show hidden
freeze              - Freeze panes
group               - Group rows/columns
ungroup             - Ungroup
append              - Append at end
set_basic_filter    - Set/update filter
clear_basic_filter  - Clear filter
get_basic_filter    - Get filter
sort_range          - Sort by columns
trim_whitespace     - Trim cells
randomize_range     - Randomize rows
text_to_columns     - Split text
auto_fill           - Auto-fill pattern
create_filter_view  - Create filter view
update_filter_view  - Update filter view
delete_filter_view  - Delete filter view
list_filter_views   - List filter views
get_filter_view     - Get filter view
create_slicer       - Create slicer
update_slicer       - Update slicer
delete_slicer       - Delete slicer
list_slicers        - List slicers
```

#### 6. `sheets_visualize` (17 actions)

```
chart_create           - Create chart
suggest_chart          - AI chart suggestion
chart_update           - Update chart
chart_delete           - Delete chart
chart_list             - List charts
chart_get              - Get chart details
chart_move             - Move chart
chart_resize           - Resize chart
chart_update_data_range - Update data range
chart_add_trendline    - Add trendline
chart_remove_trendline - Remove trendline
pivot_create           - Create pivot table
suggest_pivot          - AI pivot suggestion
pivot_update           - Update pivot
pivot_delete           - Delete pivot
pivot_list             - List pivots
pivot_get              - Get pivot details
pivot_refresh          - Refresh pivot
```

#### 7. `sheets_collaborate` (29 actions)

```
share_add              - Add permission
share_update           - Update permission
share_remove           - Remove permission
share_list             - List permissions
share_get              - Get permission
share_transfer_ownership - Transfer ownership
share_set_link         - Set link sharing
share_get_link         - Get link settings
comment_add            - Add comment
comment_update         - Update comment
comment_delete         - Delete comment
comment_list           - List comments
comment_get            - Get comment
comment_resolve        - Resolve comment
comment_reopen         - Reopen comment
comment_add_reply      - Add reply
comment_update_reply   - Update reply
comment_delete_reply   - Delete reply
version_list_revisions - List revisions
version_get_revision   - Get revision
version_restore_revision - Restore revision
version_keep_revision  - Keep revision forever
version_create_snapshot - Create snapshot
version_list_snapshots - List snapshots
version_restore_snapshot - Restore snapshot
version_delete_snapshot - Delete snapshot
version_compare        - Compare versions
version_export         - Export version
```

#### 8. `sheets_advanced` (24 actions)

```
add_named_range        - Add named range
update_named_range     - Update named range
delete_named_range     - Delete named range
list_named_ranges      - List named ranges
get_named_range        - Get named range
add_protected_range    - Add protection
update_protected_range - Update protection
delete_protected_range - Delete protection
list_protected_ranges  - List protections
set_metadata           - Set developer metadata
get_metadata           - Get metadata
delete_metadata        - Delete metadata
add_banding            - Add alternating colors
update_banding         - Update banding
delete_banding         - Delete banding
list_banding           - List bandings
create_table           - Create smart table
delete_table           - Delete table
list_tables            - List tables
add_person_chip        - Add person smart chip
add_drive_chip         - Add Drive smart chip
add_rich_link_chip     - Add rich link chip
list_chips             - List smart chips
```

#### 9. `sheets_transaction` (6 actions)

```
begin     - Start transaction (creates snapshot)
queue     - Queue operation
commit    - Commit all queued operations
rollback  - Rollback to snapshot
status    - Get transaction status
list      - List pending operations
```

#### 10. `sheets_quality` (4 actions)

```
validate         - Validate data (11 builtin validators)
detect_conflicts - Detect concurrent edit conflicts
resolve_conflict - Resolve with strategy (6 strategies)
analyze_impact   - Pre-execution impact analysis
```

#### 11. `sheets_history` (7 actions)

```
list       - List last 100 operations
get        - Get operation details
stats      - Get statistics
undo       - Undo last operation
redo       - Redo undone operation
revert_to  - Revert to specific operation
clear      - Clear history
```

#### 12. `sheets_confirm` (5 actions) - MCP Elicitation

```
request         - Request user confirmation
get_stats       - Get confirmation statistics
wizard_start    - Start multi-step wizard
wizard_step     - Advance wizard step
wizard_complete - Complete wizard
```

#### 13. `sheets_analyze` (16 actions) - MCP Sampling

```
comprehensive          - ALL analysis in one call
analyze_data           - AI data analysis
suggest_visualization  - Chart/pivot suggestions
generate_formula       - Generate formula from NL
detect_patterns        - Detect data patterns
analyze_structure      - Analyze sheet structure
analyze_quality        - Data quality assessment
analyze_performance    - Performance metrics
analyze_formulas       - Formula audit
query_natural_language - NL query to operations
explain_analysis       - Explain analysis results
scout                  - Quick data exploration
plan                   - Generate execution plan
execute_plan           - Execute generated plan
drill_down             - Deep dive into data
generate_actions       - Generate tool calls
```

#### 14. `sheets_fix` (1 action)

```
fix  - Auto-fix detected issues (preview or apply mode)
```

#### 15. `sheets_composite` (10 actions)

```
import_csv       - Parse and write CSV data
smart_append     - Append matching headers
bulk_update      - Update rows by key column
deduplicate      - Remove duplicate rows
export_xlsx      - Export to XLSX format
import_xlsx      - Import XLSX file
get_form_responses - Get Google Form responses
setup_sheet      - Create sheet with schema
import_and_format - Import with formatting
clone_structure  - Clone sheet structure only
```

#### 16. `sheets_session` (15 actions)

```
set_active         - Remember active spreadsheet
get_active         - Get current context
get_context        - Full context summary
record_operation   - Track operation
get_last_operation - Get last operation
get_history        - Get session history
find_by_reference  - Resolve "that"/"the budget"
update_preferences - Set user preferences
get_preferences    - Get preferences
set_pending        - Set pending operation
get_pending        - Get pending operation
clear_pending      - Clear pending
save_checkpoint    - Save session checkpoint
load_checkpoint    - Load checkpoint
list_checkpoints   - List checkpoints
delete_checkpoint  - Delete checkpoint
reset              - Reset session
```

#### 17. `sheets_templates` (8 actions)

```
list           - List saved templates
get            - Get template details
create         - Save as template
apply          - Create from template
update         - Update template
delete         - Delete template
preview        - Preview template
import_builtin - Import from knowledge base
```

#### 18. `sheets_bigquery` (14 actions)

```
connect             - Connect to BigQuery
connect_looker      - Connect to Looker
disconnect          - Disconnect
list_connections    - List connections
get_connection      - Get connection details
query               - Execute SQL query
preview             - Preview results
refresh             - Refresh data
cancel_refresh      - Cancel refresh
list_datasets       - List BQ datasets
list_tables         - List BQ tables
get_table_schema    - Get table schema
export_to_bigquery  - Export to BQ
import_from_bigquery - Import from BQ
```

#### 19. `sheets_appsscript` (14 actions)

```
create          - Create script project
get             - Get project
get_content     - Get script content
update_content  - Update content
create_version  - Create version
list_versions   - List versions
get_version     - Get version
deploy          - Deploy web app/API
list_deployments - List deployments
get_deployment  - Get deployment
undeploy        - Remove deployment
run             - Run function remotely
list_processes  - List executions
get_metrics     - Get usage metrics
```

#### 20. `sheets_webhook` (7 actions)

```
register        - Register webhook
list            - List webhooks
get             - Get webhook details
unregister      - Remove webhook
test            - Send test delivery
get_stats       - Get statistics
get_deliveries  - Get delivery history
```

#### 21. `sheets_dependencies` (8 actions)

```
analyze_formulas    - Analyze formula dependencies
get_dependents      - Get cells that depend on cell
get_precedents      - Get cells that cell depends on
find_circular       - Find circular references
get_dependency_graph - Full dependency graph
validate_references - Validate all references
suggest_optimizations - Formula optimization tips
export_dependency_map - Export as JSON/DOT
```

---

## Resources (23 Resource Files, 50+ URIs)

### Resource Categories

| Category | URI Scheme | Files | Description |
|----------|------------|-------|-------------|
| **Core Data** | `sheets:///` | 5 | Spreadsheet data access |
| **Schemas** | `schema://` | 1 | Tool schema access |
| **Knowledge** | `knowledge:///` | 1 | 38 knowledge files |
| **Guides** | `servalsheets://guides/` | 1 | Performance guides |
| **Examples** | `servalsheets://examples/` | 1 | Code examples |
| **Patterns** | `servalsheets://patterns/` | 1 | UASEV+R workflows |
| **Decisions** | `servalsheets://decisions/` | 1 | Decision trees |
| **Reference** | `servalsheets://reference/` | 1 | API reference |
| **Observability** | `history://`, `cache://`, etc. | 11 | Monitoring resources |

### Detailed Resource URIs

#### Core Data Resources

```
sheets:///{spreadsheetId}                    - Spreadsheet metadata
sheets:///{spreadsheetId}/{range}            - Range values (paginated)
sheets:///{spreadsheetId}/charts             - Chart list
sheets:///{spreadsheetId}/pivots             - Pivot table list
sheets:///{spreadsheetId}/quality            - Quality metrics
```

#### Schema Resources

```
schema://tools                               - Tool index
schema://tools/{toolName}                    - Full tool schema
```

#### Knowledge Resources (38 files)

```
knowledge:///api/batch-operations.md
knowledge:///api/charts.md
knowledge:///api/conditional-formatting.md
knowledge:///api/data-validation.md
knowledge:///api/named-ranges.md
knowledge:///api/pivot-tables.md
knowledge:///api/limits/quotas.json
knowledge:///formulas/functions-reference.md
knowledge:///formulas/financial.json
knowledge:///formulas/datetime.json
knowledge:///formulas/lookup.json
knowledge:///formulas/advanced.json
knowledge:///formulas/key-formulas.json
knowledge:///schemas/project.json
knowledge:///schemas/crm.json
knowledge:///schemas/inventory.json
knowledge:///templates/common-templates.json
knowledge:///templates/finance.json
knowledge:///templates/project.json
knowledge:///templates/sales.json
knowledge:///templates/inventory.json
knowledge:///templates/crm.json
knowledge:///templates/marketing.json
knowledge:///workflow-patterns.json
knowledge:///ui-ux-patterns.json
knowledge:///natural-language-guide.json
knowledge:///confirmation-guide.json
knowledge:///formula-antipatterns.json
knowledge:///user-intent-examples.json
knowledge:///masterclass/formula-optimization-master.json
knowledge:///masterclass/performance-tuning-master.json
knowledge:///masterclass/data-quality-master.json
knowledge:///masterclass/schema-governance-master.json
knowledge:///masterclass/security-compliance-master.json
knowledge:///masterclass/apps-script-integration-master.json
knowledge:///masterclass/concurrency-patterns-master.json
```

#### Guide Resources

```
servalsheets://guides/quota-optimization     - API quota strategies
servalsheets://guides/batching-strategies    - Batch operation patterns
servalsheets://guides/caching-patterns       - Cache strategies
servalsheets://guides/error-recovery         - Error handling
```

#### Example Resources

```
servalsheets://examples/basic-operations     - CRUD examples
servalsheets://examples/batch-operations     - Batch examples
servalsheets://examples/transactions         - Transaction examples
servalsheets://examples/composite-workflows  - Composite examples
servalsheets://examples/analysis-visualization - Analysis examples
servalsheets://examples/comparative-tradeoffs - Trade-off analysis
```

#### Pattern Resources (UASEV+R)

```
servalsheets://patterns/simple_read          - Fast path read
servalsheets://patterns/batch_read           - Multi-range read
servalsheets://patterns/transactional_write  - Atomic writes
servalsheets://patterns/data_import          - CSV/XLSX import
servalsheets://patterns/comprehensive_audit  - Full spreadsheet audit
```

#### Decision Tree Resources

```
servalsheets://decisions/when-to-use-transaction  - Transaction decisions
servalsheets://decisions/when-to-confirm          - Confirmation decisions
servalsheets://decisions/tool-selection           - Tool selection guide
servalsheets://decisions/read-vs-batch-read       - Read strategy
```

#### Observability Resources

```
history://operations                         - Operation history
history://operations/{id}                    - Specific operation
cache://stats                                - Cache statistics
cache://entries                              - Cache entries
metrics://performance                        - Performance metrics
metrics://errors                             - Error metrics
discovery://health                           - API health check
analyze://stats                              - Analysis statistics
analyze://results/{id}                       - Analysis result
confirm://stats                              - Confirmation statistics
confirm://help                               - Confirmation guide
transaction://active                         - Active transactions
conflict://detected                          - Detected conflicts
impact://analysis                            - Impact analysis
validation://rules                           - Validation rules
```

---

## Prompts (20 Guided Workflows)

### Onboarding Prompts

| Prompt | Description |
|--------|-------------|
| `welcome` | Introduction to ServalSheets |
| `test_connection` | Test connectivity with public spreadsheet |
| `first_operation` | Guided first operation walkthrough |

### Analysis Prompts

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `analyze_spreadsheet` | `spreadsheetId` | Comprehensive analysis |
| `transform_data` | `spreadsheetId`, `range`, `transformation` | Transform with safety |
| `create_report` | `spreadsheetId`, `reportType` | Generate formatted report |
| `clean_data` | `spreadsheetId`, `range` | Clean and standardize |

### Workflow Prompts

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `migrate_data` | `source*`, `target*`, `ranges` | Cross-spreadsheet migration |
| `setup_budget` | `budgetType`, `spreadsheetId?` | Budget tracker setup |
| `import_data` | `spreadsheetId`, `format`, `source` | Multi-format import |
| `setup_collaboration` | `spreadsheetId`, `collaborators` | Team setup |

### Safety Prompts

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `diagnose_errors` | `spreadsheetId` | Error diagnosis |
| `safe_operation` | `spreadsheetId`, `operation`, `range` | Operation with confirmation |
| `bulk_import` | `spreadsheetId`, `data`, `format` | Large data import |
| `undo_changes` | `spreadsheetId` | Undo workflow |

### Masterclass Prompts

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `masterclass_data_quality` | `spreadsheetId` | Data quality masterclass |
| `masterclass_formulas` | `spreadsheetId` | Formula optimization |
| `masterclass_performance` | `spreadsheetId` | Performance tuning |

### Challenge Prompts

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `challenge_quality_detective` | `spreadsheetId` | Find quality issues |
| `challenge_performance_profiler` | `spreadsheetId` | Find bottlenecks |
| `scenario_multi_user` | `spreadsheetId`, `users` | Multi-user simulation |

---

## Knowledge Base (38 Files)

### API Knowledge

| File | Content |
|------|---------|
| `api/batch-operations.md` | Batch request patterns |
| `api/charts.md` | Chart types and configs |
| `api/conditional-formatting.md` | Format rules |
| `api/data-validation.md` | Validation rules |
| `api/named-ranges.md` | Named range patterns |
| `api/pivot-tables.md` | Pivot configurations |
| `api/limits/quotas.json` | API quotas (100 req/100s) |

### Formula Knowledge

| File | Content |
|------|---------|
| `formulas/functions-reference.md` | 100+ functions |
| `formulas/financial.json` | NPV, IRR, PMT, etc. |
| `formulas/datetime.json` | Date/time functions |
| `formulas/lookup.json` | VLOOKUP, INDEX/MATCH |
| `formulas/advanced.json` | ARRAYFORMULA, QUERY |
| `formulas/key-formulas.json` | Essential formulas |

### Schema Knowledge

| File | Content |
|------|---------|
| `schemas/project.json` | Project management schema |
| `schemas/crm.json` | CRM data schema |
| `schemas/inventory.json` | Inventory schema |

### Template Knowledge

| File | Content |
|------|---------|
| `templates/common-templates.json` | Template index |
| `templates/finance.json` | Budget tracking |
| `templates/project.json` | Project management |
| `templates/sales.json` | Sales pipeline |
| `templates/inventory.json` | Inventory tracking |
| `templates/crm.json` | Customer management |
| `templates/marketing.json` | Campaign tracking |

### Pattern Knowledge

| File | Content |
|------|---------|
| `workflow-patterns.json` | Multi-tool workflows |
| `ui-ux-patterns.json` | UI/UX guidelines |
| `natural-language-guide.json` | NL interpretation |
| `confirmation-guide.json` | When to confirm |
| `formula-antipatterns.json` | Common mistakes |
| `user-intent-examples.json` | Intent classification |

### Masterclass Knowledge

| File | Content |
|------|---------|
| `masterclass/formula-optimization-master.json` | Formula tuning |
| `masterclass/performance-tuning-master.json` | Performance |
| `masterclass/data-quality-master.json` | Quality standards |
| `masterclass/schema-governance-master.json` | Schema design |
| `masterclass/security-compliance-master.json` | Security best practices |
| `masterclass/apps-script-integration-master.json` | Apps Script |
| `masterclass/concurrency-patterns-master.json` | Concurrent edits |

---

## Documentation (241 Files)

### Documentation Structure

```
docs/
├── README.md                    # Documentation home
├── guides/                      # User guides (25 files)
│   ├── FIRST_TIME_USER.md
│   ├── CLAUDE_DESKTOP_SETUP.md
│   ├── INSTALLATION_GUIDE.md
│   ├── USAGE_GUIDE.md
│   ├── TROUBLESHOOTING.md
│   ├── batching-strategies.md
│   ├── caching-patterns.md
│   └── ...
├── development/                 # Developer docs (30 files)
│   ├── CLAUDE_CODE_RULES.md
│   ├── SOURCE_OF_TRUTH.md
│   ├── PROJECT_STATUS.md
│   ├── TESTING.md
│   └── testing/
├── reference/                   # API reference (15 files)
│   ├── tools.md
│   ├── resources.md
│   ├── knowledge.md
│   └── ...
├── operations/                  # Runbooks (10 files)
│   ├── backup-restore.md
│   ├── scaling.md
│   ├── disaster-recovery.md
│   └── ...
├── deployment/                  # Deployment guides (8 files)
│   ├── docker.md
│   ├── kubernetes.md
│   ├── aws.md
│   └── ...
├── examples/                    # Examples (10 files)
│   ├── basic.md
│   ├── analysis.md
│   └── ...
├── analysis/                    # Analysis framework (12 files)
│   ├── 00_QUICKSTART.md
│   ├── 01_FUNCTIONAL.md
│   └── agent-prompts/
├── architecture/                # Architecture docs (5 files)
├── security/                    # Security docs (3 files)
├── business/                    # Business docs (5 files)
└── archive/                     # Historical docs (100+ files)
```

---

## Improvement Roadmap

### Phase 1: Resource Consolidation (Priority: HIGH)

#### 1.1 Standardize URI Schemes

**Current**: Multiple schemes (`sheets://`, `schema://`, `knowledge://`, `servalsheets://`, `history://`, etc.)

**Proposed**:

```
servalsheets://data/{spreadsheetId}/...        # Spreadsheet data
servalsheets://schema/{toolName}               # Tool schemas
servalsheets://knowledge/{category}/{file}     # Knowledge base
servalsheets://guide/{guideName}               # Guides
servalsheets://example/{category}              # Examples
servalsheets://pattern/{patternName}           # Patterns
servalsheets://decision/{treeName}             # Decisions
servalsheets://monitor/{type}                  # Observability
```

**Benefits**:

- Consistent discovery via `servalsheets://` prefix
- Clear hierarchy for Claude autocomplete
- Better grouping in `resources/list`

#### 1.2 Create Master Index Resource

**New Resource**: `servalsheets://index`

Content:

```json
{
  "version": "1.6.0",
  "totalResources": 50,
  "categories": {
    "data": { "count": 5, "description": "Live spreadsheet data" },
    "schema": { "count": 21, "description": "Tool schemas" },
    "knowledge": { "count": 38, "description": "AI knowledge base" },
    "guide": { "count": 4, "description": "Performance guides" },
    "example": { "count": 6, "description": "Code examples" },
    "pattern": { "count": 5, "description": "UASEV+R workflows" },
    "decision": { "count": 4, "description": "Decision trees" },
    "monitor": { "count": 8, "description": "Observability" }
  },
  "quickStart": [
    "servalsheets://schema/sheets_auth",
    "servalsheets://guide/batching-strategies",
    "servalsheets://pattern/simple_read"
  ]
}
```

#### 1.3 Add Resource Notifications

Implement `notifications/resources/list_changed` for:

- Cache invalidation
- New analysis results
- Transaction state changes

### Phase 2: Knowledge Enhancement (Priority: MEDIUM)

#### 2.1 Improve Knowledge Descriptions

**Current**: Generic auto-generated descriptions
**Proposed**: Semantic, action-oriented descriptions

Example:

```typescript
// Before
description: "Google Sheets API reference and patterns: batch operations"

// After
description: "Use when performing 3+ operations on same spreadsheet. Shows how to batch reads/writes for 80% API quota reduction. Includes code examples."
```

#### 2.2 Add Knowledge Relationships

```json
{
  "uri": "knowledge:///api/batch-operations.md",
  "related": [
    "knowledge:///formulas/advanced.json",
    "servalsheets://pattern/batch_read",
    "servalsheets://guide/quota-optimization"
  ]
}
```

#### 2.3 Create Knowledge Search Resource

**New Resource**: `servalsheets://knowledge/search?q={query}`

Returns fuzzy-matched knowledge files with relevance scores.

### Phase 3: Prompt Enhancement (Priority: MEDIUM)

#### 3.1 Add Context-Aware Prompts

- Auto-detect spreadsheet structure
- Suggest relevant prompts based on data
- Chain prompts for complex workflows

#### 3.2 Add Prompt Templates

- Budget from existing data
- Report from query results
- Migration from detected schema

### Phase 4: Advanced Features (Priority: LOW)

#### 4.1 Resource Subscriptions

```typescript
server.subscribeResource("servalsheets://monitor/cache", (update) => {
  // Real-time cache updates
});
```

#### 4.2 Resource Versioning

```
servalsheets://schema/sheets_data@1.6.0
servalsheets://schema/sheets_data@1.5.0
```

#### 4.3 Resource Streaming

For large data resources, support chunked streaming.

---

## Quick Reference

### Essential Resources for Claude

1. `servalsheets://schema/sheets_auth` - Start here
2. `servalsheets://pattern/simple_read` - Basic workflow
3. `servalsheets://guide/batching-strategies` - Optimize quota
4. `servalsheets://decision/tool-selection` - Choose right tool

### Essential Prompts for Users

1. `welcome` - First time user
2. `analyze_spreadsheet` - Understand data
3. `safe_operation` - Modify with safety
4. `setup_budget` - Common use case

### Tool Selection Guide

| Need | Tool | Key Action |
|------|------|------------|
| Check auth | `sheets_auth` | `status` |
| Read data | `sheets_data` | `read` or `batch_read` |
| Write data | `sheets_data` | `write` or `batch_write` |
| Format cells | `sheets_format` | `set_format` or `apply_preset` |
| Add chart | `sheets_visualize` | `chart_create` |
| Share sheet | `sheets_collaborate` | `share_add` |
| Atomic updates | `sheets_transaction` | `begin` → `queue` → `commit` |
| Full analysis | `sheets_analyze` | `comprehensive` |
| Auto-fix | `sheets_fix` | `fix` |

---

*Generated: 2026-02-01 | ServalSheets v1.6.0 | MCP Protocol 2025-11-25*
