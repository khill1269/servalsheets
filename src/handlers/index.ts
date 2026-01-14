/**
 * ServalSheets - Handler Index
 *
 * Lazy-loading handler factory for faster initialization.
 *
 * Architectural Notes (MCP 2025-11-25):
 * - Claude (LLM) does planning and orchestration
 * - sheets_confirm uses Elicitation (SEP-1036) for user confirmation
 * - sheets_analyze uses Sampling (SEP-1577) for AI analysis
 * - Removed: planning, insights (anti-patterns that duplicated LLM capabilities)
 */

// Re-export base types
export * from './base.js';

// Re-export optimization utilities (Phase 2)
export * from './optimization.js';
export * from './values-optimized.js';
export { OptimizedBaseHandler } from './base-optimized.js';

// Re-export handler types for backwards compatibility
export type { SheetsDataHandler } from './data.js';
export type { FormatHandler } from './format.js';
export type { DimensionsHandler } from './dimensions.js';
export type { AnalysisHandler } from './analysis.js';
export type { AdvancedHandler } from './advanced.js';
export type { TransactionHandler } from './transaction.js';
export type { QualityHandler } from './quality.js';
export type { HistoryHandler } from './history.js';
// MCP-native handlers (Elicitation & Sampling)
export type { ConfirmHandler } from './confirm.js';
export type { AnalyzeHandler } from './analyze.js';
export type { CompositeHandler } from './composite.js';
// Session context handler for NL excellence
export type { SessionHandler } from './session.js';
// Wave 1 consolidated handlers
export type { SheetsCoreHandler } from './core.js';
export type { VisualizeHandler } from './visualize.js';
export type { CollaborateHandler } from './collaborate.js';

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
  data: import('./data.js').SheetsDataHandler;
  format: import('./format.js').FormatHandler;
  dimensions: import('./dimensions.js').DimensionsHandler;
  analysis: import('./analysis.js').AnalysisHandler;
  advanced: import('./advanced.js').AdvancedHandler;
  transaction: import('./transaction.js').TransactionHandler;
  quality: import('./quality.js').QualityHandler;
  history: import('./history.js').HistoryHandler;
  // MCP-native handlers (Elicitation & Sampling)
  confirm: import('./confirm.js').ConfirmHandler;
  analyze: import('./analyze.js').AnalyzeHandler;
  fix: import('./fix.js').FixHandler;
  // Composite operations handler
  composite: import('./composite.js').CompositeHandler;
  // Session context handler for NL excellence
  session: import('./session.js').SessionHandler;
  // Wave 1 consolidated handlers
  core: import('./core.js').SheetsCoreHandler;
  visualize: import('./visualize.js').VisualizeHandler;
  collaborate: import('./collaborate.js').CollaborateHandler;
}

/**
 * Lazy-loading handler factory
 * Handlers are only imported and instantiated when first accessed
 * Provides ~30% faster initialization for typical usage
 */
export function createHandlers(options: HandlerFactoryOptions): Handlers {
  const cache = {} as Partial<Handlers>;

  const loaders = {
    async data() {
      const { SheetsDataHandler } = await import('./data.js');
      return new SheetsDataHandler(options.context, options.sheetsApi);
    },
    async format() {
      const { FormatHandler } = await import('./format.js');
      return new FormatHandler(options.context, options.sheetsApi);
    },
    async dimensions() {
      const { DimensionsHandler } = await import('./dimensions.js');
      return new DimensionsHandler(options.context, options.sheetsApi);
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
    async quality() {
      const { QualityHandler } = await import('./quality.js');
      return new QualityHandler();
    },
    async history() {
      const { HistoryHandler } = await import('./history.js');
      return new HistoryHandler({
        snapshotService: options.context.snapshotService,
      });
    },
    // New MCP-native handlers
    async confirm() {
      const { ConfirmHandler } = await import('./confirm.js');
      return new ConfirmHandler({ context: options.context });
    },
    async analyze() {
      const { AnalyzeHandler } = await import('./analyze.js');
      return new AnalyzeHandler(options.context, options.sheetsApi);
    },
    async fix() {
      const { FixHandler } = await import('./fix.js');
      return new FixHandler(options.context, options.sheetsApi);
    },
    async composite() {
      const { CompositeHandler } = await import('./composite.js');
      return new CompositeHandler(options.context, options.sheetsApi);
    },
    async session() {
      const { SessionHandler } = await import('./session.js');
      return new SessionHandler();
    },
    // Wave 1 consolidated handlers
    async core() {
      const { SheetsCoreHandler } = await import('./core.js');
      return new SheetsCoreHandler(options.context, options.sheetsApi, options.driveApi);
    },
    async visualize() {
      const { VisualizeHandler } = await import('./visualize.js');
      return new VisualizeHandler(options.context, options.sheetsApi);
    },
    async collaborate() {
      const { CollaborateHandler } = await import('./collaborate.js');
      return new CollaborateHandler(options.context, options.driveApi);
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
        throw new HandlerLoadError(`Unknown handler: ${prop}`, prop as string, {
          availableHandlers: Object.keys(loaders),
        });
      }

      // Return a proxy that loads the handler on first method call
      return new Proxy(
        {},
        {
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
        }
      );
    },
  });
}
