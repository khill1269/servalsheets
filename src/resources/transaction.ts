import { ResourceContent } from '@modelcontextprotocol/sdk/types';

export function getTransactionResources(): { uri: string; contents: ResourceContent }[] {
  return [
    {
      uri: 'transaction://guide',
      contents: {
        mimeType: 'text/plain',
        text: `Transaction System Guide

Execute multiple operations atomically (all-or-nothing).

How transactions work:

1. Begin transaction
   - Creates operation queue
   - Captures initial state
   - Starts timeout (5 minutes)

2. Queue operations
   - Add multiple write/format operations
   - No API calls yet
   - All queued operations validated
   - Batchable and non-batchable separated

3. Commit
   - Execute batchable operations first (single API call)
   - Execute non-batchable operations (separate calls)
   - All succeed or entire transaction rolls back
   - History recorded as single unit

4. Rollback (on error)
   - Undo all completed operations
   - Restore from snapshot
   - Error details provided
   - User can retry or abandon

Batchable operations:
- values:write, values:append, values:clear
- format:update
- sheet:update
- Up to 100 per API call

Non-batchable operations:
- chart:create, chart:delete
- filter_view:create, filter_view:delete
- resource_link:add
- comment:add
- Each requires separate API call

Best practices:
- Group related operations in transactions
- Batch similar operations together
- Keep transactions <1 minute execution time
- Test with preview mode first
- Use snapshots for safety`
      },
    },
    {
      uri: 'transaction://manager-docs',
      contents: {
        mimeType: 'text/plain',
        text: `Transaction Manager Documentation

Internal implementation details.

TransactionManager class:
- Manages transaction state
- Tracks queued operations
- Handles commit/rollback logic
- Coordinates with Google APIs
- Enforces constraints

Transaction states:
- INITIAL: Just created, ready to queue
- QUEUED: Operations added, ready to commit
- COMMITTING: Executing operations
- COMMITTED: All operations completed
- FAILED: Error occurred, needs rollback
- ROLLED_BACK: All changes undone

Operation batching:
- Groups batchable operations
- Max 100 operations per batchUpdate
- Respects cell/sheet limits
- Validates references before commit

Error handling:
- Captures error details
- Partial rollback if failure mid-execution
- Snapshot-based recovery
- User retry capability

Performance:
- 0ms overhead for single operations
- Batch efficiency: up to 80% reduction vs sequential
- Typical execution: 200-1000ms
- Timeout: 5 minutes per transaction

Logging:
- Operation audit trail
- Timing information
- API call counts
- Error logging
- User attribution (if configured)`
      },
    },
  ];
}
