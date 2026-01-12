# ServalSheets Master Analysis Prompt

> **Version:** 2.0.0 | **Categories:** 106 | **Max Score:** 140%
> **Target:** VS Code Agents (Copilot, Cursor, Cline, Continue)
> **Estimated Time:** 2-4 hours full analysis

---

# 🚀 QUICK START FOR AI AGENTS

## IMMEDIATE ACTIONS (Run First)

```bash
# 1. Navigate to project
cd /path/to/servalsheets

# 2. Create output directory
mkdir -p analysis-output/evidence

# 3. Run full CI pipeline (captures everything)
npm run ci 2>&1 | tee analysis-output/evidence/ci.log

# 4. Run coverage separately
npm run test:coverage 2>&1 | tee analysis-output/evidence/coverage.log

# 5. Security audit
npm audit --json > analysis-output/evidence/audit.json
```

**If ALL commands pass → Project is healthy, proceed to detailed scoring**
**If ANY command fails → Document failure, analyze cause, continue analysis**

---

## AGENT INSTRUCTIONS

### Your Mission
Execute a comprehensive **106-category audit** of ServalSheets, producing:
1. **Scores** for each category (0-10 scale)
2. **Evidence** from actual command execution
3. **Issues** prioritized by severity (P0-P3)
4. **Report** in structured markdown format

### Critical Rules
```
✅ DO: Run actual commands, capture real output
✅ DO: Read actual source files for evidence
✅ DO: Score conservatively with justification
✅ DO: Report all failures honestly

❌ DON'T: Simulate or fake command output
❌ DON'T: Skip categories
❌ DON'T: Assume passing without verification
❌ DON'T: Modify source code (analysis only)
```

### Parallel Execution Strategy
```
PHASE 1 (Parallel - 5 agents):
├── Agent 1: npm run build && npm run typecheck
├── Agent 2: npm test
├── Agent 3: npm run lint && npm audit
├── Agent 4: File inventory (src/, tests/)
└── Agent 5: Read PROJECT_OVERVIEW.md, README.md

PHASE 2 (Parallel - 4 agents):
├── Agent 1: Score Categories 1-27 (Functional)
├── Agent 2: Score Categories 28-54 (Technical)
├── Agent 3: Score Categories 55-80 (Excellence)
└── Agent 4: Score Categories 81-106 (Agent/Meta)

PHASE 3 (Sequential - Lead agent):
└── Compile final report from all agent outputs
```

---

## PROJECT FACTS (From PROJECT_OVERVIEW.md)

| Metric | Value | Verify With |
|--------|-------|-------------|
| Version | 1.4.0 | `node -p "require('./package.json').version"` |
| Tools | **27** | `npm run show:tools` |
| Actions | 208 | Documented in handlers |
| Tests | 1,830+ | `npm test` |
| Coverage | Target 85% | `npm run test:coverage` |
| LOC | 77,813 | `wc -l src/**/*.ts` |
| MCP SDK | 1.25.2 | `npm ls @modelcontextprotocol/sdk` |

---

## SCORING QUICK REFERENCE

| Score | Meaning | When to Use |
|-------|---------|-------------|
| **10** | Perfect, exceeds standards | Everything + extras |
| **8-9** | Excellent, minor gaps | 80-95% complete |
| **6-7** | Good, some gaps | 60-80% complete |
| **4-5** | Below standard | 40-60% complete |
| **1-3** | Poor | <40% complete |
| **0** | Not implemented | Category missing |

---

## OUTPUT FORMAT

Your final report should follow this structure:
```
analysis-output/
├── ANALYSIS_REPORT.md      ← Main report
├── evidence/
│   ├── ci.log              ← npm run ci output
│   ├── coverage.log        ← Coverage report
│   ├── audit.json          ← Security audit
│   ├── tests.log           ← Detailed test output
│   └── lint.log            ← Lint results
└── metrics/
    └── scores.json         ← All 106 scores
```

---

## KNOWN CONTEXT

### What ServalSheets Is
- Production-grade MCP server for Google Sheets
- 27 tools with 208 discrete actions
- MCP Protocol 2025-11-25 compliant
- Intent-based architecture (95+ intent types)
- Full OAuth 2.1 with PKCE, AES-256 encryption

### Key Differentiators to Validate
1. **Safety System**: Dry-run, snapshots, confirmations, impact analysis
2. **Optimization**: Request batching, caching, prefetching, deduplication
3. **MCP Native**: Elicitation (SEP-1036), Sampling (SEP-1577), Tasks (SEP-1686)
4. **Testing**: 1,830+ tests, property tests, snapshots, contracts

### Files to Read First
1. `PROJECT_OVERVIEW.md` - Complete project documentation
2. `README.md` - User-facing documentation
3. `server.json` - MCP registry metadata
4. `package.json` - Dependencies and scripts
5. `src/mcp/registration.ts` - Tool registration

---

## CATEGORY INDEX

| Part | Categories | Focus |
|------|------------|-------|
| **Part 1** | 1-12 | Functional Features |
| **Part 2** | 13-32 | APIs, Protocol, Code Quality |
| **Part 3** | 33-60 | Deep Technical (Bonus +20%) |
| **Part 4** | 61-80 | Excellence (Bonus +20%) |
| **Part 5** | 81-96 | Agent Execution Framework |
| **Part 6** | 97-106 | VS Code Integration |

**Total: 106 Categories | Base: 100% | Max with Bonuses: 140%**

---

# BEGIN DETAILED CATEGORIES

---

## Purpose
This prompt provides a comprehensive framework for analyzing the ServalSheets MCP server against world-class best practices. Use this to audit the project, identify gaps, score compliance, and generate actionable improvements.

---

## Instructions for Analysis

When analyzing ServalSheets, systematically evaluate each of the **106 categories** below. For each category:

1. **Inventory** - List all relevant files, tools, and features
2. **Score** - Rate compliance 0-10 based on criteria
3. **Strengths** - What's implemented well
4. **Gaps** - What's missing or incomplete
5. **Recommendations** - Specific actionable improvements

---

## Category 1: Authentication & Authorization

### Best Practice Requirements
- [ ] Robust OAuth 2.0/2.1 flows with PKCE
- [ ] Refresh token handling and SSO support
- [ ] Minimal scope requests (principle of least privilege)
- [ ] Per-user permission level enforcement
- [ ] Strict JSON schema validation for auth inputs
- [ ] Token security (never expose to LLM)
- [ ] Confused deputy attack prevention
- [ ] Application-level ACLs

### ServalSheets Files to Analyze
```
src/handlers/auth.ts
src/schemas/auth.ts
src/oauth-provider.ts
src/services/token-store.ts
src/services/token-manager.ts
src/security/resource-indicators.ts
src/security/incremental-scope.ts
src/utils/auth-guard.ts
src/utils/oauth-callback-server.ts
src/services/google-api.ts (auth initialization)
```

### Analysis Questions
1. Does sheets_auth implement all 4 OAuth actions (status, login, callback, logout)?
2. Is PKCE enforced for all authorization flows?
3. Are tokens stored encrypted (AES-256-GCM)?
4. Does the system prevent token exposure in tool outputs?
5. Are scopes minimal (drive.file vs drive)?
6. Is there per-user session isolation?

---

## Category 2: Core Data Operations (Values & Cells)

### Best Practice Requirements
- [ ] Batch API calls (batchGet, batchUpdate)
- [ ] Partial data retrieval (specific ranges only)
- [ ] Intelligent caching with TTL
- [ ] Optimistic reading strategies (bootstrap data)
- [ ] Atomic write operations (transactions)
- [ ] Quota management with exponential backoff
- [ ] Data consistency (ETags, version checks)
- [ ] Large data handling (streaming, summarization)

### ServalSheets Files to Analyze
```
src/handlers/values.ts
src/handlers/values-optimized.ts
src/handlers/cells.ts
src/core/batch-compiler.ts
src/services/batching-system.ts
src/services/batch-aggregator.ts
src/services/request-merger.ts
src/utils/cache-manager.ts
src/utils/hot-cache.ts
src/core/rate-limiter.ts
src/utils/retry.ts
src/handlers/transaction.ts
```

### Analysis Questions
1. How many actions does sheets_values support? (target: 9+)
2. Is there automatic request batching?
3. What's the cache TTL and invalidation strategy?
4. Does the system handle 429 errors gracefully?
5. Is there a transaction tool for atomic operations?
6. How are large ranges (>10K cells) handled?

---

## Category 3: Formatting & Styling

### Best Practice Requirements
- [ ] BatchUpdate for multiple format changes
- [ ] Proper number formats (not string manipulation)
- [ ] Theme color support (not raw RGB)
- [ ] Conditional formatting over manual styling
- [ ] Explicit dimension operations
- [ ] Handle API format limitations gracefully
- [ ] Accessibility considerations (contrast, font size)

### ServalSheets Files to Analyze
```
src/handlers/format.ts
src/handlers/dimensions.ts
src/schemas/format.ts
src/schemas/dimensions.ts
```

### Analysis Questions
1. How many format actions are available?
2. Is there support for conditional formatting in format tool?
3. Can theme colors be applied?
4. Are font accessibility defaults enforced?
5. How are unsupported format requests handled?

---

## Category 4: Data Rules & Validation

### Best Practice Requirements
- [ ] Data validation rules (list, number range, email, etc.)
- [ ] Custom formula validation support
- [ ] Conditional formatting rules management
- [ ] Protected ranges/sheets
- [ ] Named ranges support
- [ ] Validation testing/dry-run
- [ ] Rule conflict detection

### ServalSheets Files to Analyze
```
src/handlers/rules.ts
src/handlers/advanced.ts
src/schemas/rules.ts
src/services/validation-engine.ts
src/handlers/validation.ts
```

### Analysis Questions
1. What validation types are supported?
2. Can custom formula validations be created?
3. Is there a tool for protected ranges?
4. How are rule conflicts handled?
5. Is there validation preview/dry-run?

---

## Category 5: Visualization (Charts & Pivots)

### Best Practice Requirements
- [ ] Common chart type creation (bar, line, pie, etc.)
- [ ] Chart placement control
- [ ] Acknowledge API chart limitations
- [ ] Dynamic ranges for charts
- [ ] Pivot table creation with aggregations
- [ ] Filter views (non-destructive filtering)
- [ ] Visualization recommendations

### ServalSheets Files to Analyze
```
src/handlers/charts.ts
src/handlers/pivot.ts
src/handlers/filter-sort.ts
src/schemas/charts.ts
src/schemas/pivot.ts
src/schemas/filter-sort.ts
src/resources/charts.ts
src/resources/pivots.ts
```

### Analysis Questions
1. What chart types are supported?
2. Can charts be positioned on specific sheets?
3. Are pivot table aggregations supported (SUM, AVG, COUNT)?
4. Is there filter view support?
5. Does sheets_analyze suggest chart types?

---

## Category 6: Collaboration (Sharing & Comments)

### Best Practice Requirements
- [ ] Drive API sharing integration
- [ ] Confirmation before external sharing
- [ ] Least permissive role by default
- [ ] Comments API integration with cell anchoring
- [ ] Mention handling (no auto-mentions)
- [ ] Change notification support
- [ ] Privacy respect (don't expose private comments)
- [ ] Session context for multi-document

### ServalSheets Files to Analyze
```
src/handlers/sharing.ts
src/handlers/comments.ts
src/schemas/sharing.ts
src/schemas/comments.ts
src/services/session-context.ts
src/handlers/session.ts
```

### Analysis Questions
1. Does sharing require confirmation?
2. What permission roles are supported?
3. Can comments be anchored to specific cells?
4. Is there mention support with safeguards?
5. Does session track active spreadsheets?

---

## Category 7: Version Control & History

### Best Practice Requirements
- [ ] List revisions via Drive API
- [ ] Named snapshots/backups
- [ ] Internal operation history (undo buffer)
- [ ] Outside change detection
- [ ] Keep-forever revision marking
- [ ] Restoration capabilities

### ServalSheets Files to Analyze
```
src/handlers/versions.ts
src/handlers/history.ts
src/services/snapshot.ts
src/services/history-service.ts
src/schemas/versions.ts
src/schemas/history.ts
src/resources/history.ts
```

### Analysis Questions
1. How many version actions are available?
2. Is there snapshot creation before destructive ops?
3. Can operations be rolled back?
4. Is there an undo buffer with previous values?
5. Does the system detect external changes?

---

## Category 8: Data Analysis & AI Integration

### Best Practice Requirements
- [ ] Deterministic analysis tools (stats, pivots, outliers)
- [ ] AI-driven analysis with sampling
- [ ] Data size limits for AI (token management)
- [ ] AI result validation/caveats
- [ ] Prompt templates for analysis workflows
- [ ] Performance/cost notifications
- [ ] Domain-specific AI features

### ServalSheets Files to Analyze
```
src/handlers/analysis.ts
src/handlers/analyze.ts
src/schemas/analysis.ts
src/schemas/analyze.ts
src/services/sampling-analysis.ts
src/mcp/sampling.ts
src/resources/analyze.ts
```

### Analysis Questions
1. What deterministic analyses are available?
2. Does sheets_analyze use MCP Sampling?
3. Are AI results caveated appropriately?
4. How is data sampled for large sheets?
5. Are there analysis prompt templates?

---

## Category 9: Advanced Functions & Integrations

### Best Practice Requirements
- [ ] Complex formula generation
- [ ] Cross-service integration capability
- [ ] Safe "raw request" tool (if any)
- [ ] Template/blueprint support
- [ ] Request merging and deduplication
- [ ] Pagination handling

### ServalSheets Files to Analyze
```
src/handlers/advanced.ts
src/handlers/composite.ts
src/schemas/advanced.ts
src/schemas/composite.ts
src/knowledge/templates/
src/services/composite-operations.ts
src/utils/request-deduplication.ts
src/services/request-merger.ts
```

### Analysis Questions
1. What advanced actions are available?
2. Are there pre-built templates (CRM, inventory)?
3. Is there request deduplication?
4. Can composite operations be performed?
5. Is pagination handled internally?

---

## Category 10: Enterprise Safety & Confirmation

### Best Practice Requirements
- [ ] Confirmation dialogs for destructive actions
- [ ] Impact assessment before operations
- [ ] Transaction atomicity with rollback
- [ ] Dry-run/preview mode
- [ ] Automatic snapshots before changes
- [ ] Conflict checking
- [ ] Operation limits (cap damage potential)
- [ ] Comprehensive audit logging
- [ ] User confirmation preferences

### ServalSheets Files to Analyze
```
src/handlers/confirm.ts
src/handlers/impact.ts
src/handlers/transaction.ts
src/handlers/conflict.ts
src/handlers/validation.ts
src/services/confirmation-policy.ts
src/services/confirm-service.ts
src/services/conflict-detector.ts
src/services/impact-analyzer.ts
src/services/snapshot.ts
src/knowledge/confirmation-guide.json
src/resources/confirm.ts
```

### Analysis Questions
1. What triggers confirmation requirements?
2. Is there impact analysis showing affected cells/formulas?
3. Does transaction support dry-run mode?
4. Are snapshots created automatically?
5. How are conflicts detected and resolved?
6. What safety limits exist?

---

## Category 11: Composite Operations & Orchestration

### Best Practice Requirements
- [ ] Multi-step composite tools
- [ ] Clear composite tool documentation
- [ ] Skill/prompt orchestration guidance
- [ ] Multi-server coordination capability
- [ ] Comprehensive examples
- [ ] Continuous tool improvement process

### ServalSheets Files to Analyze
```
src/handlers/composite.ts
src/schemas/composite.ts
src/knowledge/workflow-patterns.json
src/knowledge/user-intent-examples.json
docs/guides/SKILL.md
docs/examples/
```

### Analysis Questions
1. What composite actions are available?
2. Is there a SKILL.md for LLM guidance?
3. Are workflow patterns documented?
4. How many tool usage examples exist?
5. Is there a feedback loop for tool improvements?

---

## Category 12: Security & Oversight

### Best Practice Requirements
- [ ] Tool allowlisting/disabling capability
- [ ] Runtime safeguards (input validation)
- [ ] Elicitation for ambiguous requests
- [ ] Comprehensive monitoring/logging
- [ ] Data exfiltration prevention
- [ ] Prompt injection defenses
- [ ] Proxy/governance layer support
- [ ] Regular security updates
- [ ] Privacy compliance

### ServalSheets Files to Analyze
```
src/security/
src/observability/metrics.ts
src/utils/logger.ts
src/utils/redact.ts
src/mcp/elicitation.ts
src/core/policy-enforcer.ts
src/utils/payload-monitor.ts
```

### Analysis Questions
1. Can tools be disabled per environment?
2. Is there input size/content validation?
3. Does the system use elicitation for clarification?
4. What metrics are tracked?
5. Are sensitive values redacted in logs?
6. Is there rate limiting per session?

---


## Category 13: MCP 2025-11-25 Specification Compliance

### Best Practice Requirements (Latest MCP Spec)

#### Core Protocol Features
- [ ] **Tools** - Full tools/list, tools/call implementation
- [ ] **Resources** - resources/list, resources/read, resources/subscribe
- [ ] **Prompts** - prompts/list, prompts/get with arguments
- [ ] **Completions** - completion/complete for argument suggestions
- [ ] **Logging** - logging/setLevel with dynamic level changes

#### SEP-1686: Tasks (Async Operations)
- [ ] Task primitive support for long-running operations
- [ ] Task states: working, input_required, completed, failed, cancelled
- [ ] tasks/get, tasks/result, tasks/list, tasks/cancel methods
- [ ] Task hints for "call-now, fetch-later" patterns
- [ ] Task ID generation by receiver (server-generated)
- [ ] Support for tools/call, sampling/createMessage, elicitation/create

#### SEP-1036: Elicitation (Human-in-the-Loop)
- [ ] Form mode elicitation (structured data collection via JSON Schema)
- [ ] URL mode elicitation (browser-based OAuth, payments, credentials)
- [ ] elicitation/create method implementation
- [ ] Elicitation result handling (accept, decline, cancel)
- [ ] Timeout management for elicitation flows

#### SEP-1577: Sampling with Tools
- [ ] sampling/createMessage with tool definitions
- [ ] Server-side agent loops capability
- [ ] Context inclusion for sampling requests
- [ ] Multi-step reasoning orchestration

#### SEP-973: Tool Annotations & Icons
- [ ] Tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- [ ] Icon support for tools (data URI or HTTPS URL)
- [ ] Annotation-based filtering by clients

#### Structured Outputs (June 2025)
- [ ] Output schemas on tools (JSON Schema)
- [ ] structuredContent in tool results
- [ ] MIME type content blocks
- [ ] Graceful fallback for unstructured content

#### OAuth 2.1 Enhancements
- [ ] MCP Server as OAuth Resource Server
- [ ] Mandatory Resource Indicators (RFC 8707)
- [ ] Client ID Metadata Documents (SEP-991)
- [ ] Default scopes definition (SEP-835)
- [ ] Client security requirements for local servers (SEP-1024)

#### Extensions Framework (SEP-1046, SEP-990)
- [ ] Extension namespace registration
- [ ] Capability negotiation for extensions
- [ ] OAuth client-credentials for M2M (SEP-1046)
- [ ] Cross App Access / XAA for enterprise IdP (SEP-990)

#### Other Protocol Features
- [ ] Server instructions for capability description
- [ ] Standardized tool-name format (SEP-986)
- [ ] Progress notifications with tokens
- [ ] Roots for filesystem boundaries
- [ ] Well-known URLs for server discovery

### ServalSheets Files to Analyze
```
src/mcp/features-2025-11-25.ts
src/mcp/registration.ts
src/mcp/elicitation.ts
src/mcp/sampling.ts
src/mcp/completions.ts
src/mcp/response-builder.ts
src/mcp/sdk-compat.ts
src/schemas/annotations.ts
src/core/task-store.ts
src/core/task-store-adapter.ts
src/startup/lifecycle.ts
src/server/well-known.ts
package.json (SDK version)
```

### Analysis Questions
1. Which MCP SDK version is used? (target: 1.3.0+ for 2025-11-25)
2. Are all 5 core primitives implemented (tools, resources, prompts, completions, logging)?
3. Is Tasks (SEP-1686) implemented for async operations?
4. Does sheets_confirm use Elicitation (SEP-1036)?
5. Does sheets_analyze use Sampling with Tools (SEP-1577)?
6. Are tool annotations present on all 26 tools?
7. Is structured output used in tool responses?
8. Is server discovery via .well-known supported?
9. Are OAuth Resource Indicators implemented?
10. Is there an extensions capability negotiation?

---

## Category 14: Google Sheets API v4 Coverage

### API Methods to Support

#### spreadsheets Collection
- [ ] spreadsheets.create - Create new spreadsheet
- [ ] spreadsheets.get - Get spreadsheet metadata (with/without grid data)
- [ ] spreadsheets.batchUpdate - Atomic batch operations (60+ request types)
- [ ] spreadsheets.getByDataFilter - Get by developer metadata filter

#### spreadsheets.values Collection
- [ ] values.get - Read single range
- [ ] values.batchGet - Read multiple ranges (single API call)
- [ ] values.update - Write single range
- [ ] values.batchUpdate - Write multiple ranges atomically
- [ ] values.append - Append rows to table
- [ ] values.batchClear - Clear multiple ranges
- [ ] values.clear - Clear single range

#### spreadsheets.sheets Collection
- [ ] sheets.copyTo - Copy sheet to another spreadsheet

#### spreadsheets.developerMetadata Collection
- [ ] developerMetadata.get - Get metadata by ID
- [ ] developerMetadata.search - Search metadata

### BatchUpdate Request Types (Key Ones)

#### Sheet Operations
- [ ] AddSheetRequest
- [ ] DeleteSheetRequest
- [ ] DuplicateSheetRequest
- [ ] UpdateSheetPropertiesRequest
- [ ] CopyPasteRequest
- [ ] CutPasteRequest

#### Cell/Range Operations
- [ ] UpdateCellsRequest
- [ ] RepeatCellRequest (bulk formatting)
- [ ] AppendCellsRequest
- [ ] InsertRangeRequest
- [ ] DeleteRangeRequest
- [ ] MoveDimensionRequest
- [ ] InsertDimensionRequest
- [ ] DeleteDimensionRequest
- [ ] UpdateDimensionPropertiesRequest
- [ ] AutoResizeDimensionsRequest

#### Formatting
- [ ] UpdateBordersRequest
- [ ] MergeCellsRequest
- [ ] UnmergeCellsRequest
- [ ] SetBasicFilterRequest
- [ ] ClearBasicFilterRequest
- [ ] AddFilterViewRequest
- [ ] UpdateFilterViewRequest
- [ ] DeleteFilterViewRequest
- [ ] SortRangeRequest

#### Data Validation & Rules
- [ ] SetDataValidationRequest
- [ ] AddConditionalFormatRuleRequest
- [ ] UpdateConditionalFormatRuleRequest
- [ ] DeleteConditionalFormatRuleRequest

#### Charts & Visualization
- [ ] AddChartRequest
- [ ] UpdateChartSpecRequest
- [ ] UpdateEmbeddedObjectPositionRequest
- [ ] DeleteEmbeddedObjectRequest

#### Pivot Tables
- [ ] UpdatePivotTableRequest
- [ ] RefreshPivotTableRequest

#### Named Ranges & Protection
- [ ] AddNamedRangeRequest
- [ ] UpdateNamedRangeRequest
- [ ] DeleteNamedRangeRequest
- [ ] AddProtectedRangeRequest
- [ ] UpdateProtectedRangeRequest
- [ ] DeleteProtectedRangeRequest

#### Advanced
- [ ] FindReplaceRequest
- [ ] TextToColumnsRequest
- [ ] CreateDeveloperMetadataRequest
- [ ] UpdateDeveloperMetadataRequest
- [ ] DeleteDeveloperMetadataRequest
- [ ] AddSlicerRequest
- [ ] UpdateSlicerSpecRequest
- [ ] AddBandingRequest
- [ ] UpdateBandingRequest
- [ ] DeleteBandingRequest

### API Best Practices
- [ ] Use includeGridData=false by default (performance)
- [ ] Use field masks for partial responses
- [ ] Implement exponential backoff for 429/5xx
- [ ] Respect rate limits (100 requests/100 seconds/user)
- [ ] Use majorDimension correctly (ROWS vs COLUMNS)
- [ ] Handle valueInputOption (RAW vs USER_ENTERED)
- [ ] Handle valueRenderOption (FORMATTED_VALUE, UNFORMATTED_VALUE, FORMULA)
- [ ] Use A1 notation and R1C1 notation support

### ServalSheets Files to Analyze
```
src/services/google-api.ts
src/handlers/*.ts (all handlers)
src/core/batch-compiler.ts
src/services/batching-system.ts
src/utils/google-sheets-helpers.ts
src/core/range-resolver.ts
src/knowledge/api/
```

### Analysis Questions
1. What percentage of batchUpdate request types are supported?
2. Is batchGet used for multi-range reads?
3. Is batchUpdate used for atomic operations?
4. Are field masks used to minimize response size?
5. Is includeGridData=false the default?
6. How is rate limiting handled (429 responses)?
7. Are all valueInputOption modes supported?
8. Is developer metadata supported for custom storage?
9. What chart types can be created via API?
10. Is FindReplaceRequest supported?

---

## Category 15: Google Drive API v3 Integration

### API Methods to Support

#### Files Collection
- [ ] files.get - Get file metadata
- [ ] files.list - List/search files
- [ ] files.create - Create file (for new spreadsheets via Drive)
- [ ] files.update - Update file metadata
- [ ] files.delete - Delete file (move to trash)
- [ ] files.copy - Copy file
- [ ] files.export - Export to different format (PDF, XLSX, CSV)
- [ ] files.emptyTrash - Empty user's trash

#### Permissions Collection
- [ ] permissions.list - List file permissions
- [ ] permissions.get - Get specific permission
- [ ] permissions.create - Share file (add permission)
- [ ] permissions.update - Modify permission
- [ ] permissions.delete - Remove permission (unshare)

#### Revisions Collection
- [ ] revisions.list - List file revisions
- [ ] revisions.get - Get revision metadata
- [ ] revisions.update - Update revision (keepForever flag)
- [ ] revisions.delete - Delete revision (binary files only)

#### Comments Collection
- [ ] comments.list - List comments
- [ ] comments.get - Get comment
- [ ] comments.create - Add comment (with anchor)
- [ ] comments.update - Edit comment
- [ ] comments.delete - Delete comment

#### Replies Collection
- [ ] replies.list - List replies to comment
- [ ] replies.get - Get reply
- [ ] replies.create - Reply to comment
- [ ] replies.update - Edit reply
- [ ] replies.delete - Delete reply

#### Drives Collection (Shared Drives)
- [ ] drives.list - List shared drives
- [ ] drives.get - Get shared drive metadata
- [ ] drives.create - Create shared drive
- [ ] drives.update - Update shared drive
- [ ] drives.delete - Delete shared drive

### Drive API Features
- [ ] Folders with limited access (inheritedPermissionsDisabled)
- [ ] Content restrictions (ownerRestricted)
- [ ] Change notifications (watch/push notifications)
- [ ] Resumable uploads for large files
- [ ] Shortcut files support
- [ ] Labels/properties for custom metadata

### Permission Roles
- [ ] owner - Full ownership
- [ ] organizer - Shared drive management
- [ ] fileOrganizer - Manage files in shared drive
- [ ] writer - Edit access
- [ ] commenter - Comment only
- [ ] reader - View only

### ServalSheets Files to Analyze
```
src/handlers/sharing.ts
src/handlers/comments.ts
src/handlers/versions.ts
src/services/google-api.ts
src/schemas/sharing.ts
```

### Analysis Questions
1. Is the Drive API v3 client properly initialized?
2. Are all permission roles supported (owner → reader)?
3. Can files be exported to PDF/XLSX/CSV?
4. Is revision history accessible?
5. Can comments be anchored to specific cell ranges?
6. Are shared drives (Team Drives) supported?
7. Is file copying implemented for snapshots?
8. Are content restrictions (lock file) supported?
9. Can permissions be transferred (change owner)?
10. Is there change notification support?

---

## Category 16: Google BigQuery / Connected Sheets Integration

### Connected Sheets Features

#### Data Source Management
- [ ] AddDataSourceRequest - Connect BigQuery table/query
- [ ] UpdateDataSourceRequest - Modify data source
- [ ] DeleteDataSourceRequest - Remove data source
- [ ] RefreshDataSourceRequest - Refresh data from BigQuery

#### Data Source Objects
- [ ] DataSourceTable - BigQuery data in grid format
- [ ] DataSourcePivotTable - Pivot table from BigQuery data
- [ ] DataSourceChart - Charts powered by BigQuery
- [ ] DataSourceFormula - Formulas using BigQuery data

#### Data Execution
- [ ] DataExecutionStatus tracking (RUNNING, SUCCEEDED, FAILED)
- [ ] Async polling for execution completion
- [ ] Error handling for BigQuery failures

### BigQuery API Integration

#### Query Operations
- [ ] jobs.query - Run synchronous query
- [ ] jobs.insert - Start async query job
- [ ] jobs.get - Get job status
- [ ] jobs.getQueryResults - Get query results

#### Table Operations
- [ ] tables.get - Get table metadata
- [ ] tables.list - List tables in dataset
- [ ] tabledata.list - Read table rows
- [ ] tables.insert - Create table

#### Dataset Operations
- [ ] datasets.list - List datasets
- [ ] datasets.get - Get dataset metadata

### Use Cases to Support
- [ ] Query BigQuery from Sheets (SELECT → Sheets)
- [ ] Create pivot tables on BigQuery data
- [ ] Create charts from BigQuery results
- [ ] Use BigQuery data in Sheets formulas
- [ ] Scheduled refresh of BigQuery data
- [ ] Parameter passing to BigQuery queries

### Best Practices
- [ ] Handle large result sets (>10M cells limit)
- [ ] Implement query caching
- [ ] Support parameterized queries
- [ ] Handle BigQuery quotas/costs
- [ ] Support VPC Service Controls
- [ ] Audit logging for compliance

### ServalSheets Files to Analyze
```
src/handlers/advanced.ts (if BigQuery actions exist)
src/services/google-api.ts (BigQuery client)
src/knowledge/api/ (BigQuery documentation)
```

### Analysis Questions
1. Is BigQuery client initialized alongside Sheets?
2. Can data sources be added programmatically?
3. Are DataSourcePivotTables supported?
4. Is async execution polling implemented?
5. Can BigQuery queries be parameterized?
6. Is there scheduled refresh support?
7. How are large result sets handled?
8. Is there cost estimation before queries?
9. Are BigQuery errors mapped to MCP errors?
10. Is Looker integration supported?

---

## Scoring Matrix (Updated)

Rate each category 0-10 and calculate overall score:

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| 1. Authentication | 8% | /10 | |
| 2. Core Data Ops | 12% | /10 | |
| 3. Formatting | 5% | /10 | |
| 4. Data Rules | 5% | /10 | |
| 5. Visualization | 5% | /10 | |
| 6. Collaboration | 5% | /10 | |
| 7. Version Control | 5% | /10 | |
| 8. AI Analysis | 7% | /10 | |
| 9. Advanced | 5% | /10 | |
| 10. Safety | 8% | /10 | |
| 11. Orchestration | 3% | /10 | |
| 12. Security | 5% | /10 | |
| **13. MCP 2025-11-25 Spec** | **12%** | /10 | |
| **14. Google Sheets API v4** | **8%** | /10 | |
| **15. Google Drive API v3** | **4%** | /10 | |
| **16. BigQuery/Connected Sheets** | **3%** | /10 | |
| **TOTAL** | 100% | | **/100** |

---

## Output Format

Generate a report with:

1. **Executive Summary** (1 paragraph)
2. **Category Scores** (table with justifications)
3. **Top 5 Strengths** (what ServalSheets does exceptionally well)
4. **Top 5 Gaps** (critical missing features)
5. **Priority Recommendations** (ordered by impact)
6. **Detailed Category Analysis** (one section per category)
7. **Implementation Roadmap** (phases for improvements)
8. **MCP Compliance Checklist** (SEP-by-SEP status)
9. **Google API Coverage Matrix** (methods supported vs missing)

---

## Quick Reference: ServalSheets Tool Inventory

Current tools (26):
```
sheets_auth         - OAuth authentication (4 actions)
sheets_spreadsheet  - Spreadsheet CRUD (8 actions)
sheets_sheet        - Sheet management (7 actions)
sheets_values       - Cell read/write (9 actions)
sheets_cells        - Cell properties (9 actions)
sheets_format       - Formatting (9 actions)
sheets_dimensions   - Row/column ops (8 actions)
sheets_rules        - Validation/conditional (8 actions)
sheets_charts       - Chart creation (7 actions)
sheets_pivot        - Pivot tables (6 actions)
sheets_filter_sort  - Filtering/sorting (6 actions)
sheets_sharing      - Permissions (8 actions)
sheets_comments     - Comments (6 actions)
sheets_versions     - Version history (10 actions)
sheets_analysis     - Deterministic analysis (6 actions)
sheets_advanced     - Advanced features (10 actions)
sheets_transaction  - Atomic operations (6 actions)
sheets_validation   - Pre-flight validation (1 action)
sheets_conflict     - Conflict detection (5 actions)
sheets_impact       - Impact analysis (1 action)
sheets_history      - Operation history (7 actions)
sheets_confirm      - User confirmation (2 actions)
sheets_analyze      - AI analysis (4 actions)
sheets_fix          - Auto-fix issues (1 action)
sheets_composite    - Multi-step ops (4 actions)
sheets_session      - Session context (13 actions)
```

**Total: 26 tools, 208 actions**

---

## MCP 2025-11-25 Features Inventory

### Core Primitives
```
✅ Tools (26 registered)
✅ Resources (33+ registered)
✅ Prompts (25 registered)
✅ Completions (argument suggestions)
✅ Logging (dynamic level changes)
```

### SEP Features
```
SEP-1686  Tasks              [ ] Verify implementation
SEP-1036  Elicitation        [ ] Verify form + URL modes
SEP-1577  Sampling w/ Tools  [ ] Verify in sheets_analyze
SEP-973   Icons              [ ] Verify tool icons
SEP-991   Client ID Metadata [ ] Verify OAuth flow
SEP-835   Default Scopes     [ ] Verify scope definitions
SEP-1024  Local Server Sec   [ ] Verify install safety
SEP-986   Tool Name Format   [ ] Verify naming convention
SEP-1046  M2M OAuth          [ ] Verify client credentials
SEP-990   Cross App Access   [ ] Verify enterprise IdP
```

### Additional Features
```
✅ Tool Annotations (readOnly, destructive, idempotent)
✅ Structured Outputs (JSON Schema)
✅ Server Instructions
✅ Progress Notifications
[ ] Well-known Discovery
[ ] Extensions Framework
```

---

## Google API Coverage Targets

### Sheets API v4
- **spreadsheets**: 4/4 methods (100%)
- **values**: 7/7 methods (100%)
- **sheets**: 1/1 methods (100%)
- **developerMetadata**: 0/2 methods (target)
- **BatchUpdate requests**: ~40/60 types (target: 67%)

### Drive API v3
- **files**: 5/8 methods (target: 63%)
- **permissions**: 5/5 methods (100%)
- **revisions**: 3/4 methods (target: 75%)
- **comments**: 5/5 methods (100%)
- **replies**: 5/5 methods (100%)
- **drives**: 0/5 methods (not critical for Sheets)

### BigQuery API
- **Connected Sheets**: 0/4 data source methods (stretch goal)
- **Query operations**: 0/4 methods (stretch goal)

---

## Usage

Run this analysis by:

1. Reading this prompt completely
2. Examining each category's files systematically
3. Scoring against all criteria
4. Generating the structured report
5. Creating implementation roadmap

This creates a comprehensive audit of ServalSheets against:
- World-class MCP server standards
- MCP 2025-11-25 specification compliance
- Google Sheets API v4 full coverage
- Google Drive API v3 integration
- Google BigQuery Connected Sheets capability


---

# PART 2: Technical Excellence Categories (17-28)

---

## Category 17: Zod Schema Architecture

### Best Practice Requirements

#### Schema Design Patterns
- [ ] Discriminated unions for action-based tools
- [ ] Strict mode enabled (z.strict())
- [ ] Proper optional vs nullable handling
- [ ] Default values where appropriate
- [ ] Coercion for type flexibility (z.coerce)
- [ ] Refinements for custom validation
- [ ] Transform for data normalization
- [ ] Branded types for type-safe IDs

#### Schema Organization
- [ ] One schema file per tool
- [ ] Shared schemas in shared.ts
- [ ] Input schemas separate from output schemas
- [ ] Consistent naming convention (*InputSchema, *OutputSchema)
- [ ] Re-exports via index.ts
- [ ] JSDoc documentation on schemas

#### Validation Performance
- [ ] Pre-compiled validators (z.parse once, reuse)
- [ ] Fast validators for hot paths
- [ ] Lazy schema evaluation where appropriate
- [ ] Schema caching for repeated validations
- [ ] Avoid deep nesting (max 3-4 levels)

#### Type Inference
- [ ] z.infer<typeof Schema> for TypeScript types
- [ ] Type exports alongside schemas
- [ ] Proper input/output type separation
- [ ] Generic schemas for reusable patterns

#### Error Handling
- [ ] Custom error messages (z.string().min(1, "Required"))
- [ ] Error mapping to user-friendly messages
- [ ] Zod error formatting for MCP responses
- [ ] Path-based error localization

#### Zod v4 Features (if using 4.x)
- [ ] z.interface() for object types
- [ ] Improved tree-shaking
- [ ] Better error messages
- [ ] z.templateLiteral() support

### ServalSheets Files to Analyze
```
src/schemas/*.ts (all schema files)
src/schemas/index.ts (exports and registry)
src/schemas/shared.ts (common types)
src/schemas/fast-validators.ts (pre-compiled)
src/schemas/annotations.ts (tool annotations)
tests/schemas.test.ts
tests/contracts/schema-*.test.ts
tests/property/schema-validation.property.test.ts
package.json (zod version)
```

### Analysis Questions
1. What Zod version is used? (current: 4.3.5)
2. Are all 26 tools using discriminated unions?
3. Are there pre-compiled validators for performance?
4. Is z.infer used consistently for type inference?
5. Are custom error messages defined?
6. Is schema validation tested with property-based tests?
7. Are schemas documented with JSDoc?
8. Is there schema drift detection (check-metadata-drift.sh)?

---

## Category 18: TypeScript Excellence

### Best Practice Requirements

#### Strict Mode Configuration
- [ ] strict: true in tsconfig.json
- [ ] noImplicitReturns: true
- [ ] noFallthroughCasesInSwitch: true
- [ ] noUncheckedIndexedAccess: true
- [ ] noPropertyAccessFromIndexSignature: true
- [ ] exactOptionalPropertyTypes: true (if compatible)

#### Type Safety
- [ ] No `any` types (eslint rule: @typescript-eslint/no-explicit-any)
- [ ] No type assertions (as) without justification
- [ ] Proper use of `unknown` over `any`
- [ ] Generic constraints where appropriate
- [ ] Discriminated unions for state machines
- [ ] Branded/nominal types for IDs

#### Code Organization
- [ ] Barrel exports (index.ts) for public API
- [ ] Internal modules not exported
- [ ] Proper module boundaries
- [ ] Consistent file naming (kebab-case.ts)
- [ ] Co-located types with implementation

#### Advanced TypeScript
- [ ] Conditional types for complex logic
- [ ] Template literal types for string patterns
- [ ] Mapped types for transformations
- [ ] Utility types (Partial, Pick, Omit, etc.)
- [ ] const assertions for literals
- [ ] satisfies operator for type checking

#### Declaration Files
- [ ] Generated .d.ts files
- [ ] Declaration maps for debugging
- [ ] Proper exports in package.json

### ServalSheets Files to Analyze
```
tsconfig.json
tsconfig.build.json
tsconfig.eslint.json
src/types/*.ts
eslint.config.js (TypeScript rules)
package.json (typescript version)
```

### Analysis Questions
1. Is strict mode fully enabled?
2. Are there any `any` types in the codebase?
3. Is noUncheckedIndexedAccess enabled?
4. Are generic types used appropriately?
5. Are branded types used for spreadsheet/sheet IDs?
6. Is the TypeScript version current (5.x)?
7. Are declaration files generated correctly?
8. Is incremental compilation enabled?

---

## Category 19: Node.js Best Practices

### Best Practice Requirements

#### Runtime Configuration
- [ ] Node.js 20+ (LTS) required
- [ ] ES Modules (type: "module")
- [ ] Proper module resolution (NodeNext)
- [ ] Environment variable validation
- [ ] Graceful shutdown handling

#### Async Patterns
- [ ] async/await over callbacks
- [ ] Proper Promise error handling
- [ ] No unhandled promise rejections
- [ ] AbortController for cancellation
- [ ] p-queue for concurrency control

#### Memory Management
- [ ] LRU caches with size limits
- [ ] Proper cleanup on shutdown
- [ ] No memory leaks in long-running processes
- [ ] Stream processing for large data
- [ ] WeakMap/WeakSet for object associations

#### Event Loop Best Practices
- [ ] No blocking operations on main thread
- [ ] setImmediate for deferred execution
- [ ] Proper timer cleanup
- [ ] Worker threads for CPU-intensive tasks (if needed)

#### Error Handling
- [ ] Custom error classes
- [ ] Error cause chaining
- [ ] Process-level error handlers
- [ ] Structured logging for errors

#### Security
- [ ] No eval() or Function()
- [ ] Secure environment variable handling
- [ ] Input sanitization
- [ ] Path traversal prevention

### ServalSheets Files to Analyze
```
package.json (engines, type)
src/config/env.ts
src/startup/lifecycle.ts
src/utils/retry.ts
src/core/rate-limiter.ts
src/services/google-api.ts
src/utils/circuit-breaker.ts
```

### Analysis Questions
1. Is Node.js 20+ required in engines?
2. Is ES Modules used (type: "module")?
3. Is there graceful shutdown handling?
4. Are AbortControllers used for cancellation?
5. Is p-queue used for rate limiting?
6. Are LRU caches bounded?
7. Is there proper cleanup on SIGTERM/SIGINT?
8. Are there any synchronous I/O operations?

---

## Category 20: Dependency Management

### Best Practice Requirements

#### Version Management
- [ ] Exact versions or tight ranges
- [ ] Regular dependency updates
- [ ] Security audit passing
- [ ] No deprecated packages
- [ ] Peer dependencies declared

#### Production Dependencies
- [ ] Minimal dependency count
- [ ] No unnecessary large packages
- [ ] Tree-shakeable packages preferred
- [ ] No duplicate dependencies
- [ ] License compatibility

#### Development Dependencies
- [ ] Proper separation (devDependencies)
- [ ] Testing framework (vitest)
- [ ] Linting (eslint)
- [ ] Formatting (prettier)
- [ ] Type checking (typescript)
- [ ] Documentation (typedoc)

#### Optional Dependencies
- [ ] Properly marked as optional
- [ ] Graceful fallback if missing
- [ ] Clear documentation on optionals

#### Security
- [ ] Dependabot enabled
- [ ] npm audit clean
- [ ] No known vulnerabilities
- [ ] Regular security patches

### ServalSheets Files to Analyze
```
package.json
package-lock.json
.github/dependabot.yml
.github/workflows/security.yml
```

### Analysis Questions
1. How many production dependencies? (target: <20)
2. Is Dependabot configured?
3. Is npm audit clean?
4. Are there any deprecated packages?
5. Is the MCP SDK version current?
6. Are googleapis and zod versions current?
7. Are dev dependencies properly separated?
8. Are optional dependencies (redis) handled gracefully?

### Current Dependencies to Audit
```
Production:
- @modelcontextprotocol/sdk: ^1.25.2 (check for updates)
- googleapis: ^170.0.0 (check for updates)
- zod: 4.3.5 (check v4 migration status)
- express: ^5.2.1 (Express 5 - latest)
- winston: ^3.17.0 (logging)
- lru-cache: ^11.0.0 (caching)
- p-queue: ^9.0.1 (rate limiting)
- prom-client: ^15.1.3 (metrics)

Optional:
- redis: ^5.10.0 (session storage)

Dev:
- typescript: ^5.9.3 (latest)
- vitest: ^4.0.16 (latest)
- eslint: ^9.17.0 (latest)
```

---

## Category 21: MCP Tool Registration

### Best Practice Requirements

#### Tool Definition
- [ ] Unique tool names (sheets_*)
- [ ] Clear, action-oriented descriptions
- [ ] LLM-optimized description text
- [ ] Proper inputSchema (JSON Schema from Zod)
- [ ] Output schema defined
- [ ] Tool annotations (readOnly, destructive, etc.)

#### Registration Process
- [ ] Centralized registration (src/mcp/registration.ts)
- [ ] Automatic schema extraction
- [ ] Metadata generation (scripts/generate-metadata.ts)
- [ ] Drift detection (scripts/check-metadata-drift.sh)
- [ ] server.json validation

#### Tool Metadata
- [ ] Tool icons (SEP-973)
- [ ] Action counts accurate
- [ ] Version information
- [ ] Category grouping

#### Dynamic Registration
- [ ] tools/list returns all 26 tools
- [ ] tools/call routes to correct handler
- [ ] Schema validation before execution
- [ ] Error handling for unknown tools

### ServalSheets Files to Analyze
```
src/mcp/registration.ts
src/mcp/registration/*.ts (if modular)
src/schemas/index.ts (TOOL_REGISTRY)
src/schemas/annotations.ts
src/schemas/descriptions.ts
scripts/generate-metadata.ts
scripts/validate-tool-registry.ts
server.json
tests/integration/mcp-tools-list.test.ts
tests/contracts/schema-registration.test.ts
```

### Analysis Questions
1. Are all 26 tools registered correctly?
2. Is there automated metadata generation?
3. Is there drift detection between code and metadata?
4. Are tool descriptions LLM-optimized?
5. Are tool annotations present and accurate?
6. Is server.json valid and up-to-date?
7. Does tools/list return correct schemas?
8. Are action counts accurate per tool?

---

## Category 22: JSON-RPC 2.0 & MCP Protocol

### Best Practice Requirements

#### JSON-RPC Compliance
- [ ] jsonrpc: "2.0" in all messages
- [ ] Unique request IDs
- [ ] Proper error codes (-32600 to -32603, -32700)
- [ ] MCP-specific error codes (-32001, -32002, etc.)
- [ ] Batch request support (if applicable)

#### MCP Message Types
- [ ] Request/Response handling
- [ ] Notification handling
- [ ] Progress notifications
- [ ] Cancellation support

#### Transport Support
- [ ] STDIO transport
- [ ] Streamable HTTP transport
- [ ] SSE for streaming
- [ ] Proper content-type headers

#### Protocol Negotiation
- [ ] capabilities in initialize
- [ ] protocolVersion matching
- [ ] Feature negotiation

### ServalSheets Files to Analyze
```
src/server.ts
src/http-server.ts
src/remote-server.ts
src/mcp/response-builder.ts
src/core/errors.ts
tests/contracts/mcp-protocol.test.ts
tests/integration/http-transport.test.ts
```

### Analysis Questions
1. Are JSON-RPC error codes correct?
2. Is there proper request ID handling?
3. Are MCP-specific errors implemented?
4. Is STDIO transport working?
5. Is HTTP transport working?
6. Is protocol version negotiated correctly?
7. Are capabilities declared properly?
8. Is progress notification implemented?

---

## Category 23: Error Handling Architecture

### Best Practice Requirements

#### Error Classes
- [ ] Base McpError class
- [ ] Specific error types (ValidationError, AuthError, etc.)
- [ ] Error codes enum
- [ ] Error cause chaining
- [ ] Stack trace preservation

#### Error Responses
- [ ] Structured error format
- [ ] User-friendly messages
- [ ] Recovery suggestions
- [ ] Error context (tool, action, params)
- [ ] No sensitive data in errors

#### Error Recovery
- [ ] Retry logic for transient errors
- [ ] Circuit breaker for cascading failures
- [ ] Fallback strategies
- [ ] Graceful degradation

#### Error Logging
- [ ] Structured error logs
- [ ] Error aggregation
- [ ] Alert thresholds
- [ ] Correlation IDs

### ServalSheets Files to Analyze
```
src/core/errors.ts
src/utils/enhanced-errors.ts
src/utils/error-factory.ts
src/utils/error-messages.ts
src/utils/retry.ts
src/utils/circuit-breaker.ts
src/mcp/response-builder.ts
tests/helpers/error-codes.ts
```

### Analysis Questions
1. Are custom error classes defined?
2. Are error codes standardized?
3. Is error cause chaining used?
4. Are retry strategies implemented?
5. Is circuit breaker pattern used?
6. Are errors logged with context?
7. Are user-friendly messages provided?
8. Is sensitive data redacted from errors?

---

## Category 24: Testing Strategy

### Best Practice Requirements

#### Test Organization
- [ ] Unit tests (tests/unit/)
- [ ] Integration tests (tests/integration/)
- [ ] Contract tests (tests/contracts/)
- [ ] Property-based tests (tests/property/)
- [ ] Snapshot tests (tests/handlers/*.snapshot.test.ts)
- [ ] Handler tests (tests/handlers/)
- [ ] Service tests (tests/services/)

#### Coverage Targets
- [ ] Line coverage ≥75%
- [ ] Function coverage ≥75%
- [ ] Branch coverage ≥70%
- [ ] Statement coverage ≥75%

#### Test Quality
- [ ] Isolated tests (no shared state)
- [ ] Fast execution (<10s per test)
- [ ] Deterministic (no flaky tests)
- [ ] Proper mocking (google-api-mocks.ts)
- [ ] Test data factories (input-factories.ts)

#### Testing Tools
- [ ] Vitest as test runner
- [ ] v8 coverage provider
- [ ] fast-check for property tests
- [ ] supertest for HTTP tests

#### CI Integration
- [ ] Tests run on every PR
- [ ] Coverage reporting
- [ ] Snapshot updating process
- [ ] Integration test gates

### ServalSheets Files to Analyze
```
vitest.config.ts
tests/**/*.test.ts
tests/helpers/
coverage/
.github/workflows/ci.yml
```

### Analysis Questions
1. What is the current test count? (target: 1900+)
2. What is the current coverage percentage?
3. Are all handlers tested?
4. Are there property-based tests?
5. Are there contract tests for MCP protocol?
6. Is there a test data factory pattern?
7. Are mocks properly isolated?
8. How many tests are currently failing?

---

## Category 25: Build & Bundle System

### Best Practice Requirements

#### TypeScript Compilation
- [ ] Separate build config (tsconfig.build.json)
- [ ] Incremental compilation
- [ ] Source maps generated
- [ ] Declaration files generated
- [ ] Clean build script

#### Build Process
- [ ] Metadata generation before build
- [ ] Asset copying (knowledge files)
- [ ] Version injection
- [ ] Build validation

#### Output Structure
- [ ] dist/ directory
- [ ] Proper exports in package.json
- [ ] ESM output
- [ ] Type declarations (.d.ts)

#### Build Verification
- [ ] server.json validation
- [ ] Smoke test after build
- [ ] Import verification

### ServalSheets Files to Analyze
```
tsconfig.json
tsconfig.build.json
package.json (scripts, exports)
scripts/generate-metadata.ts
scripts/validate-server-json.mjs
```

### Analysis Questions
1. Is incremental compilation enabled?
2. Are source maps generated?
3. Are declaration files generated?
4. Is build verification automated?
5. Are exports properly configured?
6. Is the build process documented?
7. Is asset copying handled?
8. Is there a clean build script?

---

## Category 26: Documentation Quality

### Best Practice Requirements

#### Code Documentation
- [ ] JSDoc on all public APIs
- [ ] Parameter documentation
- [ ] Return type documentation
- [ ] Example code in comments
- [ ] @throws documentation

#### API Documentation
- [ ] TypeDoc generation
- [ ] OpenAPI/Swagger spec
- [ ] Tool usage examples
- [ ] Error code reference

#### User Documentation
- [ ] README.md complete
- [ ] QUICKSTART.md guide
- [ ] Installation guide
- [ ] Configuration reference
- [ ] Troubleshooting guide

#### Developer Documentation
- [ ] Architecture overview
- [ ] Contributing guide
- [ ] Testing guide
- [ ] Deployment guide

### ServalSheets Files to Analyze
```
README.md
QUICKSTART.md
docs/guides/
docs/api/
docs/examples/
typedoc.json
docs/openapi.json
CONTRIBUTING.md (if exists)
```

### Analysis Questions
1. Is README comprehensive?
2. Is TypeDoc configured and generating?
3. Are there usage examples for each tool?
4. Is there an OpenAPI spec?
5. Is there a SKILL.md for LLM guidance?
6. Are error codes documented?
7. Is deployment documented?
8. Is troubleshooting guide present?

---

## Category 27: Observability & Monitoring

### Best Practice Requirements

#### Logging
- [ ] Winston logger configured
- [ ] Log levels (debug, info, warn, error)
- [ ] Structured JSON logs
- [ ] Request correlation IDs
- [ ] Sensitive data redaction
- [ ] Dynamic log level changes

#### Metrics
- [ ] Prometheus client (prom-client)
- [ ] Request counters
- [ ] Latency histograms
- [ ] Error rate gauges
- [ ] Cache hit/miss rates
- [ ] API quota usage

#### Health Checks
- [ ] /health endpoint
- [ ] Liveness probe
- [ ] Readiness probe
- [ ] Dependency health checks

#### Tracing (if applicable)
- [ ] OpenTelemetry integration
- [ ] Span creation
- [ ] Context propagation

### ServalSheets Files to Analyze
```
src/utils/logger.ts
src/utils/logger-context.ts
src/utils/redact.ts
src/observability/metrics.ts
src/observability/otel-export.ts
src/server/health.ts
src/utils/tracing.ts
```

### Analysis Questions
1. Is Winston properly configured?
2. Are metrics exposed via Prometheus?
3. Is there a health endpoint?
4. Are correlation IDs used?
5. Is sensitive data redacted?
6. Are cache metrics tracked?
7. Is OpenTelemetry configured?
8. Is there a metrics dashboard guide?

---

## Category 28: CI/CD & DevOps

### Best Practice Requirements

#### GitHub Actions Workflows
- [ ] CI workflow (test, lint, build)
- [ ] Security workflow (npm audit, CodeQL)
- [ ] Docker workflow (build, push)
- [ ] Publish workflow (npm release)
- [ ] server.json validation workflow

#### Code Quality Gates
- [ ] All tests passing
- [ ] Coverage thresholds met
- [ ] Linting passing
- [ ] Type checking passing
- [ ] Security audit clean

#### Release Process
- [ ] Semantic versioning
- [ ] Changelog maintenance
- [ ] Git tags
- [ ] npm publish with provenance
- [ ] Docker image tagging

#### Deployment
- [ ] Docker support
- [ ] Environment configuration
- [ ] Health check integration
- [ ] Graceful shutdown

### ServalSheets Files to Analyze
```
.github/workflows/ci.yml
.github/workflows/security.yml
.github/workflows/docker.yml
.github/workflows/publish.yml
.github/workflows/validate-server-json.yml
.github/dependabot.yml
deployment/docker/Dockerfile
CHANGELOG.md
```

### Analysis Questions
1. Are all CI workflows passing?
2. Is Dependabot configured?
3. Is npm publish automated?
4. Is Docker build automated?
5. Is security scanning enabled?
6. Is semantic versioning followed?
7. Is changelog maintained?
8. Are deployment guides present?

---

## Category 29: Code Quality & Style

### Best Practice Requirements

#### Linting
- [ ] ESLint configured
- [ ] TypeScript rules enabled
- [ ] No-any rule enforced
- [ ] Unused variables caught
- [ ] Console warnings

#### Formatting
- [ ] Prettier configured
- [ ] Consistent formatting
- [ ] Format check in CI

#### Code Style
- [ ] Consistent naming conventions
- [ ] File organization standards
- [ ] Import ordering
- [ ] Max file length guidelines

### ServalSheets Files to Analyze
```
eslint.config.js
.prettierrc (if exists)
package.json (lint scripts)
```

### Analysis Questions
1. Is ESLint passing?
2. Is Prettier configured?
3. Is no-any enforced?
4. Are lint rules strict enough?
5. Is format checking in CI?

---

## Category 30: Configuration Management

### Best Practice Requirements

#### Environment Variables
- [ ] Zod validation for env vars
- [ ] .env.example template
- [ ] Secure defaults
- [ ] Required vs optional distinction
- [ ] Type coercion

#### Feature Flags
- [ ] MANAGED_AUTH for deployment modes
- [ ] Feature toggles
- [ ] Environment-specific behavior

#### Configuration Files
- [ ] server.json for MCP metadata
- [ ] inspector.json for debugging
- [ ] tsconfig.*.json for compilation

### ServalSheets Files to Analyze
```
src/config/env.ts
src/config/constants.ts
.env.example
server.json
inspector.json
```

### Analysis Questions
1. Are all env vars validated with Zod?
2. Is .env.example up-to-date?
3. Are defaults secure?
4. Is MANAGED_AUTH implemented?
5. Are feature flags documented?

---

## Category 31: Project Structure & Architecture

### Best Practice Requirements

#### Directory Structure
- [ ] src/ for source code
- [ ] tests/ for tests
- [ ] docs/ for documentation
- [ ] scripts/ for tooling
- [ ] deployment/ for DevOps

#### Module Organization
- [ ] handlers/ for tool implementations
- [ ] schemas/ for Zod schemas
- [ ] services/ for business logic
- [ ] utils/ for utilities
- [ ] core/ for framework code
- [ ] mcp/ for protocol code

#### Clean Architecture
- [ ] Separation of concerns
- [ ] Dependency injection patterns
- [ ] Interface-based design
- [ ] Testable modules

### ServalSheets Files to Analyze
```
src/ (directory structure)
src/index.ts (public exports)
package.json (exports field)
```

### Analysis Questions
1. Is the directory structure logical?
2. Are modules properly separated?
3. Is there circular dependency risk?
4. Are exports properly defined?
5. Is the architecture documented?

---

## Category 32: Performance Optimization

### Best Practice Requirements

#### Caching Strategy
- [ ] LRU cache for API responses
- [ ] Hot cache for frequent data
- [ ] Cache invalidation logic
- [ ] Cache hit rate tracking

#### Batching & Aggregation
- [ ] Request batching
- [ ] Batch aggregation
- [ ] Adaptive batch windows
- [ ] Parallel execution

#### Response Optimization
- [ ] Response size limits
- [ ] Pagination support
- [ ] Field selection
- [ ] Compression

### ServalSheets Files to Analyze
```
src/utils/cache-manager.ts
src/utils/hot-cache.ts
src/services/batching-system.ts
src/services/batch-aggregator.ts
src/services/parallel-executor.ts
src/handlers/values-optimized.ts
tests/benchmarks/
```

### Analysis Questions
1. What caching strategies are implemented?
2. Is batch aggregation working?
3. Are there performance benchmarks?
4. Is response optimization in place?
5. Is parallel execution implemented?

---

## Updated Scoring Matrix (Final)

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| **Original Categories (1-12)** | | | |
| 1. Authentication | 5% | /10 | |
| 2. Core Data Ops | 8% | /10 | |
| 3. Formatting | 3% | /10 | |
| 4. Data Rules | 3% | /10 | |
| 5. Visualization | 3% | /10 | |
| 6. Collaboration | 3% | /10 | |
| 7. Version Control | 3% | /10 | |
| 8. AI Analysis | 5% | /10 | |
| 9. Advanced | 3% | /10 | |
| 10. Safety | 5% | /10 | |
| 11. Orchestration | 2% | /10 | |
| 12. Security | 3% | /10 | |
| **API & Protocol (13-16)** | | | |
| 13. MCP 2025-11-25 Spec | 8% | /10 | |
| 14. Google Sheets API v4 | 5% | /10 | |
| 15. Google Drive API v3 | 3% | /10 | |
| 16. BigQuery/Connected | 2% | /10 | |
| **Technical Excellence (17-32)** | | | |
| 17. Zod Schema Architecture | 5% | /10 | |
| 18. TypeScript Excellence | 5% | /10 | |
| 19. Node.js Best Practices | 4% | /10 | |
| 20. Dependency Management | 3% | /10 | |
| 21. MCP Tool Registration | 4% | /10 | |
| 22. JSON-RPC & Protocol | 3% | /10 | |
| 23. Error Handling | 3% | /10 | |
| 24. Testing Strategy | 5% | /10 | |
| 25. Build & Bundle | 2% | /10 | |
| 26. Documentation | 3% | /10 | |
| 27. Observability | 3% | /10 | |
| 28. CI/CD & DevOps | 2% | /10 | |
| 29. Code Quality | 2% | /10 | |
| 30. Configuration | 2% | /10 | |
| 31. Project Structure | 2% | /10 | |
| 32. Performance | 3% | /10 | |
| **TOTAL** | 100% | | **/100** |

---

## Quick Reference: Key Files by Category

### Schema & Types
```
src/schemas/          - All Zod schemas
src/types/            - TypeScript types
src/schemas/index.ts  - TOOL_REGISTRY
```

### MCP Protocol
```
src/mcp/              - MCP implementation
src/server.ts         - STDIO server
src/http-server.ts    - HTTP server
server.json           - MCP metadata
```

### Core Services
```
src/services/         - Business logic
src/handlers/         - Tool handlers
src/core/             - Framework code
```

### Infrastructure
```
src/utils/            - Utilities
src/config/           - Configuration
src/observability/    - Metrics & logging
src/startup/          - Lifecycle
```

### Testing
```
tests/                - All tests
vitest.config.ts      - Test config
coverage/             - Coverage reports
```

### DevOps
```
.github/workflows/    - CI/CD
deployment/           - Docker, etc.
scripts/              - Build tools
```

---

## Final Output Format

Generate a comprehensive report with:

1. **Executive Summary** (2-3 paragraphs)
2. **Overall Score Card** (32 categories)
3. **Top 10 Strengths**
4. **Top 10 Critical Gaps**
5. **Priority Recommendations** (P0, P1, P2)
6. **Detailed Category Analysis** (32 sections)
7. **MCP Compliance Checklist** (all SEPs)
8. **Google API Coverage Matrix**
9. **Dependency Audit Results**
10. **Test Coverage Report**
11. **Security Audit Summary**
12. **Implementation Roadmap** (phases)
13. **Technical Debt Inventory**

---

## Usage Instructions

To run this analysis:

1. **Phase 1: Inventory** - Use tools to list and examine all relevant files
2. **Phase 2: Scoring** - Rate each category against criteria
3. **Phase 3: Deep Dive** - Analyze gaps and issues in detail
4. **Phase 4: Recommendations** - Generate prioritized action items
5. **Phase 5: Roadmap** - Create implementation plan

This creates a **world-class audit** of ServalSheets covering:
- ✅ 12 Functional categories (MCP server features)
- ✅ 4 API/Protocol categories (MCP, Sheets, Drive, BigQuery)
- ✅ 16 Technical categories (code quality, architecture, DevOps)
- ✅ **32 total evaluation dimensions**


---

# PART 3: Deep Technical Categories (33-50)

---

## Category 33: HTTP/2 & Transport Layer

### Best Practice Requirements

#### HTTP/2 Support
- [ ] HTTP/2 detection and upgrade
- [ ] Multiplexing support
- [ ] Header compression (HPACK)
- [ ] Server push (if applicable)
- [ ] Connection pooling
- [ ] Stream prioritization

#### Transport Options
- [ ] STDIO transport (MCP native)
- [ ] HTTP transport (Express 5)
- [ ] Streamable HTTP (SSE)
- [ ] WebSocket (if needed)

#### Connection Management
- [ ] Keep-alive configuration
- [ ] Connection timeout handling
- [ ] Graceful connection closure
- [ ] Connection health monitoring
- [ ] Retry on connection failure

#### TLS/SSL
- [ ] HTTPS support
- [ ] Certificate handling
- [ ] Secure headers (Helmet)

### ServalSheets Files to Analyze
```
src/http-server.ts
src/remote-server.ts
src/server.ts
src/utils/http2-detector.ts
src/utils/connection-health.ts
tests/integration/http2.test.ts
tests/integration/http-transport.test.ts
tests/benchmarks/http2-latency.test.ts
```

### Analysis Questions
1. Is HTTP/2 properly detected and used?
2. Is connection health monitored?
3. Are timeouts properly configured?
4. Is Helmet configured for security headers?
5. Is connection pooling implemented?
6. Are there HTTP/2 latency benchmarks?

---

## Category 34: Session & State Management

### Best Practice Requirements

#### Session Architecture
- [ ] Session store abstraction
- [ ] In-memory session storage
- [ ] Redis session support (optional)
- [ ] Session expiration/TTL
- [ ] Session isolation per user

#### State Management
- [ ] Stateless design preference
- [ ] State recovery after restart
- [ ] Distributed state (if clustered)
- [ ] Transaction state tracking

#### Session Context
- [ ] Active spreadsheet tracking
- [ ] User preferences storage
- [ ] Operation history per session
- [ ] Context propagation

#### Session Limits
- [ ] Max sessions per user
- [ ] Session size limits
- [ ] Rate limiting per session
- [ ] Cleanup of stale sessions

### ServalSheets Files to Analyze
```
src/storage/session-store.ts
src/storage/session-manager.ts
src/services/session-context.ts
src/handlers/session.ts
src/utils/session-limiter.ts
src/utils/request-context.ts
tests/storage/session-store.test.ts
```

### Analysis Questions
1. Is there session store abstraction?
2. Is Redis optional for sessions?
3. Are sessions isolated per user?
4. Is session TTL configured?
5. Is there session rate limiting?
6. Can sessions be recovered after restart?

---

## Category 35: Caching Architecture

### Best Practice Requirements

#### Cache Layers
- [ ] L1 cache (in-memory, hot cache)
- [ ] L2 cache (LRU, longer TTL)
- [ ] Optional L3 (Redis, distributed)
- [ ] Cache factory pattern
- [ ] Cache integration layer

#### Cache Strategies
- [ ] Read-through caching
- [ ] Write-through/write-behind
- [ ] Cache invalidation on writes
- [ ] TTL-based expiration
- [ ] LRU eviction policy

#### Cache Keys
- [ ] Consistent key generation
- [ ] Key namespacing
- [ ] Key compression (if large)

#### Cache Metrics
- [ ] Hit rate tracking
- [ ] Miss rate tracking
- [ ] Size monitoring
- [ ] Eviction counting

### ServalSheets Files to Analyze
```
src/utils/cache-factory.ts
src/utils/cache-manager.ts
src/utils/cache-store.ts
src/utils/cache-integration.ts
src/utils/hot-cache.ts
src/services/capability-cache.ts
src/resources/cache.ts
tests/unit/cache-*.test.ts
```

### Analysis Questions
1. How many cache layers exist?
2. Is there a cache factory pattern?
3. What is the cache hit rate?
4. Is cache invalidation working?
5. Are cache metrics exposed?
6. Is distributed caching supported?

---

## Category 36: Request Processing Pipeline

### Best Practice Requirements

#### Request Context
- [ ] Correlation ID generation
- [ ] Request timing tracking
- [ ] User context propagation
- [ ] Request metadata capture

#### Request Deduplication
- [ ] Duplicate request detection
- [ ] In-flight request coalescing
- [ ] Idempotency key support
- [ ] Dedup window configuration

#### Request Merging
- [ ] Batch request aggregation
- [ ] Merge window timing
- [ ] Merge compatibility rules
- [ ] Merged result splitting

#### Request Validation
- [ ] Schema validation
- [ ] Size limits
- [ ] Rate limiting
- [ ] Authorization checks

### ServalSheets Files to Analyze
```
src/utils/request-context.ts
src/utils/request-deduplication.ts
src/services/request-merger.ts
src/services/batch-aggregator.ts
tests/unit/request-*.test.ts
```

### Analysis Questions
1. Is request context propagated?
2. Is request deduplication working?
3. Is request merging implemented?
4. Are correlation IDs generated?
5. Is there request timing tracking?
6. Are merged results correctly split?

---

## Category 37: Response Optimization

### Best Practice Requirements

#### Response Enhancement
- [ ] Consistent response format
- [ ] Success/error wrapper
- [ ] Metadata inclusion
- [ ] Timing information
- [ ] Cache hints

#### Response Optimization
- [ ] Response size limits
- [ ] Truncation with markers
- [ ] Pagination support
- [ ] Field selection/filtering
- [ ] Compression (if large)

#### Response Building
- [ ] MCP response builder
- [ ] Structured output format
- [ ] Error response formatting
- [ ] Progress response handling

### ServalSheets Files to Analyze
```
src/utils/response-enhancer.ts
src/utils/response-optimizer.ts
src/mcp/response-builder.ts
tests/mcp/response-builder.test.ts
```

### Analysis Questions
1. Is there consistent response formatting?
2. Are responses size-limited?
3. Is pagination implemented?
4. Are progress responses handled?
5. Is structured output used?
6. Are responses optimized for LLMs?

---

## Category 38: CLI & User Interface

### Best Practice Requirements

#### CLI Design
- [ ] Clear command structure
- [ ] Help text for all commands
- [ ] Version flag (--version)
- [ ] Verbose/debug modes
- [ ] Color output (with disable option)
- [ ] Interactive prompts where needed

#### Auth Setup CLI
- [ ] Guided OAuth setup
- [ ] Credential validation
- [ ] Token refresh command
- [ ] Logout/clear command

#### Server CLI
- [ ] Start server command
- [ ] Configuration options
- [ ] Port selection
- [ ] Transport selection

#### Developer Experience
- [ ] Clear error messages
- [ ] Progress indicators
- [ ] Success confirmations
- [ ] Troubleshooting hints

### ServalSheets Files to Analyze
```
src/cli.ts
src/cli/index.ts
src/cli/auth-setup.ts
package.json (bin field)
```

### Analysis Questions
1. Is there a clean CLI interface?
2. Is --version working?
3. Is auth setup guided?
4. Are error messages helpful?
5. Is there interactive mode?
6. Is CLI documented in README?

---

## Category 39: Knowledge Base & AI Context

### Best Practice Requirements

#### Knowledge Organization
- [ ] API documentation (api/)
- [ ] Formula references (formulas/)
- [ ] Templates (templates/)
- [ ] Schemas (schemas/)
- [ ] Patterns (workflow, UI/UX)

#### Knowledge Content
- [ ] Quota/limit information
- [ ] Formula antipatterns
- [ ] User intent examples
- [ ] Confirmation guides
- [ ] Natural language guides

#### Template Library
- [ ] CRM templates
- [ ] Finance templates
- [ ] Inventory templates
- [ ] Project templates
- [ ] Marketing templates
- [ ] Sales templates

#### Knowledge Loading
- [ ] Lazy loading
- [ ] Caching
- [ ] Resource exposure

### ServalSheets Files to Analyze
```
src/knowledge/
src/knowledge/api/
src/knowledge/formulas/
src/knowledge/templates/
src/knowledge/schemas/
src/resources/knowledge.ts
```

### Analysis Questions
1. Is knowledge base comprehensive?
2. Are templates production-ready?
3. Is quota information accurate?
4. Are user intent examples sufficient?
5. Is knowledge exposed as resources?
6. Is natural language guide complete?

---

## Category 40: Predictive & Intelligent Features

### Best Practice Requirements

#### Access Pattern Tracking
- [ ] Track frequently accessed ranges
- [ ] Identify usage patterns
- [ ] Predict future accesses
- [ ] Pattern-based prefetching

#### Prefetch System
- [ ] Predictive data loading
- [ ] Background prefetching
- [ ] Prefetch priority queue
- [ ] Prefetch hit rate tracking

#### Smart Context
- [ ] Contextual suggestions
- [ ] Auto-completion hints
- [ ] Relevant resource loading
- [ ] Adaptive behavior

#### Semantic Understanding
- [ ] Natural language parsing
- [ ] Intent classification
- [ ] Semantic range resolution
- [ ] Context-aware responses

### ServalSheets Files to Analyze
```
src/services/prefetch-predictor.ts
src/services/prefetching-system.ts
src/services/access-pattern-tracker.ts
src/services/smart-context.ts
src/services/semantic-range.ts
src/core/intent.ts
tests/unit/prefetch-predictor.test.ts
```

### Analysis Questions
1. Is access pattern tracking implemented?
2. Is prefetching working?
3. What's the prefetch hit rate?
4. Is semantic range resolution working?
5. Is intent classification implemented?
6. Are suggestions context-aware?

---

## Category 41: MCP Resources System

### Best Practice Requirements

#### Resource Types
- [ ] Static resources
- [ ] Dynamic resources
- [ ] Template resources
- [ ] Knowledge resources

#### Resource Operations
- [ ] resources/list implementation
- [ ] resources/read implementation
- [ ] Resource subscriptions (if applicable)
- [ ] Resource URIs (mcp:// scheme)

#### Resource Categories
- [ ] Analysis resources
- [ ] Cache resources
- [ ] Chart resources
- [ ] Confirmation resources
- [ ] History resources
- [ ] Metrics resources
- [ ] Quality resources
- [ ] Validation resources

#### Resource Documentation
- [ ] Clear resource names
- [ ] Accurate descriptions
- [ ] MIME types specified
- [ ] Usage examples

### ServalSheets Files to Analyze
```
src/resources/index.ts
src/resources/analyze.ts
src/resources/cache.ts
src/resources/charts.ts
src/resources/confirm.ts
src/resources/history.ts
src/resources/metrics.ts
src/resources/quality.ts
src/resources/reference.ts
src/resources/validation.ts
src/resources/knowledge.ts
```

### Analysis Questions
1. How many resources are registered?
2. Are all resources documented?
3. Is resources/list working?
4. Is resources/read working?
5. Are URIs properly formatted?
6. Are MIME types correct?

---

## Category 42: MCP Prompts System

### Best Practice Requirements

#### Prompt Organization
- [ ] Clear prompt names
- [ ] Descriptive prompts
- [ ] Parameterized prompts
- [ ] Example usage

#### Prompt Categories
- [ ] Analysis prompts
- [ ] Workflow prompts
- [ ] Template prompts
- [ ] Help prompts

#### Prompt Features
- [ ] prompts/list implementation
- [ ] prompts/get implementation
- [ ] Argument definitions
- [ ] Default values

### ServalSheets Files to Analyze
```
src/schemas/prompts.ts
src/mcp/registration.ts
```

### Analysis Questions
1. How many prompts are registered?
2. Are prompts parameterized?
3. Are prompts documented?
4. Is prompts/list working?
5. Is prompts/get working?
6. Are there workflow prompts?

---

## Category 43: Diff Engine & Change Detection

### Best Practice Requirements

#### Diff Capabilities
- [ ] Cell value diffs
- [ ] Format diffs
- [ ] Structure diffs
- [ ] Formula diffs

#### Change Detection
- [ ] External change detection
- [ ] Conflict identification
- [ ] Version comparison
- [ ] Merge strategies

#### Diff Output
- [ ] Human-readable diffs
- [ ] Machine-parseable diffs
- [ ] Summary statistics
- [ ] Change highlighting

### ServalSheets Files to Analyze
```
src/core/diff-engine.ts
src/services/conflict-detector.ts
tests/unit/diff-engine.test.ts
```

### Analysis Questions
1. Is diff engine implemented?
2. Can value diffs be generated?
3. Is conflict detection working?
4. Are external changes detected?
5. Is diff output readable?
6. Are merge strategies implemented?

---

## Category 44: Policy Enforcement

### Best Practice Requirements

#### Access Policies
- [ ] Tool enable/disable
- [ ] Action allowlisting
- [ ] Rate limit policies
- [ ] Size limit policies

#### Safety Policies
- [ ] Confirmation thresholds
- [ ] Dry-run enforcement
- [ ] Snapshot policies
- [ ] Rollback policies

#### Policy Configuration
- [ ] Environment-based policies
- [ ] User-based policies
- [ ] Runtime policy changes
- [ ] Policy logging

### ServalSheets Files to Analyze
```
src/core/policy-enforcer.ts
src/services/confirmation-policy.ts
tests/core/policy-enforcer.test.ts
```

### Analysis Questions
1. Is policy enforcement implemented?
2. Can tools be disabled?
3. Are rate limits enforced?
4. Are confirmation thresholds configurable?
5. Is dry-run enforceable?
6. Are policies logged?

---

## Category 45: Safety & Dry-Run System

### Best Practice Requirements

#### Dry-Run Mode
- [ ] Preview without execution
- [ ] Impact estimation
- [ ] Affected cells count
- [ ] Formula dependencies
- [ ] Rollback plan

#### Safety Helpers
- [ ] Input sanitization
- [ ] Size validation
- [ ] Range validation
- [ ] Permission checking

#### Effect Scope
- [ ] Track operation effects
- [ ] Scope boundaries
- [ ] Cascading effects
- [ ] Side effect detection

### ServalSheets Files to Analyze
```
src/utils/safety-helpers.ts
tests/safety/dry-run.test.ts
tests/safety/effect-scope.test.ts
```

### Analysis Questions
1. Is dry-run implemented?
2. Are safety helpers comprehensive?
3. Is effect scope tracked?
4. Are cascading effects detected?
5. Is rollback plan generated?
6. Is input sanitized?

---

## Category 46: Payload Monitoring

### Best Practice Requirements

#### Size Monitoring
- [ ] Request size tracking
- [ ] Response size tracking
- [ ] Payload limits
- [ ] Size alerts

#### Content Monitoring
- [ ] Sensitive data detection
- [ ] PII scanning
- [ ] Token detection
- [ ] Secret detection

#### Rate Monitoring
- [ ] Request rate tracking
- [ ] Burst detection
- [ ] Rate limit enforcement
- [ ] Rate alerts

### ServalSheets Files to Analyze
```
src/utils/payload-monitor.ts
src/core/rate-limiter.ts
```

### Analysis Questions
1. Is payload size monitored?
2. Are size limits enforced?
3. Is sensitive data detected?
4. Is rate monitored?
5. Are alerts configured?
6. Is PII scanning implemented?

---

## Category 47: SDK Compatibility Layer

### Best Practice Requirements

#### MCP SDK Compatibility
- [ ] SDK version tracking
- [ ] Breaking change handling
- [ ] Deprecation warnings
- [ ] Feature detection

#### Schema Compatibility
- [ ] Zod version compatibility
- [ ] Schema migration
- [ ] Backward compatibility
- [ ] Forward compatibility

#### API Compatibility
- [ ] Google API versioning
- [ ] Deprecated API handling
- [ ] Version negotiation
- [ ] Fallback strategies

### ServalSheets Files to Analyze
```
src/mcp/sdk-compat.ts
src/utils/schema-compat.ts
package.json (SDK version)
```

### Analysis Questions
1. Is SDK compatibility managed?
2. Are breaking changes handled?
3. Is schema migration supported?
4. Are deprecated APIs handled?
5. Is version detection implemented?
6. Are fallbacks configured?

---

## Category 48: Tracing & Distributed Context

### Best Practice Requirements

#### Trace Context
- [ ] Trace ID generation
- [ ] Span creation
- [ ] Context propagation
- [ ] Parent-child spans

#### OpenTelemetry
- [ ] OTEL SDK integration
- [ ] Span exporters
- [ ] Metrics exporters
- [ ] Log correlation

#### Trace Visualization
- [ ] Trace export
- [ ] Trace sampling
- [ ] Performance analysis

### ServalSheets Files to Analyze
```
src/utils/tracing.ts
src/observability/otel-export.ts
src/utils/logger-context.ts
```

### Analysis Questions
1. Is tracing implemented?
2. Is OpenTelemetry integrated?
3. Are spans properly created?
4. Is context propagated?
5. Are traces exportable?
6. Is sampling configured?

---

## Category 49: Server Manifest & Discovery

### Best Practice Requirements

#### server.json Structure
- [ ] Name and version
- [ ] Description
- [ ] Icons (SEP-973)
- [ ] Capabilities list
- [ ] Tool metadata
- [ ] Author information
- [ ] Repository links

#### Well-Known Discovery
- [ ] /.well-known/mcp endpoint
- [ ] Capability advertisement
- [ ] Version information
- [ ] Server metadata

#### Manifest Validation
- [ ] JSON schema validation
- [ ] Required fields check
- [ ] Version consistency
- [ ] Tool count accuracy

### ServalSheets Files to Analyze
```
server.json
src/server/well-known.ts
scripts/validate-server-json.mjs
tests/server/well-known.test.ts
```

### Analysis Questions
1. Is server.json complete?
2. Is icon specified?
3. Are capabilities accurate?
4. Is well-known endpoint working?
5. Is manifest validated in CI?
6. Is version consistent?

---

## Category 50: Batch Compilation & Optimization

### Best Practice Requirements

#### Batch Compiler
- [ ] Request compilation
- [ ] Optimization passes
- [ ] Deduplication
- [ ] Ordering optimization

#### Batch Aggregation
- [ ] Time-window batching
- [ ] Adaptive windows
- [ ] Batch size limits
- [ ] Priority handling

#### Parallel Execution
- [ ] Parallel request execution
- [ ] Dependency analysis
- [ ] Result aggregation
- [ ] Error isolation

### ServalSheets Files to Analyze
```
src/core/batch-compiler.ts
src/services/batch-aggregator.ts
src/services/batching-system.ts
src/services/parallel-executor.ts
tests/unit/batch-*.test.ts
tests/services/batching-system.test.ts
```

### Analysis Questions
1. Is batch compilation working?
2. Is adaptive batching implemented?
3. What's the batch efficiency?
4. Is parallel execution working?
5. Are dependencies analyzed?
6. Are errors isolated per request?

---

## Category 51: Range Resolution & A1 Notation

### Best Practice Requirements

#### Range Parsing
- [ ] A1 notation parsing
- [ ] R1C1 notation parsing
- [ ] Named range resolution
- [ ] Cross-sheet references
- [ ] Range validation

#### Range Operations
- [ ] Range expansion
- [ ] Range intersection
- [ ] Range union
- [ ] Range normalization

#### Semantic Ranges
- [ ] Header-based ranges
- [ ] Column name lookup
- [ ] Dynamic range detection
- [ ] Table detection

### ServalSheets Files to Analyze
```
src/core/range-resolver.ts
src/services/semantic-range.ts
src/utils/google-sheets-helpers.ts
tests/core/range-resolver.test.ts
```

### Analysis Questions
1. Is A1 notation fully supported?
2. Is R1C1 notation supported?
3. Are named ranges resolved?
4. Is semantic range working?
5. Are cross-sheet refs handled?
6. Is range validation comprehensive?

---

## Category 52: Task Management & Async Operations

### Best Practice Requirements

#### Task Store
- [ ] In-memory task store
- [ ] Redis task store (optional)
- [ ] Task store adapter pattern
- [ ] Task store factory

#### Task Lifecycle
- [ ] Task creation
- [ ] Task status tracking
- [ ] Task result retrieval
- [ ] Task cancellation
- [ ] Task cleanup

#### Task States
- [ ] PENDING
- [ ] RUNNING/WORKING
- [ ] INPUT_REQUIRED
- [ ] COMPLETED
- [ ] FAILED
- [ ] CANCELLED

### ServalSheets Files to Analyze
```
src/core/task-store.ts
src/core/task-store-adapter.ts
src/core/task-store-factory.ts
src/services/task-manager.ts
tests/core/task-store.test.ts
tests/core/redis-task-store.test.ts
tests/integration/task-endpoints.test.ts
```

### Analysis Questions
1. Is task store implemented?
2. Is Redis task store optional?
3. Are all task states supported?
4. Is task cancellation working?
5. Are tasks cleaned up properly?
6. Is task status polling working?

---

## Category 53: Token Management & OAuth

### Best Practice Requirements

#### Token Storage
- [ ] Encrypted storage (AES-256-GCM)
- [ ] Secure file permissions
- [ ] Token isolation per user
- [ ] Token versioning

#### Token Lifecycle
- [ ] Token acquisition
- [ ] Token refresh
- [ ] Token validation
- [ ] Token revocation

#### Token Security
- [ ] Never expose to LLM
- [ ] Redact from logs
- [ ] Secure transmission
- [ ] Token rotation

### ServalSheets Files to Analyze
```
src/services/token-store.ts
src/services/token-manager.ts
src/utils/auth-guard.ts
src/oauth-provider.ts
tests/services/token-store.test.ts
tests/unit/token-manager.test.ts
```

### Analysis Questions
1. Is token encryption implemented?
2. Is token refresh working?
3. Are tokens redacted from logs?
4. Is token isolation enforced?
5. Is OAuth provider complete?
6. Are tokens securely stored?

---

## Category 54: Startup & Lifecycle Management

### Best Practice Requirements

#### Startup Sequence
- [ ] Configuration validation
- [ ] Service initialization order
- [ ] Health check registration
- [ ] Ready signal

#### Shutdown Sequence
- [ ] Graceful shutdown
- [ ] Connection draining
- [ ] State persistence
- [ ] Cleanup handlers

#### Signal Handling
- [ ] SIGTERM handling
- [ ] SIGINT handling
- [ ] Uncaught exception handling
- [ ] Unhandled rejection handling

### ServalSheets Files to Analyze
```
src/startup/lifecycle.ts
src/startup/index.ts
src/server.ts (signal handling)
tests/startup/lifecycle.test.ts
```

### Analysis Questions
1. Is startup sequence defined?
2. Is graceful shutdown implemented?
3. Are signals properly handled?
4. Is uncaught exception handling present?
5. Is ready signal emitted?
6. Is cleanup performed on shutdown?

---

## Category 55: Retry & Circuit Breaker Patterns

### Best Practice Requirements

#### Retry Strategy
- [ ] Exponential backoff
- [ ] Jitter for thundering herd
- [ ] Max retries limit
- [ ] Retry-after header respect
- [ ] Retry budget

#### Circuit Breaker
- [ ] Failure threshold
- [ ] Open/half-open/closed states
- [ ] Recovery timeout
- [ ] Fallback handlers
- [ ] State monitoring

### ServalSheets Files to Analyze
```
src/utils/retry.ts
src/utils/circuit-breaker.ts
tests/utils/retry.test.ts
tests/unit/circuit-breaker-fallback.test.ts
```

### Analysis Questions
1. Is exponential backoff implemented?
2. Is jitter added to retries?
3. Is circuit breaker implemented?
4. Are fallbacks configured?
5. Is retry budget enforced?
6. Is state monitored?

---

## Category 56: Infrastructure & Health Monitoring

### Best Practice Requirements

#### Health Endpoints
- [ ] /health for liveness
- [ ] /ready for readiness
- [ ] /metrics for Prometheus
- [ ] /info for server info

#### Dependency Health
- [ ] Google API connectivity
- [ ] Cache health
- [ ] Session store health
- [ ] Database health (if any)

#### Infrastructure Utils
- [ ] Environment detection
- [ ] Platform detection
- [ ] Resource monitoring

### ServalSheets Files to Analyze
```
src/utils/infrastructure.ts
src/server/health.ts
src/utils/connection-health.ts
```

### Analysis Questions
1. Are health endpoints implemented?
2. Is readiness probe working?
3. Is liveness probe working?
4. Are dependencies health-checked?
5. Is metrics endpoint exposed?
6. Is infrastructure info available?

---

## Category 57: NPM Package Quality

### Best Practice Requirements

#### Package Structure
- [ ] Correct main/types/exports
- [ ] Minimal package size
- [ ] Proper files field
- [ ] No unnecessary files
- [ ] Source maps excluded

#### Package Metadata
- [ ] Name and version
- [ ] Description
- [ ] Keywords (for discovery)
- [ ] Author and license
- [ ] Repository links
- [ ] Homepage

#### Publishing
- [ ] Provenance enabled
- [ ] Public access
- [ ] Semantic versioning
- [ ] Changelog

#### Tree-Shaking
- [ ] ESM exports
- [ ] sideEffects field (if needed)
- [ ] Minimal bundle impact

### ServalSheets Files to Analyze
```
package.json
.npmignore
.gitignore
README.md (badges)
```

### Analysis Questions
1. Is package size reasonable?
2. Is provenance enabled?
3. Are keywords comprehensive?
4. Is exports field correct?
5. Is tree-shaking supported?
6. Is changelog maintained?

---

## Category 58: Version Management

### Best Practice Requirements

#### Versioning
- [ ] Semantic versioning (semver)
- [ ] Version in package.json
- [ ] Version in server.json
- [ ] Version export (version.ts)
- [ ] Consistent across files

#### Changelog
- [ ] CHANGELOG.md maintained
- [ ] Version sections
- [ ] Breaking changes highlighted
- [ ] Migration guides

#### Git Tags
- [ ] Tags for releases
- [ ] Annotated tags
- [ ] Tag naming convention

### ServalSheets Files to Analyze
```
package.json (version)
server.json (version)
src/version.ts
CHANGELOG.md
```

### Analysis Questions
1. Is versioning consistent?
2. Is changelog up-to-date?
3. Are breaking changes documented?
4. Are git tags used?
5. Is version.ts accurate?
6. Is migration documented?

---

## Category 59: Multi-Tenant Isolation

### Best Practice Requirements

#### User Isolation
- [ ] Per-user sessions
- [ ] Per-user rate limits
- [ ] Per-user quotas
- [ ] Per-user caching

#### Data Isolation
- [ ] No cross-user data leakage
- [ ] Token isolation
- [ ] Context isolation
- [ ] History isolation

#### Resource Limits
- [ ] Per-tenant limits
- [ ] Fair scheduling
- [ ] Priority handling

### ServalSheets Files to Analyze
```
src/services/session-context.ts
src/utils/session-limiter.ts
src/core/rate-limiter.ts
```

### Analysis Questions
1. Is user isolation enforced?
2. Are rate limits per-user?
3. Is data leakage prevented?
4. Are tokens isolated?
5. Is context isolated?
6. Are resources fair-shared?

---

## Category 60: Backup & Recovery

### Best Practice Requirements

#### Snapshot System
- [ ] Automatic snapshots
- [ ] Manual snapshot creation
- [ ] Snapshot naming
- [ ] Snapshot storage
- [ ] Snapshot cleanup

#### Recovery
- [ ] Rollback capability
- [ ] Point-in-time recovery
- [ ] Recovery verification
- [ ] Recovery logging

### ServalSheets Files to Analyze
```
src/services/snapshot.ts
src/handlers/versions.ts
tests/services/snapshot.test.ts
```

### Analysis Questions
1. Is snapshot system implemented?
2. Are auto-snapshots working?
3. Is rollback functional?
4. Is recovery verified?
5. Are snapshots cleaned up?
6. Is snapshot naming consistent?

---

## FINAL Scoring Matrix (60 Categories)

| # | Category | Weight | Score |
|---|----------|--------|-------|
| **Functional (1-12)** | | 46% | |
| 1 | Authentication | 5% | /10 |
| 2 | Core Data Ops | 8% | /10 |
| 3 | Formatting | 3% | /10 |
| 4 | Data Rules | 3% | /10 |
| 5 | Visualization | 3% | /10 |
| 6 | Collaboration | 3% | /10 |
| 7 | Version Control | 3% | /10 |
| 8 | AI Analysis | 5% | /10 |
| 9 | Advanced | 3% | /10 |
| 10 | Safety | 5% | /10 |
| 11 | Orchestration | 2% | /10 |
| 12 | Security | 3% | /10 |
| **APIs (13-16)** | | 18% | |
| 13 | MCP 2025-11-25 | 8% | /10 |
| 14 | Sheets API v4 | 5% | /10 |
| 15 | Drive API v3 | 3% | /10 |
| 16 | BigQuery | 2% | /10 |
| **Code Quality (17-32)** | | 36% | |
| 17 | Zod Schemas | 4% | /10 |
| 18 | TypeScript | 4% | /10 |
| 19 | Node.js | 3% | /10 |
| 20 | Dependencies | 2% | /10 |
| 21 | Registration | 3% | /10 |
| 22 | JSON-RPC | 2% | /10 |
| 23 | Error Handling | 3% | /10 |
| 24 | Testing | 4% | /10 |
| 25 | Build System | 2% | /10 |
| 26 | Documentation | 3% | /10 |
| 27 | Observability | 2% | /10 |
| 28 | CI/CD | 2% | /10 |
| 29 | Code Style | 1% | /10 |
| 30 | Configuration | 1% | /10 |
| **Deep Technical (33-60)** | | BONUS | |
| 33 | HTTP/2 Transport | +1% | /10 |
| 34 | Session State | +1% | /10 |
| 35 | Caching | +2% | /10 |
| 36 | Request Pipeline | +1% | /10 |
| 37 | Response Optimization | +1% | /10 |
| 38 | CLI Interface | +0.5% | /10 |
| 39 | Knowledge Base | +1% | /10 |
| 40 | Predictive Features | +1% | /10 |
| 41 | MCP Resources | +1% | /10 |
| 42 | MCP Prompts | +0.5% | /10 |
| 43 | Diff Engine | +0.5% | /10 |
| 44 | Policy Enforcement | +0.5% | /10 |
| 45 | Dry-Run System | +0.5% | /10 |
| 46 | Payload Monitor | +0.5% | /10 |
| 47 | SDK Compat | +0.5% | /10 |
| 48 | Tracing | +0.5% | /10 |
| 49 | Server Manifest | +0.5% | /10 |
| 50 | Batch Compiler | +1% | /10 |
| 51 | Range Resolver | +0.5% | /10 |
| 52 | Task Management | +1% | /10 |
| 53 | Token Management | +1% | /10 |
| 54 | Lifecycle | +0.5% | /10 |
| 55 | Retry/Circuit | +0.5% | /10 |
| 56 | Health Monitor | +0.5% | /10 |
| 57 | NPM Quality | +0.5% | /10 |
| 58 | Versioning | +0.5% | /10 |
| 59 | Multi-Tenant | +0.5% | /10 |
| 60 | Backup/Recovery | +0.5% | /10 |

**Base: 100% | Bonus: +20% | Max Possible: 120%**

---

## Complete File Inventory

### Core Source Files (~150 files)
```
src/
├── cli/                 (3 files) - CLI interface
├── config/              (3 files) - Configuration
├── core/                (10 files) - Core framework
├── handlers/            (29 files) - Tool handlers
├── knowledge/           (25+ files) - AI knowledge base
├── mcp/                 (9 files) - MCP protocol
├── observability/       (3 files) - Metrics/logging
├── resources/           (14 files) - MCP resources
├── schemas/             (32 files) - Zod schemas
├── security/            (3 files) - Security layer
├── server/              (2 files) - Health/well-known
├── services/            (30 files) - Business logic
├── startup/             (2 files) - Lifecycle
├── storage/             (3 files) - Session storage
├── types/               (7 files) - TypeScript types
├── utils/               (35 files) - Utilities
└── *.ts                 (6 files) - Entry points
```

### Test Files (~120 files)
```
tests/
├── benchmarks/          (1 file)
├── config/              (2 files)
├── contracts/           (4 files)
├── core/                (5 files)
├── handlers/            (30 files)
├── helpers/             (7 files)
├── integration/         (8 files)
├── mcp/                 (1 file)
├── property/            (2 files)
├── safety/              (2 files)
├── schemas/             (1 file)
├── security/            (1 file)
├── server/              (1 file)
├── services/            (18 files)
├── startup/             (1 file)
├── storage/             (1 file)
├── unit/                (20 files)
└── utils/               (2 files)
```

### Configuration Files
```
package.json
package-lock.json
tsconfig.json
tsconfig.build.json
tsconfig.eslint.json
vitest.config.ts
eslint.config.js
typedoc.json
server.json
inspector.json
.env.example
```

### DevOps Files
```
.github/workflows/ci.yml
.github/workflows/security.yml
.github/workflows/docker.yml
.github/workflows/publish.yml
.github/dependabot.yml
deployment/docker/Dockerfile
```

---

## Final Report Structure

1. **Executive Summary** (500 words)
2. **Score Dashboard** (60 categories)
3. **Compliance Matrices**
   - MCP 2025-11-25 SEP compliance
   - Google Sheets API v4 coverage
   - Google Drive API v3 coverage
4. **Top 15 Strengths**
5. **Top 15 Gaps**
6. **Critical Issues** (P0)
7. **High Priority** (P1)
8. **Medium Priority** (P2)
9. **Low Priority** (P3)
10. **Technical Debt Inventory**
11. **Dependency Audit**
12. **Security Assessment**
13. **Performance Profile**
14. **Test Coverage Analysis**
15. **Implementation Roadmap**
    - Phase 1: Critical fixes (1 week)
    - Phase 2: High priority (2 weeks)
    - Phase 3: Medium priority (1 month)
    - Phase 4: Polish (ongoing)
16. **Appendices**
    - A: Complete file inventory
    - B: API coverage matrix
    - C: Test coverage report
    - D: Benchmark results


---

# PART 4: Excellence & Production-Readiness (61-80)

---

## Category 61: Developer Experience (DX)

### Best Practice Requirements

#### Onboarding
- [ ] Quick start guide (<5 min setup)
- [ ] Example configurations
- [ ] Copy-paste commands
- [ ] Troubleshooting FAQ
- [ ] Video tutorials (optional)

#### Development Workflow
- [ ] Hot reload in dev mode (tsx watch)
- [ ] Fast test execution
- [ ] Clear error messages
- [ ] Debug mode with verbose logging
- [ ] Inspector integration

#### IDE Support
- [ ] TypeScript IntelliSense
- [ ] ESLint integration
- [ ] Prettier integration
- [ ] VSCode settings (.vscode/)
- [ ] Debug configurations

#### Extension Points
- [ ] Clear module boundaries
- [ ] Plugin architecture (if applicable)
- [ ] Custom handler support
- [ ] Middleware hooks

### ServalSheets Files to Analyze
```
QUICKSTART.md
README.md
.vscode/
inspector.json
package.json (scripts)
examples/
```

### Analysis Questions
1. How long does initial setup take?
2. Is hot reload working?
3. Are debug configs provided?
4. Is Inspector integration documented?
5. Are examples runnable?
6. Is the contribution guide clear?

---

## Category 62: API Design Consistency

### Best Practice Requirements

#### Naming Conventions
- [ ] Consistent action names (get, create, update, delete)
- [ ] Consistent parameter names across tools
- [ ] Predictable response structure
- [ ] Clear error naming

#### Parameter Patterns
- [ ] spreadsheetId always first
- [ ] Optional params clearly marked
- [ ] Default values documented
- [ ] Type consistency (string IDs)

#### Response Patterns
- [ ] Success wrapper consistent
- [ ] Error format consistent
- [ ] Metadata included
- [ ] Pagination consistent

#### Discoverability
- [ ] Self-documenting APIs
- [ ] Examples in descriptions
- [ ] Related tools referenced

### ServalSheets Files to Analyze
```
src/schemas/*.ts (parameter naming)
src/handlers/*.ts (response structure)
src/mcp/response-builder.ts
```

### Analysis Questions
1. Are action names consistent across tools?
2. Are parameter names consistent?
3. Is response format predictable?
4. Are defaults documented?
5. Is pagination consistent?
6. Are related tools cross-referenced?

---

## Category 63: Edge Case Handling

### Best Practice Requirements

#### Input Edge Cases
- [ ] Empty strings handled
- [ ] Null vs undefined distinction
- [ ] Very large inputs handled
- [ ] Unicode/emoji support
- [ ] Special characters in names

#### Range Edge Cases
- [ ] Empty ranges handled
- [ ] Single cell ranges
- [ ] Full column/row ranges (A:A, 1:1)
- [ ] Cross-sheet references
- [ ] Invalid range formats

#### Data Edge Cases
- [ ] Empty spreadsheets
- [ ] Sheets with no data
- [ ] Formulas vs values
- [ ] Merged cells
- [ ] Hidden rows/columns

#### Error Edge Cases
- [ ] Network timeouts
- [ ] Rate limit exceeded
- [ ] Invalid credentials
- [ ] Spreadsheet not found
- [ ] Permission denied

### ServalSheets Files to Analyze
```
src/core/range-resolver.ts
src/handlers/*.ts (error handling)
tests/handlers/*.test.ts (edge cases)
tests/property/*.test.ts
```

### Analysis Questions
1. Are empty inputs handled?
2. Are Unicode characters supported?
3. Are merged cells handled?
4. Are all error types caught?
5. Are edge cases tested?
6. Is behavior documented for edge cases?

---

## Category 64: Concurrency & Thread Safety

### Best Practice Requirements

#### Async Operations
- [ ] Proper async/await usage
- [ ] No race conditions
- [ ] Mutex/semaphore for shared resources
- [ ] Queue-based processing (p-queue)

#### Atomic Operations
- [ ] Transaction atomicity
- [ ] Batch atomicity
- [ ] State consistency
- [ ] Rollback on failure

#### Concurrent Request Handling
- [ ] Request isolation
- [ ] No shared mutable state
- [ ] Context propagation
- [ ] Concurrent test coverage

### ServalSheets Files to Analyze
```
src/services/transaction-manager.ts
src/core/batch-compiler.ts
src/services/parallel-executor.ts
tests/integration/cancellation.test.ts
```

### Analysis Questions
1. Is async/await used consistently?
2. Are race conditions prevented?
3. Is p-queue used for concurrency?
4. Are transactions atomic?
5. Is shared state avoided?
6. Are concurrent scenarios tested?

---

## Category 65: Memory Efficiency

### Best Practice Requirements

#### Memory Management
- [ ] Bounded caches (LRU with max size)
- [ ] Cleanup on shutdown
- [ ] No memory leaks in loops
- [ ] WeakMap for object associations
- [ ] Stream processing for large data

#### Memory Monitoring
- [ ] Memory usage logging
- [ ] Heap size tracking
- [ ] Garbage collection hints
- [ ] Memory alerts

#### Large Data Handling
- [ ] Chunked processing
- [ ] Streaming responses
- [ ] Pagination for large results
- [ ] Memory-efficient data structures

### ServalSheets Files to Analyze
```
src/utils/cache-manager.ts (size limits)
src/utils/hot-cache.ts
vitest.config.ts (memory in tests)
```

### Analysis Questions
1. Are caches size-bounded?
2. Is cleanup on shutdown implemented?
3. Are streams used for large data?
4. Is memory usage monitored?
5. Are there memory leak tests?
6. Is pagination implemented?

---

## Category 66: Scalability Considerations

### Best Practice Requirements

#### Horizontal Scaling
- [ ] Stateless design
- [ ] External state storage (Redis)
- [ ] Load balancer friendly
- [ ] Health checks for scaling

#### Vertical Scaling
- [ ] Efficient algorithms
- [ ] Optimized queries
- [ ] Connection pooling
- [ ] Resource limits

#### Bottleneck Prevention
- [ ] Rate limiting
- [ ] Circuit breakers
- [ ] Timeout handling
- [ ] Backpressure mechanisms

### ServalSheets Files to Analyze
```
src/storage/ (session externalization)
src/core/task-store-factory.ts (Redis support)
src/server/health.ts
deployment/docker/
```

### Analysis Questions
1. Is stateless design achieved?
2. Is Redis optional for scaling?
3. Are health checks implemented?
4. Is connection pooling used?
5. Are timeouts configured?
6. Is Docker deployment documented?

---

## Category 67: Rate Limiting & Quota Management

### Best Practice Requirements

#### Internal Rate Limiting
- [ ] Per-user rate limits
- [ ] Per-tool rate limits
- [ ] Burst handling
- [ ] Rate limit headers

#### Google API Quotas
- [ ] Quota tracking
- [ ] Quota warnings
- [ ] Exponential backoff on 429
- [ ] Quota-aware batching

#### Quota Visibility
- [ ] Current usage reporting
- [ ] Quota metrics
- [ ] Usage alerts
- [ ] Cost estimation (if applicable)

### ServalSheets Files to Analyze
```
src/core/rate-limiter.ts
src/utils/retry.ts (429 handling)
src/services/batching-system.ts
src/observability/metrics.ts
src/knowledge/api/limits/quotas.json
```

### Analysis Questions
1. Is per-user rate limiting implemented?
2. Is 429 handling with backoff present?
3. Is quota information documented?
4. Are quota metrics exposed?
5. Is batching quota-aware?
6. Are usage alerts configured?

---

## Category 68: Debugging & Diagnostics

### Best Practice Requirements

#### Debug Modes
- [ ] Verbose logging mode
- [ ] Request/response logging
- [ ] Timing information
- [ ] Stack traces in dev

#### Diagnostic Tools
- [ ] MCP Inspector support
- [ ] Health check endpoints
- [ ] Metrics endpoints
- [ ] Debug scripts

#### Troubleshooting
- [ ] Common issues documented
- [ ] Error code reference
- [ ] Debug commands
- [ ] Log analysis guide

### ServalSheets Files to Analyze
```
inspector.json
scripts/diagnose-all.sh
DEBUGGING_TOOLS.md
src/utils/logger.ts (log levels)
package.json (inspect scripts)
```

### Analysis Questions
1. Is Inspector working?
2. Is verbose mode available?
3. Are diagnostic scripts present?
4. Is troubleshooting documented?
5. Are error codes referenced?
6. Is log analysis guided?

---

## Category 69: Example Code Quality

### Best Practice Requirements

#### Example Coverage
- [ ] Basic usage examples
- [ ] Advanced feature examples
- [ ] Error handling examples
- [ ] Integration examples

#### Example Quality
- [ ] Runnable without modification
- [ ] Well-commented
- [ ] Up-to-date with API
- [ ] Copy-paste friendly

#### Example Organization
- [ ] By use case
- [ ] By complexity
- [ ] By tool/feature

### ServalSheets Files to Analyze
```
examples/
docs/examples/
tests/examples/
README.md (inline examples)
```

### Analysis Questions
1. Are examples comprehensive?
2. Are examples runnable?
3. Are examples up-to-date?
4. Are examples well-documented?
5. Do examples cover errors?
6. Are advanced examples present?

---

## Category 70: Benchmark Suite

### Best Practice Requirements

#### Performance Benchmarks
- [ ] Response time benchmarks
- [ ] Throughput benchmarks
- [ ] Memory usage benchmarks
- [ ] Startup time benchmarks

#### Comparative Benchmarks
- [ ] Before/after optimization
- [ ] Version comparisons
- [ ] Configuration comparisons

#### Benchmark Tooling
- [ ] Automated benchmark runs
- [ ] Benchmark visualization
- [ ] Regression detection
- [ ] CI integration

### ServalSheets Files to Analyze
```
tests/benchmarks/
scripts/benchmark-*.ts
```

### Analysis Questions
1. Are benchmarks present?
2. Is latency measured?
3. Is throughput measured?
4. Is memory benchmarked?
5. Are benchmarks automated?
6. Is regression detected?

---

## Category 71: Contract & Schema Testing

### Best Practice Requirements

#### Schema Contracts
- [ ] Input schema validation tests
- [ ] Output schema validation tests
- [ ] Schema evolution tests
- [ ] Breaking change detection

#### Protocol Contracts
- [ ] MCP protocol compliance
- [ ] JSON-RPC compliance
- [ ] Error code contracts
- [ ] Response format contracts

#### API Contracts
- [ ] Google API contract tests
- [ ] Version compatibility tests
- [ ] Deprecation handling tests

### ServalSheets Files to Analyze
```
tests/contracts/mcp-protocol.test.ts
tests/contracts/schema-*.test.ts
tests/schemas.test.ts
```

### Analysis Questions
1. Are schema contracts tested?
2. Is MCP protocol compliance tested?
3. Are breaking changes detected?
4. Are API contracts verified?
5. Is schema evolution tested?
6. Are error codes contracted?

---

## Category 72: Property-Based Testing

### Best Practice Requirements

#### Property Tests
- [ ] Arbitrary input generation
- [ ] Invariant verification
- [ ] Roundtrip properties
- [ ] Shrinking on failure

#### Coverage Areas
- [ ] Range parsing properties
- [ ] Schema validation properties
- [ ] Data transformation properties

#### Tools
- [ ] fast-check integration
- [ ] Custom generators
- [ ] Failure reproduction

### ServalSheets Files to Analyze
```
tests/property/range-parser.property.test.ts
tests/property/schema-validation.property.test.ts
package.json (fast-check)
```

### Analysis Questions
1. Is fast-check used?
2. Are property tests present?
3. Are custom generators defined?
4. Is shrinking working?
5. Are invariants verified?
6. Is coverage sufficient?

---

## Category 73: Snapshot Testing

### Best Practice Requirements

#### Snapshot Coverage
- [ ] Handler response snapshots
- [ ] Error response snapshots
- [ ] Schema snapshots
- [ ] Configuration snapshots

#### Snapshot Management
- [ ] Update scripts
- [ ] Review process
- [ ] CI validation
- [ ] Diff visualization

### ServalSheets Files to Analyze
```
tests/handlers/__snapshots__/
tests/handlers/*.snapshot.test.ts
scripts/update-snapshots.sh
```

### Analysis Questions
1. Are snapshots present?
2. Is snapshot updating automated?
3. Are snapshots reviewed in PRs?
4. Is snapshot coverage sufficient?
5. Are error snapshots captured?
6. Is diff visualization available?

---

## Category 74: Audit Trail & Logging

### Best Practice Requirements

#### Operation Logging
- [ ] All operations logged
- [ ] User identification
- [ ] Timestamp tracking
- [ ] Duration tracking
- [ ] Outcome tracking

#### Audit Events
- [ ] Authentication events
- [ ] Authorization events
- [ ] Data modification events
- [ ] Configuration changes

#### Log Retention
- [ ] Retention policy
- [ ] Log rotation
- [ ] Log archival
- [ ] Log search

### ServalSheets Files to Analyze
```
src/utils/logger.ts
src/services/history-service.ts
src/observability/
```

### Analysis Questions
1. Are all operations logged?
2. Is user identified in logs?
3. Are auth events logged?
4. Is duration tracked?
5. Is log retention configured?
6. Is log search available?

---

## Category 75: Data Privacy & Compliance

### Best Practice Requirements

#### PII Handling
- [ ] PII detection
- [ ] PII redaction in logs
- [ ] PII minimization
- [ ] Data retention limits

#### Privacy Controls
- [ ] User consent tracking
- [ ] Data export capability
- [ ] Data deletion capability
- [ ] Privacy policy compliance

#### Compliance
- [ ] GDPR considerations
- [ ] SOC2 alignment
- [ ] Security best practices
- [ ] Audit readiness

### ServalSheets Files to Analyze
```
src/utils/redact.ts
SECURITY.md
PRIVACY.md (if exists)
```

### Analysis Questions
1. Is PII redacted from logs?
2. Is data minimization practiced?
3. Is retention limited?
4. Is data export possible?
5. Is deletion possible?
6. Is compliance documented?

---

## Category 76: Encryption & Security

### Best Practice Requirements

#### Encryption at Rest
- [ ] Token encryption (AES-256-GCM)
- [ ] Secure key storage
- [ ] Key rotation support

#### Encryption in Transit
- [ ] HTTPS support
- [ ] TLS configuration
- [ ] Certificate handling

#### Secret Management
- [ ] Environment variable secrets
- [ ] No hardcoded secrets
- [ ] Secret rotation support
- [ ] Secret scanning in CI

### ServalSheets Files to Analyze
```
src/services/token-store.ts (encryption)
.github/workflows/security.yml
.gitignore (secrets exclusion)
SECURITY.md
```

### Analysis Questions
1. Is AES-256-GCM used?
2. Is TLS supported?
3. Are secrets in env vars only?
4. Is secret scanning enabled?
5. Is key rotation supported?
6. Are secrets in .gitignore?

---

## Category 77: Input Validation Depth

### Best Practice Requirements

#### Schema Validation
- [ ] Zod schema validation
- [ ] Type coercion
- [ ] Custom refinements
- [ ] Error messages

#### Beyond Schema
- [ ] Business rule validation
- [ ] Cross-field validation
- [ ] Contextual validation
- [ ] Permission validation

#### Sanitization
- [ ] HTML escaping
- [ ] SQL injection prevention
- [ ] Path traversal prevention
- [ ] Command injection prevention

### ServalSheets Files to Analyze
```
src/schemas/*.ts (refinements)
src/services/validation-engine.ts
src/utils/safety-helpers.ts
```

### Analysis Questions
1. Is Zod validation comprehensive?
2. Are refinements used?
3. Is cross-field validation present?
4. Is input sanitized?
5. Are injection attacks prevented?
6. Is contextual validation done?

---

## Category 78: Output Safety

### Best Practice Requirements

#### Response Safety
- [ ] No sensitive data in responses
- [ ] Token redaction
- [ ] Error message sanitization
- [ ] Stack trace hiding in production

#### Data Leakage Prevention
- [ ] Cross-user data isolation
- [ ] Response filtering
- [ ] Metadata scrubbing

### ServalSheets Files to Analyze
```
src/mcp/response-builder.ts
src/utils/redact.ts
src/utils/response-optimizer.ts
```

### Analysis Questions
1. Are tokens excluded from responses?
2. Are errors sanitized?
3. Is stack trace hidden in prod?
4. Is cross-user leakage prevented?
5. Is metadata scrubbed?
6. Are responses filtered?

---

## Category 79: Feature Flags & Runtime Configuration

### Best Practice Requirements

#### Feature Flags
- [ ] MANAGED_AUTH flag
- [ ] Debug mode flag
- [ ] Feature toggles
- [ ] A/B testing support

#### Runtime Configuration
- [ ] Hot configuration reload
- [ ] Configuration validation
- [ ] Configuration versioning
- [ ] Default fallbacks

### ServalSheets Files to Analyze
```
src/config/env.ts
src/config/constants.ts
```

### Analysis Questions
1. Is MANAGED_AUTH implemented?
2. Are feature flags present?
3. Can config be hot-reloaded?
4. Are defaults safe?
5. Is config validated?
6. Is config versioned?

---

## Category 80: Community & Ecosystem

### Best Practice Requirements

#### Open Source Health
- [ ] README badges (build, coverage, npm)
- [ ] License file
- [ ] Contributing guide
- [ ] Code of conduct
- [ ] Issue templates
- [ ] PR templates

#### Community Engagement
- [ ] GitHub Discussions (if enabled)
- [ ] Issue responsiveness
- [ ] PR review process
- [ ] Release notes

#### Ecosystem Integration
- [ ] NPM package published
- [ ] Docker image available
- [ ] MCP Registry listing
- [ ] Documentation site

### ServalSheets Files to Analyze
```
README.md (badges)
LICENSE
CONTRIBUTING.md (if exists)
CODE_OF_CONDUCT.md (if exists)
.github/ISSUE_TEMPLATE/
.github/PULL_REQUEST_TEMPLATE.md
```

### Analysis Questions
1. Are badges present?
2. Is license clear?
3. Is contributing guide present?
4. Are issue templates defined?
5. Is PR template defined?
6. Is NPM package published?

---

# ULTIMATE Scoring Matrix (80 Categories)

## Category Weights Summary

| Section | Categories | Base Weight |
|---------|------------|-------------|
| Functional | 1-12 | 46% |
| APIs & Protocol | 13-16 | 18% |
| Code Quality | 17-32 | 36% |
| Deep Technical | 33-60 | +20% (bonus) |
| Excellence | 61-80 | +20% (bonus) |

**Base Score: 100% | Maximum Possible: 140%**

---

## Comprehensive Checklist Summary

### Must-Have (P0) - 40 items
1. OAuth 2.1 with PKCE
2. Token encryption
3. Zod schema validation on all inputs
4. Error handling with recovery
5. Rate limiting
6. All 26 tools registered
7. MCP 2025-11-25 compliance
8. Google Sheets API v4 core methods
9. Unit test coverage ≥75%
10. CI/CD pipeline
11. server.json valid
12. README documentation
13. Graceful shutdown
14. Request deduplication
15. Response optimization
16. Health endpoints
17. Logging with redaction
18. TypeScript strict mode
19. No `any` types
20. Dependency security audit
21. HTTPS support
22. Session isolation
23. Transaction atomicity
24. Dry-run mode
25. Snapshot before destructive
26. Impact analysis
27. Confirmation flow
28. Version consistency
29. Changelog maintained
30. Docker support
31. Environment validation
32. Cache management
33. Circuit breaker
34. Exponential backoff
35. Correlation IDs
36. Metrics exposure
37. MCP resources
38. MCP prompts
39. Knowledge base
40. Examples

### Should-Have (P1) - 30 items
1. BigQuery integration
2. Drive API full coverage
3. HTTP/2 support
4. Redis session store
5. OpenTelemetry
6. Property-based tests
7. Snapshot tests
8. Benchmarks
9. Contract tests
10. Policy enforcement
11. Multi-tenant isolation
12. Prefetching
13. Semantic ranges
14. Batch compilation
15. Parallel execution
16. Task management (SEP-1686)
17. Elicitation (SEP-1036)
18. Sampling (SEP-1577)
19. Tool annotations
20. Structured outputs
21. Well-known discovery
22. Developer metadata
23. OpenAPI spec
24. TypeDoc generation
25. Debug modes
26. Diagnostic scripts
27. Hot reload
28. VSCode config
29. Feature flags
30. Community templates

### Nice-to-Have (P2) - 20 items
1. A/B testing
2. Chaos engineering
3. Load testing
4. Video tutorials
5. Plugin architecture
6. i18n support
7. Mobile app examples
8. Webhook support
9. GraphQL gateway
10. Cost estimation
11. Usage analytics
12. Anomaly detection
13. Auto-scaling hints
14. Compliance badges
15. Security certifications
16. Performance dashboard
17. Real-time collaboration
18. Offline support
19. Progressive enhancement
20. Accessibility testing

---

## Final Analysis Execution Plan

### Phase 1: Inventory (2 hours)
1. List all source files
2. List all test files
3. List all config files
4. Count tools, actions, resources, prompts
5. Identify missing files

### Phase 2: Scoring (4 hours)
1. Score each of 80 categories
2. Document evidence for each score
3. Calculate weighted total
4. Identify pass/fail on must-haves

### Phase 3: Deep Dive (4 hours)
1. Analyze critical gaps
2. Review security vulnerabilities
3. Test coverage analysis
4. Performance profiling
5. Dependency audit

### Phase 4: Recommendations (2 hours)
1. Prioritize P0 fixes
2. Create P1 roadmap
3. Document P2 wishlist
4. Estimate effort

### Phase 5: Report (2 hours)
1. Executive summary
2. Score dashboard
3. Compliance matrices
4. Technical debt inventory
5. Implementation roadmap

**Total Estimated Time: 14 hours for complete analysis**

---

## Quick Start Analysis

For a rapid assessment, focus on these 20 critical categories:

| # | Category | Quick Check |
|---|----------|-------------|
| 1 | Auth | `sheets_auth` actions work |
| 2 | Data Ops | `sheets_values` read/write works |
| 13 | MCP Spec | SDK version ≥1.25 |
| 14 | Sheets API | batchUpdate works |
| 17 | Zod | All schemas compile |
| 18 | TypeScript | `npm run typecheck` passes |
| 20 | Dependencies | `npm audit` clean |
| 21 | Registration | `tools/list` returns 26 tools |
| 23 | Errors | Custom error classes exist |
| 24 | Testing | `npm test` passes |
| 28 | CI/CD | GitHub Actions green |
| 35 | Caching | Cache hit rate >50% |
| 49 | Manifest | server.json valid |
| 52 | Tasks | Task states work |
| 53 | Tokens | Encrypted storage |
| 54 | Lifecycle | Graceful shutdown |
| 55 | Retry | Exponential backoff |
| 67 | Rate Limit | 429 handled |
| 76 | Encryption | AES-256-GCM |
| 77 | Validation | Zod on all inputs |

**Rapid Assessment Time: 2 hours**

---

## Usage

To run the complete 80-category analysis:

```bash
# 1. Read this prompt completely
# 2. Use file examination tools to inventory
# 3. Run test suite and collect metrics
# 4. Score each category systematically
# 5. Generate the comprehensive report
```

This creates the **ultimate audit** of ServalSheets covering:
- ✅ 12 Functional categories
- ✅ 4 API/Protocol categories  
- ✅ 16 Code quality categories
- ✅ 28 Deep technical categories
- ✅ 20 Excellence categories
- ✅ **80 total evaluation dimensions**
- ✅ **Maximum score: 140%**


---

# PART 5: Agent Orchestration & Automated Execution

---

## Agent Execution Framework

This section provides explicit instructions for AI agents (Claude, Copilot, Cursor, etc.) to execute the analysis using all available resources, native tools, and parallel execution.

---

## Category 81: Agent Orchestration Strategy

### Multi-Agent Coordination

For comprehensive analysis, deploy **specialized agents** for each domain:

| Agent Role | Focus Areas | Tools to Use |
|------------|-------------|--------------|
| **Schema Agent** | Zod schemas, validation, type safety | TypeScript LSP, AST parser |
| **Test Agent** | Test execution, coverage, failures | vitest, coverage-v8 |
| **Security Agent** | Vulnerabilities, secrets, encryption | npm audit, CodeQL |
| **Performance Agent** | Benchmarks, profiling, optimization | Built-in benchmarks |
| **Protocol Agent** | MCP compliance, JSON-RPC, SEPs | MCP Inspector |
| **API Agent** | Google Sheets/Drive coverage | API documentation |
| **DevOps Agent** | CI/CD, Docker, deployment | GitHub Actions |
| **Documentation Agent** | Docs completeness, accuracy | TypeDoc, markdown lint |

### Parallel Execution Strategy

```
Phase 1 (Parallel - All agents):
├── Agent 1: Run `npm run typecheck`
├── Agent 2: Run `npm run lint`
├── Agent 3: Run `npm audit`
├── Agent 4: Run `npm test`
└── Agent 5: Analyze file structure

Phase 2 (Parallel - After Phase 1):
├── Agent 1: Analyze test failures (if any)
├── Agent 2: Analyze coverage gaps
├── Agent 3: Security deep-dive
└── Agent 4: Performance profiling

Phase 3 (Sequential - Synthesis):
└── Lead Agent: Compile all results into report
```

---

## Category 82: Native Command Execution

### CRITICAL: Execute These Commands

**All agents MUST run these commands and capture outputs:**

#### 1. Build & Type Check (REQUIRED)
```bash
# Build the project
npm run build
# Expected: Clean compilation, no errors

# Type check
npm run typecheck
# Expected: "Found 0 errors"

# Verify build artifacts
ls -la dist/
# Expected: All .js and .d.ts files present
```

#### 2. Test Execution (REQUIRED)
```bash
# Run all tests
npm test
# Expected: All 1,830+ tests passing

# Run with coverage
npm run test:coverage
# Expected: ≥75% coverage on all metrics

# Run specific test suites
npm run test -- tests/handlers/
npm run test -- tests/services/
npm run test -- tests/contracts/
npm run test -- tests/integration/
```

#### 3. Linting & Formatting (REQUIRED)
```bash
# ESLint check
npm run lint
# Expected: No errors, warnings acceptable

# Prettier check
npm run format:check
# Expected: All files formatted

# Full verification
npm run verify
# Expected: All checks pass
```

#### 4. Security Audit (REQUIRED)
```bash
# NPM security audit
npm audit
# Expected: 0 high/critical vulnerabilities

# Check for secrets in code
grep -r "sk-" src/ || echo "No secrets found"
grep -r "API_KEY" src/ || echo "No API keys found"
```

#### 5. Metadata Validation (REQUIRED)
```bash
# Validate server.json
npm run validate:server-json
# Expected: Valid JSON, correct tool count

# Check metadata drift
npm run check:drift
# Expected: No drift detected

# Check for placeholders
npm run check:placeholders
# Expected: No placeholders found
```

#### 6. Smoke Test (REQUIRED)
```bash
# Verify CLI works
npm run smoke
# Expected: Version printed, no errors

# Test MCP Inspector
npm run inspect
# Expected: Inspector launches successfully
```

### Output Capture Template

For each command, record:
```yaml
command: "npm test"
exit_code: 0
duration: "45.2s"
stdout_summary: "1830 tests passed"
stderr_summary: "none"
warnings: []
errors: []
pass: true
```

---

## Category 83: Automated Verification Checklist

### Pre-Flight Checks (Run First)

```bash
#!/bin/bash
# pre-flight.sh - Run before analysis

echo "=== Pre-Flight Checks ==="

# 1. Node version
node -v | grep -E "v2[0-9]" && echo "✅ Node 20+" || echo "❌ Node version too old"

# 2. NPM version
npm -v | grep -E "^10\." && echo "✅ NPM 10+" || echo "❌ NPM version too old"

# 3. Dependencies installed
[ -d "node_modules" ] && echo "✅ Dependencies installed" || echo "❌ Run npm install"

# 4. Build exists
[ -d "dist" ] && echo "✅ Build exists" || echo "⚠️ Run npm run build"

# 5. Environment
[ -f ".env" ] && echo "✅ .env exists" || echo "⚠️ Copy .env.example to .env"

echo "=== Pre-Flight Complete ==="
```

### Post-Build Verification

```bash
#!/bin/bash
# verify-build.sh

echo "=== Build Verification ==="

# Check all expected outputs exist
files=(
  "dist/index.js"
  "dist/index.d.ts"
  "dist/server.js"
  "dist/cli.js"
  "dist/http-server.js"
  "dist/schemas/index.js"
)

for f in "${files[@]}"; do
  [ -f "$f" ] && echo "✅ $f" || echo "❌ Missing: $f"
done

# Check knowledge files copied
[ -d "dist/knowledge" ] && echo "✅ Knowledge files copied" || echo "❌ Knowledge files missing"

# Verify server.json
node scripts/validate-server-json.mjs && echo "✅ server.json valid" || echo "❌ server.json invalid"

echo "=== Build Verification Complete ==="
```

---

## Category 84: Test Analysis Deep Dive

### Test Metrics to Capture

```bash
# Get test statistics
npm run test -- --reporter=json > test-results.json

# Coverage report
npm run test:coverage -- --reporter=json > coverage.json
```

### Expected Test Distribution

| Category | Expected Count | Minimum |
|----------|----------------|---------|
| Handler tests | ~600 | 500 |
| Service tests | ~400 | 300 |
| Unit tests | ~300 | 250 |
| Integration tests | ~150 | 100 |
| Contract tests | ~100 | 50 |
| Property tests | ~50 | 30 |
| Snapshot tests | ~50 | 30 |
| **Total** | **1,830+** | **1,500** |

### Coverage Thresholds

| Metric | Target | Minimum |
|--------|--------|---------|
| Lines | 85% | 75% |
| Functions | 85% | 75% |
| Branches | 80% | 70% |
| Statements | 85% | 75% |

### Failure Analysis Protocol

If tests fail:
1. Capture full error output
2. Identify failing test file
3. Categorize failure type:
   - Type error
   - Runtime error
   - Assertion failure
   - Timeout
   - Mock issue
4. Check for flaky tests (run 3x)
5. Document in report

---

## Category 85: CI/CD Pipeline Verification

### GitHub Actions Workflows to Verify

| Workflow | File | Purpose | Status Check |
|----------|------|---------|--------------|
| CI | `.github/workflows/ci.yml` | Build, test, lint | Must pass |
| Security | `.github/workflows/security.yml` | npm audit, CodeQL | Must pass |
| Docker | `.github/workflows/docker.yml` | Image build | Should pass |
| Publish | `.github/workflows/publish.yml` | npm release | N/A |
| server.json | `.github/workflows/validate-server-json.yml` | Metadata | Must pass |

### Workflow Validation Commands

```bash
# Validate workflow syntax (requires act or gh CLI)
gh workflow list
gh run list --workflow=ci.yml --limit=5

# Or manually check workflow files
cat .github/workflows/ci.yml | head -50
```

### CI Parity Check

Ensure local commands match CI:
```yaml
# From ci.yml - replicate locally:
- npm ci
- npm run build
- npm run typecheck
- npm run lint
- npm run test
- npm run validate:server-json
```

---

## Category 86: Dependency Analysis

### Dependency Audit Commands

```bash
# List all dependencies
npm ls --depth=0

# Check for outdated
npm outdated

# Audit for vulnerabilities
npm audit --json > audit.json

# Check for duplicates
npm dedupe --dry-run

# Analyze bundle size (if applicable)
npx size-limit
```

### Critical Dependencies to Verify

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| @modelcontextprotocol/sdk | ^1.25.2 | Check | MCP core |
| googleapis | ^170.0.0 | Check | Google APIs |
| zod | 4.3.5 | Check | Schema validation |
| express | ^5.2.1 | Check | HTTP server |
| typescript | ^5.9.3 | Check | Compiler |
| vitest | ^4.0.16 | Check | Test runner |

### Dependency Graph Analysis

```bash
# Generate dependency graph
npm ls --all --json > deps.json

# Check for circular dependencies
npx madge --circular src/

# Identify unused dependencies
npx depcheck
```

---

## Category 87: Code Metrics Collection

### Collect These Metrics

```bash
# Lines of code
find src -name "*.ts" | xargs wc -l | tail -1

# File count
find src -name "*.ts" | wc -l

# Test count
npm test -- --reporter=dot 2>&1 | grep -E "^\d+ tests"

# Coverage
npm run test:coverage 2>&1 | grep -E "All files"
```

### Complexity Analysis

```bash
# Cyclomatic complexity (requires tool)
npx complexity-report src/**/*.ts

# Or use TypeScript metrics
npx ts-metrics src/
```

### Expected Metrics (from PROJECT_OVERVIEW.md)

| Metric | Expected |
|--------|----------|
| TypeScript Files | 203 |
| Lines of Code | 77,813 |
| Handler LOC | 16,783 |
| Service LOC | 15,798 |
| Test Files | 95 |
| Passing Tests | 1,830+ |
| Tools | 27 |
| Actions | 208 |
| Schemas | 25 |

---

## Category 88: MCP Inspector Integration

### Inspector Testing Protocol

```bash
# Launch inspector with server
npm run inspect

# Or with CLI mode
npm run inspect:cli
```

### Inspector Verification Checklist

- [ ] Server connects successfully
- [ ] All 27 tools listed
- [ ] All resources listed
- [ ] All prompts listed
- [ ] Completions work
- [ ] Tool calls execute
- [ ] Error responses formatted correctly

### Manual MCP Protocol Test

```json
// Test initialize
{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-11-25","clientInfo":{"name":"test"}},"id":1}

// Test tools/list
{"jsonrpc":"2.0","method":"tools/list","id":2}

// Test resources/list
{"jsonrpc":"2.0","method":"resources/list","id":3}
```

---

## Category 89: Cross-Reference Validation

### Consistency Checks

| Source A | Source B | Must Match |
|----------|----------|------------|
| package.json version | server.json version | Exact |
| package.json version | src/version.ts | Exact |
| Tool count in code | server.json metadata | Exact |
| Action count in code | server.json metadata | Exact |
| README tool list | Actual tools | Subset OK |

### Validation Script

```bash
#!/bin/bash
# cross-check.sh

# Version consistency
PKG_VER=$(node -p "require('./package.json').version")
SERVER_VER=$(node -p "require('./server.json').version")
SRC_VER=$(grep -oP 'version = "\K[^"]+' src/version.ts 2>/dev/null || echo "N/A")

echo "Package.json: $PKG_VER"
echo "Server.json: $SERVER_VER"
echo "src/version.ts: $SRC_VER"

[ "$PKG_VER" = "$SERVER_VER" ] && echo "✅ Versions match" || echo "❌ Version mismatch"
```

---

## Category 90: Intent System Analysis

### Intent Coverage Verification

ServalSheets uses 95+ intent types. Verify coverage:

```bash
# Find all intent type definitions
grep -r "type.*Intent" src/core/intent.ts | wc -l

# List all intent types
grep -E "^\s+\| \{" src/core/intent.ts | wc -l
```

### Intent Categories

| Category | Expected Count |
|----------|----------------|
| Spreadsheet | 5+ |
| Sheet | 10+ |
| Cell | 15+ |
| Format | 20+ |
| Dimension | 10+ |
| Chart | 10+ |
| Pivot | 5+ |
| Filter | 5+ |
| Protection | 5+ |
| Named Range | 5+ |
| Metadata | 5+ |

### Batch Compiler Verification

```bash
# Check batch compiler handles all intents
grep -c "case " src/core/batch-compiler.ts
```

---

## Category 91: Knowledge Base Verification

### Knowledge File Inventory

```bash
# Count knowledge files
find src/knowledge -type f | wc -l

# List categories
ls -la src/knowledge/
ls -la src/knowledge/api/
ls -la src/knowledge/formulas/
ls -la src/knowledge/templates/
```

### Expected Knowledge Structure

```
src/knowledge/
├── api/
│   ├── batch-operations.md
│   ├── charts.md
│   ├── conditional-formatting.md
│   ├── data-validation.md
│   ├── limits/quotas.json
│   ├── named-ranges.md
│   └── pivot-tables.md
├── formulas/
│   ├── advanced.json
│   ├── datetime.json
│   ├── financial.json
│   ├── functions-reference.md
│   ├── key-formulas.json
│   └── lookup.json
├── templates/
│   ├── common-templates.json
│   ├── crm.json
│   ├── finance.json
│   ├── inventory.json
│   ├── marketing.json
│   ├── project.json
│   └── sales.json
├── confirmation-guide.json
├── formula-antipatterns.json
├── natural-language-guide.json
├── ui-ux-patterns.json
├── user-intent-examples.json
└── workflow-patterns.json
```

### Knowledge Quality Checks

- [ ] JSON files are valid JSON
- [ ] Markdown files render correctly
- [ ] No placeholder content
- [ ] Examples are accurate
- [ ] Quota limits are current

---

## Category 92: Bundle & Import Analysis

### Tree-Shaking Verification

```bash
# Check for side-effect imports
grep -r "import './" src/

# Verify barrel exports
cat src/index.ts
cat src/schemas/index.ts

# Check for circular dependencies
npx madge --circular --extensions ts src/
```

### Bundle Size Analysis

```bash
# Analyze dist size
du -sh dist/

# Check individual file sizes
du -h dist/*.js | sort -h

# Find largest files
find dist -name "*.js" -exec du -h {} \; | sort -rh | head -10
```

### Import Graph

```bash
# Generate import graph
npx madge --image graph.png src/index.ts
```

---

## Category 93: Dead Code Detection

### Find Unused Code

```bash
# Find unused exports
npx ts-prune src/

# Find unused dependencies
npx depcheck

# Find unused files
npx unimported
```

### Expected Findings

- All exports should be used
- No dead handler code
- No orphan utility functions
- No unused schema definitions

---

## Category 94: Type Coverage Analysis

### Beyond No-Any

```bash
# Type coverage report
npx type-coverage --detail

# Expected: >95% type coverage
```

### Type Safety Checklist

- [ ] No `any` types (eslint rule)
- [ ] No `as` assertions without justification
- [ ] All function return types explicit
- [ ] All parameters typed
- [ ] Generics used appropriately
- [ ] Discriminated unions for state machines
- [ ] Branded types for IDs

---

## Category 95: Migration & Upgrade Readiness

### Future-Proofing Checks

| Dependency | Current | EOL Risk | Migration Path |
|------------|---------|----------|----------------|
| Node.js 20 | LTS | 2026-04 | Node 22 ready |
| Express 5 | Latest | None | Stable |
| Zod 4 | Latest | None | Stable |
| MCP SDK | Latest | None | Track releases |

### Upgrade Verification

```bash
# Check Node.js compatibility
node --version
npm ls --all | grep "engines"

# Check for deprecation warnings
npm ls 2>&1 | grep -i deprecat
```

---

## Category 96: Real API Testing (Optional)

### Integration Test with Real Google API

```bash
# Run real API tests (requires credentials)
TEST_REAL_API=true npm run test:integration

# Expected: All integration tests pass
```

### Credential Verification

```bash
# Check OAuth setup
npm run auth

# Verify token exists
[ -f "servalsheets.tokens.enc" ] && echo "✅ Tokens exist" || echo "⚠️ No tokens"
```

---

## Final Agent Instructions

### For VS Code / Cursor / Copilot Agents

```
INSTRUCTIONS FOR AI AGENTS:

1. PARALLEL EXECUTION: Run all Category 82 commands simultaneously
2. CAPTURE ALL OUTPUT: Store stdout, stderr, exit codes
3. ANALYZE FAILURES: For any failure, investigate root cause
4. CROSS-REFERENCE: Verify Category 89 consistency checks
5. METRICS COLLECTION: Gather all Category 87 metrics
6. GENERATE REPORT: Use the 80-category scoring matrix
7. PRIORITIZE: Focus on P0 (must-have) items first
8. AUTOMATE: Use native test/build tools, don't simulate

RESOURCE USAGE:
- Use ALL available CPU cores for parallel tests
- Use TypeScript language server for type analysis
- Use ESLint for code quality analysis
- Use native file system for inventory
- Use npm for dependency analysis
- Use git for version/change analysis

OUTPUT FORMAT:
- Score each of 80+ categories 0-10
- Calculate weighted total (max 140%)
- List top issues by priority
- Generate implementation roadmap
- Include all command outputs as evidence
```

### Execution Order

```
1. Pre-flight checks (Category 83)
2. Build verification (Category 82)
3. Test execution (Category 84)
4. Security audit (Category 86)
5. Code metrics (Category 87)
6. Cross-reference (Category 89)
7. Generate scores (All categories)
8. Compile report
```

---

## Updated Statistics (from PROJECT_OVERVIEW.md)

| Metric | Value |
|--------|-------|
| Version | 1.4.0 |
| Protocol | MCP 2025-11-25 |
| TypeScript Files | 203 |
| Lines of Code | 77,813 |
| Test Files | 95 |
| Passing Tests | 1,830+ |
| Tools | **27** (not 26) |
| Actions | 208 |
| Schemas | 25 |
| Resources | 13+ |
| Prompts | 6 |
| Intent Types | 95+ |

---

## Quick Analysis Command

Run this single command to execute all critical checks:

```bash
npm run ci
```

This runs:
1. `npm run clean`
2. `npm run build`
3. `npm run verify` (typecheck + lint + format + test)
4. `npm run validate:server-json`
5. `npm run smoke`

**Expected output: All green, no errors**


---

# PART 6: VS Code Agent Execution Framework

---

## VS Code Agent Configuration

### Agent Identity Declaration

```markdown
# AGENT IDENTITY

You are a **ServalSheets Analysis Agent** operating in VS Code.
Your mission: Execute a comprehensive 96-category audit of the ServalSheets MCP server.

## Your Capabilities
- Execute terminal commands (npm, node, git, shell)
- Read and analyze source files
- Run TypeScript compiler and ESLint
- Execute vitest test suites
- Analyze dependency trees
- Generate reports in markdown

## Your Constraints
- DO NOT modify source code unless explicitly fixing bugs
- DO NOT make assumptions - verify everything
- DO NOT skip categories - analyze all 96
- DO NOT fabricate test results - run actual commands

## Your Output
- Comprehensive markdown report
- All command outputs as evidence
- Scores for each category (0-10)
- Prioritized issue list
- Implementation roadmap
```

---

## Category 97: VS Code Tasks Integration

### tasks.json Configuration

Create/verify `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "ServalSheets: Full Analysis",
      "type": "shell",
      "command": "npm run ci && npm run test:coverage",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": ["$tsc", "$eslint-stylish"]
    },
    {
      "label": "ServalSheets: Quick Check",
      "type": "shell",
      "command": "npm run typecheck && npm run lint",
      "group": "test"
    },
    {
      "label": "ServalSheets: Security Audit",
      "type": "shell",
      "command": "npm audit --json > audit-report.json && cat audit-report.json",
      "group": "test"
    },
    {
      "label": "ServalSheets: Coverage Report",
      "type": "shell",
      "command": "npm run test:coverage -- --reporter=html",
      "group": "test"
    },
    {
      "label": "ServalSheets: Validate All",
      "type": "shell",
      "command": "npm run validate:schemas && npm run validate:tools && npm run validate:server-json",
      "group": "test"
    }
  ]
}
```

### launch.json Configuration

Create/verify `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--reporter=verbose"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "npm: build",
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Specific Test",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Category 98: Recommended VS Code Extensions

### Required Extensions

| Extension | Purpose | ID |
|-----------|---------|-----|
| TypeScript | Language support | `ms-vscode.vscode-typescript-next` |
| ESLint | Linting | `dbaeumer.vscode-eslint` |
| Prettier | Formatting | `esbenp.prettier-vscode` |
| Error Lens | Inline errors | `usernamehw.errorlens` |
| GitLens | Git analysis | `eamodio.gitlens` |
| Test Explorer | Test UI | `hbenl.vscode-test-explorer` |
| Coverage Gutters | Coverage viz | `ryanluker.vscode-coverage-gutters` |
| Todo Tree | Find TODOs | `Gruntfuggly.todo-tree` |

### Agent-Specific Extensions

| Extension | Purpose | ID |
|-----------|---------|-----|
| GitHub Copilot | AI assistance | `github.copilot` |
| Continue | Local AI | `Continue.continue` |
| Cline | Claude in VS Code | `saoudrizwan.claude-dev` |
| AI Code Review | Analysis | `cursor.cursor-ai` |

### Analysis Extensions

| Extension | Purpose | ID |
|-----------|---------|-----|
| Import Cost | Bundle size | `wix.vscode-import-cost` |
| Code Metrics | Complexity | `kisstkondoros.vscode-codemetrics` |
| Dependency Analytics | Deps | `redhat.fabric8-analytics` |
| SonarLint | Quality | `SonarSource.sonarlint-vscode` |

---

## Category 99: Scoring Rubric

### Universal 0-10 Scale

| Score | Definition | Evidence Required |
|-------|------------|-------------------|
| **10** | Perfect implementation, exceeds best practices | All checklist items ✅, extra features |
| **9** | Excellent, minor polish needed | 90%+ checklist items, no issues |
| **8** | Very good, small improvements possible | 80%+ checklist items, minor issues |
| **7** | Good, meets requirements | 70%+ checklist items, some gaps |
| **6** | Acceptable, needs work | 60%+ checklist items, notable gaps |
| **5** | Borderline, significant gaps | 50%+ checklist items, several issues |
| **4** | Below standard | 40%+ checklist items, major gaps |
| **3** | Poor implementation | 30%+ checklist items, fundamental issues |
| **2** | Minimal effort | 20%+ checklist items, mostly missing |
| **1** | Token implementation | <20% checklist, barely started |
| **0** | Not implemented | Category completely missing |

### Category-Specific Scoring Examples

**Category 1 (Auth) Scoring:**
- 10: OAuth 2.1, PKCE, AES-256 encryption, session isolation, all 4 actions
- 7: OAuth 2.0, PKCE, basic encryption, 3 actions
- 4: Basic OAuth, no PKCE, plaintext tokens
- 0: No authentication at all

**Category 24 (Testing) Scoring:**
- 10: >90% coverage, property tests, snapshots, contracts, benchmarks
- 7: >75% coverage, unit + integration tests
- 4: >50% coverage, unit tests only
- 0: No tests

---

## Category 100: Report Template

### Final Report Structure

```markdown
# ServalSheets Analysis Report

**Generated:** [TIMESTAMP]
**Analyzer:** [AGENT_NAME]
**Version Analyzed:** [VERSION]
**Duration:** [TIME_TAKEN]

---

## Executive Summary

**Overall Score:** [XX.X / 140] ([XX]%)

### Quick Stats
| Metric | Value | Status |
|--------|-------|--------|
| Categories Analyzed | 96 | ✅ |
| P0 Issues | [N] | [🔴/🟢] |
| P1 Issues | [N] | [🟡/🟢] |
| Test Pass Rate | [N]% | [Status] |
| Type Coverage | [N]% | [Status] |
| Security Vulns | [N] | [Status] |

### Verdict
[1-2 sentence overall assessment]

---

## Score Dashboard

### Part 1: Functional (Categories 1-12)
| # | Category | Score | Weight | Weighted |
|---|----------|-------|--------|----------|
| 1 | Authentication | X/10 | 5% | X.X |
| 2 | Core Data Ops | X/10 | 8% | X.X |
...

### Part 2: APIs & Protocol (Categories 13-16)
...

### Part 3: Code Quality (Categories 17-32)
...

### Part 4: Deep Technical (Categories 33-60) - BONUS
...

### Part 5: Excellence (Categories 61-80) - BONUS
...

### Part 6: Agent Execution (Categories 81-96)
...

---

## Command Execution Evidence

### Build & Type Check
```
$ npm run build
[OUTPUT]
Exit Code: [0/1]
Duration: [Xs]
```

### Test Execution
```
$ npm test
[OUTPUT]
Exit Code: [0/1]
Tests: [PASSED]/[TOTAL]
Duration: [Xs]
```

### Coverage Report
```
$ npm run test:coverage
[COVERAGE SUMMARY]
Lines: [X]%
Branches: [X]%
Functions: [X]%
Statements: [X]%
```

### Security Audit
```
$ npm audit
[OUTPUT]
Vulnerabilities: [N] (H:[N] M:[N] L:[N])
```

### Lint Results
```
$ npm run lint
[OUTPUT]
Errors: [N]
Warnings: [N]
```

---

## Top 15 Issues (Prioritized)

### P0 - Critical (Must Fix)
| # | Issue | Category | Impact | Fix Effort |
|---|-------|----------|--------|------------|
| 1 | [Description] | [Cat#] | [High/Med/Low] | [Hours] |
...

### P1 - High (Should Fix)
| # | Issue | Category | Impact | Fix Effort |
|---|-------|----------|--------|------------|
...

### P2 - Medium (Nice to Have)
...

---

## Top 10 Strengths

| # | Strength | Category | Evidence |
|---|----------|----------|----------|
| 1 | [Description] | [Cat#] | [File/Metric] |
...

---

## Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)
- [ ] Issue 1: [Description] - [Effort]
- [ ] Issue 2: [Description] - [Effort]
...

### Phase 2: High Priority (Weeks 2-3)
...

### Phase 3: Medium Priority (Weeks 4-6)
...

### Phase 4: Polish (Ongoing)
...

---

## Appendices

### A. File Inventory
[Complete file list with LOC]

### B. Dependency Tree
[npm ls output]

### C. Test Results Detail
[Full test output]

### D. Coverage Detail
[Per-file coverage]

### E. Benchmark Results
[If run]

---

**Report Generated By:** [AGENT]
**Analysis Completed:** [TIMESTAMP]
```

---

## Category 101: Evidence Collection Protocol

### Required Evidence Artifacts

| Artifact | Command | File |
|----------|---------|------|
| Build output | `npm run build 2>&1` | `evidence/build.log` |
| Type check | `npm run typecheck 2>&1` | `evidence/typecheck.log` |
| Test results | `npm test 2>&1` | `evidence/tests.log` |
| Coverage | `npm run test:coverage 2>&1` | `evidence/coverage.log` |
| Lint | `npm run lint 2>&1` | `evidence/lint.log` |
| Audit | `npm audit --json` | `evidence/audit.json` |
| Dependencies | `npm ls --json` | `evidence/deps.json` |
| Git log | `git log --oneline -50` | `evidence/git.log` |

### Evidence Directory Structure

```
analysis-output/
├── evidence/
│   ├── build.log
│   ├── typecheck.log
│   ├── tests.log
│   ├── coverage.log
│   ├── lint.log
│   ├── audit.json
│   ├── deps.json
│   └── git.log
├── screenshots/
│   └── (if applicable)
├── metrics/
│   ├── loc.json
│   ├── complexity.json
│   └── coverage-detail.json
└── ANALYSIS_REPORT.md
```

---

## Category 102: Failure Recovery Procedures

### Command Failure Handling

```
IF npm install FAILS:
  1. Check node version: node -v (need 20+)
  2. Clear cache: npm cache clean --force
  3. Delete node_modules: rm -rf node_modules
  4. Retry: npm install
  5. If still fails: Report dependency resolution error

IF npm run build FAILS:
  1. Run: npm run typecheck (isolate type errors)
  2. Check: tsconfig.json validity
  3. Look for: Missing imports, type mismatches
  4. Report: Specific compilation errors

IF npm test FAILS:
  1. Identify failing tests from output
  2. Run single test: npm test -- [test-file]
  3. Check for: Environment issues, missing mocks
  4. Categorize: Test bug vs code bug
  5. Report: Which tests fail and why

IF npm audit FAILS:
  1. Try: npm audit --registry https://registry.npmjs.org
  2. Check: Network connectivity
  3. If blocked: Note and continue with warning
```

### Recovery Commands

```bash
# Full reset
rm -rf node_modules dist package-lock.json
npm install
npm run build

# Fix common issues
npm dedupe                    # Fix duplicate deps
npm update                    # Update to latest compatible
npm rebuild                   # Rebuild native modules

# Diagnostic commands
npm doctor                    # Check npm health
npm ls --all 2>&1 | head -100 # Check dep tree
node --version               # Verify node version
```

---

## Category 103: Checkpoint & Resume Protocol

### Progress Checkpointing

After completing each phase, save state:

```markdown
# Analysis Checkpoint

## Completed Phases
- [x] Phase 1: Pre-flight (completed at [TIME])
- [x] Phase 2: Build verification (completed at [TIME])
- [ ] Phase 3: Test execution (in progress)
- [ ] Phase 4: Security audit
- [ ] Phase 5: Scoring

## Current State
- Last command: npm test
- Last file analyzed: src/handlers/values.ts
- Categories scored: 1-12

## Partial Results
[Include any scores/findings so far]

## Resume Instructions
1. Start from Phase 3
2. Continue from test output analysis
3. Skip pre-flight (already passed)
```

### Resume Protocol

```
TO RESUME ANALYSIS:
1. Read checkpoint file
2. Verify environment unchanged (git status)
3. Skip completed phases
4. Continue from last checkpoint
5. Merge results with previous partial results
```

---

## Category 104: Agent Coordination Protocol

### Multi-Agent Work Division

```yaml
# If using multiple agents simultaneously:

Agent Alpha (Build & Quality):
  - npm run build
  - npm run typecheck
  - npm run lint
  - Categories: 17-32

Agent Beta (Testing):
  - npm test
  - npm run test:coverage
  - Test analysis
  - Categories: 24, 71-73

Agent Gamma (Security):
  - npm audit
  - Secret scanning
  - Security analysis
  - Categories: 12, 75-78

Agent Delta (Documentation):
  - Doc completeness check
  - Example verification
  - Categories: 26, 61, 69

Lead Agent (Synthesis):
  - Collect all agent reports
  - Resolve conflicts
  - Generate final report
  - Score all categories
```

### Handoff Protocol

```markdown
# Agent Handoff Document

## From: Agent Alpha
## To: Lead Agent
## Phase: Build & Quality Complete

### Results Summary
- Build: PASS (0 errors)
- Typecheck: PASS (0 errors)
- Lint: PASS (12 warnings)

### Categories Scored
| Category | Score | Notes |
|----------|-------|-------|
| 17 | 9 | Excellent Zod usage |
| 18 | 8 | Minor type gaps |
...

### Artifacts
- evidence/build.log
- evidence/typecheck.log
- evidence/lint.log

### Handoff Notes
- Warning: 12 lint warnings need review
- Found: Unused export in src/utils/deprecated.ts
```

---

## Category 105: Issue Classification Taxonomy

### Issue Severity Levels

| Level | Code | Definition | Response Time |
|-------|------|------------|---------------|
| **Critical** | P0 | Blocking, security, data loss | Immediate |
| **High** | P1 | Major functionality impact | This sprint |
| **Medium** | P2 | Moderate impact, workaround exists | Next sprint |
| **Low** | P3 | Minor, cosmetic, nice-to-have | Backlog |

### Issue Categories

```yaml
Categories:
  Security:
    - SEC-001: Authentication bypass
    - SEC-002: Token exposure
    - SEC-003: Injection vulnerability
    - SEC-004: Missing encryption
    
  Functionality:
    - FUNC-001: Missing tool
    - FUNC-002: Broken action
    - FUNC-003: Incorrect behavior
    - FUNC-004: Missing validation
    
  Performance:
    - PERF-001: Slow response
    - PERF-002: Memory leak
    - PERF-003: Missing caching
    - PERF-004: Unbounded query
    
  Quality:
    - QUAL-001: Missing tests
    - QUAL-002: Low coverage
    - QUAL-003: Type safety gap
    - QUAL-004: Dead code
    
  Documentation:
    - DOC-001: Missing docs
    - DOC-002: Outdated docs
    - DOC-003: Inaccurate docs
    - DOC-004: Missing examples
    
  Protocol:
    - MCP-001: Missing primitive
    - MCP-002: Wrong response format
    - MCP-003: Missing annotation
    - MCP-004: SDK incompatibility
```

### Issue Template

```markdown
## Issue: [ID] [Title]

**Severity:** P[0-3]
**Category:** [Category Code]
**Affected Category:** #[N]

### Description
[What is the issue]

### Evidence
[Command output, file reference, screenshot]

### Impact
[What breaks, what's at risk]

### Suggested Fix
[How to resolve]

### Effort Estimate
[Hours/Days]

### Dependencies
[Other issues that must be fixed first]
```

---

## Category 106: Baseline Expectations

### Expected Metrics (Must Meet)

| Metric | Minimum | Target | Source |
|--------|---------|--------|--------|
| Tests Passing | 1,500 | 1,830 | PROJECT_OVERVIEW.md |
| Line Coverage | 75% | 85% | Industry standard |
| Branch Coverage | 70% | 80% | Industry standard |
| TypeScript Errors | 0 | 0 | Strict mode |
| ESLint Errors | 0 | 0 | Quality gate |
| Security High/Critical | 0 | 0 | Security gate |
| Build Time | <60s | <30s | Performance |
| Test Time | <120s | <60s | Performance |

### Expected Tool Counts

| Component | Expected | Source |
|-----------|----------|--------|
| Tools | 27 | PROJECT_OVERVIEW.md |
| Actions | 208 | PROJECT_OVERVIEW.md |
| Schemas | 25 | PROJECT_OVERVIEW.md |
| Resources | 13+ | PROJECT_OVERVIEW.md |
| Prompts | 6 | PROJECT_OVERVIEW.md |
| Intent Types | 95+ | PROJECT_OVERVIEW.md |

### Expected File Counts

| Category | Expected | Location |
|----------|----------|----------|
| TypeScript Files | 203 | src/ |
| Test Files | 95 | tests/ |
| Handler Files | 21+ | src/handlers/ |
| Service Files | 25+ | src/services/ |
| Schema Files | 25 | src/schemas/ |

---

## Quick Start for VS Code Agents

### Initialization Sequence

```bash
# Step 1: Open terminal in VS Code
cd /path/to/servalsheets

# Step 2: Create evidence directory
mkdir -p analysis-output/evidence analysis-output/metrics

# Step 3: Run master analysis
npm run ci 2>&1 | tee analysis-output/evidence/ci.log

# Step 4: Generate coverage
npm run test:coverage 2>&1 | tee analysis-output/evidence/coverage.log

# Step 5: Security audit
npm audit --json > analysis-output/evidence/audit.json

# Step 6: Collect metrics
wc -l src/**/*.ts > analysis-output/metrics/loc.txt
npm ls --json > analysis-output/evidence/deps.json

# Step 7: Generate report
# [Agent generates ANALYSIS_REPORT.md based on evidence]
```

### One-Command Full Analysis

```bash
#!/bin/bash
# full-analysis.sh

echo "🔍 ServalSheets Full Analysis Starting..."
mkdir -p analysis-output/evidence

echo "📦 Installing dependencies..."
npm ci 2>&1 | tee analysis-output/evidence/install.log

echo "🔨 Building..."
npm run build 2>&1 | tee analysis-output/evidence/build.log

echo "📝 Type checking..."
npm run typecheck 2>&1 | tee analysis-output/evidence/typecheck.log

echo "🔍 Linting..."
npm run lint 2>&1 | tee analysis-output/evidence/lint.log

echo "🧪 Running tests..."
npm test 2>&1 | tee analysis-output/evidence/tests.log

echo "📊 Coverage report..."
npm run test:coverage 2>&1 | tee analysis-output/evidence/coverage.log

echo "🔐 Security audit..."
npm audit --json > analysis-output/evidence/audit.json 2>&1

echo "✅ Validations..."
npm run validate:server-json 2>&1 | tee analysis-output/evidence/validate.log

echo "🏁 Analysis complete! Evidence in analysis-output/"
```

### Agent Start Prompt

Copy this to start the analysis:

```
I am a ServalSheets Analysis Agent. I will now execute a comprehensive 
96-category audit of the ServalSheets MCP server.

My approach:
1. Execute all npm commands and capture output
2. Analyze all source files systematically  
3. Score each of 96 categories from 0-10
4. Identify and prioritize issues
5. Generate implementation roadmap
6. Produce final ANALYSIS_REPORT.md

Starting analysis now...

[Execute: ./full-analysis.sh]
```

---

## Final Checklist Before Running

### Pre-Analysis Verification

- [ ] Node.js 20+ installed (`node -v`)
- [ ] NPM 10+ installed (`npm -v`)
- [ ] Git repository clean (`git status`)
- [ ] Dependencies installed (`npm ci`)
- [ ] Build succeeds (`npm run build`)
- [ ] VS Code extensions installed
- [ ] Terminal access available
- [ ] Sufficient disk space (1GB free)
- [ ] analysis-output/ directory created

### Agent Readiness Checklist

- [ ] MASTER_ANALYSIS_PROMPT.md loaded
- [ ] PROJECT_OVERVIEW.md referenced
- [ ] All 96 categories understood
- [ ] Scoring rubric clear
- [ ] Report template ready
- [ ] Evidence collection planned
- [ ] Failure recovery known

---

**TOTAL CATEGORIES: 106**
**MAXIMUM SCORE: 140% (with bonuses)**
**ESTIMATED TIME: 2-4 hours for full analysis**

---

# END OF MASTER ANALYSIS PROMPT
