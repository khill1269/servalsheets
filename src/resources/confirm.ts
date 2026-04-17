import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getConfirmResources(): TextResourceContents[] {
  return [
    {
      uri: 'confirm://wizards',
      mimeType: 'text/plain',
      text: `Interactive Wizard System

Wizards guide complex operations step-by-step.

Available wizards:

1. Chart Creation
   - Step 1: Select chart type
   - Step 2: Configure data range
   - Step 3: Set title and axis labels

2. Conditional Formatting
   - Step 1: Select rule type
   - Step 2: Configure conditions
   - Step 3: Set formatting style

3. Spreadsheet Creation
   - Step 1: Enter title
   - Step 2: Select template (optional)

4. Data Validation
   - Step 1: Select validation type
   - Step 2: Configure criteria
   - Step 3: Set error message

All wizards:
- Non-blocking (graceful degradation without support)
- Support multipart forms
- Return executable parameters
- Track wizard state in session`,
    },
    {
      uri: 'confirm://destructive-ops',
      mimeType: 'text/plain',
      text: `Destructive Operations

Operations requiring confirmation:

Sheet Operations:
- Delete sheet
- Clear all data
- Delete rows/columns (>10)

Data Operations:
- Delete duplicates
- Overwrite range (>100 cells)
- Cross-sheet write
- Find and replace (global)

Format Operations:
- Remove all formatting
- Clear conditional rules
- Delete filter view

History Operations:
- Revert to revision
- Clear history

For each:
1. Show description of impact
2. Request user confirmation
3. Create snapshot for undo
4. Execute operation
5. Track in history`,
    },
  ];
}
