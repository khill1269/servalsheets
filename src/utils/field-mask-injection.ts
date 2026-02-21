/**
 * Field Mask Injection Utilities
 *
 * Helper functions to automatically inject optimal field masks into Google API calls.
 * Reduces response payload size by 30-70% without changing functionality.
 *
 * @category Utils
 */

import { getFieldMask, getEstimatedReduction } from '../config/action-field-masks.js';
import { logger } from './logger.js';

// Module-level counters for field mask coverage (used by getFieldMaskStats)
let _totalCalls = 0;
let _maskedCalls = 0;
let _estimatedBytesSaved = 0;

/**
 * Options for field mask injection
 */
export interface FieldMaskOptions {
  /** Tool name (e.g., 'sheets_data') */
  tool: string;

  /** Action name (e.g., 'read_range') */
  action: string;

  /** Force a specific field mask (overrides action default) */
  forceMask?: string;

  /** Disable field mask injection for this call */
  disableMask?: boolean;

  /** Log field mask application (useful for debugging) */
  verbose?: boolean;
}

/**
 * Inject field mask into Google API request parameters
 *
 * Automatically adds the optimal 'fields' parameter based on the action being performed.
 * Falls back to the original params if no field mask is configured for the action.
 *
 * @param params - Original API request parameters
 * @param options - Field mask injection options
 * @returns Modified parameters with field mask injected
 *
 * @example
 * ```typescript
 * // In a handler:
 * const params = injectFieldMask(
 *   { spreadsheetId: '123', range: 'Sheet1!A1:B10' },
 *   { tool: 'sheets_data', action: 'read_range' }
 * );
 *
 * const response = await sheets.spreadsheets.values.get(params);
 * // Response will be 40% smaller due to field mask
 * ```
 */
export function injectFieldMask<T extends Record<string, unknown>>(
  params: T,
  options: FieldMaskOptions
): T & { fields?: string } {
  // If disabled, return original params
  if (options.disableMask) {
    return params;
  }

  // Check if fields already specified (user override)
  if ('fields' in params && params['fields']) {
    if (options.verbose) {
      logger.debug('Field mask already specified, skipping injection', {
        tool: options.tool,
        action: options.action,
        userMask: params['fields'],
      });
    }
    return params as T & { fields: string };
  }

  // Use forced mask if provided
  const fieldMask = options.forceMask ?? getFieldMask(options.tool, options.action);

  // No field mask configured for this action
  if (!fieldMask) {
    if (options.verbose) {
      logger.debug('No field mask configured for action', {
        tool: options.tool,
        action: options.action,
      });
    }
    _totalCalls++;
    return params;
  }

  // Get estimated reduction for logging
  const estimatedReduction = getEstimatedReduction(options.tool, options.action);

  if (options.verbose || process.env['FIELD_MASK_VERBOSE'] === 'true') {
    logger.debug('Injecting field mask', {
      tool: options.tool,
      action: options.action,
      fieldMask,
      estimatedReduction: `${estimatedReduction}%`,
    });
  }

  _totalCalls++;
  _maskedCalls++;
  // Rough byte estimate: assume average unmasked response ~4 KB, reduction per configured %
  _estimatedBytesSaved += Math.round((estimatedReduction / 100) * 4096);

  // Inject field mask
  return {
    ...params,
    fields: fieldMask,
  };
}

/**
 * Inject field mask into batch request
 *
 * For batchUpdate and batchGet operations, the field mask applies to the response.
 *
 * @param params - Batch request parameters
 * @param options - Field mask options
 * @returns Modified parameters with field mask
 *
 * @example
 * ```typescript
 * const params = injectBatchFieldMask(
 *   { spreadsheetId: '123', requests: [...] },
 *   { tool: 'sheets_format', action: 'set_background' }
 * );
 * ```
 */
export function injectBatchFieldMask<T extends Record<string, unknown>>(
  params: T,
  options: FieldMaskOptions
): T & { fields?: string; responseFields?: string } {
  // Batch operations can use either 'fields' or 'responseFields'
  const fieldMask = options.forceMask ?? getFieldMask(options.tool, options.action);

  if (!fieldMask) {
    return params;
  }

  // Both batchUpdate and batchGet use the standard 'fields' query parameter
  // for partial response filtering (same as all other Google API endpoints)
  return {
    ...params,
    fields: fieldMask,
  };
}

/**
 * Create a field mask injector bound to a specific tool
 *
 * Convenience factory for handlers that want a pre-configured injector.
 *
 * @param tool - Tool name
 * @returns Bound field mask injection function
 *
 * @example
 * ```typescript
 * class DataHandler extends BaseHandler {
 *   private injectFieldMask = createFieldMaskInjector('sheets_data');
 *
 *   async handleReadRange(params) {
 *     const apiParams = this.injectFieldMask(
 *       { spreadsheetId, range },
 *       'read_range'
 *     );
 *     return this.googleClient.sheets.spreadsheets.values.get(apiParams);
 *   }
 * }
 * ```
 */
export function createFieldMaskInjector(tool: string) {
  return function <T extends Record<string, unknown>>(
    params: T,
    action: string,
    options?: Partial<FieldMaskOptions>
  ): T & { fields?: string } {
    return injectFieldMask(params, {
      tool,
      action,
      ...options,
    });
  };
}

/**
 * Measure actual payload size reduction from field mask
 *
 * Useful for validating that field masks are working as expected.
 *
 * @param withoutMask - Response size without field mask (bytes)
 * @param withMask - Response size with field mask (bytes)
 * @returns Reduction statistics
 */
export function measureReduction(
  withoutMask: number,
  withMask: number
): {
  reduction: number;
  reductionPercent: number;
  bytesSaved: number;
} {
  const bytesSaved = withoutMask - withMask;
  const reductionPercent = Math.round((bytesSaved / withoutMask) * 100);

  return {
    reduction: withMask,
    reductionPercent,
    bytesSaved,
  };
}

/**
 * Enable field mask verbose logging
 *
 * Logs every field mask injection for debugging.
 */
export function enableFieldMaskLogging(): void {
  process.env['FIELD_MASK_VERBOSE'] = 'true';
  logger.info('Field mask verbose logging enabled');
}

/**
 * Disable field mask verbose logging
 */
export function disableFieldMaskLogging(): void {
  delete process.env['FIELD_MASK_VERBOSE'];
  logger.info('Field mask verbose logging disabled');
}

/**
 * Get field mask injection statistics
 *
 * Returns stats about field mask usage across the system.
 * Requires instrumentation to be enabled.
 */
export function getFieldMaskStats(): {
  totalCalls: number;
  maskedCalls: number;
  unmaskedCalls: number;
  coveragePercent: number;
  estimatedBytesSaved: number;
} {
  const unmaskedCalls = _totalCalls - _maskedCalls;
  const coveragePercent = _totalCalls > 0 ? Math.round((_maskedCalls / _totalCalls) * 100) : 0;
  return {
    totalCalls: _totalCalls,
    maskedCalls: _maskedCalls,
    unmaskedCalls,
    coveragePercent,
    estimatedBytesSaved: _estimatedBytesSaved,
  };
}
