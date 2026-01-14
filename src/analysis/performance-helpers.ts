/**
 * Performance Analysis Helpers
 *
 * Advanced performance optimization functions for formula analysis:
 * - Volatile formula detection
 * - Full column reference detection
 * - Formula complexity scoring
 * - Circular reference detection
 * - INDIRECT/OFFSET usage
 * - Array formula analysis
 * - Orphaned reference detection
 *
 * These helpers are used by analyze_formulas action for detailed
 * performance auditing and optimization recommendations.
 *
 * Part of Ultimate Analysis Tool - Formula Intelligence capability
 */

// Re-export all formula helpers for convenience
export {
  findVolatileFormulas,
  findFullColumnRefs,
  scoreFormulaComplexity,
  analyzeFormulaComplexity,
  detectCircularRefs,
  findIndirectUsage,
  findArrayFormulas,
  findOrphanedRefs,
  generateOptimizations,
  type VolatileFormula,
  type FullColumnReference,
  type FormulaComplexity,
  type CircularReference,
  type IndirectUsage,
  type ArrayFormula,
  type BrokenReference,
  type OptimizationSuggestion,
} from './formula-helpers.js';
