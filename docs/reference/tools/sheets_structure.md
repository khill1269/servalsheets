# sheets_structure Tool Reference

Manage spreadsheet and sheet structure, metadata, and organization.

## Overview

The `sheets_structure` tool provides actions for:
- Managing sheets (create, delete, rename, reorder)
- Handling named ranges
- Managing data validation rules
- Working with protected ranges
- Controlling sheet properties

## Actions

### Sheet Management

#### `create_sheet`
Create a new sheet in the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `title` (string, required): Sheet title
- `index` (number, optional): Position index (0-based)
- `gridProperties` (object, optional): Grid configuration

**Example**:
```json
{
  "tool": "sheets_structure",
  "action": "create_sheet",
  "spreadsheetId": "1abc...xyz",
  "title": "Q1 Data",
  "index": 1
}
```

#### `delete_sheet`
Delete a sheet from the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sheetId` (number, required): Sheet ID to delete

**Warning**: This operation cannot be undone.

#### `rename_sheet`
Rename an existing sheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sheetId` (number, required): Sheet ID to rename
- `title` (string, required): New sheet title

#### `reorder_sheets`
Change the order of sheets in the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sheetId` (number, required): Sheet ID to move
- `newIndex` (number, required): Target position (0-based)

#### `duplicate_sheet`
Create a copy of an existing sheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sourceSheetId` (number, required): Sheet ID to duplicate
- `newSheetName` (string, optional): Name for the copy

### Named Ranges

#### `add_named_range`
Create a named range for easy reference.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `name` (string, required): Named range identifier
- `range` (string, required): A1 notation range

**Example**:
```json
{
  "tool": "sheets_structure",
  "action": "add_named_range",
  "spreadsheetId": "1abc...xyz",
  "name": "Budget2024",
  "range": "Sheet1!A1:E100"
}
```

#### `delete_named_range`
Remove a named range.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `namedRangeId` (string, required): Named range ID to delete

#### `list_named_ranges`
Get all named ranges in the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID

**Returns**: Array of named range objects with names, IDs, and ranges.

### Data Validation

#### `set_data_validation`
Apply validation rules to a range.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range
- `rule` (object, required): Validation rule specification

**Validation types**:
- `ONE_OF_LIST` - Dropdown list
- `ONE_OF_RANGE` - Values from range
- `NUMBER_GREATER` - Number constraints
- `DATE_BETWEEN` - Date range
- `CUSTOM_FORMULA` - Custom validation

**Example**:
```json
{
  "rule": {
    "condition": {
      "type": "ONE_OF_LIST",
      "values": [
        {"userEnteredValue": "Active"},
        {"userEnteredValue": "Pending"},
        {"userEnteredValue": "Closed"}
      ]
    },
    "showCustomUi": true,
    "strict": true
  }
}
```

#### `clear_data_validation`
Remove validation rules from a range.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range

### Protected Ranges

#### `add_protected_range`
Protect a range from editing.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range
- `description` (string, optional): Protection description
- `warningOnly` (boolean, optional): Show warning instead of blocking

**Protection options**:
- Block all edits (except by editors)
- Warning only (show alert but allow)
- Editors can edit (specify who)

#### `remove_protected_range`
Remove protection from a range.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `protectedRangeId` (number, required): Protected range ID

#### `list_protected_ranges`
Get all protected ranges in the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID

### Sheet Properties

#### `update_sheet_properties`
Modify sheet-level properties.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sheetId` (number, required): Sheet ID
- `properties` (object, required): Properties to update

**Updatable properties**:
- `title` - Sheet name
- `index` - Position in tabs
- `hidden` - Visibility
- `tabColor` - Tab color
- `gridProperties` - Rows, columns, frozen rows/columns

**Example**:
```json
{
  "properties": {
    "tabColor": {
      "red": 1.0,
      "green": 0.0,
      "blue": 0.0
    },
    "hidden": false
  }
}
```

## Common Use Cases

### Create Monthly Report Template
```
1. Create sheet "January 2026"
2. Set tab color to blue
3. Add named range "JanData" for A1:E100
4. Protect header row A1:E1
5. Add data validation for status column
```

### Organize Workbook
```
1. Create sheets: Data, Analysis, Charts, Archive
2. Reorder sheets in logical sequence
3. Color-code tabs by function
4. Hide Archive sheet
5. Protect Analysis formulas
```

### Data Entry Form Setup
```
1. Create "Input" sheet
2. Add data validation dropdowns
3. Protect formula columns
4. Add named ranges for key sections
5. Set sheet permissions
```

## Best Practices

1. **Use named ranges** for important data regions
2. **Protect formula columns** to prevent accidental changes
3. **Validate input data** at point of entry
4. **Organize sheets logically** with clear names
5. **Color-code tabs** for quick navigation
6. **Hide archive sheets** to reduce clutter
7. **Document protections** with clear descriptions

## Error Handling

**Common errors**:
- `SHEET_NOT_FOUND` - Invalid sheet ID
- `DUPLICATE_NAME` - Sheet name already exists
- `INVALID_RANGE` - Malformed A1 notation
- `PROTECTED_RANGE_CONFLICT` - Overlapping protections
- `PERMISSION_DENIED` - Insufficient access

**Error prevention**:
- Verify sheet exists before operations
- Check for name conflicts
- Validate range notation
- Review protection hierarchy
- Ensure adequate permissions

## Related Tools

- [sheets_data](./sheets_data.md) - Data operations
- [sheets_formatting](./sheets_formatting.md) - Cell formatting
- [sheets_analysis](./sheets_analysis.md) - Analysis tools
- [sheets_advanced](../guides/ACTION_REFERENCE.md) - Advanced operations

## See Also

- [Usage Guide](../guides/USAGE_GUIDE.md) - General usage patterns
- [Action Reference](../guides/ACTION_REFERENCE.md) - Complete action list
- [Examples](../examples/) - Practical examples
