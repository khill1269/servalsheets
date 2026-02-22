/**
 * Audit Middleware
 *
 * Automatically logs audit events for all MCP tool calls.
 * Integrates with request context for correlation.
 *
 * ## Audit Coverage
 *
 * **Data Mutations** (sheets_data, sheets_dimensions, sheets_format):
 * - All write operations (write_range, append_rows, clear_range)
 * - All structural changes (insert_rows, delete_columns)
 * - All formatting operations (apply_formatting, set_cell_format)
 *
 * **Permission Changes** (sheets_collaborate):
 * - Sharing spreadsheets (share_spreadsheet)
 * - Updating permissions (update_permissions)
 * - Revoking access (revoke_access)
 *
 * **Authentication** (sheets_auth):
 * - Login attempts (authenticate)
 * - Token refresh (refresh_token)
 * - Token revocation (revoke_token)
 *
 * **Exports** (sheets_data, sheets_bigquery):
 * - CSV exports (export_csv)
 * - XLSX exports (export_xlsx)
 * - BigQuery exports (export_to_bigquery)
 *
 * ## Usage
 *
 * ```typescript
 * import { createAuditMiddleware } from './middleware/audit-middleware.js';
 * import { getAuditLogger } from './services/audit-logger.js';
 *
 * const auditLogger = getAuditLogger();
 * const auditMiddleware = createAuditMiddleware(auditLogger);
 *
 * // Wrap handler execution
 * const result = await auditMiddleware.wrap(
 *   toolName,
 *   action,
 *   args,
 *   () => handler.executeAction(args)
 * );
 * ```
 *
 * ## Request Context Integration
 *
 * The middleware automatically extracts context from AsyncLocalStorage:
 * - Request ID (for correlation with application logs)
 * - User ID (from authentication context)
 * - IP address (from HTTP request)
 * - User agent (from HTTP headers)
 * - OAuth scopes (from token claims)
 */

import type { AuditLogger } from '../services/audit-logger.js';
import { getRequestContext } from '../utils/request-context.js';
import { logger } from '../utils/logger.js';

/**
 * Tool actions that trigger audit logging
 */
const MUTATION_ACTIONS = new Set([
  // sheets_data
  'write_range',
  'append_rows',
  'clear_range',
  'batch_update',

  // sheets_dimensions
  'insert_rows',
  'insert_columns',
  'delete_rows',
  'delete_columns',
  'move_rows',
  'move_columns',

  // sheets_format
  'apply_formatting',
  'set_cell_format',
  'set_row_height',
  'set_column_width',
  'merge_cells',
  'unmerge_cells',
]);

const PERMISSION_ACTIONS = new Set([
  'share_spreadsheet',
  'update_permissions',
  'revoke_access',
  'transfer_ownership',
]);

const AUTHENTICATION_ACTIONS = new Set([
  'authenticate',
  'refresh_token',
  'revoke_token',
  'oauth_grant',
  'service_account_auth',
]);

const EXPORT_ACTIONS = new Set([
  'export_csv',
  'export_xlsx',
  'export_pdf',
  'export_to_bigquery',
  'download_attachment',
]);

const CONFIGURATION_ACTIONS = new Set([
  'update_env',
  'toggle_feature',
  'adjust_rate_limit',
  'update_webhook',
]);

/**
 * Audit middleware for automatic event logging
 */
export class AuditMiddleware {
  constructor(private auditLogger: AuditLogger) {}

  /**
   * Wrap handler execution with audit logging
   */
  async wrap<T>(
    toolName: string,
    action: string,
    args: Record<string, unknown>,
    handler: () => Promise<T>
  ): Promise<T> {
    // Check if action requires audit logging
    if (!this.requiresAudit(action)) {
      return handler();
    }

    const startTime = Date.now();
    const requestContext = getRequestContext();

    // Extract user context
    const userId = this.extractUserId(args);
    const ipAddress = this.extractIpAddress();
    const resource = this.extractResource(args);

    let outcome: 'success' | 'failure' | 'partial' = 'success';
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let result: T | undefined;

    try {
      result = await handler();
      return result;
    } catch (error) {
      outcome = 'failure';
      errorCode = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const durationMs = Date.now() - startTime;

      // Log appropriate audit event
      try {
        if (MUTATION_ACTIONS.has(action)) {
          await this.auditLogger.logMutation({
            userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cast required for dynamic action types
            action: action as any,
            tool: toolName,
            resource,
            outcome,
            errorCode,
            errorMessage,
            ipAddress,
            requestId: requestContext?.requestId ?? 'unknown',
            durationMs,
            userAgent: this.extractUserAgent(),
            scopes: this.extractScopes(args),
            cellsModified: this.extractCellsModified(result),
            rowsModified: this.extractRowsModified(result),
            columnsModified: this.extractColumnsModified(result),
          });
        } else if (PERMISSION_ACTIONS.has(action)) {
          await this.auditLogger.logPermissionChange({
            userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cast required for dynamic action types
            action: action as any,
            tool: toolName,
            resource,
            outcome,
            errorCode,
            errorMessage,
            ipAddress,
            requestId: requestContext?.requestId ?? 'unknown',
            durationMs,
            userAgent: this.extractUserAgent(),
            scopes: this.extractScopes(args),
            permission: this.extractPermission(args),
          });
        } else if (AUTHENTICATION_ACTIONS.has(action)) {
          await this.auditLogger.logAuthentication({
            userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cast required for dynamic action types
            action: action as any,
            tool: toolName,
            resource,
            outcome,
            errorCode,
            errorMessage,
            ipAddress,
            requestId: requestContext?.requestId ?? 'unknown',
            durationMs,
            userAgent: this.extractUserAgent(),
            method: this.extractAuthMethod(action),
            failureReason: outcome === 'failure' ? errorMessage : undefined,
          });
        } else if (EXPORT_ACTIONS.has(action)) {
          await this.auditLogger.logExport({
            userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cast required for dynamic action types
            action: action as any,
            tool: toolName,
            resource,
            outcome,
            errorCode,
            errorMessage,
            ipAddress,
            requestId: requestContext?.requestId ?? 'unknown',
            durationMs,
            userAgent: this.extractUserAgent(),
            scopes: this.extractScopes(args),
            format: this.extractExportFormat(action),
            recordCount: this.extractRecordCount(result),
            fileSize: this.extractFileSize(result),
          });
        } else if (CONFIGURATION_ACTIONS.has(action)) {
          await this.auditLogger.logConfiguration({
            userId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cast required for dynamic action types
            action: action as any,
            tool: toolName,
            resource,
            outcome,
            errorCode,
            errorMessage,
            ipAddress,
            requestId: requestContext?.requestId ?? 'unknown',
            durationMs,
            userAgent: this.extractUserAgent(),
            scopes: this.extractScopes(args),
            configKey: this.extractConfigKey(args),
            oldValue: this.extractOldValue(args),
            newValue: this.extractNewValue(args),
          });
        }
      } catch (error) {
        // Don't fail the operation if audit logging fails
        logger.error('Failed to log audit event', {
          error,
          toolName,
          action,
          userId,
        });
      }
    }
  }

  /**
   * Check if action requires audit logging
   */
  private requiresAudit(action: string): boolean {
    return (
      MUTATION_ACTIONS.has(action) ||
      PERMISSION_ACTIONS.has(action) ||
      AUTHENTICATION_ACTIONS.has(action) ||
      EXPORT_ACTIONS.has(action) ||
      CONFIGURATION_ACTIONS.has(action)
    );
  }

  /**
   * Extract user ID from args or context
   */
  private extractUserId(args: Record<string, unknown>): string {
    // Try to extract from args
    if (typeof args['userId'] === 'string') {
      return args['userId'];
    }

    // Try to extract from auth context
    const requestContext = getRequestContext();
    if (requestContext && 'userId' in requestContext) {
      return String(requestContext['userId']);
    }

    // Fallback to 'anonymous'
    return 'anonymous';
  }

  /**
   * Extract IP address from context
   */
  private extractIpAddress(): string {
    const requestContext = getRequestContext();
    if (requestContext && 'ipAddress' in requestContext) {
      return String(requestContext['ipAddress']);
    }

    return 'unknown';
  }

  /**
   * Extract user agent from context
   */
  private extractUserAgent(): string | undefined {
    const requestContext = getRequestContext();
    if (requestContext && 'userAgent' in requestContext) {
      return String(requestContext['userAgent']);
    }

    return undefined; // no userAgent in request context
  }

  /**
   * Extract OAuth scopes from args or context
   */
  private extractScopes(args: Record<string, unknown>): string[] | undefined {
    if (Array.isArray(args['scopes'])) {
      return args['scopes'].map(String);
    }

    const requestContext = getRequestContext();
    if (requestContext && 'scopes' in requestContext && Array.isArray(requestContext['scopes'])) {
      return requestContext['scopes'].map(String);
    }

    return undefined; // no scopes in request context
  }

  /**
   * Extract resource from args
   */
  private extractResource(args: Record<string, unknown>): {
    type: 'spreadsheet' | 'range' | 'permission' | 'token' | 'config' | 'export';
    spreadsheetId?: string;
    spreadsheetName?: string;
    range?: string;
    sheetId?: string;
    sheetName?: string;
  } {
    return {
      type: 'spreadsheet', // Default
      spreadsheetId: typeof args['spreadsheetId'] === 'string' ? args['spreadsheetId'] : undefined,
      spreadsheetName:
        typeof args['spreadsheetName'] === 'string' ? args['spreadsheetName'] : undefined,
      range: typeof args['range'] === 'string' ? args['range'] : undefined,
      sheetId: typeof args['sheetId'] === 'string' ? args['sheetId'] : undefined,
      sheetName: typeof args['sheetName'] === 'string' ? args['sheetName'] : undefined,
    };
  }

  /**
   * Extract permission from args
   */
  private extractPermission(args: Record<string, unknown>): {
    role: 'owner' | 'writer' | 'reader';
    email?: string;
    domain?: string;
    anyone?: boolean;
  } {
    const role =
      typeof args['role'] === 'string' ? (args['role'] as 'owner' | 'writer' | 'reader') : 'reader';
    const email = typeof args['email'] === 'string' ? args['email'] : undefined;
    const domain = typeof args['domain'] === 'string' ? args['domain'] : undefined;
    const anyone = typeof args['anyone'] === 'boolean' ? args['anyone'] : undefined;

    return { role, email, domain, anyone };
  }

  /**
   * Extract authentication method from action
   */
  private extractAuthMethod(
    action: string
  ): 'oauth' | 'api_key' | 'service_account' | 'managed_identity' {
    if (action === 'oauth_grant') return 'oauth';
    if (action === 'service_account_auth') return 'service_account';
    return 'oauth'; // Default
  }

  /**
   * Extract export format from action
   */
  private extractExportFormat(action: string): string | undefined {
    if (action === 'export_csv') return 'csv';
    if (action === 'export_xlsx') return 'xlsx';
    if (action === 'export_pdf') return 'pdf';
    return undefined;
  }

  /**
   * Extract config key from args
   */
  private extractConfigKey(args: Record<string, unknown>): string {
    return typeof args['configKey'] === 'string' ? args['configKey'] : 'unknown';
  }

  /**
   * Extract old value from args (sanitized)
   */
  private extractOldValue(args: Record<string, unknown>): string | undefined {
    if (typeof args['oldValue'] === 'string') {
      return this.sanitizeConfigValue(args['oldValue']);
    }
    return undefined;
  }

  /**
   * Extract new value from args (sanitized)
   */
  private extractNewValue(args: Record<string, unknown>): string | undefined {
    if (typeof args['newValue'] === 'string') {
      return this.sanitizeConfigValue(args['newValue']);
    }
    return undefined;
  }

  /**
   * Sanitize config value (remove secrets)
   */
  private sanitizeConfigValue(value: string): string {
    // Redact anything that looks like a secret
    if (
      value.toLowerCase().includes('secret') ||
      value.toLowerCase().includes('token') ||
      value.toLowerCase().includes('key')
    ) {
      return '[REDACTED]';
    }
    return value;
  }

  /**
   * Extract cells modified count from result
   */
  private extractCellsModified(result: unknown): number | undefined {
    if (
      result &&
      typeof result === 'object' &&
      'cellsModified' in result &&
      typeof result.cellsModified === 'number'
    ) {
      return result.cellsModified;
    }
    return undefined;
  }

  /**
   * Extract rows modified count from result
   */
  private extractRowsModified(result: unknown): number | undefined {
    if (
      result &&
      typeof result === 'object' &&
      'rowsModified' in result &&
      typeof result.rowsModified === 'number'
    ) {
      return result.rowsModified;
    }
    return undefined;
  }

  /**
   * Extract columns modified count from result
   */
  private extractColumnsModified(result: unknown): number | undefined {
    if (
      result &&
      typeof result === 'object' &&
      'columnsModified' in result &&
      typeof result.columnsModified === 'number'
    ) {
      return result.columnsModified;
    }
    return undefined;
  }

  /**
   * Extract record count from result
   */
  private extractRecordCount(result: unknown): number | undefined {
    if (
      result &&
      typeof result === 'object' &&
      'recordCount' in result &&
      typeof result.recordCount === 'number'
    ) {
      return result.recordCount;
    }
    return undefined;
  }

  /**
   * Extract file size from result
   */
  private extractFileSize(result: unknown): number | undefined {
    if (
      result &&
      typeof result === 'object' &&
      'fileSize' in result &&
      typeof result.fileSize === 'number'
    ) {
      return result.fileSize;
    }
    return undefined;
  }
}

/**
 * Create audit middleware instance
 */
export function createAuditMiddleware(auditLogger: AuditLogger): AuditMiddleware {
  return new AuditMiddleware(auditLogger);
}
