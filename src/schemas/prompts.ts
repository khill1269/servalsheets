/**
 * ServalSheets - Prompt Schemas
 *
 * Typed argument schemas for MCP prompts.
 */

import { z } from 'zod';

// Onboarding prompts
export const WelcomePromptArgsSchema = {};

export const SetupTestPromptArgsSchema = {};

export const FirstOperationPromptArgsSchema = {
  spreadsheetId: z.string().optional(),
};

// Analysis prompts
export const AnalyzeSpreadsheetPromptArgsSchema = {
  spreadsheetId: z.string().min(1),
};

export const TransformDataPromptArgsSchema = {
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  transformation: z.string().min(1),
};

// Quick start prompts
export const CreateReportPromptArgsSchema = {
  spreadsheetId: z.string().min(1),
  reportType: z.enum(['summary', 'detailed', 'charts']).optional(),
};

export const CleanDataPromptArgsSchema = {
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
};
