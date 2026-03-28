/**
 * ServalSheets - Excel Online Mutation Builders
 *
 * Provides typed builders for Microsoft Graph API batch mutations.
 * Used by ExcelOnlineBackend.executeBatchMutations() to construct
 * $batch sub-requests for formatting, charts, validation, etc.
 *
 * Design:
 *   - Each builder function returns an ExcelMutation object
 *   - ExcelMutation encodes HTTP method, URL path, and request body
 *   - Multiple mutations are sent via POST /workbook/$batch (Graph API)
 *   - Follows the same thin-adapter pattern as GoogleSheetsBackend
 *
 * Microsoft Graph API Reference:
 *   https://learn.microsoft.com/en-us/graph/api/workbook-post-batchupdate
 *
 * Key differences from Google Sheets batchUpdate:
 *   - Each sub-request is independent (no ordering constraints)
 *   - Errors in one sub-request don't fail the entire batch
 *   - Max 100 sub-requests per $batch call (same as Google Sheets)
 *   - Range addresses use A1 notation (compatible)
 *
 * @example
 * const mutations: ExcelMutation[] = [
 *   buildCellFormatMutation('sheet1', 'A1:D10', { font: { bold: true } }),
 *   buildNumberFormatMutation('sheet1', 'C1:C100', '$#,##0.00'),
 *   buildCreateChartMutation('sheet1', { type: 'ColumnClustered', sourceRange: 'A1:B10' }),
 * ];
 * const result = await backend.executeBatchMutations({ mutations });
 */

import { ValidationError } from '../core/errors.js';

// ============================================================
// Core Mutation Types
// ============================================================

/**
 * Represents a single mutation for the Graph API $batch endpoint
 */
export interface ExcelMutation {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Graph API path (relative to /workbook/) */
  url: string;
  /** Request body (if applicable) */
  body?: unknown;
  /** Optional headers override */
  headers?: Record<string, string>;
}

// ============================================================
// Formatting Types
// ============================================================

export interface ExcelCellFormat {
  font?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    size?: number;
    name?: string;
  };
  fill?: {
    color?: string;
    pattern?:
      | 'solid'
      | 'lightGray'
      | 'gray'
      | 'darkGray'
      | 'lightGrid'
      | 'lightGrid'
      | 'darkGrid'
      | 'none';
  };
  borders?: {
    top?: BorderStyle;
    bottom?: BorderStyle;
    left?: BorderStyle;
    right?: BorderStyle;
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right' | 'justify' | 'distributed';
    vertical?: 'top' | 'middle' | 'bottom' | 'justify' | 'distributed';
    wrapText?: boolean;
    textRotation?: number; // 0-359 degrees
    indentLevel?: number;
  };
  numberFormat?: string;
}

export interface BorderStyle {
  style?:
    | 'thin'
    | 'medium'
    | 'thick'
    | 'double'
    | 'dotted'
    | 'dashed'
    | 'dashedDotted'
    | 'slantDashDot';
  color?: string;
  weight?: 'thin' | 'medium' | 'thick';
}

export interface ConditionalFormatRule {
  priority: number;
  cellValue?: {
    operator:
      | 'between'
      | 'notBetween'
      | 'equal'
      | 'notEqual'
      | 'greaterThan'
      | 'lessThan'
      | 'greaterThanOrEqual'
      | 'lessThanOrEqual';
    values: string[];
    format?: ExcelCellFormat;
  };
  colorScale?: {
    minimum?: { color: string };
    midpoint?: { color: string };
    maximum?: { color: string };
  };
  databar?: {
    positiveFormat?: ExcelCellFormat;
    negativeFormat?: ExcelCellFormat;
    direction?: 'leftToRight' | 'rightToLeft';
  };
  iconSet?: {
    criteria: Array<{
      formula: string;
      operator:
        | 'greaterThan'
        | 'greaterThanOrEqual'
        | 'lessThan'
        | 'lessThanOrEqual'
        | 'between'
        | 'betweenOrEqual';
    }>;
    iconSetType?:
      | 'invalidNumericFormat'
      | 'threeArrows'
      | 'threeArrowsGray'
      | 'threeFlags'
      | 'threeTrafficLights1'
      | 'threeTrafficLights2'
      | 'threeTriangles'
      | 'fourArrows'
      | 'fourArrowsGray'
      | 'fourRedToBlack'
      | 'fourRating'
      | 'fiveArrows'
      | 'fiveArrowsGray'
      | 'fiveRating'
      | 'fiveQuarters';
  };
  topBottom?: {
    type?: 'topItems' | 'bottomItems' | 'topPercent' | 'bottomPercent';
    rank?: number;
    format?: ExcelCellFormat;
  };
  preset?: {
    criterion:
      | 'invalid'
      | 'errors'
      | 'blanks'
      | 'noBlanks'
      | 'nextWeek'
      | 'thisWeek'
      | 'lastWeek'
      | 'nextMonth'
      | 'thisMonth'
      | 'lastMonth'
      | 'tomorrow'
      | 'today'
      | 'yesterday'
      | 'last7Days'
      | 'last30Days'
      | 'last7Days'
      | 'last30Days'
      | 'last365Days'
      | 'next7Days'
      | 'next30Days'
      | 'nextYear';
    format?: ExcelCellFormat;
  };
  textComparison?: {
    operator: 'beginsWidth' | 'endsWith' | 'contains' | 'notContains';
    text: string;
    format?: ExcelCellFormat;
  };
  formula?: {
    formula: string;
    format?: ExcelCellFormat;
  };
  custom?: {
    formula: string;
    format?: ExcelCellFormat;
  };
}

// ============================================================
// Chart Types
// ============================================================

export interface ExcelChartConfig {
  type:
    | 'ColumnClustered'
    | 'ColumnStacked'
    | 'ColumnPercentStacked'
    | 'BarClustered'
    | 'BarStacked'
    | 'BarPercentStacked'
    | 'LineStacked'
    | 'LinePercentStacked'
    | 'LineClusteredMarked'
    | 'LineStackedMarked'
    | 'LinePercentStackedMarked'
    | 'PieExploded'
    | 'PiePercentStacked'
    | 'DoughnutExploded'
    | 'AreaStacked'
    | 'AreaPercentStacked'
    | 'ScatterSmooth'
    | 'ScatterSmoothNoMarkers'
    | 'ScatterLines'
    | 'ScatterLinesNoMarkers'
    | 'ScatterLineMarkers'
    | 'ScatterLineMarkersNoMarkers'
    | 'BubbleNoBubbleSize'
    | 'Bubble3DEffect'
    | 'RadarStandard'
    | 'RadarStacked'
    | 'RadarPercentStacked'
    | 'SurfaceWireframeContour'
    | 'SurfaceContour'
    | 'Funnel'
    | 'Treemap'
    | 'Sunburst'
    | 'Histogram'
    | 'Waterfall'
    | 'Pareto';
  sourceRange: string; // A1 notation, e.g., "Sheet1!A1:B10"
  seriesByRows?: boolean; // default: false (series by column)
  title?: string;
  hasLegend?: boolean;
  legend?: {
    visible: boolean;
    position?: 'Top' | 'Bottom' | 'Left' | 'Right' | 'Corner';
    includeInLayout?: boolean;
    showShadow?: boolean;
  };
  dataLabels?: {
    showLegendKey?: boolean;
    showVal?: boolean;
    showCategoryName?: boolean;
    showSeriesName?: boolean;
    showPercentage?: boolean;
    showBubbleSize?: boolean;
  };
  datalabels?: {
    numberFormat?: {
      format: string;
    };
    position?:
      | 'Center'
      | 'InsideEnd'
      | 'InsideBase'
      | 'OutsideEnd'
      | 'Left'
      | 'Right'
      | 'Top'
      | 'Bottom'
      | 'BestFit';
  };
}

export interface ExcelChartUpdate extends Partial<ExcelChartConfig> {
  // Allow partial updates
}

// ============================================================
// Data Validation Types
// ============================================================

export interface ExcelDataValidation {
  type: 'WholeNumber' | 'Decimal' | 'TextLength' | 'Time' | 'Date' | 'List' | 'Custom';
  allowNegative?: boolean; // for WholeNumber, Decimal
  operator?:
    | 'between'
    | 'notBetween'
    | 'equal'
    | 'notEqual'
    | 'greaterThan'
    | 'lessThan'
    | 'greaterThanOrEqual'
    | 'lessThanOrEqual';
  minimum?: string | number;
  maximum?: string | number;
  formula1?: string; // for custom validation
  formula2?: string; // for range-based validation
  ignoreBlank?: boolean; // default: true
  promptMessage?: string;
  promptTitle?: string;
  errorMessage?: string;
  errorTitle?: string;
  showInputMessage?: boolean;
  showErrorMessage?: boolean;
  list?: string[]; // for List type
}

// ============================================================
// Filter/Sort Types
// ============================================================

export interface FilterCriteria {
  filterOn?: 'cellColor' | 'fontColor' | 'icon' | 'dynamic' | 'custom' | 'bottomN' | 'topN';
  values?: string[];
  operator?: 'and' | 'or';
}

export interface SortField {
  key: number; // column index
  ascending?: boolean;
  color?: string; // for color sort
  dataOption?: 'TextAsNumbers' | 'TextAsLetters' | 'Normal';
}

// ============================================================
// Sheet Protection Types
// ============================================================

export interface SheetProtectionOptions {
  allowAutoFilter?: boolean;
  allowDeleteColumns?: boolean;
  allowDeleteRows?: boolean;
  allowFormatCells?: boolean;
  allowFormatColumns?: boolean;
  allowFormatRows?: boolean;
  allowInsertColumns?: boolean;
  allowInsertHyperlinks?: boolean;
  allowInsertRows?: boolean;
  allowPivotTables?: boolean;
  allowSort?: boolean;
  allowUseList?: boolean;
}

// ============================================================
// Cell Formatting Mutations
// ============================================================

/**
 * Build a mutation to format cells with font, fill, borders, alignment
 */
export function buildCellFormatMutation(
  worksheetId: string,
  range: string,
  format: ExcelCellFormat
): ExcelMutation {
  if (!worksheetId || !range) {
    throw new ValidationError('worksheetId and range are required', 'worksheetId|range');
  }

  const body: Record<string, unknown> = {};

  if (format.font) {
    body['font'] = format.font;
  }
  if (format.fill) {
    body['fill'] = format.fill;
  }
  if (format.borders) {
    body['borders'] = format.borders;
  }
  if (format.alignment) {
    body['alignment'] = format.alignment;
  }
  if (format.numberFormat) {
    // Number format is set via a separate field in Excel
    body['numberFormat'] = [[format.numberFormat]];
  }

  return {
    method: 'PATCH',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/format`,
    body,
  };
}

/**
 * Build a mutation to set number format (currency, percentage, date, etc.)
 */
export function buildNumberFormatMutation(
  worksheetId: string,
  range: string,
  numberFormat: string
): ExcelMutation {
  if (!worksheetId || !range || !numberFormat) {
    throw new ValidationError('worksheetId, range, and numberFormat are required', 'numberFormat');
  }

  return {
    method: 'PATCH',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')`,
    body: {
      numberFormat: [[numberFormat]],
    },
  };
}

/**
 * Build a mutation to add conditional formatting to a range
 */
export function buildConditionalFormatMutation(
  worksheetId: string,
  range: string,
  rule: ConditionalFormatRule
): ExcelMutation {
  if (!worksheetId || !range || !rule) {
    throw new ValidationError('worksheetId, range, and rule are required', 'rule');
  }

  const body: Record<string, unknown> = {
    priority: rule.priority,
  };

  if (rule.cellValue) {
    body['cellValue'] = rule.cellValue;
  } else if (rule.colorScale) {
    body['colorScale'] = rule.colorScale;
  } else if (rule.databar) {
    body['databar'] = rule.databar;
  } else if (rule.iconSet) {
    body['iconSet'] = rule.iconSet;
  } else if (rule.topBottom) {
    body['topBottom'] = rule.topBottom;
  } else if (rule.preset) {
    body['preset'] = rule.preset;
  } else if (rule.textComparison) {
    body['textComparison'] = rule.textComparison;
  } else if (rule.formula) {
    body['formula'] = rule.formula;
  } else if (rule.custom) {
    body['custom'] = rule.custom;
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/conditionalFormats/add`,
    body,
  };
}

/**
 * Build a mutation to merge cells
 */
export function buildMergeCellsMutation(
  worksheetId: string,
  range: string,
  across?: boolean
): ExcelMutation {
  if (!worksheetId || !range) {
    throw new ValidationError('worksheetId and range are required', 'range');
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/merge`,
    body: {
      across: across ?? false,
    },
  };
}

/**
 * Build a mutation to unmerge cells
 */
export function buildUnmergeCellsMutation(worksheetId: string, range: string): ExcelMutation {
  if (!worksheetId || !range) {
    throw new ValidationError('worksheetId and range are required', 'range');
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/unmerge`,
  };
}

/**
 * Build a mutation to auto-fit column widths
 */
export function buildAutoFitColumnsMutation(worksheetId: string, range: string): ExcelMutation {
  if (!worksheetId || !range) {
    throw new ValidationError('worksheetId and range are required', 'range');
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/format/autofitColumns`,
  };
}

/**
 * Build a mutation to auto-fit row heights
 */
export function buildAutoFitRowsMutation(worksheetId: string, range: string): ExcelMutation {
  if (!worksheetId || !range) {
    throw new ValidationError('worksheetId and range are required', 'range');
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/format/autofitRows`,
  };
}

/**
 * Build a mutation to freeze rows
 */
export function buildFreezeRowsMutation(
  worksheetId: string,
  frozenRowCount: number
): ExcelMutation {
  if (!worksheetId || frozenRowCount < 0) {
    throw new ValidationError(
      'worksheetId and valid frozenRowCount are required',
      'frozenRowCount'
    );
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/freezePanes/freezeAt`,
    body: {
      frozenRowCount,
      frozenColumnCount: 0,
    },
  };
}

/**
 * Build a mutation to freeze columns
 */
export function buildFreezeColumnsMutation(
  worksheetId: string,
  frozenColumnCount: number
): ExcelMutation {
  if (!worksheetId || frozenColumnCount < 0) {
    throw new ValidationError(
      'worksheetId and valid frozenColumnCount are required',
      'frozenColumnCount'
    );
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/freezePanes/freezeAt`,
    body: {
      frozenRowCount: 0,
      frozenColumnCount,
    },
  };
}

// ============================================================
// Chart Mutations
// ============================================================

/**
 * Build a mutation to create a new chart
 */
export function buildCreateChartMutation(
  worksheetId: string,
  config: ExcelChartConfig
): ExcelMutation {
  if (!worksheetId || !config.type || !config.sourceRange) {
    throw new ValidationError(
      'worksheetId, chart type, and sourceRange are required',
      'sourceRange'
    );
  }

  const body: Record<string, unknown> = {
    type: config.type,
    sourceData: {
      address: config.sourceRange,
      seriesByRows: config.seriesByRows ?? false,
    },
  };

  if (config.title) {
    body['title'] = { text: config.title };
  }
  if (config.hasLegend !== undefined) {
    body['hasLegend'] = config.hasLegend;
  }
  if (config.legend) {
    body['legend'] = config.legend;
  }
  if (config.dataLabels) {
    body['dataLabels'] = config.dataLabels;
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/charts/add`,
    body,
  };
}

/**
 * Build a mutation to update an existing chart
 */
export function buildUpdateChartMutation(
  worksheetId: string,
  chartId: string,
  updates: ExcelChartUpdate
): ExcelMutation {
  if (!worksheetId || !chartId) {
    throw new ValidationError('worksheetId and chartId are required', 'chartId');
  }

  const body: Record<string, unknown> = {};

  if (updates.type) {
    body['type'] = updates.type;
  }
  if (updates.sourceRange) {
    body['sourceData'] = {
      address: updates.sourceRange,
      seriesByRows: updates.seriesByRows ?? false,
    };
  }
  if (updates.title) {
    body['title'] = { text: updates.title };
  }
  if (updates.hasLegend !== undefined) {
    body['hasLegend'] = updates.hasLegend;
  }
  if (updates.legend) {
    body['legend'] = updates.legend;
  }
  if (updates.dataLabels) {
    body['dataLabels'] = updates.dataLabels;
  }

  return {
    method: 'PATCH',
    url: `/worksheets/${worksheetId}/charts/${chartId}`,
    body,
  };
}

/**
 * Build a mutation to delete a chart
 */
export function buildDeleteChartMutation(worksheetId: string, chartId: string): ExcelMutation {
  if (!worksheetId || !chartId) {
    throw new ValidationError('worksheetId and chartId are required', 'chartId');
  }

  return {
    method: 'DELETE',
    url: `/worksheets/${worksheetId}/charts/${chartId}`,
  };
}

// ============================================================
// Data Validation Mutations
// ============================================================

/**
 * Build a mutation to add data validation to a range
 */
export function buildDataValidationMutation(
  worksheetId: string,
  range: string,
  validation: ExcelDataValidation
): ExcelMutation {
  if (!worksheetId || !range || !validation.type) {
    throw new ValidationError('worksheetId, range, and validation type are required', 'validation');
  }

  const body: Record<string, unknown> = {
    type: validation.type,
    allowNegative: validation.allowNegative ?? true,
    ignoreBlank: validation.ignoreBlank ?? true,
  };

  if (validation.operator) {
    body['operator'] = validation.operator;
  }
  if (validation.minimum !== undefined) {
    body['minimum'] = validation.minimum;
  }
  if (validation.maximum !== undefined) {
    body['maximum'] = validation.maximum;
  }
  if (validation.formula1) {
    body['formula1'] = validation.formula1;
  }
  if (validation.formula2) {
    body['formula2'] = validation.formula2;
  }
  if (validation.promptMessage) {
    body['promptMessage'] = validation.promptMessage;
  }
  if (validation.promptTitle) {
    body['promptTitle'] = validation.promptTitle;
  }
  if (validation.errorMessage) {
    body['errorMessage'] = validation.errorMessage;
  }
  if (validation.errorTitle) {
    body['errorTitle'] = validation.errorTitle;
  }
  if (validation.showInputMessage !== undefined) {
    body['showInputMessage'] = validation.showInputMessage;
  }
  if (validation.showErrorMessage !== undefined) {
    body['showErrorMessage'] = validation.showErrorMessage;
  }
  if (validation.list && validation.list.length > 0) {
    body['formula1'] = JSON.stringify(validation.list);
  }

  return {
    method: 'PATCH',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/dataValidation`,
    body,
  };
}

/**
 * Build a mutation to clear data validation from a range
 */
export function buildClearDataValidationMutation(
  worksheetId: string,
  range: string
): ExcelMutation {
  if (!worksheetId || !range) {
    throw new ValidationError('worksheetId and range are required', 'range');
  }

  return {
    method: 'PATCH',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/dataValidation/clearValidation`,
  };
}

// ============================================================
// Named Range Mutations
// ============================================================

/**
 * Build a mutation to create a named range
 */
export function buildCreateNamedRangeMutation(
  name: string,
  range: string,
  comment?: string
): ExcelMutation {
  if (!name || !range) {
    throw new ValidationError('name and range are required', 'name');
  }

  const body: Record<string, unknown> = {
    name,
    reference: range,
  };

  if (comment) {
    body['comment'] = comment;
  }

  return {
    method: 'POST',
    url: `/names/add`,
    body,
  };
}

/**
 * Build a mutation to delete a named range
 */
export function buildDeleteNamedRangeMutation(name: string): ExcelMutation {
  if (!name) {
    throw new ValidationError('name is required', 'name');
  }

  return {
    method: 'DELETE',
    url: `/names/${encodeURIComponent(name)}`,
  };
}

// ============================================================
// Filter/Sort Mutations
// ============================================================

/**
 * Build a mutation to apply a filter to a range
 */
export function buildApplyFilterMutation(
  worksheetId: string,
  range: string,
  columnIndex: number,
  criteria: FilterCriteria
): ExcelMutation {
  if (!worksheetId || !range || columnIndex < 0) {
    throw new ValidationError(
      'worksheetId, range, and valid columnIndex are required',
      'columnIndex'
    );
  }

  const filterBody: Record<string, unknown> = {
    filterOn: criteria.filterOn,
  };

  if (criteria.values) {
    filterBody['values'] = criteria.values;
  }
  if (criteria.operator) {
    filterBody['operator'] = criteria.operator;
  }

  const body: Record<string, unknown> = {
    criteria: filterBody,
  };

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/autoFilter/apply`,
    body,
  };
}

/**
 * Build a mutation to clear filter from a range
 */
export function buildClearFilterMutation(worksheetId: string, range: string): ExcelMutation {
  if (!worksheetId || !range) {
    throw new ValidationError('worksheetId and range are required', 'range');
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/autoFilter/clearFilter`,
  };
}

/**
 * Build a mutation to sort a range
 */
export function buildSortMutation(
  worksheetId: string,
  range: string,
  fields: SortField[]
): ExcelMutation {
  if (!worksheetId || !range || !fields || fields.length === 0) {
    throw new ValidationError(
      'worksheetId, range, and at least one sort field are required',
      'fields'
    );
  }

  const body = {
    fields: fields.map((f) => ({
      key: f.key,
      ascending: f.ascending ?? true,
      color: f.color,
      dataOption: f.dataOption ?? 'Normal',
    })),
  };

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/range(address='${encodeURIComponent(range)}')/sort/apply`,
    body,
  };
}

// ============================================================
// Sheet Protection Mutations
// ============================================================

/**
 * Build a mutation to protect a sheet
 */
export function buildProtectSheetMutation(
  worksheetId: string,
  options?: SheetProtectionOptions
): ExcelMutation {
  if (!worksheetId) {
    throw new ValidationError('worksheetId is required', 'worksheetId');
  }

  const body: Record<string, unknown> = {};

  if (options) {
    if (options.allowAutoFilter !== undefined) body['allowAutoFilter'] = options.allowAutoFilter;
    if (options.allowDeleteColumns !== undefined)
      body['allowDeleteColumns'] = options.allowDeleteColumns;
    if (options.allowDeleteRows !== undefined) body['allowDeleteRows'] = options.allowDeleteRows;
    if (options.allowFormatCells !== undefined) body['allowFormatCells'] = options.allowFormatCells;
    if (options.allowFormatColumns !== undefined)
      body['allowFormatColumns'] = options.allowFormatColumns;
    if (options.allowFormatRows !== undefined) body['allowFormatRows'] = options.allowFormatRows;
    if (options.allowInsertColumns !== undefined)
      body['allowInsertColumns'] = options.allowInsertColumns;
    if (options.allowInsertHyperlinks !== undefined)
      body['allowInsertHyperlinks'] = options.allowInsertHyperlinks;
    if (options.allowInsertRows !== undefined) body['allowInsertRows'] = options.allowInsertRows;
    if (options.allowPivotTables !== undefined) body['allowPivotTables'] = options.allowPivotTables;
    if (options.allowSort !== undefined) body['allowSort'] = options.allowSort;
    if (options.allowUseList !== undefined) body['allowUseList'] = options.allowUseList;
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/protection/protect`,
    body: Object.keys(body).length > 0 ? body : undefined,
  };
}

/**
 * Build a mutation to unprotect a sheet
 */
export function buildUnprotectSheetMutation(worksheetId: string): ExcelMutation {
  if (!worksheetId) {
    throw new ValidationError('worksheetId is required', 'worksheetId');
  }

  return {
    method: 'POST',
    url: `/worksheets/${worksheetId}/protection/unprotect`,
  };
}

// ============================================================
// Google Sheets to Excel Mutation Translator
// ============================================================

/**
 * Translates a Google Sheets BatchCompiler mutation to an Excel mutation.
 *
 * This enables handlers written for Google Sheets to work with Excel
 * without modification, by converting the underlying API calls.
 *
 * @param googleMutation - A mutation object from Google Sheets batchUpdate
 * @param context - Context including worksheetId, etc.
 * @returns ExcelMutation or null if translation is not possible
 */
export function translateGoogleMutationToExcel(
  googleMutation: Record<string, unknown>,
  context: {
    worksheetId: string;
  }
): ExcelMutation | null {
  if (!googleMutation || !context.worksheetId) {
    return null;
  }

  const mutation = googleMutation;
  const { worksheetId } = context;

  // UpdateCellsRequest
  if ('updateCells' in mutation) {
    const update = mutation['updateCells'] as Record<string, unknown>;
    const rangeData = update['range'] as Record<string, unknown> | undefined;
    const rows = update['rows'] as Array<Record<string, unknown>> | undefined;

    if (rangeData && rows && rows.length > 0) {
      // Extract the first cell's format as representative
      const firstCell = rows[0] as Record<string, unknown>;
      const values = firstCell['values'] as Array<Record<string, unknown>> | undefined;

      if (values && values.length > 0) {
        const cellData = values[0] as Record<string, unknown>;
        const userEnteredFormat = cellData['userEnteredFormat'] as
          | Record<string, unknown>
          | undefined;

        if (userEnteredFormat) {
          // Simplified: return as a format mutation for the range
          // In production, would need to properly map cell coordinates
          return {
            method: 'PATCH',
            url: `/worksheets/${worksheetId}/range(address='A1')`,
            body: userEnteredFormat,
          };
        }
      }
    }

    return null;
  }

  // UpdateSheetPropertiesRequest
  if ('updateSheetProperties' in mutation) {
    const update = mutation['updateSheetProperties'] as Record<string, unknown>;
    const properties = update['properties'] as Record<string, unknown> | undefined;

    if (properties) {
      const frozenRowCount = properties['frozenRowCount'] as number | undefined;
      const frozenColumnCount = properties['frozenColumnCount'] as number | undefined;

      if (frozenRowCount !== undefined) {
        return buildFreezeRowsMutation(worksheetId, frozenRowCount);
      }

      if (frozenColumnCount !== undefined) {
        return buildFreezeColumnsMutation(worksheetId, frozenColumnCount);
      }
    }

    return null;
  }

  // UpdateConditionalFormatRuleRequest
  if ('updateConditionalFormatRule' in mutation) {
    const update = mutation['updateConditionalFormatRule'] as Record<string, unknown>;
    const rule = update['rule'] as Record<string, unknown> | undefined;

    if (rule) {
      // Simplified: would need full translation of Google Sheets conditional format to Excel format
      return {
        method: 'PATCH',
        url: `/worksheets/${worksheetId}/conditionalFormats/0`,
        body: rule,
      };
    }

    return null;
  }

  // AddChartRequest
  if ('addChart' in mutation) {
    const add = mutation['addChart'] as Record<string, unknown>;
    const chart = add['chart'] as Record<string, unknown> | undefined;

    if (chart) {
      const spec = chart['spec'] as Record<string, unknown> | undefined;
      if (spec) {
        return {
          method: 'POST',
          url: `/worksheets/${worksheetId}/charts/add`,
          body: spec,
        };
      }
    }

    return null;
  }

  // UpdateChartSpecRequest
  if ('updateChartSpec' in mutation) {
    const update = mutation['updateChartSpec'] as Record<string, unknown>;
    const spec = update['spec'] as Record<string, unknown> | undefined;
    const chartId = update['chartId'] as string | undefined;

    if (spec && chartId) {
      return {
        method: 'PATCH',
        url: `/worksheets/${worksheetId}/charts/${chartId}`,
        body: spec,
      };
    }

    return null;
  }

  // DeleteChartRequest
  if ('deleteChart' in mutation) {
    const del = mutation['deleteChart'] as Record<string, unknown>;
    const chartId = del['chartId'] as string | undefined;

    if (chartId) {
      return buildDeleteChartMutation(worksheetId, chartId);
    }

    return null;
  }

  // Unknown mutation type - cannot translate
  return null;
}
