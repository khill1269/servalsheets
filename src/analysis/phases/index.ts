/**
 * Re-export facade for comprehensive analysis phase modules
 *
 * Import from this file to get all phase helpers in one import,
 * or import directly from the specific phase file for tree-shaking.
 */

export { columnToLetter, formatRange } from './helpers.js';
export { analyzeColumns, analyzeQuality } from './structure.js';
export { detectTrends, detectAnomaliesEnhanced, detectCorrelations } from './patterns.js';
export {
  detectVolatileFunctions,
  calculateNestingLevel,
  calculateFormulaComplexity,
  analyzeFormulaIssues,
  suggestOptimization,
  extractDependencies,
  buildFormulaInfo,
} from './formulas.js';
export {
  calculateAggregates,
  generateVisualizationRecommendations,
  analyzePerformance,
  generateSummary,
} from './insights.js';
