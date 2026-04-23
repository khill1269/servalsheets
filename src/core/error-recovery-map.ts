/**
 * Error Recovery Map
 *
 * Maps every ErrorCode in `src/schemas/shared.ts:ErrorCodeSchema` to an
 * actionable recovery hint plus (where applicable) a structured `fixableVia`
 * pointer to the tool/action that can resolve it.
 *
 * Consumed by `BaseHandler.mapError()` to populate `ErrorDetail.suggestedFix`
 * and `ErrorDetail.fixableVia` when upstream code has not already supplied them.
 *
 * The `Record<ErrorCode, ...>` type forces TypeScript to enforce completeness —
 * any new code added to ErrorCodeSchema that is missing here fails `tsc`. A
 * runtime assertion in `tests/core/error-recovery-map.test.ts` catches the
 * reverse direction (entries removed from the enum).
 */

import type { ErrorCodeSchema } from '../schemas/shared.js';

export type ErrorCode = (typeof ErrorCodeSchema)['options'][number];

export interface ErrorRecovery {
  /** Short actionable recovery guidance shown to LLM/agent clients. */
  hint: string;
  /** Optional structured pointer to a tool+action that resolves this error. */
  fixableVia?: { tool: string; action: string };
}

export const ERROR_RECOVERY_MAP: Record<ErrorCode, ErrorRecovery> = {
  // --- MCP Standard ---
  PARSE_ERROR: {
    hint: 'Request could not be parsed as JSON-RPC. Validate the client serializer and retry.',
  },
  INVALID_REQUEST: {
    hint: 'Request shape violates JSON-RPC. Verify method, params, and id fields match the MCP spec.',
  },
  METHOD_NOT_FOUND: {
    hint: 'Unknown MCP method or tool. Call tools/list to see available tools.',
  },
  INVALID_PARAMS: {
    hint: 'Validate required fields and types against the tool schema; check A1 range format.',
  },
  INTERNAL_ERROR: {
    hint: 'Transient server error. Retry with exponential backoff; if persistent, file an issue.',
  },

  // --- Authentication & Authorization ---
  UNAUTHENTICATED: {
    hint: 'No active session. Call sheets_auth.login to authenticate.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  NOT_AUTHENTICATED: {
    hint: 'No active session. Call sheets_auth.login to authenticate.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  PERMISSION_DENIED: {
    hint: 'Credentials lack scope or sheet permission. Call sheets_auth.login to refresh scopes.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  INVALID_CREDENTIALS: {
    hint: 'Credentials invalid or revoked. Call sheets_auth.login to re-authenticate.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  TOKEN_EXPIRED: {
    hint: 'OAuth token expired. Call sheets_auth.login to refresh.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  INSUFFICIENT_PERMISSIONS: {
    hint: 'Logged in but lacks required scope. Request additional scope via sheets_auth.login.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  INCREMENTAL_SCOPE_REQUIRED: {
    hint: 'Additional OAuth scope required. Call sheets_auth.login with the requested scope.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  AUTHENTICATION_REQUIRED: {
    hint: 'No active session. Call sheets_auth.login first.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },
  AUTH_ERROR: {
    hint: 'Authentication failed. Re-run sheets_auth.login and check OAuth client config.',
    fixableVia: { tool: 'sheets_auth', action: 'login' },
  },

  // --- Quota & Rate Limiting ---
  QUOTA_EXCEEDED: {
    hint: 'API quota exceeded. Wait 60s and retry with smaller batches or use batch_read.',
  },
  RATE_LIMITED: {
    hint: 'Rate limited. Honor retryAfterMs; reduce request rate or coalesce via batch actions.',
  },
  RESOURCE_EXHAUSTED: {
    hint: 'Underlying resource exhausted. Wait and retry with reduced payload size.',
  },

  // --- Spreadsheet Errors ---
  SPREADSHEET_NOT_FOUND: {
    hint: 'Spreadsheet does not exist or is not shared with this user. Verify the ID/URL.',
  },
  SPREADSHEET_TOO_LARGE: {
    hint: 'Spreadsheet exceeds API limits. Split into multiple sheets or use BigQuery export.',
  },
  SHEET_NOT_FOUND: {
    hint: 'Call sheets_core.list_sheets to verify sheet names before referencing them.',
    fixableVia: { tool: 'sheets_core', action: 'list_sheets' },
  },
  INVALID_SHEET_ID: {
    hint: 'Sheet ID is malformed. Obtain valid IDs via sheets_core.list_sheets.',
    fixableVia: { tool: 'sheets_core', action: 'list_sheets' },
  },
  DUPLICATE_SHEET_NAME: {
    hint: 'A sheet with this name already exists. Choose a unique name or update the existing sheet.',
  },
  INVALID_RANGE: {
    hint: 'Use bounded A1 notation (e.g. A1:Z1000) including sheet name; avoid open-ended refs like A:Z.',
  },
  RANGE_NOT_FOUND: {
    hint: 'Range resolves to no cells. Verify the sheet exists and the A1 bounds are within its extent.',
  },
  PROTECTED_RANGE: {
    hint: 'Range is protected. Remove protection via sheets_advanced.update_protected_range or write to another range.',
    fixableVia: { tool: 'sheets_advanced', action: 'list_protected_ranges' },
  },

  // --- Data & Formula Errors ---
  COMPUTE_ERROR: {
    hint: 'Expression failed to evaluate. Check function name, argument types, and cell references.',
  },
  FORMULA_ERROR: {
    hint: 'Formula produced an error. Use sheets_analyze.formula_health_check to diagnose.',
    fixableVia: { tool: 'sheets_analyze', action: 'formula_health_check' },
  },
  CIRCULAR_REFERENCE: {
    hint: 'Formulas reference each other in a cycle. Use sheets_dependencies to locate and break the cycle.',
    fixableVia: { tool: 'sheets_dependencies', action: 'trace_dependencies' },
  },
  INVALID_DATA_VALIDATION: {
    hint: 'Data validation rule is malformed. Review condition type and criteria values.',
  },
  MERGE_CONFLICT: {
    hint: 'Concurrent write detected. Re-read latest values, reapply changes, and retry.',
  },
  FORMULA_INJECTION_BLOCKED: {
    hint: 'Formula rejected as unsafe (IMPORT*/QUERY/HYPERLINK). Prefix with an apostrophe or pre-fetch the data.',
  },

  // --- Feature-Specific Errors ---
  CONDITIONAL_FORMAT_ERROR: {
    hint: 'Conditional format rule is invalid. Validate condition type, ranges, and color format.',
  },
  PIVOT_TABLE_ERROR: {
    hint: 'Pivot spec is invalid. Verify source range, group columns, and value aggregations.',
  },
  CHART_ERROR: {
    hint: 'Chart spec invalid or source range empty. Validate domain/series ranges via sheets_visualize.',
  },
  FILTER_VIEW_ERROR: {
    hint: 'Filter view is invalid. Verify sheet ID and criteria ranges.',
  },
  NAMED_RANGE_ERROR: {
    hint: 'Named range reference invalid. List via sheets_advanced.list_named_ranges.',
    fixableVia: { tool: 'sheets_advanced', action: 'list_named_ranges' },
  },
  DEVELOPER_METADATA_ERROR: {
    hint: 'Developer metadata lookup failed. Tag the target with sheets_advanced.set_metadata first.',
    fixableVia: { tool: 'sheets_advanced', action: 'set_metadata' },
  },
  DIMENSION_ERROR: {
    hint: 'Row/column dimension operation invalid. Check sheet dimensions and indexes.',
  },

  // --- Operation Errors ---
  BATCH_UPDATE_ERROR: {
    hint: 'Batch update rejected. Inspect individual request results; retry failed ops individually.',
  },
  TRANSACTION_ERROR: {
    hint: 'Transaction failed. Inspect the offending op and retry; use sheets_transaction.rollback if needed.',
    fixableVia: { tool: 'sheets_transaction', action: 'rollback' },
  },
  ABORTED: {
    hint: 'Operation aborted by server (typically contention). Retry with backoff.',
  },
  DEADLINE_EXCEEDED: {
    hint: 'Operation exceeded deadline. Increase timeout or reduce payload size.',
  },
  CANCELLED: {
    hint: 'Operation was cancelled. Resubmit if the cancellation was not intended.',
  },
  OPERATION_CANCELLED: {
    hint: 'User cancelled the operation via elicitation. Reissue if the intent is confirmed.',
  },
  OPERATION_FAILED: {
    hint: 'Operation failed. Inspect details for specifics; retry once, then escalate.',
  },
  DATA_LOSS: {
    hint: 'Unrecoverable data issue. Restore from a snapshot via sheets_history.restore_snapshot.',
    fixableVia: { tool: 'sheets_history', action: 'restore_snapshot' },
  },

  // --- Network & Service Errors ---
  UNAVAILABLE: {
    hint: 'Upstream service unavailable. Retry with exponential backoff.',
  },
  CONNECTION_ERROR: {
    hint: 'Network connection to Google API was reset. Retry with backoff.',
  },
  UNIMPLEMENTED: {
    hint: 'This operation is currently unavailable on the server. Check the roadmap or use an alternative.',
  },
  UNKNOWN: {
    hint: 'Unknown upstream error. Inspect details and retry; if persistent, file an issue.',
  },
  OUT_OF_RANGE: {
    hint: 'Argument is out of the accepted range. Validate against the schema bounds.',
  },
  FAILED_PRECONDITION: {
    hint: 'System state does not meet preconditions. Check prerequisites and retry.',
  },

  // --- Safety Rails ---
  PRECONDITION_FAILED: {
    hint: 'Precondition failed (e.g. ETag mismatch). Re-read the resource and retry with current values.',
  },
  EFFECT_SCOPE_EXCEEDED: {
    hint: 'Operation would affect more cells than allowed. Narrow the range or raise the effect-scope limit.',
  },
  EXPLICIT_RANGE_REQUIRED: {
    hint: 'Open-ended ranges (e.g. A:Z) are disallowed here. Provide an explicit bounded A1 range.',
  },
  AMBIGUOUS_RANGE: {
    hint: 'Range resolves to multiple candidates. Qualify with sheet name or use dataFilter.',
  },

  // --- Features ---
  FEATURE_UNAVAILABLE: {
    hint: 'Feature not enabled in this environment. Enable the corresponding config flag or service.',
  },
  FEATURE_DEGRADED: {
    hint: 'Feature is running in degraded mode. Check logs/config for the underlying cause.',
  },

  // --- Auth & configuration ---
  CONFIG_ERROR: {
    hint: 'Server configuration is invalid. Check env vars and config files against the docs.',
  },
  NOT_CONFIGURED: {
    hint: 'Required configuration is missing. Set the relevant env var before calling this action.',
  },
  VALIDATION_ERROR: {
    hint: 'Input failed schema validation. Review error details for the specific field.',
  },

  // --- Resource/handler lifecycle ---
  NOT_FOUND: {
    hint: 'Requested resource does not exist. Verify ID/name via the relevant list action.',
  },
  NOT_IMPLEMENTED: {
    hint: 'Requested action is currently unavailable. Check tools/list for available actions.',
  },
  HANDLER_LOAD_ERROR: {
    hint: 'Tool handler failed to load. Check server logs; restart if persistent.',
  },

  // --- Session limits ---
  TOO_MANY_SESSIONS: {
    hint: 'Session limit exceeded. Close idle sessions or wait for them to expire.',
  },

  // --- Data integrity ---
  DATA_ERROR: {
    hint: 'Data returned is malformed. Retry once; if persistent, inspect with sheets_analyze.analyze_quality.',
    fixableVia: { tool: 'sheets_analyze', action: 'analyze_quality' },
  },
  VERSION_MISMATCH: {
    hint: 'Spreadsheet version changed between read and write. Re-read and retry.',
  },
  NO_DATA: {
    hint: 'Range is empty. Widen the range or verify the source sheet has data.',
  },

  // --- Service lifecycle ---
  SERVICE_NOT_INITIALIZED: {
    hint: 'Service is not initialized. Wait for startup or check init logs for errors.',
  },
  SERVICE_NOT_ENABLED: {
    hint: 'Required Google service is not enabled on the GCP project. Enable it in the Cloud Console.',
  },
  SNAPSHOT_CREATION_FAILED: {
    hint: 'Snapshot could not be created. Check storage config and retry.',
  },
  SNAPSHOT_RESTORE_FAILED: {
    hint: 'Snapshot restore failed. Verify snapshot ID via sheets_history.list_snapshots.',
    fixableVia: { tool: 'sheets_history', action: 'list_snapshots' },
  },

  // --- Transactions ---
  TRANSACTION_CONFLICT: {
    hint: 'Conflicting write in transaction. Retry with fresh reads or serialize via write-lock.',
  },
  TRANSACTION_EXPIRED: {
    hint: 'Transaction expired before commit. Begin a new transaction and resubmit.',
    fixableVia: { tool: 'sheets_transaction', action: 'begin' },
  },

  // --- HTTP Transport ---
  SESSION_NOT_FOUND: {
    hint: 'No MCP session with that ID. Reconnect to establish a new session.',
  },

  // --- Session checkpoints ---
  CHECKPOINTS_DISABLED: {
    hint: 'Session checkpointing is disabled in this deployment. Enable the feature flag to use it.',
  },
  CHECKPOINT_NOT_FOUND: {
    hint: 'No checkpoint with that ID. List available via sheets_session.list_checkpoints.',
    fixableVia: { tool: 'sheets_session', action: 'list_checkpoints' },
  },

  // --- Batch/Payload ---
  PAYLOAD_TOO_LARGE: {
    hint: 'Request payload exceeds limits. Split into smaller batches or use batch_read/write.',
  },
  OPERATION_LIMIT_EXCEEDED: {
    hint: 'Too many operations in one call. Split across multiple requests or use a transaction.',
  },

  // --- MCP-native features ---
  ELICITATION_UNAVAILABLE: {
    hint: 'Client does not support elicitation. Supply the required params up front.',
  },
  SAMPLING_UNAVAILABLE: {
    hint: 'Client does not support sampling. Provide input directly instead of delegating to the model.',
  },

  // --- Discovery & Replay ---
  FORBIDDEN: {
    hint: 'Action is blocked by policy. Review policy config or request an exception.',
  },
  DISCOVERY_FAILED: {
    hint: 'Action discovery failed. Retry or fall back to an explicit tool/action call.',
  },
  REPLAY_FAILED: {
    hint: 'Replay failed. Inspect replay log and verify source integrity.',
  },

  // --- Generic ---
  UNKNOWN_ERROR: {
    hint: 'An unexpected error occurred. Retry once; if persistent, file an issue with the request ID.',
  },

  // --- Connectors ---
  INVALID_ACTION: {
    hint: 'Action name is not valid for this tool. Call tools/list for supported actions.',
  },
  CONNECTOR_ERROR: {
    hint: 'Third-party connector failed. Inspect connector logs and retry; reconfigure if persistent.',
  },

  // --- Session errors ---
  SESSION_ERROR: {
    hint: 'Session operation failed. Call sheets_session.get_context to inspect state; reset if needed.',
    fixableVia: { tool: 'sheets_session', action: 'get_context' },
  },

  // --- DuckDB / SQL query safety ---
  QUERY_REJECTED: {
    hint: 'SQL rejected by safety rules (non-SELECT, DDL/DML, or file access). Use a read-only SELECT.',
  },

  // --- Write locking ---
  LOCK_TIMEOUT: {
    hint: 'Write lock timed out (concurrent write contention). Retry with backoff or serialize writes.',
  },

  // --- Task lifecycle ---
  TASK_CANCELLED: {
    hint: 'Task was cancelled before completion. Resubmit if the cancellation was unintended.',
  },
};
