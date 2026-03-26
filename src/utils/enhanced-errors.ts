/**
 * ServalSheets - Enhanced Error Context
 *
 * Provides enhanced error messages with suggested fixes and context.
 */

import type { ErrorDetail } from '../schemas/shared.js';

export interface ErrorSuggestion {
  title: string;
  steps: string[];
  suggestedTools?: string[];
}

/**
 * Enhanced error with suggested fixes and resource links (Quick Win #2)
 */
export function enhanceError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorDetail {
  const suggestions = getErrorSuggestions(code, context);

  return {
    code: code as ErrorDetail['code'],
    message,
    retryable: isRetryable(code),
    details: context,
    resolution: suggestions.title,
    resolutionSteps: suggestions.steps,
    suggestedTools: suggestions.suggestedTools,
    fixableVia: getFixableVia(code, context),
    resources: getErrorResources(code),
  };
}