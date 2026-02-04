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

// Helper type to constrain inference and prevent excessive depth
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromptArgsShape = Record<string, any>;

// Helper to hide completable() type complexity from TypeScript inference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function c(schema: any, completer: any): any {
  return completable(schema, completer);
}

// Onboarding prompts
export const WelcomePromptArgsSchema: PromptArgsShape = {};

export const SetupTestPromptArgsSchema: PromptArgsShape = {};

export const FirstOperationPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};

// Analysis prompts
export const AnalyzeSpreadsheetPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};

export const TransformDataPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  range: c(z.string().min(1), completeRange),
  transformation: z.string().min(1),
};

// Quick start prompts
export const CreateReportPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  reportType: z.enum(['summary', 'detailed', 'charts']).optional(),
};

export const CleanDataPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  range: c(z.string().min(1), completeRange),
};

// New workflow prompts
export const MigrateDataPromptArgsSchema: PromptArgsShape = {
  sourceSpreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  targetSpreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  sourceRange: c(z.string().min(1), completeRange),
  targetRange: c(z.string().optional(), completeRange),
};

export const SetupBudgetPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().optional(), completeSpreadsheetId),
  budgetType: z.enum(['personal', 'business', 'project']).optional(),
};

export const ImportDataPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  dataSource: z.string().min(1), // Description of data source
  targetSheet: z.string().optional(),
};

export const SetupCollaborationPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  collaborators: z.array(z.string()).min(1), // Email addresses
  role: z.enum(['reader', 'commenter', 'writer', 'owner']).optional(),
};

export const DiagnoseErrorsPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  errorDescription: z.string().optional(),
};

// Safety workflow prompts
export const SafeOperationPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  operationType: z.enum(['delete', 'bulk_update', 'format', 'formula']),
  affectedRange: c(z.string().optional(), completeRange),
};

export const BulkImportPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  dataDescription: z.string().min(1), // Description of data to import
  targetSheet: z.string().optional(),
  rowCount: z.number().min(1).optional(), // Approximate number of rows
};

export const UndoChangesPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  changeDescription: z.string().optional(), // What needs to be undone
};

// Interactive Learning Prompts (Phase 4: Optional Enhancements)
export const MasterClassDataQualityPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().optional(), completeSpreadsheetId),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
};

export const MasterClassFormulasPromptArgsSchema: PromptArgsShape = {
  topic: z
    .enum([
      'performance',
      'array_formulas',
      'volatile_functions',
      'lookup_optimization',
      'error_handling',
    ])
    .optional(),
};

export const MasterClassPerformancePromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  focusArea: z.enum(['read_ops', 'write_ops', 'formulas', 'concurrent_users']).optional(),
};

export const ChallengeQualityDetectivePromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};

export const ChallengePerformanceProfilerPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};

export const ScenarioMultiUserPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
  scenario: z.enum(['conflict_resolution', 'protection_strategy', 'version_control']).optional(),
};

// Context-Aware and Chained Workflow Prompts (Phase 3: Improvement Plan)
export const AutoAnalyzePromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};

export const FullSetupPromptArgsSchema: PromptArgsShape = {
  type: z.enum(['budget', 'crm', 'inventory', 'project', 'sales', 'marketing']),
  name: z.string().min(1),
  collaborators: z.array(z.string()).optional(),
};

export const AuditSecurityPromptArgsSchema: PromptArgsShape = {
  spreadsheetId: c(z.string().min(1), completeSpreadsheetId),
};

export const CompareSpreadsheetPromptArgsSchema: PromptArgsShape = {
  spreadsheetId1: c(z.string().min(1), completeSpreadsheetId),
  spreadsheetId2: c(z.string().min(1), completeSpreadsheetId),
};
