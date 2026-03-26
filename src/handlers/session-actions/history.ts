/**
 * Session history action handlers.
 * Covers: get_history, find_by_reference
 */

import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';
import { ValidationError } from '../../core/errors.js';

// ============================================================================
// FUZZY MATCHING HELPERS (moved from session.ts)
// ============================================================================

/**
 * Normalize reference type aliases
 * Maps informal names to canonical types
 */
export function normalizeReferenceType(typeAlias: string): string {
  const normalized = typeAlias.toLowerCase().trim();

  // Type alias mapping
  const aliases: Record<string, string> = {
    sheet: 'spreadsheet',
    sheets: 'spreadsheet',
    tab: 'sheet',
    tabs: 'sheet',
    doc: 'spreadsheet',
    document: 'spreadsheet',
    docs: 'spreadsheet',
    workbook: 'spreadsheet',
    workbooks: 'spreadsheet',
    file: 'spreadsheet',
  };

  return aliases[normalized] ?? typeAlias;
}

/**
 * Convert match score (0.0-1.0) to human-readable confidence level
 */
export function getConfidenceLevel(score: number): 'exact' | 'high' | 'medium' | 'low' {
  if (score >= 0.9) return 'exact';
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Strip matchScore from result object for response
 * (matchScore is internal; response should not expose implementation details)
 */
export function stripMatchScore<T extends { matchScore: number }>(obj: T): Omit<T, 'matchScore'> {
  const { matchScore: _, ...rest } = obj;
  return rest as Omit<T, 'matchScore'>;
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

export function handleGetHistory(
  session: SessionContextManager,
  req: { action: 'get_history'; limit?: number }
): SheetsSessionOutput {
  const limit = req.limit ?? 10;
  const operations = session.getOperationHistory(limit);
  return {
    response: {
      success: true,
      action: 'get_history',
      operations,
      ...(operations.length === 0
        ? {
            hint: 'No operations recorded this session. Call record_operation after each major write/format/structural change to populate history. Or enable autoRecord: update_preferences({autoRecord: true}).',
          }
        : {}),
    },
  };
}

export function handleFindByReference(
  session: SessionContextManager,
  req: { action: 'find_by_reference'; reference?: string; referenceType?: string }
): SheetsSessionOutput {
  const { reference, referenceType } = req;
  if (typeof reference !== 'string' || reference.trim().length === 0) {
    throw new ValidationError('Missing required parameter: reference', 'reference');
  }

  // Type assertion: refine() validates these are defined for find_by_reference action
  // Normalize reference type aliases (sheet → spreadsheet, tab → sheet, etc.)
  const normalizedType = normalizeReferenceType(referenceType || 'spreadsheet');

  if (normalizedType === 'spreadsheet') {
    const match = session.findSpreadsheetByReference(reference);
    const confidence = match ? getConfidenceLevel(match.matchScore) : null;
    return {
      response: {
        success: true,
        action: 'find_by_reference',
        found: match !== null,
        ...(match && {
          spreadsheet: stripMatchScore(match),
          confidence,
          matchScore: match.matchScore,
        }),
        ...(match &&
          match.matchScore < 0.7 && {
            warning: `Fuzzy matched (${Math.round(match.matchScore * 100)}% confidence). Did you mean "${match.title}"?`,
          }),
      },
    };
  } else {
    // referenceType === 'sheet' or other operation types
    const match = session.findOperationByReference(reference);
    const confidence = match ? getConfidenceLevel(match.matchScore) : null;
    return {
      response: {
        success: true,
        action: 'find_by_reference',
        found: match !== null,
        ...(match && {
          operation: stripMatchScore(match),
          confidence,
          matchScore: match.matchScore,
        }),
        ...(match &&
          match.matchScore < 0.7 && {
            warning: `Fuzzy matched (${Math.round(match.matchScore * 100)}% confidence). Did you mean "${match.action}"?`,
          }),
      },
    };
  }
}
