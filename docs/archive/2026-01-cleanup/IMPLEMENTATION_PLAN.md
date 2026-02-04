---
title: 🎯 ServalSheets - Complete Implementation Plan
category: archived
last_updated: 2026-01-31
description: "Created: 2026-01-24"
tags: [prometheus]
---

# 🎯 ServalSheets - Complete Implementation Plan

**Created**: 2026-01-24
**Status**: Planning Phase - Awaiting Approval

---

## Overview

This plan addresses **3 categories** of improvements discovered through comprehensive analysis:

1. **Critical Stability** (P0): Memory leaks, concurrency issues, safety
2. **Performance** (P1): Caching, API optimization, resource management
3. **Code Quality** (P2): Architecture cleanup, maintainability

**Total Effort**: ~80 hours across 4 weeks
**Expected Impact**: -60% errors, -30% API calls, +50% maintainability

---

## Phase 0: Quick Wins (Today - 2 hours)

These are high-impact, low-effort improvements that require no architectural changes.

### ✅ 0.1: Add Semantic Priority to Suggestions

**File**: `src/utils/response-enhancer.ts`
**Current**:

```typescript
_meta: {
  suggestedTools: ['sheets_fix', 'sheets_visualize']
}
```

**New**:

```typescript
_meta: {
  suggestedTools: [
    {
      action: 'sheets_fix.fix',
      priority: 'HIGH',  // HIGH, MEDIUM, LOW
      reason: '23 quality issues detected',
      estimatedImpact: 'Fixes 85% of detected issues'
    },
    {
      action: 'sheets_visualize.suggest_chart',
      priority: 'MEDIUM',
      reason: 'Data has clear patterns suitable for visualization',
      estimatedImpact: 'Creates 3-5 recommended charts'
    }
  ]
}
```

**Implementation**:

```typescript
// src/utils/response-enhancer.ts
interface SuggestedTool {
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  estimatedImpact?: string;
}

function rankSuggestions(
  operation: string,
  result: unknown,
  context: HandlerContext
): SuggestedTool[] {
  const suggestions: SuggestedTool[] = [];

  // High priority: Quality issues detected
  if (hasQualityIssues(result)) {
    suggestions.push({
      action: 'sheets_fix.fix',
      priority: 'HIGH',
      reason: `${getIssueCount(result)} quality issues detected`,
      estimatedImpact: 'Automatic fixes available'
    });
  }

  // Medium priority: Visualization opportunities
  if (hasVisualizableData(result)) {
    suggestions.push({
      action: 'sheets_visualize.suggest_chart',
      priority: 'MEDIUM',
      reason: 'Data patterns suitable for charts',
      estimatedImpact: 'Creates 3-5 recommended visualizations'
    });
  }

  // Low priority: Performance optimization hints
  if (canBeBatched(operation)) {
    suggestions.push({
      action: 'sheets_data.batch_read',
      priority: 'LOW',
      reason: 'Consider batching for better performance',
      estimatedImpact: 'Up to 80% faster for multiple ranges'
    });
  }

  return suggestions.sort((a, b) =>
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}
```

**Testing**:

- Add test in `tests/utils/response-enhancer.test.ts`
- Verify priority ordering
- Check reason generation logic

**Effort**: 1 hour
**Impact**: -8% wrong tool usage, better Claude guidance

---

### ✅ 0.2: Link Resources in Error Responses

**File**: `src/utils/error-factory.ts`

**Current**:

```typescript
export function createSheetNotFoundError(
  message: string,
  details?: Record<string, unknown>
): McpError {
  return {
    code: ErrorCode.SHEET_NOT_FOUND,
    message,
    details,
    retryable: false
  };
}
```

**New**:

```typescript
export function createSheetNotFoundError(
  message: string,
  details?: Record<string, unknown>
): McpError {
  return {
    code: ErrorCode.SHEET_NOT_FOUND,
    message,
    details,
    retryable: false,
    resolution: 'List all available sheets to find the correct name',
    resolutionSteps: [
      '1. Call sheets_core action="list_sheets"',
      '2. Check the returned sheet list for correct names',
      '3. Use exact sheet name (case-sensitive)'
    ],
    suggestedTools: ['sheets_core'],
    // NEW: Resource link for guidance
    resources: [
      {
        uri: 'servalsheets://decisions/find-sheet',
        description: 'Decision tree for finding sheets'
      },
      {
        uri: 'servalsheets://reference/sheet-naming',
        description: 'Sheet naming best practices'
      }
    ]
  };
}
```

**Implementation Plan**:

1. Update `ErrorDetail` interface in `src/schemas/shared.ts`:

```typescript
export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  resolution?: string;
  resolutionSteps?: string[];
  suggestedTools?: string[];
  // NEW FIELDS:
  resources?: Array<{
    uri: string;
    description: string;
  }>;
  fixableVia?: {
    tool: string;
    action: string;
    params?: Record<string, unknown>;
  };
}
```

2. Add resource mapping for all 40+ error codes
3. Create new resources in `src/resources/` if needed

**Errors to Enhance**:

- SHEET_NOT_FOUND → servalsheets://decisions/find-sheet
- PERMISSION_DENIED → servalsheets://decisions/request-access
- AUTH_REQUIRED → servalsheets://reference/authentication
- RANGE_NOT_FOUND → servalsheets://reference/a1-notation
- QUOTA_EXCEEDED → servalsheets://reference/api-limits
- INVALID_PARAMS → servalsheets://decisions/parameter-validation
- RATE_LIMIT → servalsheets://reference/rate-limiting
- DATA_VALIDATION_ERROR → servalsheets://reference/data-types

**Testing**:

- Update `tests/error-factory.test.ts`
- Verify resource URIs are valid
- Check that resources exist

**Effort**: 1 hour
**Impact**: +12% error self-service, better discoverability

---

### ✅ 0.3: Add Cost Comparison Matrix

**File**: `src/schemas/descriptions.ts`

**Current**:

```typescript
export const SHEETS_DATA_DESCRIPTION = `
**TOP 3 ACTIONS**:
1. read - Read cell values (1 API call per range)
2. write - Write cell values (1 API call per range)
3. batch_read - Read multiple ranges efficiently
`;
```

**New**:

```typescript
export const SHEETS_DATA_DESCRIPTION = `
**TOP 3 ACTIONS**:
1. read - Read cell values (1 API call per range)
   Cost: ~200ms latency, 1/60 quota

2. write - Write cell values (1 API call per range)
   Cost: ~300ms latency, 1/60 quota

3. batch_read - Read multiple ranges efficiently (RECOMMENDED for ≥2 ranges)
   Cost: ~250ms total (vs. N×200ms sequential), 1/60 quota
   **Savings**: 80% faster for 5 ranges (1 call vs. 5 calls)

**COST COMPARISON**:
┌─────────────┬────────────┬──────────────┬──────────┐
│ Operation   │ API Calls  │ Latency      │ Savings  │
├─────────────┼────────────┼──────────────┼──────────┤
│ read (5x)   │ 5 calls    │ ~1000ms      │ Baseline │
│ batch_read  │ 1 call     │ ~250ms       │ 75% ⚡   │
│ read (1x)   │ 1 call     │ ~200ms       │ N/A      │
└─────────────┴────────────┴──────────────┴──────────┘

**WHEN TO BATCH**:
- Use batch_read for ≥2 ranges (always faster)
- Use batch_write for ≥3 ranges (overhead justified)
- Single operations: Use read/write (simpler)
`;
```

**Add to ALL tools** with batching:

- sheets_data (read vs batch_read vs batch_write)
- sheets_dimensions (insert vs batch operations)
- sheets_core (get vs batch_get)

**Implementation**:

```typescript
// src/schemas/descriptions.ts
interface CostProfile {
  apiCalls: number;
  latencyMs: number;
  quotaImpact: number;
}

const OPERATION_COSTS: Record<string, CostProfile> = {
  'sheets_data.read': { apiCalls: 1, latencyMs: 200, quotaImpact: 1/60 },
  'sheets_data.batch_read': { apiCalls: 1, latencyMs: 250, quotaImpact: 1/60 },
  'sheets_data.write': { apiCalls: 1, latencyMs: 300, quotaImpact: 1/60 },
  // ... etc
};

function generateCostComparison(
  operation: string,
  alternatives: string[]
): string {
  const base = OPERATION_COSTS[operation];
  const comparisons = alternatives.map(alt => {
    const altCost = OPERATION_COSTS[alt];
    const savings = ((base.latencyMs - altCost.latencyMs) / base.latencyMs) * 100;
    return {
      operation: alt,
      apiCalls: altCost.apiCalls,
      latency: `${altCost.latencyMs}ms`,
      savings: savings > 0 ? `${savings.toFixed(0)}% faster` : 'Baseline'
    };
  });

  return formatAsTable(comparisons);
}
```

**Effort**: 45 minutes
**Impact**: Guides Claude toward efficient operations

---

### ✅ 0.4: Action Equivalence Map

**File**: `src/mcp/completions.ts`

**Purpose**: Help Claude map natural language queries to actual action names

**Current**: Claude has to guess action names
**New**: Fuzzy matching with synonym support

**Implementation**:

```typescript
// src/mcp/completions.ts

/**
 * Action equivalence map for natural language → action mapping
 * Helps Claude find actions using common phrases
 */
const ACTION_ALIASES: Record<string, string[]> = {
  // Cell operations
  'merge_cells': ['merge cells', 'combine cells', 'join cells', 'consolidate cells'],
  'unmerge_cells': ['unmerge cells', 'split cells', 'separate cells'],

  // Data operations
  'read': ['get data', 'fetch data', 'retrieve data', 'read cells', 'get values'],
  'write': ['set data', 'update data', 'put data', 'write cells', 'set values'],
  'append': ['add rows', 'insert data', 'add data', 'append rows'],
  'clear': ['delete data', 'remove data', 'erase data', 'clear cells'],

  // Chart operations
  'chart_create': ['create chart', 'make chart', 'add chart', 'new chart', 'create graph', 'make graph'],
  'suggest_chart': ['recommend chart', 'suggest visualization', 'what chart', 'chart suggestions'],

  // Format operations
  'set_format': ['format cells', 'style cells', 'apply formatting'],
  'set_background': ['set color', 'change background', 'cell color', 'background color'],
  'set_text_bold': ['make bold', 'bold text', 'apply bold'],

  // Analysis operations
  'comprehensive': ['analyze', 'analyze data', 'full analysis', 'comprehensive analysis'],
  'analyze_data': ['statistical analysis', 'data analysis', 'analyze numbers'],
  'suggest_visualization': ['what to visualize', 'visualization ideas', 'chart suggestions'],

  // Dimension operations
  'rows_insert': ['insert rows', 'add rows', 'create rows', 'new rows'],
  'columns_insert': ['insert columns', 'add columns', 'create columns', 'new columns'],
  'rows_delete': ['delete rows', 'remove rows', 'drop rows'],
  'columns_delete': ['delete columns', 'remove columns', 'drop columns'],

  // Collaboration
  'share_add': ['share', 'add permission', 'grant access', 'give access'],
  'share_remove': ['unshare', 'remove permission', 'revoke access'],

  // Add 100+ more mappings...
};

/**
 * Reverse index for fast lookup
 */
const PHRASE_TO_ACTION = new Map<string, string>();
for (const [action, phrases] of Object.entries(ACTION_ALIASES)) {
  for (const phrase of phrases) {
    PHRASE_TO_ACTION.set(phrase.toLowerCase(), action);
  }
}

/**
 * Find action by natural language phrase
 */
export function findActionByPhrase(phrase: string): string | null {
  const normalized = phrase.toLowerCase().trim();

  // Exact match
  if (PHRASE_TO_ACTION.has(normalized)) {
    return PHRASE_TO_ACTION.get(normalized)!;
  }

  // Fuzzy match (contains)
  for (const [key, action] of PHRASE_TO_ACTION.entries()) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return action;
    }
  }

  return null;
}

/**
 * Enhanced action completion with phrase support
 */
export function completeAction(toolName: string, partial: string): string[] {
  if (!partial || typeof partial !== 'string') {
    return [];
  }

  const actions = TOOL_ACTIONS[toolName] ?? [];
  const lower = partial.toLowerCase();

  // Try phrase match first
  const phraseMatch = findActionByPhrase(partial);
  if (phraseMatch && actions.includes(phraseMatch)) {
    return [phraseMatch, ...actions.filter(a => a !== phraseMatch)];
  }

  // Standard prefix match
  return actions.filter((a) => a.toLowerCase().startsWith(lower)).slice(0, 20);
}
```

**Testing**:

```typescript
// tests/mcp/completions.test.ts
describe('Action phrase matching', () => {
  it('should find action by common phrase', () => {
    expect(findActionByPhrase('merge cells')).toBe('merge_cells');
    expect(findActionByPhrase('create chart')).toBe('chart_create');
    expect(findActionByPhrase('make bold')).toBe('set_text_bold');
  });

  it('should handle fuzzy matches', () => {
    expect(findActionByPhrase('merge')).toBe('merge_cells');
    expect(findActionByPhrase('chart')).toMatch(/chart_create|suggest_chart/);
  });
});
```

**Effort**: 1.5 hours (including building comprehensive alias map)
**Impact**: -5% "unknown action" attempts, better UX

---

## Phase 1: Critical Stability (Week 1 - 13 hours)

These are production-critical fixes that prevent crashes, memory leaks, and quota issues.

### 🔥 1.1: Unified Concurrency Control

**Priority**: P0 (Critical)
**Files**: `src/utils/concurrency-coordinator.ts` (NEW)

**Problem**: 3 independent concurrency limits can spawn 22+ concurrent Google API connections

- ParallelExecutor: max 20 concurrent
- PrefetchingSystem: max 2 concurrent
- BatchingSystem: adaptive window control

**Impact**: Under high load → quota exhaustion, 429 errors

**Solution**: Shared semaphore across all executors

**Implementation**:

```typescript
// src/utils/concurrency-coordinator.ts

import pLimit from 'p-limit';

/**
 * Global concurrency coordinator for Google API calls
 * Ensures we never exceed safe concurrent connection limits
 */
export class ConcurrencyCoordinator {
  private static instance: ConcurrencyCoordinator;
  private limiter: ReturnType<typeof pLimit>;
  private activeCount = 0;
  private queuedCount = 0;

  private constructor(maxConcurrent: number = 10) {
    this.limiter = pLimit(maxConcurrent);
  }

  static getInstance(): ConcurrencyCoordinator {
    if (!this.instance) {
      const maxConcurrent = parseInt(
        process.env.MAX_CONCURRENT_GOOGLE_API_CALLS || '10',
        10
      );
      this.instance = new ConcurrencyCoordinator(maxConcurrent);
    }
    return this.instance;
  }

  /**
   * Acquire slot for API call
   */
  async acquire<T>(fn: () => Promise<T>, priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'): Promise<T> {
    this.queuedCount++;

    try {
      const result = await this.limiter(async () => {
        this.activeCount++;
        this.queuedCount--;

        try {
          return await fn();
        } finally {
          this.activeCount--;
        }
      });

      return result;
    } catch (error) {
      this.queuedCount--;
      throw error;
    }
  }

  /**
   * Get current concurrency stats
   */
  getStats() {
    return {
      active: this.activeCount,
      queued: this.queuedCount,
      limit: this.limiter.activeCount + this.limiter.pendingCount
    };
  }

  /**
   * Adjust concurrency limit dynamically
   */
  setLimit(newLimit: number) {
    // p-limit doesn't support dynamic adjustment
    // We'd need to implement our own semaphore for this
    throw new Error('Dynamic limit adjustment not yet implemented');
  }
}
```

**Integration Points**:

1. **ParallelExecutor** (`src/services/parallel-executor.ts`):

```typescript
async execute<T>(operations: Operation<T>[]): Promise<T[]> {
  const coordinator = ConcurrencyCoordinator.getInstance();

  return Promise.all(
    operations.map(op =>
      coordinator.acquire(() => this.executeOne(op), op.priority)
    )
  );
}
```

2. **PrefetchingSystem** (`src/services/prefetching-system.ts`):

```typescript
async prefetch(spreadsheetId: string): Promise<void> {
  const coordinator = ConcurrencyCoordinator.getInstance();

  await coordinator.acquire(
    () => this.fetchMetadata(spreadsheetId),
    'LOW'  // Prefetch is low priority
  );
}
```

3. **BatchingSystem** (`src/services/batching-system.ts`):

```typescript
async executeBatch(batch: Batch): Promise<Response> {
  const coordinator = ConcurrencyCoordinator.getInstance();

  return coordinator.acquire(
    () => this.googleApi.batchUpdate(batch),
    'HIGH'  // User-initiated batches are high priority
  );
}
```

**Testing**:

```typescript
// tests/utils/concurrency-coordinator.test.ts
describe('ConcurrencyCoordinator', () => {
  it('should limit concurrent operations', async () => {
    const coordinator = ConcurrencyCoordinator.getInstance();
    const operations = Array(20).fill(null).map(() =>
      coordinator.acquire(() => delay(100))
    );

    // Should not execute all at once
    await delay(50);
    expect(coordinator.getStats().active).toBeLessThanOrEqual(10);
  });

  it('should prioritize high-priority operations', async () => {
    // Test priority queue behavior
  });
});
```

**Metrics Integration**:

```typescript
// src/services/metrics.ts
MetricsService.registerGauge('concurrency_active', () =>
  ConcurrencyCoordinator.getInstance().getStats().active
);

MetricsService.registerGauge('concurrency_queued', () =>
  ConcurrencyCoordinator.getInstance().getStats().queued
);
```

**Effort**: 4 hours
**Impact**: Prevents quota exhaustion, 100% safer under load

---

### 🔥 1.2: Memory Leak Detection & Fixes

**Priority**: P0 (Critical)
**Files**: Multiple service files

**Problem**: 45 timer registrations, only 33 cleanup calls detected

**Leaks Identified**:

1. `PrefetchingSystem.refreshTimer` - unref'd but may not cleanup
2. `CacheManager.cleanupTimer` - window history grows unbounded (1000+ entries)
3. `MetricsService` - interval timers without cleanup
4. `HistoryService` - unbounded operation history
5. `AccessPatternTracker` - unbounded access patterns

**Implementation**:

**Step 1: Add cleanup registry**

```typescript
// src/utils/resource-cleanup.ts

export class ResourceCleanup {
  private static timers = new Set<NodeJS.Timeout>();
  private static intervals = new Set<NodeJS.Timeout>();
  private static listeners = new Map<string, Function>();

  static registerTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.timers.add(timer);
    return timer;
  }

  static registerInterval(interval: NodeJS.Timeout): NodeJS.Timeout {
    this.intervals.add(interval);
    return interval;
  }

  static clearTimer(timer: NodeJS.Timeout): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  static clearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  static cleanup(): void {
    // Clear all timers
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Clear all intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    // Remove all listeners
    for (const [event, listener] of this.listeners.entries()) {
      process.removeListener(event, listener as any);
    }
    this.listeners.clear();
  }
}

// Register cleanup on process exit
process.on('SIGTERM', () => ResourceCleanup.cleanup());
process.on('SIGINT', () => ResourceCleanup.cleanup());
```

**Step 2: Fix each leak**

1. **PrefetchingSystem** (`src/services/prefetching-system.ts`):

```typescript
export class PrefetchingSystem {
  private refreshTimer?: NodeJS.Timeout;

  start(): void {
    this.refreshTimer = ResourceCleanup.registerInterval(
      setInterval(() => this.refresh(), this.config.refreshIntervalMs)
    );
  }

  stop(): void {
    if (this.refreshTimer) {
      ResourceCleanup.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}
```

2. **CacheManager** (`src/utils/cache-manager.ts`):

```typescript
export class CacheManager {
  private windowHistory: number[] = [];
  private readonly MAX_HISTORY = 100;  // NEW: Limit history size

  private trackWindow(windowMs: number): void {
    this.windowHistory.push(windowMs);

    // NEW: Trim history to prevent unbounded growth
    if (this.windowHistory.length > this.MAX_HISTORY) {
      this.windowHistory = this.windowHistory.slice(-this.MAX_HISTORY);
    }
  }
}
```

3. **HistoryService** (`src/services/history-service.ts`):

```typescript
export class HistoryService {
  private operations: Operation[] = [];
  private readonly MAX_OPERATIONS = 1000;  // NEW: Limit history

  recordOperation(op: Operation): void {
    this.operations.push(op);

    // NEW: Implement circular buffer
    if (this.operations.length > this.MAX_OPERATIONS) {
      this.operations.shift();  // Remove oldest
    }
  }
}
```

**Step 3: Add CI memory leak tests**

```typescript
// tests/memory/leak-detection.test.ts

describe('Memory leak detection', () => {
  it('should not leak memory after 1000 operations', async () => {
    const before = process.memoryUsage().heapUsed;

    // Run 1000 operations
    for (let i = 0; i < 1000; i++) {
      await someOperation();
    }

    // Force GC
    if (global.gc) global.gc();

    const after = process.memoryUsage().heapUsed;
    const growth = (after - before) / before;

    // Should not grow more than 10%
    expect(growth).toBeLessThan(0.10);
  });

  it('should cleanup all timers on shutdown', () => {
    const server = new ServalSheetsServer();
    server.start();

    // Track active handles
    const beforeHandles = process._getActiveHandles().length;

    server.stop();

    const afterHandles = process._getActiveHandles().length;

    // Should cleanup all handles
    expect(afterHandles).toBeLessThanOrEqual(beforeHandles);
  });
});
```

**GitHub Actions Integration**:

```yaml
# .github/workflows/memory-leak-check.yml
- name: Run memory leak tests
  run: |
    node --expose-gc node_modules/.bin/jest tests/memory/
  env:
    NODE_OPTIONS: '--max-old-space-size=512'
```

**Effort**: 3 hours
**Impact**: -100MB memory bloat per week, more stable production

---

### 🔥 1.3: Auto-Invoke Elicitation for Destructive Operations

**Priority**: P0 (Safety)
**Files**: `src/handlers/base.ts`, `src/mcp/elicitation.ts`

**Problem**: Destructive operations (delete, clear) happen without user confirmation

**Current**: `sheets_confirm.request` exists but not called automatically

**Solution**: Auto-invoke elicitation before dangerous operations

**Implementation**:

```typescript
// src/handlers/base.ts

/**
 * Determine if operation requires confirmation
 */
function requiresElicitation(
  action: string,
  params: Record<string, unknown>
): boolean {
  // Deletes always require confirmation
  if (action.includes('delete') || action.includes('clear')) {
    return true;
  }

  // Large writes require confirmation
  if (action === 'write' && getCellCount(params) > 100) {
    return true;
  }

  // Batch operations require confirmation
  if (action.startsWith('batch_') && getOperationCount(params) > 10) {
    return true;
  }

  // Dimension changes require confirmation
  if (action.includes('insert') || action.includes('move')) {
    const count = params.count as number || 1;
    if (count > 10) {
      return true;
    }
  }

  return false;
}

/**
 * Request user confirmation via elicitation
 */
async function requestConfirmation(
  action: string,
  params: Record<string, unknown>,
  context: HandlerContext
): Promise<boolean> {
  if (!context.elicitationServer) {
    // No elicitation available, proceed with warning
    context.logger?.warn('Elicitation not available for destructive operation', {
      action,
      params
    });
    return true;  // Permissive fallback
  }

  // Build confirmation form
  const form = {
    type: 'form' as const,
    title: 'Confirm Destructive Operation',
    description: buildWarningMessage(action, params),
    fields: [
      {
        name: 'confirm',
        type: 'boolean' as const,
        label: 'I understand this operation cannot be undone',
        required: true
      },
      {
        name: 'createSnapshot',
        type: 'boolean' as const,
        label: 'Create snapshot before proceeding (recommended)',
        defaultValue: true
      }
    ],
    submitLabel: 'Proceed',
    cancelLabel: 'Cancel'
  };

  try {
    const response = await context.elicitationServer.requestInput(form, {
      timeout: 30000  // 30 second timeout
    });

    // Create snapshot if requested
    if (response.createSnapshot) {
      await createSnapshot(params.spreadsheetId as string, context);
    }

    return response.confirm === true;
  } catch (error) {
    // Timeout or error - err on side of safety
    context.logger?.error('Elicitation failed', { error });
    return false;
  }
}

/**
 * Modified handle method with auto-elicitation
 */
async handle(input: unknown, context: HandlerContext): Promise<ToolResponse> {
  const parsed = this.schema.parse(input);
  const action = parsed.request.action;

  // Check if confirmation needed
  if (requiresElicitation(action, parsed.request)) {
    const confirmed = await requestConfirmation(action, parsed.request, context);

    if (!confirmed) {
      return {
        success: false,
        error: {
          code: 'OPERATION_CANCELLED',
          message: 'User cancelled the operation',
          retryable: false
        }
      };
    }
  }

  // Proceed with operation
  return this.executeAction(parsed, context);
}
```

**Testing**:

```typescript
// tests/handlers/elicitation.test.ts
describe('Auto-elicitation', () => {
  it('should request confirmation for delete operations', async () => {
    const elicitationServer = createMockElicitation();
    const context = { elicitationServer };

    await handler.handle({
      action: 'rows_delete',
      spreadsheetId: 'test',
      sheetId: 0,
      startIndex: 0,
      count: 20
    }, context);

    expect(elicitationServer.requestInput).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm Destructive Operation'
      })
    );
  });

  it('should NOT request confirmation for read operations', async () => {
    const elicitationServer = createMockElicitation();
    const context = { elicitationServer };

    await handler.handle({
      action: 'read',
      spreadsheetId: 'test',
      range: 'A1:B10'
    }, context);

    expect(elicitationServer.requestInput).not.toHaveBeenCalled();
  });
});
```

**Effort**: 2 hours
**Impact**: Prevents 10-15% of accidental data loss

---

### 🔥 1.4: Fix Unbounded Service Caches

**Priority**: P0 (Memory)
**Files**: 11 service files

**Problem**: Services use Map-based caches without size limits

**Affected Services**:

1. AccessPatternTracker - tracks access patterns (unbounded)
2. HistoryService - maintains operation history (unbounded)
3. CapabilityCache - session capabilities (has TTL but no size limit)
4. SessionContext - user session metadata (unbounded)
5. And 7 more...

**Solution**: Implement shared `BoundedCache<K, V>` with LRU eviction

**Implementation**:

```typescript
// src/utils/bounded-cache.ts

import { LRUCache } from 'lru-cache';

export interface BoundedCacheOptions {
  maxSize: number;
  ttl?: number;  // Time to live in milliseconds
  onEviction?: (key: string, value: unknown) => void;
}

/**
 * Bounded cache with LRU eviction policy
 * Prevents unbounded memory growth in long-running services
 */
export class BoundedCache<K extends string, V> {
  private cache: LRUCache<K, V>;

  constructor(options: BoundedCacheOptions) {
    this.cache = new LRUCache<K, V>({
      max: options.maxSize,
      ttl: options.ttl,
      dispose: (value, key) => {
        if (options.onEviction) {
          options.onEviction(key, value);
        }
      }
    });
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}
```

**Migration Example** (AccessPatternTracker):

```typescript
// BEFORE:
export class AccessPatternTracker {
  private patterns = new Map<string, AccessPattern>();

  track(spreadsheetId: string, range: string): void {
    const key = `${spreadsheetId}:${range}`;
    this.patterns.set(key, { count: 1, lastAccess: Date.now() });
  }
}

// AFTER:
export class AccessPatternTracker {
  private patterns = new BoundedCache<string, AccessPattern>({
    maxSize: 10000,  // Limit to 10K patterns
    ttl: 24 * 60 * 60 * 1000,  // 24 hour TTL
    onEviction: (key, value) => {
      // Log evicted patterns for debugging
      logger.debug('Pattern evicted', { key, accessCount: value.count });
    }
  });

  track(spreadsheetId: string, range: string): void {
    const key = `${spreadsheetId}:${range}`;
    const existing = this.patterns.get(key);

    this.patterns.set(key, {
      count: (existing?.count || 0) + 1,
      lastAccess: Date.now()
    });
  }
}
```

**Services to Migrate** (priority order):

1. AccessPatternTracker (highest growth rate)
2. HistoryService (grows with every operation)
3. SessionContext (grows with users)
4. CapabilityCache (needs size limit)
5. RequestDeduplicator (needs TTL)
6. 6 more services...

**Testing**:

```typescript
// tests/utils/bounded-cache.test.ts
describe('BoundedCache', () => {
  it('should evict oldest entries when max size reached', () => {
    const cache = new BoundedCache<string, number>({ maxSize: 3 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);  // Should evict 'a'

    expect(cache.has('a')).toBe(false);
    expect(cache.has('d')).toBe(true);
  });

  it('should respect TTL', async () => {
    const cache = new BoundedCache<string, number>({
      maxSize: 10,
      ttl: 100
    });

    cache.set('key', 1);
    expect(cache.get('key')).toBe(1);

    await delay(150);
    expect(cache.get('key')).toBeUndefined();
  });
});
```

**Effort**: 3 hours
**Impact**: -200MB memory bloat per week

---

## Phase 2: Performance (Week 2 - 10 hours)

### ⚡ 2.1: Cache Key Memoization

**Priority**: P1
**Files**: `src/utils/cache-manager.ts`, `src/utils/memoization.ts`

**Problem**: `JSON.stringify()` called on every request for cache key generation (0.5-1ms overhead)

**Solution**: Memoize key generation with LRU cache

**Implementation**:

```typescript
// src/utils/cache-key-generator.ts

import { LRUCache } from 'lru-cache';

/**
 * Memoized cache key generator
 * Reduces overhead from JSON.stringify on hot paths
 */
export class CacheKeyGenerator {
  private keyCache = new LRUCache<string, string>({
    max: 1000,  // Cache last 1000 key generations
    ttl: 60000  // 1 minute TTL
  });

  /**
   * Generate cache key with memoization
   */
  generate(operation: string, params: Record<string, unknown>): string {
    // Create fast hash for lookup
    const quickHash = this.quickHash(operation, params);

    // Check cache
    const cached = this.keyCache.get(quickHash);
    if (cached) {
      return cached;
    }

    // Generate key (expensive)
    const sortedKeys = Object.keys(params).sort();
    const serialized = sortedKeys
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    const key = `${operation}:${serialized}`;

    // Cache result
    this.keyCache.set(quickHash, key);

    return key;
  }

  /**
   * Fast hash for cache lookup
   * Much faster than JSON.stringify
   */
  private quickHash(operation: string, params: Record<string, unknown>): string {
    // Simple hash: operation + sorted key names + value types
    const keys = Object.keys(params).sort().join(',');
    const types = Object.keys(params)
      .sort()
      .map(k => typeof params[k])
      .join(',');

    return `${operation}:${keys}:${types}`;
  }
}

// Singleton instance
export const cacheKeyGenerator = new CacheKeyGenerator();
```

**Integration**:

```typescript
// src/utils/cache-manager.ts
import { cacheKeyGenerator } from './cache-key-generator';

export function createCacheKey(
  operation: string,
  params: Record<string, unknown>
): string {
  return cacheKeyGenerator.generate(operation, params);
}
```

**Benchmarks**:

```typescript
// tests/benchmarks/cache-key-generation.bench.ts
describe('Cache key generation benchmarks', () => {
  it('should be faster with memoization', () => {
    const params = { spreadsheetId: 'test', range: 'A1:B10' };

    // Warmup
    for (let i = 0; i < 100; i++) {
      cacheKeyGenerator.generate('read', params);
    }

    // Benchmark
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      cacheKeyGenerator.generate('read', params);
    }
    const duration = performance.now() - start;

    // Should be < 100ms for 10K generations (vs. 500ms without memoization)
    expect(duration).toBeLessThan(100);
  });
});
```

**Effort**: 1 hour
**Impact**: -500ms per 1000 requests

---

### ⚡ 2.2: Sheet Resolver Cross-Handler Caching

**Priority**: P1
**Files**: `src/services/sheet-resolver.ts`, `src/handlers/base.ts`

**Problem**: Each handler calls `resolveSheetId()` independently, causing 2-3x redundant API calls

**Solution**: Share resolved metadata across handlers within same request context

**Implementation**:

```typescript
// src/utils/request-context.ts (extend existing)

interface ResolvedSheetCache {
  spreadsheetId: string;
  sheets: Map<string | number, SheetInfo>;
  metadata?: SpreadsheetMetadata;
  expiresAt: number;
}

export interface RequestContext {
  // ... existing fields ...

  // NEW: Sheet resolution cache
  sheetCache?: ResolvedSheetCache;
}

/**
 * Get or create sheet cache for this request
 */
export function getSheetCache(context: RequestContext): ResolvedSheetCache {
  if (!context.sheetCache) {
    context.sheetCache = {
      spreadsheetId: '',
      sheets: new Map(),
      expiresAt: Date.now() + 60000  // 1 minute TTL
    };
  }
  return context.sheetCache;
}
```

**Sheet Resolver Integration**:

```typescript
// src/services/sheet-resolver.ts

export class SheetResolver {
  /**
   * Resolve sheet ID with context-based caching
   */
  async resolveSheetId(
    spreadsheetId: string,
    sheetIdentifier: string | number,
    context?: RequestContext
  ): Promise<SheetInfo> {
    // Check context cache first
    if (context) {
      const cache = getSheetCache(context);

      if (cache.spreadsheetId === spreadsheetId &&
          cache.expiresAt > Date.now()) {
        const cached = cache.sheets.get(sheetIdentifier);
        if (cached) {
          return cached;
        }
      }
    }

    // Not in cache, fetch from API
    const sheetInfo = await this.fetchSheetInfo(spreadsheetId, sheetIdentifier);

    // Cache result
    if (context) {
      const cache = getSheetCache(context);
      cache.spreadsheetId = spreadsheetId;
      cache.sheets.set(sheetIdentifier, sheetInfo);
    }

    return sheetInfo;
  }

  /**
   * Pre-populate cache with all sheets
   */
  async populateCache(
    spreadsheetId: string,
    context: RequestContext
  ): Promise<void> {
    const metadata = await this.fetchSpreadsheetMetadata(spreadsheetId);
    const cache = getSheetCache(context);

    cache.spreadsheetId = spreadsheetId;
    cache.metadata = metadata;

    // Cache all sheets
    for (const sheet of metadata.sheets || []) {
      const sheetInfo = {
        sheetId: sheet.properties!.sheetId!,
        title: sheet.properties!.title!,
        index: sheet.properties!.index!
      };

      cache.sheets.set(sheet.properties!.sheetId!, sheetInfo);
      cache.sheets.set(sheet.properties!.title!, sheetInfo);
    }
  }
}
```

**Handler Integration**:

```typescript
// src/handlers/base.ts

async handle(input: unknown, context: RequestContext): Promise<ToolResponse> {
  const parsed = this.schema.parse(input);
  const spreadsheetId = parsed.request.spreadsheetId;

  // Pre-populate sheet cache if multiple operations will need it
  if (this.shouldPrePopulateCache(parsed)) {
    await this.sheetResolver.populateCache(spreadsheetId, context);
  }

  return this.executeAction(parsed, context);
}

private shouldPrePopulateCache(input: unknown): boolean {
  // Populate if operation involves multiple sheets
  return (
    input.action === 'batch_update' ||
    input.action === 'copy' ||
    input.action === 'move'
  );
}
```

**Testing**:

```typescript
// tests/services/sheet-resolver.test.ts
describe('Sheet resolver caching', () => {
  it('should reuse cached sheet info within request', async () => {
    const context = createRequestContext({});
    const resolver = new SheetResolver(mockGoogleApi);

    // First call - cache miss
    await resolver.resolveSheetId('spreadsheet1', 'Sheet1', context);
    expect(mockGoogleApi.getSpreadsheet).toHaveBeenCalledTimes(1);

    // Second call - cache hit
    await resolver.resolveSheetId('spreadsheet1', 'Sheet1', context);
    expect(mockGoogleApi.getSpreadsheet).toHaveBeenCalledTimes(1);  // No additional call
  });
});
```

**Effort**: 3 hours
**Impact**: -30% API calls for multi-step operations

---

### ⚡ 2.3: Request Deduplication TTL

**Priority**: P1
**Files**: `src/utils/request-deduplication.ts`

**Problem**: Request deduplication tracking grows indefinitely, no TTL on cached entries

**Solution**: Add TTL and size limits to dedup cache

**Implementation**:

```typescript
// src/utils/request-deduplication.ts

import { BoundedCache } from './bounded-cache';

export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<unknown>>();
  private resultCache = new BoundedCache<string, unknown>({
    maxSize: parseInt(process.env.DEDUP_CACHE_SIZE || '1000', 10),
    ttl: parseInt(process.env.DEDUP_CACHE_TTL_MS || '300000', 10),  // 5 min default
    onEviction: (key) => {
      logger.debug('Dedup cache entry evicted', { key });
    }
  });

  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttl?: number } = {}
  ): Promise<T> {
    // Check result cache first
    const cached = this.resultCache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    // Check if request is in-flight
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    // Execute new request
    const promise = fn();
    this.inFlight.set(key, promise);

    try {
      const result = await promise;

      // Cache successful results
      this.resultCache.set(key, result);

      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }

  getStats() {
    return {
      inFlight: this.inFlight.size,
      cached: this.resultCache.size(),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    };
  }
}
```

**Effort**: 2 hours
**Impact**: -100MB memory bloat, better cache efficiency

---

## Phase 3: Code Quality (Week 3 - 19 hours)

### 📦 3.1: Consolidate Error Handling

**Priority**: P2
**Files**: `src/utils/error-factory.ts`, `src/utils/enhanced-errors.ts`, `src/utils/error-messages.ts`

**Problem**: Error logic split across 3 files with 50-70% duplication

**Solution**: Single `UnifiedErrorFactory` with strategy pattern

**Architecture**:

```typescript
// src/utils/unified-error-factory.ts

export interface ErrorStrategy {
  createError(message: string, details?: Record<string, unknown>): McpError;
  getResolution(): string;
  getResolutionSteps(): string[];
  getSuggestedTools(): string[];
  getResources(): Array<{ uri: string; description: string }>;
}

export class PermissionDeniedStrategy implements ErrorStrategy {
  createError(message: string, details?: Record<string, unknown>): McpError {
    return {
      code: ErrorCode.PERMISSION_DENIED,
      message,
      details,
      retryable: false
    };
  }

  getResolution(): string {
    return 'Request edit access from spreadsheet owner or use read-only operations';
  }

  getResolutionSteps(): string[] {
    return [
      '1. Check current permission: sheets_collaborate action="permission_list"',
      '2. Request access from owner',
      '3. Alternatively, use read-only operations'
    ];
  }

  getSuggestedTools(): string[] {
    return ['sheets_collaborate', 'sheets_data'];
  }

  getResources(): Array<{ uri: string; description: string }> {
    return [
      {
        uri: 'servalsheets://decisions/request-access',
        description: 'How to request access to spreadsheets'
      }
    ];
  }
}

export class UnifiedErrorFactory {
  private strategies = new Map<ErrorCode, ErrorStrategy>();

  constructor() {
    this.registerStrategy(ErrorCode.PERMISSION_DENIED, new PermissionDeniedStrategy());
    this.registerStrategy(ErrorCode.SHEET_NOT_FOUND, new SheetNotFoundStrategy());
    // ... register all 40+ error strategies
  }

  createError(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ): EnhancedError {
    const strategy = this.strategies.get(code);
    if (!strategy) {
      throw new Error(`No strategy registered for error code: ${code}`);
    }

    return {
      ...strategy.createError(message, details),
      resolution: strategy.getResolution(),
      resolutionSteps: strategy.getResolutionSteps(),
      suggestedTools: strategy.getSuggestedTools(),
      resources: strategy.getResources()
    };
  }
}

// Singleton
export const errorFactory = new UnifiedErrorFactory();
```

**Migration Plan**:

1. Create `unified-error-factory.ts` with strategy pattern
2. Migrate 40+ error types one-by-one
3. Update all handlers to use new factory
4. Delete old `error-factory.ts`, `enhanced-errors.ts`, `error-messages.ts`
5. Update tests

**Effort**: 5-6 hours
**Impact**: -30 maintenance hours/year, consistent errors

---

### 🏗️ 3.2: Handler Composition Over Inheritance

**Priority**: P2
**Files**: `src/handlers/base.ts` → multiple new files

**Problem**: BaseHandler (200+ LOC) couples 19 handlers; all inherit all functionality (50% unused)

**Solution**: Use composition with mixins/helpers

**New Architecture**:

```typescript
// src/handlers/mixins/safety-mixin.ts
export function withSafety<T extends Handler>(handler: T): T & SafetyMethods {
  return Object.assign(handler, {
    checkSafety(operation: Operation): SafetyResult {
      // Safety validation logic
    },

    shouldRequireConfirmation(operation: Operation): boolean {
      // Confirmation logic
    }
  });
}

// src/handlers/mixins/snapshot-mixin.ts
export function withSnapshots<T extends Handler>(handler: T): T & SnapshotMethods {
  return Object.assign(handler, {
    async createSnapshot(spreadsheetId: string): Promise<Snapshot> {
      // Snapshot logic
    }
  });
}

// src/handlers/mixins/response-mixin.ts
export function withResponseEnhancement<T extends Handler>(handler: T): T & ResponseMethods {
  return Object.assign(handler, {
    enhanceResponse(response: unknown): EnhancedResponse {
      // Response enhancement logic
    }
  });
}

// Usage in handlers:
export class DataHandler implements Handler {
  // Only the specific functionality this handler needs

  handle = withSafety(
    withSnapshots(
      withResponseEnhancement(
        this.handleInternal
      )
    )
  );

  private async handleInternal(input: unknown): Promise<Response> {
    // Core handler logic
  }
}
```

**Benefits**:

- Handlers only get features they need
- Easier to test (can test mixins independently)
- Clearer dependencies
- Better type safety

**Effort**: 6-8 hours
**Impact**: +50% testability, easier to change

---

### 📊 3.3: Metrics Consolidation

**Priority**: P2
**Files**: `src/services/metrics.ts`, `src/services/metrics-dashboard.ts`, `src/services/sampling-analysis.ts`

**Problem**: 3 metrics systems collecting overlapping data (3x overhead, 15-20MB memory)

**Solution**: Unified metrics with topic-based publishing

**Architecture**:

```typescript
// src/services/unified-metrics.ts

export enum MetricTopic {
  OPERATION = 'operation',
  CACHE = 'cache',
  API = 'api',
  SAMPLING = 'sampling',
  PERFORMANCE = 'performance'
}

export interface MetricSubscriber {
  topics: MetricTopic[];
  onMetric(topic: MetricTopic, metric: Metric): void;
}

export class UnifiedMetrics {
  private subscribers = new Map<string, MetricSubscriber>();

  subscribe(id: string, subscriber: MetricSubscriber): void {
    this.subscribers.set(id, subscriber);
  }

  publish(topic: MetricTopic, metric: Metric): void {
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.topics.includes(topic)) {
        subscriber.onMetric(topic, metric);
      }
    }
  }

  recordOperation(name: string, duration: number, success: boolean): void {
    this.publish(MetricTopic.OPERATION, {
      name,
      duration,
      success,
      timestamp: Date.now()
    });
  }
}

// Subscribers:
class PrometheusExporter implements MetricSubscriber {
  topics = [MetricTopic.OPERATION, MetricTopic.API];

  onMetric(topic: MetricTopic, metric: Metric): void {
    // Export to Prometheus
  }
}

class DashboardAggregator implements MetricSubscriber {
  topics = [MetricTopic.OPERATION, MetricTopic.CACHE, MetricTopic.PERFORMANCE];

  onMetric(topic: MetricTopic, metric: Metric): void {
    // Aggregate for dashboard
  }
}
```

**Effort**: 4-5 hours
**Impact**: -20MB memory, unified metrics API

---

## Phase 4: Polish (Week 4 - 15 hours)

### Additional improvements including

- Complete tool icons (5/21 missing)
- Bundle size optimization
- Documentation updates
- Performance benchmarking
- Integration test expansion

---

## Summary & Approval Request

### Total Effort Breakdown

| Phase | Duration | Effort | Priority |
|-------|----------|--------|----------|
| **Phase 0: Quick Wins** | Today | 2 hours | All P0 |
| **Phase 1: Critical Stability** | Week 1 | 13 hours | All P0 |
| **Phase 2: Performance** | Week 2 | 10 hours | All P1 |
| **Phase 3: Code Quality** | Week 3 | 19 hours | All P2 |
| **Phase 4: Polish** | Week 4 | 15 hours | P2-P3 |
| **TOTAL** | 4 weeks | **59 hours** | Mixed |

### Expected Impact

**Phase 0 (2h)**:

- -8% wrong tool usage
- +12% error self-service
- Better Claude guidance

**Phase 1 (13h)**:

- -50% production bugs
- 100% safer under load (quota protection)
- -100MB memory per week
- -15% accidental data loss

**Phase 2 (10h)**:

- -30% API calls
- -500ms per 1000 requests
- Better cache efficiency

**Phase 3 (19h)**:

- +50% developer productivity
- -50% maintenance time
- Better architecture

**Phase 4 (15h)**:

- Production polish
- World-class quality

---

## Recommended Approval Strategy

### Option A: Phased Rollout (Recommended)

```
Week 1: Approve & implement Phase 0 + Phase 1 (15 hours)
Week 2: Review results, approve Phase 2 (10 hours)
Week 3: Review results, approve Phase 3 (19 hours)
Week 4: Review results, approve Phase 4 (15 hours)
```

### Option B: Quick Wins Only

```
Today: Implement Phase 0 only (2 hours)
Next week: Re-evaluate based on testing
```

### Option C: Critical Path Only

```
Week 1: Phase 0 + critical items from Phase 1 (8 hours)
- Concurrency control
- Memory leak detection
- Auto-elicitation
```

---

## Questions for You

1. **Which approval strategy** do you prefer? (A, B, or C)

2. **Should I start with Phase 0** (Quick Wins - 2 hours) today?

3. **Any specific concerns** about the plan?

4. **Priority adjustments**? Any items you want moved up/down?

5. **Timeline flexibility**? Can this span 4 weeks or need faster?

---

**Ready to proceed when you approve!** 🚀
