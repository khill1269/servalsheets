/**
 * ServalSheets - Validation Helper Functions
 *
 * Pure utility functions extracted from BaseHandler for better modularity.
 * These functions have no instance dependencies and can be tested independently.
 */

import { getEnv } from '../../config/env.js';

/**
 * Get appropriate field mask for Google API calls (Priority 8)
 *
 * Returns optimized field masks when ENABLE_AGGRESSIVE_FIELD_MASKS=true.
 * Provides 40-60% payload reduction for spreadsheet metadata calls.
 *
 * @param operation - Type of operation being performed
 * @returns Field mask string or undefined (full response when feature disabled)
 */

export function getFieldMask(operation: 'metadata' | 'sheets_list' | 'full'): string | undefined {
  // Feature flag check
  const aggressiveMasking = getEnv().ENABLE_AGGRESSIVE_FIELD_MASKS;

  if (!aggressiveMasking) {
    return undefined; // OK: Explicit empty — Full response
  }

  // Return optimized masks based on operation type
  switch (operation) {
    case 'metadata':
      // 95% payload reduction - only essential spreadsheet properties
      return 'spreadsheetId,properties(title,locale,timeZone)';

    case 'sheets_list':
      // 80% payload reduction - sheet list with properties
      return 'spreadsheetId,sheets(properties(title,sheetId,index,gridProperties(rowCount,columnCount),hidden))';

    case 'full':
    default:
      return undefined; // OK: Explicit empty — Full response
  }
}

// Re-exported from utils so handlers can import from either location.
// The canonical implementation lives in src/utils/verbosity-filter.ts.
export { applyVerbosityFilter } from '../../utils/verbosity-filter.js';
