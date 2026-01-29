# 🧠 Context Window Optimization Guide

## The Problem: 100-Step Timeout

After ~100 tool calls, conversations reset. This isn't an MCP server timeout - it's **Claude Desktop context window pressure**.

### Root Causes

1. **Cumulative Response Size**: Each tool call adds ~2-10KB to conversation history
2. **No Garbage Collection**: Claude keeps ALL previous tool results in context
3. **Verbose Responses**: Full JSON responses with metadata consume tokens
4. **Context Window Limit**: Claude has finite context (~200K tokens)

After 100 calls × 5KB average = **500KB+ of tool responses** competing with conversation tokens.

---

## Immediate Fixes

### 1. Enable Compact Response Mode

Add to `.env.local`:

```bash
# Response optimization
COMPACT_RESPONSES=true
MAX_INLINE_CELLS=500           # Reduced from 1000
TRUNCATION_ROWS=50             # Reduced from 100
STRIP_METADATA=true            # Remove _meta from responses
```

### 2. Implement Response Compaction

Create `src/utils/response-compactor.ts`:

```typescript
/**
 * Compact response to minimize context window usage
 */
export function compactResponse(response: Record<string, unknown>): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  
  // Only include essential fields
  const essentialFields = ['success', 'action', 'message', 'error'];
  const conditionalFields = ['values', 'updatedCells', 'updatedRange'];
  
  for (const field of essentialFields) {
    if (field in response) {
      compact[field] = response[field];
    }
  }
  
  // Include conditional fields only if small
  for (const field of conditionalFields) {
    if (field in response) {
      const value = response[field];
      if (Array.isArray(value) && value.length > 50) {
        compact[field] = `[${value.length} items - truncated]`;
        compact[`${field}Preview`] = value.slice(0, 5);
      } else {
        compact[field] = value;
      }
    }
  }
  
  // Strip metadata entirely
  delete compact['_meta'];
  delete compact['costEstimate'];
  delete compact['quotaImpact'];
  
  return compact;
}
```

### 3. Add Response Size Limits

In `buildToolResponse()` (src/mcp/registration/tool-handlers.ts):

```typescript
// Add size check before returning
const MAX_RESPONSE_SIZE = 8000; // ~2K tokens
const serialized = JSON.stringify(structured);

if (serialized.length > MAX_RESPONSE_SIZE && process.env.COMPACT_RESPONSES === 'true') {
  return buildCompactedResponse(result);
}
```

---

## Architectural Improvements

### 4. Implement Checkpoint System

Create `src/utils/checkpoint.ts`:

```typescript
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const CHECKPOINT_DIR = process.env.CHECKPOINT_DIR || '/tmp/servalsheets-checkpoints';

export interface Checkpoint {
  sessionId: string;
  timestamp: number;
  completedSteps: string[];
  currentSpreadsheetId?: string;
  context: Record<string, unknown>;
}

export function saveCheckpoint(checkpoint: Checkpoint): string {
  const filename = `checkpoint-${checkpoint.sessionId}.json`;
  const filepath = join(CHECKPOINT_DIR, filename);
  writeFileSync(filepath, JSON.stringify(checkpoint, null, 2));
  return filepath;
}

export function loadCheckpoint(sessionId: string): Checkpoint | null {
  const filepath = join(CHECKPOINT_DIR, `checkpoint-${sessionId}.json`);
  if (!existsSync(filepath)) return null;
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

export function listCheckpoints(): string[] {
  // Return available session IDs
}
```

### 5. Add Session Resume Action

Add to `sheets_session`:

```typescript
// Action: resume_from_checkpoint
async function handleResumeFromCheckpoint(params: {
  sessionId: string;
}): Promise<SessionResponse> {
  const checkpoint = loadCheckpoint(params.sessionId);
  if (!checkpoint) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Checkpoint not found' }};
  }
  
  // Restore session state
  sessionManager.restore(checkpoint);
  
  return {
    success: true,
    action: 'resume_from_checkpoint',
    resumedFrom: checkpoint.timestamp,
    completedSteps: checkpoint.completedSteps.length,
    message: `Resumed session. ${checkpoint.completedSteps.length} steps already completed.`
  };
}
```

### 6. Implement Progressive Response Pruning

Add to server.ts:

```typescript
// Track response history
const responseHistory: Map<string, { size: number; timestamp: number }> = new Map();
const MAX_HISTORY_SIZE = 100000; // 100KB

function pruneOldResponses(): void {
  let totalSize = 0;
  const entries = [...responseHistory.entries()]
    .sort((a, b) => b[1].timestamp - a[1].timestamp);
  
  for (const [requestId, info] of entries) {
    totalSize += info.size;
    if (totalSize > MAX_HISTORY_SIZE) {
      responseHistory.delete(requestId);
    }
  }
}
```

---

## Schema Optimization

### 7. Deferred Schema Loading

Already partially implemented. Enable fully:

```bash
# In .env.local
SERVAL_DEFER_SCHEMAS=true
```

This reduces initial context load by ~50KB.

### 8. Tool Description Compression

Current tool descriptions are verbose. Create compressed versions:

```typescript
// Before (verbose)
description: "Read cell values from a spreadsheet range. Supports A1 notation, named ranges, and semantic references. Returns values as a 2D array with metadata about the range and operation cost."

// After (compressed)
description: "Read cells. Returns 2D array. Supports A1/named/semantic ranges."
```

---

## Environment Configuration Summary

Add all these to `.env.local`:

```bash
# ============================================
# CONTEXT WINDOW OPTIMIZATION
# ============================================

# Response Compaction
COMPACT_RESPONSES=true
MAX_INLINE_CELLS=500
TRUNCATION_ROWS=50
STRIP_METADATA=true
MAX_RESPONSE_SIZE=8000

# Schema Optimization  
SERVAL_DEFER_SCHEMAS=true
COMPRESS_TOOL_DESCRIPTIONS=true

# Checkpoint System
ENABLE_CHECKPOINTS=true
CHECKPOINT_DIR=/tmp/servalsheets-checkpoints
AUTO_CHECKPOINT_INTERVAL=25  # Save every 25 steps

# Progress Notifications (keep existing)
ENABLE_PROGRESS_NOTIFICATIONS=true
PROGRESS_NOTIFICATION_INTERVAL_MS=15000

# Timeouts (keep existing)
REQUEST_TIMEOUT_MS=120000
GOOGLE_API_TIMEOUT_MS=60000
```

---

## Usage Pattern Recommendations

### For Long Operations (50+ steps)

1. **Use Transactions**: Batch multiple operations
   ```
   Begin transaction → Queue 10 operations → Commit
   ```
   This is 1 context entry instead of 10.

2. **Use Composite Operations**: 
   ```
   sheets_composite.setup_sheet (1 call)
   vs
   sheets_core.create + sheets_data.write + sheets_format.set_format (3 calls)
   ```

3. **Checkpoint Before Major Phases**:
   ```
   sheets_session.save_checkpoint({sessionId: "test-run-1", phase: "formatting"})
   ```

4. **Resume After Reset**:
   ```
   sheets_session.resume_from_checkpoint({sessionId: "test-run-1"})
   ```

### For Analysis Operations

1. Use `sheets_analyze.comprehensive` (1 call) instead of multiple analysis calls
2. Request `compact: true` in params when available
3. Use resource URIs instead of inline data for large results

---

## Implementation Priority

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P0 | Enable COMPACT_RESPONSES | High | 2h |
| P0 | Reduce inline limits | High | 30m |
| P1 | Add checkpoint system | Very High | 4h |
| P1 | Implement response compactor | High | 2h |
| P2 | Compress tool descriptions | Medium | 1h |
| P2 | Deferred schema loading | Medium | Done |
| P3 | Progressive response pruning | Medium | 3h |

---

## Testing the Improvements

After implementing, test with:

```
Run comprehensive test but checkpoint every 25 steps.
If context resets, use sheets_session.resume_from_checkpoint 
to continue where you left off.
```

Expected result: Complete 100+ steps across multiple context windows.

---

## Metrics to Track

After changes, monitor:
- Average response size (target: <5KB)
- Steps before context pressure (target: 150+)
- Checkpoint resume success rate
- Total test completion time

---

*Created: 2026-01-24*
*Status: Ready for implementation*
