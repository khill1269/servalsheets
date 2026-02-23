/**
 * ServalSheets - Sheet Generator Service (F1)
 *
 * Generates fully structured, formatted spreadsheets from natural language
 * descriptions using MCP Sampling for AI-powered structure design.
 *
 * Pipeline: description → Sampling → SheetDefinition → create + write + format
 */

import type { sheets_v4 } from 'googleapis';
import type { SamplingServer } from '../mcp/sampling.js';
import { analyzeData } from '../mcp/sampling.js';
import type {
  GeneratedSheetDefinition,
  GeneratedColumn,
  GeneratedFormatting,
} from '../schemas/composite.js';
import { logger } from '../utils/logger.js';

export interface SheetDefinition {
  title: string;
  sheets: GeneratedSheetDefinition[];
}

export interface GenerateOptions {
  context?: string;
  style?: 'minimal' | 'professional' | 'dashboard';
  spreadsheetId?: string;
  sheetName?: string;
}

export interface ExecutionResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheetsCreated: number;
  columnsCreated: number;
  rowsCreated: number;
  formulasApplied: number;
  formattingApplied: boolean;
  definition: SheetDefinition;
}

const GENERATION_SYSTEM_PROMPT = `You are a spreadsheet architect. Given a natural language description, generate a JSON spreadsheet definition.

RULES:
- Output ONLY valid JSON, no markdown fences or explanation
- Use descriptive column headers
- Include formulas where calculations are implied (use {row} for current row number)
- Include 3-5 sample data rows to demonstrate the structure
- Choose appropriate column types: text, number, currency, percentage, date, boolean, formula
- For formula columns, provide the formula template in the "formula" field
- Keep sheet names under 30 characters

OUTPUT FORMAT:
{
  "title": "Spreadsheet Title",
  "sheets": [{
    "name": "Sheet Name",
    "columns": [
      { "header": "Column Name", "type": "text|number|currency|percentage|date|boolean|formula", "width": 120, "formula": "=optional formula using {row}" }
    ],
    "rows": [
      { "values": ["value1", 100, true, null] }
    ],
    "formatting": {
      "headerStyle": "bold_blue_background",
      "numberFormat": "$#,##0",
      "freezeRows": 1,
      "alternatingRows": false,
      "conditionalRules": [
        { "range": "E2:E100", "rule": "negative_red" }
      ]
    }
  }]
}`;

/**
 * Generate a SheetDefinition from a natural language description.
 * Uses MCP Sampling if available, falls back to template-based generation.
 */
export async function generateDefinition(
  description: string,
  options: GenerateOptions,
  samplingServer?: SamplingServer
): Promise<SheetDefinition> {
  if (samplingServer) {
    return generateWithSampling(description, options, samplingServer);
  }
  return generateFallback(description, options);
}

async function generateWithSampling(
  description: string,
  options: GenerateOptions,
  samplingServer: SamplingServer
): Promise<SheetDefinition> {
  const styleHint = options.style
    ? `\nStyle preference: ${options.style}`
    : '';
  const contextHint = options.context
    ? `\nAdditional context: ${options.context}`
    : '';

  const prompt = `Create a spreadsheet for: ${description}${styleHint}${contextHint}`;

  const result = await analyzeData(
    samplingServer,
    { data: [[]], question: prompt },
    {
      systemPrompt: GENERATION_SYSTEM_PROMPT,
      maxTokens: 4000,
    }
  );

  try {
    // Extract JSON from response (handle markdown fences)
    const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr) as SheetDefinition;
    validateDefinition(parsed);
    return parsed;
  } catch (err) {
    logger.warn('Failed to parse AI-generated definition, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return generateFallback(description, options);
  }
}

function generateFallback(
  description: string,
  options: GenerateOptions
): SheetDefinition {
  // Extract key terms to build a reasonable template
  const lower = description.toLowerCase();
  const title = extractTitle(description);

  const isFinancial = /budget|revenue|expense|cost|profit|financial|invoice|sales/.test(lower);
  const isTracker = /track|log|schedule|timeline|plan|project/.test(lower);
  const isInventory = /inventory|stock|product|catalog|item/.test(lower);

  if (isFinancial) return buildFinancialTemplate(title, options);
  if (isTracker) return buildTrackerTemplate(title, options);
  if (isInventory) return buildInventoryTemplate(title, options);

  // Generic table
  return buildGenericTemplate(title, description, options);
}

function extractTitle(description: string): string {
  // Take first 50 chars, capitalize words
  const raw = description.slice(0, 50).replace(/[^\w\s]/g, '').trim();
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildFinancialTemplate(title: string, _options: GenerateOptions): SheetDefinition {
  return {
    title,
    sheets: [
      {
        name: 'Financial Data',
        columns: [
          { header: 'Category', type: 'text', width: 180 },
          { header: 'Jan', type: 'currency', width: 120 },
          { header: 'Feb', type: 'currency', width: 120 },
          { header: 'Mar', type: 'currency', width: 120 },
          { header: 'Q1 Total', type: 'formula', width: 130, formula: '=SUM(B{row}:D{row})' },
          { header: 'Avg Monthly', type: 'formula', width: 130, formula: '=AVERAGE(B{row}:D{row})' },
        ],
        rows: [
          { values: ['Revenue', 50000, 55000, 60000, null, null] },
          { values: ['COGS', 20000, 22000, 24000, null, null] },
          { values: ['Gross Profit', null, null, null, null, null], formulas: ['=B2-B3', '=C2-C3', '=D2-D3', null, null] },
          { values: ['Operating Expenses', 15000, 16000, 17000, null, null] },
          { values: ['Net Income', null, null, null, null, null], formulas: ['=B4-B5', '=C4-C5', '=D4-D5', null, null] },
        ],
        formatting: {
          headerStyle: 'bold_blue_background',
          numberFormat: '$#,##0',
          freezeRows: 1,
          freezeColumns: 0,
          alternatingRows: true,
          conditionalRules: [
            { range: 'E2:F100', rule: 'negative_red' },
          ],
        },
      },
    ],
  };
}

function buildTrackerTemplate(title: string, _options: GenerateOptions): SheetDefinition {
  return {
    title,
    sheets: [
      {
        name: 'Tracker',
        columns: [
          { header: 'ID', type: 'number', width: 60 },
          { header: 'Item', type: 'text', width: 250 },
          { header: 'Status', type: 'text', width: 120 },
          { header: 'Priority', type: 'text', width: 100 },
          { header: 'Start Date', type: 'date', width: 120 },
          { header: 'Due Date', type: 'date', width: 120 },
          { header: 'Owner', type: 'text', width: 150 },
          { header: 'Notes', type: 'text', width: 250 },
        ],
        rows: [
          { values: [1, 'Sample task 1', 'In Progress', 'High', '2026-01-15', '2026-02-15', 'Alice', ''] },
          { values: [2, 'Sample task 2', 'Not Started', 'Medium', '2026-01-20', '2026-03-01', 'Bob', ''] },
          { values: [3, 'Sample task 3', 'Complete', 'Low', '2026-01-10', '2026-01-30', 'Carol', ''] },
        ],
        formatting: {
          headerStyle: 'bold_blue_background',
          freezeRows: 1,
          freezeColumns: 0,
          alternatingRows: true,
        },
      },
    ],
  };
}

function buildInventoryTemplate(title: string, _options: GenerateOptions): SheetDefinition {
  return {
    title,
    sheets: [
      {
        name: 'Inventory',
        columns: [
          { header: 'SKU', type: 'text', width: 100 },
          { header: 'Product Name', type: 'text', width: 250 },
          { header: 'Category', type: 'text', width: 130 },
          { header: 'Unit Price', type: 'currency', width: 110 },
          { header: 'Qty In Stock', type: 'number', width: 110 },
          { header: 'Reorder Level', type: 'number', width: 110 },
          { header: 'Total Value', type: 'formula', width: 120, formula: '=D{row}*E{row}' },
          { header: 'Needs Reorder', type: 'formula', width: 120, formula: '=IF(E{row}<=F{row},"YES","")' },
        ],
        rows: [
          { values: ['SKU-001', 'Widget A', 'Hardware', 12.99, 150, 50, null, null] },
          { values: ['SKU-002', 'Widget B', 'Hardware', 24.99, 30, 25, null, null] },
          { values: ['SKU-003', 'Gadget C', 'Electronics', 89.99, 75, 20, null, null] },
        ],
        formatting: {
          headerStyle: 'bold_blue_background',
          numberFormat: '$#,##0.00',
          freezeRows: 1,
          freezeColumns: 0,
          alternatingRows: true,
          conditionalRules: [
            { range: 'H2:H100', rule: 'negative_red' },
          ],
        },
      },
    ],
  };
}

function buildGenericTemplate(title: string, description: string, _options: GenerateOptions): SheetDefinition {
  // Extract potential column names from the description
  const words = description
    .replace(/[^\w\s,]/g, '')
    .split(/[\s,]+/)
    .filter((w) => w.length > 2 && !/^(and|the|for|with|from|that|this|will|have|been|each)$/i.test(w));

  const columnHeaders = words.slice(0, Math.min(6, words.length));
  if (columnHeaders.length < 2) {
    columnHeaders.push('Name', 'Value', 'Notes');
  }

  return {
    title,
    sheets: [
      {
        name: 'Sheet1',
        columns: columnHeaders.map((h) => ({
          header: h.charAt(0).toUpperCase() + h.slice(1),
          type: 'text' as const,
          width: 150,
        })),
        rows: [],
        formatting: {
          headerStyle: 'bold_blue_background',
          freezeRows: 1,
          freezeColumns: 0,
          alternatingRows: false,
        },
      },
    ],
  };
}

function validateDefinition(def: SheetDefinition): void {
  if (!def.title || typeof def.title !== 'string') {
    throw new Error('Definition missing title');
  }
  if (!Array.isArray(def.sheets) || def.sheets.length === 0) {
    throw new Error('Definition must have at least one sheet');
  }
  for (const sheet of def.sheets) {
    if (!sheet.name || !Array.isArray(sheet.columns) || sheet.columns.length === 0) {
      throw new Error(`Sheet "${sheet.name || 'unnamed'}" must have at least one column`);
    }
  }
}

/**
 * Execute a SheetDefinition: create spreadsheet, write data, apply formatting.
 */
export async function executeDefinition(
  sheetsApi: sheets_v4.Sheets,
  definition: SheetDefinition,
  existingSpreadsheetId?: string
): Promise<ExecutionResult> {
  let spreadsheetId: string;
  let spreadsheetUrl: string;

  if (existingSpreadsheetId) {
    spreadsheetId = existingSpreadsheetId;
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  } else {
    // Create new spreadsheet
    const createResponse = await sheetsApi.spreadsheets.create({
      requestBody: {
        properties: { title: definition.title },
        sheets: definition.sheets.map((s, i) => ({
          properties: {
            title: s.name,
            index: i,
            gridProperties: {
              rowCount: Math.max(100, (s.rows?.length ?? 0) + 10),
              columnCount: Math.max(26, s.columns.length + 2),
            },
          },
        })),
      },
      fields: 'spreadsheetId,spreadsheetUrl,sheets.properties',
    });

    spreadsheetId = createResponse.data.spreadsheetId!;
    spreadsheetUrl = createResponse.data.spreadsheetUrl!;
  }

  let totalColumns = 0;
  let totalRows = 0;
  let totalFormulas = 0;
  let formattingApplied = false;

  for (const sheet of definition.sheets) {
    totalColumns += sheet.columns.length;

    // Write headers
    const headers = sheet.columns.map((c) => c.header);
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheet.name}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });

    // Write data rows with formulas
    if (sheet.rows && sheet.rows.length > 0) {
      const dataValues: (string | number | boolean | null)[][] = [];
      for (let r = 0; r < sheet.rows.length; r++) {
        const row = sheet.rows[r]!;
        const rowNum = r + 2; // 1-indexed, after header
        const cells: (string | number | boolean | null)[] = [];

        for (let c = 0; c < sheet.columns.length; c++) {
          const col = sheet.columns[c]!;
          const explicitFormula = row.formulas?.[c];
          const value = row.values[c] ?? null;

          if (explicitFormula) {
            cells.push(explicitFormula);
            totalFormulas++;
          } else if (col.formula && value === null) {
            cells.push(col.formula.replace(/\{row\}/g, String(rowNum)));
            totalFormulas++;
          } else {
            cells.push(value);
          }
        }
        dataValues.push(cells);
      }

      totalRows += dataValues.length;

      await sheetsApi.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheet.name}'!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: dataValues },
      });
    }

    // Apply formatting
    if (sheet.formatting) {
      await applyFormatting(sheetsApi, spreadsheetId, sheet, sheet.formatting);
      formattingApplied = true;
    }
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: definition.title,
    sheetsCreated: definition.sheets.length,
    columnsCreated: totalColumns,
    rowsCreated: totalRows,
    formulasApplied: totalFormulas,
    formattingApplied,
    definition,
  };
}

async function applyFormatting(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheet: GeneratedSheetDefinition,
  formatting: GeneratedFormatting
): Promise<void> {
  // Get sheet ID
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const sheetMeta = (meta.data.sheets ?? []).find(
    (s) => s.properties?.title === sheet.name
  );
  const sheetId = sheetMeta?.properties?.sheetId ?? 0;

  const requests: sheets_v4.Schema$Request[] = [];

  // Header formatting
  if (formatting.headerStyle) {
    const headerFormat = getHeaderFormat(formatting.headerStyle);
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: sheet.columns.length,
        },
        cell: { userEnteredFormat: headerFormat },
        fields: 'userEnteredFormat(backgroundColor,textFormat,borders)',
      },
    });
  }

  // Freeze rows/columns
  if (formatting.freezeRows || formatting.freezeColumns) {
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: formatting.freezeRows ?? 0,
            frozenColumnCount: formatting.freezeColumns ?? 0,
          },
        },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
      },
    });
  }

  // Column widths
  for (let i = 0; i < sheet.columns.length; i++) {
    const col = sheet.columns[i]!;
    if (col.width) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: i,
            endIndex: i + 1,
          },
          properties: { pixelSize: col.width },
          fields: 'pixelSize',
        },
      });
    }
  }

  // Number formats per column type
  for (let i = 0; i < sheet.columns.length; i++) {
    const col = sheet.columns[i]!;
    const pattern = getNumberFormatPattern(col, formatting.numberFormat);
    if (pattern) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: i,
            endColumnIndex: i + 1,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      });
    }
  }

  // Alternating row colors
  if (formatting.alternatingRows) {
    requests.push({
      addBanding: {
        bandedRange: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: Math.max(100, (sheet.rows?.length ?? 0) + 10),
            startColumnIndex: 0,
            endColumnIndex: sheet.columns.length,
          },
          rowProperties: {
            headerColorStyle: { rgbColor: { red: 0.24, green: 0.52, blue: 0.78 } },
            firstBandColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } },
            secondBandColorStyle: { rgbColor: { red: 0.94, green: 0.96, blue: 0.98 } },
          },
        },
      },
    });
  }

  if (requests.length > 0) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

function getHeaderFormat(
  style: string
): sheets_v4.Schema$CellFormat {
  switch (style) {
    case 'bold_blue_background':
      return {
        backgroundColor: { red: 0.24, green: 0.52, blue: 0.78 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
      };
    case 'bold_gray_background':
      return {
        backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
        textFormat: { bold: true },
      };
    case 'bold_underline':
      return {
        textFormat: { bold: true, underline: true },
      };
    case 'bold_border_bottom':
      return {
        textFormat: { bold: true },
        borders: {
          bottom: { style: 'SOLID_MEDIUM', colorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } },
        },
      };
    default:
      return { textFormat: { bold: true } };
  }
}

function getNumberFormatPattern(
  col: GeneratedColumn,
  defaultFormat?: string
): string | null {
  switch (col.type) {
    case 'currency':
      return col.numberFormat ?? defaultFormat ?? '$#,##0.00';
    case 'percentage':
      return col.numberFormat ?? '0.0%';
    case 'number':
      return col.numberFormat ?? '#,##0';
    case 'date':
      return col.numberFormat ?? 'yyyy-mm-dd';
    default:
      return null;
  }
}
