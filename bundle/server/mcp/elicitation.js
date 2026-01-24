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
// ============================================================================
// Capability Detection
// ============================================================================
/**
 * Check if the client supports elicitation and its modes
 */
export function checkElicitationSupport(clientCapabilities) {
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
export function assertFormElicitationSupport(clientCapabilities) {
    if (!clientCapabilities?.elicitation?.form) {
        throw new Error('Client does not support form-based elicitation');
    }
}
/**
 * Assert that URL elicitation is supported
 */
export function assertURLElicitationSupport(clientCapabilities) {
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
export function stringField(options) {
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
export function numberField(options) {
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
export function booleanField(options) {
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
export function enumField(options) {
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
export function selectField(options) {
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
export const SPREADSHEET_CREATION_SCHEMA = {
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
export const SHARING_SETTINGS_SCHEMA = {
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
export const DESTRUCTIVE_CONFIRMATION_SCHEMA = {
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
export const DATA_IMPORT_SCHEMA = {
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
export const FILTER_SETTINGS_SCHEMA = {
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
export async function safeElicit(server, params, fallback) {
    const caps = server.getClientCapabilities();
    if (!caps?.elicitation?.form) {
        return fallback;
    }
    try {
        const result = await server.elicitInput(params);
        if (result.action === 'accept' && result.content) {
            return result.content;
        }
    }
    catch (_error) {
        // Note: logger not available in elicitation module, error will be handled by caller
        // Silently fall back to default value
    }
    return fallback;
}
/**
 * Elicit spreadsheet creation preferences
 */
export async function elicitSpreadsheetCreation(server) {
    assertFormElicitationSupport(server.getClientCapabilities());
    const result = await server.elicitInput({
        mode: 'form',
        message: 'Configure your new spreadsheet:',
        requestedSchema: SPREADSHEET_CREATION_SCHEMA,
    });
    if (result.action === 'accept' && result.content) {
        return {
            title: result.content['title'] || 'Untitled Spreadsheet',
            locale: result.content['locale'] || 'en_US',
            timeZone: result.content['timeZone'] || 'America/New_York',
        };
    }
    return null;
}
/**
 * Elicit sharing settings
 */
export async function elicitSharingSettings(server, spreadsheetTitle) {
    assertFormElicitationSupport(server.getClientCapabilities());
    const result = await server.elicitInput({
        mode: 'form',
        message: `Share "${spreadsheetTitle}" with someone:`,
        requestedSchema: SHARING_SETTINGS_SCHEMA,
    });
    if (result.action === 'accept' && result.content) {
        return {
            email: result.content['email'],
            role: result.content['role'],
            sendNotification: result.content['sendNotification'] ?? true,
            message: result.content['message'],
        };
    }
    return null;
}
/**
 * Confirm a destructive action
 */
export async function confirmDestructiveAction(server, action, details) {
    const caps = server.getClientCapabilities();
    if (!caps?.elicitation?.form) {
        // Can't confirm, don't proceed
        return { confirmed: false };
    }
    const result = await server.elicitInput({
        mode: 'form',
        message: `⚠️ ${action}\n\n${details}\n\nThis action cannot be undone.`,
        requestedSchema: DESTRUCTIVE_CONFIRMATION_SCHEMA,
    });
    if (result.action === 'accept' && result.content?.['confirm'] === true) {
        return {
            confirmed: true,
            reason: result.content['reason'],
        };
    }
    return { confirmed: false };
}
/**
 * Elicit data import configuration
 */
export async function elicitDataImport(server) {
    assertFormElicitationSupport(server.getClientCapabilities());
    const result = await server.elicitInput({
        mode: 'form',
        message: 'Configure data import:',
        requestedSchema: DATA_IMPORT_SCHEMA,
    });
    if (result.action === 'accept' && result.content) {
        return {
            sourceType: result.content['sourceType'],
            url: result.content['url'],
            targetSheet: result.content['targetSheet'] || 'Imported Data',
            headerRow: result.content['headerRow'] ?? true,
            replaceExisting: result.content['replaceExisting'] ?? false,
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
export function generateElicitationId(prefix = 'elicit') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
/**
 * Initiate OAuth flow via URL elicitation
 */
export async function initiateOAuthFlow(server, params) {
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
export async function completeOAuthFlow(server, elicitationId) {
    if (server.sendElicitationCompleteNotification) {
        await server.sendElicitationCompleteNotification(elicitationId);
    }
}
/**
 * Initiate external verification flow
 */
export async function initiateVerificationFlow(server, params) {
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
/**
 * Run a multi-step wizard
 */
export async function runWizard(server, steps, options = {}) {
    assertFormElicitationSupport(server.getClientCapabilities());
    let accumulated = {};
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
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
        }
        else {
            accumulated = { ...accumulated, ...result.content };
        }
        // Notify step completion
        if (options.onStepComplete) {
            options.onStepComplete(i, accumulated);
        }
    }
    return { completed: true, data: accumulated };
}
//# sourceMappingURL=elicitation.js.map