/**
 * ServalSheets - MCP Registration (Compatibility Layer)
 *
 * This file maintains backward compatibility by re-exporting from the new
 * modular structure in src/mcp/registration/.
 *
 * @deprecated Import directly from src/mcp/registration/ modules instead
 * @module mcp/registration
 */

export type { ToolDefinition } from './registration/tool-definitions.js';
export { TOOL_DEFINITIONS } from './registration/tool-definitions.js';

export {
  prepareSchemaForRegistration,
  verifySchemaIfNeeded,
} from './registration/schema-helpers.js';

export {
  createToolHandlerMap,
  buildToolResponse,
  registerServalSheetsTools,
} from './registration/tool-handlers.js';

export { registerToolsListCompatibilityHandler } from './registration/tools-list-compat.js';

export { registerServalSheetsResources } from './registration/resource-registration.js';

export { registerServalSheetsPrompts } from './registration/prompt-registration.js';

// Response optimization (Phase 4)
export {
  createLazyResponse,
  buildSuccessResponse,
  buildErrorResponse,
  createStreamingResponse,
  fastSerialize,
  estimateResponseSize,
  buildFromTemplate,
  ResponseBuilder,
} from './response-builder.js';
