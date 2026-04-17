import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getConflictResources(): TextResourceContents[] {
  return [
    {
      uri: 'conflict://detection',
      mimeType: 'text/plain',
      text: `Conflict Detection

Detects concurrent modifications when two clients edit simultaneously.

How detection works:

1. Capture current spreadsheet state before operation
2. Perform operation locally
3. Fetch fresh state from Google Sheets
4. Compare: baseline vs fresh state
5. If mismatch: conflict detected

Conflict types:

Cell conflicts:
- Cell edited by another user while you were working
- Shows: original → other user's value → your proposed value

Range conflicts:
- Multiple cells modified (structural changes)
- Detected when row/column counts change

Formula conflicts:
- Formula cell modified by another user
- Shows old vs new formula text

Resolution options:
- Keep current (other user's changes)
- Use remote (your changes overwrite)
- Merge (combine where possible)

Non-conflicting scenarios:
- Different ranges: no conflict
- Same range, different columns: usually mergeable
- Different sheets: no conflict`,
    },
    {
      uri: 'conflict://transaction-journal',
      mimeType: 'text/plain',
      text: `Transaction Manager Documentation

Atomic multi-operation transactions:

Flow:
1. Begin transaction (creates scope)
2. Queue operations (no API calls yet)
3. Commit: execute all or none
4. Rollback: undo on failure

Batchable operations:
- values:write, values:append, values:clear
- format:update
- sheet:update
- batch up to 100 per call

Non-batchable (commit separately):
- chart:create, chart:delete
- resource_link:add
- comment:add
- filter_view:create

Transaction safety:
- Snapshot before commit
- All-or-nothing atomicity
- Automatic rollback on error
- History tracked as single unit

Limitations:
- Cannot rollback external API changes
- 5-minute timeout
- Max 1000 operations per transaction`,
    },
  ];
}
