/**
 * ServalSheets - tools/list Compatibility Handler
 *
 * Overrides the MCP SDK tools/list handler to safely convert Zod v4 schemas
 * (including transforms/pipes) into JSON Schema without throwing.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from '../../lib/schema.js';
import { DEFER_SCHEMAS, getEffectiveToolMode } from '../../config/constants.js';
import { getEnv } from '../../config/env.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from '../features-2025-11-25.js';
import { logger } from '../../utils/logger.js';
import { zodSchemaToJsonSchema } from '../../utils/schema-compat.js';
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
import { getFlatToolRegistry, type FlatToolDefinition } from './flat-tool-registry.js';
import { ACTIVE_TOOL_DEFINITIONS } from './tool-definitions.js';
import { getToolSurfaceMetadata } from '../tool-surface-metadata.js';
import { getOutputSchemaForTool, clearOutputSchemaCache } from './output-schema-registry.js';

const EMPTY_OBJECT_JSON_SCHEMA = { type: 'object', properties: {} };
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

/**
 * Detect Zod schemas by their internal shape markers.
 *
 * `_def` is the private metadata property on all Zod v3 schemas.
 * `_zod` is the equivalent marker introduced in Zod v4.
 * Both are undocumented internals — if Zod releases a breaking change that
 * removes both markers, this check will return false and toJsonSchema() will
 * fall through to the EMPTY_OBJECT_JSON_SCHEMA fallback (safe degradation).
 *
 * If upgrading Zod and flat-tool schemas start rendering as {} for all tools,
 * this is the first place to check.
 */
function isZodSchema(schema: unknown): boolean {
  return Boolean(
    schema &&
    typeof schema === 'object' &&
    ('_def' in (schema as Record<string, unknown>) || '_zod' in (schema as Record<string, unknown>))
  );
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
    toolName && isZodSchema(schema)
      ? prepareSchemaForRegistrationCached(toolName, schema as z.ZodType, schemaType)
      : schema;

  let result: Record<string, unknown>;
  if (isZodSchema(schemaForSerialization)) {
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
          `Failed to convert ${schemaType} schema for ${toolName} to JSON Schema: ${msg}`
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
  if (principalId && getEnv().ENABLE_RBAC) {
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
 * Tools marked defer_loading: true are discoverable via tool_search but
 * not loaded into the LLM's initial context.
 */
/**
 * Per-action schemas for always-loaded tools.
 * These are the ~15 tools the LLM sees immediately — they need accurate schemas
 * so the LLM can call them without discovery. Keyed by "parentTool.action".
 *
 * Deferred tools get a minimal schema (just spreadsheetId) since they're only
 * loaded after discovery and the actual validation runs in the compound handler.
 */
const ALWAYS_LOADED_SCHEMAS: Record<string, Record<string, unknown>> = {
  'sheets_auth.status': {
    type: 'object',
    properties: {
      verbosity: { type: 'string', enum: ['minimal', 'standard', 'detailed'] },
    },
  },
  'sheets_auth.login': {
    type: 'object',
    properties: {
      scopes: { type: 'array', items: { type: 'string' }, description: 'OAuth scopes to request' },
      verbosity: { type: 'string', enum: ['minimal', 'standard', 'detailed'] },
    },
  },
  'sheets_auth.callback': {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'OAuth authorization code' },
      state: { type: 'string', description: 'OAuth state parameter' },
    },
    required: ['code'],
  },
  'sheets_session.get_context': {
    type: 'object',
    properties: {
      verbosity: { type: 'string', enum: ['minimal', 'standard', 'detailed'] },
    },
  },
  'sheets_session.set_active': {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'The spreadsheet to set as active' },
      title: { type: 'string', description: 'Display title for the spreadsheet' },
      sheetNames: { type: 'array', items: { type: 'string' }, description: 'Sheet names to track' },
    },
    required: ['spreadsheetId'],
  },
  'sheets_session.get_active': {
    type: 'object',
    properties: {
      verbosity: { type: 'string', enum: ['minimal', 'standard', 'detailed'] },
    },
  },
  'sheets_session.record_operation': {
    type: 'object',
    properties: {
      tool: { type: 'string', description: 'Tool that performed the operation' },
      toolAction: { type: 'string', description: 'Action that was performed' },
      spreadsheetId: { type: 'string', description: 'Target spreadsheet ID' },
      description: { type: 'string', description: 'Human-readable operation description' },
      undoable: { type: 'boolean', description: 'Whether the operation can be undone' },
      range: { type: 'string', description: 'A1 range affected' },
      snapshotId: { type: 'string', description: 'Pre-operation snapshot ID' },
      cellsAffected: { type: 'number', description: 'Number of cells affected' },
    },
    required: ['tool', 'toolAction', 'spreadsheetId', 'description'],
  },
  'sheets_session.update_preferences': {
    type: 'object',
    properties: {
      confirmationLevel: {
        type: 'string',
        enum: ['always', 'destructive', 'never'],
        description: 'When to ask for confirmation',
      },
      dryRunDefault: { type: 'boolean', description: 'Default dry-run mode for mutations' },
      snapshotDefault: { type: 'boolean', description: 'Default snapshot before mutations' },
      autoRecord: { type: 'boolean', description: 'Auto-record operations in session history' },
    },
  },
  'sheets_data.read': {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'The Google Sheets spreadsheet ID' },
      range: { type: 'string', description: 'A1 notation range (e.g., Sheet1!A1:D10)' },
      valueRenderOption: {
        type: 'string',
        enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
        description: 'How values should be rendered',
      },
      dateTimeRenderOption: { type: 'string', enum: ['SERIAL_NUMBER', 'FORMATTED_STRING'] },
      majorDimension: { type: 'string', enum: ['ROWS', 'COLUMNS'] },
      response_format: { type: 'string', enum: ['full', 'compact', 'preview'] },
    },
    required: ['spreadsheetId'],
  },
  'sheets_data.write': {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'The Google Sheets spreadsheet ID' },
      range: { type: 'string', description: 'A1 notation range (e.g., Sheet1!A1:D10)' },
      values: {
        type: 'array',
        items: { type: 'array' },
        description: 'Array of row arrays to write',
      },
      valueInputOption: {
        type: 'string',
        enum: ['RAW', 'USER_ENTERED'],
        description: 'How input values should be interpreted',
      },
      includeValuesInResponse: {
        type: 'boolean',
        description: 'Include written values in response',
      },
    },
    required: ['spreadsheetId', 'values'],
  },
  'sheets_data.append': {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'The Google Sheets spreadsheet ID' },
      range: { type: 'string', description: 'A1 notation range to append after (e.g., Sheet1!A1)' },
      values: {
        type: 'array',
        items: { type: 'array' },
        description: 'Array of row arrays to append',
      },
      valueInputOption: {
        type: 'string',
        enum: ['RAW', 'USER_ENTERED'],
        description: 'How input values should be interpreted',
      },
      insertDataOption: {
        type: 'string',
        enum: ['OVERWRITE', 'INSERT_ROWS'],
        description: 'How to insert data',
      },
    },
    required: ['spreadsheetId', 'values'],
  },
  'sheets_core.list': {
    type: 'object',
    properties: {
      maxResults: { type: 'number', description: 'Maximum spreadsheets to return (default 100)' },
      query: { type: 'string', description: 'Search query to filter spreadsheets' },
      orderBy: { type: 'string', enum: ['createdTime', 'modifiedTime', 'name', 'viewedByMeTime'] },
      pageToken: { type: 'string', description: 'Pagination token for next page' },
      response_format: { type: 'string', enum: ['full', 'compact', 'preview'] },
    },
  },
  'sheets_core.list_sheets': {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'The Google Sheets spreadsheet ID' },
      response_format: { type: 'string', enum: ['full', 'compact', 'preview'] },
    },
    required: ['spreadsheetId'],
  },
  'sheets_core.get': {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'The Google Sheets spreadsheet ID' },
      includeGridData: { type: 'boolean', description: 'Include cell data (requires ranges)' },
      ranges: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ranges to include grid data for',
      },
      response_format: { type: 'string', enum: ['full', 'compact', 'preview'] },
    },
    required: ['spreadsheetId'],
  },
  'sheets_core.create': {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title for the new spreadsheet' },
      locale: { type: 'string', description: 'Locale (e.g., en_US)' },
      timeZone: { type: 'string', description: 'Time zone (e.g., America/New_York)' },
    },
    required: ['title'],
  },
};

function buildFlatToolListEntries(
  accessFilter?: RequestAwareAccessFilter
): Record<string, unknown>[] {
  const flatTools = getFlatToolRegistry();

  return flatTools
    .filter((flat) => {
      if (accessFilter?.hiddenTools.has(flat.parentTool)) {
        return false;
      }

      const allowedActions = accessFilter?.allowedActionsByTool.get(flat.parentTool);
      return !allowedActions || allowedActions.has(flat.action);
    })
    .map((flat: FlatToolDefinition) => {
      const actionKey = `${flat.parentTool}.${flat.action}`;

      // Always-loaded tools get detailed per-action schemas
      const detailedSchema = ALWAYS_LOADED_SCHEMAS[actionKey];
      let inputSchema: Record<string, unknown>;

      if (detailedSchema) {
        inputSchema = detailedSchema;
      } else {
        // Deferred tools get a minimal schema — the LLM discovers them via
        // sheets_discover/tool_search, and actual validation runs in the compound handler.
        inputSchema = {
          type: 'object',
          properties: {
            spreadsheetId: {
              type: 'string',
              description: 'The Google Sheets spreadsheet ID',
            },
          },
        };

        // Add common fields based on the action's domain
        if (
          flat.parentTool === 'sheets_data' ||
          flat.parentTool === 'sheets_format' ||
          flat.parentTool === 'sheets_dimensions'
        ) {
          (inputSchema['properties'] as Record<string, unknown>)['range'] = {
            type: 'string',
            description: 'A1 notation range (e.g., Sheet1!A1:D10)',
          };
        }

        // For write-type actions, add values
        if (flat.action === 'write' || flat.action === 'append' || flat.action === 'batch_write') {
          (inputSchema['properties'] as Record<string, unknown>)['values'] = {
            type: 'array',
            description: 'Array of row arrays to write',
            items: { type: 'array' },
          };
        }
      }

      return {
        name: flat.name,
        title: flat.title,
        description: flat.description,
        inputSchema,
        annotations: flat.annotations,
        // Signal to Anthropic API that this tool should be deferred
        ...(flat.deferLoading ? { 'x-defer-loading': true } : {}),
      };
    });
}

/**
 * Build the sheets_discover meta-tool entry for flat mode.
 * This is always loaded and serves as the gateway to the full action surface.
 */
function buildDiscoverToolEntry(): Record<string, unknown> {
  return {
    name: 'sheets_discover',
    title: 'Discover ServalSheets Actions',
    description:
      'Search for the right ServalSheets tool by describing what you want to do. ' +
      'Returns the top matching tools with confidence scores. Use this when you are ' +
      'unsure which tool to call. Example queries: "sort by date", "add a chart", ' +
      '"share with someone", "undo last change".',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language description of what you want to do',
        },
        category: {
          type: 'string',
          enum: ['data', 'format', 'analysis', 'structure', 'collaboration', 'automation', 'all'],
          description: 'Optional category filter to narrow results',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results to return (1-10, default 5)',
        },
      },
      required: ['query'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  };
}

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
    ListToolsRequestSchema,
    async (_request: z.infer<typeof ListToolsRequestSchema>, extra?: ToolsListRequestExtra) => {
      // Accept cursor param per MCP 2025-11-25 spec (single-page response for ≤25 tools)
      // cursor is intentionally ignored — single-page response for ≤25 tools

      const effectiveMode = getEffectiveToolMode();
      const bundledTools = getBundledToolsForList();
      const accessFilter =
        effectiveMode === 'flat'
          ? await buildRequestAwareAccessFilter(
              [...new Set(getFlatToolRegistry().map((flat) => flat.parentTool))],
              extra
            )
          : await buildRequestAwareAccessFilter(
              bundledTools.map((tool) => tool.name),
              extra
            );

      // ── FLAT MODE ──────────────────────────────────────────────────────
      // Return the current flat action surface (most deferred) + sheets_discover
      if (effectiveMode === 'flat') {
        const flatEntries = buildFlatToolListEntries(accessFilter);
        const discoverEntry = buildDiscoverToolEntry();

        logger.info('tools/list serving flat mode', {
          totalTools: flatEntries.length + 1,
          alwaysLoaded: flatEntries.filter((t) => !t['x-defer-loading']).length + 1,
          deferred: flatEntries.filter((t) => t['x-defer-loading']).length,
        });

        return {
          tools: [discoverEntry, ...flatEntries],
          nextCursor: undefined,
        };
      }

      // ── BUNDLED MODE (legacy) ──────────────────────────────────────────
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
              icons: TOOL_ICONS[name],
              execution: TOOL_EXECUTION_CONFIG[name],
            };

            // outputSchema: prefer tool-level, fall back to registry lookup
            const resolvedOutputSchema = tool.outputSchema ?? getOutputSchemaForTool(name);
            if (resolvedOutputSchema) {
              toolDefinition['outputSchema'] = toJsonSchema(resolvedOutputSchema, {
                toolName: name,
                schemaType: 'output',
              });
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
