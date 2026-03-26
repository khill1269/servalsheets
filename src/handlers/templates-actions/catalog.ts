/**
 * Templates catalog actions: list, get, preview
 * Read-only lookups into the template store.
 */

import type { sheets_v4 } from 'googleapis';
import type {
  TemplatesResponse,
  TemplatesListInput,
  TemplatesGetInput,
  TemplatesPreviewInput,
} from '../../schemas/index.js';
import { logger } from '../../utils/logger.js';
import { ErrorCodes } from '../error-codes.js';
import { recordTemplateId } from '../../mcp/completions.js';
import type { TemplatesHandlerAccess } from './internal.js';

export async function handleList(
  h: TemplatesHandlerAccess,
  req: TemplatesListInput
): Promise<TemplatesResponse> {
  const scopeError = h.validateScopes('sheets_templates.list');
  if (scopeError) return scopeError;

  try {
    const userTemplates = await h.templateStore.list(req.category);

    let builtinTemplates: Array<{
      id: string;
      name: string;
      description?: string;
      category?: string;
      sheetCount: number;
    }> = [];

    if (req.includeBuiltin) {
      const builtins = await h.templateStore.listBuiltinTemplates();
      builtinTemplates = builtins.map((b) => ({
        id: `builtin:${b.id}`,
        builtinName: b.id,
        name: b.name,
        description: b.description,
        category: b.category,
        sheetCount: b.sheets.length,
      }));
    }

    const allTemplates = [...userTemplates, ...builtinTemplates];

    // Wire completions: cache template IDs for argument autocompletion (ISSUE-062)
    for (const t of allTemplates) {
      if (t.id) recordTemplateId(t.id);
    }

    return h.success('list', {
      templates: allTemplates,
      totalTemplates: allTemplates.length,
      builtinCount: builtinTemplates.length,
    });
  } catch (error) {
    logger.error('Failed to list templates', { error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to list templates: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}

export async function handleGet(
  h: TemplatesHandlerAccess,
  req: TemplatesGetInput
): Promise<TemplatesResponse> {
  // Validate scopes before Drive API access (only for user templates)
  if (!req.templateId.startsWith('builtin:')) {
    const scopeError = h.validateScopes('sheets_templates.get');
    if (scopeError) return scopeError;
  }

  try {
    // Check if it's a builtin template
    if (req.templateId.startsWith('builtin:')) {
      const builtinId = req.templateId.replace('builtin:', '');
      const builtin = await h.templateStore.getBuiltinTemplate(builtinId);
      if (!builtin) {
        return h.error({
          code: ErrorCodes.NOT_FOUND,
          message: `Builtin template not found: ${builtinId}`,
          retryable: false,
          suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
        });
      }
      return h.success('get', {
        template: {
          id: req.templateId,
          name: builtin.name,
          description: builtin.description,
          category: builtin.category,
          version: '1.0.0',
          sheets: builtin.sheets,
          // Normalize shape to match user template response (ISSUE-050)
          created: undefined,
          updated: undefined,
          namedRanges: undefined,
          metadata: undefined,
        },
      });
    }

    const template = await h.templateStore.get(req.templateId);
    if (!template) {
      return h.error({
        code: ErrorCodes.NOT_FOUND,
        message: `Template not found: ${req.templateId}`,
        retryable: false,
        suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
      });
    }

    return h.success('get', { template });
  } catch (error) {
    logger.error('Failed to get template', { templateId: req.templateId, error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to get template: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}

export async function handlePreview(
  h: TemplatesHandlerAccess,
  req: TemplatesPreviewInput
): Promise<TemplatesResponse> {
  // Validate scopes before Drive API access (only for user templates)
  if (!req.templateId.startsWith('builtin:')) {
    const scopeError = h.validateScopes('sheets_templates.preview');
    if (scopeError) return scopeError;
  }

  try {
    // Get template (user or builtin)
    let templateData: {
      name: string;
      description?: string;
      sheets: Array<{
        name: string;
        headers?: string[];
        rowCount?: number;
        columnCount?: number;
      }>;
      namedRanges?: Array<{ name: string; range: string }>;
    };

    if (req.templateId.startsWith('builtin:')) {
      const builtinId = req.templateId.replace('builtin:', '');
      const builtin = await h.templateStore.getBuiltinTemplate(builtinId);
      if (!builtin) {
        return h.error({
          code: ErrorCodes.NOT_FOUND,
          message: `Builtin template not found: ${builtinId}`,
          retryable: false,
          suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
        });
      }
      templateData = {
        name: builtin.name,
        description: builtin.description,
        sheets: builtin.sheets,
      };
    } else {
      const template = await h.templateStore.get(req.templateId);
      if (!template) {
        return h.error({
          code: ErrorCodes.NOT_FOUND,
          message: `Template not found: ${req.templateId}`,
          retryable: false,
          suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
        });
      }
      templateData = template;
    }

    return h.success('preview', {
      preview: {
        name: templateData.name,
        description: templateData.description,
        sheets: templateData.sheets.map((s) => ({
          name: s.name,
          headers: s.headers,
          rowCount: s.rowCount,
          columnCount: s.columnCount,
        })),
        namedRanges: templateData.namedRanges?.map((nr) => nr.name),
      },
    });
  } catch (error) {
    logger.error('Failed to preview template', { templateId: req.templateId, error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to preview template: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}

/**
 * Parse A1 notation range to GridRange (used by handleApply in operations.ts)
 */
export function parseA1Range(
  a1Range: string,
  sheets: sheets_v4.Schema$Sheet[],
  letterToColumn: (letter: string) => number
): sheets_v4.Schema$GridRange {
  const match = a1Range.match(/^(.+?)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) {
    logger.debug(`Invalid A1 range format: ${a1Range}`);
    return {}; // OK: Explicit empty for invalid format (caller handles gracefully)
  }

  const [, sheetName, startCol, startRow, endCol, endRow] = match;

  // Validate all captured groups exist
  if (!sheetName || !startCol || !startRow || !endCol || !endRow) {
    logger.debug(`Incomplete A1 range components: ${a1Range}`);
    return {}; // OK: Explicit empty for invalid format (caller handles gracefully)
  }

  const sheet = sheets.find((s) => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId ?? 0;

  return {
    sheetId,
    startRowIndex: parseInt(startRow, 10) - 1,
    endRowIndex: parseInt(endRow, 10),
    startColumnIndex: letterToColumn(startCol.toUpperCase()),
    endColumnIndex: letterToColumn(endCol.toUpperCase()) + 1,
  };
}
