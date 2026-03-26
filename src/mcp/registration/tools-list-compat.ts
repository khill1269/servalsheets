/**
 * ServalSheets - tools/list Compatibility Handler
 *
 * Overrides the MCP SDK tools/list handler to safely convert Zod v4 schemas
 * (including transforms/pipes) into JSON Schema without throwing.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DEFER_SCHEMAS } from '../../config/constants.js';
import { TOOL_ICONS } from '../features-2025-11-25.js';
import { logger } from '../../utils/logger.js';
import { zodSchemaToJsonSchema } from '../../utils/schema-compat.js';
import { getSessionContext } from '../../services/session-context.js';
import { ACTION_COUNTS } from '../../schemas/action-counts.js';
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

const EMPTY_OBJECT_JSON_SCHEMA = { type: 'object', properties: {} };

function getToolActionCount(toolName: string): number {
  return ACTION_COUNTS[toolName] ?? 0;
}

/**
 * Tool tier metadata for hierarchical discovery.
 * Helps LLMs prioritize tool selection without scanning all 25 tools.
 *
 * - tier 1 (essential): Used in 80%+ of sessions — always consider first
 * - tier 2 (common): Used in 40-80% of sessions — consider for specific intents
 * - tier 3 (specialized): Used in <40% of sessions — only when explicitly needed
 *
 * group: Maps to the 5-group mental model from server instructions
 */
interface ToolTierMeta {
  tier: 1 | 2 | 3;
  group: 'data-io' | 'appearance' | 'structure' | 'analysis' | 'automation';
  primaryVerbs: string[];
}

const TOOL_TIERS: Record<string, ToolTierMeta> = {
  // Tier 1 — Essential (used in 80%+ of sessions)
  sheets_data:    { tier: 1, group: 'data-io',    primaryVerbs: ['read', 'write', 'append', 'find'] },
  sheets_core:    { tier: 1, group: 'structure',   primaryVerbs: ['create', 'list', 'delete', 'duplicate'] },
  sheets_format:  { tier: 1, group: 'appearance',  primaryVerbs: ['format', 'bold', 'color', 'number format'] },
  sheets_analyze: { tier: 1, group: 'analysis',    primaryVerbs: ['scout', 'analyze', 'generate formula'] },
  sheets_auth:    { tier: 1, group: 'automation',   primaryVerbs: ['login', 'status', 'logout'] },

  // Tier 2 — Common (used in 40-80% of sessions)
  sheets_dimensions: { tier: 2, group: 'appearance',  primaryVerbs: ['freeze', 'sort', 'filter', 'resize', 'hide'] },
  sheets_visualize:  { tier: 2, group: 'appearance',  primaryVerbs: ['chart', 'sparkline', 'slicer'] },
  sheets_composite:  { tier: 2, group: 'data-io',     primaryVerbs: ['import', 'export', 'generate'] },
  sheets_session:    { tier: 2, group: 'automation',   primaryVerbs: ['set active', 'preferences', 'pipeline'] },
  sheets_fix:        { tier: 2, group: 'analysis',     primaryVerbs: ['clean', 'standardize', 'fill missing'] },
  sheets_compute:    { tier: 2, group: 'data-io',     primaryVerbs: ['stats', 'regression', 'forecast'] },
  sheets_history:    { tier: 2, group: 'automation',   primaryVerbs: ['undo', 'timeline', 'diff', 'snapshot'] },
  sheets_collaborate:{ tier: 2, group: 'structure',    primaryVerbs: ['share', 'protect', 'comment', 'versions'] },

  // Tier 3 — Specialized (used in <40% of sessions)
  sheets_advanced:     { tier: 3, group: 'structure',   primaryVerbs: ['named range', 'pivot', 'slicer', 'banding'] },
  sheets_quality:      { tier: 3, group: 'analysis',    primaryVerbs: ['validate', 'conflicts'] },
  sheets_dependencies: { tier: 3, group: 'analysis',    primaryVerbs: ['dependency graph', 'what-if', 'scenario'] },
  sheets_templates:    { tier: 3, group: 'structure',   primaryVerbs: ['save template', 'instantiate'] },
  sheets_transaction:  { tier: 3, group: 'automation',  primaryVerbs: ['begin', 'queue', 'commit', 'rollback'] },
  sheets_agent:        { tier: 3, group: 'automation',  primaryVerbs: ['plan', 'execute', 'rollback'] },
  sheets_confirm:      { tier: 3, group: 'automation',  primaryVerbs: ['confirm', 'wizard'] },
  sheets_webhook:      { tier: 3, group: 'automation',  primaryVerbs: ['watch', 'subscribe', 'trigger'] },
  sheets_appsscript:   { tier: 3, group: 'automation',  primaryVerbs: ['run script', 'deploy', 'manage'] },
  sheets_bigquery:     { tier: 3, group: 'data-io',    primaryVerbs: ['query', 'import', 'export', 'dataset'] },
  sheets_federation:   { tier: 3, group: 'automation',  primaryVerbs: ['remote call', 'list servers'] },
  sheets_connectors:   { tier: 3, group: 'data-io',    primaryVerbs: ['discover', 'connect', 'fetch'] },
};

/**
 * Agency hints (SEP-1792 draft) — tells LLM clients which tools benefit
 * from autonomous agent orchestration vs direct single-call execution.
 *
 * - 'autonomous': Tool is designed for multi-step agent loops (plan/execute/observe)
 * - 'orchestrated': Tool benefits from being sequenced with others in a pipeline
 * - 'direct': Tool works best as a single direct call
 *
 * Exposed via x-servalsheets.agencyHint in tools/list inputSchema.
 */
/**
 * Per-tool scope requirements (SEP-1880 draft readiness).
 * Derived from OPERATION_SCOPES in src/security/incremental-scope.ts.
 * Tells LLM clients what OAuth scope category each tool needs,
 * so they can pre-flight scope checks before invocation.
 */
const TOOL_SCOPE_REQUIREMENTS: Record<string, { primary: string; elevated?: string; note?: string }> = {
  sheets_auth:         { primary: 'none', note: 'No Google API scopes required' },
  sheets_session:      { primary: 'none', note: 'Local session state only' },
  sheets_confirm:      { primary: 'none', note: 'MCP elicitation only' },
  sheets_core:         { primary: 'spreadsheets', elevated: 'drive.file', note: 'create requires drive.file scope' },
  sheets_data:         { primary: 'spreadsheets' },
  sheets_format:       { primary: 'spreadsheets' },
  sheets_dimensions:   { primary: 'spreadsheets' },
  sheets_visualize:    { primary: 'spreadsheets' },
  sheets_advanced:     { primary: 'spreadsheets' },
  sheets_compute:      { primary: 'spreadsheets' },
  sheets_fix:          { primary: 'spreadsheets' },
  sheets_quality:      { primary: 'spreadsheets' },
  sheets_analyze:      { primary: 'spreadsheets.readonly', elevated: 'spreadsheets', note: 'Read-only for analysis; full scope for semantic_search indexing' },
  sheets_collaborate:  { primary: 'spreadsheets', elevated: 'drive', note: 'Sharing/comments/versions require full drive scope' },
  sheets_history:      { primary: 'spreadsheets', elevated: 'drive.readonly', note: 'timeline/diff need drive revision access' },
  sheets_dependencies: { primary: 'spreadsheets' },
  sheets_composite:    { primary: 'spreadsheets', elevated: 'drive.file', note: 'generate_sheet/import may create new files' },
  sheets_templates:    { primary: 'drive.appdata', elevated: 'drive.file', note: 'All actions require appdata scope; apply needs drive.file' },
  sheets_transaction:  { primary: 'spreadsheets' },
  sheets_bigquery:     { primary: 'spreadsheets', elevated: 'bigquery', note: 'Query/import/export need BigQuery scope' },
  sheets_appsscript:   { primary: 'spreadsheets', elevated: 'script.projects', note: 'Create/execute/deploy need Apps Script scope' },
  sheets_webhook:      { primary: 'spreadsheets', elevated: 'drive', note: 'Register/unregister need drive scope' },
  sheets_federation:   { primary: 'none', note: 'Delegates to remote MCP servers' },
  sheets_connectors:   { primary: 'none', elevated: 'spreadsheets', note: 'configure needs no scope; query/subscribe need sheets access' },
  sheets_agent:        { primary: 'spreadsheets', elevated: 'drive', note: 'Agent may invoke any tool — inherits all scope requirements' },
};

const TOOL_AGENCY_HINTS: Record<string, { level: 'autonomous' | 'orchestrated' | 'direct'; reason: string }> = {
  sheets_agent:        { level: 'autonomous',   reason: 'Plan/execute/observe loop with rollback — designed for autonomous multi-step workflows' },
  sheets_composite:    { level: 'orchestrated',  reason: 'Multi-step operations (import, generate, setup) that chain internal tool calls' },
  sheets_analyze:      { level: 'orchestrated',  reason: 'AI sampling-powered analysis that benefits from iterative scout → comprehensive flow' },
  sheets_fix:          { level: 'orchestrated',  reason: 'Cleaning pipelines that chain detect → preview → apply with user confirmation' },
  sheets_transaction:  { level: 'orchestrated',  reason: 'Queue → commit → verify pattern requires multi-step sequencing' },
  sheets_dependencies: { level: 'orchestrated',  reason: 'Scenario modeling benefits from iterative what-if → compare → materialize flow' },
  sheets_confirm:      { level: 'direct',        reason: 'Single user interaction — confirmation or wizard step' },
  sheets_session:      { level: 'direct',        reason: 'Context management — single-call set/get operations' },
  sheets_auth:         { level: 'direct',        reason: 'Authentication — single-call status/login/callback' },
  sheets_compute:      { level: 'direct',        reason: 'Stateless computation — same input always produces same output' },
};

function isZodSchema(schema: unknown): boolean {
  return Boolean(
    schema &&
    typeof schema === 'object' &&
    ('_def' in (schema as Record<string, unknown>) || '_zod' in (schema as Record<string, unknown>))
  );
}

// P1-2 fix: Track tools that failed schema conversion so we can annotate them
const schemaConversionErrors = new Map<string, string>();

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
      // P1-2: Full conversion failed — try deferred fallback before giving up.
      // The deferred builder extracts action enums + property names from the Zod
      // schema, producing a useful ~300-800 byte schema instead of empty {}.
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

        schemaConversionErrors.set(toolName, msg);
      }
      return EMPTY_OBJECT_JSON_SCHEMA;
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

  if (sessionFamiliarity >= 0.8) {
    // Ultra-minimal: tool name + action count only (LLM already knows how to use it)
    const actionCount = getToolActionCount(toolName);
    const ultraMinimal = `${toolName.replace('sheets_', '').toUpperCase()} (${actionCount} actions)`;
    return mergeDescription(ultraMinimal, availabilitySuffix);
  }

  const hint = getToolDiscoveryHint(toolName);
  return mergeDescription(mergeDescription(existing, hint?.descriptionSuffix), availabilitySuffix);
}

function enrichInputSchema(
  toolName: string,
  inputSchema: Record<string, unknown>
): Record<string, unknown> {
  // Always inject x-servalsheets.actionParams hints regardless of schema mode.
  // In deferred mode (STDIO) these are the primary parameter guide.
  // In full-schema mode (HTTP) they supplement the JSON Schema with compact
  // per-action required/optional/enum summaries that are faster to scan.
  const hint = getToolDiscoveryHint(toolName);
  if (!hint) {
    return inputSchema;
  }

  const allowedActions = new Set(filterAvailableActions(toolName, Object.keys(hint.actionParams)));
  const actionParams = Object.fromEntries(
    Object.entries(hint.actionParams).filter(([action]) => allowedActions.has(action))
  );

  const tierMeta = TOOL_TIERS[toolName];
  const costEstimates = getActionCostEstimates(toolName);
  const agencyHint = TOOL_AGENCY_HINTS[toolName];
  const scopeReqs = TOOL_SCOPE_REQUIREMENTS[toolName];
  const enriched: Record<string, unknown> = {
    ...inputSchema,
    'x-servalsheets': {
      ...(asRecord(inputSchema['x-servalsheets']) ?? {}),
      actionParams,
      ...(tierMeta
        ? { tier: tierMeta.tier, group: tierMeta.group, primaryVerbs: tierMeta.primaryVerbs }
        : {}),
      ...(costEstimates ? { costEstimates } : {}),
      ...(agencyHint ? { agencyHint } : {}),
      ...(scopeReqs ? { requiredScopes: scopeReqs } : {}),
      ...(getToolAvailabilityMetadata(toolName)
        ? { availability: getToolAvailabilityMetadata(toolName) }
        : {}),
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

export function registerToolsListCompatibilityHandler(server: McpServer): void {
  const protocolServer = server.server as unknown as {
    setRequestHandler: typeof server.server.setRequestHandler;
  };

  const registeredTools = (
    server as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK internal property type
      _registeredTools?: Record<string, any>;
    }
  )._registeredTools;

  protocolServer.setRequestHandler(
    ListToolsRequestSchema,
    (_request: z.infer<typeof ListToolsRequestSchema>) => {
      // Accept cursor param per MCP 2025-11-25 spec (single-page response for ≤25 tools)
      // cursor is intentionally ignored — single-page response for ≤25 tools

      return {
        tools: Object.entries(registeredTools ?? {})
          .filter(([name, tool]) => {
            if (tool?.enabled === false) return false;
            // P1-2: Exclude tools whose schemas failed to convert — they'll crash at runtime
            if (schemaConversionErrors.has(name)) {
              logger.error('Excluding tool from tools/list due to schema error', {
                tool: name,
                error: schemaConversionErrors.get(name),
              });
              return false;
            }
            // Hide tools whose backing service is completely unavailable
            if (isToolFullyUnavailable(name)) {
              logger.debug('Excluding tool from tools/list: backing service unavailable', {
                tool: name,
              });
              return false;
            }
            return true;
          })
          .map(([name, tool]) => {
            const inputSchema = enrichInputSchema(
              name,
              toJsonSchema(tool.inputSchema, { toolName: name, schemaType: 'input' })
            );
            const toolDefinition: Record<string, unknown> = {
              name,
              title: tool.title,
              description: enrichToolDescription(name, tool.description),
              inputSchema,
              annotations: tool.annotations,
              icons: tool.icons ?? TOOL_ICONS[name],
              execution: tool.execution,
              _meta: tool._meta,
            };

            if (tool.outputSchema) {
              toolDefinition['outputSchema'] = toJsonSchema(tool.outputSchema, {
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
