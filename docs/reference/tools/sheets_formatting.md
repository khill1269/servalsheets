# sheets_formatting Tool Reference

Apply cell formatting, number formats, colors, and text styles.

## Overview

The `sheets_formatting` tool provides actions for:
- Cell formatting (colors, borders, alignment)
- Number and date formats
- Text styling (bold, italic, fonts)
- Conditional formatting
- Format management

## Actions

### Basic Formatting

#### `set_format`
Apply formatting to a range of cells.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range
- `format` (object, required): Format specification

**Format properties**:
```json
{
  "backgroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0},
  "textFormat": {
    "bold": true,
    "italic": false,
    "fontSize": 12,
    "fontFamily": "Arial",
    "foregroundColor": {"red": 0.0, "green": 0.0, "blue": 0.0}
  },
  "horizontalAlignment": "CENTER",
  "verticalAlignment": "MIDDLE",
  "wrapStrategy": "WRAP",
  "numberFormat": {
    "type": "CURRENCY",
    "pattern": "$#,##0.00"
  },
  "borders": {
    "top": {"style": "SOLID", "width": 1},
    "bottom": {"style": "SOLID", "width": 1},
    "left": {"style": "SOLID", "width": 1},
    "right": {"style": "SOLID", "width": 1}
  }
}
```

#### `clear_format`
Remove all formatting from a range while keeping data.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range

#### `copy_format`
Copy formatting from one range to another.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sourceRange` (string, required): Source A1 notation
- `targetRange` (string, required): Target A1 notation
- `pasteType` (string, optional): `FORMAT_ONLY` (default), `ALL`

### Number Formats

#### Common number format types:
- `NUMBER` - General number: `#,##0.00`
- `CURRENCY` - Currency: `$#,##0.00`
- `PERCENT` - Percentage: `0.00%`
- `DATE` - Date: `M/D/YYYY`
- `TIME` - Time: `h:mm:ss AM/PM`
- `DATE_TIME` - Combined: `M/D/YYYY h:mm:ss`
- `SCIENTIFIC` - Scientific notation: `0.00E+00`
- `TEXT` - Force text: `@`

**Custom patterns**:
```json
{
  "numberFormat": {
    "type": "NUMBER",
    "pattern": "[Green]#,##0.00;[Red]-#,##0.00"
  }
}
```

### Text Formatting

#### Text properties:
```json
{
  "textFormat": {
    "bold": true,
    "italic": false,
    "underline": false,
    "strikethrough": false,
    "fontSize": 12,
    "fontFamily": "Arial",
    "foregroundColor": {
      "red": 0.0,
      "green": 0.0,
      "blue": 0.0
    }
  }
}
```

**Font families**: Arial, Calibri, Comic Sans MS, Courier New, Georgia, Times New Roman, Trebuchet MS, Verdana

### Colors

#### RGB color specification (0.0 to 1.0):
```json
{
  "red": 1.0,
  "green": 0.5,
  "blue": 0.25
}
```

**Common colors**:
- Red: `{"red": 1.0, "green": 0.0, "blue": 0.0}`
- Green: `{"red": 0.0, "green": 1.0, "blue": 0.0}`
- Blue: `{"red": 0.0, "green": 0.0, "blue": 1.0}`
- Black: `{"red": 0.0, "green": 0.0, "blue": 0.0}`
- White: `{"red": 1.0, "green": 1.0, "blue": 1.0}`
- Gray: `{"red": 0.5, "green": 0.5, "blue": 0.5}`

### Alignment

**Horizontal**: `LEFT`, `CENTER`, `RIGHT`
**Vertical**: `TOP`, `MIDDLE`, `BOTTOM`

**Text wrapping**:
- `OVERFLOW_CELL` - Text overflows into adjacent cells
- `WRAP` - Text wraps within cell
- `CLIP` - Text is clipped at cell boundary

### Borders

#### Border styles:
- `SOLID` - Single solid line
- `DOTTED` - Dotted line
- `DASHED` - Dashed line
- `DOUBLE` - Double line
- `SOLID_MEDIUM` - Thicker solid line
- `SOLID_THICK` - Thickest solid line

#### Border positions:
```json
{
  "top": {"style": "SOLID", "width": 1, "color": {...}},
  "bottom": {"style": "SOLID", "width": 1, "color": {...}},
  "left": {"style": "SOLID", "width": 1, "color": {...}},
  "right": {"style": "SOLID", "width": 1, "color": {...}},
  "innerHorizontal": {"style": "SOLID", "width": 1, "color": {...}},
  "innerVertical": {"style": "SOLID", "width": 1, "color": {...}}
}
```

## Conditional Formatting

### `add_conditional_format`
Apply conditional formatting rules.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range
- `rule` (object, required): Conditional format rule

**Rule types**:

**Value-based**:
```json
{
  "condition": {
    "type": "NUMBER_GREATER",
    "values": [{"userEnteredValue": "100"}]
  },
  "format": {
    "backgroundColor": {"red": 0.0, "green": 1.0, "blue": 0.0}
  }
}
```

**Text contains**:
```json
{
  "condition": {
    "type": "TEXT_CONTAINS",
    "values": [{"userEnteredValue": "ERROR"}]
  },
  "format": {
    "backgroundColor": {"red": 1.0, "green": 0.0, "blue": 0.0}
  }
}
```

**Color scale**:
```json
{
  "gradientRule": {
    "minpoint": {
      "color": {"red": 1.0, "green": 0.0, "blue": 0.0},
      "type": "MIN"
    },
    "maxpoint": {
      "color": {"red": 0.0, "green": 1.0, "blue": 0.0},
      "type": "MAX"
    }
  }
}
```

### `remove_conditional_format`
Delete conditional formatting rules.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range

## Common Use Cases

### Professional Header Style
```json
{
  "backgroundColor": {"red": 0.1, "green": 0.2, "blue": 0.5},
  "textFormat": {
    "bold": true,
    "fontSize": 12,
    "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}
  },
  "horizontalAlignment": "CENTER",
  "verticalAlignment": "MIDDLE"
}
```

### Currency Format
```json
{
  "numberFormat": {
    "type": "CURRENCY",
    "pattern": "$#,##0.00"
  },
  "horizontalAlignment": "RIGHT"
}
```

### Date Format
```json
{
  "numberFormat": {
    "type": "DATE",
    "pattern": "YYYY-MM-DD"
  },
  "horizontalAlignment": "CENTER"
}
```

### Alternating Row Colors
```
Apply conditional formatting with custom formula:
- Formula: =MOD(ROW(),2)=0
- Format: Light gray background
```

## Best Practices

1. **Batch format operations** - Update multiple ranges together
2. **Use consistent color schemes** - Maintain visual coherence
3. **Test with sample data** - Preview formatting before applying
4. **Consider accessibility** - Ensure adequate color contrast
5. **Document format standards** - Share formatting guidelines with team
6. **Avoid over-formatting** - Too many colors reduce readability

## Performance Tips

1. **Minimize API calls** - Combine multiple format changes
2. **Use conditional formatting** for dynamic styling
3. **Cache format specifications** - Reuse format objects
4. **Clear unused formats** - Remove obsolete formatting

## Error Handling

**Common errors**:
- `INVALID_RANGE` - Malformed A1 notation
- `INVALID_COLOR` - RGB values outside 0.0-1.0 range
- `INVALID_FORMAT_PATTERN` - Malformed number format pattern

**Error prevention**:
- Validate range notation
- Check RGB values in range
- Test number format patterns
- Verify font family names

## Related Tools

- [sheets_structure](./sheets_structure.md) - Sheet management
- [sheets_data](./sheets_data.md) - Data operations
- [sheets_dimensions](../guides/ACTION_REFERENCE.md) - Column/row sizing

## See Also

- [Formatting Guide](../examples/formatting.md) - Complete formatting examples
- [Action Reference](../guides/ACTION_REFERENCE.md) - All available actions
- [Usage Guide](../guides/USAGE_GUIDE.md) - General usage patterns
