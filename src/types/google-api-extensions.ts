/**
 * Google Sheets API Type Extensions
 *
 * Provides additional type definitions for Google Sheets API responses
 * that are not fully typed in the googleapis package.
 *
 * These types help eliminate cascading `any` type inference issues
 * throughout the codebase.
 */

import type { sheets_v4 } from 'googleapis';

/**
 * Generic Google API response wrapper
 */
export interface GoogleSheetsResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: unknown;
}

/**
 * Sheet data from values.get() or values.batchGet()
 */
export interface SheetData {
  values?: unknown[][];
  range?: string;
  majorDimension?: 'ROWS' | 'COLUMNS';
}

/**
 * Batch get response
 */
export interface BatchGetResponse {
  spreadsheetId?: string;
  valueRanges?: SheetData[];
}

/**
 * Chart specification (extended from sheets_v4.Schema$ChartSpec)
 */
export interface ChartSpec extends sheets_v4.Schema$ChartSpec {
  title?: string;
  subtitle?: string;
  fontName?: string;
  basicChart?: {
    chartType?: 'BAR' | 'LINE' | 'AREA' | 'COLUMN' | 'SCATTER' | 'COMBO' | 'STEPPED_AREA';
    legendPosition?: 'BOTTOM_LEGEND' | 'LEFT_LEGEND' | 'RIGHT_LEGEND' | 'TOP_LEGEND' | 'NO_LEGEND';
    axis?: Array<{
      position?: 'BOTTOM_AXIS' | 'LEFT_AXIS' | 'RIGHT_AXIS';
      title?: string;
    }>;
    domains?: Array<{
      domain?: {
        sourceRange?: {
          sources?: Array<GridRange>;
        };
      };
    }>;
    series?: Array<{
      series?: {
        sourceRange?: {
          sources?: Array<GridRange>;
        };
      };
      targetAxis?: 'LEFT_AXIS' | 'RIGHT_AXIS';
      type?: 'BAR' | 'LINE' | 'AREA' | 'COLUMN' | 'SCATTER' | 'COMBO' | 'STEPPED_AREA';
    }>;
    headerCount?: number;
    stackedType?: 'NOT_STACKED' | 'STACKED' | 'PERCENT_STACKED';
  };
  pieChart?: {
    legendPosition?: 'BOTTOM_LEGEND' | 'LEFT_LEGEND' | 'RIGHT_LEGEND' | 'TOP_LEGEND' | 'NO_LEGEND';
    domain?: {
      sourceRange?: {
        sources?: Array<GridRange>;
      };
    };
    series?: {
      sourceRange?: {
        sources?: Array<GridRange>;
      };
    };
  };
}

/**
 * Grid range for chart data sources
 */
export interface GridRange {
  sheetId?: number;
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
}

/**
 * Spreadsheet metadata (compatible with sheets_v4.Schema$Spreadsheet)
 */
export interface SpreadsheetMetadata {
  spreadsheetId?: string;
  properties?: {
    title?: string;
    locale?: string;
    autoRecalc?: 'ON_CHANGE' | 'MINUTE' | 'HOUR';
    timeZone?: string;
  };
  sheets?: Array<sheets_v4.Schema$Sheet>;
  namedRanges?: Array<NamedRange>;
  spreadsheetUrl?: string;
}

/**
 * Sheet metadata (compatible with sheets_v4.Schema$Sheet)
 * Includes extended properties not in googleapis types
 */
export interface SheetMetadata {
  properties?: {
    sheetId?: number;
    title?: string;
    index?: number;
    sheetType?: 'GRID' | 'OBJECT';
    gridProperties?: {
      rowCount?: number;
      columnCount?: number;
      frozenRowCount?: number;
      frozenColumnCount?: number;
      hideGridlines?: boolean;
    };
    hidden?: boolean;
    tabColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
  };
  charts?: Array<sheets_v4.Schema$EmbeddedChart>;
  conditionalFormats?: Array<sheets_v4.Schema$ConditionalFormatRule>;
  protectedRanges?: Array<{
    protectedRangeId?: number;
    range?: GridRange;
    description?: string;
    warningOnly?: boolean;
  }>;
  // Extended property not in googleapis types
  pivotTables?: Array<{
    pivotTableId?: number;
    source?: GridRange;
    rows?: Array<unknown>;
    columns?: Array<unknown>;
    values?: Array<unknown>;
  }>;
}

/**
 * Named range definition
 */
export interface NamedRange extends sheets_v4.Schema$NamedRange {
  namedRangeId?: string;
  name?: string;
  range?: GridRange;
}

/**
 * Cell data with formatting
 */
export interface CellData extends sheets_v4.Schema$CellData {
  userEnteredValue?: {
    stringValue?: string;
    numberValue?: number;
    boolValue?: boolean;
    formulaValue?: string;
    errorValue?: {
      type?: string;
      message?: string;
    };
  };
  effectiveValue?: {
    stringValue?: string;
    numberValue?: number;
    boolValue?: boolean;
    formulaValue?: string;
    errorValue?: {
      type?: string;
      message?: string;
    };
  };
  formattedValue?: string;
  userEnteredFormat?: CellFormat;
  effectiveFormat?: CellFormat;
}

/**
 * Cell format definition
 */
export interface CellFormat extends sheets_v4.Schema$CellFormat {
  numberFormat?: {
    type?:
      | 'TEXT'
      | 'NUMBER'
      | 'PERCENT'
      | 'CURRENCY'
      | 'DATE'
      | 'TIME'
      | 'DATE_TIME'
      | 'SCIENTIFIC';
    pattern?: string;
  };
  backgroundColor?: {
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
  };
  textFormat?: {
    foregroundColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  horizontalAlignment?: 'LEFT' | 'CENTER' | 'RIGHT';
  verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
  wrapStrategy?: 'OVERFLOW_CELL' | 'LEGACY_WRAP' | 'CLIP' | 'WRAP';
}

/**
 * Update request for batch updates
 */
export interface UpdateRequest {
  updateCells?: {
    rows?: Array<{ values?: CellData[] }>;
    fields?: string;
    range?: GridRange;
  };
  updateSheetProperties?: {
    properties?: SheetMetadata['properties'];
    fields?: string;
  };
  addSheet?: {
    properties?: SheetMetadata['properties'];
  };
  deleteSheet?: {
    sheetId?: number;
  };
  updateDimensionProperties?: {
    range?: {
      sheetId?: number;
      dimension?: 'ROWS' | 'COLUMNS';
      startIndex?: number;
      endIndex?: number;
    };
    properties?: {
      pixelSize?: number;
      hiddenByUser?: boolean;
    };
    fields?: string;
  };
}

/**
 * Batch update response
 */
export interface BatchUpdateResponse extends sheets_v4.Schema$BatchUpdateSpreadsheetResponse {
  spreadsheetId?: string;
  replies?: Array<{
    addSheet?: {
      properties?: SheetMetadata['properties'];
    };
    updateCells?: {
      updatedRows?: number;
      updatedColumns?: number;
      updatedCells?: number;
    };
  }>;
}

/**
 * Type guard to check if a value is a valid cell value
 */
export function isCellValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Type guard for SheetData
 */
export function isSheetData(value: unknown): value is SheetData {
  return typeof value === 'object' && value !== null && ('values' in value || 'range' in value);
}

/**
 * Type guard for GridRange
 */
export function isGridRange(value: unknown): value is GridRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('sheetId' in value ||
      'startRowIndex' in value ||
      'endRowIndex' in value ||
      'startColumnIndex' in value ||
      'endColumnIndex' in value)
  );
}

/**
 * Safe type cast for Google API responses
 */
export function asGoogleResponse<T>(response: unknown): GoogleSheetsResponse<T> {
  return response as GoogleSheetsResponse<T>;
}
