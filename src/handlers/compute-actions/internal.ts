/**
 * Internal handler access type for compute-actions submodules.
 * Exposes private methods from ComputeHandler for dependency injection.
 */

import type { sheets_v4 } from 'googleapis';
import type { SamplingServer } from '../../mcp/sampling.js';
import type { DuckDBEngine } from '../../services/duckdb-engine.js';
import type { SessionContextManager } from '../../services/session-context.js';

type ElicitFn = (opts: {
  message: string;
  requestedSchema: unknown;
}) => Promise<{ action: string; content: unknown }>;

export interface ComputeHandlerAccess {
  // Google Sheets API
  readonly sheetsApi: sheets_v4.Sheets;

  // Optional services
  readonly samplingServer?: SamplingServer;
  readonly duckdbEngine?: DuckDBEngine;
  readonly server?: { elicitInput?: ElicitFn };
  readonly sessionContext?: SessionContextManager;
}
