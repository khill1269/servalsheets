---
title: 'Part 2: Protocol Compliance (Categories 13-16)'
category: general
last_updated: 2026-01-31
description: 'Weight: 18% of base score'
version: 1.6.0
tags: [sheets]
---

# Part 2: Protocol Compliance (Categories 13-16)

**Weight: 18% of base score**

---

## Category 13: MCP 2025-11-25 Specification (12%)

### Core Protocol

- [ ] tools/list, tools/call
- [ ] resources/list, resources/read, resources/subscribe
- [ ] prompts/list, prompts/get
- [ ] completion/complete
- [ ] logging/setLevel

### SEP-1686: Tasks

- [ ] Task states: working, input_required, completed, failed, cancelled
- [ ] tasks/get, tasks/result, tasks/list, tasks/cancel
- [ ] Task hints for async operations

### SEP-1036: Elicitation

- [ ] Form mode (JSON Schema)
- [ ] URL mode (browser OAuth)
- [ ] elicitation/create
- [ ] Result handling (accept, decline, cancel)

### SEP-1577: Sampling with Tools

- [ ] sampling/createMessage with tools
- [ ] Server-side agent loops
- [ ] Multi-step reasoning

### SEP-973: Tool Annotations

- [ ] readOnlyHint, destructiveHint
- [ ] idempotentHint, openWorldHint
- [ ] Icon support

### Other Features

- [ ] Structured outputs (outputSchema)
- [ ] Progress notifications
- [ ] Well-known URLs
- [ ] Resource Indicators (RFC 8707)

### Files to Check

```
src/mcp/registration.ts
src/mcp/elicitation.ts
src/mcp/sampling.ts
src/mcp/completions.ts
src/core/task-store.ts
package.json (SDK version)
```

### Questions

1. MCP SDK version? (target: ≥1.25.2)
2. All 5 primitives implemented?
3. Tasks (SEP-1686) working?
4. Elicitation (SEP-1036) in sheets_confirm?
5. Sampling (SEP-1577) in sheets_analyze?
6. Tool annotations on all 22 tools?

---

## Category 14: Google Sheets API v4 (8%)

### spreadsheets Collection

- [ ] create - New spreadsheet
- [ ] get - Metadata (with/without grid)
- [ ] batchUpdate - 60+ request types

### values Collection

- [ ] get, batchGet
- [ ] update, batchUpdate
- [ ] append
- [ ] clear, batchClear

### Key BatchUpdate Requests

- [ ] AddSheet, DeleteSheet, DuplicateSheet
- [ ] UpdateCells, RepeatCell
- [ ] InsertDimension, DeleteDimension
- [ ] MergeCells, UnmergeCells
- [ ] SetDataValidation
- [ ] AddConditionalFormatRule
- [ ] AddChart, UpdateChartSpec
- [ ] AddNamedRange, AddProtectedRange
- [ ] FindReplace

### Best Practices

- [ ] includeGridData=false default
- [ ] Field masks for partial response
- [ ] Exponential backoff (429/5xx)
- [ ] Rate limit compliance (100/100s/user)

### Files to Check

```
src/services/google-api.ts
src/core/batch-compiler.ts
src/handlers/*.ts
```

### Questions

1. All values methods implemented?
2. How many batchUpdate types?
3. Is field masking used?
4. Is backoff implemented?

---

## Category 15: Google Drive API v3 (4%)

### Files Collection

- [ ] get - File metadata
- [ ] list - Search files
- [ ] create - Upload new
- [ ] update - Modify
- [ ] delete - Trash/permanent
- [ ] copy - Duplicate
- [ ] export - PDF/CSV

### Permissions Collection

- [ ] list, get
- [ ] create, update, delete
- [ ] Roles: owner, organizer, writer, commenter, reader

### Revisions Collection

- [ ] list - Version history
- [ ] get - Specific version
- [ ] update - Modify (keepForever)
- [ ] delete - Remove version

### Comments Collection

- [ ] list, get, create
- [ ] update, delete
- [ ] replies - Threaded comments

### Files to Check

```
src/handlers/sharing.ts
src/handlers/versions.ts
src/handlers/comments.ts
src/services/google-api.ts
```

### Questions

1. Can export to PDF/CSV?
2. Is sharing via Drive API?
3. Are revisions listable?
4. Can comments anchor to cells?

---

## Category 16: BigQuery / Connected Sheets (3%)

### Data Sources

- [ ] AddDataSource
- [ ] UpdateDataSource
- [ ] RefreshDataSource
- [ ] DeleteDataSource

### Data Objects

- [ ] DataSourceTable
- [ ] DataSourcePivotTable
- [ ] DataSourceChart
- [ ] DataSourceFormula (QUERY function)

### Async Execution

- [ ] DataExecutionStatus tracking
- [ ] RUNNING, SUCCEEDED, FAILED states
- [ ] Polling for completion

### Files to Check

```
src/handlers/advanced.ts
src/schemas/advanced.ts
```

### Questions

1. Is BigQuery integration supported?
2. Can DataSourceTable be created?
3. Is async execution tracked?

---

## Scoring Summary (Part 2)

| Category       | Weight                    | Score (0-10) | Weighted |
| -------------- | ------------------------- | ------------ | -------- |
| 13. MCP Spec   | 12%                       | \_\_\_       | \_\_\_   |
| 14. Sheets API | 8%                        | \_\_\_       | \_\_\_   |
| 15. Drive API  | 4%                        | \_\_\_       | \_\_\_   |
| 16. BigQuery   | 3%                        | \_\_\_       | \_\_\_   |
| **Total**      | **18%** (adjusted to sum) |              |          |

Note: Weights adjusted to reflect actual implementation priority.
