# sheets_data

Core data operations for reading and writing spreadsheet data.

## Actions

| Action         | Description               |
| -------------- | ------------------------- |
| `read`         | Read values from a range  |
| `write`        | Write values to a range   |
| `append`       | Append rows to a sheet    |
| `clear`        | Clear values from a range |
| `batch_read`   | Read multiple ranges      |
| `batch_write`  | Write to multiple ranges  |
| `batch_clear`  | Clear multiple ranges     |
| `get_values`   | Get formatted values      |
| `get_formulas` | Get cell formulas         |
| `update_cells` | Update specific cells     |
| `copy_range`   | Copy range to destination |
| `cut_range`    | Cut range to destination  |
| `fill_range`   | Auto-fill a range         |
| `sort_range`   | Sort data in range        |
| `randomize`    | Randomize row order       |

## read

Read values from a spreadsheet range.

### Parameters

| Parameter              | Type   | Required | Description                   |
| ---------------------- | ------ | -------- | ----------------------------- |
| `spreadsheetId`        | string | ✅       | Spreadsheet ID                |
| `range`                | string | ✅       | A1 notation or named range    |
| `valueRenderOption`    | string |          | How values should be rendered |
| `dateTimeRenderOption` | string |          | How dates should be rendered  |

### Value Render Options

- `FORMATTED_VALUE` - As displayed in UI (default)
- `UNFORMATTED_VALUE` - Raw values
- `FORMULA` - Cell formulas

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

| Parameter          | Type      | Required | Description                     |
| ------------------ | --------- | -------- | ------------------------------- |
| `spreadsheetId`    | string    | ✅       | Spreadsheet ID                  |
| `range`            | string    | ✅       | Range to search for table       |
| `values`           | array[][] | ✅       | Rows to append                  |
| `valueInputOption` | string    |          | How input should be interpreted |
| `insertDataOption` | string    |          | How data is inserted            |

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

- [sheets_formatting](/reference/tools/sheets_formatting) - Cell formatting
- [sheets_structure](/reference/tools/sheets_structure) - Row/column operations
- [Examples](/examples/basic) - Basic usage examples
