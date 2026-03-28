/**
 * ServalSheets - Verbosity Filter Utility
 *
 * Generic utility for filtering response verbosity to optimize token usage.
 * Lives in utils/ so it can be imported by both handler helpers and the MCP
 * registration layer (tool-response.ts) without creating layer violations.
 */

/**
 * Apply verbosity filtering to optimize token usage (Phase 1 LLM optimization)
 *
 * Handles the most common verbosity filtering patterns:
 * - minimal: Remove _meta, limit arrays to first 3 items, strip technical details
 * - standard: No filtering (return as-is)
 * - detailed: Future enhancement for additional metadata
 *
 * @param response - Response object to filter
 * @param verbosity - Verbosity level
 * @returns Filtered response
 */
export function applyVerbosityFilter<T extends { success: boolean; _meta?: unknown }>(
  response: T,
  verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'
): T {
  // No filtering for errors or standard verbosity
  if (!response.success || verbosity === 'standard') {
    return response;
  }

  if (verbosity === 'minimal') {
    // Minimal: Return only essential fields (60-80% token reduction)
    // OPTIMIZATION: Modify in place instead of spreading entire object (saves 300-600 tokens)
    const filtered = response as Record<string, unknown>;

    // Remove technical metadata
    if ('_meta' in filtered) {
      delete filtered['_meta'];
    }

    // Remove optional verbose fields that aren't essential for LLM decision-making
    const verboseFields = ['suggestions', 'nextSteps', 'documentation', 'warnings', 'relatedTools'];
    for (const field of verboseFields) {
      if (field in filtered) {
        delete filtered[field];
      }
    }

    // Limit large arrays more aggressively (3 items for minimal, with truncation indicator)
    // Preserve: 'values' (essential data), 'headers' (column names), 'sheets' (tab list)
    const preservedArrays = ['values', 'headers', 'sheets', 'rows', 'columns'];
    for (const [key, value] of Object.entries(filtered)) {
      if (Array.isArray(value) && value.length > 3 && !preservedArrays.includes(key)) {
        const truncatedCount = value.length - 3;
        filtered[key] = value.slice(0, 3);
        // Add truncation indicator
        filtered[`${key}Truncated`] = truncatedCount;
      }
    }

    return filtered as T;
  }

  // Detailed: Future enhancement for additional metadata
  return response;
}
