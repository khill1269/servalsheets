/**
 * ServalSheets - Connector Plugin API
 *
 * Allows third-party npm packages to register as ServalSheets connectors.
 *
 * Plugin package convention:
 *   - package name matches pattern:  servalsheets-connector-* or @scope/servalsheets-connector-*
 *   - main/exports entry exports a default `ConnectorPlugin` object
 *
 * Example plugin package (index.ts):
 *   import type { ConnectorPlugin } from '@serval/sdk'; // or from 'servalsheets/plugin-api'
 *   const plugin: ConnectorPlugin = {
 *     manifest: { id: 'my-api', name: 'My API', version: '1.0.0', authType: 'api_key' },
 *     factory: (credentials) => new MyApiConnector(credentials),
 *   };
 *   export default plugin;
 */

import { logger } from '../utils/logger.js';
import type { SpreadsheetConnector, ConnectorCredentials } from './types.js';

// ============================================================================
// Plugin Manifest
// ============================================================================

export interface ConnectorPluginManifest {
  /** Unique stable ID — used as registry key */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** SemVer version */
  readonly version: string;
  /** Auth mechanism */
  readonly authType: 'api_key' | 'oauth2' | 'none';
  /** Short description shown to users */
  readonly description?: string;
  /** Author/publisher (informational) */
  readonly author?: string;
  /** Homepage or docs URL */
  readonly homepage?: string;
  /** Capabilities the connector declares */
  readonly capabilities?: ReadonlyArray<'query' | 'subscribe' | 'stream' | 'write'>;
  /** Min ServalSheets version required */
  readonly minServerVersion?: string;
}

// ============================================================================
// Plugin Shape
// ============================================================================

/** Factory receives credentials at configure-time and returns a configured connector */
export type ConnectorFactory = (credentials: ConnectorCredentials) => SpreadsheetConnector;

export interface ConnectorPlugin {
  readonly manifest: ConnectorPluginManifest;
  readonly factory: ConnectorFactory;
}

// ============================================================================
// Validation
// ============================================================================

function validateManifest(raw: unknown, packageName: string): ConnectorPluginManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Plugin ${packageName}: manifest must be an object`);
  }
  const m = raw as Record<string, unknown>;
  if (typeof m['id'] !== 'string' || !m['id']) throw new Error(`Plugin ${packageName}: manifest.id is required`);
  if (typeof m['name'] !== 'string' || !m['name']) throw new Error(`Plugin ${packageName}: manifest.name is required`);
  if (typeof m['version'] !== 'string') throw new Error(`Plugin ${packageName}: manifest.version is required`);
  if (!['api_key', 'oauth2', 'none'].includes(m['authType'] as string)) {
    throw new Error(`Plugin ${packageName}: manifest.authType must be 'api_key' | 'oauth2' | 'none'`);
  }
  return m as unknown as ConnectorPluginManifest;
}

function validatePlugin(raw: unknown, packageName: string): ConnectorPlugin {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Plugin ${packageName}: default export must be a ConnectorPlugin object`);
  }
  const p = raw as Record<string, unknown>;
  const manifest = validateManifest(p['manifest'], packageName);
  if (typeof p['factory'] !== 'function') {
    throw new Error(`Plugin ${packageName}: plugin.factory must be a function`);
  }
  return { manifest, factory: p['factory'] as ConnectorFactory };
}

// ============================================================================
// Plugin Loader
// ============================================================================

export interface LoadedPlugin {
  readonly packageName: string;
  readonly plugin: ConnectorPlugin;
  readonly loadedAt: string;
}

export class ConnectorPluginLoader {
  private readonly loaded = new Map<string, LoadedPlugin>();

  /**
   * Dynamically import a connector plugin by npm package name.
   * The package must export a default `ConnectorPlugin` object.
   */
  async load(packageName: string): Promise<LoadedPlugin> {
    if (this.loaded.has(packageName)) {
      return this.loaded.get(packageName)!;
    }

    let mod: unknown;
    try {
      mod = await import(packageName);
    } catch (err) {
      throw new Error(
        `ConnectorPluginLoader: failed to import '${packageName}'. ` +
        `Ensure the package is installed (npm install ${packageName}). ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Support both ESM default export and CJS module.exports
    const raw = (mod as Record<string, unknown>)['default'] ?? mod;
    const plugin = validatePlugin(raw, packageName);

    const entry: LoadedPlugin = {
      packageName,
      plugin,
      loadedAt: new Date().toISOString(),
    };

    this.loaded.set(packageName, entry);
    logger.info('Connector plugin loaded', { packageName, id: plugin.manifest.id, version: plugin.manifest.version });
    return entry;
  }

  /**
   * Load all plugins listed in SERVAL_CONNECTOR_PLUGINS env var (comma-separated package names).
   * Failures are logged but do not abort startup.
   */
  async loadFromEnv(): Promise<LoadedPlugin[]> {
    const raw = process.env['SERVAL_CONNECTOR_PLUGINS'];
    if (!raw) return [];
    const packageNames = raw.split(',').map(s => s.trim()).filter(Boolean);
    const results: LoadedPlugin[] = [];
    for (const pkg of packageNames) {
      try {
        results.push(await this.load(pkg));
      } catch (err) {
        logger.warn('Failed to load connector plugin from env', {
          packageName: pkg,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  get(packageName: string): LoadedPlugin | undefined {
    return this.loaded.get(packageName);
  }

  list(): LoadedPlugin[] {
    return [...this.loaded.values()];
  }

  unload(packageName: string): boolean {
    return this.loaded.delete(packageName);
  }
}

// ============================================================================
// Singleton loader (used by ConnectorManager)
// ============================================================================

let _loader: ConnectorPluginLoader | null = null;

export function getPluginLoader(): ConnectorPluginLoader {
  if (!_loader) _loader = new ConnectorPluginLoader();
  return _loader;
}

export function resetPluginLoader(): void {
  _loader = null;
}
