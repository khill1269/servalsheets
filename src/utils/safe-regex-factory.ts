/** Maximum pattern length for user-supplied patterns (sheets_quality.validate). */
const MAX_PATTERN_LENGTH_USER = 500;

/** Maximum pattern length for API-sourced patterns (Google Discovery API schemas). */
const MAX_PATTERN_LENGTH_API = 2000;

/**
 * Detects patterns with catastrophic backtracking potential (ReDoS).
 * Checks for nested quantifiers — the most common ReDoS attack vector:
 *   (a+)+, (\w+)*, (.+)+, ([a-z]{1,5})+, etc.
 *
 * Not exhaustive (a full AST analysis would be needed), but catches the
 * patterns that appear in known ReDoS PoC payloads.
 */
function hasNestedQuantifiers(pattern: string): boolean {
  // Strip escape sequences so \+ \* etc. don't confuse the scan.
  const normalized = pattern.replace(/\\[\s\S]/g, 'XX');

  // Quantified group that itself contains a quantifier inside.
  // Matches: (X+)+  (X*)+  (X+)*  (X+)?  (X{2,5})+  ([a-z]+)+  etc.
  if (/\([^)]*[+*?][^)]*\)[+*?{]/.test(normalized)) return true;

  // Group ending with a counted repetition that is itself followed by a quantifier.
  // Matches: (\w{1,10})+ etc.
  if (/\([^)]*\{[0-9]+,[0-9]*\}[^)]*\)[+*?{]/.test(normalized)) return true;

  return false;
}

/**
 * Validates a regex pattern for safety before compiling it.
 * Throws ValidationError with a user-readable message if unsafe.
 */
export function validateRegexPattern(pattern: string, source: 'user' | 'api' = 'user'): void {
  const maxLength = source === 'user' ? MAX_PATTERN_LENGTH_USER : MAX_PATTERN_LENGTH_API;

  if (pattern.length > maxLength) {
    throw new Error(
      `Pattern too long (${pattern.length} chars, max ${maxLength}). ` +
        'Simplify the pattern to avoid potential denial-of-service.'
    );
  }

  if (hasNestedQuantifiers(pattern)) {
    throw new Error(
      'Pattern contains nested quantifiers (e.g. (a+)+) which can cause ' +
        'catastrophic backtracking. Use a simpler pattern without nested repetition.'
    );
  }
}

/**
 * Compiles a regex pattern after safety validation.
 * Use this instead of `new RegExp(userInput)` anywhere user or API data
 * feeds the pattern argument.
 *
 * @throws Error if the pattern is unsafe or syntactically invalid.
 */
export function createSafeRegex(
  pattern: string,
  flags?: string,
  source: 'user' | 'api' = 'user'
): RegExp {
  validateRegexPattern(pattern, source);
  return new RegExp(pattern, flags);
}
