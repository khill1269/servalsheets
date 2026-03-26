/**
 * Heap pressure monitoring for Node.js
 * Tracks memory usage with configurable thresholds
 */

const HEAP_PRESSURE_THRESHOLD_ELEVATED = 0.8; // 80%
const HEAP_PRESSURE_THRESHOLD_CRITICAL = 0.9; // 90%

interface HeapStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  pressureLevel: 'normal' | 'elevated' | 'critical';
  percentUsed: number;
}

/**
 * Get current heap statistics
 */
export function getHeapStats(): HeapStats {
  if (typeof process === 'undefined' || !process.memoryUsage) {
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      pressureLevel: 'normal',
      percentUsed: 0,
    };
  }

  const mem = process.memoryUsage();
  const percentUsed = mem.heapUsed / mem.heapTotal;
  let pressureLevel: 'normal' | 'elevated' | 'critical' = 'normal';

  if (percentUsed >= HEAP_PRESSURE_THRESHOLD_CRITICAL) {
    pressureLevel = 'critical';
  } else if (percentUsed >= HEAP_PRESSURE_THRESHOLD_ELEVATED) {
    pressureLevel = 'elevated';
  }

  return {
    usedJSHeapSize: mem.heapUsed,
    totalJSHeapSize: mem.heapTotal,
    jsHeapSizeLimit: mem.heapTotal,
    pressureLevel,
    percentUsed: Math.round(percentUsed * 100) / 100,
  };
}

/**
 * Get current heap pressure level
 */
export function getHeapPressureLevel(): 'normal' | 'elevated' | 'critical' {
  return getHeapStats().pressureLevel;
}

/**
 * Check if heap is in critical state
 */
export function isHeapCritical(): boolean {
  return getHeapPressureLevel() === 'critical';
}

/**
 * Check if heap is elevated
 */
export function isHeapElevated(): boolean {
  const level = getHeapPressureLevel();
  return level === 'elevated' || level === 'critical';
}
