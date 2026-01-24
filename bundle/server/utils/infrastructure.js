/**
 * ServalSheets - Infrastructure Optimization
 *
 * Phase 5: Infrastructure optimizations for improved throughput and latency.
 *
 * Optimizations:
 * 1. Request coalescing - combine multiple requests to same spreadsheet
 * 2. Connection keep-alive management
 * 3. Prefetch hints for predictable access patterns
 * 4. Batch request queuing with smart scheduling
 *
 * @module utils/infrastructure
 */
// ============================================================================
// CONSTANTS
// ============================================================================
/** Maximum requests to coalesce into single batch */
const MAX_COALESCE_SIZE = 50;
/** Time window to wait for coalescing (ms) */
const COALESCE_WINDOW_MS = 10;
/** Maximum pending requests per spreadsheet */
const MAX_PENDING_PER_SPREADSHEET = 100;
/** Prefetch lookahead (predict next N ranges) */
const PREFETCH_LOOKAHEAD = 3;
// ============================================================================
// REQUEST COALESCER
// ============================================================================
/**
 * Coalesces multiple requests to the same spreadsheet into batches
 *
 * Instead of executing requests immediately, queues them and waits
 * a short window to combine with other requests to the same spreadsheet.
 */
export class RequestCoalescer {
    pendingRequests = new Map();
    scheduledFlushes = new Map();
    stats = {
        pending: 0,
        coalesced: 0,
        executed: 0,
        totalCoalesceSize: 0,
        totalLatency: 0,
        batchCount: 0,
    };
    coalesceWindowMs;
    maxCoalesceSize;
    constructor(options = {}) {
        this.coalesceWindowMs = options.coalesceWindowMs ?? COALESCE_WINDOW_MS;
        this.maxCoalesceSize = options.maxCoalesceSize ?? MAX_COALESCE_SIZE;
    }
    /**
     * Queue a request for coalescing
     */
    async queue(spreadsheetId, operation, priority = 0) {
        return new Promise((resolve, reject) => {
            const request = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                spreadsheetId,
                operation,
                resolve: resolve,
                reject,
                timestamp: Date.now(),
                priority,
            };
            this.addRequest(spreadsheetId, request);
            this.scheduleFlush(spreadsheetId);
        });
    }
    /**
     * Add request to pending queue
     */
    addRequest(spreadsheetId, request) {
        let pending = this.pendingRequests.get(spreadsheetId);
        if (!pending) {
            pending = [];
            this.pendingRequests.set(spreadsheetId, pending);
        }
        // Enforce max pending limit
        if (pending.length >= MAX_PENDING_PER_SPREADSHEET) {
            request.reject(new Error('Too many pending requests for spreadsheet'));
            return;
        }
        pending.push(request);
        this.stats.pending++;
        // If batch is full, flush immediately
        if (pending.length >= this.maxCoalesceSize) {
            this.flushNow(spreadsheetId);
        }
    }
    /**
     * Schedule a flush for the spreadsheet
     */
    scheduleFlush(spreadsheetId) {
        // Already scheduled
        if (this.scheduledFlushes.has(spreadsheetId)) {
            return;
        }
        const timeout = setTimeout(() => {
            this.flushNow(spreadsheetId);
        }, this.coalesceWindowMs);
        this.scheduledFlushes.set(spreadsheetId, timeout);
    }
    /**
     * Flush pending requests immediately
     */
    async flushNow(spreadsheetId) {
        // Clear scheduled flush
        const timeout = this.scheduledFlushes.get(spreadsheetId);
        if (timeout) {
            clearTimeout(timeout);
            this.scheduledFlushes.delete(spreadsheetId);
        }
        // Get and clear pending requests
        const requests = this.pendingRequests.get(spreadsheetId);
        if (!requests || requests.length === 0) {
            return;
        }
        this.pendingRequests.delete(spreadsheetId);
        // Sort by priority (higher first)
        requests.sort((a, b) => b.priority - a.priority);
        // Track coalescing stats
        this.stats.coalesced += requests.length;
        this.stats.totalCoalesceSize += requests.length;
        this.stats.batchCount++;
        // Execute each request
        // Note: In a more advanced implementation, we could combine
        // compatible requests into actual batch API calls
        const startTime = Date.now();
        await Promise.all(requests.map(async (request) => {
            try {
                const result = await request.operation();
                request.resolve(result);
                this.stats.executed++;
                this.stats.pending--;
            }
            catch (error) {
                request.reject(error instanceof Error ? error : new Error(String(error)));
                this.stats.pending--;
            }
        }));
        this.stats.totalLatency += Date.now() - startTime;
    }
    /**
     * Flush all pending requests
     */
    async flushAll() {
        const spreadsheetIds = Array.from(this.pendingRequests.keys());
        await Promise.all(spreadsheetIds.map((id) => this.flushNow(id)));
    }
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            pending: this.stats.pending,
            coalesced: this.stats.coalesced,
            executed: this.stats.executed,
            avgCoalesceSize: this.stats.batchCount > 0 ? this.stats.totalCoalesceSize / this.stats.batchCount : 0,
            avgLatencyMs: this.stats.batchCount > 0 ? this.stats.totalLatency / this.stats.batchCount : 0,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            pending: 0,
            coalesced: 0,
            executed: 0,
            totalCoalesceSize: 0,
            totalLatency: 0,
            batchCount: 0,
        };
    }
}
// ============================================================================
// PREFETCH PREDICTOR
// ============================================================================
/**
 * Predicts and prefetches data based on access patterns
 */
export class PrefetchPredictor {
    accessHistory = [];
    maxHistory = 100;
    prefetchCache = new Map();
    prefetchTtl = 30000; // 30 seconds
    /**
     * Record an access and predict next accesses
     */
    recordAccess(spreadsheetId, range) {
        // Add to history
        this.accessHistory.push({
            spreadsheetId,
            range,
            timestamp: Date.now(),
        });
        // Trim history
        if (this.accessHistory.length > this.maxHistory) {
            this.accessHistory = this.accessHistory.slice(-this.maxHistory);
        }
        // Predict next ranges based on patterns
        return this.predictNextRanges(spreadsheetId, range);
    }
    /**
     * Predict next ranges based on access patterns
     */
    predictNextRanges(spreadsheetId, currentRange) {
        const predictions = [];
        // Pattern 1: Sequential row access (A1:E10 -> A11:E20)
        const sequentialNext = this.predictSequentialRange(currentRange);
        if (sequentialNext) {
            predictions.push(sequentialNext);
        }
        // Pattern 2: Common follow-up ranges from history
        const historicalNext = this.findHistoricalPatterns(spreadsheetId, currentRange);
        predictions.push(...historicalNext);
        return predictions.slice(0, PREFETCH_LOOKAHEAD);
    }
    /**
     * Predict next sequential range
     */
    predictSequentialRange(range) {
        // Parse range like "Sheet1!A1:E10"
        const match = range.match(/^([^!]+!)?([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match)
            return null;
        const [, sheetPrefix, startCol, startRow, endCol, endRow] = match;
        const rowCount = parseInt(endRow) - parseInt(startRow) + 1;
        const nextStartRow = parseInt(endRow) + 1;
        const nextEndRow = nextStartRow + rowCount - 1;
        return `${sheetPrefix ?? ''}${startCol}${nextStartRow}:${endCol}${nextEndRow}`;
    }
    /**
     * Find patterns from history
     */
    findHistoricalPatterns(spreadsheetId, currentRange) {
        const patterns = [];
        // Find sequences where currentRange was followed by another range
        for (let i = 0; i < this.accessHistory.length - 1; i++) {
            const current = this.accessHistory[i];
            const next = this.accessHistory[i + 1];
            if (current.spreadsheetId === spreadsheetId &&
                current.range === currentRange &&
                next.spreadsheetId === spreadsheetId &&
                next.range !== currentRange) {
                if (!patterns.includes(next.range)) {
                    patterns.push(next.range);
                }
            }
        }
        return patterns;
    }
    /**
     * Store prefetched data
     */
    storePrefetch(key, data) {
        this.prefetchCache.set(key, { data, timestamp: Date.now() });
    }
    /**
     * Get prefetched data if available and not expired
     */
    getPrefetch(key) {
        const entry = this.prefetchCache.get(key);
        // OK: Explicit empty - typed as optional, prefetch cache miss
        if (!entry)
            return undefined;
        if (Date.now() - entry.timestamp > this.prefetchTtl) {
            this.prefetchCache.delete(key);
            // OK: Explicit empty - typed as optional, prefetch cache expired
            return undefined;
        }
        return entry.data;
    }
    /**
     * Clear expired prefetch entries
     */
    clearExpired() {
        const now = Date.now();
        let cleared = 0;
        for (const [key, entry] of this.prefetchCache) {
            if (now - entry.timestamp > this.prefetchTtl) {
                this.prefetchCache.delete(key);
                cleared++;
            }
        }
        return cleared;
    }
}
/**
 * Schedules and batches Google Sheets API requests
 */
export class BatchRequestScheduler {
    pendingBatches = new Map();
    scheduledFlushes = new Map();
    sheetsApi;
    batchWindowMs;
    maxBatchSize;
    constructor(sheetsApi, options = {}) {
        this.sheetsApi = sheetsApi;
        this.batchWindowMs = options.batchWindowMs ?? 10;
        this.maxBatchSize = options.maxBatchSize ?? 50;
    }
    /**
     * Schedule requests for batching
     */
    async scheduleRequests(spreadsheetId, requests) {
        return new Promise((resolve, reject) => {
            let batch = this.pendingBatches.get(spreadsheetId);
            if (!batch) {
                batch = {
                    spreadsheetId,
                    requests: [],
                    callbacks: [],
                    scheduledTime: Date.now() + this.batchWindowMs,
                };
                this.pendingBatches.set(spreadsheetId, batch);
            }
            // Record which request indices belong to this callback
            const startIndex = batch.requests.length;
            batch.requests.push(...requests);
            const endIndex = batch.requests.length;
            batch.callbacks.push({
                resolve,
                reject,
                requestIndices: Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i),
            });
            // Check if batch is full
            if (batch.requests.length >= this.maxBatchSize) {
                this.flushBatch(spreadsheetId);
            }
            else {
                this.scheduleFlush(spreadsheetId);
            }
        });
    }
    /**
     * Schedule a flush
     */
    scheduleFlush(spreadsheetId) {
        if (this.scheduledFlushes.has(spreadsheetId)) {
            return;
        }
        const timeout = setTimeout(() => {
            this.flushBatch(spreadsheetId);
        }, this.batchWindowMs);
        this.scheduledFlushes.set(spreadsheetId, timeout);
    }
    /**
     * Flush a batch immediately
     */
    async flushBatch(spreadsheetId) {
        // Clear scheduled flush
        const timeout = this.scheduledFlushes.get(spreadsheetId);
        if (timeout) {
            clearTimeout(timeout);
            this.scheduledFlushes.delete(spreadsheetId);
        }
        const batch = this.pendingBatches.get(spreadsheetId);
        if (!batch || batch.requests.length === 0) {
            return;
        }
        this.pendingBatches.delete(spreadsheetId);
        try {
            // Execute batch
            const response = await this.sheetsApi.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: batch.requests },
            });
            const replies = response.data.replies ?? [];
            // Distribute responses to callbacks
            for (const callback of batch.callbacks) {
                const callbackResponses = callback.requestIndices.map((idx) => replies[idx] ?? {});
                callback.resolve(callbackResponses);
            }
        }
        catch (error) {
            // Reject all callbacks
            const err = error instanceof Error ? error : new Error(String(error));
            for (const callback of batch.callbacks) {
                callback.reject(err);
            }
        }
    }
    /**
     * Flush all pending batches
     */
    async flushAll() {
        const spreadsheetIds = Array.from(this.pendingBatches.keys());
        await Promise.all(spreadsheetIds.map((id) => this.flushBatch(id)));
    }
}
// ============================================================================
// CONNECTION POOL
// ============================================================================
/**
 * Simple connection state tracker for Google API clients
 * Note: googleapis handles actual HTTP connections internally
 */
export class ConnectionPool {
    activeRequests = 0;
    maxConcurrent;
    queue = [];
    constructor(maxConcurrent = 10) {
        this.maxConcurrent = maxConcurrent;
    }
    /**
     * Execute operation with concurrency limiting
     */
    async execute(operation) {
        if (this.activeRequests < this.maxConcurrent) {
            return this.runOperation(operation);
        }
        // Queue the operation
        return new Promise((resolve, reject) => {
            this.queue.push({
                operation: operation,
                resolve: resolve,
                reject,
            });
        });
    }
    /**
     * Run operation and manage concurrency
     */
    async runOperation(operation) {
        this.activeRequests++;
        try {
            return await operation();
        }
        finally {
            this.activeRequests--;
            this.processQueue();
        }
    }
    /**
     * Process queued operations
     */
    processQueue() {
        while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
            const next = this.queue.shift();
            if (next) {
                this.runOperation(next.operation).then(next.resolve).catch(next.reject);
            }
        }
    }
    /**
     * Get current stats
     */
    getStats() {
        return {
            active: this.activeRequests,
            queued: this.queue.length,
            maxConcurrent: this.maxConcurrent,
        };
    }
}
// ============================================================================
// SINGLETON INSTANCES
// ============================================================================
let requestCoalescer = null;
let prefetchPredictor = null;
let connectionPool = null;
/**
 * Get or create request coalescer singleton
 */
export function getRequestCoalescer(options) {
    if (!requestCoalescer) {
        requestCoalescer = new RequestCoalescer(options);
    }
    return requestCoalescer;
}
/**
 * Get or create prefetch predictor singleton
 */
export function getPrefetchPredictor() {
    if (!prefetchPredictor) {
        prefetchPredictor = new PrefetchPredictor();
    }
    return prefetchPredictor;
}
/**
 * Get or create connection pool singleton
 */
export function getConnectionPool(maxConcurrent) {
    if (!connectionPool) {
        connectionPool = new ConnectionPool(maxConcurrent);
    }
    return connectionPool;
}
// ============================================================================
// EXPORTS
// ============================================================================
export const Infrastructure = {
    // Request coalescing
    RequestCoalescer,
    getRequestCoalescer,
    // Prefetch prediction
    PrefetchPredictor,
    getPrefetchPredictor,
    // Batch scheduling
    BatchRequestScheduler,
    // Connection pool
    ConnectionPool,
    getConnectionPool,
    // Constants
    MAX_COALESCE_SIZE,
    COALESCE_WINDOW_MS,
    MAX_PENDING_PER_SPREADSHEET,
    PREFETCH_LOOKAHEAD,
};
//# sourceMappingURL=infrastructure.js.map