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
    oneOf?: Array<{
        const: string;
        title: string;
    }>;
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
/**
 * Check if the client supports elicitation and its modes
 */
export declare function checkElicitationSupport(clientCapabilities: ClientCapabilities | undefined): ElicitationSupport;
/**
 * Assert that form elicitation is supported
 */
export declare function assertFormElicitationSupport(clientCapabilities: ClientCapabilities | undefined): void;
/**
 * Assert that URL elicitation is supported
 */
export declare function assertURLElicitationSupport(clientCapabilities: ClientCapabilities | undefined): void;
/**
 * Build a string field schema
 */
export declare function stringField(options: {
    title: string;
    description?: string;
    default?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    format?: 'email' | 'uri' | 'date' | 'date-time';
}): StringSchema;
/**
 * Build a number field schema
 */
export declare function numberField(options: {
    title: string;
    description?: string;
    default?: number;
    minimum?: number;
    maximum?: number;
    integer?: boolean;
}): NumberSchema;
/**
 * Build a boolean field schema
 */
export declare function booleanField(options: {
    title: string;
    description?: string;
    default?: boolean;
}): BooleanSchema;
/**
 * Build an enum field schema (simple list)
 */
export declare function enumField(options: {
    title: string;
    description?: string;
    values: string[];
    default?: string;
}): EnumSchema;
/**
 * Build an enum field schema with display titles
 */
export declare function selectField(options: {
    title: string;
    description?: string;
    options: Array<{
        value: string;
        label: string;
    }>;
    default?: string;
}): EnumSchema;
/**
 * Schema for spreadsheet creation preferences
 */
export declare const SPREADSHEET_CREATION_SCHEMA: FormElicitParams['requestedSchema'];
/**
 * Schema for sharing settings
 */
export declare const SHARING_SETTINGS_SCHEMA: FormElicitParams['requestedSchema'];
/**
 * Schema for destructive action confirmation
 */
export declare const DESTRUCTIVE_CONFIRMATION_SCHEMA: FormElicitParams['requestedSchema'];
/**
 * Schema for data import options
 */
export declare const DATA_IMPORT_SCHEMA: FormElicitParams['requestedSchema'];
/**
 * Schema for filter settings
 */
export declare const FILTER_SETTINGS_SCHEMA: FormElicitParams['requestedSchema'];
/**
 * Safely elicit with fallback value if not supported
 */
export declare function safeElicit<T>(server: ElicitationServer, params: FormElicitParams, fallback: T): Promise<T>;
/**
 * Elicit spreadsheet creation preferences
 */
export declare function elicitSpreadsheetCreation(server: ElicitationServer): Promise<{
    title: string;
    locale: string;
    timeZone: string;
} | null>;
/**
 * Elicit sharing settings
 */
export declare function elicitSharingSettings(server: ElicitationServer, spreadsheetTitle: string): Promise<{
    email: string;
    role: 'reader' | 'commenter' | 'writer';
    sendNotification: boolean;
    message?: string;
} | null>;
/**
 * Confirm a destructive action
 */
export declare function confirmDestructiveAction(server: ElicitationServer, action: string, details: string): Promise<{
    confirmed: boolean;
    reason?: string;
}>;
/**
 * Elicit data import configuration
 */
export declare function elicitDataImport(server: ElicitationServer): Promise<{
    sourceType: 'csv_url' | 'google_sheet' | 'json_api';
    url: string;
    targetSheet: string;
    headerRow: boolean;
    replaceExisting: boolean;
} | null>;
/**
 * Generate a unique elicitation ID
 */
export declare function generateElicitationId(prefix?: string): string;
/**
 * Initiate OAuth flow via URL elicitation
 */
export declare function initiateOAuthFlow(server: ElicitationServer, params: {
    authUrl: string;
    provider: string;
    scopes?: string[];
}): Promise<{
    accepted: boolean;
    elicitationId: string;
}>;
/**
 * Complete an OAuth flow (send notification to client)
 */
export declare function completeOAuthFlow(server: ElicitationServer, elicitationId: string): Promise<void>;
/**
 * Initiate external verification flow
 */
export declare function initiateVerificationFlow(server: ElicitationServer, params: {
    verificationUrl: string;
    purpose: string;
    expiresIn?: number;
}): Promise<{
    accepted: boolean;
    elicitationId: string;
}>;
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
export declare function runWizard<T>(server: ElicitationServer, steps: Array<{
    message: string;
    schema: FormElicitParams['requestedSchema'];
    transform?: (data: Record<string, unknown>, accumulated: Partial<T>) => Partial<T>;
}>, options?: {
    onStepComplete?: (stepIndex: number, data: Partial<T>) => void;
}): Promise<WizardStepResult<T>>;
export type { ElicitResult };
//# sourceMappingURL=elicitation.d.ts.map