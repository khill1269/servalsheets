/**
 * ServalSheets - MINIMAL Tool Descriptions (Token-Optimized)
 *
 * These descriptions are designed for DEFERRED_DESCRIPTIONS mode.
 * Target: ~50-100 tokens per tool (vs ~350-500 in full mode)
 *
 * Full documentation available via:
 * - schema://servalsheets/tools/{tool_name}  (MCP resource)
 * - https://servalsheets.dev/docs/tools/{tool_name}  (web docs)
 */

import { z } from 'zod';
import { ErrorDetailSchema, ResponseMetaSchema, type ToolAnnotations } from './shared.js';

// Minimal descriptions for all 25 tools (50-100 tokens per tool)
// Used when DEFERRED_DESCRIPTIONS is enabled (client requests descriptions via schema://resource)

const TOOL_DESCRIPTIONS_MINIMAL = {
  sheets_core: 'Spreadsheet and sheet management (create, read, list, update, delete sheets and spreadsheet properties)',
  sheets_data: 'Read, write, clear, and manipulate cell values and ranges (basic data operations)',
  sheets_format: 'Cell formatting, styles, colors, borders, conditional rules, data validation, sparklines',
  sheets_dimensions: 'Row and column management (insert, delete, resize, hide, freeze, sort, filter, group)',
  sheets_advanced: 'Named ranges, named functions, protected ranges, tables, metadata, smart chips',
  sheets_visualize: 'Charts and pivots (create, read, update, delete, suggest charts)',
  sheets_collaborate: 'Sharing, permissions, comments, versions, approvals, labels',
  sheets_composite: 'Multi-step operations: import/export CSV/XLSX, dedup, smart append, sheet generation',
  sheets_analyze: 'Full workbook analysis: 43 feature categories, quality scoring, AI-powered insights',
  sheets_fix: 'Data cleaning: detect/fix formatting issues, standardize formats, fill missing, anomaly detection',
  sheets_templates: 'Reusable sheet templates (create, apply, import, list, delete)',
  sheets_bigquery: 'BigQuery integration: Connected Sheets queries, imports, exports, Looker connections',
  sheets_appsscript: 'Google Apps Script management: create, deploy, run, version control, triggers',
  sheets_auth: 'Authentication and authorization (OAuth, token management, setup features)',
  sheets_confirm: 'User confirmations via MCP Elicitation (wizards, consent flows)',
  sheets_dependencies: 'Formula dependency tracking, impact analysis, scenario modeling (what-if analysis)',
  sheets_quality: 'Data validation, conflict detection, impact analysis (pre-flight checks)',
  sheets_history: 'Operation history, undo/redo, snapshots, revisions, time-travel debugging',
  sheets_session: 'Session state: active spreadsheet, preferences, context tracking, operation recording',
  sheets_transaction: 'Atomic multi-operation transactions with rollback support',
  sheets_federation: 'Remote MCP server calls (query cross-regional or partner data)',
  sheets_webhook: 'Event notifications (push, subscribe, Redis-backed)',
  sheets_agent: 'Agentic execution: plan, execute, observe, rollback, get status',
  sheets_compute: 'Server-side computation: stats, regression, forecasting, DuckDB, Python',
  sheets_connectors: 'External data connectors (financial APIs: Finnhub, FRED, Alpha Vantage, Polygon, FMP)',
};

export const MINIMAL_DESCRIPTIONS = TOOL_DESCRIPTIONS_MINIMAL;

// Schema for tool minimal descriptions
export const ToolMinimalDescriptionsSchema = z.object({
  descriptions: z.record(z.string().min(1), z.string().min(50).max(200)),
});

export type ToolMinimalDescriptions = z.infer<typeof ToolMinimalDescriptionsSchema>;
