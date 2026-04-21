/**
 * ServalSheets - Flat Tool Per-Action Input Schemas
 *
 * Derives accurate JSON Schemas for flat tools (e.g. sheets_agent_plan,
 * sheets_advanced_list_named_functions) by walking the parent compound
 * Zod schema's discriminated union and extracting the matching action's
 * option.
 *
 * Why this exists
 * ---------------
 * The flat tool surface presents each action as a standalone MCP tool. Its
 * inputSchema must tell the LLM which parameters are required for that
 * specific action — not just "spreadsheetId". Without this, flat calls
 * reach the compound handler and fail Zod validation at
 * `request.<required field>`.
 *
 * Traceability
 * ------------
 * - BUG #3: flat schemas only advertise {spreadsheetId}; action-specific
 *   required params are hidden, so LLMs submit incomplete calls.
 * - BUG #6: sheets_agent.list_plans / get_status advertise spreadsheetId
 *   but the underlying strict() schemas reject it.
 *
 * Strategy
 * --------
 * 1. Look up the compound tool definition in TOOL_DEFINITIONS
 *    (src/mcp/registration/tool-definitions.ts).
 * 2. Peel off the outer `z.object({ request: ... })` wrapper.
 * 3. Unwrap `z.preprocess` / `z.pipe` via unwrapZodSchema().
 * 4. Iterate the ZodDiscriminatedUnion options and match by the
 *    `action` literal (via `.def.values`).
 * 5. Convert the matching option via zodSchemaToJsonSchema() (Zod v4's
 *    native z.toJSONSchema, io: 'input').
 * 6. Strip the `action` property — it's injected automatically by the
 *    flat-tool-routing adapter.
 *
 * Failure is safe: if any step can't resolve a schema (unsupported Zod
 * structure, missing action literal, etc.), returns null and the caller
 * falls back to the generic {spreadsheetId} schema.
 *
 * @module mcp/registration/flat-input-schemas
 */

import { z } from '../../lib/schema.js';
import { zodSchemaToJsonSchema, unwrapZodSchema } from '../../utils/schema-compat.js';
import { logger } from '../../utils/logger.js';
import { TOOL_DEFINITIONS } from './tool-definitions.js';

// --------------------------------------------------------------------------
// Cache
// --------------------------------------------------------------------------

/** Cached per-action JSON schemas. null = derivation failed, fall back. */
const schemaCache = new Map<string, Record<string, unknown> | null>();

/** Clear cache — exposed for tests and hot-reload. */
export function clearFlatInputSchemaCache(): void {
  schemaCache.clear();
}

// --------------------------------------------------------------------------
// Zod shape helpers
// --------------------------------------------------------------------------

function getCompoundInputSchema(parentTool: string): unknown {
  const def = TOOL_DEFINITIONS.find((t) => t.name === parentTool);
  return def?.inputSchema;
}

/**
 * Extract the `request` field from a compound InputSchema.
 * Compound schemas follow the pattern: z.object({ request: ... }).
 */
function extractRequestField(compound: unknown): unknown {
  if (!compound) return null;

  // Direct shape access (Zod v4 z.object exposes .shape)
  const shape = (compound as { shape?: Record<string, unknown> }).shape;
  if (shape && typeof shape === 'object' && 'request' in shape) {
    return (shape as Record<string, unknown>)['request'];
  }

  // Some compound schemas may be wrapped (e.g., .strict() returns a new object but still exposes .shape).
  // If shape access fails, check _def.shape() as a last resort (Zod internal).
  const def = (compound as { _def?: { shape?: () => Record<string, unknown> } })._def;
  if (def && typeof def.shape === 'function') {
    const resolved = def.shape();
    if (resolved && 'request' in resolved) return resolved['request'];
  }

  return null;
}

/**
 * Unwrap preprocess/pipe wrappers around a discriminated union and return
 * the DU itself. Returns null if the field isn't (or doesn't wrap) a DU.
 */
function extractDiscriminatedUnion(
  requestField: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic Zod type param required by library
): z.ZodDiscriminatedUnion<any, any> | null {
  if (!requestField) return null;

  // Direct hit
  if (requestField instanceof z.ZodDiscriminatedUnion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast to generic DU type
    return requestField as z.ZodDiscriminatedUnion<any, any>;
  }

  // Unwrap z.preprocess (ZodPipe) / z.pipe / legacy ZodEffects
  const unwrapped = unwrapZodSchema(requestField);
  if (unwrapped instanceof z.ZodDiscriminatedUnion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast to generic DU type
    return unwrapped as z.ZodDiscriminatedUnion<any, any>;
  }

  return null;
}

/**
 * Read the action literal from a discriminated union option.
 * ZodLiteral in v4 stores the literal(s) under def.values (tuple, singleton
 * in our case). v3 used def.value.
 */
function readActionLiteral(option: unknown): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reading zod internals
  const opt = option as any;
  const actionField = opt?.shape?.action ?? opt?._def?.shape?.()?.action;
  if (!actionField) return null;

  const values = actionField.def?.values ?? actionField._def?.values;
  if (Array.isArray(values) && values.length > 0) return String(values[0]);

  const value = actionField.def?.value ?? actionField._def?.value;
  if (typeof value === 'string') return value;
  if (value !== undefined && value !== null) return String(value);

  return null;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Build a JSON Schema for a single flat tool (parentTool.action).
 * Returns null on failure so the caller can fall back to a minimal schema.
 */
export function buildFlatInputSchemaForAction(
  parentTool: string,
  action: string
): Record<string, unknown> | null {
  const key = `${parentTool}.${action}`;
  if (schemaCache.has(key)) {
    return schemaCache.get(key) ?? null;
  }

  try {
    const compound = getCompoundInputSchema(parentTool);
    if (!compound) {
      schemaCache.set(key, null);
      return null;
    }

    const requestField = extractRequestField(compound);
    const union = extractDiscriminatedUnion(requestField);
    if (!union) {
      schemaCache.set(key, null);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reading zod internals
    const options = ((union as any).options ?? (union as any).def?.options) as unknown[];
    if (!Array.isArray(options) || options.length === 0) {
      schemaCache.set(key, null);
      return null;
    }

    const matched = options.find((opt) => readActionLiteral(opt) === action);
    if (!matched) {
      schemaCache.set(key, null);
      return null;
    }

    // Convert matched ZodObject to JSON Schema.
    // zodSchemaToJsonSchema() uses io: 'input' so defaults/transforms don't strip fields.
    const json = zodSchemaToJsonSchema(matched as z.ZodTypeAny);
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      schemaCache.set(key, null);
      return null;
    }

    // Strip 'action' — it's injected by the flat-tool-routing adapter.
    const srcProps = (json['properties'] ?? {}) as Record<string, unknown>;
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(srcProps)) {
      if (k === 'action') continue;
      properties[k] = v;
    }

    const srcRequired = Array.isArray(json['required']) ? (json['required'] as string[]) : [];
    const required = srcRequired.filter((r) => r !== 'action');

    const result: Record<string, unknown> = {
      type: 'object',
      properties,
    };
    if (required.length > 0) result['required'] = required;
    if (typeof json['additionalProperties'] !== 'undefined') {
      result['additionalProperties'] = json['additionalProperties'];
    }
    if (typeof json['description'] === 'string') {
      result['description'] = json['description'];
    }
    // Pass through $defs if present (USE_SCHEMA_REFS mode).
    if (json['$defs'] && typeof json['$defs'] === 'object') {
      result['$defs'] = json['$defs'];
    }

    schemaCache.set(key, result);
    return result;
  } catch (err) {
    logger.warn('Failed to derive flat input schema', {
      component: 'flat-input-schemas',
      actionKey: key,
      error: err instanceof Error ? err.message : String(err),
    });
    schemaCache.set(key, null);
    return null;
  }
}
