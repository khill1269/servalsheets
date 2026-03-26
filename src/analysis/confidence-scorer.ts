/**
 * ServalSheets - Confidence Scoring Engine
 *
 * Multi-layer confidence scoring for spreadsheet understanding.
 * Provides granular confidence metrics across 4 dimensions:
 *
 * 1. STRUCTURE - Headers, layout, sheet organization
 * 2. CONTENT - Data types, patterns, distributions, quality
 * 3. RELATIONSHIPS - Cross-column correlations, formulas, references
 * 4. PURPOSE - Business context, use case, domain detection
 *
 * Confidence scores drive two key behaviors:
 * - LOW confidence triggers elicitation questions (via ElicitationEngine)
 * - HIGH confidence enables autonomous action generation
 *
 * Scoring uses a Bayesian-inspired approach: prior beliefs from structure
 * are updated by evidence from data analysis, creating posterior confidence.
 *
 * MCP Protocol: 2025-11-25
 */

import { logger } from '../utils/logger.js';
import type { ScoutResult, ColumnTypeInfo } from './scout.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Confidence dimension - the four layers of understanding
 */
export type ConfidenceDimension = 'structure' | 'content' | 'relationships' | 'purpose';

/**
 * Confidence level thresholds
 */
export type ConfidenceLevel = 'none' | 'low' | 'moderate' | 'high' | 'very_high';

/**
 * Individual evidence contributing to confidence
 */
export interface ConfidenceEvidence {
  /** What was observed */
  observation: string;
  /** Weight of this evidence (0-1) */
  weight: number;
  /** Whether this is positive (increases confidence) or negative (decreases) */
  direction: 'positive' | 'negative' | 'neutral';
  /** Source of the evidence */
  source: 'metadata' | 'structure' | 'data_sample' | 'full_data' | 'user_input' | 'inference';
}

/**
 * Per-dimension confidence score with evidence trail
 */
export interface DimensionScore {
  dimension: ConfidenceDimension;
  score: number; // 0-100
  level: ConfidenceLevel;
  evidence: ConfidenceEvidence[];
  /** What's missing that would increase confidence */
  gaps: string[];
  /** What questions could fill the gaps */
  suggestedQuestions: string[];
}

/**
 * Per-column confidence breakdown
 */
export interface ColumnConfidence {
  columnIndex: number;
  header: string | null;
  typeConfidence: number; // How sure we are about the data type
  purposeConfidence: number; // How sure we are about what this column represents
  qualityConfidence: number; // How sure we are about the data quality assessment
  overallConfidence: number;
  gaps: string[];
}

/**
 * Complete confidence assessment for a spreadsheet
 */
export interface ConfidenceAssessment {
  /** Spreadsheet being assessed */
  spreadsheetId: string;
  /** Overall confidence (weighted average of dimensions) */
  overallScore: number;
  overallLevel: ConfidenceLevel;
  /** Per-dimension breakdown */
  dimensions: DimensionScore[];
  /** Per-column breakdown (for active sheet) */
  columns?: ColumnConfidence[];
  /** Whether we should ask the user questions */
  shouldElicit: boolean;
  /** Priority-ordered gaps across all dimensions */
  topGaps: Array<{
    dimension: ConfidenceDimension;
    gap: string;
    impactOnConfidence: number; // How much filling this gap would increase score
    question: string;
  }>;
  /** What analysis tier was used to generate this */
  dataTier: number;
  /** Timestamp */
  assessedAt: number;
}

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * Configurable confidence thresholds.
 * Override via environment variables:
 *   CONFIDENCE_THRESHOLD_LOW (default 10)
 *   CONFIDENCE_THRESHOLD_MODERATE (default 35)
 *   CONFIDENCE_THRESHOLD_HIGH (default 65)
 *   CONFIDENCE_THRESHOLD_VERY_HIGH (default 85)
 */
function getConfidenceThresholds(): Record<ConfidenceLevel, [number, number]> {
  // Session 110 fix: NaN-safe parseInt with fallback
  const low = (parseInt(process.env['CONFIDENCE_THRESHOLD_LOW'] ?? '10', 10) || 10);
  const moderate = (parseInt(process.env['CONFIDENCE_THRESHOLD_MODERATE'] ?? '35', 10) || 35);
  const high = (parseInt(process.env['CONFIDENCE_THRESHOLD_HIGH'] ?? '65', 10) || 65);
  const veryHigh = (parseInt(process.env['CONFIDENCE_THRESHOLD_VERY_HIGH'] ?? '85', 10) || 85);
  return {
    none: [0, low],
    low: [low, moderate],
    moderate: [moderate, high],
    high: [high, veryHigh],
    very_high: [veryHigh, 100],
  };
}

/**
 * Configurable dimension weights for overall score.
 * Override via environment variables:
 *   DIMENSION_WEIGHT_STRUCTURE (default 0.3)
 *   DIMENSION_WEIGHT_CONTENT (default 0.3)
 *   DIMENSION_WEIGHT_RELATIONSHIPS (default 0.2)
 *   DIMENSION_WEIGHT_PURPOSE (default 0.2)
 */
function getDimensionWeights(): Record<ConfidenceDimension, number> {
  return {
    structure: parseFloat(process.env['DIMENSION_WEIGHT_STRUCTURE'] ?? '0.3'),
    content: parseFloat(process.env['DIMENSION_WEIGHT_CONTENT'] ?? '0.3'),
    relationships: parseFloat(process.env['DIMENSION_WEIGHT_RELATIONSHIPS'] ?? '0.2'),
    purpose: parseFloat(process.env['DIMENSION_WEIGHT_PURPOSE'] ?? '0.2'),
  };
}

/**
 * Threshold below which we should ask questions.
 * Override via ELICITATION_THRESHOLD env var (default 55).
 */
function getElicitationThreshold(): number {
  // Session 110 fix: NaN-safe parseInt with fallback
  return (parseInt(process.env['ELICITATION_THRESHOLD'] ?? '55', 10) || 55);
}

// Cached references (evaluated once at first use)
let _confidenceThresholds: Record<ConfidenceLevel, [number, number]> | null = null;
let _dimensionWeights: Record<ConfidenceDimension, number> | null = null;
let _elicitationThreshold: number | null = null;

const CONFIDENCE_THRESHOLDS = (): Record<ConfidenceLevel, [number, number]> =>
  (_confidenceThresholds ??= getConfidenceThresholds());
const DIMENSION_WEIGHTS = (): Record<ConfidenceDimension, number> =>
  (_dimensionWeights ??= getDimensionWeights());
const ELICITATION_THRESHOLD = (): number => (_elicitationThreshold ??= getElicitationThreshold());

// ============================================================================
// SCORER
// ============================================================================

/**
 * Multi-layer confidence scorer for spreadsheet understanding
 */
export class ConfidenceScorer {
  /**
   * Score confidence from a scout result (Tier 1-2 data)
   */
  scoreFromScout(scoutResult: ScoutResult): ConfidenceAssessment {
    const startTime = Date.now();

    logger.info('ConfidenceScorer: Scoring from scout result', {
      spreadsheetId: scoutResult.spreadsheetId,
      sheetCount: scoutResult.sheets.length,
    });

    const dimensions: DimensionScore[] = [
      this.scoreStructure(scoutResult),
      this.scoreContentFromScout(scoutResult),
      this.scoreRelationshipsFromScout(scoutResult),
      this.scorePurposeFromScout(scoutResult),
    ];

    const columns = scoutResult.columnTypes
      ? this.scoreColumnsFromScout(scoutResult.columnTypes)
      : undefined;
