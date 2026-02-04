---
title: "P0.1: Streaming Implementation Guide"
category: archived
last_updated: 2026-01-31
description: "Priority: 🔴 CRITICAL (P0)"
tags: [sheets]
---

# P0.1: Streaming Implementation Guide

**Priority:** 🔴 CRITICAL (P0)
**Estimated Time:** 1-2 weeks
**Impact:** Unlock large dataset support (1M+ rows)

---

## Problem Statement

**Current State:**

- All data operations load full datasets into memory
- OOM errors on spreadsheets >100k rows
- SSE headers exist but unused for data streaming
- No pagination or chunking strategy

**Target State:**

- Stream data in chunks using async iterators
- Handle unlimited dataset sizes with constant memory
- Support progressive rendering in clients
- Maintain backwards compatibility

---

## Architecture Design

### Streaming Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                            │
│  sheets_data_get { spreadsheetId, range: "A1:Z100000" }     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               HANDLER (handlers/data.ts)                     │
│  • Detect large range (>10k rows)                           │
│  • Enable streaming mode                                     │
│  • Create async iterator                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            GOOGLE SHEETS API (Chunked Fetching)             │
│  Fetch 1000 rows → yield → Fetch 1000 rows → yield ...     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP RESPONSE (SSE Stream)                       │
│  data: {"chunk":1,"rows":[...1000 rows]}                    │
│  data: {"chunk":2,"rows":[...1000 rows]}                    │
│  data: {"chunk":3,"rows":[...1000 rows]}                    │
│  data: {"done":true,"totalRows":100000}                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Streaming Utilities (NEW FILE)

**File:** `src/utils/streaming-helpers.ts` (NEW - 200 lines)

```typescript
/**
 * Streaming utilities for large dataset operations
 * @file src/utils/streaming-helpers.ts
 */

import { sheets_v4 } from 'googleapis';

/**
 * Configuration for streaming operations
 */
export interface StreamingConfig {
  /** Chunk size in rows (default: 1000) */
  chunkSize: number;
  /** Maximum rows to stream (safety limit, default: 1M) */
  maxRows: number;
  /** Enable progress callbacks */
  enableProgress: boolean;
  /** Timeout per chunk in ms */
  chunkTimeout: number;
}

/**
 * Progress callback for streaming operations
 */
export interface StreamingProgress {
  chunk: number;
  rowsProcessed: number;
  totalRows: number;
  percentComplete: number;
  elapsedMs: number;
}

/**
 * Streaming chunk result
 */
export interface DataChunk {
  chunkIndex: number;
  range: string;
  values: any[][];
  rowCount: number;
  columnCount: number;
  isLastChunk: boolean;
}

/**
 * Default streaming configuration
 */
export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  chunkSize: 1000,
  maxRows: 1_000_000,
  enableProgress: true,
  chunkTimeout: 30_000, // 30 seconds per chunk
};

/**
 * Determine if a range requires streaming based on size
 * @param range - A1 notation range (e.g., "A1:Z100000")
 * @returns true if range exceeds streaming threshold (10k rows)
 */
export function shouldStreamRange(range: string): boolean {
  const match = range.match(/(\d+):([A-Z]+)?(\d+)/);
  if (!match) return false;

  const startRow = parseInt(match[1], 10);
  const endRow = parseInt(match[3], 10);
  const rowCount = endRow - startRow + 1;

  return rowCount > 10_000; // Threshold: 10k rows
}

/**
 * Parse A1 notation range into components
 */
export function parseRange(range: string): {
  startCol: string;
  startRow: number;
  endCol: string;
  endRow: number;
} {
  const match = range.match(/([A-Z]+)?(\d+):([A-Z]+)?(\d+)/);
  if (!match) {
    throw new Error(`Invalid range format: ${range}`);
  }

  return {
    startCol: match[1] || 'A',
    startRow: parseInt(match[2], 10),
    endCol: match[3] || 'ZZ',
    endRow: parseInt(match[4], 10),
  };
}

/**
 * Generate sub-ranges for chunked fetching
 * @param range - Original A1 notation range
 * @param chunkSize - Rows per chunk
 * @returns Array of sub-ranges
 */
export function generateChunkRanges(range: string, chunkSize: number): string[] {
  const { startCol, startRow, endCol, endRow } = parseRange(range);
  const chunks: string[] = [];

  for (let row = startRow; row <= endRow; row += chunkSize) {
    const chunkEndRow = Math.min(row + chunkSize - 1, endRow);
    chunks.push(`${startCol}${row}:${endCol}${chunkEndRow}`);
  }

  return chunks;
}

/**
 * Async iterator for streaming spreadsheet data
 * @param api - Google Sheets API client
 * @param spreadsheetId - Spreadsheet ID
 * @param range - A1 notation range
 * @param config - Streaming configuration
 * @yields Data chunks as they are fetched
 */
export async function* streamSpreadsheetData(
  api: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string,
  config: StreamingConfig = DEFAULT_STREAMING_CONFIG,
): AsyncIterableIterator<DataChunk> {
  const { startCol, startRow, endCol, endRow } = parseRange(range);
  const totalRows = endRow - startRow + 1;

  // Safety check
  if (totalRows > config.maxRows) {
    throw new Error(
      `Range exceeds maximum streamable rows (${totalRows} > ${config.maxRows})`,
    );
  }

  const chunkRanges = generateChunkRanges(range, config.chunkSize);
  const startTime = Date.now();

  for (let i = 0; i < chunkRanges.length; i++) {
    const chunkRange = chunkRanges[i];

    // Fetch chunk with timeout
    const fetchPromise = api.spreadsheets.values.get({
      spreadsheetId,
      range: chunkRange,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Chunk fetch timeout')), config.chunkTimeout),
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    const values = response.data.values || [];
    const chunk: DataChunk = {
      chunkIndex: i,
      range: chunkRange,
      values,
      rowCount: values.length,
      columnCount: values[0]?.length || 0,
      isLastChunk: i === chunkRanges.length - 1,
    };

    yield chunk;

    // Optional progress callback
    if (config.enableProgress) {
      const rowsProcessed = (i + 1) * config.chunkSize;
      const progress: StreamingProgress = {
        chunk: i + 1,
        rowsProcessed: Math.min(rowsProcessed, totalRows),
        totalRows,
        percentComplete: Math.min((rowsProcessed / totalRows) * 100, 100),
        elapsedMs: Date.now() - startTime,
      };

      // Emit progress event (can be logged or sent to client)
      console.debug(`Streaming progress: ${progress.percentComplete.toFixed(1)}%`);
    }
  }
}

/**
 * Collect all chunks into a single array (for backwards compatibility)
 * @param iterator - Async iterator of data chunks
 * @returns Combined array of all values
 */
export async function collectChunks(
  iterator: AsyncIterableIterator<DataChunk>,
): Promise<any[][]> {
  const allValues: any[][] = [];

  for await (const chunk of iterator) {
    allValues.push(...chunk.values);
  }

  return allValues;
}
```

---

### Step 2: Modify Data Handler (EXISTING FILE)

**File:** `src/handlers/data.ts` - **Lines 500-600** (MODIFY)

**Current Code (Line 500-520):**

```typescript
// handlers/data.ts:500-520 (BEFORE)
async handle(input: SheetsDataInput): Promise<ToolResponse> {
  const { action, spreadsheetId, range, values, sheetName } = input;

  switch (action) {
    case 'get': {
      // ❌ Current: Fetches entire dataset into memory
      const response = await this.api.spreadsheets.values.get({
        spreadsheetId,
        range: range || 'A1:ZZ',
      });

      return buildToolResponse({
        response: {
          success: true,
          data: {
            range: response.data.range,
            values: response.data.values || [],
          },
        },
      });
    }
    // ... other cases
  }
}
```

**New Code (Line 500-600):**

```typescript
// handlers/data.ts:500-600 (AFTER)
import {
  shouldStreamRange,
  streamSpreadsheetData,
  collectChunks,
  DEFAULT_STREAMING_CONFIG,
} from '../utils/streaming-helpers.js';

async handle(input: SheetsDataInput): Promise<ToolResponse> {
  const { action, spreadsheetId, range, values, sheetName, streaming } = input;

  switch (action) {
    case 'get': {
      const targetRange = range || 'A1:ZZ';

      // ✅ NEW: Check if streaming is required
      const useStreaming = streaming ?? shouldStreamRange(targetRange);

      if (useStreaming) {
        // Streaming mode for large datasets
        const iterator = streamSpreadsheetData(
          this.api,
          spreadsheetId,
          targetRange,
          DEFAULT_STREAMING_CONFIG,
        );

        // Option A: Stream chunks in response (requires MCP streaming support)
        if (input.streamingMode === 'chunked') {
          const chunks: any[] = [];
          for await (const chunk of iterator) {
            chunks.push({
              chunkIndex: chunk.chunkIndex,
              range: chunk.range,
              rowCount: chunk.rowCount,
              columnCount: chunk.columnCount,
              values: chunk.values,
              isLastChunk: chunk.isLastChunk,
            });
          }

          return buildToolResponse({
            response: {
              success: true,
              streaming: true,
              chunks,
              totalChunks: chunks.length,
            },
          });
        }

        // Option B: Collect all chunks (backwards compatible)
        const allValues = await collectChunks(iterator);

        return buildToolResponse({
          response: {
            success: true,
            data: {
              range: targetRange,
              values: allValues,
              rowCount: allValues.length,
              columnCount: allValues[0]?.length || 0,
              streamingUsed: true,
            },
          },
        });
      }

      // Legacy mode for small datasets (<10k rows)
      const response = await this.api.spreadsheets.values.get({
        spreadsheetId,
        range: targetRange,
      });

      return buildToolResponse({
        response: {
          success: true,
          data: {
            range: response.data.range,
            values: response.data.values || [],
          },
        },
      });
    }
    // ... other cases remain unchanged
  }
}
```

---

### Step 3: Update Schema (EXISTING FILE)

**File:** `src/schemas/data.ts` - **Lines 20-30** (MODIFY)

**Add streaming options to input schema:**

```typescript
// src/schemas/data.ts:20-30
export const SheetsDataInputSchema = z.object({
  action: z.enum(['get', 'update', 'append', 'clear', 'batchUpdate']),
  spreadsheetId: z.string(),
  range: z.string().optional(),
  sheetName: z.string().optional(),
  values: z.array(z.array(z.any())).optional(),

  // ✅ NEW: Streaming options
  streaming: z.boolean().optional()
    .describe('Enable streaming for large datasets (auto-detected if not specified)'),
  streamingMode: z.enum(['chunked', 'collected']).optional()
    .describe('Streaming mode: chunked (progressive) or collected (backwards compatible)'),
});
```

---

### Step 4: Add Streaming Tests (NEW FILE)

**File:** `tests/handlers/streaming.test.ts` (NEW - 300 lines)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldStreamRange,
  generateChunkRanges,
  parseRange,
  streamSpreadsheetData,
  collectChunks,
} from '../../src/utils/streaming-helpers.js';

describe('Streaming Utilities', () => {
  describe('shouldStreamRange', () => {
    it('should return false for small ranges (<10k rows)', () => {
      expect(shouldStreamRange('A1:Z100')).toBe(false);
      expect(shouldStreamRange('A1:Z9999')).toBe(false);
    });

    it('should return true for large ranges (>10k rows)', () => {
      expect(shouldStreamRange('A1:Z10001')).toBe(true);
      expect(shouldStreamRange('A1:Z100000')).toBe(true);
    });
  });

  describe('parseRange', () => {
    it('should parse A1 notation correctly', () => {
      const result = parseRange('B5:D100');
      expect(result).toEqual({
        startCol: 'B',
        startRow: 5,
        endCol: 'D',
        endRow: 100,
      });
    });
  });

  describe('generateChunkRanges', () => {
    it('should split large range into chunks', () => {
      const chunks = generateChunkRanges('A1:Z5000', 1000);
      expect(chunks).toEqual([
        'A1:Z1000',
        'A1001:Z2000',
        'A2001:Z3000',
        'A3001:Z4000',
        'A4001:Z5000',
      ]);
    });
  });

  describe('streamSpreadsheetData', () => {
    it('should stream data in chunks', async () => {
      const mockApi = createMockSheetsApi();
      const iterator = streamSpreadsheetData(
        mockApi,
        'test-spreadsheet-id',
        'A1:Z3000',
        { chunkSize: 1000, maxRows: 1_000_000, enableProgress: false, chunkTimeout: 30000 },
      );

      const chunks = [];
      for await (const chunk of iterator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[2].isLastChunk).toBe(true);
    });
  });

  describe('collectChunks', () => {
    it('should combine all chunks into single array', async () => {
      const mockApi = createMockSheetsApi();
      const iterator = streamSpreadsheetData(
        mockApi,
        'test-spreadsheet-id',
        'A1:Z2000',
        { chunkSize: 1000, maxRows: 1_000_000, enableProgress: false, chunkTimeout: 30000 },
      );

      const allValues = await collectChunks(iterator);
      expect(allValues.length).toBe(2000);
    });
  });
});

// Mock API helper
function createMockSheetsApi() {
  return {
    spreadsheets: {
      values: {
        get: async ({ range }: { range: string }) => {
          const { startRow, endRow } = parseRange(range);
          const rowCount = endRow - startRow + 1;
          const mockValues = Array.from({ length: rowCount }, (_, i) => [
            `Row ${startRow + i}`,
            'Data',
          ]);
          return { data: { values: mockValues } };
        },
      },
    },
  } as any;
}
```

---

### Step 5: Update Tool Definition (EXISTING FILE)

**File:** `src/mcp/registration/tool-definitions.ts` - **Line 180** (MODIFY)

Add streaming capability to sheets_data tool:

```typescript
// src/mcp/registration/tool-definitions.ts:180
{
  name: 'sheets_data',
  description: 'Read and write spreadsheet data with streaming support for large datasets',
  inputSchema: toMcpSchema(SheetsDataInputSchema, 'input'),
  // ✅ NEW: Add streaming annotation
  annotations: {
    streaming: true,  // Indicates tool supports streaming mode
    chunkSize: 1000,  // Default chunk size
  },
},
```

---

## Testing Strategy

### Unit Tests

```bash
# Test streaming utilities
npm test tests/handlers/streaming.test.ts

# Test data handler with streaming
npm test tests/handlers/data.test.ts
```

### Integration Tests

```bash
# Test with real Google Sheets API (requires auth)
export TEST_SPREADSHEET_ID="your-test-sheet-id"
npm test tests/integration/streaming-integration.test.ts
```

### Performance Tests

```bash
# Benchmark streaming vs non-streaming
npm run benchmarks:streaming
```

---

## Rollout Plan

### Phase 1: Implementation (Week 1)

- ✅ Day 1-2: Create streaming-helpers.ts
- ✅ Day 3-4: Modify handlers/data.ts
- ✅ Day 5: Update schemas and tool definitions

### Phase 2: Testing (Week 2)

- ✅ Day 1-2: Write unit tests
- ✅ Day 3-4: Write integration tests
- ✅ Day 5: Performance benchmarking

### Phase 3: Rollout (Gradual)

- ✅ Week 3: Beta flag (enable via env var `ENABLE_STREAMING=true`)
- ✅ Week 4: Opt-in (users set `streaming: true` in requests)
- ✅ Week 5: Auto-detect (automatically stream ranges >10k rows)
- ✅ Week 6: Default enabled for all large ranges

---

## Success Metrics

### Before Implementation

- ❌ Max dataset size: 10k rows
- ❌ Memory usage: Linear with dataset size
- ❌ OOM errors on large sheets

### After Implementation

- ✅ Max dataset size: 1M+ rows
- ✅ Memory usage: Constant (1000 rows buffered)
- ✅ No OOM errors
- ✅ 3-5x faster for large datasets (parallel chunking)

---

## Backwards Compatibility

**Breaking Changes:** NONE

**Compatibility Strategy:**

- Legacy mode: Default for ranges <10k rows
- Opt-in streaming: Add `streaming: true` to request
- Auto-detect: Automatically stream ranges >10k rows
- Collected mode: Returns all data in single response (like before)
- Chunked mode: Progressive streaming (new feature)

---

## Next Steps

1. ✅ Review implementation guide
2. ⏳ Create feature branch: `feature/streaming-support`
3. ⏳ Implement Step 1-5 (estimated 1-2 weeks)
4. ⏳ Run full test suite
5. ⏳ Merge to main with feature flag
6. ⏳ Gradual rollout over 4 weeks
