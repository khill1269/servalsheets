import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getImpactResources(): TextResourceContents[] {
  return [
    {
      uri: 'impact://analyzer',
      mimeType: 'text/plain',
      text: `Impact Analyzer

Predicts how changes ripple through dependent formulas.

Capabilities:

1. Dependency graph building
   - Maps all cell references
   - Identifies formula dependencies
   - Detects circular references
   - Performance: <500ms per sheet

2. Impact calculation
   - Shows all dependent cells
   - Calculates cascade depth
   - Estimates affected cell count
   - Risk assessment (low/medium/high)

3. Change simulation
   - What-if analysis
   - Traces formula recalculation
   - Shows value changes
   - Percentage delta calculation

4. Safety scoring
   - Low risk: ≤10 dependents
   - Medium risk: 11-100 dependents
   - High risk: >100 dependents
   - Critical: circular references

Usage:
- Run before destructive operations
- Validate formula changes
- Understand spreadsheet complexity
- Find dead formulas

Limitations:
- Cannot evaluate user-defined functions
- Limited to standard sheet functions
- Performance scales with sheet size`,
    },
    {
      uri: 'impact://what-if',
      mimeType: 'text/plain',
      text: `What-If Analysis

Scenario modeling for decision making.

Types of scenarios:

1. Value change
   - Change single cell value
   - See impact on dependent formulas
   - Example: "What if revenue is 20% lower?"

2. Formula change
   - Modify formula logic
   - Check impact on downstream cells
   - Example: "What if we use average instead of sum?"

3. Data change
   - Modify multiple cells
   - Complex scenario modeling
   - Example: "Adjust all Q4 numbers"

4. Structural change
   - Add/remove rows or columns
   - Check formula breaks
   - Example: "What if we remove expenses category?"

Features:
- Non-destructive (doesn't modify original)
- Multiple scenarios supported
- Comparison views
- Rollback to original anytime
- Export scenario results
- Share scenario with team`,
    },
  ];
}
