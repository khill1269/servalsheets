/**
 * ServalSheets - Extraction Helper Functions
 *
 * Centralized utilities for extracting fields from tool arguments and results.
 * These helpers handle both discriminated union patterns (request.action) and
 * flattened patterns (action directly in args).
 *
 * @module mcp/registration/extraction-helpers
 */
/**
 * Extract action from tool arguments
 *
 * Supports both patterns:
 * - Discriminated union: args.request.action
 * - Flattened: args.action
 *
 * @param args - Tool input arguments
 * @returns Action string, or 'unknown' if not found
 *
 * @example
 * ```ts
 * extractAction({ request: { action: 'read' } }) // => 'read'
 * extractAction({ action: 'write' }) // => 'write'
 * extractAction({}) // => 'unknown'
 * ```
 */
export declare function extractAction(args: Record<string, unknown>): string;
/**
 * Extract spreadsheetId from tool arguments
 *
 * Supports both patterns:
 * - Discriminated union: args.request.params.spreadsheetId
 * - Flattened: args.spreadsheetId
 *
 * @param args - Tool input arguments
 * @returns Spreadsheet ID, or undefined if not found
 *
 * @example
 * ```ts
 * extractSpreadsheetId({ request: { params: { spreadsheetId: '123' } } }) // => '123'
 * extractSpreadsheetId({ spreadsheetId: '456' }) // => '456'
 * extractSpreadsheetId({}) // => undefined
 * ```
 */
export declare function extractSpreadsheetId(args: Record<string, unknown>): string | undefined;
/**
 * Extract sheetId from tool arguments
 *
 * Supports both patterns:
 * - Discriminated union: args.request.params.sheetId
 * - Flattened: args.sheetId
 *
 * @param args - Tool input arguments
 * @returns Sheet ID (numeric), or undefined if not found
 *
 * @example
 * ```ts
 * extractSheetId({ request: { params: { sheetId: 0 } } }) // => 0
 * extractSheetId({ sheetId: 123 }) // => 123
 * extractSheetId({}) // => undefined
 * ```
 */
export declare function extractSheetId(args: Record<string, unknown>): number | undefined;
/**
 * Check if tool result indicates success
 *
 * Checks for success field in both:
 * - result.response.success
 * - result.success
 *
 * @param result - Tool execution result
 * @returns True if successful, false otherwise
 *
 * @example
 * ```ts
 * isSuccessResult({ response: { success: true } }) // => true
 * isSuccessResult({ success: true }) // => true
 * isSuccessResult({ success: false }) // => false
 * isSuccessResult({}) // => false
 * isSuccessResult(null) // => false
 * ```
 */
export declare function isSuccessResult(result: unknown): boolean;
/**
 * Extract cellsAffected count from tool result
 *
 * Tries multiple field names:
 * - result.response.cellsAffected
 * - result.cellsAffected
 * - result.response.updatedCells
 * - result.updatedCells
 * - result.response.mutation.cellsAffected
 * - result.mutation.cellsAffected
 *
 * @param result - Tool execution result
 * @returns Number of cells affected, or undefined if not found
 *
 * @example
 * ```ts
 * extractCellsAffected({ response: { cellsAffected: 100 } }) // => 100
 * extractCellsAffected({ cellsAffected: 50 }) // => 50
 * extractCellsAffected({ updatedCells: 25 }) // => 25
 * extractCellsAffected({ mutation: { cellsAffected: 10 } }) // => 10
 * extractCellsAffected({}) // => undefined
 * ```
 */
export declare function extractCellsAffected(result: unknown): number | undefined;
/**
 * Extract snapshotId from tool result
 *
 * Looks for:
 * - result.response.mutation.revertSnapshotId
 * - result.mutation.revertSnapshotId
 *
 * @param result - Tool execution result
 * @returns Snapshot ID for revert, or undefined if not found
 *
 * @example
 * ```ts
 * extractSnapshotId({ response: { mutation: { revertSnapshotId: 'snap-123' } } }) // => 'snap-123'
 * extractSnapshotId({ mutation: { revertSnapshotId: 'snap-456' } }) // => 'snap-456'
 * extractSnapshotId({}) // => undefined
 * ```
 */
export declare function extractSnapshotId(result: unknown): string | undefined;
/**
 * Extract error message from tool result
 *
 * Looks for:
 * - result.response.error.message
 *
 * @param result - Tool execution result
 * @returns Error message, or undefined if not found
 *
 * @example
 * ```ts
 * extractErrorMessage({ response: { error: { message: 'Not found' } } }) // => 'Not found'
 * extractErrorMessage({ response: { success: true } }) // => undefined
 * extractErrorMessage({}) // => undefined
 * ```
 */
export declare function extractErrorMessage(result: unknown): string | undefined;
/**
 * Extract error code from tool result
 *
 * Looks for:
 * - result.response.error.code
 *
 * @param result - Tool execution result
 * @returns Error code, or undefined if not found
 *
 * @example
 * ```ts
 * extractErrorCode({ response: { error: { code: 'SHEET_NOT_FOUND' } } }) // => 'SHEET_NOT_FOUND'
 * extractErrorCode({ response: { success: true } }) // => undefined
 * extractErrorCode({}) // => undefined
 * ```
 */
export declare function extractErrorCode(result: unknown): string | undefined;
//# sourceMappingURL=extraction-helpers.d.ts.map