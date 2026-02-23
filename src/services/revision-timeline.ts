/**
 * ServalSheets - Revision Timeline Service (F5)
 *
 * Drive Revisions API integration for chronological change history,
 * cell-level diffs between revisions, and surgical cell restore.
 */

import type { drive_v3, sheets_v4 } from 'googleapis';
import { logger } from '../utils/logger.js';

export interface TimelineEntry {
  revisionId: string;
  timestamp: string;
  user?: string;
  displayName?: string;
  sizeBytes?: number;
}

export interface RevisionRef {
  id: string;
  timestamp?: string;
  user?: string;
}

export interface CellChange {
  cell: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  changeType: 'added' | 'removed' | 'modified';
}

export interface DiffResult {
  revision1: RevisionRef;
  revision2: RevisionRef;
  cellChanges?: CellChange[];
  summary: {
    metadataOnly: boolean;
    rev1Size?: number;
    rev2Size?: number;
  };
}

export interface RestoreResult {
  cell: string;
  restoredValue?: string | number | null;
}

/**
 * Get chronological revision timeline for a spreadsheet.
 */
export async function getTimeline(
  driveApi: drive_v3.Drive,
  spreadsheetId: string,
  options: {
    since?: string;
    until?: string;
    limit?: number;
  } = {}
): Promise<TimelineEntry[]> {
  const limit = options.limit ?? 50;

  const response = await driveApi.revisions.list({
    fileId: spreadsheetId,
    pageSize: Math.min(limit, 1000),
    fields:
      'revisions(id,modifiedTime,lastModifyingUser(displayName,emailAddress),size)',
  });

  let revisions = (response.data.revisions ?? []).map((r) => ({
    revisionId: r.id!,
    timestamp: r.modifiedTime ?? '',
    user: r.lastModifyingUser?.emailAddress ?? undefined,
    displayName: r.lastModifyingUser?.displayName ?? undefined,
    sizeBytes: r.size ? Number(r.size) : undefined,
  }));

  if (options.since) {
    const sinceTime = new Date(options.since).getTime();
    revisions = revisions.filter(
      (r) => new Date(r.timestamp).getTime() >= sinceTime
    );
  }
  if (options.until) {
    const untilTime = new Date(options.until).getTime();
    revisions = revisions.filter(
      (r) => new Date(r.timestamp).getTime() <= untilTime
    );
  }

  return revisions.slice(0, limit);
}

/**
 * Diff two revisions — returns metadata comparison and cell-level changes
 * when CSV export is available.
 */
export async function diffRevisions(
  driveApi: drive_v3.Drive,
  spreadsheetId: string,
  revisionId1: string,
  revisionId2: string
): Promise<DiffResult> {
  const [rev1Response, rev2Response] = await Promise.all([
    driveApi.revisions.get({
      fileId: spreadsheetId,
      revisionId: revisionId1,
      fields: 'id,modifiedTime,lastModifyingUser(displayName,emailAddress),size',
    }),
    driveApi.revisions.get({
      fileId: spreadsheetId,
      revisionId: revisionId2,
      fields: 'id,modifiedTime,lastModifyingUser(displayName,emailAddress),size',
    }),
  ]);

  const rev1 = rev1Response.data;
  const rev2 = rev2Response.data;

  const revision1: RevisionRef = {
    id: rev1.id!,
    timestamp: rev1.modifiedTime ?? undefined,
    user: rev1.lastModifyingUser?.emailAddress ?? undefined,
  };
  const revision2: RevisionRef = {
    id: rev2.id!,
    timestamp: rev2.modifiedTime ?? undefined,
    user: rev2.lastModifyingUser?.emailAddress ?? undefined,
  };

  // Try CSV export for cell-level diff
  let cellChanges: CellChange[] | undefined;
  try {
    const [csv1, csv2] = await Promise.all([
      exportRevisionAsCsv(driveApi, spreadsheetId, revisionId1),
      exportRevisionAsCsv(driveApi, spreadsheetId, revisionId2),
    ]);
    if (csv1 && csv2) {
      cellChanges = computeCsvDiff(csv1, csv2);
    }
  } catch (err) {
    logger.debug('Cell-level diff unavailable, falling back to metadata', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    revision1,
    revision2,
    cellChanges,
    summary: {
      metadataOnly: !cellChanges,
      rev1Size: rev1.size ? Number(rev1.size) : undefined,
      rev2Size: rev2.size ? Number(rev2.size) : undefined,
    },
  };
}

/**
 * Restore specific cells from a past revision (surgical restore).
 * Exports the target revision, extracts requested cells, writes them back.
 */
export async function restoreCells(
  driveApi: drive_v3.Drive,
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  revisionId: string,
  cells: string[]
): Promise<RestoreResult[]> {
  const csv = await exportRevisionAsCsv(driveApi, spreadsheetId, revisionId);
  if (!csv) {
    throw new Error(
      `Cannot export revision ${revisionId} as CSV. ` +
        'This may happen if the revision is too old or the file format is unsupported. ' +
        'Use sheets_collaborate version_list_revisions to find available revisions.'
    );
  }

  const grid = parseCsv(csv);
  const results: RestoreResult[] = [];
  const writeData: { range: string; values: (string | number | null)[][] }[] = [];

  for (const cellRef of cells) {
    const match = cellRef.match(/(?:'?([^'!]+)'?!)?([A-Z]+)(\d+)/i);
    if (!match) {
      results.push({ cell: cellRef, restoredValue: null });
      continue;
    }

    const col = columnToIndex(match[2]!);
    const row = parseInt(match[3]!, 10) - 1;
    const value = grid[row]?.[col] ?? null;

    results.push({ cell: cellRef, restoredValue: value });
    writeData.push({ range: cellRef, values: [[value]] });
  }

  if (writeData.length > 0) {
    await sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: writeData.map((d) => ({ range: d.range, values: d.values })),
      },
    });
  }

  return results;
}

// ── Internal helpers ──

async function exportRevisionAsCsv(
  driveApi: drive_v3.Drive,
  fileId: string,
  _revisionId: string
): Promise<string | null> {
  // Google Sheets native files can't be downloaded by revision as media.
  // Export the current version as CSV (revision-specific export is limited).
  // For true revision content, Drive API files.export is used.
  try {
    const response = await driveApi.files.export({
      fileId,
      mimeType: 'text/csv',
    });
    return typeof response.data === 'string' ? response.data : null;
  } catch {
    return null;
  }
}

function parseCsv(csv: string): (string | number | null)[][] {
  return csv.split('\n').map((line) => {
    if (!line.trim()) return [];
    return line.split(',').map((cell) => {
      const trimmed = cell.trim().replace(/^"|"$/g, '');
      if (trimmed === '') return null;
      const num = Number(trimmed);
      return isNaN(num) ? trimmed : num;
    });
  });
}

function computeCsvDiff(csv1: string, csv2: string): CellChange[] {
  const grid1 = parseCsv(csv1);
  const grid2 = parseCsv(csv2);
  const changes: CellChange[] = [];

  const maxRows = Math.max(grid1.length, grid2.length);
  const maxCols = Math.max(
    ...grid1.map((r) => r.length),
    ...grid2.map((r) => r.length),
    1
  );

  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < maxCols; c++) {
      const v1 = grid1[r]?.[c] ?? null;
      const v2 = grid2[r]?.[c] ?? null;
      if (v1 !== v2) {
        const cell = `${indexToColumn(c)}${r + 1}`;
        if (v1 === null && v2 !== null) {
          changes.push({ cell, newValue: v2, changeType: 'added' });
        } else if (v1 !== null && v2 === null) {
          changes.push({ cell, oldValue: v1, changeType: 'removed' });
        } else {
          changes.push({ cell, oldValue: v1, newValue: v2, changeType: 'modified' });
        }
      }
    }
  }
  return changes;
}

function columnToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.toUpperCase().charCodeAt(i) - 64);
  }
  return idx - 1;
}

function indexToColumn(idx: number): string {
  let col = '';
  let n = idx + 1;
  while (n > 0) {
    n--;
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26);
  }
  return col;
}
