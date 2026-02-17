/**
 * ServalSheets - Plugin System
 *
 * Secure plugin system with JavaScript runtime sandboxing and hot-reload.
 *
 * @module plugins
 */

export { PluginRuntime } from './runtime.js';
export {
  PluginSandbox,
  wrapAsyncHandler,
  sanitizeError,
  validateCodeSafety,
  estimateCodeComplexity,
} from './sandbox.js';
export { PluginRegistry } from './registry.js';
export { HotReloadManager } from './hot-reload.js';

export type {
  Plugin,
  PluginManifest,
  LoadedPlugin,
  PluginContext,
  PluginLogger,
  ToolDefinition,
  ToolHandler,
  ResourceDefinition,
  ResourceProvider,
  ResourceContent,
  PromptDefinition,
  PromptGenerator,
  PromptContent,
  SheetsAPI,
  DriveAPI,
  StorageAPI,
  PluginDependency,
  PluginPermission,
  SandboxConfig,
  PluginRuntimeConfig,
  PluginRegistryConfig,
  HotReloadConfig,
  HotReloadEvent,
  PluginValidationResult,
  PluginStats,
  MarketplacePlugin,
} from './types.js';

export { PluginError } from './types.js';
export type { PluginErrorCode } from './types.js';
