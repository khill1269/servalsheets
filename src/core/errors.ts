/**
 * ServalSheets - Structured Error Classes
 *
 * Base error classes for consistent error handling across the codebase.
 * All errors implement toErrorDetail() for conversion to ErrorDetail schema.
 *
 * Security: All error messages and details are automatically redacted to
 * prevent sensitive data (tokens, API keys) from leaking into logs.
 */

import type { ErrorDetail } from "../schemas/shared.js";
import { redactString, redactObject } from "../utils/redact.js";

type ErrorCode = ErrorDetail["code"];

/**
 * Base class for all ServalSheets errors
 *
 * Security: Automatically redacts sensitive data from message and details
 */
export abstract class ServalSheetsError extends Error {
  abstract code: ErrorCode;
  abstract retryable: boolean;
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    // Redact sensitive data from message and details
    super(redactString(message));
    this.name = this.constructor.name;
    this.details = details ? redactObject(details) : undefined;
    Error.captureStackTrace(this, this.constructor);
  }

  abstract toErrorDetail(): ErrorDetail;
}

/**
 * ServiceError - For service initialization and operation failures
 * Use when: Service not initialized, API clients unavailable, external service errors
 */
export class ServiceError extends ServalSheetsError {
  code: ErrorCode;
  retryable: boolean;
  serviceName: string;

  constructor(
    message: string,
    code: ErrorCode,
    serviceName: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, { ...details, serviceName });
    this.code = code;
    this.serviceName = serviceName;
    this.retryable = retryable;
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      resolution: this.retryable
        ? `Retry the operation. If error persists, check ${this.serviceName} service status.`
        : `Check ${this.serviceName} service configuration and initialization.`,
    };
  }
}

/**
 * ConfigError - For configuration and validation failures
 * Use when: Invalid environment variables, missing config, validation failures
 */
export class ConfigError extends ServalSheetsError {
  code: ErrorCode = "CONFIG_ERROR";
  retryable = false;
  configKey: string;

  constructor(
    message: string,
    configKey: string,
    details?: Record<string, unknown>,
  ) {
    super(message, { ...details, configKey });
    this.configKey = configKey;
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: false,
      resolution: `Fix the configuration for ${this.configKey} and restart the server.`,
      resolutionSteps: [
        `1. Check environment variable or config file for ${this.configKey}`,
        "2. Validate the value matches expected format",
        "3. Restart the server after fixing configuration",
      ],
    };
  }
}

/**
 * ValidationError - For input validation failures
 * Use when: Invalid user input, malformed data, type mismatches
 */
export class ValidationError extends ServalSheetsError {
  code: ErrorCode = "VALIDATION_ERROR";
  retryable = false;
  field: string;
  expectedFormat?: string;

  constructor(
    message: string,
    field: string,
    expectedFormat?: string,
    details?: Record<string, unknown>,
  ) {
    super(message, { ...details, field, expectedFormat });
    this.field = field;
    this.expectedFormat = expectedFormat;
  }

  toErrorDetail(): ErrorDetail {
    const steps = [
      `1. Check the value of '${this.field}'`,
      "2. Ensure it matches the required format",
    ];

    if (this.expectedFormat) {
      steps.push(`3. Expected format: ${this.expectedFormat}`);
    }

    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: false,
      resolution: `Fix the value of '${this.field}' and retry the operation.`,
      resolutionSteps: steps,
    };
  }
}

/**
 * NotFoundError - For resource not found scenarios
 * Use when: Spreadsheet not found, snapshot not found, resource lookup failures
 */
export class NotFoundError extends ServalSheetsError {
  code: ErrorCode = "NOT_FOUND";
  retryable = false;
  resourceType: string;
  resourceId: string;

  constructor(
    resourceType: string,
    resourceId: string,
    details?: Record<string, unknown>,
  ) {
    super(`${resourceType} not found: ${resourceId}`, {
      ...details,
      resourceType,
      resourceId,
    });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: false,
      resolution: `Verify that the ${this.resourceType} '${this.resourceId}' exists and is accessible.`,
      resolutionSteps: [
        `1. Check if ${this.resourceType} '${this.resourceId}' exists`,
        "2. Verify you have permission to access it",
        "3. If using a reference, ensure it is up to date",
      ],
    };
  }
}

/**
 * AuthenticationError - For OAuth and token issues
 * Use when: Token expired, invalid credentials, auth flow failures
 */
export class AuthenticationError extends ServalSheetsError {
  code: ErrorCode;
  retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode = "AUTH_ERROR",
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
    this.code = code;
    this.retryable = retryable;
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      resolution: this.retryable
        ? "Re-authenticate and retry the operation."
        : "Check your authentication credentials and OAuth configuration.",
      resolutionSteps: this.retryable
        ? [
            "1. Refresh your access token",
            "2. Re-authenticate if refresh fails",
            "3. Retry the operation",
          ]
        : [
            "1. Verify OAuth client credentials",
            "2. Check OAuth flow configuration",
            "3. Ensure redirect URIs are correct",
          ],
    };
  }
}

/**
 * DataError - For data parsing and integrity issues
 * Use when: JSON parse failures, data corruption, version mismatches
 */
export class DataError extends ServalSheetsError {
  code: ErrorCode;
  retryable: boolean;

  constructor(
    message: string,
    code: ErrorCode = "DATA_ERROR",
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
    this.code = code;
    this.retryable = retryable;
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      resolution:
        "Check data integrity and format. May require manual intervention.",
    };
  }
}

/**
 * HandlerLoadError - For handler factory and dynamic loading failures
 * Use when: Unknown handler, method not found, lazy loading failures
 */
export class HandlerLoadError extends ServalSheetsError {
  code: ErrorCode = "HANDLER_LOAD_ERROR";
  retryable = false;
  handlerName: string;

  constructor(
    message: string,
    handlerName: string,
    details?: Record<string, unknown>,
  ) {
    super(message, { ...details, handlerName });
    this.handlerName = handlerName;
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: false,
      resolution: `Check that the handler '${this.handlerName}' is registered correctly.`,
    };
  }
}
