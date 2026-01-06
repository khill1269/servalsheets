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
