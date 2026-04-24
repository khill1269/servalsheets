/**
 * Shared error-source inference heuristic.
 *
 * Used by BaseHandler.mapError and mapStandaloneError to tag errors before
 * they reach the error-fix suggester — which routes fixableVia suggestions
 * based on the origin of the failure, not just the error code.
 *
 * Returns undefined when the source cannot be determined (legacy behavior:
 * suggester falls through to code-based routing).
 */
import type { ErrorSource } from '../services/error-fix-suggester.js';
import { ValidationError, AuthenticationError } from '../core/errors.js';
import { z } from '../lib/schema.js';

export function inferErrorSource(error: unknown): ErrorSource | undefined {
  if (error instanceof ValidationError || error instanceof z.ZodError) return 'validation';
  if (error instanceof AuthenticationError) return 'auth';
  if (!(error instanceof Error)) return undefined; // OK: Explicit empty — non-Error throws have no source signal
  const name = error.constructor?.name ?? '';
  const msg = error.message;
  if (name === 'GaxiosError' || /googleapis\.com|bigquery|drive\.google|script\.googleapis/i.test(msg))
    return 'google_api';
  if (/AI analysis service|sampling|anthropic|openai|LLM/i.test(msg)) return 'ai_service';
  return undefined; // OK: Explicit empty — source not determinable from this error type
}
