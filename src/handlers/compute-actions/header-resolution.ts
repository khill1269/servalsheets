import type { sheets_v4 } from 'googleapis';
import { ErrorCodes } from '../error-codes.js';
import type { RangeInput } from '../../schemas/shared.js';
import { fetchRangeData, type CellValue } from '../../services/compute-engine.js';
import { indexToColumnLetter, parseA1Notation } from '../../utils/google-sheets-helpers.js';
import { extractRangeA1 } from '../../utils/range-helpers.js';

type HeaderResolutionError = {
  code: typeof ErrorCodes.INVALID_PARAMS;
  message: string;
  retryable: false;
  suggestedFix?: string;
};

type HeaderResolutionResult =
  | { ok: true; data: CellValue[][] }
  | { ok: false; error: HeaderResolutionError };

type HeaderResolutionOptions = {
  hasHeaders?: boolean;
  headerRow?: number;
};

function quoteSheetNameForA1(sheetName: string): string {
  return /[^a-zA-Z0-9_]/.test(sheetName) ? `'${sheetName.replace(/'/g, "''")}'` : sheetName;
}

function buildHeaderRowRange(a1Range: string, headerRow: number): string | HeaderResolutionError {
  try {
    const parsed = parseA1Notation(a1Range);
    const sheetPrefix = parsed.sheetName ? `${quoteSheetNameForA1(parsed.sheetName)}!` : '';
    const startCell = `${indexToColumnLetter(parsed.startCol)}${headerRow}`;
    const endCell = `${indexToColumnLetter(parsed.endCol - 1)}${headerRow}`;
    return `${sheetPrefix}${startCell}:${endCell}`;
  } catch {
    return {
      code: ErrorCodes.INVALID_PARAMS,
      message: 'headerRow requires an A1 notation range so the header columns can be resolved.',
      retryable: false,
      suggestedFix: 'Use an A1 range like "Sheet1!A2:C100" when providing headerRow.',
    };
  }
}

function synthesizeColumnHeaders(data: CellValue[][]): string[] {
  const width = Math.max(0, ...data.map((row) => row.length));
  return Array.from({ length: width }, (_, index) => indexToColumnLetter(index));
}

export async function resolveComputeInputData(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  range: RangeInput,
  options: HeaderResolutionOptions
): Promise<HeaderResolutionResult> {
  const rangeA1 = extractRangeA1(range);
  const data = await fetchRangeData(sheetsApi, spreadsheetId, rangeA1);

  if (options.hasHeaders === false) {
    return {
      ok: true,
      data: [synthesizeColumnHeaders(data), ...data],
    };
  }

  if (options.headerRow === undefined) {
    return { ok: true, data };
  }

  let parsedStartRow: number;
  try {
    parsedStartRow = parseA1Notation(rangeA1).startRow;
  } catch {
    parsedStartRow = -1;
  }

  if (parsedStartRow === options.headerRow - 1) {
    return { ok: true, data };
  }

  const headerRange = buildHeaderRowRange(rangeA1, options.headerRow);
  if (typeof headerRange !== 'string') {
    return { ok: false, error: headerRange };
  }

  const headerRows = await fetchRangeData(sheetsApi, spreadsheetId, headerRange);
  const headerValues = (headerRows[0] ?? []).map((value) => String(value ?? ''));
  if (headerValues.length === 0) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: `No header row data was found at ${headerRange}.`,
        retryable: false,
        suggestedFix: 'Provide a headerRow that contains the column labels for the requested range.',
      },
    };
  }

  return {
    ok: true,
    data: [headerValues, ...data],
  };
}
