/**
 * BigQuery shared helpers — module-level validators and utilities used across
 * all bigquery-actions submodules.
 */

import { createValidationError } from '../../utils/error-factory.js';

/** Maximum BigQuery result rows (ISSUE-188: configurable via env var) */
export { getEnv } from '../../config/env.js';

/**
 * SECURITY: Validate BigQuery identifiers (project, dataset, table names).
 * Prevents SQL injection via malformed identifiers that could escape backtick quoting.
 * BigQuery identifiers: alphanumeric + underscores + hyphens, max 1024 chars.
 */
const BQ_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]{1,1024}$/;

export function validateBigQueryIdentifier(value: string, field: string): void {
  if (!BQ_IDENTIFIER_REGEX.test(value)) {
    throw createValidationError({
      field,
      value: value.substring(0, 50),
      reason: `Invalid BigQuery identifier: ${field} must contain only alphanumeric characters, underscores, and hyphens (max 1024 chars)`,
    });
  }
}

/**
 * Build a safely-quoted BigQuery table reference from validated identifiers.
 */
export function safeBqTableRef(projectId: string, datasetId: string, tableId: string): string {
  validateBigQueryIdentifier(projectId, 'projectId');
  validateBigQueryIdentifier(datasetId, 'datasetId');
  validateBigQueryIdentifier(tableId, 'tableId');
  return `\`${projectId}.${datasetId}.${tableId}\``;
}

/**
 * Dangerous SQL patterns that should be blocked in Connected Sheets queries.
 * Connected Sheets executes queries in BigQuery with the user's permissions,
 * so we validate to prevent accidental destructive operations and cost attacks.
 */
const DANGEROUS_SQL_PATTERNS = [
  /\bDROP\s+(TABLE|DATABASE|SCHEMA|VIEW|FUNCTION|PROCEDURE)\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bALTER\s+(TABLE|DATABASE|SCHEMA)\b/i,
  /\bCREATE\s+(TABLE|DATABASE|SCHEMA|VIEW|FUNCTION|PROCEDURE)\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+\S+\s+SET\b/i,
  /\bMERGE\s+INTO\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXECUTE\s+IMMEDIATE\b/i,
  /\bCALL\s+\w/i,
];

export function validateBigQuerySql(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) {
    throw createValidationError({
      field: 'query',
      value: '',
      reason: 'BigQuery query cannot be empty',
    });
  }

  // Strip SQL comments to prevent evasion (e.g., DROP/**/TABLE)
  let sanitized = trimmed;
  sanitized = sanitized.replace(/--[^\n]*/g, ' '); // Single-line comments
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, ' '); // Multi-line comments
  sanitized = sanitized.replace(/'([^'\\]|\\.)*'/g, ' '); // Single-quoted strings
  sanitized = sanitized.replace(/"([^"\\]|\\.)*"/g, ' '); // Double-quoted strings
  sanitized = sanitized.replace(/`([^`\\]|\\.)*`/g, ' '); // Backtick-quoted identifiers
  sanitized = sanitized.replace(/\s+/g, ' '); // Collapse whitespace

  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw createValidationError({
        field: 'query',
        value: trimmed.substring(0, 50),
        reason: `BigQuery query contains a potentially destructive statement matching ${pattern.source}. Only SELECT queries are allowed.`,
      });
    }
  }
}

/**
 * Map Data Transfer API HTTP status to safe error code + message.
 */
export function mapDataTransferApiError(status: number): {
  code: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'INVALID_PARAMS' | 'QUOTA_EXCEEDED' | 'INTERNAL_ERROR';
  message: string;
  retryable: boolean;
} {
  const code =
    status === 403
      ? ('PERMISSION_DENIED' as const)
      : status === 404
        ? ('NOT_FOUND' as const)
        : status === 400
          ? ('INVALID_PARAMS' as const)
          : status === 429
            ? ('QUOTA_EXCEEDED' as const)
            : ('INTERNAL_ERROR' as const);
  const message =
    status === 403
      ? 'Permission denied. Check BigQuery Data Transfer API is enabled and OAuth scopes include bigquery.'
      : status === 404
        ? 'Resource not found. Verify project, location, and transferConfigName.'
        : status === 400
          ? 'Invalid request. Check scheduled query configuration and parameters.'
          : status === 429
            ? 'Rate limit exceeded. Please wait and retry.'
            : `Scheduled query operation failed (HTTP ${status}). Check BigQuery console.`;
  return {
    code,
    message,
    retryable: status >= 500 || status === 429,
  };
}
