/**
 * ServalSheets - Sensitive Data Redaction (delegates to @serval/core)
 *
 * Re-exports platform-agnostic redaction from @serval/core.
 */
export {
  redactString,
  redactObject,
  redact,
  isSensitiveField,
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_STRING_PATTERNS,
} from '@serval/core';

/**
 * Redact sensitive query parameters from a URL before logging.
 *
 * Replaces query parameter values matching /token|key|secret|auth|password/i
 * with [REDACTED] to prevent credential leakage in log files.
 *
 * @param url - URL string (may contain query parameters with credentials)
 * @returns URL with sensitive query params replaced with [REDACTED]
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const sensitivePattern = /token|key|secret|auth|password/i;
    for (const param of parsed.searchParams.keys()) {
      if (sensitivePattern.test(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, redact everything after '?' as a safety fallback
    const qIdx = url.indexOf('?');
    return qIdx >= 0 ? `${url.slice(0, qIdx)}?[REDACTED]` : url;
  }
}
