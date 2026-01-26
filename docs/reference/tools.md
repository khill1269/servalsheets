# Tools Overview

ServalSheets provides 22 MCP tools with 267 total actions covering the complete Google Sheets API v4.

## Tool Categories

| Tool                                               | Actions | Description                          |
| -------------------------------------------------- | ------- | ------------------------------------ |
| [`sheets_data`](./tools/sheets_data)               | 18      | Read, write, append, clear data      |
| [`sheets_structure`](./tools/sheets_structure)     | 18      | Sheets, rows, columns management     |
| [`sheets_formatting`](./tools/sheets_formatting)   | 22      | Cell styles, borders, colors         |
| [`sheets_advanced`](./tools/sheets_advanced)       | 20      | Named ranges, filters, protection    |
| [`sheets_charts`](./tools/sheets_charts)           | 12      | Create and modify charts             |
| [`sheets_pivots`](./tools/sheets_pivots)           | 8       | Pivot table operations               |
| [`sheets_validation`](./tools/sheets_validation)   | 10      | Data validation rules                |
| [`sheets_conditional`](./tools/sheets_conditional) | 14      | Conditional formatting               |
| [`sheets_analysis`](./tools/sheets_analysis)       | 16      | Pattern detection, profiling         |
| [`sheets_batch`](./tools/sheets_batch)             | 6       | Batch operations                     |
| [`sheets_metadata`](./tools/sheets_metadata)       | 8       | Spreadsheet properties               |
| [`sheets_export`](./tools/sheets_export)           | 4       | PDF, CSV export                      |
| [`sheets_import`](./tools/sheets_import)           | 4       | CSV, data import                     |
| [`sheets_merge`](./tools/sheets_merge)             | 6       | Cell merging                         |
| [`sheets_notes`](./tools/sheets_notes)             | 4       | Cell notes/comments                  |
| [`sheets_find`](./tools/sheets_find)               | 4       | Find and replace                     |
| [`sheets_confirm`](./tools/sheets_confirm)         | 2       | User confirmations (MCP Elicitation) |
| [`sheets_analyze`](./tools/sheets_analyze)         | 2       | AI analysis (MCP Sampling)           |
| [`sheets_task`](./tools/sheets_task)               | 3       | Background tasks                     |
| [`sheets_webhook`](./tools/sheets_webhook)         | 6       | Webhook notifications                |
| [`sheets_auth`](./tools/sheets_auth)               | 4       | OAuth authentication                 |
| [`sheets_core`](./tools/sheets_core)               | 6       | Core spreadsheet operations          |

## Common Parameters

All tools share these common parameters:

### Required

| Parameter       | Type   | Description                    |
| --------------- | ------ | ------------------------------ |
| `action`        | string | The specific action to perform |
| `spreadsheetId` | string | Google Sheets spreadsheet ID   |

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
  "tool": "sheets_structure",
  "action": "delete_rows",
  "spreadsheetId": "...",
  "sheetId": 0,
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
