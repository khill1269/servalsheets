/**
 * ServalSheets - Handler Index
 *
 * Lazy-loading handler factory for faster initialization
 */

// Re-export base types
export * from './base.js';

// Re-export handler types for backwards compatibility
export type { ValuesHandler } from './values.js';
export type { SpreadsheetHandler } from './spreadsheet.js';
export type { SheetHandler } from './sheet.js';
export type { CellsHandler } from './cells.js';
export type { FormatHandler } from './format.js';
export type { DimensionsHandler } from './dimensions.js';
export type { RulesHandler } from './rules.js';
export type { ChartsHandler } from './charts.js';
export type { PivotHandler } from './pivot.js';
export type { FilterSortHandler } from './filter-sort.js';
export type { SharingHandler } from './sharing.js';
export type { CommentsHandler } from './comments.js';
export type { VersionsHandler } from './versions.js';
export type { AnalysisHandler } from './analysis.js';
export type { AdvancedHandler } from './advanced.js';
export type { TransactionHandler } from './transaction.js';
export type { WorkflowHandler } from './workflow.js';
export type { InsightsHandler } from './insights.js';
export type { ValidationHandler } from './validation.js';
export type { PlanningHandler } from './planning.js';
export type { ConflictHandler } from './conflict.js';
export type { ImpactHandler } from './impact.js';
export type { HistoryHandler } from './history.js';

import type { sheets_v4, drive_v3 } from 'googleapis';
import type { HandlerContext } from './base.js';
import { HandlerLoadError } from '../core/errors.js';

export interface HandlerFactoryOptions {
  context: HandlerContext;
  sheetsApi: sheets_v4.Sheets;
  driveApi: drive_v3.Drive;
}

// Define handler types for TypeScript
export interface Handlers {
  values: import('./values.js').ValuesHandler;
  spreadsheet: import('./spreadsheet.js').SpreadsheetHandler;
  sheet: import('./sheet.js').SheetHandler;
  cells: import('./cells.js').CellsHandler;
  format: import('./format.js').FormatHandler;
  dimensions: import('./dimensions.js').DimensionsHandler;
  rules: import('./rules.js').RulesHandler;
  charts: import('./charts.js').ChartsHandler;
  pivot: import('./pivot.js').PivotHandler;
  filterSort: import('./filter-sort.js').FilterSortHandler;
  sharing: import('./sharing.js').SharingHandler;
  comments: import('./comments.js').CommentsHandler;
  versions: import('./versions.js').VersionsHandler;
  analysis: import('./analysis.js').AnalysisHandler;
  advanced: import('./advanced.js').AdvancedHandler;
  transaction: import('./transaction.js').TransactionHandler;
  workflow: import('./workflow.js').WorkflowHandler;
  insights: import('./insights.js').InsightsHandler;
  validation: import('./validation.js').ValidationHandler;
  planning: import('./planning.js').PlanningHandler;
  conflict: import('./conflict.js').ConflictHandler;
  impact: import('./impact.js').ImpactHandler;
  history: import('./history.js').HistoryHandler;
}

/**
 * Lazy-loading handler factory
 * Handlers are only imported and instantiated when first accessed
 * Provides ~30% faster initialization for typical usage
 */
export function createHandlers(options: HandlerFactoryOptions): Handlers {
  const cache = {} as Partial<Handlers>;

  const loaders = {
    async values() {
      const { ValuesHandler } = await import('./values.js');
      return new ValuesHandler(options.context, options.sheetsApi);
    },
    async spreadsheet() {
      const { SpreadsheetHandler } = await import('./spreadsheet.js');
      return new SpreadsheetHandler(options.context, options.sheetsApi, options.driveApi);
    },
    async sheet() {
      const { SheetHandler } = await import('./sheet.js');
      return new SheetHandler(options.context, options.sheetsApi);
    },
    async cells() {
      const { CellsHandler } = await import('./cells.js');
      return new CellsHandler(options.context, options.sheetsApi);
    },
    async format() {
      const { FormatHandler } = await import('./format.js');
      return new FormatHandler(options.context, options.sheetsApi);
    },
    async dimensions() {
      const { DimensionsHandler } = await import('./dimensions.js');
      return new DimensionsHandler(options.context, options.sheetsApi);
    },
    async rules() {
      const { RulesHandler } = await import('./rules.js');
      return new RulesHandler(options.context, options.sheetsApi);
    },
    async charts() {
      const { ChartsHandler } = await import('./charts.js');
      return new ChartsHandler(options.context, options.sheetsApi);
    },
    async pivot() {
      const { PivotHandler } = await import('./pivot.js');
      return new PivotHandler(options.context, options.sheetsApi);
    },
    async filterSort() {
      const { FilterSortHandler } = await import('./filter-sort.js');
      return new FilterSortHandler(options.context, options.sheetsApi);
    },
    async sharing() {
      const { SharingHandler } = await import('./sharing.js');
      return new SharingHandler(options.context, options.driveApi);
    },
    async comments() {
      const { CommentsHandler } = await import('./comments.js');
      return new CommentsHandler(options.context, options.driveApi);
    },
    async versions() {
      const { VersionsHandler } = await import('./versions.js');
      return new VersionsHandler(options.context, options.driveApi);
    },
    async analysis() {
      const { AnalysisHandler } = await import('./analysis.js');
      return new AnalysisHandler(options.context, options.sheetsApi);
    },
    async advanced() {
      const { AdvancedHandler } = await import('./advanced.js');
      return new AdvancedHandler(options.context, options.sheetsApi);
    },
    async transaction() {
      const { TransactionHandler } = await import('./transaction.js');
      return new TransactionHandler();
    },
    async workflow() {
      const { WorkflowHandler } = await import('./workflow.js');
      return new WorkflowHandler();
    },
    async insights() {
      const { InsightsHandler } = await import('./insights.js');
      return new InsightsHandler();
    },
    async validation() {
      const { ValidationHandler } = await import('./validation.js');
      return new ValidationHandler();
    },
    async planning() {
      const { PlanningHandler } = await import('./planning.js');
      return new PlanningHandler();
    },
    async conflict() {
      const { ConflictHandler } = await import('./conflict.js');
      return new ConflictHandler();
    },
    async impact() {
      const { ImpactHandler } = await import('./impact.js');
      return new ImpactHandler();
    },
    async history() {
      const { HistoryHandler } = await import('./history.js');
      return new HistoryHandler();
    },
  };

  return new Proxy({} as Handlers, {
    get(_, prop: string) {
      // Return cached handler if available
      if (cache[prop as keyof Handlers]) {
        return cache[prop as keyof Handlers];
      }

      // Check if loader exists for this handler
      const loader = loaders[prop as keyof typeof loaders];
      if (!loader) {
        throw new HandlerLoadError(
          `Unknown handler: ${prop}`,
          prop as string,
          { availableHandlers: Object.keys(loaders) }
        );
      }

      // Return a proxy that loads the handler on first method call
      return new Proxy({}, {
        get(_, methodProp: string) {
          return async (...args: unknown[]) => {
            // Lazy load and cache the handler
            if (!cache[prop as keyof Handlers]) {
              (cache as Record<string, unknown>)[prop as string] = await loader();
            }
            const handler = cache[prop as keyof Handlers]!;
            const method = (handler as unknown as Record<string, unknown>)[methodProp];
            if (typeof method !== 'function') {
              throw new HandlerLoadError(
                `Method ${methodProp} not found on handler ${prop}`,
                prop as string,
                { method: methodProp as string }
              );
            }
            return method.apply(handler, args);
          };
        },
      });
    },
  });
}
