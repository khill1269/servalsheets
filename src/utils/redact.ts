/**
 * ServalSheets - Sensitive Data Redaction (delegates to @serval/core)
 *
 * Re-exports platform-agnostic redaction from @serval/core.
 * Adds serval-sheets-specific `redactAll` helper.
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
 * Redact multiple values at once (serval-sheets-specific convenience)
 *
 * @param values - Values to redact
 * @returns Array of redacted values
 */
import { redact as coreRedact } from '@serval/core';

export function redactAll<T extends unknown[]>(...values: T): T {
  return values.map((v) => coreRedact(v)) as T;
}
