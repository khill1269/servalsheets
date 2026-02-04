---
title: Tools Overview
category: reference
last_updated: 2026-01-31
description: ServalSheets provides 21 MCP tools with 291 total actions covering the complete Google Sheets API v4.
version: 1.6.0
tags: [sheets]
stability: stable
---

# Tools Overview

ServalSheets provides 21 MCP tools with 291 total actions covering the complete Google Sheets API v4.

## Tool Categories

| Tool                  | Actions | Description                                              |
| --------------------- | ------- | -------------------------------------------------------- |
| `sheets_auth`         | 4       | OAuth status/login/callback/logout                       |
| `sheets_core`         | 17      | Spreadsheet + sheet metadata and management              |
| `sheets_data`         | 18      | Read/write/append/clear values, notes, links, merges     |
| `sheets_format`       | 21      | Formatting, borders, number formats, validation, rules   |
| `sheets_dimensions`   | 28      | Rows/columns, filters, sort, filter views, slicers       |
| `sheets_visualize`    | 18      | Charts + pivots (create/update/list)                     |
| `sheets_collaborate`  | 28      | Sharing, comments, revisions, snapshots                  |
| `sheets_advanced`     | 23      | Named ranges, protections, metadata, banding, chips      |
| `sheets_transaction`  | 6       | Begin/queue/commit/rollback/status/list                  |
| `sheets_quality`      | 4       | Validation, conflicts, impact analysis                   |
| `sheets_history`      | 7       | History, undo/redo, revert                               |
| `sheets_confirm`      | 5       | Elicitation-based confirmations                          |
| `sheets_analyze`      | 16      | AI analysis + planning (comprehensive, scout, plan, etc) |
| `sheets_fix`          | 1       | Auto-fix detected issues                                 |
| `sheets_composite`    | 10      | CSV/XLSX import/export, smart append, dedupe, setup      |
| `sheets_session`      | 17      | Context, preferences, checkpoints                        |
| `sheets_templates`    | 8       | Template management                                      |
| `sheets_bigquery`     | 14      | Connected Sheets + BigQuery query/import/export          |
| `sheets_appsscript`   | 14      | Apps Script project/deploy/run                           |
| `sheets_webhook`      | 6       | Webhook register/test/stats                              |
| `sheets_dependencies` | 7       | Dependency graph + impact analysis                       |

## Common Parameters

All tools share these common parameters:

### Required

| Parameter       | Type   | Description                                |
| --------------- | ------ | ------------------------------------------ |
| `action`        | string | The specific action to perform             |
| `spreadsheetId` | string | Spreadsheet ID (required for most actions) |

### Optional (Safety Rails)

| Parameter       | Type    | Default | Description                       |
| --------------- | ------- | ------- | --------------------------------- |
| `dryRun`        | boolean | `false` | Preview changes without executing |
| `effectScope`   | object  | -       | Limit affected rows/columns       |
| `expectedState` | object  | -       | Validate state before write       |
| `confirm`       | boolean | `false` | Request user confirmation         |

## Response Format

All tools return structured responses:

```typescript
interface ToolResponse {
  success: boolean;
  action: string;
  spreadsheetId: string;
  data?: any;
  metadata?: {
    rowsAffected?: number;
    cellsModified?: number;
    apiCalls?: number;
    duration?: number;
  };
  error?: {
    code: string;
    message: string;
    recovery?: string;
  };
}
```

## Safety Features

### Dry Run Mode

Preview any operation before execution:

```json
{
  "tool": "sheets_data",
  "action": "write",
  "spreadsheetId": "...",
  "range": "A1:B10",
  "values": [["Header", "Value"]],
  "dryRun": true
}
```

Response shows what _would_ happen without making changes.

### Effect Scope Limits

Prevent accidental large operations:

```json
{
  "tool": "sheets_dimensions",
  "action": "delete",
  "spreadsheetId": "...",
  "sheetId": 0,
  "dimension": "ROWS",
  "startIndex": 0,
  "endIndex": 1000,
  "effectScope": {
    "maxRows": 100
  }
}
```

Fails if operation would exceed limits.

### User Confirmations

Request explicit user approval:

```json
{
  "tool": "sheets_data",
  "action": "clear",
  "spreadsheetId": "...",
  "range": "A:Z",
  "confirm": true
}
```

Uses MCP Elicitation to show confirmation dialog.

## Error Handling

Errors include recovery suggestions:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Google API rate limit exceeded",
    "recovery": "Wait 60 seconds and retry. Consider enabling request deduplication."
  }
}
```

Common error codes:

- `INVALID_SPREADSHEET` - Spreadsheet not found or no access
- `INVALID_RANGE` - Range notation error
- `RATE_LIMITED` - API quota exceeded
- `PERMISSION_DENIED` - Insufficient permissions
- `VALIDATION_ERROR` - Schema validation failed

## Next Steps

- [sheets_data](./tools/sheets_data) - Data operations
- [Examples](/examples/) - Usage examples
- [Prompts Guide](/guides/PROMPTS_GUIDE) - Natural language patterns
