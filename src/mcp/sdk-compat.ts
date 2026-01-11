/**
 * MCP SDK Compatibility Patch
 *
 * PATCH 1: Works around SDK method literal extraction with Zod v4 (def.values).
 * PATCH 2: Fixes discriminated union bug in toJsonSchemaCompat() by using Zod v4 native conversion.
 *
 * ## Background: MCP SDK v1.25.x Discriminated Union Bug
 *
 * The SDK's `normalizeObjectSchema()` only recognizes `z.object()` schemas.
 * For discriminated unions, it returns `undefined`, causing `tools/list` to use
 * `EMPTY_OBJECT_JSON_SCHEMA` = `{ type: "object", properties: {} }`.
 *
 * This prevents LLMs from understanding tool parameters, causing them to guess
 * or fail to use tools correctly. ALL 26 ServalSheets tools were affected.
 *
 * ## Solution: Use Zod v4 Native JSON Schema Conversion
 *
 * Zod v4.0+ has first-party JSON Schema support via `z.toJSONSchema()`.
 * This correctly handles discriminated unions, regular unions, objects, and all other types.
 *
 * We monkey-patch the SDK's `toJsonSchemaCompat()` to use Zod native conversion
 * instead of the buggy `normalizeObjectSchema()` → library conversion flow.
 *
 * This patch can be removed once MCP SDK v1.26+ ships with proper discriminated union support.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { getObjectShape } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z } from "zod";
import { createRequire } from "node:module";

let patched = false;

export function patchMcpServerRequestHandler(): void {
  if (patched) return;
  patched = true;

  const original = Server.prototype.setRequestHandler;

  Server.prototype.setRequestHandler = function setRequestHandlerPatched(
    requestSchema: unknown,
    handler: unknown,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shape = getObjectShape(requestSchema as any); // getObjectShape expects zod schema internals
    const methodSchema = shape?.["method"] as
      | Record<string, unknown>
      | undefined;

    if (methodSchema && methodSchema["value"] === undefined) {
      const def =
        (methodSchema["_def"] as
          | { value?: unknown; values?: unknown[] }
          | undefined) ??
        (
          methodSchema["_zod"] as
            | { def?: { value?: unknown; values?: unknown[] } }
            | undefined
        )?.def;
      const literal =
        def?.value ?? (Array.isArray(def?.values) ? def?.values[0] : undefined);

      if (typeof literal === "string") {
        Object.defineProperty(methodSchema, "value", {
          value: literal,
          configurable: true,
        });
      }
    }

    return original.call(this, requestSchema as never, handler as never);
  };
}

/**
 * Patches the SDK's toJsonSchemaCompat() to use Zod v4 native JSON Schema conversion
 *
 * ## Why This Patch Is Needed
 *
 * The MCP SDK v1.25.x has a critical bug in `tools/list` response generation:
 *
 * ```javascript
 * // From @modelcontextprotocol/sdk/dist/esm/server/mcp.js
 * inputSchema: (() => {
 *   const obj = normalizeObjectSchema(tool.inputSchema);  // Returns undefined for discriminated unions
 *   return obj ? toJsonSchemaCompat(obj, {...}) : EMPTY_OBJECT_JSON_SCHEMA;  // Falls back to {}
 * })()
 * ```
 *
 * The `normalizeObjectSchema()` function only recognizes `z.object()` schemas:
 *
 * ```javascript
 * // From @modelcontextprotocol/sdk/dist/esm/server/zod-compat.js
 * export function normalizeObjectSchema(schema) {
 *   if (isZ4Schema(schema)) {
 *     const v4Schema = schema;
 *     const def = v4Schema._zod?.def;
 *     if (def && (def.type === 'object' || def.shape !== undefined)) {
 *       return schema;  // ✅ Works for z.object()
 *     }
 *   }
 *   return undefined;  // ❌ Fails for discriminated unions
 * }
 * ```
 *
 * ## The Fix
 *
 * We bypass the buggy `normalizeObjectSchema()` → `toJsonSchemaCompat()` flow
 * by patching `toJsonSchemaCompat()` itself to use Zod v4's native `z.toJSONSchema()`.
 *
 * This works because:
 * 1. Zod v4.0+ has first-party JSON Schema support
 * 2. `z.toJSONSchema()` correctly handles ALL Zod types (objects, discriminated unions, regular unions, etc.)
 * 3. The patch applies to ALL schemas, not just discriminated unions
 *
 * ## Compatibility
 *
 * - ✅ Works with Zod v4.3.5+ (native z.toJSONSchema() available)
 * - ✅ Works with MCP SDK v1.25.2 (monkey-patching supported)
 * - ⚠️  May break if SDK changes internal API in v1.26+
 * - 🔄 Can be removed once SDK fixes discriminated union support
 */
export function patchToJsonSchemaCompat(): void {
  try {
    // Import the SDK's zod-json-schema-compat module using CommonJS require
    // We use createRequire for ESM→CJS interop since ServalSheets uses ESM
    // NOTE: toJsonSchemaCompat is in zod-json-schema-compat.js, NOT zod-compat.js!
    const require = createRequire(import.meta.url);
    const zodJsonSchemaCompat = require("@modelcontextprotocol/sdk/dist/cjs/server/zod-json-schema-compat.js");

    // Save the original function for fallback
    const originalToJsonSchemaCompat = zodJsonSchemaCompat.toJsonSchemaCompat;

    // Replace with Zod v4 native JSON Schema conversion
    zodJsonSchemaCompat.toJsonSchemaCompat = function toJsonSchemaCompatPatched(
      schema: unknown,
      options?: { target?: string },
    ): Record<string, unknown> {
      try {
        // Use Zod v4's native JSON Schema conversion
        // This correctly handles discriminated unions, objects, unions, and all other types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jsonSchema = z.toJSONSchema(schema as any);

        // Remove $schema property (MCP protocol doesn't need it)
        if (typeof jsonSchema === "object" && jsonSchema !== null) {
          const { $schema: _$schema, ...rest } = jsonSchema as Record<
            string,
            unknown
          >;
          return rest;
        }

        // Unexpected format - use original as fallback
        return originalToJsonSchemaCompat(schema, options);
      } catch (error) {
        // Conversion failed - use original as fallback
        console.error(
          "[sdk-compat] Zod native JSON Schema conversion failed, using original:",
          error instanceof Error ? error.message : String(error),
        );
        return originalToJsonSchemaCompat(schema, options);
      }
    };
  } catch (error) {
    // Patching failed - this is non-fatal, but tools/list will show empty schemas
    console.error(
      "[sdk-compat] Failed to patch toJsonSchemaCompat():",
      error instanceof Error ? error.message : String(error),
    );
  }
}
