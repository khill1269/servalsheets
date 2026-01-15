/**
 * Request Replay System
 *
 * Captures failed requests for later replay during debugging.
 * Supports batch replay, request modification, and test script generation.
 */

import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import { logger } from './logger.js';
import { type ErrorDetail } from '../schemas/shared.js';

/**
 * Replayable request with full context
 */
export interface ReplayableRequest {
  id: string;
  timestamp: number;
  toolName: string;
  action: string;
  input: unknown;
  originalResponse?: unknown;
  originalError?: ErrorDetail;
  correlationId?: string;
  metadata?: {
    spreadsheetId?: string;
    sheetName?: string;
    duration?: number;
    retryCount?: number;
  };
}

/**
 * Replay result
 */
export interface ReplayResult {
  requestId: string;
  success: boolean;
  response?: unknown;
  error?: ErrorDetail;
  duration: number;
  timestamp: number;
}

/**
 * Replay options
 */
export interface ReplayOptions {
  modifyInput?: (input: unknown) => unknown;
  timeout?: number;
  skipValidation?: boolean;
}

/**
 * Replay handler function type
 */
export type ReplayHandler = (toolName: string, action: string, input: unknown) => Promise<unknown>;

/**
 * Request Replay System Configuration
 */
export interface RequestReplayConfig {
  enabled?: boolean;
  captureSuccess?: boolean;
  storageFile?: string;
  maxStorageSize?: number;
}

/**
 * Request Replay System
 *
 * Captures requests (especially failures) and allows replaying them
 * for debugging and regression testing.
 */
export class RequestReplaySystem {
  private requests: Map<string, ReplayableRequest> = new Map();
  private readonly enabled: boolean;
  private readonly captureSuccess: boolean;
  private readonly storageFile: string;
  private readonly maxStorageSize: number;
  private replayHandler?: ReplayHandler;

  constructor(config: RequestReplayConfig = {}) {
    this.enabled = config.enabled ?? process.env['REQUEST_REPLAY_ENABLED'] === 'true';
    this.captureSuccess =
      config.captureSuccess ?? process.env['REQUEST_REPLAY_CAPTURE_SUCCESS'] === 'true';
    this.storageFile = config.storageFile ?? process.env['REQUEST_REPLAY_FILE'] ?? 'replay.jsonl';
    this.maxStorageSize = config.maxStorageSize ?? 1000;

    // Load existing requests from storage
    if (this.enabled && existsSync(this.storageFile)) {
      this.loadFromStorage();
    }
  }

  /**
   * Check if replay system is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set replay handler for executing replayed requests
   */
  setReplayHandler(handler: ReplayHandler): void {
    this.replayHandler = handler;
  }

  /**
   * Capture a request for potential replay
   */
  captureRequest(request: Omit<ReplayableRequest, 'id' | 'timestamp'>): string {
    if (!this.enabled) {
      return '';
    }

    // Only capture failures unless captureSuccess is enabled
    if (!this.captureSuccess && !request.originalError) {
      return '';
    }

    const id = `replay-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const fullRequest: ReplayableRequest = {
      id,
      timestamp: Date.now(),
      ...request,
    };

    this.requests.set(id, fullRequest);
    this.persistToStorage(fullRequest);

    // Enforce max storage size
    if (this.requests.size > this.maxStorageSize) {
      const oldestId = Array.from(this.requests.keys())[0];
      if (oldestId) {
        this.requests.delete(oldestId);
      }
    }

    return id;
  }

  /**
   * Get a captured request by ID
   */
  getRequest(requestId: string): ReplayableRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Get all captured requests
   */
  getAllRequests(): ReplayableRequest[] {
    return Array.from(this.requests.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get failed requests only
   */
  getFailedRequests(limit?: number): ReplayableRequest[] {
    const failed = Array.from(this.requests.values())
      .filter((req) => req.originalError)
      .sort((a, b) => b.timestamp - a.timestamp);

    return limit ? failed.slice(0, limit) : failed;
  }

  /**
   * Get requests by tool name
   */
  getRequestsByTool(toolName: string): ReplayableRequest[] {
    return Array.from(this.requests.values())
      .filter((req) => req.toolName === toolName)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Replay a single request
   */
  async replayRequest(requestId: string, options: ReplayOptions = {}): Promise<ReplayResult> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    if (!this.replayHandler) {
      throw new Error('Replay handler not set. Call setReplayHandler() first.');
    }

    const startTime = Date.now();
    let input = request.input;

    // Apply input modifications if provided
    if (options.modifyInput) {
      input = options.modifyInput(input);
    }

    try {
      const response = await this.replayHandler(request.toolName, request.action, input);

      return {
        requestId,
        success: true,
        response,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return {
        requestId,
        success: false,
        error: {
          code: 'REPLAY_FAILED',
          message: err?.message || 'Replay failed',
          category: 'server',
          severity: 'high',
          retryable: false,
        },
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Replay multiple requests in batch
   */
  async replayBatch(requestIds: string[], options: ReplayOptions = {}): Promise<ReplayResult[]> {
    const results: ReplayResult[] = [];

    for (const requestId of requestIds) {
      try {
        const result = await this.replayRequest(requestId, options);
        results.push(result);
      } catch (error: unknown) {
        const err = error as { message?: string };
        results.push({
          requestId,
          success: false,
          error: {
            code: 'REPLAY_FAILED',
            message: err?.message || 'Replay failed',
            category: 'server',
            severity: 'high',
            retryable: false,
          },
          duration: 0,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  }

  /**
   * Export requests as test script
   */
  exportReplayScript(requestIds: string[]): string {
    const requests = requestIds
      .map((id) => this.requests.get(id))
      .filter((req): req is ReplayableRequest => Boolean(req));

    if (requests.length === 0) {
      return '// No requests to export';
    }

    const lines: string[] = [
      "import { describe, it, expect } from 'vitest';",
      "import { handleToolCall } from '../src/handlers/index.js';",
      "import { getGoogleApiClient } from '../src/services/google-api.js';",
      '',
      "describe('Replayed Requests', () => {",
      '  let apiClient: ReturnType<typeof getGoogleApiClient>;',
      '',
      '  beforeAll(async () => {',
      '    apiClient = await getGoogleApiClient();',
      '  });',
      '',
    ];

    for (const request of requests) {
      const testName = `should replay ${request.toolName}/${request.action} (${request.id})`;
      const inputJson = JSON.stringify(request.input, null, 4);

      lines.push(`  it('${testName}', async () => {`);
      lines.push(`    const input = ${inputJson};`);
      lines.push('');
      lines.push('    const result = await handleToolCall({');
      lines.push(`      toolName: '${request.toolName}',`);
      lines.push(`      action: '${request.action}',`);
      lines.push('      input,');
      lines.push('      apiClient,');
      lines.push('    });');
      lines.push('');
      lines.push('    expect(result).toBeDefined();');

      if (request.originalError) {
        lines.push('    // Original request failed with:');
        lines.push(`    // ${request.originalError.code}: ${request.originalError.message}`);
        lines.push('    // Verify the error is fixed');
        lines.push('    expect(result.error).toBeUndefined();');
      } else {
        lines.push('    expect(result.response).toBeDefined();');
      }

      lines.push('  });');
      lines.push('');
    }

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Export requests as curl commands
   */
  exportCurlCommands(requestIds: string[]): string {
    const requests = requestIds
      .map((id) => this.requests.get(id))
      .filter((req): req is ReplayableRequest => Boolean(req));

    const lines: string[] = ['#!/bin/bash', '', '# Replay requests via MCP stdin', ''];

    for (const request of requests) {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: request.toolName,
          arguments: {
            action: request.action,
            ...(typeof request.input === 'object' && request.input !== null
              ? (request.input as Record<string, unknown>)
              : {}),
          },
        },
      };

      lines.push(
        `# ${request.toolName}/${request.action} - ${new Date(request.timestamp).toISOString()}`
      );
      if (request.originalError) {
        lines.push(`# Original error: ${request.originalError.code}`);
      }
      lines.push(`echo '${JSON.stringify(jsonRpcRequest)}' | node dist/server.js`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export statistics about captured requests
   */
  getStats(): {
    total: number;
    failed: number;
    succeeded: number;
    byTool: Record<string, number>;
    byAction: Record<string, number>;
    avgDuration: number;
  } {
    const all = this.getAllRequests();
    const failed = all.filter((req) => req.originalError);
    const succeeded = all.filter((req) => !req.originalError);

    const byTool: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const request of all) {
      byTool[request.toolName] = (byTool[request.toolName] || 0) + 1;
      const actionKey = `${request.toolName}/${request.action}`;
      byAction[actionKey] = (byAction[actionKey] || 0) + 1;

      if (request.metadata?.duration) {
        totalDuration += request.metadata.duration;
        durationCount++;
      }
    }

    return {
      total: all.length,
      failed: failed.length,
      succeeded: succeeded.length,
      byTool,
      byAction,
      avgDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    };
  }

  /**
   * Clear all captured requests
   */
  clear(): void {
    this.requests.clear();
    if (existsSync(this.storageFile)) {
      writeFileSync(this.storageFile, '');
    }
  }

  /**
   * Clear old requests (older than specified age in ms)
   */
  clearOldRequests(maxAgeMs: number): number {
    const now = Date.now();
    let cleared = 0;

    for (const [id, request] of this.requests.entries()) {
      if (now - request.timestamp > maxAgeMs) {
        this.requests.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Persist request to storage file (JSONL format)
   */
  private persistToStorage(request: ReplayableRequest): void {
    try {
      const line = JSON.stringify(request) + '\n';
      appendFileSync(this.storageFile, line, 'utf-8');
    } catch (error: unknown) {
      logger.error('Failed to persist request to storage', {
        error: error instanceof Error ? error.message : String(error),
        requestId: request.id,
      });
    }
  }

  /**
   * Load requests from storage file
   */
  private loadFromStorage(): void {
    try {
      const content = readFileSync(this.storageFile, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const request = JSON.parse(line) as ReplayableRequest;
          this.requests.set(request.id, request);
        } catch {
          // Skip invalid lines
        }
      }

      // Enforce max storage size (keep most recent)
      if (this.requests.size > this.maxStorageSize) {
        const sorted = Array.from(this.requests.entries()).sort(
          ([, a], [, b]) => b.timestamp - a.timestamp
        );
        this.requests = new Map(sorted.slice(0, this.maxStorageSize));
      }
    } catch (error: unknown) {
      logger.error('Failed to load requests from storage', {
        error: error instanceof Error ? error.message : String(error),
        storageFile: this.storageFile,
      });
    }
  }
}

/**
 * Global request replay system instance
 */
let globalReplaySystem: RequestReplaySystem | null = null;

/**
 * Get or create global request replay system
 */
export function getRequestReplaySystem(): RequestReplaySystem {
  if (!globalReplaySystem) {
    globalReplaySystem = new RequestReplaySystem({
      enabled: process.env['REQUEST_REPLAY_ENABLED'] === 'true',
      captureSuccess: process.env['REQUEST_REPLAY_CAPTURE_SUCCESS'] === 'true',
      storageFile: process.env['REQUEST_REPLAY_FILE'],
    });
  }
  return globalReplaySystem;
}

/**
 * Reset global request replay system
 */
export function resetRequestReplaySystem(): void {
  if (globalReplaySystem) {
    globalReplaySystem.clear();
  }
  globalReplaySystem = null;
}
