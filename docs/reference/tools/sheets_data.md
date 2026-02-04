---
title: sheets_data
category: reference
last_updated: 2026-01-31
description: Core data operations for reading and writing spreadsheet data.
version: 1.6.0
tags: [sheets]
stability: stable
---

# sheets_data

Core data operations for reading and writing spreadsheet data.

## Actions

| Action         | Description                             |
| -------------- | --------------------------------------- |
| `read`         | Read values from a range                |
| `write`        | Write values to a range                 |
| `append`       | Append rows to a sheet or table         |
| `clear`        | Clear values from a range               |
| `batch_read`   | Read multiple ranges or dataFilters     |
| `batch_write`  | Write to multiple ranges or dataFilters |
| `batch_clear`  | Clear multiple ranges or dataFilters    |
| `get_values`   | Get formatted values                    |
| `get_formulas` | Get cell formulas                       |
| `update_cells` | Update specific cells                   |
| `copy_range`   | Copy range to destination               |
| `cut_range`    | Cut range to destination                |
| `fill_range`   | Auto-fill a range                       |
| `sort_range`   | Sort data in range                      |
| `randomize`    | Randomize row order                     |

## read

Read values from a spreadsheet range.

### Parameters

| Parameter              | Type    | Required | Description                                                                     |
| ---------------------- | ------- | -------- | ------------------------------------------------------------------------------- |
| `spreadsheetId`        | string  | ✅       | Spreadsheet ID                                                                  |
| `range`                | string  | ✅       | A1 notation or named range                                                      |
| `valueRenderOption`    | string  |          | How values should be rendered                                                   |
| `dateTimeRenderOption` | string  |          | How dates should be rendered                                                    |
| `streaming`            | boolean |          | Enable automatic pagination for large reads                                     |
| `chunkSize`            | number  |          | Rows per page when streaming (default: 1000)                                    |
| `cursor`               | string  |          | Opaque pagination cursor from previous response                                 |
| `pageSize`             | number  |          | Max rows per page (capped to keep payloads small; internal ~10k-cell heuristic) |

### Value Render Options

- `FORMATTED_VALUE` - As displayed in UI (default)
- `UNFORMATTED_VALUE` - Raw values
- `FORMULA` - Cell formulas

### Pagination

Large ranges are automatically paginated when the estimated cell count exceeds an internal
threshold (default ~10k cells) to keep payloads small. Responses may include `nextCursor`,
`hasMore`, and `totalRows`. Use `cursor` to fetch the next page. `pageSize` is capped so
each request stays within the cell budget.

Google Sheets API doesn't enforce a hard request-size limit, but it recommends keeping
payloads around 2 MB for performance. Pagination and smaller `pageSize` help stay within
that guideline.

### Example

```json
{
  "tool": "sheets_data",
  "action": "read",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A1:D10"
}
```

### Response

```json
{
  "success": true,
  "action": "read",
  "data": {
    "range": "Sheet1!A1:D10",
    "values": [
      ["Name", "Email", "Score", "Date"],
      ["Alice", "alice@example.com", 95, "2026-01-15"],
      ["Bob", "bob@example.com", 87, "2026-01-16"]
    ]
  },
  "metadata": {
    "rowsRead": 3,
    "columnsRead": 4,
    "apiCalls": 1,
    "duration": 145
  }
}
```

---

## write

Write values to a spreadsheet range.

### Parameters

| Parameter          | Type      | Required | Description                     |
| ------------------ | --------- | -------- | ------------------------------- |
| `spreadsheetId`    | string    | ✅       | Spreadsheet ID                  |
| `range`            | string    | ✅       | A1 notation                     |
| `values`           | array[][] | ✅       | 2D array of values              |
| `valueInputOption` | string    |          | How input should be interpreted |
| `dryRun`           | boolean   |          | Preview without writing         |

### Value Input Options

- `RAW` - Values stored as-is
- `USER_ENTERED` - Parsed as if typed in UI (default)

### Example

```json
{
  "tool": "sheets_data",
  "action": "write",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A1",
  "values": [
    ["Name", "Score"],
    ["Alice", 95],
    ["Bob", 87]
  ]
}
```

### Response

```json
{
  "success": true,
  "action": "write",
  "data": {
    "updatedRange": "Sheet1!A1:B3",
    "updatedRows": 3,
    "updatedColumns": 2,
    "updatedCells": 6
  },
  "metadata": {
    "apiCalls": 1,
    "duration": 234
  }
}
```

---

## append

Append rows to the end of data in a sheet.

### Parameters

| Parameter          | Type      | Required | Description                                                               |
| ------------------ | --------- | -------- | ------------------------------------------------------------------------- |
| `spreadsheetId`    | string    | ✅       | Spreadsheet ID                                                            |
| `range`            | string    | ✅\*     | Range to search for table (required unless `tableId` is provided)         |
| `tableId`          | string    | ✅\*     | Table ID to append to (preferred for tables; required if `range` omitted) |
| `values`           | array[][] | ✅       | Rows to append                                                            |
| `valueInputOption` | string    |          | How input should be interpreted                                           |
| `insertDataOption` | string    |          | How data is inserted                                                      |

### Insert Data Options

- `OVERWRITE` - Overwrite existing data (default)
- `INSERT_ROWS` - Insert new rows

### Example

```json
{
  "tool": "sheets_data",
  "action": "append",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A:D",
  "values": [["Charlie", "charlie@example.com", 92, "2026-01-17"]]
}
```

### Table append example

```json
{
  "tool": "sheets_data",
  "action": "append",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "tableId": "table-123",
  "values": [["Charlie", "charlie@example.com", 92, "2026-01-17"]]
}
```

---

## clear

Clear values from a range (formatting preserved).

### Parameters

| Parameter       | Type    | Required | Description               |
| --------------- | ------- | -------- | ------------------------- |
| `spreadsheetId` | string  | ✅       | Spreadsheet ID            |
| `range`         | string  | ✅       | Range to clear            |
| `confirm`       | boolean |          | Request user confirmation |

### Example

```json
{
  "tool": "sheets_data",
  "action": "clear",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A2:D100",
  "confirm": true
}
```

---

## batch_read / batch_write / batch_clear (dataFilters)

Batch operations can use either `ranges` or `dataFilters` (choose one).

### batch_read with dataFilters

```json
{
  "tool": "sheets_data",
  "action": "batch_read",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "dataFilters": [
    {
      "developerMetadataLookup": {
        "metadataKey": "dataset:customers"
      }
    }
  ]
}
```

### batch_write with dataFilters

```json
{
  "tool": "sheets_data",
  "action": "batch_write",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "data": [
    {
      "dataFilter": { "a1Range": "Sheet1!A1:B2" },
      "values": [
        ["Name", "Score"],
        ["Alice", 95]
      ]
    }
  ]
}
```

### batch_clear with dataFilters

```json
{
  "tool": "sheets_data",
  "action": "batch_clear",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "dataFilters": [{ "a1Range": "Sheet1!A2:D100" }]
}
```

---

## Semantic Range Resolution

ServalSheets supports semantic range queries in addition to A1 notation:

```json
{
  "tool": "sheets_data",
  "action": "read",
  "spreadsheetId": "...",
  "range": "header:Email"
}
```

Supported patterns:

- `header:ColumnName` - Column by header name
- `named:RangeName` - Named range
- `A1:B10` - Standard A1 notation
- `Sheet1!A:A` - Entire column

## Related

- [sheets_format](/reference/tools/sheets_format) - Cell formatting
- [sheets_core](/reference/tools/sheets_core) - Row/column operations
- [Examples](/examples/basic) - Basic usage examples
