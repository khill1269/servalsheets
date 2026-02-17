/**
 * ServalSheets - Hot Reload Manager
 *
 * File watching and automatic plugin reloading without server restart.
 */

import { watch, FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { basename, extname } from 'path';
import type { HotReloadConfig, HotReloadEvent } from './types.js';
import { logger as baseLogger } from '../utils/logger.js';

/**
 * Default hot-reload configuration
 */
const DEFAULT_HOT_RELOAD_CONFIG: Required<HotReloadConfig> = {
  pluginDir: './plugins',
  debounceMs: 100,
  watchPatterns: ['**/*.js', '**/*.mjs'],
  ignorePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.test.js'],
};

/**
 * HotReloadManager - Watches plugin files and triggers reloads
 *
 * Features:
 * - File watching with debouncing
 * - Handles additions, changes, and deletions
 * - Error recovery (keeps old version on failed reload)
 * - Event-based notifications
 */
export interface HotReloadManager {
  on(event: 'reload', listener: (event: HotReloadEvent) => void): this;
  on(event: 'unload', listener: (event: HotReloadEvent) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  emit(event: 'reload', data: HotReloadEvent): boolean;
  emit(event: 'unload', data: HotReloadEvent): boolean;
  emit(event: 'error', error: Error): boolean;
}

export class HotReloadManager extends EventEmitter {
  private config: Required<HotReloadConfig>;
  private watcher?: FSWatcher;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private watching = false;
  private logger = baseLogger.child({ component: 'HotReloadManager' });

  constructor(config: Partial<HotReloadConfig> = {}) {
    super();
    this.config = { ...DEFAULT_HOT_RELOAD_CONFIG, ...config };
  }

  /**
   * Start watching plugin directory
   */
  async watch(): Promise<void> {
    if (this.watching) {
      this.logger.warn('Hot reload already watching');
      return;
    }

    this.logger.info('Starting hot reload watcher', {
      pluginDir: this.config.pluginDir,
      debounceMs: this.config.debounceMs,
    });

    try {
      this.watcher = watch(this.config.pluginDir, {
        ignored: this.config.ignorePatterns,
        persistent: true,
        ignoreInitial: true, // Don't trigger on startup
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      // Set up event handlers
      this.watcher.on('add', (filePath) => this.handleFileAdd(filePath));
      this.watcher.on('change', (filePath) => this.handleFileChange(filePath));
      this.watcher.on('unlink', (filePath) => this.handleFileDelete(filePath));
      this.watcher.on('error', (error) => this.handleWatchError(error as Error));

      await new Promise<void>((resolve, reject) => {
        this.watcher!.on('ready', () => {
          this.watching = true;
          this.logger.info('Hot reload watcher ready');
          resolve();
        });

        this.watcher!.on('error', reject);
      });
    } catch (error) {
      this.logger.error('Failed to start hot reload watcher', { error });
      throw error;
    }
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (!this.watching || !this.watcher) {
      return;
    }

    this.logger.info('Stopping hot reload watcher');

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close watcher
    await this.watcher.close();
    this.watcher = undefined;
    this.watching = false;

    this.logger.info('Hot reload watcher stopped');
  }

  /**
   * Check if file matches plugin patterns
   */
  private isPluginFile(filePath: string): boolean {
    const ext = extname(filePath);
    return ['.js', '.mjs'].includes(ext);
  }

  /**
   * Handle new file added
   */
  private handleFileAdd(filePath: string): void {
    if (!this.isPluginFile(filePath)) return;
    this.logger.debug('Plugin file added', { filePath });

    this.debounce(filePath, () => {
      const pluginName = this.extractPluginName(filePath);

      const event: HotReloadEvent = {
        pluginName,
        reason: 'new-file',
        timestamp: new Date(),
      };

      this.logger.info('New plugin detected', { pluginName, filePath });
      this.emit('reload', event);
    });
  }

  /**
   * Handle file changed
   */
  private handleFileChange(filePath: string): void {
    if (!this.isPluginFile(filePath)) return;
    this.logger.debug('Plugin file changed', { filePath });

    this.debounce(filePath, () => {
      const pluginName = this.extractPluginName(filePath);

      const event: HotReloadEvent = {
        pluginName,
        reason: 'file-change',
        timestamp: new Date(),
      };

      this.logger.info('Plugin change detected', { pluginName, filePath });
      this.emit('reload', event);
    });
  }

  /**
   * Handle file deleted
   */
  private handleFileDelete(filePath: string): void {
    if (!this.isPluginFile(filePath)) return;
    this.logger.debug('Plugin file deleted', { filePath });

    this.debounce(filePath, () => {
      const pluginName = this.extractPluginName(filePath);

      const event: HotReloadEvent = {
        pluginName,
        reason: 'deleted',
        timestamp: new Date(),
      };

      this.logger.info('Plugin deletion detected', { pluginName, filePath });
      this.emit('unload', event);
    });
  }

  /**
   * Handle watch errors
   */
  private handleWatchError(error: Error): void {
    this.logger.error('File watcher error', { error });
    this.emit('error', error);
  }

  /**
   * Debounce file changes to avoid rapid reloads
   */
  private debounce(filePath: string, callback: () => void): void {
    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      callback();
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Extract plugin name from file path
   * Heuristic: use filename without extension
   */
  private extractPluginName(filePath: string): string {
    const name = basename(filePath, extname(filePath));
    return name;
  }

  /**
   * Check if currently watching
   */
  isWatching(): boolean {
    return this.watching;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HotReloadConfig>): void {
    this.config = { ...this.config, ...config };

    // If watching, restart with new config
    if (this.watching) {
      this.stop().then(() => this.watch());
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<HotReloadConfig> {
    return { ...this.config };
  }
}
