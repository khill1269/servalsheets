/**
 * ServalSheets - tools/list Compatibility Handler
 *
 * Overrides the MCP SDK tools/list handler to safely convert Zod v4 schemas
 * (including transforms/pipes) into JSON Schema without throwing.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from '../../lib/schema.js';
import { DEFER_SCHEMAS, TOOLS_LIST_COMPACT } from '../../config/constants.js';
import { discoverActions } from '../../services/action-discovery.js';

/**
 * SEP-1821 (draft) Dynamic Tool Discovery — extends the SDK's
 * ListToolsRequestSchema with an optional `query?: string` on `params`. The
 * stock SDK schema is built from `z.object()` which strips unknown fields, so
 * we pass this extended variant to `setRequestHandler` to preserve the field
 * across validation. Empty/missing query reproduces the pre-SEP-1821 behavior
 * (no filtering, full bundled tool set returned).
 */
const ListToolsRequestSchemaWithQuery = ListToolsRequestSchema.extend({
  params: ListToolsRequestSchema.shape.params
    .unwrap()
    .extend({
      query: z.string().min(1).max(500).optional(),
    })
    .optional(),
});

/**
 * Cap on how many tool names a single SEP-1821 `query` can surface in one
 * `tools/list` response. The underlying `discoverActions()` returns
 * ranked action-level matches; we collapse them up to MAX_QUERY_MATCHED_TOOLS
 * unique tools so the response stays bounded even on broad queries.
 */
const MAX_QUERY_MATCHED_TOOLS = 25;
import { getEnv } from '../../config/env.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from '../features-2025-11-25.js';
import { logger } from '../../utils/logger.js';
import { isZodSchemaLike, zodSchemaToJsonSchema } from '../../utils/schema-compat.js';
import { getSessionContext } from '../../services/session-context.js';
import { ACTION_COUNTS } from '../../schemas/action-counts.js';
import { TOOL_ACTIONS } from '../../schemas/index.js';
import { getRbacManager } from '../../services/rbac-manager.js';
import { getAvailableToolNames } from '../tool-registry-state.js';
import {
  filterAvailableActions,
  getToolAvailabilityMetadata,
  isToolFullyUnavailable,
} from '../tool-availability.js';
import {
  prepareSchemaForRegistrationCached,
  buildDeferredFallbackSchema,
} from './schema-helpers.js';
import { getToolDiscoveryHint, getActionCostEstimates } from './tool-discovery-hints.js';
import { ACTIVE_TOOL_DEFINITIONS } from './tool-definitions.js';
import { getToolSurfaceMetadata } from '../tool-surface-metadata.js';
import { getOutputSchemaForTool, clearOutputSchemaCache } from './output-schema-registry.js';

const EMPTY_OBJECT_JSON_SCHEMA = { type: 'object', properties: {} };
// Large enough to fit all current and near-future flat tools (409 actions + discover + headroom).
// MCP clients that don't follow nextCursor would only see page 1; raising this limit ensures
// the full tool surface is returned in a single response when no cursor is provided.
const ACTIVE_TOOL_DEFINITION_MAP = new Map(
  ACTIVE_TOOL_DEFINITIONS.map((tool) => [tool.name, tool] as const)
);

function getToolActionCount(toolName: string): number {
  return ACTION_COUNTS[toolName] ?? 0;
}

interface ToolsListRequestExtra {
  sessionId?: string;
  principalId?: string;
  authenticated?: boolean;
  headers?: Record<string, string | string[] | undefined>;
}

interface RequestAwareAccessFilter {
  hiddenTools: Set<string>;
  allowedActionsByTool: Map<string, ReadonlySet<string>>;
  accessMetadataByTool: Map<string, Record<string, unknown>>;
}

function toJsonSchema(
  schema: unknown,
  options?: { toolName?: string; schemaType?: 'input' | 'output' }
): Record<string, unknown> {
  if (!schema) {
    return EMPTY_OBJECT_JSON_SCHEMA;
  }

  const { toolName, schemaType = 'input' } = options ?? {};
  const schemaForSerialization =
    toolName && isZodSchemaLike(schema)
      ? prepareSchemaForRegistrationCached(toolName, schema as z.ZodType, schemaType)
      : schema;

  let result: Record<string, unknown>;
  if (isZodSchemaLike(schemaForSerialization)) {
    try {
      result = zodSchemaToJsonSchema(schemaForSerialization as unknown as import('zod').ZodTypeAny);
    } catch (err) {
      // Full conversion failed — try deferred fallback before giving up.
      // If fallback also fails, surface the error instead of silently dropping
      // the tool from tools/list. CI/runtime validation should catch this.
      if (toolName) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('Full schema conversion failed, trying deferred fallback', {
          tool: toolName,
          error: msg,
        });

        try {
          const fallback = buildDeferredFallbackSchema(schema as z.ZodType, schemaType ?? 'input');
          if (fallback && typeof fallback === 'object' && Object.keys(fallback).length > 0) {
            return fallback;
          }
        } catch (fallbackErr) {
          logger.error('Deferred fallback also failed', {
            tool: toolName,
            error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
          });
        }
        throw new Error(
          `Failed to convert ${schemaType} schema for ${toolName} to JSON Schema: ${msg}`,
          { cause: err }
        );
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  } else if (typeof schemaForSerialization === 'object') {
    result = schemaForSerialization as Record<string, unknown>;
  } else {
    return EMPTY_OBJECT_JSON_SCHEMA;
  }

  // MCP spec requires inputSchema MUST be type: 'object'.
  // Discriminated unions produce { anyOf: [...] } without type — wrap them.
  if (result && !('type' in result)) {
    return { type: 'object', ...result };
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getSingleHeaderValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  headerName: string
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const raw = headers[headerName];
  if (Array.isArray(raw)) {
    return raw[0];
  }

  return raw;
}

function parseBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return undefined; // OK: input is not a recognized boolean string
}

function resolveAuthenticatedFlag(extra?: ToolsListRequestExtra): boolean | undefined {
  const direct = parseBooleanFlag(extra?.authenticated);
  if (direct !== undefined) {
    return direct;
  }

  return (
    parseBooleanFlag(getSingleHeaderValue(extra?.headers, 'x-serval-authenticated')) ??
    parseBooleanFlag(getSingleHeaderValue(extra?.headers, 'x-google-authenticated'))
  );
}

function resolvePrincipalId(extra?: ToolsListRequestExtra): string | undefined {
  if (typeof extra?.principalId === 'string' && extra.principalId.trim().length > 0) {
    return extra.principalId.trim();
  }

  const candidateHeaders = ['x-user-id', 'x-session-id', 'x-client-id'] as const;
  for (const header of candidateHeaders) {
    const value = getSingleHeaderValue(extra?.headers, header)?.trim();
    if (value) {
      return value;
    }
  }

  return undefined; // OK: no principal ID found in extra params or headers
}

function mergeAccessMetadata(
  accessMetadataByTool: Map<string, Record<string, unknown>>,
  toolName: string,
  update: Record<string, unknown>
): void {
  const existing = accessMetadataByTool.get(toolName) ?? {};
  accessMetadataByTool.set(toolName, {
    ...existing,
    ...update,
  });
}

function mergeDescription(existing: unknown, addition: string | undefined): string | undefined {
  if (!addition) {
    return typeof existing === 'string' ? existing : undefined;
  }

  if (typeof existing !== 'string' || existing.trim().length === 0) {
    return addition;
  }

  if (existing.includes(addition)) {
    return existing;
  }

  return `${existing} ${addition}`;
}

// Description cache: keyed by `${toolName}:${familiarityBucket}:${availabilitySuffix ?? ''}`
// Cleared when session context changes significantly (new spreadsheet, preference update)
const _descriptionCache = new Map<string, string | undefined>();
const DESCRIPTION_CACHE_MAX = 200;

/** Clear description cache (called on session context changes) */
export function clearToolDescriptionCache(): void {
  _descriptionCache.clear();
}

function enrichToolDescription(toolName: string, description: unknown): string | undefined {
  const existing = typeof description === 'string' ? description : undefined;
  const availability = getToolAvailabilityMetadata(toolName);
  const availabilityReason =
    typeof availability?.['reason'] === 'string' ? availability['reason'] : undefined;
  const availabilitySuffix =
    toolName === 'sheets_webhook' && availabilityReason
      ? 'Redis is not configured in this server process. Redis-backed webhook actions are currently unavailable; watch_changes and workspace subscription actions remain available.'
      : toolName === 'sheets_appsscript' && availabilityReason
        ? 'Apps Script trigger compatibility actions are hidden by default because external Apps Script REST clients cannot manage triggers. Use update_content plus deploy with ScriptApp trigger code instead.'
        : undefined;

  if (!DEFER_SCHEMAS) {
    return mergeDescription(existing, availabilitySuffix);
  }

  // Adaptive descriptions: shorten for tools the LLM has used successfully 5+ times.
  // This saves ~100-200 tokens per familiar tool on subsequent tools/list calls.
  let sessionFamiliarity = 0;
  try {
    sessionFamiliarity = getSessionContext().getToolFamiliarityScore(toolName);
  } catch {
    // Session context may not be initialized during early registration
  }

  // Cache key: tool + familiarity bucket (0.0-0.79 = standard, 0.8+ = ultra-minimal)
  const familiarityBucket = sessionFamiliarity >= 0.8 ? 'minimal' : 'standard';
  const cacheKey = `${toolName}:${familiarityBucket}:${availabilitySuffix ?? ''}`;

  const cached = _descriptionCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let result: string | undefined;
  if (sessionFamiliarity >= 0.8) {
    // Ultra-minimal: tool name + action count only (LLM already knows how to use it)
    const actionCount = getToolActionCount(toolName);
    const ultraMinimal = `${toolName.replace('sheets_', '').toUpperCase()} (${actionCount} actions)`;
    result = mergeDescription(ultraMinimal, availabilitySuffix);
  } else {
    const hint = getToolDiscoveryHint(toolName);
    result = mergeDescription(
      mergeDescription(existing, hint?.descriptionSuffix),
      availabilitySuffix
    );
  }

  // Evict oldest if over limit
  if (_descriptionCache.size >= DESCRIPTION_CACHE_MAX) {
    const firstKey = _descriptionCache.keys().next().value;
    if (firstKey !== undefined) _descriptionCache.delete(firstKey);
  }
  _descriptionCache.set(cacheKey, result);

  return result;
}

function enrichInputSchema(
  toolName: string,
  inputSchema: Record<string, unknown>,
  options?: {
    allowedActions?: ReadonlySet<string>;
    accessMetadata?: Record<string, unknown>;
  }
): Record<string, unknown> {
  // Always inject x-servalsheets.actionParams hints regardless of schema mode.
  // In deferred mode (STDIO) these are the primary parameter guide.
  // In full-schema mode (HTTP) they supplement the JSON Schema with compact
  // per-action required/optional/enum summaries that are faster to scan.
  const hint = getToolDiscoveryHint(toolName);
  if (!hint) {
    return inputSchema;
  }

  const allowedActions =
    options?.allowedActions ??
    new Set(filterAvailableActions(toolName, Object.keys(hint.actionParams)));
  const actionParams = Object.fromEntries(
    Object.entries(hint.actionParams).filter(([action]) => allowedActions.has(action))
  );

  const costEstimates = getActionCostEstimates(toolName);
  const surfaceMetadata = getToolSurfaceMetadata(toolName, {
    authPolicy: ACTIVE_TOOL_DEFINITION_MAP.get(toolName)?.authPolicy,
    availability: getToolAvailabilityMetadata(toolName),
  });
  const enriched: Record<string, unknown> = {
    ...inputSchema,
    'x-servalsheets': {
      ...(asRecord(inputSchema['x-servalsheets']) ?? {}),
      actionParams,
      ...(surfaceMetadata.tier
        ? {
            tier: surfaceMetadata.tier,
            group: surfaceMetadata.group,
            primaryVerbs: surfaceMetadata.primaryVerbs,
          }
        : {}),
      ...(costEstimates ? { costEstimates } : {}),
      ...(surfaceMetadata.agencyHint ? { agencyHint: surfaceMetadata.agencyHint } : {}),
      ...(surfaceMetadata.requiredScopes ? { requiredScopes: surfaceMetadata.requiredScopes } : {}),
      ...(surfaceMetadata.availability ? { availability: surfaceMetadata.availability } : {}),
      authPolicy: surfaceMetadata.authPolicy,
      ...(options?.accessMetadata ? { access: options.accessMetadata } : {}),
    },
  };

  const properties = asRecord(inputSchema['properties']);
  if (!properties) {
    enriched['description'] = mergeDescription(inputSchema['description'], hint.requestDescription);
    return enriched;
  }

  const requestSchema = asRecord(properties['request']);
  if (!requestSchema) {
    enriched['description'] = mergeDescription(inputSchema['description'], hint.requestDescription);
    return enriched;
  }

  let finalRequestSchema: Record<string, unknown> = {
    ...requestSchema,
    description: mergeDescription(requestSchema['description'], hint.requestDescription),
  };

  finalRequestSchema = filterRequestSchemaActions(finalRequestSchema, allowedActions);

  enriched['properties'] = {
    ...properties,
    request: finalRequestSchema,
  };

  return enriched;
}

function filterRequestSchemaActions(
  requestSchema: Record<string, unknown>,
  allowedActions: ReadonlySet<string>
): Record<string, unknown> {
  let filtered: Record<string, unknown> = { ...requestSchema };

  for (const key of ['oneOf', 'anyOf'] as const) {
    const variants = Array.isArray(filtered[key]) ? filtered[key] : null;
    if (!variants) {
      continue;
    }

    filtered = {
      ...filtered,
      [key]: variants.filter((variant) => {
        const variantRecord = asRecord(variant);
        const action = (variantRecord?.['properties'] as Record<string, unknown> | undefined)?.[
          'action'
        ] as Record<string, unknown> | undefined;
        const actionName = action?.['const'] ?? (action?.['enum'] as unknown[])?.[0];
        return typeof actionName === 'string' ? allowedActions.has(actionName) : true;
      }),
    };
  }

  const properties = asRecord(filtered['properties']);
  const actionSchema = asRecord(properties?.['action']);
  if (!properties || !actionSchema) {
    return filtered;
  }

  const nextActionSchema: Record<string, unknown> = { ...actionSchema };
  if (Array.isArray(actionSchema['enum'])) {
    nextActionSchema['enum'] = (actionSchema['enum'] as unknown[]).filter(
      (value) => typeof value !== 'string' || allowedActions.has(value)
    );
  }

  filtered['properties'] = {
    ...properties,
    action: nextActionSchema,
  };

  return filtered;
}

async function buildRequestAwareAccessFilter(
  toolNames: readonly string[],
  extra?: ToolsListRequestExtra
): Promise<RequestAwareAccessFilter> {
  const hiddenTools = new Set<string>();
  const allowedActionsByTool = new Map<string, ReadonlySet<string>>();
  const accessMetadataByTool = new Map<string, Record<string, unknown>>();
  const authenticated = resolveAuthenticatedFlag(extra);

  for (const toolName of toolNames) {
    const toolDefinition = ACTIVE_TOOL_DEFINITION_MAP.get(toolName);
    const baseActions = filterAvailableActions(toolName, TOOL_ACTIONS[toolName] ?? []);
    if (baseActions.length === 0) {
      continue;
    }
    let allowedActions = new Set(baseActions);

    const surfaceMetadata = getToolSurfaceMetadata(toolName, {
      authPolicy: toolDefinition?.authPolicy,
      availability: getToolAvailabilityMetadata(toolName),
    });

    if (authenticated === false && surfaceMetadata.authPolicy.requiresAuth) {
      const authExemptActions = new Set(
        baseActions.filter((action) => surfaceMetadata.authPolicy.exemptActions.includes(action))
      );
      const hiddenActions = baseActions.filter((action) => !authExemptActions.has(action));

      if (hiddenActions.length > 0) {
        allowedActions = authExemptActions;
        mergeAccessMetadata(accessMetadataByTool, toolName, {
          authenticated: false,
          filteredBy: 'authentication',
          hiddenActions,
          reason: 'Authentication required for hidden actions',
        });
      }
    }

    if (allowedActions.size === 0) {
      hiddenTools.add(toolName);
      continue;
    }

    allowedActionsByTool.set(toolName, allowedActions);
  }

  const principalId = resolvePrincipalId(extra);
  if (principalId && Boolean(getEnv()['ENABLE_RBAC'])) {
    const rbacManager = getRbacManager();

    for (const toolName of toolNames) {
      if (hiddenTools.has(toolName)) {
        continue;
      }

      const currentActions = [...(allowedActionsByTool.get(toolName) ?? new Set<string>())];
      const allowedActions: string[] = [];
      const deniedActions: Array<{ action: string; reason: string }> = [];

      for (const action of currentActions) {
        const result = await rbacManager.checkPermission({
          userId: principalId,
          toolName,
          actionName: action,
        });

        if (result.allowed) {
          allowedActions.push(action);
        } else {
          deniedActions.push({
            action,
            reason: result.reason,
          });
        }
      }

      if (deniedActions.length > 0) {
        const existingAccess = accessMetadataByTool.get(toolName) ?? {};
        mergeAccessMetadata(accessMetadataByTool, toolName, {
          ...existingAccess,
          filteredBy:
            existingAccess['filteredBy'] === 'authentication' ? 'authentication+rbac' : 'rbac',
          principalId,
          deniedActions,
        });
      }

      if (allowedActions.length === 0) {
        hiddenTools.add(toolName);
        allowedActionsByTool.delete(toolName);
        continue;
      }

      allowedActionsByTool.set(toolName, new Set(allowedActions));
    }
  }

  return {
    hiddenTools,
    allowedActionsByTool,
    accessMetadataByTool,
  };
}

/**
 * Build flat tool entries for the tools/list response.
 *
 * Each flat tool has a simple z.object schema with just the action's parameters
 * (no discriminated union, no 'action' field, no 'request' envelope).
 *
 * Tools omitted from the current registration stage are still discoverable via
 * the SEP-1821 (draft) `query?: string` parameter on `tools/list`, or via the
 * `servalsheets_search` meta-tool (SEP-1888 progressive disclosure). Note: the
 * legacy `defer_loading: true` flag was removed in P23 (2026-05-12) — it was
 * never a valid MCP field; see `docs/development/CLAUDE_CODE_RULES.md` gotcha
 * #19 and `src/config/constants.ts:STAGE_*_TOOLS` for the current staging model.
 */

function getBundledToolsForList(): readonly (typeof ACTIVE_TOOL_DEFINITIONS)[number][] {
  const availableToolNames = new Set(
    getAvailableToolNames(ACTIVE_TOOL_DEFINITIONS.map((tool) => tool.name))
  );

  return ACTIVE_TOOL_DEFINITIONS.filter((tool) => availableToolNames.has(tool.name));
}

export function registerToolsListCompatibilityHandler(server: McpServer): void {
  const protocolServer = server.server as unknown as {
    setRequestHandler: typeof server.server.setRequestHandler;
  };

  protocolServer.setRequestHandler(
    ListToolsRequestSchemaWithQuery as unknown as typeof ListToolsRequestSchema,
    async (
      request: z.infer<typeof ListToolsRequestSchemaWithQuery>,
      extra?: ToolsListRequestExtra
    ) => {
      const bundledTools = getBundledToolsForList();
      const accessFilter = await buildRequestAwareAccessFilter(
        bundledTools.map((tool) => tool.name),
        extra
      );

      // ── SEP-1821 (draft) QUERY FILTERING ──────────────────────────────
      // If the client passed `params.query`, narrow the bundled-tool set to
      // tools whose actions match the natural-language query. The engine is
      // `discoverActions()` from src/services/action-discovery.ts, which
      // indexes all 411 actions across all 25 tools regardless of the
      // current registration stage. We then intersect with access-controls
      // below so unauthorized tools never leak through search.
      const rawQuery = request.params?.query;
      const query = typeof rawQuery === 'string' ? rawQuery.trim() : undefined;
      let queryAllowedTools: Set<string> | undefined;
      if (query && query.length > 0) {
        try {
          // Pull up to (MAX_QUERY_MATCHED_TOOLS * 3) action matches so we have
          // headroom after dedup to tool names; cap at the documented max.
          const matches = discoverActions(
            query,
            undefined,
            Math.min(10, MAX_QUERY_MATCHED_TOOLS * 3)
          );
          queryAllowedTools = new Set(matches.map((m) => m.tool));
          logger.debug('SEP-1821 tools/list query applied', {
            query,
            matchCount: matches.length,
            uniqueTools: queryAllowedTools.size,
          });
        } catch (err) {
          // Search failure should NOT break tools/list — fall back to the
          // full bundled surface and log for diagnostics.
          logger.warn('SEP-1821 query filtering failed; returning full surface', {
            query,
            error: err instanceof Error ? err.message : String(err),
          });
          queryAllowedTools = undefined;
        }
      }

      // ── BUNDLED MODE ──────────────────────────────────────────────────
      // Return 25 compound tools with discriminated union schemas
      return {
        tools: bundledTools
          .filter((tool) => {
            // Hide tools whose backing service is completely unavailable
            if (isToolFullyUnavailable(tool.name)) {
              logger.debug('Excluding tool from tools/list: backing service unavailable', {
                tool: tool.name,
              });
              return false;
            }
            if (accessFilter.hiddenTools.has(tool.name)) {
              logger.debug('Excluding tool from tools/list: request access filter', {
                tool: tool.name,
              });
              return false;
            }
            // SEP-1821 query filter — applied AFTER access control so the
            // query can never broaden the visible surface, only narrow it.
            if (queryAllowedTools && !queryAllowedTools.has(tool.name)) {
              return false;
            }
            return true;
          })
          .map((tool) => {
            const name = tool.name;
            const inputSchema = enrichInputSchema(
              name,
              toJsonSchema(tool.inputSchema, { toolName: name, schemaType: 'input' }),
              {
                allowedActions: accessFilter.allowedActionsByTool.get(name),
                accessMetadata: accessFilter.accessMetadataByTool.get(name),
              }
            );
            const toolDefinition: Record<string, unknown> = {
              name,
              title: tool.annotations.title ?? tool.title,
              description: enrichToolDescription(name, tool.description),
              inputSchema,
              annotations: tool.annotations,
            };

            // SEP-1576-aligned compaction (controlled by SERVAL_TOOLS_LIST_COMPACT,
            // auto-on for STDIO). Strips icons / outputSchema / execution from
            // tools/list when enabled — clients can still fetch them via
            // /.well-known/mcp.json and schema://tools/{name}.
            if (!TOOLS_LIST_COMPACT) {
              toolDefinition['icons'] = TOOL_ICONS[name];
              toolDefinition['execution'] = TOOL_EXECUTION_CONFIG[name];
            }

            // outputSchema: prefer tool-level, fall back to registry lookup.
            // Skipped entirely in compact mode.
            if (!TOOLS_LIST_COMPACT) {
              const resolvedOutputSchema = tool.outputSchema ?? getOutputSchemaForTool(name);
              if (resolvedOutputSchema) {
                toolDefinition['outputSchema'] = toJsonSchema(resolvedOutputSchema, {
                  toolName: name,
                  schemaType: 'output',
                });
              }
            }

            return toolDefinition;
          }),
        // MCP spec compliance: include nextCursor (undefined = no more pages)
        nextCursor: undefined,
      };
    }
  );
}

/**
 * Clear both output schema and description caches.
 * Call this when session context changes significantly (e.g., new spreadsheet selected).
 */
export function clearToolListCaches(): void {
  clearToolDescriptionCache();
  clearOutputSchemaCache();
}
