import { logger } from '../../utils/logger.js';
import { getEffectiveToolMode } from '../../config/constants.js';
import { COMPOUND_TOOL_NAMES, routeFlatToolCall } from './flat-tool-routing.js';
import { handleDiscover, DiscoverInputSchema } from './flat-discover-handler.js';
import {
  handleListAllTools,
  ListAllToolsInputSchema,
} from './flat-list-all-tools-handler.js';

/**
 * Flat Tool Call Interceptor
 *
 * Intercepts MCP tools/call requests to support three invocation forms:
 *   1. Compound (canonical):      { name: 'sheets_data',       arguments: { action: 'read', ... } }
 *   2. Flat full-path tool name:  { name: 'sheets_data_read',  arguments: { ... } }
 *   3. Short alias:               { name: 'data',              arguments: { action: 'read', ... } }
 *
 * Form (2) is the form advertised by `buildFlatToolListEntries` in tools-list-compat.ts
 * when SERVAL_TOOL_MODE=flat, so we MUST dispatch it back to the compound handler via
 * `routeFlatToolCall` — previously this was not wired and caused 19 "handler is not a
 * function" errors across sheets_data_write / sheets_composite_setup_sheet / etc.
 *
 * Wired by wrapping the existing tools/call handler in _requestHandlers so resolution
 * happens before the McpServer's internal tool dispatch.
 */

// Maps short-form aliases (like `data`, `bq`, `viz`) → canonical compound names.
// These are NOT in the flat-tool registry because they have no action suffix.
const SHORT_ALIAS_TO_COMPOUND: Record<string, string> = {
  advanced: 'sheets_advanced',
  agent: 'sheets_agent',
  analyze: 'sheets_analyze',
  appsscript: 'sheets_appsscript',
  script: 'sheets_appsscript',
  auth: 'sheets_auth',
  bigquery: 'sheets_bigquery',
  bq: 'sheets_bigquery',
  collaborate: 'sheets_collaborate',
  collab: 'sheets_collaborate',
  composite: 'sheets_composite',
  compute: 'sheets_compute',
  confirm: 'sheets_confirm',
  connectors: 'sheets_connectors',
  connector: 'sheets_connectors', // common singular typo (see log: sheets_connector_list_connectors)
  core: 'sheets_core',
  data: 'sheets_data',
  dependencies: 'sheets_dependencies',
  deps: 'sheets_dependencies',
  dimensions: 'sheets_dimensions',
  dim: 'sheets_dimensions',
  federation: 'sheets_federation',
  fix: 'sheets_fix',
  format: 'sheets_format',
  history: 'sheets_history',
  quality: 'sheets_quality',
  session: 'sheets_session',
  templates: 'sheets_templates',
  template: 'sheets_templates',
  transaction: 'sheets_transaction',
  tx: 'sheets_transaction',
  visualize: 'sheets_visualize',
  viz: 'sheets_visualize',
  webhook: 'sheets_webhook',
};

function resolveShortAlias(name: string): string | null {
  return SHORT_ALIAS_TO_COMPOUND[name] ?? null;
}

/**
 * Register the flat tool call interceptor by wrapping the existing tools/call handler
 * stored in the MCP SDK's internal _requestHandlers map.
 *
 * Must be called AFTER all tools are registered so the canonical handler is in place.
 */
export function registerFlatToolCallInterceptor(mcpServer: {
  server?: {
    _requestHandlers?: Map<string, (req: unknown, extra: unknown) => unknown>;
  };
}): boolean {
  if (getEffectiveToolMode() !== 'flat') {
    logger.debug('[FlatToolInterceptor] Skipped — bundled tool mode active');
    return false;
  }

  const handlers = mcpServer.server?._requestHandlers;
  if (!handlers) {
    throw new Error(
      '[FlatToolInterceptor] Cannot register flat tools/call routing: MCP SDK _requestHandlers map is not accessible'
    );
  }

  const original = handlers.get('tools/call');
  if (!original) {
    throw new Error(
      '[FlatToolInterceptor] Cannot register flat tools/call routing: MCP SDK tools/call handler is not registered'
    );
  }

  handlers.set('tools/call', (request: unknown, extra: unknown) => {
    const req = request as {
      params?: { name?: string; arguments?: Record<string, unknown> };
    };
    const name = req?.params?.name;

    if (typeof name === 'string' && req.params) {
      // Special case: sheets_discover is advertised by tools-list-compat.ts
      // (buildDiscoverToolEntry) but not registered as an SDK tool, so the
      // SDK's tools/call dispatcher would 404 it. Dispatch directly here.
      if (name === 'sheets_discover') {
        // Trust-boundary validation: untrusted JSON-RPC args parsed through
        // Zod schema before any handler use (audit OWASP A03 mitigation).
        const parsed = DiscoverInputSchema.safeParse(req.params.arguments ?? {});
        if (!parsed.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: {
                      code: 'INVALID_INPUT',
                      message: 'sheets_discover input failed schema validation',
                      issues: parsed.error.issues.map((i) => ({
                        path: i.path.join('.'),
                        message: i.message,
                      })),
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
        try {
          const result = handleDiscover(parsed.data);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            structuredContent: result as unknown as Record<string, unknown>,
          };
        } catch (error) {
          logger.error('[FlatToolInterceptor] sheets_discover dispatch failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: {
                      code: 'INTERNAL_ERROR',
                      message: error instanceof Error ? error.message : 'sheets_discover failed',
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      // Special case: sheets_list_all_tools (P-2 audit fix). Same pattern as
      // sheets_discover — advertised by tools-list-compat.ts but not registered
      // as an SDK tool, so dispatch directly. Returns the full ~409-action
      // registry in one call for clients whose ListTools/tool_search truncates.
      if (name === 'sheets_list_all_tools') {
        // Trust-boundary validation (audit OWASP A03 mitigation).
        const parsed = ListAllToolsInputSchema.safeParse(req.params.arguments ?? {});
        if (!parsed.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: {
                      code: 'INVALID_INPUT',
                      message: 'sheets_list_all_tools input failed schema validation',
                      issues: parsed.error.issues.map((i) => ({
                        path: i.path.join('.'),
                        message: i.message,
                      })),
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
        try {
          const result = handleListAllTools(parsed.data);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            structuredContent: result as unknown as Record<string, unknown>,
          };
        } catch (error) {
          logger.error('[FlatToolInterceptor] sheets_list_all_tools dispatch failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: {
                      code: 'INTERNAL_ERROR',
                      message:
                        error instanceof Error ? error.message : 'sheets_list_all_tools failed',
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      // Fast path: compound name — no rewrite needed.
      if (!COMPOUND_TOOL_NAMES.has(name)) {
        // Branch 1: sheets_<domain>_<action> — full flat name advertised by flat mode.
        if (name.startsWith('sheets_')) {
          // Trust boundary: req.params.arguments is untrusted JSON-RPC input.
          // routeFlatToolCall() converts the flat tool call into a compound
          // (tool, action) pair + normalized args. The args are validated
          // downstream by the per-tool Zod schemas in
          // src/mcp/registration/tool-handlers.ts (Sheets*InputSchema) before
          // any handler sees them — see schema-helpers.ts wrapInputSchemaForLegacyRequest.
          // SDK's tool-call dispatcher applies the validating schema; this
          // function only routes, never executes.
          const args = (req.params.arguments ?? {}) as Record<string, unknown>;
          const routed = routeFlatToolCall(name, args);
          if (routed) {
            logger.debug('[FlatToolInterceptor] Resolved flat tool name', {
              from: name,
              to: routed.compoundToolName,
              action: routed.normalizedArgs['action'],
            });
            // Mutating req.params here re-enters the SDK dispatcher, which
            // then runs the compound tool's input schema (Zod safeParse) on
            // the new arguments before invoking the handler.
            req.params.name = routed.compoundToolName;
            req.params.arguments = routed.normalizedArgs;
          } else {
            // Known prefix, unknown action — loud structured error instead of
            // a naked "handler is not a function" TypeError from the SDK.
            logger.error('[FlatToolInterceptor] Unroutable flat tool name', {
              name,
              code: 'FLAT_ROUTE_MISS',
              hint: 'Name starts with sheets_ but is not a compound tool and not in the flat registry. Run npm run schema:commit to regenerate the registry if a new action was recently added.',
            });
          }
        }
        // Branch 2: short alias (e.g. `data`, `viz`).
        else {
          const canonical = resolveShortAlias(name);
          if (canonical) {
            logger.debug('[FlatToolInterceptor] Resolved short alias', {
              from: name,
              to: canonical,
            });
            req.params.name = canonical;
          }
        }
      }
    }

    return original(request, extra);
  });

  logger.debug('[FlatToolInterceptor] Registered — wrapping tools/call handler');
  return true;
}

// Kept for any external callers that use the factory form.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFlatToolCallInterceptor(_toolHandlers: Map<string, any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: any) => {
    if (request.method === 'tools/call') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { params } = request as any;
      const name = params?.name as string | undefined;
      if (name && !COMPOUND_TOOL_NAMES.has(name)) {
        if (name.startsWith('sheets_')) {
          const args = (params.arguments ?? {}) as Record<string, unknown>;
          const routed = routeFlatToolCall(name, args);
          if (routed) {
            params.name = routed.compoundToolName;
            params.arguments = routed.normalizedArgs;
          }
        } else {
          const canonical = resolveShortAlias(name);
          if (canonical) params.name = canonical;
        }
      }
    }
    return request;
  };
}
