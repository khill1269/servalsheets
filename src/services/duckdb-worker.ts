/**
 * DuckDB Worker — runs inside a worker_threads Worker.
 *
 * Receives WorkerRequest via workerData, executes the SQL query
 * against in-memory tables, and posts the result back via parentPort.
 *
 * This file is compiled to duckdb-worker.js and loaded dynamically
 * by DuckDBEngine via new Worker(workerPath, { workerData }).
 */

import { workerData, parentPort } from 'worker_threads';

interface WorkerRequest {
  tables: Array<{ name: string; rows: unknown[][] }>;
  sql: string;
}

interface WorkerSuccess {
  success: true;
  columns: string[];
  rows: unknown[][];
  executionMs: number;
}

interface WorkerFailure {
  success: false;
  error: string;
}

function validateDuckDbSql(sql: string): void {
  const normalized = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .toLowerCase()
    .trim();
  if (!/^select\b/.test(normalized)) {
    throw new Error('Only SELECT statements are allowed in DuckDB queries');
  }
  const blocked = /\b(create|drop|insert|update|delete|alter|truncate|attach|copy|load|install)\b/;
  if (blocked.test(normalized)) {
    throw new Error('DDL/DML statements are not allowed in DuckDB queries');
  }
  if (/read_csv|read_json|read_parquet|glob\s*\(|scan_csv/.test(normalized)) {
    throw new Error('File system access functions are not allowed in DuckDB queries');
  }
}

function validateTableName(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)) {
    throw new Error(
      `Invalid table name "${name}": must start with a letter or underscore and contain only alphanumeric characters or underscores (max 64 chars)`
    );
  }
}

async function runQuery(): Promise<void> {
  try {
    const { Database } = await import('duckdb-async');
    const db = await Database.create(':memory:');
    const conn = await db.connect();
    const req = workerData as WorkerRequest;

    // Validate user SQL before creating any views
    validateDuckDbSql(req.sql);

    // Register each table as a view using DuckDB's read_json_auto
    for (const table of req.tables) {
      if (table.rows.length === 0) continue;

      // Validate table name against strict allowlist before any SQL interpolation
      validateTableName(table.name);

      const headers = table.rows[0] as string[];
      const dataRows = table.rows.slice(1);

      // Build JSON array: [{header0: val0, header1: val1, ...}, ...]
      const jsonData = dataRows.map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });

      // Escape single quotes in the JSON string for DuckDB SQL
      const jsonStr = JSON.stringify(jsonData).replace(/'/g, "''");

      const escapedTableName = table.name.replace(/"/g, '""');
      await conn.exec(
        `CREATE VIEW "${escapedTableName}" AS SELECT * FROM read_json_auto('${jsonStr}'::JSON)`
      );
    }

    const start = Date.now();
    const rows = await conn.all(req.sql);
    const executionMs = Date.now() - start;

    const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];

    const result: WorkerSuccess = {
      success: true,
      columns,
      rows: rows.map((r) => columns.map((c) => (r as Record<string, unknown>)[c])),
      executionMs,
    };

    parentPort?.postMessage(result);
    await db.close();
  } catch (err) {
    const result: WorkerFailure = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort?.postMessage(result);
  }
}

runQuery();
