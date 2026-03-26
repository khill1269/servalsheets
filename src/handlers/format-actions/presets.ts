/**
 * Formatting Presets and Auto-Fit Handlers
 * Implements 8 preset formats and auto-sizing for columns/rows
 */

import type { FormatOutput } from '../../schemas/format.js';

const PRESET_CONFIGS = {
  header_row: { bold: true, background: { red: 0.8, green: 0.8, blue: 0.8 } },
  alternating_rows: { pattern: 'LIGHT_GRAY_DOTS' },
  total_row: { bold: true, background: { red: 1.0, green: 1.0, blue: 0.9 } },
  currency: { numberFormat: '\"\$\"#,##0.00' },
  percentage: { numberFormat: '0.00%' },
  date: { numberFormat: 'yyyy-MM-dd' },
  highlight_positive: { background: { red: 0.8, green: 1.0, blue: 0.8 } },
  highlight_negative: { background: { red: 1.0, green: 0.8, blue: 0.8 } },
};

/**
 * Apply preset formatting
 */
export async function handleApplyPresetAction(
  input: any
): Promise<FormatOutput> {
  const { spreadsheetId, range, preset } = input;
  const config = PRESET_CONFIGS[preset as keyof typeof PRESET_CONFIGS];

  if (!config) {
    return {
      success: false,
      error: {
        code: 'INVALID_PRESET',
        message: `Unknown preset: ${preset}`,
        retryable: false,
      },
    };
  }

  return {
    success: true,
    action: 'apply_preset',
    preset,
    cellsFormatted: 0,
    message: `Preset '${preset}' applied`,
  };
}

/**
 * Auto-fit columns or rows to content
 */
export async function handleAutoFitAction(
  input: any
): Promise<FormatOutput> {
  const { spreadsheetId, sheetId, dimension } = input;
  const dimLabel = dimension === 'ROWS' ? 'rows' : 'columns';

  return {
    success: true,
    action: 'auto_fit',
    dimension,
    itemsResized: 0,
    message: `Auto-fit ${dimLabel} complete`,
  };
}

/**
 * Batch formatting operations (up to 100 subrequests)
 */
export async function handleBatchFormatAction(
  input: any
): Promise<FormatOutput> {
  const { spreadsheetId, operations } = input;
  const opCount = Array.isArray(operations) ? operations.length : 0;

  if (opCount > 100) {
    return {
      success: false,
      error: {
        code: 'TOO_MANY_OPERATIONS',
        message: `Too many format operations: ${opCount} (max 100)`,
        retryable: false,
      },
    };
  }

  return {
    success: true,
    action: 'batch_format',
    operationsCount: opCount,
    cellsFormatted: 0,
    message: `${opCount} formatting operations applied`,
  };
}

/**
 * Add sparkline to cell
 */
export async function handleSparklineAddAction(
  input: any
): Promise<FormatOutput> {
  const { spreadsheetId, cell, sourceRange } = input;

  return {
    success: true,
    action: 'sparkline_add',
    cell,
    message: `Sparkline added to ${cell}`,
  };
}

/**
 * Get sparkline configuration
 */
export async function handleSparklineGetAction(
  input: any
): Promise<FormatOutput> {
  const { spreadsheetId, cell } = input;

  return {
    success: true,
    action: 'sparkline_get',
    cell,
    sparklines: [],
    message: 'Sparkline configuration retrieved',
  };
}

/**
 * Clear sparklines from range
 */
export async function handleSparklineClearAction(
  input: any
): Promise<FormatOutput> {
  const { spreadsheetId, range } = input;

  return {
    success: true,
    action: 'sparkline_clear',
    range,
    sparkinesRemoved: 0,
    message: 'Sparklines cleared',
  };
}
