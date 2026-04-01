/**
 * Output Schema Registry
 *
 * Provides a fallback lookup for tool output schemas when not directly
 * registered on the tool definition. This ensures all 25 tools expose
 * outputSchema in tools/list for structured client consumption.
 *
 * Lazily loaded to avoid circular dependencies with schema modules.
 */

import type { ZodType } from 'zod';
import { logger } from '../../utils/logger.js';

let _registry: Map<string, ZodType | null> | null = null;

// Mapping of tool names to their schema module paths
const SCHEMA_MODULE_MAP: Record<string, string> = {
  sheets_core: '../../schemas/core.js',
  sheets_data: '../../schemas/data.js',
  sheets_format: '../../schemas/format.js',
  sheets_dimensions: '../../schemas/dimensions.js',
  sheets_advanced: '../../schemas/advanced.js',
  sheets_visualize: '../../schemas/visualize.js',
  sheets_collaborate: '../../schemas/collaborate.js',
  sheets_composite: '../../schemas/composite.js',
  sheets_analyze: '../../schemas/analyze.js',
  sheets_fix: '../../schemas/fix.js',
  sheets_templates: '../../schemas/templates.js',
  sheets_bigquery: '../../schemas/bigquery.js',
  sheets_appsscript: '../../schemas/appsscript.js',
  sheets_auth: '../../schemas/auth.js',
  sheets_confirm: '../../schemas/confirm.js',
  sheets_dependencies: '../../schemas/dependencies.js',
  sheets_quality: '../../schemas/quality.js',
  sheets_history: '../../schemas/history.js',
  sheets_session: '../../schemas/session.js',
  sheets_transaction: '../../schemas/transaction.js',
  sheets_federation: '../../schemas/federation.js',
  sheets_webhook: '../../schemas/webhook.js',
  sheets_agent: '../../schemas/agent.js',
  sheets_compute: '../../schemas/compute.js',
  sheets_connectors: '../../schemas/connectors.js',
};

function buildRegistry(): Map<string, ZodType | null> {
  if (_registry) return _registry;

  _registry = new Map<string, ZodType | null>();

  // Pre-register all known tools with null value
  // Actual resolution happens on first access in getOutputSchemaForTool
  for (const toolName of Object.keys(SCHEMA_MODULE_MAP)) {
    _registry.set(toolName, null);
  }

  return _registry;
}

// Cache for resolved output schemas
const _resolvedSchemas = new Map<string, ZodType | null>();

/**
 * Get the output/response schema for a tool, if available.
 * Returns the Zod schema or undefined if not found.
 *
 * Uses naming conventions to find schemas:
 * - {Tool}ResponseSchema (preferred)
 * - {Tool}OutputSchema (fallback)
 * - {Tool}Schema (last resort)
 */
export function getOutputSchemaForTool(toolName: string): ZodType | undefined {
  // Check resolved cache first
  if (_resolvedSchemas.has(toolName)) {
    const cached = _resolvedSchemas.get(toolName);
    return cached ?? undefined;
  }

  // Ensure registry is built
  buildRegistry();

  // Try to find a response schema by convention
  try {
    const modulePath = SCHEMA_MODULE_MAP[toolName];
    if (!modulePath) {
      _resolvedSchemas.set(toolName, null);
      return undefined; // OK: unknown tool name — not in SCHEMA_MODULE_MAP
    }

    // Dynamic import is handled by the schema module loader

    const mod = require(modulePath);

    // Try various naming conventions for the response schema
    const schemaKey = toolName.replace('sheets_', '');
    const capitalizedKey = schemaKey.charAt(0).toUpperCase() + schemaKey.slice(1);

    // Primary pattern: Sheets{Tool}OutputSchema (e.g., SheetsCoreOutputSchema)
    // Fallback patterns for non-standard exports
    const candidates = [
      `Sheets${capitalizedKey}OutputSchema`,
      `${capitalizedKey}ResponseSchema`,
      `${capitalizedKey}OutputSchema`,
      `${capitalizedKey}Schema`,
    ];

    for (const schemaName of candidates) {
      const schema = mod[schemaName];

      // Verify it looks like a Zod schema by checking for internal markers
      if (
        schema &&
        typeof schema === 'object' &&
        ('_def' in (schema as Record<string, unknown>) ||
          '_zod' in (schema as Record<string, unknown>))
      ) {
        _resolvedSchemas.set(toolName, schema as ZodType);
        return schema as ZodType;
      }
    }

    logger.debug('Output schema not found for tool', {
      tool: toolName,
      searchedNames: candidates,
      availableExports: Object.keys(mod).slice(0, 10), // Log first 10 exports for debugging
    });
  } catch (err) {
    // Schema module not found or doesn't export a response schema
    logger.debug('Failed to load schema module for tool', {
      tool: toolName,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  _resolvedSchemas.set(toolName, null);
  return undefined; // OK: schema module doesn't export a matching response schema
}

/**
 * Clear the output schema cache (for testing or cache invalidation)
 */
export function clearOutputSchemaCache(): void {
  _resolvedSchemas.clear();
  _registry = null;
}
