import { createHash } from 'node:crypto';
import type { sheets_v4, drive_v3 } from 'googleapis';
import type {
  CoreDescribeWorkbookInput,
  CoreWorkbookFingerprintInput,
  CoreResponse,
} from '../../schemas/index.js';
import type { ErrorDetail, MutationSummary, ResponseMeta } from '../../schemas/shared.js';

interface DescribeWorkbookDeps {
  sheetsApi: sheets_v4.Sheets;
  driveApi?: drive_v3.Drive;
  success: (
    action: string,
    data: Record<string, unknown>,
    mutation?: MutationSummary,
    dryRun?: boolean,
    meta?: ResponseMeta
  ) => CoreResponse;
  mapError: (error: unknown) => CoreResponse;
  error: (error: ErrorDetail) => CoreResponse;
}

/**
 * Handler for `describe_workbook` action.
 *
 * Returns a fast, metadata-only structured summary of a workbook:
 * title, sheets count, per-sheet dimensions and formula counts,
 * last modified time, and owner email.
 *
 * Distinct from `get_comprehensive` which performs deep analysis.
 * This action uses lightweight field masks and does NOT include cell data.
 */
export async function handleDescribeWorkbookAction(
  input: CoreDescribeWorkbookInput,
  deps: DescribeWorkbookDeps
): Promise<CoreResponse> {
  try {
    const { spreadsheetId } = input;

    // Fetch spreadsheet metadata with a tight field mask — no grid data, no expensive fields
    const spreadsheetRes = await deps.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields:
        'spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),data(rowData(values(formattedValue,userEnteredValue))))',
      // includeGridData defaults to false — we request minimal data to count formulas
      includeGridData: true,
      ranges: [], // no ranges = full sparse fetch, will have rowData with values
    });

    const spreadsheet = spreadsheetRes.data;
    const properties = spreadsheet.properties ?? {};
    const sheets = spreadsheet.sheets ?? [];

    let totalFormulaCount = 0;
    let totalNonEmptyCells = 0;

    const sheetSummaries = sheets.map((sheet) => {
      const props = sheet.properties ?? {};
      const grid = props.gridProperties ?? {};
      const rowCount = (grid.rowCount as number) ?? 0;
      const columnCount = (grid.columnCount as number) ?? 0;

      let formulaCount = 0;
      let nonEmptyCells = 0;

      for (const dataRange of sheet.data ?? []) {
        for (const row of dataRange.rowData ?? []) {
          for (const cell of row.values ?? []) {
            const formatted = cell.formattedValue;
            const entered = cell.userEnteredValue;
            if (formatted !== undefined && formatted !== null && formatted !== '') {
              nonEmptyCells++;
            }
            if (entered && typeof entered === 'object' && 'formulaValue' in entered) {
              formulaCount++;
            }
          }
        }
      }

      totalFormulaCount += formulaCount;
      totalNonEmptyCells += nonEmptyCells;

      return {
        name: props.title ?? '',
        sheetId: (props.sheetId as number) ?? 0,
        rowCount,
        columnCount,
        formulaCount,
        nonEmptyCells,
        isEmpty: nonEmptyCells === 0,
      };
    });

    // Optionally fetch Drive metadata for last modified time + owner
    let lastModifiedTime: string | undefined;
    let ownerEmail: string | undefined;

    if (deps.driveApi) {
      try {
        const driveRes = await deps.driveApi.files.get({
          fileId: spreadsheetId,
          fields: 'modifiedTime,owners(emailAddress)',
        });
        lastModifiedTime = driveRes.data.modifiedTime ?? undefined;
        const owners = driveRes.data.owners ?? [];
        ownerEmail = owners[0]?.emailAddress ?? undefined;
      } catch {
        // Drive API call is best-effort — don't fail the whole action
      }
    }

    return deps.success('describe_workbook', {
      workbookSummary: {
        title: (properties.title as string) ?? '',
        locale: (properties.locale as string) ?? undefined,
        timeZone: (properties.timeZone as string) ?? undefined,
        sheetCount: sheets.length,
        totalFormulaCount,
        totalCells: totalNonEmptyCells,
        sheets: sheetSummaries,
        lastModifiedTime,
        ownerEmail,
      },
    });
  } catch (err) {
    return deps.mapError(err);
  }
}

/**
 * Handler for `workbook_fingerprint` action.
 *
 * Returns a stable SHA-256 hex fingerprint of the workbook structure:
 * sheet names, row/column counts, and formula counts.
 * Lightweight — uses the same field mask as describe_workbook without grid data.
 */
export async function handleWorkbookFingerprintAction(
  input: CoreWorkbookFingerprintInput,
  deps: Omit<DescribeWorkbookDeps, 'driveApi'>
): Promise<CoreResponse> {
  try {
    const { spreadsheetId } = input;

    const spreadsheetRes = await deps.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields:
        'spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),data(rowData(values(userEnteredValue))))',
      includeGridData: true,
      ranges: [],
    });

    const sheets = spreadsheetRes.data.sheets ?? [];
    const title = spreadsheetRes.data.properties?.title ?? '';

    const parts: string[] = [`title:${title}`];
    for (const sheet of sheets) {
      const props = sheet.properties ?? {};
      const grid = props.gridProperties ?? {};
      let formulaCount = 0;
      for (const dataRange of sheet.data ?? []) {
        for (const row of dataRange.rowData ?? []) {
          for (const cell of row.values ?? []) {
            const entered = cell.userEnteredValue;
            if (entered && typeof entered === 'object' && 'formulaValue' in entered) {
              formulaCount++;
            }
          }
        }
      }
      parts.push(
        `sheet:${props.title ?? ''}|id:${props.sheetId ?? 0}|rows:${grid.rowCount ?? 0}|cols:${grid.columnCount ?? 0}|formulas:${formulaCount}`
      );
    }

    const fingerprintInput = parts.join(';');
    const fingerprint = createHash('sha256').update(fingerprintInput).digest('hex');

    return deps.success('workbook_fingerprint', { fingerprint, fingerprintInput });
  } catch (err) {
    return deps.mapError(err);
  }
}
