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
export { prepareSchemaForRegistration, verifySchemaIfNeeded, } from './registration/schema-helpers.js';
export { createToolHandlerMap, buildToolResponse, registerServalSheetsTools, } from './registration/tool-handlers.js';
export { createFastToolHandlerMap, isFastValidatorsEnabled, wrapWithValidationErrorHandling, } from './registration/fast-handler-map.js';
export { registerServalSheetsResources } from './registration/resource-registration.js';
export { registerServalSheetsPrompts } from './registration/prompt-registration.js';
export { createLazyResponse, buildSuccessResponse, buildErrorResponse, createStreamingResponse, fastSerialize, estimateResponseSize, buildFromTemplate, ResponseBuilder, } from './response-builder.js';
//# sourceMappingURL=registration.d.ts.map