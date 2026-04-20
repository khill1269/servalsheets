export class ServalSheetsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly action?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ServalSheetsError';
  }
}

export class ServalAuthError extends ServalSheetsError {
  constructor(message: string, cause?: unknown) {
    super(message, 'AUTH_ERROR', undefined, cause);
    this.name = 'ServalAuthError';
  }
}

export class ServalNotFoundError extends ServalSheetsError {
  constructor(message: string, action?: string) {
    super(message, 'NOT_FOUND', action);
    this.name = 'ServalNotFoundError';
  }
}

export class ServalPermissionError extends ServalSheetsError {
  constructor(message: string, action?: string) {
    super(message, 'PERMISSION_DENIED', action);
    this.name = 'ServalPermissionError';
  }
}

export class ServalValidationError extends ServalSheetsError {
  constructor(message: string, action?: string) {
    super(message, 'VALIDATION_ERROR', action);
    this.name = 'ServalValidationError';
  }
}
