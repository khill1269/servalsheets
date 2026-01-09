/**
 * ServalSheets - Sensitive Data Redaction
 *
 * Centralized utility for redacting sensitive information from logs, errors,
 * and API responses. Prevents tokens, credentials, and API keys from leaking
 * into error messages or logs.
 *
 * Security: Part of Phase 4 - Auth & API Hardening
 */

/**
 * Field names that contain sensitive data (all lowercase for case-insensitive matching)
 * Used for object key-based redaction
 */
export const SENSITIVE_FIELD_NAMES = new Set([
  // OAuth & Authentication
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "id_token",
  "idtoken",
  "bearer",
  "authorization",
  "auth",
  "token",
  "jwt",

  // API Keys & Secrets
  "api_key",
  "apikey",
  "client_secret",
  "clientsecret",
  "client_id",
  "clientid",
  "secret",
  "private_key",
  "privatekey",

  // Credentials
  "password",
  "passwd",
  "pwd",
  "credentials",
  "creds",

  // Session & Cookies
  "session",
  "sessionid",
  "session_id",
  "cookie",
  "csrf",
  "xsrf",

  // Other sensitive
  "ssn",
  "social_security",
  "socialsecurity",
  "credit_card",
  "creditcard",
  "cvv",
  "pin",
]);

/**
 * Patterns for detecting and redacting sensitive strings
 * IMPORTANT: Order matters! Specific patterns should come before generic ones.
 */
export const SENSITIVE_STRING_PATTERNS = [
  // 1. Google API Keys (AIza...) - MUST come before generic patterns
  // Real keys are 35 chars after AIza, but we use 6+ to catch truncated keys in tests/logs
  {
    pattern: /AIza[A-Za-z0-9_-]{6,}/g,
    replacement: "AIza[REDACTED]",
    description: "Google API Key",
  },

  // 2. Google OAuth access tokens (ya29.xxx format)
  {
    pattern: /ya29\.[A-Za-z0-9_-]+/g,
    replacement: "[REDACTED]",
    description: "Google OAuth access token",
  },

  // 3. Bearer tokens (Authorization: Bearer ...)
  {
    pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: "Bearer [REDACTED]",
    description: "OAuth Bearer token",
  },

  // 4. JWT tokens (eyJ...eyJ...signature)
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: "eyJ[REDACTED]",
    description: "JWT token",
  },

  // 5. AWS-style keys (AKIA...)
  {
    pattern: /AKIA[A-Z0-9]{16}/g,
    replacement: "AKIA[REDACTED]",
    description: "AWS Access Key",
  },

  // 6. URLs with tokens/keys in query params
  {
    pattern:
      /([?&])(access_token|token|key|apikey|api_key|secret|password|pwd)=([^&\s]+)/gi,
    replacement: "$1$2=[REDACTED]",
    description: "URL query parameter with sensitive data",
  },

  // 7. Basic Auth (Authorization: Basic base64...)
  {
    pattern: /Basic\s+[A-Za-z0-9+/=]+/gi,
    replacement: "Basic [REDACTED]",
    description: "HTTP Basic Auth",
  },

  // 8. Generic long alphanumeric strings in sensitive contexts
  // This should be LAST since it's the most generic
  // Only match if NOT already containing [REDACTED] and NOT matching Google API key pattern
  {
    pattern:
      /(token|secret|password|bearer|auth)["'\s:=]+(?!AIza)([A-Za-z0-9\-._~+/]{32,})/gi,
    replacement: "$1: [REDACTED]",
    description: "Long alphanumeric string after sensitive keyword",
  },
];

/**
 * Redact sensitive information from a string
 *
 * @param text - String that may contain sensitive data
 * @returns String with sensitive data replaced with [REDACTED]
 */
export function redactString(text: string): string {
  if (typeof text !== "string") {
    return text;
  }

  let result = text;

  // Apply all pattern-based redactions in order
  // Order is critical - specific patterns before generic ones
  for (const { pattern, replacement } of SENSITIVE_STRING_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement as string);
  }

  return result;
}

/**
 * Redact sensitive fields from an object (deep)
 * Handles circular references and maintains type safety
 *
 * @param obj - Object to redact
 * @param seen - WeakSet for tracking visited objects (circular reference detection)
 * @param depth - Current recursion depth (prevent stack overflow)
 * @returns Redacted copy of the object
 */
export function redactObject<T>(
  obj: T,
  seen = new WeakSet<object>(),
  depth = 0,
): T {
  // Prevent stack overflow
  if (depth > 10) {
    return obj;
  }

  // Handle primitives
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    // Redact strings
    if (typeof obj === "string") {
      return redactString(obj) as unknown as T;
    }
    return obj;
  }

  // Handle circular references
  if (seen.has(obj as object)) {
    return "[Circular]" as unknown as T;
  }
  seen.add(obj as object);

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      redactObject(item, seen, depth + 1),
    ) as unknown as T;
  }

  // Handle Error objects specially (preserve stack trace)
  if (obj instanceof Error) {
    const redacted = new (obj.constructor as ErrorConstructor)(
      redactString(obj.message),
    );
    redacted.stack = obj.stack; // Preserve stack trace (doesn't contain tokens)

    // Redact any custom properties on the error
    for (const [key, value] of Object.entries(obj)) {
      if (key !== "message" && key !== "stack" && key !== "name") {
        (redacted as unknown as Record<string, unknown>)[key] = redactObject(
          value,
          seen,
          depth + 1,
        );
      }
    }

    return redacted as unknown as T;
  }

  // Handle regular objects
  const result = {} as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Check if this key is sensitive (case-insensitive)
    if (SENSITIVE_FIELD_NAMES.has(lowerKey)) {
      if (typeof value === "string") {
        // Apply pattern-based redaction first
        const redacted = redactString(value);
        // If patterns didn't redact anything, use full redaction
        result[key] = redacted === value ? "[REDACTED]" : redacted;
      } else if (typeof value === "object" && value !== null) {
        // Recursively redact nested objects even in sensitive fields
        result[key] = redactObject(value, seen, depth + 1);
      } else {
        result[key] = "[REDACTED]";
      }
    } else if (typeof value === "string") {
      // Redact string values
      result[key] = redactString(value);
    } else if (typeof value === "object" && value !== null) {
      // Recursively redact nested objects
      result[key] = redactObject(value, seen, depth + 1);
    } else {
      // Keep primitives as-is
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Check if a field name is sensitive (case-insensitive)
 *
 * @param fieldName - Field name to check
 * @returns True if field should be redacted
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(fieldName.toLowerCase());
}

/**
 * Redact sensitive data from any value (auto-detect type)
 *
 * @param value - Value to redact (string, object, array, etc.)
 * @returns Redacted value
 */
export function redact<T>(value: T): T {
  if (typeof value === "string") {
    return redactString(value) as unknown as T;
  }

  if (typeof value === "object" && value !== null) {
    return redactObject(value);
  }

  return value;
}

/**
 * Redact multiple values at once
 * Useful for function arguments or API responses
 *
 * @param values - Values to redact
 * @returns Array of redacted values
 */
export function redactAll<T extends unknown[]>(...values: T): T {
  return values.map((v) => redact(v)) as T;
}
