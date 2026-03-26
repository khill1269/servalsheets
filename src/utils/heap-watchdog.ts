/**
 * Heap Watchdog
 *
 * Monitors Node.js heap usage and provides pressure level feedback.
 * Allows handlers to defer non-critical work when memory is constrained.
 */

import { getRequestLogger } from './request-context.js';

export type HeapPressureLevel = 'normal' | 'elevated' | 'critical';

export interface HeapStats {
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  pressureLevel: HeapPressureLevel;
  percentUsed: number;
}

export class HeapWatchdog {
  private pressureLevel: HeapPressureLevel = 'normal';
  private lastCheck: number = Date.now();
  private checkIntervalMs: number = 5000; // 5 seconds
  private logger = getRequestLogger();
  private intervalHandle: NodeJS.Timeout | null = null;

  // Thresholds (% of heap)
  private readonly ELEVATED_THRESHOLD = 80;
  private readonly CRITICAL_THRESHOLD = 90;

  constructor(checkIntervalMs: number = 5000) {
    this.checkIntervalMs = checkIntervalMs;
    this.start();
  }

  start(): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => this.checkHeap(), this.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getPressureLevel(): HeapPressureLevel {
    return this.pressureLevel;
  }

  getStats(): HeapStats {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const externalMb = Math.round((mem.external || 0) / 1024 / 1024);
    const percentUsed = (mem.heapUsed / mem.heapTotal) * 100;

    return {
      heapUsedMb,
      heapTotalMb,
      externalMb,
      pressureLevel: this.pressureLevel,
      percentUsed: Math.round(percentUsed),
    };
  }

  /**
   * Check if handlers should defer work (e.g., analysis, background operations)
   */
  shouldDeferWork(): boolean {
    return this.pressureLevel !== 'normal';
  }

  /**
   * Check if handler should reject new requests
   */
  shouldRejectRequests(): boolean {
    return this.pressureLevel === 'critical';
  }

  private checkHeap(): void {
    const stats = this.getStats();
    const oldLevel = this.pressureLevel;

    if (stats.percentUsed >= this.CRITICAL_THRESHOLD) {
      this.pressureLevel = 'critical';
    } else if (stats.percentUsed >= this.ELEVATED_THRESHOLD) {
      this.pressureLevel = 'elevated';
    } else {
      this.pressureLevel = 'normal';
    }

    if (oldLevel !== this.pressureLevel) {
      this.logger.warn('Heap pressure level changed', {
        oldLevel,
        newLevel: this.pressureLevel,
        ...stats,
      });
    }

    this.lastCheck = Date.now();
  }
}

/**
 * Singleton watchdog instance
 */
let globalWatchdog: HeapWatchdog | null = null;

export function getHeapWatchdog(): HeapWatchdog {
  if (!globalWatchdog) {
    globalWatchdog = new HeapWatchdog();
  }
  return globalWatchdog;
}
