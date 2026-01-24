/**
 * ServalSheets - Incremental Scope Consent (SEP-835)
 *
 * Implements on-demand OAuth scope requests without full re-authentication.
 * When an operation requires elevated permissions, the server returns a
 * structured error with the required scopes and authorization URL.
 *
 * Flow:
 * 1. User attempts operation requiring elevated scope (e.g., sharing)
 * 2. Server detects insufficient scopes
 * 3. Server returns IncrementalScopeRequired error with auth URL
 * 4. Client prompts user to authorize additional scopes
 * 5. User completes authorization
 * 6. Client retries operation with new token
 *
 * @see https://spec.modelcontextprotocol.io/specification/security/
 */

import type { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger.js';
import { DEFAULT_SCOPES } from '../services/google-api.js';

/**
 * Scope categories for different operations
 */
export enum ScopeCategory {
  /** Basic spreadsheet operations */
  SPREADSHEET = 'spreadsheet',
  /** File-level Drive operations (create, open) */
  DRIVE_FILE = 'drive_file',
  /** Full Drive operations (share, list all, permissions) */
  DRIVE_FULL = 'drive_full',
  /** Read-only operations */
  READONLY = 'readonly',
}

/**
 * Operation to required scope mapping
 */
export const OPERATION_SCOPES: Record<
  string,
  {
    required: string[];
    category: ScopeCategory;
    description: string;
  }
> = {
  // Basic operations - default scopes
  'sheets_data.read': {
    required: ['https://www.googleapis.com/auth/spreadsheets'],
    category: ScopeCategory.SPREADSHEET,
    description: 'Read spreadsheet values',
  },
  'sheets_data.write': {
    required: ['https://www.googleapis.com/auth/spreadsheets'],
    category: ScopeCategory.SPREADSHEET,
    description: 'Write spreadsheet values',
  },
  'sheets_format.set_format': {
    required: ['https://www.googleapis.com/auth/spreadsheets'],
    category: ScopeCategory.SPREADSHEET,
    description: 'Format cells',
  },
  'sheets_core.create': {
    required: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
    category: ScopeCategory.DRIVE_FILE,
    description: 'Create new spreadsheet',
  },
  'sheets_core.get': {
    required: ['https://www.googleapis.com/auth/spreadsheets'],
    category: ScopeCategory.SPREADSHEET,
    description: 'Get spreadsheet metadata',
  },

  // Elevated operations - require full drive access
  'sheets_collaborate.share_add': {
    required: ['https://www.googleapis.com/auth/drive'],
    category: ScopeCategory.DRIVE_FULL,
    description: 'Share spreadsheet with others',
  },
  'sheets_collaborate.share_list': {
    required: ['https://www.googleapis.com/auth/drive'],
    category: ScopeCategory.DRIVE_FULL,
    description: 'List sharing permissions',
  },
  'sheets_collaborate.share_transfer_ownership': {
    required: ['https://www.googleapis.com/auth/drive'],
    category: ScopeCategory.DRIVE_FULL,
    description: 'Transfer spreadsheet ownership',
  },
  'sheets_collaborate.share_set_link': {
    required: ['https://www.googleapis.com/auth/drive'],
    category: ScopeCategory.DRIVE_FULL,
    description: 'Configure link sharing',
  },

  // Read-only operations
  'sheets_analyze.analyze_quality': {
    required: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    category: ScopeCategory.READONLY,
    description: 'Analyze data quality',
  },
  'sheets_analyze.analyze_data': {
    required: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    category: ScopeCategory.READONLY,
    description: 'Analyze data and compute statistics',
  },
};

/**
 * Error thrown when additional scopes are required
 */
export class IncrementalScopeRequiredError extends Error {
  public readonly code = 'INCREMENTAL_SCOPE_REQUIRED';
  public readonly requiredScopes: string[];
  public readonly currentScopes: string[];
  public readonly missingScopes: string[];
  public readonly authorizationUrl: string;
  public readonly operation: string;
  public readonly category: ScopeCategory;
  public readonly retryable = true;

  constructor(options: {
    operation: string;
    requiredScopes: string[];
    currentScopes: string[];
    authorizationUrl: string;
    category: ScopeCategory;
    description?: string;
  }) {
    const missingScopes = options.requiredScopes.filter((s) => !options.currentScopes.includes(s));

    super(
      `Operation "${options.operation}" requires additional permissions. ` +
        `Missing scopes: ${missingScopes.join(', ')}. ` +
        `Please authorize at: ${options.authorizationUrl}`
    );

    this.name = 'IncrementalScopeRequiredError';
    this.operation = options.operation;
    this.requiredScopes = options.requiredScopes;
    this.currentScopes = options.currentScopes;
    this.missingScopes = missingScopes;
    this.authorizationUrl = options.authorizationUrl;
    this.category = options.category;
  }

  /**
   * Convert to MCP tool error response
   */
  toToolResponse(): {
    content: Array<{ type: 'text'; text: string }>;
    structuredContent: {
      error: string;
      code: string;
      operation: string;
      category: string;
      requiredScopes: string[];
      currentScopes: string[];
      missingScopes: string[];
      authorizationUrl: string;
      retryable: boolean;
      instructions: string;
    };
    isError: true;
  } {
    return {
      content: [
        {
          type: 'text',
          text: this.message,
        },
      ],
      structuredContent: {
        error: this.message,
        code: this.code,
        operation: this.operation,
        category: this.category,
        requiredScopes: this.requiredScopes,
        currentScopes: this.currentScopes,
        missingScopes: this.missingScopes,
        authorizationUrl: this.authorizationUrl,
        retryable: this.retryable,
        instructions:
          'To complete this operation, the user needs to grant additional permissions. ' +
          'Direct them to the authorization URL to approve the required scopes, then retry the operation.',
      },
      isError: true,
    };
  }
}

/**
 * Scope validator for checking operation permissions
 */
export class ScopeValidator {
  private oauthClient?: OAuth2Client;
  private currentScopes: string[] = [];
  private clientId?: string;
  private redirectUri?: string;

  constructor(options?: {
    oauthClient?: OAuth2Client;
    scopes?: string[];
    clientId?: string;
    redirectUri?: string;
  }) {
    this.oauthClient = options?.oauthClient;
    this.currentScopes = options?.scopes ?? [];
    this.clientId = options?.clientId;
    this.redirectUri = options?.redirectUri;
  }

  /**
   * Update current scopes (e.g., after token refresh)
   */
  setScopes(scopes: string[]): void {
    this.currentScopes = scopes;
  }

  /**
   * Update OAuth client
   */
  setOAuthClient(client: OAuth2Client): void {
    this.oauthClient = client;
  }

  /**
   * Check if current scopes satisfy operation requirements
   */
  hasRequiredScopes(operation: string): boolean {
    const opConfig = OPERATION_SCOPES[operation];
    if (!opConfig) {
      // Unknown operation - allow by default
      return true;
    }

    return opConfig.required.every(
      (scope) =>
        this.currentScopes.includes(scope) ||
        // Check for scope upgrades (readonly -> full)
        this.hasScopeUpgrade(scope)
    );
  }

  /**
   * Check if a broader scope covers the required scope
   */
  private hasScopeUpgrade(requiredScope: string): boolean {
    // Full drive covers drive.file
    if (
      requiredScope === 'https://www.googleapis.com/auth/drive.file' &&
      this.currentScopes.includes('https://www.googleapis.com/auth/drive')
    ) {
      return true;
    }

    // Full spreadsheets covers readonly
    if (
      requiredScope === 'https://www.googleapis.com/auth/spreadsheets.readonly' &&
      this.currentScopes.includes('https://www.googleapis.com/auth/spreadsheets')
    ) {
      return true;
    }

    // Full drive covers drive.readonly
    if (
      requiredScope === 'https://www.googleapis.com/auth/drive.readonly' &&
      this.currentScopes.includes('https://www.googleapis.com/auth/drive')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get missing scopes for an operation
   */
  getMissingScopes(operation: string): string[] {
    const opConfig = OPERATION_SCOPES[operation];
    if (!opConfig) {
      return [];
    }

    return opConfig.required.filter(
      (scope) => !this.currentScopes.includes(scope) && !this.hasScopeUpgrade(scope)
    );
  }

  /**
   * Generate authorization URL for incremental consent
   */
  generateIncrementalAuthUrl(additionalScopes: string[]): string {
    if (!this.oauthClient) {
      // Fall back to manual URL construction
      const params = new URLSearchParams({
        client_id: this.clientId ?? process.env['GOOGLE_CLIENT_ID'] ?? '',
        redirect_uri:
          this.redirectUri ??
          process.env['GOOGLE_REDIRECT_URI'] ??
          'http://localhost:3000/oauth/callback',
        response_type: 'code',
        scope: [...this.currentScopes, ...additionalScopes].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true', // Key for incremental consent
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    return this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [...this.currentScopes, ...additionalScopes],
      prompt: 'consent',
      include_granted_scopes: true, // Google-specific: include previously granted scopes
    });
  }

  /**
   * Validate operation and throw if scopes insufficient
   */
  validateOperation(operation: string): void {
    if (this.hasRequiredScopes(operation)) {
      return;
    }

    const opConfig = OPERATION_SCOPES[operation];
    if (!opConfig) {
      return; // Unknown operation, allow
    }

    const missingScopes = this.getMissingScopes(operation);
    const authUrl = this.generateIncrementalAuthUrl(missingScopes);

    logger.info('Incremental scope required', {
      operation,
      category: opConfig.category,
      missingScopes,
      currentScopes: this.currentScopes,
    });

    throw new IncrementalScopeRequiredError({
      operation,
      requiredScopes: opConfig.required,
      currentScopes: this.currentScopes,
      authorizationUrl: authUrl,
      category: opConfig.category,
      description: opConfig.description,
    });
  }

  /**
   * Get scope requirements for an operation
   */
  getOperationRequirements(operation: string): {
    required: string[];
    category: ScopeCategory;
    description: string;
    satisfied: boolean;
    missing: string[];
  } | null {
    const opConfig = OPERATION_SCOPES[operation];
    if (!opConfig) {
      return null;
    }

    return {
      ...opConfig,
      satisfied: this.hasRequiredScopes(operation),
      missing: this.getMissingScopes(operation),
    };
  }

  /**
   * Get all operations that can be performed with current scopes
   */
  getAvailableOperations(): string[] {
    return Object.keys(OPERATION_SCOPES).filter((op) => this.hasRequiredScopes(op));
  }

  /**
   * Get operations that require additional scopes
   */
  getRestrictedOperations(): Array<{
    operation: string;
    category: ScopeCategory;
    missingScopes: string[];
  }> {
    return Object.entries(OPERATION_SCOPES)
      .filter(([op]) => !this.hasRequiredScopes(op))
      .map(([op, config]) => ({
        operation: op,
        category: config.category,
        missingScopes: this.getMissingScopes(op),
      }));
  }

  /**
   * Get recommended scope set based on intended operations
   */
  static getRecommendedScopes(operations: string[]): string[] {
    const scopes = new Set<string>();

    for (const op of operations) {
      const config = OPERATION_SCOPES[op];
      if (config) {
        config.required.forEach((s) => scopes.add(s));
      }
    }

    // Default to basic scopes if nothing specific requested
    if (scopes.size === 0) {
      DEFAULT_SCOPES.forEach((s) => scopes.add(s));
    }

    return Array.from(scopes);
  }
}

/**
 * Create a scope validator from auth context
 */
export function createScopeValidator(authContext?: {
  scopes?: string[];
  oauthClient?: OAuth2Client;
}): ScopeValidator {
  return new ScopeValidator({
    scopes: authContext?.scopes,
    oauthClient: authContext?.oauthClient,
  });
}

/**
 * Middleware-style scope check for handlers
 */
export function requireScopes(operation: string, validator: ScopeValidator): void {
  validator.validateOperation(operation);
}

/**
 * Check if error is an incremental scope error
 */
export function isIncrementalScopeError(error: unknown): error is IncrementalScopeRequiredError {
  return error instanceof IncrementalScopeRequiredError;
}
