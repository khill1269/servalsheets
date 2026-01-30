# sheets_charts Tool Reference

Create, customize, and manage charts and visualizations.

## Overview

The `sheets_charts` tool provides actions for:
- Creating charts (column, line, pie, scatter, etc.)
- Customizing chart appearance
- Positioning and sizing charts
- Updating chart data and configuration
- Managing chart lifecycle

## Actions

### Chart Creation

#### `create`
Create a new chart in the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sheetId` (number, required): Sheet ID where chart appears
- `chartType` (string, required): Chart type
- `sourceRanges` (array, required): Data ranges to chart
- `title` (string, optional): Chart title
- `position` (object, optional): Chart position
- `spec` (object, optional): Detailed chart specification

**Chart types**:
- `COLUMN` - Vertical bars
- `BAR` - Horizontal bars
- `LINE` - Line graph
- `AREA` - Filled area under line
- `PIE` - Pie chart
- `SCATTER` - XY scatter plot
- `COMBO` - Combined column and line
- `HISTOGRAM` - Distribution bars
- `CANDLESTICK` - Financial OHLC chart
- `WATERFALL` - Sequential changes
- `TREEMAP` - Hierarchical data
- `BUBBLE` - Three-variable scatter

**Example**:
```json
{
  "tool": "sheets_charts",
  "action": "create",
  "spreadsheetId": "1abc...xyz",
  "sheetId": 0,
  "chartType": "COLUMN",
  "sourceRanges": ["Sheet1!A1:B13"],
  "title": "Monthly Sales",
  "position": {
    "overlayPosition": {
      "anchorCell": {
        "sheetId": 0,
        "rowIndex": 14,
        "columnIndex": 3
      },
      "widthPixels": 600,
      "heightPixels": 400
    }
  }
}
```

### Chart Management

#### `update`
Update an existing chart.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `chartId` (number, required): Chart ID to update
- `spec` (object, optional): New chart specification
- `position` (object, optional): New position

**Updatable properties**:
- Title and subtitle
- Data ranges
- Series colors and styles
- Axis configuration
- Legend position
- Grid lines
- Position and size

#### `delete`
Remove a chart from the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `chartId` (number, required): Chart ID to delete

#### `list`
Get all charts in the spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `sheetId` (number, optional): Filter by specific sheet

**Returns**: Array of chart objects with IDs, types, positions, and configurations.

#### `get`
Get detailed information about a specific chart.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `chartId` (number, required): Chart ID

## Chart Specifications

### Position

**Overlay position** (chart on top of cells):
```json
{
  "overlayPosition": {
    "anchorCell": {
      "sheetId": 0,
      "rowIndex": 14,
      "columnIndex": 3
    },
    "offsetXPixels": 0,
    "offsetYPixels": 0,
    "widthPixels": 600,
    "heightPixels": 400
  }
}
```

**Embedded sheet** (dedicated chart sheet):
```json
{
  "newSheet": true
}
```

### Title Configuration

```json
{
  "title": "Monthly Sales Report",
  "titleTextFormat": {
    "fontSize": 18,
    "bold": true,
    "fontFamily": "Arial"
  },
  "subtitle": "Q1 2026"
}
```

### Axis Configuration

**Basic axis setup**:
```json
{
  "axes": [
    {
      "position": "BOTTOM_AXIS",
      "title": "Month"
    },
    {
      "position": "LEFT_AXIS",
      "title": "Sales ($)",
      "format": {
        "type": "CURRENCY",
        "pattern": "$#,##0"
      },
      "viewWindow": {
        "min": 0,
        "max": 10000
      }
    }
  ]
}
```

**Axis positions**: `BOTTOM_AXIS`, `LEFT_AXIS`, `RIGHT_AXIS`, `TOP_AXIS`

### Series Configuration

**Column/Bar/Line charts**:
```json
{
  "series": [
    {
      "targetAxis": "LEFT_AXIS",
      "color": {
        "red": 0.0,
        "green": 0.5,
        "blue": 1.0
      },
      "lineStyle": {
        "width": 2
      },
      "pointStyle": {
        "shape": "CIRCLE",
        "size": 5
      }
    }
  ]
}
```

**Point shapes**: `CIRCLE`, `DIAMOND`, `HEXAGON`, `PENTAGON`, `SQUARE`, `STAR`, `TRIANGLE`, `X_MARK`

### Legend

```json
{
  "legend": {
    "position": "BOTTOM",
    "alignment": "CENTER",
    "textStyle": {
      "fontSize": 10,
      "fontFamily": "Arial"
    }
  }
}
```

**Legend positions**: `BOTTOM`, `TOP`, `LEFT`, `RIGHT`, `TOP_RIGHT`, `BOTTOM_LEFT`, `BOTTOM_RIGHT`, `NO_LEGEND`

### Grid Lines

```json
{
  "gridlines": {
    "count": 5,
    "color": {
      "red": 0.8,
      "green": 0.8,
      "blue": 0.8
    }
  },
  "minorGridlines": {
    "count": 2,
    "color": {
      "red": 0.9,
      "green": 0.9,
      "blue": 0.9
    }
  }
}
```

## Chart Type Specifications

### Column Chart

**Best for**: Comparing categories, showing changes over time

```json
{
  "chartType": "COLUMN",
  "basicChart": {
    "chartType": "COLUMN",
    "legendPosition": "BOTTOM",
    "stackedType": "NOT_STACKED"
  }
}
```

**Stacked types**: `NOT_STACKED`, `STACKED`, `PERCENT_STACKED`

### Line Chart

**Best for**: Trends over time, continuous data

```json
{
  "chartType": "LINE",
  "basicChart": {
    "chartType": "LINE",
    "lineSmoothing": true
  }
}
```

### Pie Chart

**Best for**: Part-to-whole relationships, percentages

```json
{
  "chartType": "PIE",
  "pieChart": {
    "legendPosition": "RIGHT",
    "pieHole": 0.4,
    "threeDimensional": false
  }
}
```

**pieHole**: 0.0 (no hole) to 0.9 (donut chart)

### Scatter Plot

**Best for**: Correlations, distributions, outliers

```json
{
  "chartType": "SCATTER",
  "basicChart": {
    "chartType": "SCATTER",
    "legendPosition": "RIGHT"
  }
}
```

### Combo Chart

**Best for**: Comparing different metrics (e.g., actuals vs target)

```json
{
  "chartType": "COMBO",
  "basicChart": {
    "chartType": "COMBO",
    "series": [
      {"type": "COLUMN"},
      {"type": "LINE"}
    ]
  }
}
```

### Histogram

**Best for**: Distribution analysis, frequency counts

```json
{
  "chartType": "HISTOGRAM",
  "histogramChart": {
    "bucketSize": 10,
    "outlierPercentile": 0.05,
    "showItemDividers": true
  }
}
```

## Common Use Cases

### Dashboard KPI Chart
```json
{
  "chartType": "COLUMN",
  "title": "Key Performance Indicators",
  "size": {"width": 400, "height": 300},
  "colors": ["#0066CC", "#FF6600", "#00AA00"],
  "legend": "BOTTOM"
}
```

### Trend Analysis
```json
{
  "chartType": "LINE",
  "title": "Revenue Trend",
  "smooth": true,
  "showPoints": false,
  "axisLabels": {
    "x": "Date",
    "y": "Revenue ($)"
  }
}
```

### Comparison Chart
```json
{
  "chartType": "BAR",
  "title": "Regional Comparison",
  "sorted": true,
  "dataLabels": true,
  "colors": ["#0066CC"]
}
```

### Financial Chart
```json
{
  "chartType": "CANDLESTICK",
  "title": "Stock Performance",
  "dateAxis": true,
  "volumeSeries": true
}
```

## Best Practices

1. **Choose appropriate chart type** for your data
2. **Limit data series** to 5-7 for readability
3. **Use consistent colors** across related charts
4. **Label axes clearly** with units
5. **Add meaningful titles** and subtitles
6. **Size appropriately** for display context
7. **Test with sample data** before finalizing

## Performance Tips

1. **Limit data points** to 1000-2000 per series
2. **Aggregate large datasets** before charting
3. **Use appropriate refresh intervals**
4. **Cache chart specifications** for reuse
5. **Batch chart operations** when creating multiple

## Error Handling

**Common errors**:
- `CHART_NOT_FOUND` - Invalid chart ID
- `INVALID_RANGE` - Data range doesn't exist
- `INVALID_POSITION` - Position outside sheet bounds
- `INVALID_CHART_SPEC` - Malformed specification

**Error prevention**:
- Verify chart ID exists before updates
- Validate data ranges
- Check position coordinates
- Test chart specs with sample data

## Troubleshooting

### Chart Not Appearing
- Verify position is within sheet bounds
- Check data range contains values
- Ensure chart was created (check response)

### Wrong Data Displayed
- Verify source ranges are correct
- Check for header row inclusion
- Ensure data types are compatible

### Chart Looks Distorted
- Review width:height aspect ratio
- Check axis scale ranges
- Verify font sizes are appropriate

## Related Tools

- [sheets_data](./sheets_data.md) - Data for charts
- [sheets_formatting](./sheets_formatting.md) - Format chart data
- [sheets_structure](./sheets_structure.md) - Sheet management

## See Also

- [Charts Guide](../examples/charts.md) - Complete chart examples
- [Action Reference](../guides/ACTION_REFERENCE.md) - All available actions
- [Usage Guide](../guides/USAGE_GUIDE.md) - General usage patterns
