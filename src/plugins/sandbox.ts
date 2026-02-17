/**
 * ServalSheets - Plugin Sandbox
 *
 * Secure JavaScript execution environment using Node.js VM module.
 * Provides memory limits, CPU time limits, and isolated contexts.
 */

import vm from 'vm';
import { PluginError } from './types.js';
import type { SandboxConfig } from './types.js';

/**
 * Default sandbox configuration
 */
const DEFAULT_SANDBOX_CONFIG: Required<SandboxConfig> = {
  memoryLimitMB: 50,
  cpuLimitMs: 2000,
  allowedGlobals: ['Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean'],
  asyncTimeoutMs: 5000,
};

/**
 * PluginSandbox - Isolated execution environment for plugin code
 *
 * Security features:
 * - No access to Node.js APIs (require, process, fs, etc.)
 * - Memory limit enforcement via V8 heap statistics
 * - CPU time limit via timeout
 * - Isolated global scope per execution
 * - Allowlist-based global access
 */
export class PluginSandbox {
  private config: Required<SandboxConfig>;
  private baseContext: vm.Context;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.baseContext = this.createBaseContext();
  }

  /**
   * Create isolated base context with safe globals
   */
  private createBaseContext(): vm.Context {
    const context: Record<string, unknown> = {};

    // Add allowed globals
    for (const globalName of this.config.allowedGlobals) {
      // @ts-expect-error - dynamic global access for sandbox
      if (typeof global[globalName] !== 'undefined') {
        // @ts-expect-error - dynamic global assignment
        context[globalName] = global[globalName];
      }
    }

    // Add safe console implementation (no real console access)
    context['console'] = {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
    };

    return vm.createContext(context);
  }

  /**
   * Execute code in sandbox with optional context APIs
   *
   * @param code - JavaScript code to execute
   * @param contextApis - APIs to expose to the code
   * @returns Result of code execution
   * @throws PluginError if execution fails or violates limits
   */
  async execute<T = unknown>(code: string, contextApis: Record<string, unknown> = {}): Promise<T> {
    // Create fresh context for this execution
    const executionContext = this.createExecutionContext(contextApis);

    // Track execution start time for CPU limit
    const startTime = Date.now();

    try {
      // Check memory before execution
      this.checkMemoryLimit();

      // Compile code (catches syntax errors early)
      const script = new vm.Script(code, {
        filename: 'plugin.js',
        lineOffset: 0,
        columnOffset: 0,
      });

      // Execute with timeout
      const result = script.runInContext(executionContext, {
        timeout: this.config.cpuLimitMs,
        breakOnSigint: true,
      });

      // Handle async results (promises)
      if (result && typeof result.then === 'function') {
        const asyncResult = await Promise.race([
          result,
          this.createTimeoutPromise(this.config.asyncTimeoutMs),
        ]);
        return asyncResult as T;
      }

      return result as T;
    } catch (error) {
      // Check if error is due to timeout
      const executionTime = Date.now() - startTime;
      if (executionTime >= this.config.cpuLimitMs) {
        throw new PluginError(
          `Plugin execution exceeded CPU time limit of ${this.config.cpuLimitMs}ms`,
          'unknown',
          'PLUGIN_TIMEOUT',
          { executionTime, limit: this.config.cpuLimitMs }
        );
      }

      // Check if error is due to memory
      if (error instanceof Error && error.message.includes('memory')) {
        throw new PluginError(
          `Plugin execution exceeded memory limit of ${this.config.memoryLimitMB}MB`,
          'unknown',
          'PLUGIN_MEMORY_EXCEEDED',
          { limit: this.config.memoryLimitMB }
        );
      }

      // Propagate other errors with original message
      // Note: VM errors may come from a different realm, so instanceof Error can fail.
      // Check for error-like objects (has message property) in addition to Error instances.
      if (error instanceof Error || (error && typeof (error as any).message === 'string')) {
        const err = error as Error;
        throw new PluginError(err.message, 'unknown', 'PLUGIN_EXECUTION_FAILED', {
          originalError: err.name || 'Error',
        });
      }

      throw new PluginError('Unknown plugin execution error', 'unknown', 'PLUGIN_EXECUTION_FAILED');
    }
  }

  /**
   * Create execution context with provided APIs
   */
  private createExecutionContext(contextApis: Record<string, unknown>): vm.Context {
    const context: Record<string, unknown> = {};

    // Copy allowed globals
    for (const globalName of this.config.allowedGlobals) {
      // @ts-expect-error - dynamic global access for sandbox
      if (typeof global[globalName] !== 'undefined') {
        // @ts-expect-error - dynamic global assignment
        context[globalName] = global[globalName];
      }
    }

    // Add safe console
    context['console'] = {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
    };

    // Add provided APIs (carefully - these are the granted permissions)
    for (const [key, value] of Object.entries(contextApis)) {
      context[key] = value;
    }

    // Block dangerous globals explicitly
    context['require'] = undefined;
    context['process'] = undefined;
    context['global'] = undefined;
    context['globalThis'] = undefined;
    context['__dirname'] = undefined;
    context['__filename'] = undefined;
    context['module'] = undefined;
    context['exports'] = undefined;
    context['import'] = undefined;
    context['eval'] = undefined;
    context['Function'] = undefined;

    return vm.createContext(context);
  }

  /**
   * Check memory usage against limit
   * Note: V8 memory tracking is approximate and best-effort
   */
  private checkMemoryLimit(): void {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    // This is a global check, not per-sandbox
    // In production, you'd want per-isolate tracking
    if (heapUsedMB > this.config.memoryLimitMB * 10) {
      // Allow 10x buffer for shared runtime
      throw new PluginError(
        `Memory usage too high: ${heapUsedMB.toFixed(2)}MB`,
        'unknown',
        'PLUGIN_MEMORY_EXCEEDED',
        { heapUsedMB, limit: this.config.memoryLimitMB }
      );
    }
  }

  /**
   * Create a timeout promise for async operations
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new PluginError(
            `Async operation timed out after ${timeoutMs}ms`,
            'unknown',
            'PLUGIN_TIMEOUT',
            { timeout: timeoutMs }
          )
        );
      }, timeoutMs);
    });
  }

  /**
   * Destroy sandbox and clean up resources
   */
  async destroy(): Promise<void> {
    // VM contexts are garbage collected automatically
    // This method exists for future resource cleanup
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<SandboxConfig> {
    return { ...this.config };
  }
}

/**
 * Create a secure wrapper for async functions
 * Ensures proper timeout and error handling
 */
export function wrapAsyncHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  timeoutMs: number
): T {
  return (async (...args: unknown[]) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new PluginError(`Handler timed out after ${timeoutMs}ms`, 'unknown', 'PLUGIN_TIMEOUT')
        );
      }, timeoutMs);
    });

    return Promise.race([handler(...args), timeoutPromise]);
  }) as T;
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeError(error: unknown): Error {
  if (error instanceof PluginError) {
    return error;
  }

  if (error instanceof Error) {
    // Remove potentially sensitive information from stack traces
    const sanitizedError = new Error(error.message);
    sanitizedError.name = error.name;
    // Don't include full stack trace
    return sanitizedError;
  }

  return new Error('Unknown error occurred in plugin');
}

/**
 * Validate that code doesn't contain obvious escape attempts
 * This is a defense-in-depth measure, not primary security
 */
export function validateCodeSafety(code: string): { safe: boolean; reason?: string } {
  // Check for require() calls
  if (/require\s*\(/.test(code)) {
    return { safe: false, reason: 'Code contains require() call' };
  }

  // Check for process access
  if (/\bprocess\b/.test(code)) {
    return { safe: false, reason: 'Code accesses process global' };
  }

  // Check for eval usage
  if (/\beval\s*\(/.test(code)) {
    return { safe: false, reason: 'Code contains eval() call' };
  }

  // Check for Function constructor
  if (/new\s+Function\s*\(/.test(code)) {
    return { safe: false, reason: 'Code uses Function constructor' };
  }

  // Check for import() calls
  if (/import\s*\(/.test(code)) {
    return { safe: false, reason: 'Code contains dynamic import()' };
  }

  return { safe: true };
}

/**
 * Estimate code complexity (for quota calculation)
 */
export function estimateCodeComplexity(code: string): number {
  let complexity = 1;

  // Count control flow statements
  complexity += (code.match(/\b(if|else|for|while|switch|case)\b/g) || []).length;

  // Count function definitions
  complexity += (code.match(/\bfunction\b|\=\>/g) || []).length;

  // Count async/await usage
  complexity += (code.match(/\b(async|await)\b/g) || []).length;

  // Count loops
  complexity += (code.match(/\b(for|while|do)\b/g) || []).length;

  return complexity;
}
