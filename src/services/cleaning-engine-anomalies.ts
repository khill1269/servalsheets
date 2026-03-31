import type { AnomalyMethod } from '../schemas/fix.js';

/**
 * Statistical anomaly detection functions for numeric cell values.
 *
 * Extracted from cleaning-engine-rules.ts (P18-D11 decomposition).
 * Each detector returns a numeric score where higher = stronger anomaly signal.
 * Scores are compared against a per-request threshold.
 */
export const ANOMALY_DETECTORS: Record<
  AnomalyMethod,
  (value: number, allValues: number[], threshold: number) => number
> = {
  iqr: (value, allValues) => {
    const sorted = [...allValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
    const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
    const iqr = q3 - q1;
    if (iqr === 0) return 0;
    return Math.max((q1 - value) / iqr, (value - q3) / iqr, 0);
  },
  zscore: (value, allValues) => {
    const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const std = Math.sqrt(
      allValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allValues.length
    );
    if (std === 0) return 0;
    return Math.abs((value - mean) / std);
  },
  modified_zscore: (value, allValues) => {
    const sorted = [...allValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const mad = (() => {
      const deviations = allValues.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
      return deviations[Math.floor(deviations.length / 2)] ?? 0;
    })();
    if (mad === 0) return 0;
    return Math.abs((0.6745 * (value - median)) / mad);
  },
  /**
   * Isolation Forest anomaly detection (simplified single-feature variant).
   * Reference: Liu, Ting & Zhou (2008) "Isolation Forest"
   * Score >0.6 = potential anomaly. Score compared directly against threshold.
   */
  isolation_forest: (value, allValues, _threshold) => {
    const n = allValues.length;
    if (n < 4) return 0;
    const avgPathLength = (size: number): number => {
      if (size <= 1) return 0;
      if (size === 2) return 1;
      return 2 * (Math.log(size - 1) + 0.5772156649) - (2 * (size - 1)) / size;
    };
    const NUM_TREES = 100;
    const SUBSAMPLE_SIZE = Math.min(256, n);
    const c = avgPathLength(SUBSAMPLE_SIZE);
    if (c === 0) return 0;
    let totalPathLength = 0;
    for (let t = 0; t < NUM_TREES; t++) {
      const subsample: number[] = [];
      for (let i = 0; i < SUBSAMPLE_SIZE; i++) {
        const idx = Math.floor(((t * 7919 + i * 6271 + 1) * 2654435761) % n);
        subsample.push(allValues[Math.abs(idx) % n]!);
      }
      let pathLength = 0;
      let lo = Math.min(...subsample);
      let hi = Math.max(...subsample);
      let currentSize = SUBSAMPLE_SIZE;
      const maxDepth = Math.ceil(Math.log2(SUBSAMPLE_SIZE));
      while (pathLength < maxDepth && lo < hi && currentSize > 1) {
        const splitSeed = ((t * 31 + pathLength * 17 + 1) * 2654435761) >>> 0;
        const splitPoint = lo + ((splitSeed % 10000) / 10000) * (hi - lo);
        if (value < splitPoint) {
          hi = splitPoint;
          const fractionBelow = subsample.filter((v) => v < splitPoint).length / subsample.length;
          currentSize = Math.max(1, Math.floor(currentSize * fractionBelow));
        } else {
          lo = splitPoint;
          const fractionAbove = subsample.filter((v) => v >= splitPoint).length / subsample.length;
          currentSize = Math.max(1, Math.floor(currentSize * fractionAbove));
        }
        pathLength++;
      }
      totalPathLength += pathLength + avgPathLength(currentSize);
    }
    const avgPath = totalPathLength / NUM_TREES;
    return Math.pow(2, -avgPath / c);
  },
};
