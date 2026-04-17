import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getPivotResources(): TextResourceContents[] {
  return [
    {
      uri: 'pivots://guide',
      mimeType: 'text/plain',
      text: `Pivot Tables Guide

Note: Pivot table creation and modification requires direct Google Sheets API calls.

What are pivot tables?
- Summarize data by categories
- Aggregate values (sum, count, average)
- Compare across dimensions
- Dynamically reorganize data

Typical uses:
- Sales by region and month
- Product performance by category
- Customer analysis by segment
- Time series aggregation

Google Sheets pivot API:
- createPivotTable: Create new pivot
- updatePivotTable: Modify structure
- deletePivotTable: Remove pivot
- Requires: rows, columns, values, filters

Best practices:
- Keep source data in separate sheet
- Use consistent column headers
- Avoid blank rows in source data
- Refresh after source updates
- Create multiple pivots for different views`,
    },
  ];
}
