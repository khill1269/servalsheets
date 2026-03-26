/**
 * Trace Aggregator Service
 *
 * Collects and searches request execution traces for debugging and monitoring.
 * Stores traces in an LRU cache with 5-minute TTL.
 */

import { Span } from '@opentelemetry/api';
import Cache from 'lru-cache';

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  status: 'ok' | 'error';
  errorMessage?: string;
  attributes: Record<string, unknown>;
}

export interface TraceSearchOptions {
  tool?: string;
  action?: string;
  errorCode?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  since?: number; // timestamp
  until?: number; // timestamp
  limit?: number;
}

export interface TraceSearchResult {
  traces: TraceSpan[];
  totalCount: number;
  hasMore: boolean;
}

export class TraceAggregator {
  private cache: Cache<string, TraceSpan>;
  private traceIndex: Map<string, Set<string>> = new Map(); // traceId -> spanIds
  private operationIndex: Map<string, Set<string>> = new Map(); // operationName -> spanIds
  private errorIndex: Map<string, Set<string>> = new Map(); // errorCode -> spanIds

  constructor() {
    this.cache = new Cache<string, TraceSpan>({
      max: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
      dispose: (span) => {
        // Clean up indices on eviction
        this.traceIndex.get(span.traceId)?.delete(span.spanId);
        this.operationIndex.get(span.operationName)?.delete(span.spanId);
        if (span.errorMessage) {
          this.errorIndex.get(span.errorMessage)?.delete(span.spanId);
        }
      },
    });
  }

  /**
   * Record a span
   */
  recordSpan(span: TraceSpan): void {
    const key = `${span.traceId}-${span.spanId}`;
    this.cache.set(key, span);

    // Update indices
    if (!this.traceIndex.has(span.traceId)) {
      this.traceIndex.set(span.traceId, new Set());
    }
    this.traceIndex.get(span.traceId)!.add(span.spanId);

    if (!this.operationIndex.has(span.operationName)) {
      this.operationIndex.set(span.operationName, new Set());
    }
    this.operationIndex.get(span.operationName)!.add(span.spanId);

    if (span.errorMessage) {
      if (!this.errorIndex.has(span.errorMessage)) {
        this.errorIndex.set(span.errorMessage, new Set());
      }
      this.errorIndex.get(span.errorMessage)!.add(span.spanId);
    }
  }

  /**
   * Convert OpenTelemetry Span to TraceSpan
   */
  spanToTraceSpan(otelSpan: Span, attributes: Record<string, unknown> = {}): TraceSpan {
    const spanContext = (otelSpan as unknown as { _spanContext?: unknown })._spanContext as unknown as {
      traceId?: string;
      spanId?: string;
    } | undefined;

    return {
      spanId: spanContext?.spanId ?? 'unknown',
      traceId: spanContext?.traceId ?? 'unknown',
      operationName: otelSpan.name,
      startTimeMs: Date.now(),
      endTimeMs: Date.now(),
      durationMs: 0,
      status: 'ok',
      attributes,
    };
  }

  /**
   * Search traces by various criteria
   */
  search(options: TraceSearchOptions): TraceSearchResult {
    let spanIds = new Set<string>();

    // Start with spans matching the operation filter
    if (options.operation) {
      spanIds = new Set(this.operationIndex.get(options.operation) ?? []);
    } else if (options.tool) {
      // Search for spans with tool attribute
      for (const span of this.cache.values()) {
        if (span.attributes['tool'] === options.tool) {
          spanIds.add(span.spanId);
        }
      }
    } else {
      // No filter, search all
      for (const span of this.cache.values()) {
        spanIds.add(span.spanId);
      }
    }

    // Apply additional filters
    const filtered = Array.from(spanIds)
      .map((id) => {
        const key = Array.from(this.cache.keys()).find((k) => k.endsWith(id));
        return key ? this.cache.get(key) : undefined;
      })
      .filter(
        (span): span is TraceSpan =>
          span !== undefined &&
          (!options.errorCode || span.attributes['errorCode'] === options.errorCode) &&
          (!options.minDurationMs || span.durationMs >= options.minDurationMs) &&
          (!options.maxDurationMs || span.durationMs <= options.maxDurationMs) &&
          (!options.since || span.startTimeMs >= options.since) &&
          (!options.until || span.endTimeMs <= options.until)
      );

    // Sort by start time descending
    filtered.sort((a, b) => b.startTimeMs - a.startTimeMs);

    const limit = options.limit ?? 100;
    const traces = filtered.slice(0, limit);

    return {
      traces,
      totalCount: filtered.length,
      hasMore: filtered.length > limit,
    };
  }

  /**
   * Get slowest traces
   */
  getSlowestTraces(limit: number = 10): TraceSpan[] {
    const spans = Array.from(this.cache.values());
    return spans.sort((a, b) => b.durationMs - a.durationMs).slice(0, limit);
  }

  /**
   * Get error traces
   */
  getErrorTraces(limit: number = 10): TraceSpan[] {
    const spans = Array.from(this.cache.values()).filter((s) => s.status === 'error');
    return spans.slice(0, limit);
  }

  /**
   * Get statistics by tool
   */
  getStatsByTool(): Record<string, { count: number; avgDurationMs: number; errorCount: number }> {
    const stats: Record<string, { count: number; avgDurationMs: number; errorCount: number }> = {};

    for (const span of this.cache.values()) {
      const tool = (span.attributes['tool'] as string) || 'unknown';
      if (!stats[tool]) {
        stats[tool] = { count: 0, avgDurationMs: 0, errorCount: 0 };
      }
      stats[tool].count++;
      stats[tool].avgDurationMs =
        (stats[tool].avgDurationMs * (stats[tool].count - 1) + span.durationMs) / stats[tool].count;
      if (span.status === 'error') {
        stats[tool].errorCount++;
      }
    }

    return stats;
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.cache.clear();
    this.traceIndex.clear();
    this.operationIndex.clear();
    this.errorIndex.clear();
  }
}

/**
 * Singleton instance
 */
let globalAggregator: TraceAggregator | null = null;

export function getTraceAggregator(): TraceAggregator {
  if (!globalAggregator) {
    globalAggregator = new TraceAggregator();
  }
  return globalAggregator;
}
