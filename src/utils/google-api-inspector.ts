/**
 * Google API Inspector for HTTP request/response debugging
 *
 * Intercepts all Google Sheets/Drive API calls and logs full HTTP details
 * including method, URL, headers, body, timing, and quota usage.
 */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { logger } from './logger.js';

/**
 * Google API type
 */
export type GoogleApiType = 'sheets' | 'drive';

/**
 * Google API request details
 */
export interface GoogleApiRequest {
  /** Unique request ID */
  requestId: string;
  /** HTTP method */
  method: string;
  /** Full URL */
  url: string;
  /** HTTP headers */
  headers: Record<string, string>;
  /** Request body (if any) */
  body?: unknown;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** API type */
  api: GoogleApiType;
  /** Operation name (e.g., 'spreadsheets.values.get') */
  operation: string;
}

/**
 * Google API response details
 */
export interface GoogleApiResponse {
  /** Request ID this response corresponds to */
  requestId: string;
  /** HTTP status code */
  status: number;
  /** HTTP headers */
  headers: Record<string, string>;
  /** Response body (if any) */
  body?: unknown;
  /** Duration in milliseconds */
  duration: number;
  /** Quota usage information */
  quotaUsed?: {
    reads?: number;
    writes?: number;
  };
}

/**
 * Request/Response pair for analysis
 */
export interface ApiCallPair {
  request: GoogleApiRequest;
  response: GoogleApiResponse;
}

/**
 * Google API Inspector for debugging HTTP interactions
 */
export class GoogleApiInspector {
  private requests: Map<string, GoogleApiRequest> = new Map();
  private responses: Map<string, GoogleApiResponse> = new Map();
  private callHistory: ApiCallPair[] = [];
  private readonly maxHistorySize: number;
  private readonly enabled: boolean;
  private readonly includeBody: boolean;

  constructor(options: { maxHistorySize?: number; enabled?: boolean; includeBody?: boolean } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 500;
    this.enabled = options.enabled ?? process.env['GOOGLE_API_TRACE_ENABLED'] === 'true';
    this.includeBody = options.includeBody ?? process.env['GOOGLE_API_TRACE_BODY'] === 'true';

    if (this.enabled) {
      logger.debug('Google API Inspector enabled', {
        maxHistorySize: this.maxHistorySize,
        includeBody: this.includeBody,
      });
    }
  }

  /**
   * Intercept an outgoing API request
   */
  interceptRequest(request: Omit<GoogleApiRequest, 'requestId' | 'timestamp'>): string {
    if (!this.enabled) {
      return '';
    }

    const requestId = randomUUID();
    const fullRequest: GoogleApiRequest = {
      ...request,
      requestId,
      timestamp: Date.now(),
      body: this.includeBody ? request.body : undefined,
    };

    this.requests.set(requestId, fullRequest);

    logger.debug('Google API request intercepted', {
      requestId,
      method: request.method,
      url: request.url,
      api: request.api,
      operation: request.operation,
    });

    return requestId;
  }

  /**
   * Record an API response
   */
  recordResponse(requestId: string, response: Omit<GoogleApiResponse, 'requestId'>): void {
    if (!this.enabled || !requestId) {
      return;
    }

    const request = this.requests.get(requestId);
    if (!request) {
      logger.warn('Received response for unknown request', { requestId });
      return;
    }

    const fullResponse: GoogleApiResponse = {
      ...response,
      requestId,
      body: this.includeBody ? response.body : undefined,
    };

    this.responses.set(requestId, fullResponse);

    // Add to history
    this.callHistory.push({ request, response: fullResponse });

    // Maintain history size
    if (this.callHistory.length > this.maxHistorySize) {
      const removed = this.callHistory.shift();
      if (removed) {
        this.requests.delete(removed.request.requestId);
        this.responses.delete(removed.request.requestId);
      }
    }

    logger.debug('Google API response recorded', {
      requestId,
      status: response.status,
      duration: response.duration,
      quotaReads: response.quotaUsed?.reads,
      quotaWrites: response.quotaUsed?.writes,
    });
  }

  /**
   * Get request/response pair by request ID
   */
  getRequestResponsePair(requestId: string): ApiCallPair | undefined {
    const request = this.requests.get(requestId);
    const response = this.responses.get(requestId);

    if (!request || !response) {
      logger.debug('Request/response pair not found', {
        requestId,
        hasRequest: !!request,
        hasResponse: !!response,
        context: 'This may indicate a timing issue or incomplete call cycle',
      });
      // OK: Explicit empty - logged above for debugging
      return undefined;
    }

    return { request, response };
  }

  /**
   * Get all call history
   */
  getCallHistory(): ApiCallPair[] {
    return [...this.callHistory];
  }

  /**
   * Export API call as curl command
   */
  exportCurl(requestId: string): string {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    let curl = `curl -X ${request.method} '${request.url}'`;

    // Add headers
    for (const [key, value] of Object.entries(request.headers)) {
      curl += ` \\\n  -H '${key}: ${value}'`;
    }

    // Add body if present
    if (request.body) {
      const bodyJson = JSON.stringify(request.body);
      curl += ` \\\n  -d '${bodyJson}'`;
    }

    return curl;
  }

  /**
   * Export multiple API calls as Postman collection
   */
  exportPostman(requestIds: string[]): string {
    const requests = requestIds
      .map((id) => this.requests.get(id))
      .filter((req): req is GoogleApiRequest => req !== undefined);

    const collection = {
      info: {
        name: 'ServalSheets API Calls',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: requests.map((req) => ({
        name: req.operation,
        request: {
          method: req.method,
          header: Object.entries(req.headers).map(([key, value]) => ({
            key,
            value,
          })),
          url: {
            raw: req.url,
            protocol: 'https',
            host: req.url.split('/')[2]?.split('.') ?? [],
            path: req.url.split('/').slice(3),
          },
          body: req.body
            ? {
                mode: 'raw',
                raw: JSON.stringify(req.body, null, 2),
                options: {
                  raw: {
                    language: 'json',
                  },
                },
              }
            : undefined,
        },
      })),
    };

    return JSON.stringify(collection, null, 2);
  }

  /**
   * Export call history to file
   */
  exportToFile(filepath: string, format: 'json' | 'jsonl' = 'jsonl'): void {
    let content: string;

    if (format === 'json') {
      content = JSON.stringify(this.callHistory, null, 2);
    } else {
      content = this.callHistory.map((call) => JSON.stringify(call)).join('\n');
    }

    writeFileSync(filepath, content, 'utf-8');
    logger.info('Exported Google API call history', {
      filepath,
      format,
      count: this.callHistory.length,
    });
  }

  /**
   * Get statistics about API calls
   */
  getStats(): {
    total: number;
    byApi: Record<GoogleApiType, number>;
    byStatus: Record<number, number>;
    byOperation: Record<string, number>;
    totalDuration: number;
    averageDuration: number;
    totalQuotaReads: number;
    totalQuotaWrites: number;
    errorCount: number;
  } {
    const byApi: Record<string, number> = {};
    const byStatus: Record<number, number> = {};
    const byOperation: Record<string, number> = {};
    let totalDuration = 0;
    let totalQuotaReads = 0;
    let totalQuotaWrites = 0;
    let errorCount = 0;

    for (const { request, response } of this.callHistory) {
      byApi[request.api] = (byApi[request.api] ?? 0) + 1;
      byStatus[response.status] = (byStatus[response.status] ?? 0) + 1;
      byOperation[request.operation] = (byOperation[request.operation] ?? 0) + 1;

      totalDuration += response.duration;
      totalQuotaReads += response.quotaUsed?.reads ?? 0;
      totalQuotaWrites += response.quotaUsed?.writes ?? 0;

      if (response.status >= 400) {
        errorCount++;
      }
    }

    return {
      total: this.callHistory.length,
      byApi: byApi as Record<GoogleApiType, number>,
      byStatus,
      byOperation,
      totalDuration,
      averageDuration: this.callHistory.length > 0 ? totalDuration / this.callHistory.length : 0,
      totalQuotaReads,
      totalQuotaWrites,
      errorCount,
    };
  }

  /**
   * Get recent failed requests
   */
  getFailedRequests(limit: number = 10): ApiCallPair[] {
    return this.callHistory.filter((call) => call.response.status >= 400).slice(-limit);
  }

  /**
   * Get recent slow requests
   */
  getSlowRequests(thresholdMs: number = 1000, limit: number = 10): ApiCallPair[] {
    return this.callHistory
      .filter((call) => call.response.duration > thresholdMs)
      .sort((a, b) => b.response.duration - a.response.duration)
      .slice(0, limit);
  }

  /**
   * Clear all captured data
   */
  clear(): void {
    this.requests.clear();
    this.responses.clear();
    this.callHistory = [];
    logger.debug('Cleared Google API Inspector data');
  }

  /**
   * Check if inspector is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Global Google API inspector instance
 */
let globalInspector: GoogleApiInspector | undefined;

/**
 * Get or create the global Google API inspector
 */
export function getGoogleApiInspector(): GoogleApiInspector {
  if (!globalInspector) {
    globalInspector = new GoogleApiInspector({
      enabled: process.env['GOOGLE_API_TRACE_ENABLED'] === 'true',
      includeBody: process.env['GOOGLE_API_TRACE_BODY'] === 'true',
      maxHistorySize: parseInt(process.env['GOOGLE_API_TRACE_HISTORY_SIZE'] ?? '500', 10),
    });
  }
  return globalInspector;
}

/**
 * Reset the global inspector (mainly for testing)
 */
export function resetGoogleApiInspector(): void {
  globalInspector = undefined;
}
