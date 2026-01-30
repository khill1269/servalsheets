# sheets_analysis Tool Reference

Analyze spreadsheets for formulas, quality, performance, and structure.

## Overview

The `sheets_analysis` tool provides actions for:
- Comprehensive spreadsheet analysis
- Formula analysis and optimization
- Data quality assessment
- Performance profiling
- Structure review
- Dependency mapping

## Actions

### Comprehensive Analysis

#### `analyze_comprehensive`
Perform complete spreadsheet analysis.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `options` (object, optional): Analysis configuration

**Returns**:
```json
{
  "analysisId": "analysis-123",
  "timestamp": "2026-01-30T10:00:00Z",
  "summary": {
    "healthScore": 92,
    "totalSheets": 5,
    "totalCells": 5000,
    "formulaCells": 450,
    "errorCells": 3
  },
  "issues": [...],
  "recommendations": [...]
}
```

**Health score**: 0-100 (higher is better)
- 90-100: Excellent
- 70-89: Good
- 50-69: Fair, needs attention
- Below 50: Poor, urgent fixes needed

### Formula Analysis

#### `analyze_formulas`
Analyze all formulas in spreadsheet.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, optional): Specific range to analyze

**Detects**:
- Formula errors (#DIV/0!, #REF!, #N/A, etc.)
- Circular references
- Complex formulas
- Volatile functions (NOW, TODAY, RAND, etc.)
- Cross-sheet dependencies
- Optimization opportunities

**Returns**:
```json
{
  "totalFormulas": 450,
  "errorFormulas": 3,
  "circularReferences": 1,
  "volatileFunctions": 12,
  "complexFormulas": 25,
  "optimizationOpportunities": [
    {
      "cell": "Sheet1!B10",
      "issue": "VLOOKUP in large range",
      "suggestion": "Replace with INDEX/MATCH",
      "potentialImprovement": "50-80% faster"
    }
  ]
}
```

### Data Quality

#### `analyze_quality`
Assess data quality and completeness.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `range` (string, optional): Specific range to analyze

**Checks**:
- Missing data (empty cells)
- Duplicate rows
- Data type consistency
- Outliers and anomalies
- Format consistency

**Returns**:
```json
{
  "qualityScore": 85,
  "completeness": 92.5,
  "duplicateRows": 3,
  "inconsistentTypes": [
    {
      "column": "B",
      "issue": "Mixed numbers and text",
      "affectedCells": ["B15", "B23", "B41"]
    }
  ],
  "outliers": [
    {
      "cell": "C50",
      "value": 9999,
      "reason": "3.5 standard deviations above mean"
    }
  ]
}
```

### Performance Analysis

#### `analyze_performance`
Identify performance bottlenecks.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID

**Analyzes**:
- Slow formulas
- Large array operations
- Excessive cross-sheet references
- Memory usage
- Recalculation triggers

**Returns**:
```json
{
  "performanceScore": 78,
  "bottlenecks": [
    {
      "severity": "HIGH",
      "location": "Sheet1!A1:A1000",
      "issue": "1000 VLOOKUP formulas",
      "impact": "Slow recalculation (2-3 seconds)",
      "recommendation": "Use INDEX/MATCH or helper column"
    }
  ],
  "memoryUsage": {
    "totalCells": 5000,
    "formulaCells": 450,
    "estimatedLoadTime": "1.2 seconds"
  }
}
```

### Structure Analysis

#### `analyze_structure`
Review spreadsheet organization.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID

**Analyzes**:
- Sheet organization
- Named range usage
- Data validation rules
- Protected ranges
- Hidden rows/columns

**Returns**:
```json
{
  "sheets": [
    {
      "name": "Data",
      "rowCount": 1000,
      "columnCount": 26,
      "hiddenRows": 0,
      "hiddenColumns": 2
    }
  ],
  "namedRanges": 8,
  "dataValidations": 12,
  "protectedRanges": 3,
  "suggestions": [
    "Consider using named ranges for frequently referenced data",
    "Review 2 hidden columns in 'Data' sheet"
  ]
}
```

### Dependency Analysis

#### `analyze_dependencies`
Map cell dependencies and references.

**Parameters**:
- `spreadsheetId` (string, required): Spreadsheet ID
- `cell` (string, required): Cell to analyze (A1 notation)

**Returns**:
```json
{
  "cell": "Sheet1!B10",
  "precedents": [
    "Sheet1!A10",
    "Sheet1!B5",
    "Sheet2!C1"
  ],
  "dependents": [
    "Sheet1!C10",
    "Sheet1!D10",
    "Summary!A1"
  ],
  "circularReference": false,
  "dependencyDepth": 3,
  "crossSheetDependencies": 2
}
```

**Dependency types**:
- **Precedents**: Cells that this cell depends on
- **Dependents**: Cells that depend on this cell
- **Circular**: Cells in circular reference chains
- **Cross-sheet**: Dependencies across different sheets

## Analysis Workflows

### Pre-Deployment Check
```
1. Run analyze_comprehensive
2. Review health score and issues
3. Fix ERROR severity issues
4. Address WARNING issues
5. Apply high-priority optimizations
6. Re-analyze to verify improvements
```

### Performance Troubleshooting
```
1. Run analyze_performance
2. Identify top bottlenecks
3. Profile specific formulas
4. Test optimization changes
5. Measure improvement
6. Document changes
```

### Data Quality Audit
```
1. Run analyze_quality
2. Check completeness percentage
3. Identify and handle duplicates
4. Verify data type consistency
5. Investigate outliers
6. Generate quality report
```

## Issue Severity Levels

### `ERROR` (Critical)
- Formula errors preventing correct results
- Circular references
- Invalid references
- Must fix immediately

### `WARNING` (Important)
- Performance bottlenecks
- Data quality issues
- Suboptimal formulas
- Should fix soon

### `INFO` (Informational)
- Optimization opportunities
- Best practice suggestions
- Structural improvements
- Consider addressing

## Analysis Options

### Configuration object:
```json
{
  "includeFormulas": true,
  "includeQuality": true,
  "includePerformance": true,
  "includeStructure": true,
  "includeDependencies": false,
  "detailLevel": "FULL",
  "samplingRate": 1.0
}
```

**Detail levels**:
- `SUMMARY` - High-level metrics only
- `STANDARD` - Key issues and recommendations
- `FULL` - Complete analysis with all details

**Sampling rate**: 0.0-1.0 (1.0 = analyze all cells)

## Common Patterns

### Regular Health Checks
```
Schedule weekly:
1. analyze_comprehensive
2. Track health score trend
3. Monitor new issues
4. Review recommendations
5. Apply fixes incrementally
```

### Formula Optimization
```
For slow spreadsheets:
1. analyze_performance
2. Identify bottleneck formulas
3. Test alternative formulas
4. Measure before/after
5. Document improvements
```

### Quality Monitoring
```
For data-driven sheets:
1. analyze_quality on data ranges
2. Check completeness metrics
3. Detect duplicates
4. Verify type consistency
5. Generate quality dashboard
```

## Best Practices

1. **Schedule regular analysis** - Weekly or after major changes
2. **Track metrics over time** - Monitor trends
3. **Prioritize by severity** - Fix ERRORs first
4. **Test in development** - Don't analyze production during business hours
5. **Document findings** - Keep analysis history
6. **Share insights** - Help team understand issues

## Performance Considerations

1. **Limit scope** - Analyze specific sheets if slow
2. **Use sampling** - For very large spreadsheets
3. **Schedule off-hours** - Don't impact users
4. **Cache results** - Avoid redundant analysis
5. **Incremental analysis** - Focus on changed areas

## Error Handling

**Common errors**:
- `SPREADSHEET_NOT_FOUND` - Invalid ID
- `PERMISSION_DENIED` - Insufficient access
- `ANALYSIS_TIMEOUT` - Spreadsheet too large
- `RATE_LIMIT_EXCEEDED` - Too many requests

**Error prevention**:
- Verify spreadsheet exists and accessible
- Limit analysis scope for large sheets
- Use appropriate sampling rates
- Implement exponential backoff

## Related Tools

- [sheets_data](./sheets_data.md) - Data operations
- [sheets_structure](./sheets_structure.md) - Sheet management
- [sheets_formatting](./sheets_formatting.md) - Cell formatting

## See Also

- [Analysis Guide](../examples/analysis.md) - Complete analysis examples
- [Performance Guide](../guides/PERFORMANCE.md) - Optimization strategies
- [Action Reference](../guides/ACTION_REFERENCE.md) - All available actions
