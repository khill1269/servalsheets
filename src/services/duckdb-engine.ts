/**
 * DuckDB Engine — wraps DuckDB queries inside a worker_threads Worker.
 *
 * Each query runs in an isolated Worker so that DuckDB's native bindings
 * cannot block the main event loop. The Worker is terminated after the
 * query completes or times out.
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface TableDef {
  name: string;
  range: string;
  hasHeaders: boolean;
  rows: unknown[][];
}

export interface QueryRequest {
  tables: TableDef[];
  sql: string;
  timeoutMs?: number;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  executionMs: number;
}

interface WorkerMessage {
  success: boolean;
  columns?: string[];
  rows?: unknown[][];
  executionMs?: number;
  error?: string;
}

// ============================================================================
// DuckDBEngine
// ============================================================================

export class DuckDBEngine {
  /**
   * Execute a SQL query against in-memory tables populated from spreadsheet data.
   *
   * Each call spawns a fresh Worker and tears it down on completion.
   * The default timeout is 30 seconds.
   */
  async query(request: QueryRequest): Promise<QueryResult> {
    return new Promise<QueryResult>((resolve, reject) => {
      // Build the path to the compiled worker JS file.
      // In the compiled dist/, this file lives next to duckdb-engine.js.
      const thisDir = dirname(fileURLToPath(import.meta.url));
      const workerPath = join(thisDir, 'duckdb-worker.js');

      const workerData = {
        tables: request.tables.map((t) => ({
          name: t.name,
          rows: t.rows,
        })),
        sql: request.sql,
      };

      const worker = new Worker(workerPath, { workerData });

      const timeoutMs = request.timeoutMs ?? 30000;
      const timer = setTimeout(() => {
        worker.terminate().catch(() => {
          // ignore termination errors
        });
        reject(new Error(`DuckDB query timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      worker.on('message', (msg: WorkerMessage) => {
        clearTimeout(timer);
        if (msg.success) {
          resolve({
            columns: msg.columns!,
            rows: msg.rows!,
            executionMs: msg.executionMs!,
          });
        } else {
          reject(new Error(msg.error ?? 'DuckDB query failed'));
        }
      });

      worker.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      worker.on('exit', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`DuckDB worker exited with code ${code}`));
        }
      });
    });
  }
}
