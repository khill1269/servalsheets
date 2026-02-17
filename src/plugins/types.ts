/**
 * ServalSheets - Plugin Type Definitions
 *
 * TypeScript interfaces for the plugin system.
 */

import type { ZodSchema } from 'zod';
import type { GoogleApiClient } from '../services/google-api.js';

/**
 * Plugin manifest - defines plugin metadata and capabilities
 */
export interface PluginManifest {
  /** Unique plugin name (kebab-case recommended) */
  name: string;

  /** Semantic version (e.g., "1.0.0") */
  version: string;

  /** Plugin author */
  author: string;

  /** Short description of plugin functionality */
  description?: string;

  /** Plugin homepage URL */
  homepage?: string;

  /** Plugin license (e.g., "MIT") */
  license?: string;

  /** Minimum ServalSheets version required */
  minServalVersion?: string;

  /** Plugin dependencies (other plugins required) */
  dependencies?: PluginDependency[];

  /** Required permissions/capabilities */
  permissions?: PluginPermission[];

  /** Plugin configuration schema (JSON Schema) */
  configSchema?: Record<string, unknown>;
}

/**
 * Plugin dependency specification
 */
export interface PluginDependency {
  name: string;
  version: string; // Semver range (e.g., "^1.0.0")
}

/**
 * Plugin permission types
 */
export type PluginPermission =
  | 'sheets.read'
  | 'sheets.write'
  | 'sheets.create'
  | 'drive.read'
  | 'drive.write'
  | 'network.fetch'
  | 'storage.read'
  | 'storage.write';

/**
 * Tool definition registered by plugin
 */
export interface ToolDefinition {
  /** Tool name (must be unique within plugin) */
  name: string;

  /** Human-readable description */
  description: string;

  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;

  /** JSON Schema for output (optional) */
  outputSchema?: Record<string, unknown>;

  /** Tool handler function */
  handler: ToolHandler;

  /** Whether tool requires confirmation */
  requiresConfirmation?: boolean;

  /** Estimated cost/quota usage */
  quotaCost?: number;
}

/**
 * Tool handler function signature
 */
export type ToolHandler = (params: unknown, context: PluginContext) => Promise<unknown>;

/**
 * Resource definition registered by plugin
 */
export interface ResourceDefinition {
  /** Resource URI (e.g., "plugin://excel-import/templates") */
  uri: string;

  /** Resource name */
  name: string;

  /** Resource description */
  description?: string;

  /** Resource MIME type */
  mimeType?: string;

  /** Resource provider function */
  provider: ResourceProvider;
}

/**
 * Resource provider function signature
 */
export type ResourceProvider = (uri: string) => Promise<ResourceContent>;

/**
 * Resource content returned by provider
 */
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: Uint8Array;
}

/**
 * Prompt definition registered by plugin
 */
export interface PromptDefinition {
  /** Prompt name */
  name: string;

  /** Prompt description */
  description?: string;

  /** Prompt arguments schema (JSON Schema) */
  argumentsSchema?: Record<string, unknown>;

  /** Prompt generator function */
  generator: PromptGenerator;
}

/**
 * Prompt generator function signature
 */
export type PromptGenerator = (args: unknown) => Promise<PromptContent>;

/**
 * Prompt content returned by generator
 */
export interface PromptContent {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Plugin execution context - APIs available to plugin code
 */
export interface PluginContext {
  /** Plugin name */
  pluginName: string;

  /** Plugin version */
  pluginVersion: string;

  /** Logger instance */
  logger: PluginLogger;

  /** Sheets API access (if granted) */
  sheets?: SheetsAPI;

  /** Drive API access (if granted) */
  drive?: DriveAPI;

  /** Storage API for plugin data */
  storage?: StorageAPI;

  /** HTTP fetch API (if granted) */
  fetch?: typeof fetch;

  /** Plugin configuration */
  config: Record<string, unknown>;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Simplified Sheets API for plugins
 */
export interface SheetsAPI {
  get(spreadsheetId: string, range?: string): Promise<unknown>;
  update(spreadsheetId: string, range: string, values: unknown[][]): Promise<unknown>;
  create(title: string): Promise<unknown>;
  batchGet(spreadsheetId: string, ranges: string[]): Promise<unknown>;
  batchUpdate(spreadsheetId: string, requests: unknown[]): Promise<unknown>;
}

/**
 * Simplified Drive API for plugins
 */
export interface DriveAPI {
  get(fileId: string): Promise<unknown>;
  list(query?: string): Promise<unknown>;
  create(metadata: unknown, content?: Uint8Array): Promise<unknown>;
  update(fileId: string, metadata?: unknown, content?: Uint8Array): Promise<unknown>;
  delete(fileId: string): Promise<unknown>;
}

/**
 * Plugin storage API for persisting data
 */
export interface StorageAPI {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * Complete plugin definition
 */
export interface Plugin extends PluginManifest {
  /** Tool definitions */
  tools?: ToolDefinition[];

  /** Resource definitions */
  resources?: ResourceDefinition[];

  /** Prompt definitions */
  prompts?: PromptDefinition[];

  /** Plugin load lifecycle hook */
  onLoad?(context: PluginContext): Promise<void>;

  /** Plugin unload lifecycle hook */
  onUnload?(): Promise<void>;

  /** Plugin configuration update hook */
  onConfigUpdate?(config: Record<string, unknown>): Promise<void>;
}

/**
 * Loaded plugin with runtime state
 */
export interface LoadedPlugin {
  /** Plugin manifest */
  manifest: PluginManifest;

  /** Plugin file path */
  path: string;

  /** Tool definitions */
  tools?: ToolDefinition[];

  /** Resource definitions */
  resources?: ResourceDefinition[];

  /** Prompt definitions */
  prompts?: PromptDefinition[];

  /** Plugin load timestamp */
  loadedAt: Date;

  /** Plugin execution context */
  context: PluginContext;

  /** Whether plugin is enabled */
  enabled: boolean;

  /** Plugin lifecycle hooks */
  lifecycle: {
    onLoad?: (context: PluginContext) => Promise<void>;
    onUnload?: () => Promise<void>;
    onConfigUpdate?: (config: Record<string, unknown>) => Promise<void>;
  };
}

/**
 * Plugin sandbox configuration
 */
export interface SandboxConfig {
  /** Memory limit in MB */
  memoryLimitMB: number;

  /** CPU time limit in milliseconds */
  cpuLimitMs: number;

  /** Allowed global objects */
  allowedGlobals?: string[];

  /** Timeout for async operations */
  asyncTimeoutMs?: number;
}

/**
 * Plugin runtime configuration
 */
export interface PluginRuntimeConfig {
  /** Directory containing plugins */
  pluginDir: string;

  /** Memory limit per plugin in MB */
  memoryLimitMB?: number;

  /** CPU time limit per plugin in milliseconds */
  cpuLimitMs?: number;

  /** API quota per plugin */
  apiQuota?: {
    requestsPerMinute: number;
  };

  /** Enable hot-reload */
  enableHotReload?: boolean;

  /** Google API client (for granted permissions) */
  googleClient?: GoogleApiClient;

  /** Plugin allowlist (only load these plugins) */
  allowlist?: string[];

  /** Plugin blocklist (never load these plugins) */
  blocklist?: string[];
}

/**
 * Plugin registry configuration
 */
export interface PluginRegistryConfig {
  /** Plugin directory */
  pluginDir: string;

  /** Whether to auto-discover plugins */
  autoDiscover?: boolean;

  /** Maximum plugins to load */
  maxPlugins?: number;
}

/**
 * Hot-reload manager configuration
 */
export interface HotReloadConfig {
  /** Plugin directory to watch */
  pluginDir: string;

  /** Debounce interval in milliseconds */
  debounceMs?: number;

  /** File patterns to watch */
  watchPatterns?: string[];

  /** File patterns to ignore */
  ignorePatterns?: string[];
}

/**
 * Hot-reload event types
 */
export interface HotReloadEvent {
  pluginName: string;
  reason: 'file-change' | 'new-file' | 'deleted';
  timestamp: Date;
}

/**
 * Plugin error with context
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly code: PluginErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

/**
 * Plugin error codes
 */
export type PluginErrorCode =
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_VALIDATION_FAILED'
  | 'PLUGIN_EXECUTION_FAILED'
  | 'PLUGIN_TIMEOUT'
  | 'PLUGIN_MEMORY_EXCEEDED'
  | 'PLUGIN_QUOTA_EXCEEDED'
  | 'PLUGIN_PERMISSION_DENIED'
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_ALREADY_LOADED'
  | 'PLUGIN_DEPENDENCY_MISSING';

/**
 * Plugin manifest validation result
 */
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Plugin execution stats
 */
export interface PluginStats {
  pluginName: string;
  toolCalls: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  errorCount: number;
  lastExecuted?: Date;
  memoryUsage?: number;
}

/**
 * Plugin marketplace entry
 */
export interface MarketplacePlugin {
  name: string;
  version: string;
  author: string;
  description: string;
  homepage?: string;
  repository?: string;
  downloads: number;
  rating: number;
  verified: boolean;
  downloadUrl: string;
  checksum: string;
  dependencies?: PluginDependency[];
  permissions?: PluginPermission[];
  screenshots?: string[];
  readme?: string;
}
