/**
 * ServalSheets - SEP-1036 Elicitation Support
 *
 * Enables server-to-client user input requests for interactive operations.
 * Supports two modes:
 * - Form Mode: Collect structured data via UI forms
 * - URL Mode: Redirect user to URLs (OAuth, external auth)
 *
 * @module mcp/elicitation
 * @see https://spec.modelcontextprotocol.io/specification/2025-11-25/client/elicitation/
 */

import type { ClientCapabilities, ElicitResult } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Elicitation capability check result
 */
export interface ElicitationSupport {
  /** Whether any elicitation is supported */
  supported: boolean;
  /** Whether form-based elicitation is supported */
  form: boolean;
  /** Whether URL-based elicitation is supported */
  url: boolean;
}

/**
 * Primitive schema types for form fields
 */
export interface StringSchema {
  type: 'string';
  title?: string;
  description?: string;
  default?: string;
  minLength?: number;
  maxLength?: number;
  format?: 'email' | 'uri' | 'date' | 'date-time';
}

export interface NumberSchema {
  type: 'number' | 'integer';
  title?: string;
  description?: string;
  default?: number;
  minimum?: number;
  maximum?: number;
}

export interface BooleanSchema {
  type: 'boolean';
  title?: string;
  description?: string;
  default?: boolean;
}

export interface EnumSchema {
  type: 'string';
  title?: string;
  description?: string;
  default?: string;
  enum?: string[];
  oneOf?: Array<{ const: string; title: string }>;
}

export type PrimitiveSchema = StringSchema | NumberSchema | BooleanSchema | EnumSchema;

/**
 * Form elicitation request parameters
 */
export interface FormElicitParams {
  mode?: 'form';
  message: string;
  requestedSchema: {
    type: 'object';
    properties: Record<string, PrimitiveSchema>;
    required?: string[];
  };
}

/**
 * URL elicitation request parameters
 */
export interface URLElicitParams {
  mode: 'url';
  message: string;
  elicitationId: string;
  url: string;
}

/**
 * Server interface for elicitation (subset of Server methods we need)
 */
export interface ElicitationServer {
  getClientCapabilities(): ClientCapabilities | undefined;
  elicitInput(params: FormElicitParams | URLElicitParams): Promise<ElicitResult>;
  sendElicitationCompleteNotification?(elicitationId: string): Promise<void>;
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Check if the client supports elicitation and its modes
 */
export function checkElicitationSupport(
  clientCapabilities: ClientCapabilities | undefined
): ElicitationSupport {
  const elicitation = clientCapabilities?.elicitation;
  return {
    supported: !!elicitation,
    form: !!elicitation?.form,
    url: !!elicitation?.url,
  };
}

/**
 * Assert that form elicitation is supported
 */
export function assertFormElicitationSupport(
  clientCapabilities: ClientCapabilities | undefined
): void {
  if (!clientCapabilities?.elicitation?.form) {
    throw new Error('Client does not support form-based elicitation');
  }
}

/**
 * Assert that URL elicitation is supported
 */
export function assertURLElicitationSupport(
  clientCapabilities: ClientCapabilities | undefined
): void {
  if (!clientCapabilities?.elicitation?.url) {
    throw new Error('Client does not support URL-based elicitation');
  }
}

// ============================================================================
// Schema Builders
// ============================================================================

/**
 * Build a string field schema
 */
export function stringField(options: {
  title: string;
  description?: string;
  default?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  format?: 'email' | 'uri' | 'date' | 'date-time';
}): StringSchema {
  return {
    type: 'string',
    title: options.title,
    ...(options.description && { description: options.description }),
    ...(options.default !== undefined && { default: options.default }),
    ...(options.minLength !== undefined && { minLength: options.minLength }),
    ...(options.maxLength !== undefined && { maxLength: options.maxLength }),
    ...(options.format && { format: options.format }),
  };
}

/**
 * Build a number field schema
 */
export function numberField(options: {
  title: string;
  description?: string;
  default?: number;
  minimum?: number;
  maximum?: number;
  integer?: boolean;
}): NumberSchema {
  return {
    type: options.integer ? 'integer' : 'number',
    title: options.title,
    ...(options.description && { description: options.description }),
    ...(options.default !== undefined && { default: options.default }),
    ...(options.minimum !== undefined && { minimum: options.minimum }),
    ...(options.maximum !== undefined && { maximum: options.maximum }),
  };
}

/**
 * Build a boolean field schema
 */
export function booleanField(options: {
  title: string;
  description?: string;
  default?: boolean;
}): BooleanSchema {
  return {
    type: 'boolean',
    title: options.title,
    ...(options.description && { description: options.description }),
    ...(options.default !== undefined && { default: options.default }),
  };
}

/**
 * Build an enum field schema (simple list)
 */
export function enumField(options: {
  title: string;
  description?: string;
  values: string[];
  default?: string;
}): EnumSchema {
  return {
    type: 'string',
    title: options.title,
    ...(options.description && { description: options.description }),
    enum: options.values,
    ...(options.default && { default: options.default }),
  };
}

/**
 * Build an enum field schema with display titles
 */
export function selectField(options: {
  title: string;
  description?: string;
  options: Array<{ value: string; label: string }>;
  default?: string;
}): EnumSchema {
  return {
    type: 'string',
    title: options.title,
    ...(options.description && { description: options.description }),
    oneOf: options.options.map((opt) => ({
      const: opt.value,
      title: opt.label,
    })),
    ...(options.default && { default: options.default }),
  };
}

// ============================================================================
// Pre-built Form Schemas for Common ServalSheets Operations
// ============================================================================

/**
 * Schema for spreadsheet creation preferences
 */
export const SPREADSHEET_CREATION_SCHEMA: FormElicitParams['requestedSchema'] = {
  type: 'object',
  properties: {
    title: stringField({
      title: 'Spreadsheet Title',
      description: 'Name for your new spreadsheet',
      default: 'Untitled Spreadsheet',
      maxLength: 255,
    }),
    locale: selectField({
      title: 'Locale',
      description: 'Regional format settings',
      options: [
        { value: 'en_US', label: 'English (United States)' },
        { value: 'en_GB', label: 'English (United Kingdom)' },
        { value: 'de_DE', label: 'German (Germany)' },
        { value: 'fr_FR', label: 'French (France)' },
        { value: 'es_ES', label: 'Spanish (Spain)' },
        { value: 'ja_JP', label: 'Japanese (Japan)' },
        { value: 'zh_CN', label: 'Chinese (Simplified)' },
      ],
      default: 'en_US',
    }),
    timeZone: selectField({
      title: 'Time Zone',
      description: 'Time zone for date/time functions',
      options: [
        { value: 'America/New_York', label: 'Eastern Time (US)' },
        { value: 'America/Chicago', label: 'Central Time (US)' },
        { value: 'America/Denver', label: 'Mountain Time (US)' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
        { value: 'Europe/London', label: 'London (UK)' },
        { value: 'Europe/Paris', label: 'Paris (France)' },
        { value: 'Europe/Berlin', label: 'Berlin (Germany)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (Japan)' },
        { value: 'Asia/Shanghai', label: 'Shanghai (China)' },
        { value: 'Australia/Sydney', label: 'Sydney (Australia)' },
      ],
      default: 'America/New_York',
    }),
  },
  required: ['title'],
};

/**
 * Schema for sharing settings
 */
export const SHARING_SETTINGS_SCHEMA: FormElicitParams['requestedSchema'] = {
  type: 'object',
  properties: {
    email: stringField({
      title: 'Email Address',
      description: 'Email of the person to share with',
      format: 'email',
    }),
    role: selectField({
      title: 'Permission Level',
      description: 'What can they do?',
      options: [
        { value: 'reader', label: 'Viewer - Can view only' },
        { value: 'commenter', label: 'Commenter - Can view and comment' },
        { value: 'writer', label: 'Editor - Can make changes' },
      ],
      default: 'reader',
    }),
    sendNotification: booleanField({
      title: 'Send notification email',
      description: 'Notify the person via email',
      default: true,
    }),
    message: stringField({
      title: 'Personal message (optional)',
      description: 'Add a message to the notification email',
      maxLength: 500,
    }),
  },
  required: ['email', 'role'],
};

/**
 * Schema for destructive action confirmation
 */
export const DESTRUCTIVE_CONFIRMATION_SCHEMA: FormElicitParams['requestedSchema'] = {
  type: 'object',
  properties: {
    confirm: booleanField({
      title: 'I understand this action cannot be undone',
      default: false,
    }),
    reason: stringField({
      title: 'Reason for this action (optional)',
      description: 'Why are you performing this operation?',
      maxLength: 200,
    }),
  },
  required: ['confirm'],
};

/**
 * Schema for data import options
 */
export const DATA_IMPORT_SCHEMA: FormElicitParams['requestedSchema'] = {
  type: 'object',
  properties: {
    sourceType: selectField({
      title: 'Import from',
      options: [
        { value: 'csv_url', label: 'CSV from URL' },
        { value: 'google_sheet', label: 'Another Google Sheet' },
        { value: 'json_api', label: 'JSON API endpoint' },
      ],
    }),
    url: stringField({
      title: 'Source URL',
      description: 'URL of the data source',
      format: 'uri',
    }),
    targetSheet: stringField({
      title: 'Target Sheet',
      description: 'Name of sheet to import into (new or existing)',
      default: 'Imported Data',
    }),
    headerRow: booleanField({
      title: 'First row contains headers',
      default: true,
    }),
    replaceExisting: booleanField({
      title: 'Replace existing data',
      description: 'Clear the target sheet before importing',
      default: false,
    }),
  },
  required: ['sourceType', 'url', 'targetSheet'],
};

/**
 * Schema for filter settings
 */
export const FILTER_SETTINGS_SCHEMA: FormElicitParams['requestedSchema'] = {
  type: 'object',
  properties: {
    filterName: stringField({
      title: 'Filter View Name',
      description: 'Name to save this filter as',
      maxLength: 100,
    }),
    columnToFilter: stringField({
      title: 'Column to Filter',
      description: 'Column letter or name (e.g., "A" or "Status")',
    }),
    filterType: selectField({
      title: 'Filter Type',
      options: [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'greater_than', label: 'Greater than' },
        { value: 'less_than', label: 'Less than' },
        { value: 'between', label: 'Between' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ],
    }),
    filterValue: stringField({
      title: 'Filter Value',
      description: 'Value to filter by',
    }),
  },
  required: ['columnToFilter', 'filterType'],
};

// ============================================================================
// High-Level Elicitation Functions
// ============================================================================

/**
 * Safely elicit with fallback value if not supported
 */
export async function safeElicit<T>(
  server: ElicitationServer,
  params: FormElicitParams,
  fallback: T
): Promise<T> {
  const caps = server.getClientCapabilities();
  if (!caps?.elicitation?.form) {
    return fallback;
  }

  try {
    const result = await server.elicitInput(params);
    if (result.action === 'accept' && result.content) {
      return result.content as T;
    }
  } catch (_error) {
    // Note: logger not available in elicitation module, error will be handled by caller
    // Silently fall back to default value
  }

  return fallback;
}

/**
 * Elicit spreadsheet creation preferences
 */
export async function elicitSpreadsheetCreation(server: ElicitationServer): Promise<{
  title: string;
  locale: string;
  timeZone: string;
} | null> {
  assertFormElicitationSupport(server.getClientCapabilities());

  const result = await server.elicitInput({
    mode: 'form',
    message: 'Configure your new spreadsheet:',
    requestedSchema: SPREADSHEET_CREATION_SCHEMA,
  });

  if (result.action === 'accept' && result.content) {
    return {
      title: (result.content['title'] as string) || 'Untitled Spreadsheet',
      locale: (result.content['locale'] as string) || 'en_US',
      timeZone: (result.content['timeZone'] as string) || 'America/New_York',
    };
  }

  return null;
}

/**
 * Elicit sharing settings
 */
export async function elicitSharingSettings(
  server: ElicitationServer,
  spreadsheetTitle: string
): Promise<{
  email: string;
  role: 'reader' | 'commenter' | 'writer';
  sendNotification: boolean;
  message?: string;
} | null> {
  assertFormElicitationSupport(server.getClientCapabilities());

  const result = await server.elicitInput({
    mode: 'form',
    message: `Share "${spreadsheetTitle}" with someone:`,
    requestedSchema: SHARING_SETTINGS_SCHEMA,
  });

  if (result.action === 'accept' && result.content) {
    return {
      email: result.content['email'] as string,
      role: result.content['role'] as 'reader' | 'commenter' | 'writer',
      sendNotification: (result.content['sendNotification'] as boolean) ?? true,
      message: result.content['message'] as string | undefined,
    };
  }

  return null;
}

/**
 * Confirm a destructive action
 */
export async function confirmDestructiveAction(
  server: ElicitationServer,
  action: string,
  details: string
): Promise<{ confirmed: boolean; reason?: string }> {
  const caps = server.getClientCapabilities();
  if (!caps?.elicitation?.form) {
    // Elicitation not available - proceed by default since user explicitly requested the action
    // This is the safe default per MCP spec backward compatibility
    return { confirmed: true };
  }

  // Add timeout to prevent hanging when client reports capability but doesn't respond
  const ELICITATION_TIMEOUT_MS = 5000;

  try {
    const elicitPromise = server.elicitInput({
      mode: 'form',
      message: `⚠️ ${action}\n\n${details}\n\nThis action cannot be undone.`,
      requestedSchema: DESTRUCTIVE_CONFIRMATION_SCHEMA,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Elicitation timeout')), ELICITATION_TIMEOUT_MS);
    });

    const result = await Promise.race([elicitPromise, timeoutPromise]);

    if (result.action === 'accept' && result.content?.['confirm'] === true) {
      return {
        confirmed: true,
        reason: result.content['reason'] as string | undefined,
      };
    }

    // User declined or cancelled
    return { confirmed: false };
  } catch (_error) {
    // Timeout or error - fail-safe: deny destructive operations
    return { confirmed: false };
  }
}

/**
 * Elicit data import configuration
 */
export async function elicitDataImport(server: ElicitationServer): Promise<{
  sourceType: 'csv_url' | 'google_sheet' | 'json_api';
  url: string;
  targetSheet: string;
  headerRow: boolean;
  replaceExisting: boolean;
} | null> {
  assertFormElicitationSupport(server.getClientCapabilities());

  const result = await server.elicitInput({
    mode: 'form',
    message: 'Configure data import:',
    requestedSchema: DATA_IMPORT_SCHEMA,
  });

  if (result.action === 'accept' && result.content) {
    return {
      sourceType: result.content['sourceType'] as 'csv_url' | 'google_sheet' | 'json_api',
      url: result.content['url'] as string,
      targetSheet: (result.content['targetSheet'] as string) || 'Imported Data',
      headerRow: (result.content['headerRow'] as boolean) ?? true,
      replaceExisting: (result.content['replaceExisting'] as boolean) ?? false,
    };
  }

  return null;
}

// ============================================================================
// URL Elicitation (OAuth and External Auth)
// ============================================================================

/**
 * Generate a unique elicitation ID
 */
export function generateElicitationId(prefix: string = 'elicit'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Initiate OAuth flow via URL elicitation
 */
export async function initiateOAuthFlow(
  server: ElicitationServer,
  params: {
    authUrl: string;
    provider: string;
    scopes?: string[];
  }
): Promise<{
  accepted: boolean;
  elicitationId: string;
}> {
  assertURLElicitationSupport(server.getClientCapabilities());

  const elicitationId = generateElicitationId('oauth');

  let message = `Sign in with ${params.provider} to authorize access.`;
  if (params.scopes?.length) {
    message += `\n\nRequested permissions:\n• ${params.scopes.join('\n• ')}`;
  }

  const result = await server.elicitInput({
    mode: 'url',
    message,
    elicitationId,
    url: params.authUrl,
  });

  return {
    accepted: result.action === 'accept',
    elicitationId,
  };
}

/**
 * Complete an OAuth flow (send notification to client)
 */
export async function completeOAuthFlow(
  server: ElicitationServer,
  elicitationId: string
): Promise<void> {
  if (server.sendElicitationCompleteNotification) {
    await server.sendElicitationCompleteNotification(elicitationId);
  }
}

/**
 * Initiate external verification flow
 */
export async function initiateVerificationFlow(
  server: ElicitationServer,
  params: {
    verificationUrl: string;
    purpose: string;
    expiresIn?: number; // seconds
  }
): Promise<{
  accepted: boolean;
  elicitationId: string;
}> {
  assertURLElicitationSupport(server.getClientCapabilities());

  const elicitationId = generateElicitationId('verify');

  let message = params.purpose;
  if (params.expiresIn) {
    const minutes = Math.ceil(params.expiresIn / 60);
    message += `\n\nThis link expires in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
  }

  const result = await server.elicitInput({
    mode: 'url',
    message,
    elicitationId,
    url: params.verificationUrl,
  });

  return {
    accepted: result.action === 'accept',
    elicitationId,
  };
}

// ============================================================================
// Multi-step Wizards
// ============================================================================

/**
 * Result type for wizard steps
 */
export interface WizardStepResult<T> {
  completed: boolean;
  data?: T;
  cancelled?: boolean;
}

/**
 * Run a multi-step wizard
 */
export async function runWizard<T>(
  server: ElicitationServer,
  steps: Array<{
    message: string;
    schema: FormElicitParams['requestedSchema'];
    transform?: (data: Record<string, unknown>, accumulated: Partial<T>) => Partial<T>;
  }>,
  options: {
    onStepComplete?: (stepIndex: number, data: Partial<T>) => void;
  } = {}
): Promise<WizardStepResult<T>> {
  assertFormElicitationSupport(server.getClientCapabilities());

  let accumulated: Partial<T> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const stepNumber = i + 1;
    const totalSteps = steps.length;

    const result = await server.elicitInput({
      mode: 'form',
      message: `Step ${stepNumber}/${totalSteps}: ${step.message}`,
      requestedSchema: step.schema,
    });

    if (result.action === 'cancel') {
      return { completed: false, cancelled: true };
    }

    if (result.action === 'decline' || !result.content) {
      return { completed: false };
    }

    // Transform and accumulate data
    if (step.transform) {
      accumulated = {
        ...accumulated,
        ...step.transform(result.content, accumulated),
      };
    } else {
      accumulated = { ...accumulated, ...(result.content as Partial<T>) };
    }

    // Notify step completion
    if (options.onStepComplete) {
      options.onStepComplete(i, accumulated);
    }
  }

  return { completed: true, data: accumulated as T };
}

// ============================================================================
// Exports
// ============================================================================

export type { ElicitResult };
