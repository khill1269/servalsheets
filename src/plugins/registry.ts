/**
 * ServalSheets - Plugin Registry
 *
 * Plugin discovery, loading, and lifecycle management.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { pathToFileURL } from 'url';
import { PluginError } from './types.js';
import type {
  Plugin,
  LoadedPlugin,
  PluginManifest,
  PluginRegistryConfig,
  PluginContext,
  PluginValidationResult,
} from './types.js';
import { logger as baseLogger } from '../utils/logger.js';

/**
 * Default registry configuration
 */
const DEFAULT_REGISTRY_CONFIG: Required<PluginRegistryConfig> = {
  pluginDir: './plugins',
  autoDiscover: true,
  maxPlugins: 50,
};

/**
 * PluginRegistry - Manages plugin discovery and lifecycle
 */
export class PluginRegistry {
  private config: Required<PluginRegistryConfig>;
  private plugins: Map<string, LoadedPlugin> = new Map();
  private logger = baseLogger.child({ component: 'PluginRegistry' });

  constructor(config: Partial<PluginRegistryConfig> = {}) {
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
  }

  /**
   * Discover all plugins in the plugin directory
   */
  async discoverPlugins(): Promise<PluginManifest[]> {
    this.logger.info('Discovering plugins', { pluginDir: this.config.pluginDir });

    try {
      const manifests: PluginManifest[] = [];
      const files = await this.findPluginFiles(this.config.pluginDir);

      for (const file of files) {
        try {
          const manifest = await this.extractManifest(file);
          if (manifest) {
            manifests.push(manifest);
          }
        } catch (error) {
          this.logger.warn('Failed to extract manifest from plugin file', {
            file,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.logger.info('Plugin discovery complete', { count: manifests.length });
      return manifests;
    } catch (error) {
      this.logger.error('Plugin discovery failed', { error });
      throw new PluginError('Failed to discover plugins', 'unknown', 'PLUGIN_LOAD_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Find all plugin files recursively
   */
  private async findPluginFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findPluginFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          // Check if file is a valid plugin file
          const ext = extname(entry.name);
          if (['.js', '.mjs'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or not accessible
      this.logger.debug('Cannot read plugin directory', { dir, error });
    }

    return files;
  }

  /**
   * Extract plugin manifest from file without loading
   */
  private async extractManifest(filePath: string): Promise<PluginManifest | null> {
    try {
      // Read file to check if it looks like a plugin
      const content = await readFile(filePath, 'utf-8');

      // Basic check for plugin structure
      if (!content.includes('export default') || !content.includes('name')) {
        return null;
      }

      // Try to load the plugin module
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);
      const plugin = module.default as Plugin;

      if (!plugin || typeof plugin !== 'object') {
        return null;
      }

      // Validate manifest
      const validation = this.validateManifest(plugin);
      if (!validation.valid) {
        this.logger.warn('Invalid plugin manifest', {
          file: filePath,
          errors: validation.errors,
        });
        return null;
      }

      return {
        name: plugin.name,
        version: plugin.version,
        author: plugin.author,
        description: plugin.description,
        homepage: plugin.homepage,
        license: plugin.license,
        minServalVersion: plugin.minServalVersion,
        dependencies: plugin.dependencies,
        permissions: plugin.permissions,
      };
    } catch (error) {
      this.logger.debug('Failed to extract manifest', { filePath, error });
      return null;
    }
  }

  /**
   * Load a plugin from file
   */
  async loadPlugin(filePath: string): Promise<LoadedPlugin> {
    this.logger.info('Loading plugin', { filePath });

    try {
      // Check plugin count limit
      if (this.plugins.size >= this.config.maxPlugins) {
        throw new PluginError(
          `Plugin limit reached (${this.config.maxPlugins})`,
          'unknown',
          'PLUGIN_LOAD_FAILED'
        );
      }

      // Load plugin module
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);
      const plugin = module.default as Plugin;

      if (!plugin || typeof plugin !== 'object') {
        throw new PluginError(
          'Invalid plugin: must export default object',
          'unknown',
          'PLUGIN_VALIDATION_FAILED'
        );
      }

      // Validate plugin
      const validation = this.validateManifest(plugin);
      if (!validation.valid) {
        throw new PluginError(
          `Plugin validation failed: ${validation.errors.join(', ')}`,
          plugin.name || 'unknown',
          'PLUGIN_VALIDATION_FAILED',
          { errors: validation.errors, warnings: validation.warnings }
        );
      }

      // Check if already loaded
      if (this.plugins.has(plugin.name)) {
        throw new PluginError(
          `Plugin ${plugin.name} is already loaded`,
          plugin.name,
          'PLUGIN_ALREADY_LOADED'
        );
      }

      // Check dependencies
      await this.checkDependencies(plugin);

      // Create plugin context (without real APIs for now)
      const context = this.createPluginContext(plugin);

      // Build loaded plugin
      const loadedPlugin: LoadedPlugin = {
        manifest: {
          name: plugin.name,
          version: plugin.version,
          author: plugin.author,
          description: plugin.description,
          homepage: plugin.homepage,
          license: plugin.license,
          minServalVersion: plugin.minServalVersion,
          dependencies: plugin.dependencies,
          permissions: plugin.permissions,
        },
        path: filePath,
        tools: plugin.tools,
        resources: plugin.resources,
        prompts: plugin.prompts,
        loadedAt: new Date(),
        context,
        enabled: true,
        lifecycle: {
          onLoad: plugin.onLoad,
          onUnload: plugin.onUnload,
          onConfigUpdate: plugin.onConfigUpdate,
        },
      };

      // Call onLoad hook
      if (loadedPlugin.lifecycle.onLoad) {
        try {
          await loadedPlugin.lifecycle.onLoad(context);
        } catch (error) {
          this.logger.error('Plugin onLoad hook failed', {
            plugin: plugin.name,
            error,
          });
          throw new PluginError('Plugin initialization failed', plugin.name, 'PLUGIN_LOAD_FAILED', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Register plugin
      this.plugins.set(plugin.name, loadedPlugin);

      this.logger.info('Plugin loaded successfully', {
        name: plugin.name,
        version: plugin.version,
        tools: loadedPlugin.tools?.length || 0,
      });

      return loadedPlugin;
    } catch (error) {
      if (error instanceof PluginError) {
        throw error;
      }

      this.logger.error('Failed to load plugin', { filePath, error });
      throw new PluginError('Failed to load plugin', 'unknown', 'PLUGIN_LOAD_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new PluginError(`Plugin ${pluginName} not found`, pluginName, 'PLUGIN_NOT_FOUND');
    }

    this.logger.info('Unloading plugin', { pluginName });

    try {
      // Call onUnload hook
      if (plugin.lifecycle.onUnload) {
        await plugin.lifecycle.onUnload();
      }

      // Remove from registry
      this.plugins.delete(pluginName);

      this.logger.info('Plugin unloaded successfully', { pluginName });
    } catch (error) {
      this.logger.error('Failed to unload plugin', { pluginName, error });
      throw new PluginError('Failed to unload plugin', pluginName, 'PLUGIN_LOAD_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginName: string): Promise<LoadedPlugin> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new PluginError(`Plugin ${pluginName} not found`, pluginName, 'PLUGIN_NOT_FOUND');
    }

    this.logger.info('Reloading plugin', { pluginName });

    // Unload first
    await this.unloadPlugin(pluginName);

    // Clear module cache to force reload
    const fileUrl = pathToFileURL(plugin.path).href;
    delete require.cache[fileUrl];

    // Reload
    return this.loadPlugin(plugin.path);
  }

  /**
   * Get a loaded plugin
   */
  getPlugin(pluginName: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Get all loaded plugin names
   */
  getLoadedPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get all loaded plugin objects
   */
  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if plugin is loaded
   */
  isLoaded(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(plugin: Plugin): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!plugin.name || typeof plugin.name !== 'string') {
      errors.push('Plugin name is required and must be a string');
    } else if (!/^[a-z0-9-]+$/.test(plugin.name)) {
      errors.push('Plugin name must be lowercase alphanumeric with hyphens only');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      errors.push('Plugin version is required and must be a string');
    } else if (!this.isValidSemver(plugin.version)) {
      errors.push('Plugin version must be valid semver (e.g., "1.0.0")');
    }

    if (!plugin.author || typeof plugin.author !== 'string') {
      errors.push('Plugin author is required and must be a string');
    }

    // Optional but recommended fields
    if (!plugin.description) {
      warnings.push('Plugin should have a description');
    }

    if (!plugin.license) {
      warnings.push('Plugin should specify a license');
    }

    // Validate tools
    if (plugin.tools) {
      if (!Array.isArray(plugin.tools)) {
        errors.push('Plugin tools must be an array');
      } else {
        plugin.tools.forEach((tool, index) => {
          if (!tool.name) {
            errors.push(`Tool at index ${index} missing name`);
          }
          if (!tool.handler || typeof tool.handler !== 'function') {
            errors.push(`Tool ${tool.name || index} missing handler function`);
          }
          if (!tool.inputSchema) {
            warnings.push(`Tool ${tool.name || index} missing input schema`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if version string is valid semver
   */
  private isValidSemver(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
    return semverRegex.test(version);
  }

  /**
   * Check plugin dependencies
   */
  private async checkDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return;
    }

    const missing: string[] = [];

    for (const dep of plugin.dependencies) {
      if (!this.plugins.has(dep.name)) {
        missing.push(`${dep.name}@${dep.version}`);
      }
    }

    if (missing.length > 0) {
      throw new PluginError(
        `Missing dependencies: ${missing.join(', ')}`,
        plugin.name,
        'PLUGIN_DEPENDENCY_MISSING',
        { missing }
      );
    }
  }

  /**
   * Create plugin context
   */
  private createPluginContext(plugin: Plugin): PluginContext {
    return {
      pluginName: plugin.name,
      pluginVersion: plugin.version,
      logger: {
        debug: (msg, ...args) => this.logger.debug(`[${plugin.name}] ${msg}`, ...args),
        info: (msg, ...args) => this.logger.info(`[${plugin.name}] ${msg}`, ...args),
        warn: (msg, ...args) => this.logger.warn(`[${plugin.name}] ${msg}`, ...args),
        error: (msg, ...args) => this.logger.error(`[${plugin.name}] ${msg}`, ...args),
      },
      config: {},
      // Real APIs will be added by PluginRuntime based on permissions
    };
  }

  /**
   * Shutdown registry and unload all plugins
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down plugin registry');

    const pluginNames = Array.from(this.plugins.keys());

    for (const name of pluginNames) {
      try {
        await this.unloadPlugin(name);
      } catch (error) {
        this.logger.error('Error unloading plugin during shutdown', {
          plugin: name,
          error,
        });
      }
    }

    this.plugins.clear();
  }
}
