/**
 * Templates mutation actions: create, apply, update, delete, import_builtin
 */

import type { sheets_v4 } from 'googleapis';
import type {
  TemplatesResponse,
  TemplatesCreateInput,
  TemplatesApplyInput,
  TemplatesUpdateInput,
  TemplatesDeleteInput,
  TemplatesImportBuiltinInput,
  TemplateSheet,
} from '../../schemas/index.js';
import { logger } from '../../utils/logger.js';
import { ErrorCodes } from '../error-codes.js';
import { parseA1Range } from './catalog.js';
import type { TemplatesHandlerAccess } from './internal.js';

export async function handleCreate(
  h: TemplatesHandlerAccess,
  req: TemplatesCreateInput
): Promise<TemplatesResponse> {
  // Validate scopes before Drive API access (CRITICAL - write operation)
  const scopeError = h.validateScopes('sheets_templates.create');
  if (scopeError) return scopeError;

  try {
    // Idempotency guard: check if a template with the same name already exists
    try {
      const existingTemplates = await h.templateStore.list();
      const duplicate = existingTemplates.find((t) => t.name === req.name);
      if (duplicate) {
        const existingTemplate = await h.templateStore.get(duplicate.id);
        if (existingTemplate) {
          return h.success('create', {
            template: existingTemplate,
            _idempotent: true,
            _hint: `Template "${req.name}" already exists. Returning existing template instead of creating a duplicate.`,
          });
        }
      }
    } catch {
      // Non-blocking: proceed with creation if lookup fails
    }

    // Get spreadsheet metadata
    const spreadsheet = await h.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId,
      includeGridData: req.includeData ?? false,
      fields: req.includeData ? 'sheets(properties,data)' : 'sheets(properties)',
    });

    const sheets = spreadsheet.data.sheets || [];
    const templateSheets: TemplateSheet[] = sheets.map((sheet) => ({
      name: sheet.properties?.title || 'Sheet',
      rowCount: sheet.properties?.gridProperties?.rowCount || 1000,
      columnCount: sheet.properties?.gridProperties?.columnCount || 26,
      frozenRowCount: sheet.properties?.gridProperties?.frozenRowCount ?? undefined,
      frozenColumnCount: sheet.properties?.gridProperties?.frozenColumnCount ?? undefined,
      // Extract headers from first row if data is included
      headers:
        req.includeData && sheet.data?.[0]?.rowData?.[0]?.values
          ? sheet.data[0].rowData[0].values
              .map((cell) => cell.formattedValue || '')
              .filter((v) => v)
          : undefined,
    }));

    const template = await h.templateStore.create({
      name: req.name,
      description: req.description,
      category: req.category,
      version: '1.0.0',
      sheets: templateSheets,
    });

    return h.success('create', { template });
  } catch (error) {
    logger.error('Failed to create template', { spreadsheetId: req.spreadsheetId, error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to create template: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}

export async function handleApply(
  h: TemplatesHandlerAccess,
  req: TemplatesApplyInput
): Promise<TemplatesResponse> {
  // Validate scopes before Drive API access (only for user templates)
  if (!req.templateId.startsWith('builtin:')) {
    const scopeError = h.validateScopes('sheets_templates.apply');
    if (scopeError) return scopeError;
  }

  try {
    // Get template (user or builtin)
    let templateData: {
      sheets: TemplateSheet[];
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
      templateData = { sheets: builtin.sheets };
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

    const totalSheets = templateData.sheets.length;
    const shouldReportProgress = totalSheets >= 2;
    const totalProgressSteps = totalSheets + 2;
    if (shouldReportProgress) {
      await h.sendProgress(
        0,
        totalProgressSteps,
        `Applying template (0/${totalProgressSteps} steps)...`
      );
    }

    // Build spreadsheet create request
    const createRequest: sheets_v4.Schema$Spreadsheet = {
      properties: {
        title: req.title,
      },
      sheets: templateData.sheets.map((sheet, index) => ({
        properties: {
          sheetId: index,
          title: sheet.name,
          gridProperties: {
            rowCount: sheet.rowCount || 1000,
            columnCount: sheet.columnCount || 26,
            frozenRowCount: sheet.frozenRowCount,
            frozenColumnCount: sheet.frozenColumnCount,
          },
        },
      })),
    };

    // Create spreadsheet
    const response = await h.sheetsApi.spreadsheets.create({
      requestBody: createRequest,
      // Field mask reduces response payload - only return fields we actually use
      fields: 'spreadsheetId,spreadsheetUrl,sheets(properties(sheetId,title))',
    });

    // Validate response data before using
    if (!response.data.spreadsheetId || !response.data.spreadsheetUrl) {
      return h.error({
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Sheets API returned incomplete data after creating spreadsheet',
        details: {
          templateId: req.templateId,
          title: req.title,
          hasSpreadsheetId: !!response.data.spreadsheetId,
          hasSpreadsheetUrl: !!response.data.spreadsheetUrl,
        },
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
        resolution: 'Retry the operation. If the issue persists, check Google Sheets API status.',
      });
    }

    const spreadsheetId = response.data.spreadsheetId;
    const spreadsheetUrl = response.data.spreadsheetUrl;
    if (shouldReportProgress) {
      await h.sendProgress(
        1,
        totalProgressSteps,
        `Spreadsheet created (1/${totalProgressSteps} steps)`
      );
    }

    // Apply headers if defined
    const requests: sheets_v4.Schema$Request[] = [];
    let processedSheets = 0;
    for (let i = 0; i < templateData.sheets.length; i++) {
      const sheet = templateData.sheets[i];
      if (!sheet) continue;

      if (sheet.headers && sheet.headers.length > 0) {
        requests.push({
          updateCells: {
            rows: [
              {
                values: sheet.headers.map((header) => ({
                  userEnteredValue: { stringValue: header },
                  userEnteredFormat: { textFormat: { bold: true } },
                })),
              },
            ],
            fields: 'userEnteredValue,userEnteredFormat.textFormat.bold',
            start: {
              sheetId: i,
              rowIndex: 0,
              columnIndex: 0,
            },
          },
        });
      }

      // Apply column widths if defined
      if (sheet.columnWidths) {
        for (let col = 0; col < sheet.columnWidths.length; col++) {
          const width = sheet.columnWidths[col];
          if (width === undefined) continue;
          requests.push({
            updateDimensionProperties: {
              range: {
                sheetId: i,
                dimension: 'COLUMNS',
                startIndex: col,
                endIndex: col + 1,
              },
              properties: {
                pixelSize: width,
              },
              fields: 'pixelSize',
            },
          });
        }
      }

      processedSheets += 1;
      if (
        shouldReportProgress &&
        (processedSheets % 2 === 0 || processedSheets === totalSheets)
      ) {
        await h.sendProgress(
          1 + processedSheets,
          totalProgressSteps,
          `Prepared ${processedSheets}/${totalSheets} sheet(s) from template...`
        );
      }
    }

    // Add named ranges if defined
    if (templateData.namedRanges) {
      for (const namedRange of templateData.namedRanges) {
        requests.push({
          addNamedRange: {
            namedRange: {
              name: namedRange.name,
              range: parseA1Range(
                namedRange.range,
                response.data.sheets || [],
                h.letterToColumn
              ),
            },
          },
        });
      }
    }

    // Apply batch updates if any
    if (requests.length > 0) {
      await h.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }

    // Move to folder if specified
    let folderMoveError: string | null = null;
    if (req.folderId) {
      try {
        await h.driveApi.files.update({
          fileId: spreadsheetId,
          addParents: req.folderId,
          fields: 'id',
          supportsAllDrives: true,
        });
      } catch (moveError) {
        folderMoveError = moveError instanceof Error ? moveError.message : String(moveError);
        logger.warn('Failed to move spreadsheet to folder', {
          folderId: req.folderId,
          error: moveError,
        });
        // Don't fail the whole operation for this (ISSUE-186: surface in response)
      }
    }

    if (shouldReportProgress) {
      await h.sendProgress(
        totalProgressSteps,
        totalProgressSteps,
        `Template application complete (${totalProgressSteps}/${totalProgressSteps})`
      );
    }

    logger.info('Applied template', {
      templateId: req.templateId,
      spreadsheetId,
      title: req.title,
    });

    return h.success('apply', {
      spreadsheetId,
      spreadsheetUrl,
      ...(folderMoveError !== null ? { folderMoveError } : {}),
    });
  } catch (error) {
    logger.error('Failed to apply template', { templateId: req.templateId, error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to apply template: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}

export async function handleUpdate(
  h: TemplatesHandlerAccess,
  req: TemplatesUpdateInput
): Promise<TemplatesResponse> {
  const scopeError = h.validateScopes('sheets_templates.update');
  if (scopeError) return scopeError;

  try {
    if (req.templateId.startsWith('builtin:')) {
      return h.error({
        code: ErrorCodes.INVALID_REQUEST,
        message: 'Cannot update builtin templates. Use import_builtin first.',
        retryable: false,
        suggestedFix: 'Verify the request format is correct',
      });
    }

    const template = await h.templateStore.update(req.templateId, {
      name: req.name,
      description: req.description,
      category: req.category,
      sheets: req.sheets,
      namedRanges: req.namedRanges,
      metadata: req.metadata,
    });

    return h.success('update', { template });
  } catch (error) {
    logger.error('Failed to update template', { templateId: req.templateId, error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to update template: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}

export async function handleDelete(
  h: TemplatesHandlerAccess,
  req: TemplatesDeleteInput
): Promise<TemplatesResponse> {
  const scopeError = h.validateScopes('sheets_templates.delete');
  if (scopeError) return scopeError;

  try {
    if (req.templateId.startsWith('builtin:')) {
      return h.error({
        code: ErrorCodes.INVALID_REQUEST,
        message: 'Cannot delete builtin templates.',
        retryable: false,
        suggestedFix: 'Verify the request format is correct',
      });
    }

    const deleted = await h.templateStore.delete(req.templateId);

    return h.success('delete', { deleted });
  } catch (error) {
    logger.error('Failed to delete template', { templateId: req.templateId, error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to delete template: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}

export async function handleImportBuiltin(
  h: TemplatesHandlerAccess,
  req: TemplatesImportBuiltinInput
): Promise<TemplatesResponse> {
  const scopeError = h.validateScopes('sheets_templates.import_builtin');
  if (scopeError) return scopeError;

  try {
    const builtin = await h.templateStore.getBuiltinTemplate(req.builtinName);
    if (!builtin) {
      return h.error({
        code: ErrorCodes.NOT_FOUND,
        message: `Builtin template not found: ${req.builtinName}`,
        retryable: false,
        suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
      });
    }

    const template = await h.templateStore.create({
      name: req.customName || builtin.name,
      description: builtin.description,
      category: builtin.category,
      version: '1.0.0',
      sheets: builtin.sheets,
    });

    return h.success('import_builtin', {
      template,
      importedTemplateId: template.id,
    });
  } catch (error) {
    logger.error('Failed to import builtin template', { builtinName: req.builtinName, error });
    return h.error({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to import builtin template: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}
