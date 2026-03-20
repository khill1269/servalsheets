/**
 * Type declarations for duckdb-async (optional dependency)
 * duckdb-async provides an async/await wrapper around DuckDB
 */
declare module 'duckdb-async' {
  export class Database {
    static create(path: string): Promise<Database>;
    connect(): Promise<Connection>;
    close(): Promise<void>;
  }
  export interface Connection {
    exec(sql: string): Promise<void>;
    all(sql: string): Promise<Record<string, unknown>[]>;
    close(): Promise<void>;
  }
}
