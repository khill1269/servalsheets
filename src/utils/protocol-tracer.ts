/**
 * Protocol Tracer for MCP and Google API debugging
 *
 * Captures full request/response traces with correlation IDs for debugging
 * and analysis. Supports multiple export formats and request replay.
 */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { ErrorDetail } from '../schemas/shared.js';
import { logger } from './logger.js';

/**
 * Direction of protocol communication
 */
export type TraceDirection = 'inbound' | 'outbound';

/**
 * Protocol type being traced
 */
export type ProtocolType = 'mcp' | 'google-api';

/**
 * Complete protocol trace entry
 */
export interface ProtocolTrace {
  /** Unique trace ID */
  traceId: string;
  /** Correlation ID for related traces */
  correlationId: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Direction of communication */
  direction: TraceDirection;
  /** Protocol type */
  protocol: ProtocolType;
  /** Method or operation name */
  method: string;
  /** Request data */
  request: unknown;
  /** Response data (if completed) */
  response?: unknown;
  /** Error details (if failed) */
  error?: ErrorDetail;
  /** Duration in milliseconds (if completed) */
  duration?: number;
  /** Additional metadata */
  metadata: {
    toolName?: string;
    action?: string;
    spreadsheetId?: string;
    retryCount?: number;
    httpStatus?: number;
    httpHeaders?: Record<string, string>;
  };
}

/**
 * Export format for traces
 */
export type ExportFormat = 'json' | 'jsonl' | 'har';

/**
 * HAR (HTTP Archive) entry format
 */
interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
    };
  };
  cache: Record<string, never>;
  timings: {
    send: number;
    wait: number;
    receive: number;
  };
}

/**
 * Protocol Tracer for debugging MCP and Google API interactions
 */
export class ProtocolTracer {
  private traces: Map<string, ProtocolTrace> = new Map();
  private correlationMap: Map<string, string[]> = new Map();
  private circularBuffer: ProtocolTrace[] = [];
  private readonly maxBufferSize: number;
  private readonly enabled: boolean;

  constructor(options: { maxBufferSize?: number; enabled?: boolean } = {}) {
    this.maxBufferSize = options.maxBufferSize ?? 1000;
    this.enabled = options.enabled ?? process.env['PROTOCOL_TRACE_ENABLED'] === 'true';

    if (this.enabled) {
      logger.debug('Protocol tracer enabled', { maxBufferSize: this.maxBufferSize });
    }
  }

  /**
   * Start a new trace
   */
  startTrace(
    correlationId: string,
    method: string,
    request: unknown,
    options: {
      protocol?: ProtocolType;
      direction?: TraceDirection;
      metadata?: ProtocolTrace['metadata'];
    } = {}
  ): string {
    if (!this.enabled) {
      return '';
    }

    const traceId = randomUUID();
    const trace: ProtocolTrace = {
      traceId,
      correlationId,
      timestamp: Date.now(),
      direction: options.direction ?? 'outbound',
      protocol: options.protocol ?? 'mcp',
      method,
      request,
      metadata: options.metadata ?? {},
    };

    this.traces.set(traceId, trace);

    // Update correlation map
    const correlatedTraces = this.correlationMap.get(correlationId) ?? [];
    correlatedTraces.push(traceId);
    this.correlationMap.set(correlationId, correlatedTraces);

    // Add to circular buffer
    this.circularBuffer.push(trace);
    if (this.circularBuffer.length > this.maxBufferSize) {
      const removed = this.circularBuffer.shift();
      if (removed) {
        this.traces.delete(removed.traceId);
      }
    }

    logger.debug('Started trace', {
      traceId,
      correlationId,
      method,
      protocol: trace.protocol,
    });

    return traceId;
  }

  /**
   * Complete a trace with response or error
   */
  completeTrace(
    traceId: string,
    result: { response?: unknown; error?: ErrorDetail; metadata?: ProtocolTrace['metadata'] }
  ): void {
    if (!this.enabled || !traceId) {
      return;
    }

    const trace = this.traces.get(traceId);
    if (!trace) {
      logger.warn('Attempted to complete non-existent trace', { traceId });
      return;
    }

    trace.response = result.response;
    trace.error = result.error;
    trace.duration = Date.now() - trace.timestamp;

    // Merge metadata
    if (result.metadata) {
      trace.metadata = { ...trace.metadata, ...result.metadata };
    }

    logger.debug('Completed trace', {
      traceId,
      duration: trace.duration,
      success: !result.error,
    });
  }

  /**
   * Get a specific trace by ID
   */
  getTrace(traceId: string): ProtocolTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces for a correlation ID
   */
  getTracesForCorrelation(correlationId: string): ProtocolTrace[] {
    const traceIds = this.correlationMap.get(correlationId) ?? [];
    return traceIds
      .map((id) => this.traces.get(id))
      .filter((trace): trace is ProtocolTrace => trace !== undefined);
  }

  /**
   * Get all traces (up to buffer size)
   */
  getAllTraces(): ProtocolTrace[] {
    return [...this.circularBuffer];
  }

  /**
   * Export traces in specified format
   */
  exportTraces(format: ExportFormat = 'jsonl', traceIds?: string[]): string {
    const traces = traceIds
      ? traceIds.map((id) => this.getTrace(id)).filter((t): t is ProtocolTrace => t !== undefined)
      : this.getAllTraces();

    switch (format) {
      case 'json':
        return JSON.stringify(traces, null, 2);

      case 'jsonl':
        return traces.map((trace) => JSON.stringify(trace)).join('\n');

      case 'har':
        return this.exportAsHAR(traces);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export traces to file
   */
  exportToFile(filepath: string, format: ExportFormat = 'jsonl', traceIds?: string[]): void {
    const content = this.exportTraces(format, traceIds);
    writeFileSync(filepath, content, 'utf-8');
    logger.info('Exported traces to file', {
      filepath,
      format,
      count: traceIds?.length ?? this.circularBuffer.length,
    });
  }

  /**
   * Export traces in HAR (HTTP Archive) format
   */
  private exportAsHAR(traces: ProtocolTrace[]): string {
    const entries: HAREntry[] = traces
      .filter((trace) => trace.protocol === 'google-api')
      .map((trace) => this.traceToHAREntry(trace));

    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'ServalSheets Protocol Tracer',
          version: '1.0.0',
        },
        entries,
      },
    };

    return JSON.stringify(har, null, 2);
  }

  /**
   * Convert a protocol trace to HAR entry format
   */
  private traceToHAREntry(trace: ProtocolTrace): HAREntry {
    const startTime = new Date(trace.timestamp).toISOString();
    const httpHeaders = trace.metadata.httpHeaders ?? {};

    return {
      startedDateTime: startTime,
      time: trace.duration ?? 0,
      request: {
        method: trace.method,
        url: trace.metadata.spreadsheetId
          ? `https://sheets.googleapis.com/v4/spreadsheets/${trace.metadata.spreadsheetId}`
          : 'https://sheets.googleapis.com/v4',
        httpVersion: 'HTTP/2',
        headers: Object.entries(httpHeaders).map(([name, value]) => ({ name, value })),
        queryString: [],
        postData: trace.request
          ? {
              mimeType: 'application/json',
              text: JSON.stringify(trace.request),
            }
          : undefined,
      },
      response: {
        status: trace.metadata.httpStatus ?? (trace.error ? 500 : 200),
        statusText: trace.error ? 'Error' : 'OK',
        httpVersion: 'HTTP/2',
        headers: [],
        content: {
          size: trace.response ? JSON.stringify(trace.response).length : 0,
          mimeType: 'application/json',
          text: trace.response ? JSON.stringify(trace.response) : undefined,
        },
      },
      cache: {},
      timings: {
        send: 0,
        wait: trace.duration ?? 0,
        receive: 0,
      },
    };
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear();
    this.correlationMap.clear();
    this.circularBuffer = [];
    logger.debug('Cleared all traces');
  }

  /**
   * Get statistics about traces
   */
  getStats(): {
    total: number;
    byProtocol: Record<ProtocolType, number>;
    byMethod: Record<string, number>;
    errorCount: number;
    averageDuration: number;
  } {
    const traces = this.getAllTraces();
    const byProtocol: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    let errorCount = 0;
    let totalDuration = 0;
    let completedCount = 0;

    for (const trace of traces) {
      byProtocol[trace.protocol] = (byProtocol[trace.protocol] ?? 0) + 1;
      byMethod[trace.method] = (byMethod[trace.method] ?? 0) + 1;

      if (trace.error) {
        errorCount++;
      }

      if (trace.duration !== undefined) {
        totalDuration += trace.duration;
        completedCount++;
      }
    }

    return {
      total: traces.length,
      byProtocol: byProtocol as Record<ProtocolType, number>,
      byMethod,
      errorCount,
      averageDuration: completedCount > 0 ? totalDuration / completedCount : 0,
    };
  }

  /**
   * Check if tracer is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Global protocol tracer instance
 */
let globalTracer: ProtocolTracer | undefined;

/**
 * Get or create the global protocol tracer
 */
export function getProtocolTracer(): ProtocolTracer {
  if (!globalTracer) {
    globalTracer = new ProtocolTracer({
      enabled: process.env['PROTOCOL_TRACE_ENABLED'] === 'true',
      maxBufferSize: parseInt(process.env['PROTOCOL_TRACE_BUFFER_SIZE'] ?? '1000', 10),
    });
  }
  return globalTracer;
}

/**
 * Reset the global tracer (mainly for testing)
 */
export function resetProtocolTracer(): void {
  globalTracer = undefined;
}
