/**
 * ServalSheets - Plugin Runtime
 *
 * Main plugin execution engine coordinating sandbox, registry, and hot-reload.
 */

import { PluginSandbox } from './sandbox.js';
import { PluginRegistry } from './registry.js';
import { HotReloadManager } from './hot-reload.js';
import { PluginError } from './types.js';
import type {
  PluginRuntimeConfig,
  LoadedPlugin,
  PluginContext,
  SheetsAPI,
  DriveAPI,
  StorageAPI,
  PluginStats,
  ToolHandler,
} from './types.js';
import { logger as baseLogger } from '../utils/logger.js';
import type { GoogleApiClient } from '../services/google-api.js';

/**
 * Rate limiter for API quota enforcement
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(private requestsPerMinute: number) {}

  /**
   * Check if request is allowed
   */
  checkQuota(pluginName: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute ago

    // Get existing requests
    let requests = this.requests.get(pluginName) || [];

    // Remove old requests outside window
    requests = requests.filter((timestamp) => timestamp > windowStart);

    // Check if within quota
    if (requests.length >= this.requestsPerMinute) {
      return false;
    }

    // Add current request
    requests.push(now);
    this.requests.set(pluginName, requests);

    return true;
  }

  /**
   * Reset quota for plugin
   */
  resetQuota(pluginName: string): void {
    this.requests.delete(pluginName);
  }

  /**
   * Get remaining quota
   */
  getRemainingQuota(pluginName: string): number {
    const now = Date.now();
    const windowStart = now - 60000;

    const requests = this.requests.get(pluginName) || [];
    const recentRequests = requests.filter((timestamp) => timestamp > windowStart);

    return Math.max(0, this.requestsPerMinute - recentRequests.length);
  }
}

/**
 * Default runtime configuration
 */
const DEFAULT_RUNTIME_CONFIG: Required<Omit<PluginRuntimeConfig, 'googleClient'>> = {
  pluginDir: './plugins',
  memoryLimitMB: 50,
  cpuLimitMs: 2000,
  apiQuota: { requestsPerMinute: 60 },
  enableHotReload: false,
  allowlist: [],
  blocklist: [],
};

/**
 * PluginRuntime - Main plugin system orchestrator
 *
 * Features:
 * - Plugin loading and execution
 * - Sandboxed execution
 * - Resource limits (memory, CPU, API quota)
 * - Hot-reload support
 * - API access control
 * - Statistics tracking
 */
export class PluginRuntime {
  private config: Required<Omit<PluginRuntimeConfig, 'googleClient'>> & {
    googleClient?: GoogleApiClient;
  };
  private sandbox: PluginSandbox;
  private registry: PluginRegistry;
  private hotReload?: HotReloadManager;
  private rateLimiter: RateLimiter;
  private stats: Map<string, PluginStats> = new Map();
  private logger = baseLogger.child({ component: 'PluginRuntime' });

  constructor(config: PluginRuntimeConfig) {
    this.config = {
      ...DEFAULT_RUNTIME_CONFIG,
      ...config,
    };

    // Initialize components
    this.sandbox = new PluginSandbox({
      memoryLimitMB: this.config.memoryLimitMB,
      cpuLimitMs: this.config.cpuLimitMs,
    });

    this.registry = new PluginRegistry({
      pluginDir: this.config.pluginDir,
    });

    this.rateLimiter = new RateLimiter(this.config.apiQuota.requestsPerMinute);

    // Set up hot-reload if enabled
    if (this.config.enableHotReload) {
      this.setupHotReload();
    }

    this.logger.info('Plugin runtime initialized', {
      pluginDir: this.config.pluginDir,
      memoryLimitMB: this.config.memoryLimitMB,
      cpuLimitMs: this.config.cpuLimitMs,
      hotReload: this.config.enableHotReload,
    });
  }

  /**
   * Set up hot-reload manager
   */
  private setupHotReload(): void {
    this.hotReload = new HotReloadManager({
      pluginDir: this.config.pluginDir,
    });

    // Handle reload events
    this.hotReload.on('reload', async (event) => {
      this.logger.info('Hot-reloading plugin', { plugin: event.pluginName });

      try {
        // Try to reload the plugin
        const plugin = this.registry.getPlugin(event.pluginName);
        if (plugin) {
          await this.registry.reloadPlugin(event.pluginName);
          this.logger.info('Plugin reloaded successfully', {
            plugin: event.pluginName,
          });
        } else {
          // New plugin, try to discover and load
          const manifests = await this.registry.discoverPlugins();
          const manifest = manifests.find((m) => m.name === event.pluginName);
          if (manifest) {
            // Find plugin file and load
            // (In real implementation, track file paths)
            this.logger.info('New plugin discovered', {
              plugin: event.pluginName,
            });
          }
        }
      } catch (error) {
        this.logger.error('Failed to hot-reload plugin', {
          plugin: event.pluginName,
          error,
        });
        this.hotReload!.emit('error', error as Error);
      }
    });

    // Handle unload events
    this.hotReload.on('unload', async (event) => {
      this.logger.info('Unloading deleted plugin', { plugin: event.pluginName });

      try {
        if (this.registry.isLoaded(event.pluginName)) {
          await this.registry.unloadPlugin(event.pluginName);
        }
      } catch (error) {
        this.logger.error('Failed to unload plugin', {
          plugin: event.pluginName,
          error,
        });
      }
    });

    // Start watching
    this.hotReload.watch().catch((error) => {
      this.logger.error('Failed to start hot-reload watcher', { error });
    });
  }

  /**
   * Load a plugin from file
   */
  async loadPlugin(path: string): Promise<LoadedPlugin> {
    // Check allowlist/blocklist
    const plugin = await this.registry.loadPlugin(path);

    if (this.config.allowlist.length > 0) {
      if (!this.config.allowlist.includes(plugin.manifest.name)) {
        await this.registry.unloadPlugin(plugin.manifest.name);
        throw new PluginError(
          `Plugin ${plugin.manifest.name} not in allowlist`,
          plugin.manifest.name,
          'PLUGIN_PERMISSION_DENIED'
        );
      }
    }

    if (this.config.blocklist.includes(plugin.manifest.name)) {
      await this.registry.unloadPlugin(plugin.manifest.name);
      throw new PluginError(
        `Plugin ${plugin.manifest.name} is blocked`,
        plugin.manifest.name,
        'PLUGIN_PERMISSION_DENIED'
      );
    }

    // Enhance context with real APIs based on permissions
    this.enhancePluginContext(plugin);

    // Initialize stats
    this.stats.set(plugin.manifest.name, {
      pluginName: plugin.manifest.name,
      toolCalls: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      errorCount: 0,
    });

    return plugin;
  }

  /**
   * Enhance plugin context with APIs based on permissions
   */
  private enhancePluginContext(plugin: LoadedPlugin): void {
    const permissions = plugin.manifest.permissions || [];

    // Add Sheets API if permission granted
    if (permissions.includes('sheets.read') || permissions.includes('sheets.write')) {
      plugin.context.sheets = this.createSheetsAPI(plugin.manifest.name, permissions);
    }

    // Add Drive API if permission granted
    if (permissions.includes('drive.read') || permissions.includes('drive.write')) {
      plugin.context.drive = this.createDriveAPI(plugin.manifest.name, permissions);
    }

    // Add Storage API
    plugin.context.storage = this.createStorageAPI(plugin.manifest.name);

    // Add fetch if permission granted
    if (permissions.includes('network.fetch')) {
      plugin.context.fetch = fetch;
    }
  }

  /**
   * Create Sheets API wrapper with quota enforcement
   */
  private createSheetsAPI(pluginName: string, permissions: string[]): SheetsAPI {
    const canRead = permissions.includes('sheets.read');
    const canWrite = permissions.includes('sheets.write');
    const canCreate = permissions.includes('sheets.create');

    const checkQuota = () => {
      if (!this.rateLimiter.checkQuota(pluginName)) {
        throw new PluginError('API quota exceeded', pluginName, 'PLUGIN_QUOTA_EXCEEDED', {
          remaining: this.rateLimiter.getRemainingQuota(pluginName),
        });
      }
    };

    return {
      get: async (spreadsheetId: string, range?: string) => {
        if (!canRead) {
          throw new PluginError(
            'Plugin does not have sheets.read permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        // Actual implementation would call Google API
        return { values: [] };
      },

      update: async (spreadsheetId: string, range: string, values: unknown[][]) => {
        if (!canWrite) {
          throw new PluginError(
            'Plugin does not have sheets.write permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { updatedCells: values.length };
      },

      create: async (title: string) => {
        if (!canCreate) {
          throw new PluginError(
            'Plugin does not have sheets.create permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { spreadsheetId: 'new-id' };
      },

      batchGet: async (spreadsheetId: string, ranges: string[]) => {
        if (!canRead) {
          throw new PluginError(
            'Plugin does not have sheets.read permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { valueRanges: [] };
      },

      batchUpdate: async (spreadsheetId: string, requests: unknown[]) => {
        if (!canWrite) {
          throw new PluginError(
            'Plugin does not have sheets.write permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { replies: [] };
      },
    };
  }

  /**
   * Create Drive API wrapper
   */
  private createDriveAPI(pluginName: string, permissions: string[]): DriveAPI {
    const canRead = permissions.includes('drive.read');
    const canWrite = permissions.includes('drive.write');

    const checkQuota = () => {
      if (!this.rateLimiter.checkQuota(pluginName)) {
        throw new PluginError('API quota exceeded', pluginName, 'PLUGIN_QUOTA_EXCEEDED');
      }
    };

    return {
      get: async (fileId: string) => {
        if (!canRead) {
          throw new PluginError(
            'Plugin does not have drive.read permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { id: fileId, name: 'file' };
      },

      list: async (query?: string) => {
        if (!canRead) {
          throw new PluginError(
            'Plugin does not have drive.read permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { files: [] };
      },

      create: async (metadata: any, content?: Uint8Array) => {
        if (!canWrite) {
          throw new PluginError(
            'Plugin does not have drive.write permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { id: 'new-file-id' };
      },

      update: async (fileId: string, metadata?: any, content?: Uint8Array) => {
        if (!canWrite) {
          throw new PluginError(
            'Plugin does not have drive.write permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return { id: fileId };
      },

      delete: async (fileId: string) => {
        if (!canWrite) {
          throw new PluginError(
            'Plugin does not have drive.write permission',
            pluginName,
            'PLUGIN_PERMISSION_DENIED'
          );
        }
        checkQuota();
        return {};
      },
    };
  }

  /**
   * Create Storage API for plugin-specific data
   */
  private createStorageAPI(pluginName: string): StorageAPI {
    const storage = new Map<string, any>();

    return {
      get: async (key: string) => {
        return storage.get(`${pluginName}:${key}`);
      },

      set: async (key: string, value: any) => {
        storage.set(`${pluginName}:${key}`, value);
      },

      delete: async (key: string) => {
        storage.delete(`${pluginName}:${key}`);
      },

      list: async () => {
        const keys: string[] = [];
        const prefix = `${pluginName}:`;
        for (const key of storage.keys()) {
          if (key.startsWith(prefix)) {
            keys.push(key.slice(prefix.length));
          }
        }
        return keys;
      },

      clear: async () => {
        const prefix = `${pluginName}:`;
        const keysToDelete: string[] = [];
        for (const key of storage.keys()) {
          if (key.startsWith(prefix)) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          storage.delete(key);
        }
      },
    };
  }

  /**
   * Execute a plugin tool handler
   */
  async executeToolHandler(pluginName: string, toolName: string, params: any): Promise<any> {
    const plugin = this.registry.getPlugin(pluginName);
    if (!plugin) {
      throw new PluginError(`Plugin ${pluginName} not found`, pluginName, 'PLUGIN_NOT_FOUND');
    }

    const tool = plugin.tools?.find((t) => t.name === toolName);
    if (!tool) {
      throw new PluginError(
        `Tool ${toolName} not found in plugin ${pluginName}`,
        pluginName,
        'PLUGIN_NOT_FOUND'
      );
    }

    const startTime = Date.now();
    const stats = this.stats.get(pluginName)!;

    try {
      this.logger.debug('Executing plugin tool', { pluginName, toolName, params });

      // Execute handler in sandbox
      // Handler.toString() may produce:
      // - Arrow: "async (params) => {...}" or "(params) => {...}" - valid as expression
      // - Function: "async function name(...) {...}" or "function name(...) {...}" - valid as expression
      // - Method shorthand: "async name(...) {...}" or "name(...) {...}" - NOT valid as expression
      // Convert method shorthand to function expression by adding 'function' keyword
      let handlerStr = tool.handler.toString();
      const isArrow = handlerStr.includes('=>');
      const isFunction = /^(async\s+)?function[\s(]/.test(handlerStr);
      if (!isArrow && !isFunction) {
        // Method shorthand: "async name(...) {" or "name(...) {"
        handlerStr = handlerStr.replace(/^(async\s+)?/, '$1function ');
      }
      const handlerCode = `
        (async () => {
          const handler = (${handlerStr});
          return await handler(params, context);
        })()
      `;

      const result = await this.sandbox.execute(handlerCode, {
        params,
        context: plugin.context,
      });

      // Update stats
      const executionTime = Date.now() - startTime;
      stats.toolCalls++;
      stats.totalExecutionTime += executionTime;
      stats.averageExecutionTime = stats.totalExecutionTime / stats.toolCalls;
      stats.lastExecuted = new Date();

      this.logger.debug('Plugin tool executed successfully', {
        pluginName,
        toolName,
        executionTime,
      });

      return result;
    } catch (error) {
      // Update error stats
      stats.errorCount++;

      this.logger.error('Plugin tool execution failed', {
        pluginName,
        toolName,
        error,
      });

      throw error;
    }
  }

  /**
   * Get plugin statistics
   */
  getPluginStats(pluginName: string): PluginStats | undefined {
    return this.stats.get(pluginName);
  }

  /**
   * Get all plugin statistics
   */
  getAllStats(): PluginStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Shutdown runtime
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down plugin runtime');

    // Stop hot-reload
    if (this.hotReload) {
      await this.hotReload.stop();
    }

    // Unload all plugins
    await this.registry.shutdown();

    // Clean up sandbox
    await this.sandbox.destroy();

    this.logger.info('Plugin runtime shutdown complete');
  }
}
