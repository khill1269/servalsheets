/**
 * Context Manager — Session Parameter Inference
 *
 * Tracks active spreadsheet, sheet, range context for MCP Elicitation (SEP-1036).
 * Auto-fills missing parameters during wizard flows.
 * Singleton pattern with stats tracking.
 *
 * @category Services
 */

import { logger } from '../utils/logger.js';

/**
 * Inference context for parameter auto-completion
 */
export interface InferenceContext {
  spreadsheetId?: string;
  sheetId?: number;
  sheetName?: string;
  range?: string;
  lastAction?: string;
  timestamp: number;
}

/**
 * Context Manager — tracks active session context
 */
export class ContextManager {
  private context: InferenceContext = { timestamp: Date.now() };
  private readonly contextTTL = 60 * 60 * 1000; // 1 hour
  private inferenceCount = 0;
  private successCount = 0;

  /**
   * Update context with new values
   */
  updateContext(partial: Partial<InferenceContext>): void {
    this.context = {
      ...this.context,
      ...partial,
      timestamp: Date.now(),
    };
    if (partial.spreadsheetId || partial.sheetId || partial.range) {
      logger.debug('Context updated', { context: this.context });
    }
  }

  /**
   * Get current context
   */
  getContext(): InferenceContext {
    if (this.isContextStale()) {
      this.context = { timestamp: Date.now() };
    }
    return { ...this.context };
  }

  /**
   * Infer missing parameters for elicitation
   */
  inferParameters(required: string[]): Record<string, unknown> {
    this.inferenceCount++;
    const inferred: Record<string, unknown> = {};
    const ctx = this.getContext();

    for (const param of required) {
      switch (param) {
        case 'spreadsheetId':
          if (ctx.spreadsheetId) {
            inferred.spreadsheetId = ctx.spreadsheetId;
            this.successCount++;
          }
          break;
        case 'sheetId':
          if (ctx.sheetId !== undefined) {
            inferred.sheetId = ctx.sheetId;
            this.successCount++;
          }
          break;
        case 'sheetName':
          if (ctx.sheetName) {
            inferred.sheetName = ctx.sheetName;
            this.successCount++;
          }
          break;
        case 'range':
          if (ctx.range) {
            inferred.range = ctx.range;
            this.successCount++;
          }
          break;
      }
    }

    const rate = this.inferenceCount > 0 ? (this.successCount / this.inferenceCount) * 100 : 0;
    logger.debug('Parameter inference', {
      required,
      inferred: Object.keys(inferred),
      successRate: `${rate.toFixed(1)}%`,
    });

    return inferred;
  }

  /**
   * Check if context is stale
   */
  private isContextStale(): boolean {
    return Date.now() - this.context.timestamp > this.contextTTL;
  }

  /**
   * Get inference statistics
   */
  getStats(): { inferred: number; successful: number; rate: number } {
    const rate = this.inferenceCount > 0 ? (this.successCount / this.inferenceCount) * 100 : 0;
    return {
      inferred: this.inferenceCount,
      successful: this.successCount,
      rate,
    };
  }

  /**
   * Reset context (for testing)
   */
  reset(): void {
    this.context = { timestamp: Date.now() };
    this.inferenceCount = 0;
    this.successCount = 0;
    logger.debug('Context manager reset');
  }
}

/**
 * Global context manager singleton
 */
let globalContextManager: ContextManager | null = null;

/**
 * Get global context manager instance
 */
export function getContextManager(): ContextManager {
  if (!globalContextManager) {
    globalContextManager = new ContextManager();
  }
  return globalContextManager;
}

/**
 * Set global context manager (for testing)
 */
export function setContextManager(manager: ContextManager): void {
  globalContextManager = manager;
}

/**
 * Reset global context manager (for testing)
 */
export function resetContextManager(): void {
  globalContextManager = null;
}
