/**
 * ServalSheets - Prompt Schemas
 *
 * Typed argument schemas for MCP prompts.
 *
 * Note: Type annotations used to avoid TypeScript TS2589 error
 * ("Type instantiation is excessively deep") caused by MCP SDK's
 * type complexity with completable() schemas. See:
 * https://github.com/modelcontextprotocol/typescript-sdk/issues/494
 */
import { z } from 'zod';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { completeRange, completeSpreadsheetId } from '../mcp/completions.js';
// Helper to hide completable() type complexity from TypeScript inference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function c(schema, completer) {
    return completable(schema, completer);
}
// Onboarding prompts
export const WelcomePromptArgsSchema = {};
export const SetupTestPromptArgsSchema = {};
export const FirstOperationPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};
// Analysis prompts
export const AnalyzeSpreadsheetPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};
export const TransformDataPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    range: c(z.string().min(1), completeRange),
    transformation: z.string().min(1),
};
// Quick start prompts
export const CreateReportPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    reportType: z.enum(['summary', 'detailed', 'charts']).optional(),
};
export const CleanDataPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    range: c(z.string().min(1), completeRange),
};
// New workflow prompts
export const MigrateDataPromptArgsSchema = {
    sourceSpreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    targetSpreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    sourceRange: c(z.string().min(1), completeRange),
    targetRange: c(z.string().optional(), completeRange),
};
export const SetupBudgetPromptArgsSchema = {
    spreadsheetId: c(z.string().optional(), completeSpreadsheetId),
    budgetType: z.enum(['personal', 'business', 'project']).optional(),
};
export const ImportDataPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    dataSource: z.string().min(1), // Description of data source
    targetSheet: z.string().optional(),
};
export const SetupCollaborationPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    collaborators: z.array(z.string()).min(1), // Email addresses
    role: z.enum(['reader', 'commenter', 'writer', 'owner']).optional(),
};
export const DiagnoseErrorsPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    errorDescription: z.string().optional(),
};
// Safety workflow prompts
export const SafeOperationPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    operationType: z.enum(['delete', 'bulk_update', 'format', 'formula']),
    affectedRange: c(z.string().optional(), completeRange),
};
export const BulkImportPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    dataDescription: z.string().min(1), // Description of data to import
    targetSheet: z.string().optional(),
    rowCount: z.number().min(1).optional(), // Approximate number of rows
};
export const UndoChangesPromptArgsSchema = {
    spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
    changeDescription: z.string().optional(), // What needs to be undone
};
//# sourceMappingURL=prompts.js.map