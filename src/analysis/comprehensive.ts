/**
 * ServalSheets - Comprehensive Analysis Engine
 *
 * ONE TOOL TO RULE THEM ALL
 *
 * This replaces the need to call:
 * - sheets_core (metadata)
 * - sheets_data (data reading)
 * - sheets_analysis (all 13 actions)
 *
 * Single call provides:
 * - Spreadsheet metadata & structure
 * - All sheet data (sampled or full based on size)
 * - Data quality analysis
 * - Statistical analysis
 * - Pattern detection (trends, anomalies, correlations)
 * - Formula analysis & optimization
 * - Performance recommendations
 * - Visualization suggestions
 * - Natural language summary
 *
 * @see MCP Protocol 2025-11-25
 * @see Google Sheets API v4
 */

import type { sheets_v4 } from 'googleapis';
import { TieredRetrieval } from './tiered-retrieval.js';
import { getCacheAdapter } from '../utils/cache-adapter.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ServiceError } from '../core/errors.js';
import { isHeapCritical } from '../utils/heap-watchdog.js';
import {
  MAX_RESPONSE_SIZE_BYTES,
  // MAX_SHEETS_INLINE, // Reserved for future pagination use
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../config/constants.js';
import { storeAnalysisResult } from '../resources/analyze.js';
import type { AnalyzeResponse } from '../schemas/analyze.js';
import { sendProgress } from '../utils/request-context.js';

// Phase helpers (extracted pure functions)
import { columnToLetter, formatRange } from './phases/helpers.js';
import { analyzeColumns, analyzeQuality } from './phases/structure.js';
import { detectTrends, detectAnomaliesEnhanced, detectCorrelations } from './phases/patterns.js';
import {
  detectVolatileFunctions,
  calculateFormulaComplexity,
  analyzeFormulaIssues,
  suggestOptimization,
  extractDependencies,
} from './phases/formulas.js';
import {
  calculateAggregates,
  generateVisualizationRecommendations,
  analyzePerformance,
  generateSummary,
} from './phases/insights.js';

/**
 * Comprehensive analysis configuration
 */
export interface ComprehensiveConfig {
  /** Include formula analysis */
  includeFormulas?: boolean;
  /** Include visualization recommendations */
  includeVisualizations?: boolean;
  /** Include performance analysis */
  includePerformance?: boolean;
  /** Force full data retrieval (vs sampling) */
  forceFullData?: boolean;
  /** Maximum rows before sampling kicks in */
  samplingThreshold?: number;
  /** Sample size when sampling */
  sampleSize?: number;
  /** Specific sheet to analyze (undefined = all sheets) */
  sheetId?: number;
  /** Additional context for AI analysis */
  context?: string;
  /** Pagination cursor (format: "sheet:N") */
  cursor?: string;
  /** Page size for pagination (default: 5 sheets) */
  pageSize?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Column statistics
 */
export interface ColumnStats {
  name: string;
  index: number;
  dataType: 'number' | 'text' | 'date' | 'boolean' | 'mixed' | 'empty';
  count: number;
  nullCount: number;
  uniqueCount: number;
  completeness: number;
  // Numeric stats (if applicable)
  sum?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  // Text stats (if applicable)
  minLength?: number;
  maxLength?: number;
  avgLength?: number;
}
