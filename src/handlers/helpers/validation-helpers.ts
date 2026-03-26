/**
 * ServalSheets - Validation Helper Functions
 */

import { getEnv } from '../../config/env.js';

export function getFieldMask(operation: 'metadata' | 'sheets_list' | 'full'): string | undefined {
  const aggressiveMasking = getEnv().ENABLE_AGGRESSIVE_FIELD_MASKS;

  if (!aggressiveMasking) {
    return undefined;
  }

  switch (operation) {
    case 'metadata':
      return 'spreadsheetId,properties(title,locale,timeZone)';
    case 'sheets_list':
      return 'spreadsheetId,sheets(properties(title,sheetId,index,gridProperties(rowCount,columnCount),hidden))';
    default:
      return undefined;
  }
}

export function applyVerbosityFilter<T extends { success: boolean; _meta?: unknown }>(
  response: T,
  verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'
): T {
  if (!response.success || verbosity === 'standard') {
    return response;
  }

  if (verbosity === 'minimal') {
    const filtered = response as Record<string, unknown>;
    if ('_meta' in filtered) delete filtered['_meta'];
    return filtered as T;
  }

  return response;
}