import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getHistoryResources(): TextResourceContents[] {
  return [
    {
      uri: 'history://operations',
      mimeType: 'text/plain',
      text: `Operation History

All operations are tracked and can be undone.

Tracked operations:

Write operations:
- write: cell value changes
- append: new rows added
- clear: cells cleared
- find_replace: bulk replacements

Format operations:
- set_format: formatting changes
- set_borders: border modifications
- set_background: color changes
- set_number_format: number format changes

Structural operations:
- insert: new rows/columns
- delete: removed rows/columns
- move: moved rows/columns
- hide/show: visibility changes
- freeze: freeze row/column

Filter operations:
- set_basic_filter: filter applied
- clear_basic_filter: filter removed
- create_filter_view: named filter created
- update_filter_view: filter updated

History features:
- Full undo/redo support
- Timeline with timestamps
- User attribution (if configured)
- Selective rollback to any point
- Snapshot creation for checkpoints
- Compaction for old operations`,
    },
    {
      uri: 'history://snapshots',
      mimeType: 'text/plain',
      text: `Snapshot System

Snapshots are point-in-time backups of spreadsheet state.

Types:

Automatic snapshots:
- Before destructive operations
- Created when safety rail triggered
- Expires after 24 hours
- Max 10 automatic snapshots

Manual snapshots:
- Created by user request
- Named with custom description
- Persist indefinitely
- Up to 50 per spreadsheet

Snapshot operations:
- Create: save current state
- List: view all snapshots
- Restore: revert to snapshot
- Delete: remove snapshot
- Compare: diff from snapshot

Snapshots include:
- All cell values
- Formatting information
- Formula content
- Named ranges
- Filter views
- Chart definitions
- Conditional formatting rules

Not included:
- Edit history before snapshot
- Comments
- Revision metadata`,
    },
  ];
}
