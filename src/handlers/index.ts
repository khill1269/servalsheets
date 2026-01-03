/**
 * ServalSheets - Handler Index
 */

export * from './base.js';
export * from './values.js';
export * from './spreadsheet.js';
export * from './sheet.js';
export * from './cells.js';
export * from './format.js';
export * from './dimensions.js';
export * from './rules.js';
export * from './charts.js';
export * from './pivot.js';
export * from './filter-sort.js';
export * from './sharing.js';
export * from './comments.js';
export * from './versions.js';
export * from './analysis.js';
export * from './advanced.js';

import type { sheets_v4, drive_v3 } from 'googleapis';
import type { HandlerContext } from './base.js';
import { ValuesHandler } from './values.js';
import { SpreadsheetHandler } from './spreadsheet.js';
import { SheetHandler } from './sheet.js';
import { CellsHandler } from './cells.js';
import { FormatHandler } from './format.js';
import { DimensionsHandler } from './dimensions.js';
import { RulesHandler } from './rules.js';
import { ChartsHandler } from './charts.js';
import { PivotHandler } from './pivot.js';
import { FilterSortHandler } from './filter-sort.js';
import { SharingHandler } from './sharing.js';
import { CommentsHandler } from './comments.js';
import { VersionsHandler } from './versions.js';
import { AnalysisHandler } from './analysis.js';
import { AdvancedHandler } from './advanced.js';

export interface HandlerFactoryOptions {
  context: HandlerContext;
  sheetsApi: sheets_v4.Sheets;
  driveApi: drive_v3.Drive;
}

export function createHandlers(options: HandlerFactoryOptions) {
  return {
    values: new ValuesHandler(options.context, options.sheetsApi),
    spreadsheet: new SpreadsheetHandler(options.context, options.sheetsApi, options.driveApi),
    sheet: new SheetHandler(options.context, options.sheetsApi),
    cells: new CellsHandler(options.context, options.sheetsApi),
    format: new FormatHandler(options.context, options.sheetsApi),
    dimensions: new DimensionsHandler(options.context, options.sheetsApi),
    rules: new RulesHandler(options.context, options.sheetsApi),
    charts: new ChartsHandler(options.context, options.sheetsApi),
    pivot: new PivotHandler(options.context, options.sheetsApi),
    filterSort: new FilterSortHandler(options.context, options.sheetsApi),
    sharing: new SharingHandler(options.context, options.driveApi),
    comments: new CommentsHandler(options.context, options.driveApi),
    versions: new VersionsHandler(options.context, options.driveApi),
    analysis: new AnalysisHandler(options.context, options.sheetsApi),
    advanced: new AdvancedHandler(options.context, options.sheetsApi),
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
