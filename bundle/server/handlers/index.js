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
import { HandlerLoadError } from '../core/errors.js';
/**
 * Lazy-loading handler factory
 * Handlers are only imported and instantiated when first accessed
 * Provides ~30% faster initialization for typical usage
 */
export function createHandlers(options) {
    const cache = {};
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
        // Tier 7 Enterprise handlers
        async templates() {
            const { SheetsTemplatesHandler } = await import('./templates.js');
            return new SheetsTemplatesHandler(options.context, options.sheetsApi, options.driveApi);
        },
        async bigquery() {
            const { SheetsBigQueryHandler } = await import('./bigquery.js');
            return new SheetsBigQueryHandler(options.context, options.sheetsApi, options.bigqueryApi);
        },
        async appsscript() {
            const { SheetsAppsScriptHandler } = await import('./appsscript.js');
            return new SheetsAppsScriptHandler(options.context);
        },
    };
    return new Proxy({}, {
        get(_, prop) {
            // Return cached handler if available
            if (cache[prop]) {
                return cache[prop];
            }
            // Check if loader exists for this handler
            const loader = loaders[prop];
            if (!loader) {
                throw new HandlerLoadError(`Unknown handler: ${prop}`, prop, {
                    availableHandlers: Object.keys(loaders),
                });
            }
            // Return a proxy that loads the handler on first method call
            return new Proxy({}, {
                get(_, methodProp) {
                    return async (...args) => {
                        // Lazy load and cache the handler
                        if (!cache[prop]) {
                            cache[prop] = await loader();
                        }
                        const handler = cache[prop];
                        const method = handler[methodProp];
                        if (typeof method !== 'function') {
                            throw new HandlerLoadError(`Method ${methodProp} not found on handler ${prop}`, prop, { method: methodProp });
                        }
                        return method.apply(handler, args);
                    };
                },
            });
        },
    });
}
//# sourceMappingURL=index.js.map