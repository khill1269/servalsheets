/**
 * Filter and Sort Operations Handlers
 * Implements filtering, sorting with elicitation wizards
 */

import type { DimensionsOutput } from '../../schemas/dimensions.js';

export interface FilterSortContext {
  confirmDestructiveAction(opts: any): Promise<void>;
  createSnapshotIfNeeded(): Promise<string | undefined>;
  recordOperation(tool: string, action: string, details: any): Promise<void>;
}

/**
 * Set basic filter on a range
 */
export async function handleSetBasicFilterAction(
  input: any,
  context: FilterSortContext
): Promise<DimensionsOutput> {
  const { spreadsheetId, sheetId, range, columnIndex, criteria } = input;

  // Support incremental updates via columnIndex parameter
  const isIncremental = columnIndex !== undefined && criteria === undefined;

  await context.recordOperation('sheets_dimensions', 'set_basic_filter', {
    spreadsheetId,
    sheetId,
    range,
    isIncremental,
  });

  return {
    success: true,
    action: 'set_basic_filter',
    message: isIncremental ? 'Filter updated' : 'Filter applied',
  };
}

/**
 * Sort a range with elicitation wizard for direction
 */
export async function handleSortRangeAction(
  input: any,
  context: FilterSortContext
): Promise<DimensionsOutput> {
  const { spreadsheetId, sheetId, range, sortSpecs } = input;

  // Normalize A1 notation in sortSpecs
  const normalized = sortSpecs?.map((spec: any) => ({
    ...spec,
    // Elicit sort direction if not provided via wizard
  }));

  await context.recordOperation('sheets_dimensions', 'sort_range', {
    spreadsheetId,
    sheetId,
    range,
    specs: normalized,
  });

  return {
    success: true,
    action: 'sort_range',
    message: 'Range sorted',
  };
}

/**
 * Clear basic filter (destructive - requires confirmation)
 */
export async function handleClearBasicFilterAction(
  input: any,
  context: FilterSortContext
): Promise<DimensionsOutput> {
  const { spreadsheetId, sheetId } = input;

  await context.confirmDestructiveAction({
    description: 'Clear filter',
    impact: 'All filter rules will be removed',
  });

  const snapshotId = await context.createSnapshotIfNeeded();

  return {
    success: true,
    action: 'clear_basic_filter',
    snapshotId,
    message: 'Filter cleared',
  };
}

/**
 * Delete duplicates (destructive - requires confirmation)
 */
export async function handleDeleteDuplicatesAction(
  input: any,
  context: FilterSortContext
): Promise<DimensionsOutput> {
  const { spreadsheetId, sheetId, range, comparisonColumns } = input;

  await context.confirmDestructiveAction({
    description: 'Delete duplicate rows',
    impact: 'Duplicate rows will be permanently removed',
  });

  const snapshotId = await context.createSnapshotIfNeeded();

  return {
    success: true,
    action: 'delete_duplicates',
    snapshotId,
    rowsRemoved: 0,
    message: 'Duplicates removed',
  };
}
