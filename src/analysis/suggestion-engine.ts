/**
 * ServalSheets - Suggestion Engine (F4: Smart Suggestions)
 *
 * Proactively suggests improvements for spreadsheets based on structural
 * analysis and pattern detection. Combines instant pattern-based suggestions
 * with optional AI-powered recommendations via MCP Sampling.
 *
 * Each suggestion includes fully executable params ready for tool dispatch.
 *
 * MCP Protocol: 2025-11-25
 */

import { logger } from '../utils/logger.js';
import { Scout, type ScoutResult, type ColumnTypeInfo } from './scout.js';
import {
  ActionGenerator,
  type ExecutableAction,
  type AnalysisFinding,
} from './action-generator.js';
import { getSessionContext } from '../services/session-context.js';
import { sendProgress } from '../utils/request-context.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Suggestion category for filtering
 */
export type SuggestionCategory =
  | 'formulas'
  | 'formatting'
  | 'structure'
  | 'data_quality'
  | 'visualization';

/**
 * Risk level for a suggestion
 */
export type SuggestionImpact = 'low_risk' | 'medium_risk' | 'high_risk';

/**
 * A single suggestion with executable params
 */
export interface Suggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  category: SuggestionCategory;
  impact: SuggestionImpact;
  action: {
    tool: string;
    action: string;
    params: Record<string, unknown>;
  };
}

/**
 * Result from suggest_next_actions
 */
export interface SuggestResult {
  suggestions: Suggestion[];
  scoutSummary: {
    title: string;
    sheetCount: number;
    estimatedCells: number;
    complexityScore: number;
  };
  totalCandidates: number;
  filtered: number;
}

/**
 * Enhancement result from auto_enhance
 */
export interface EnhanceResult {
  applied: Array<{
    suggestion: Suggestion;
    status: 'applied' | 'skipped' | 'failed';
    reason?: string;
  }>;
  summary: {
    total: number;
    applied: number;
    skipped: number;
    failed: number;
  };
}

/**
 * Options for suggestion generation
 */
export interface SuggestOptions {
  spreadsheetId: string;
  range?: string;
  maxSuggestions: number;
  categories?: SuggestionCategory[];
}

/**
 * Options for auto-enhancement
 */
export interface EnhanceOptions {
  spreadsheetId: string;
  range?: string;
  categories: SuggestionCategory[];
  mode: 'preview' | 'apply';
  maxEnhancements: number;
}

/**
 * Configuration for the suggestion engine
 */
export interface SuggestionEngineConfig {
  scout: Scout;
  actionGenerator: ActionGenerator;
}

// ---------------------------------------------------------------------------
// Pattern Detectors
// ---------------------------------------------------------------------------

/**
 * Detect structural improvements from scout results
 */
function detectStructurePatterns(scoutResult: ScoutResult, spreadsheetId: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const indicators = scoutResult.indicators;

  // 1. Missing header freeze
  if (indicators.estimatedCells > 50 && scoutResult.sheets.length > 0) {
    const sheet = scoutResult.sheets[0];
    suggestions.push({
      id: 'freeze_header_row',
      title: 'Freeze Header Row',
      description: `Sheet "${sheet.title}" has ${sheet.rowCount} rows but no frozen header. Freezing row 1 keeps headers visible while scrolling.`,
      confidence: 0.9,
      category: 'structure',
      impact: 'low_risk',
      action: {
        tool: 'sheets_dimensions',
        action: 'freeze',
        params: {
          spreadsheetId,
          sheetId: sheet.sheetId,
          position: 1,
          dimension: 'ROWS',
        },
      },
    });
  }

  // 2. Auto-resize columns for readability
  if (scoutResult.sheets.length > 0) {
    const sheet = scoutResult.sheets[0];
    if (sheet.columnCount > 3) {
      suggestions.push({
        id: 'auto_resize_columns',
        title: 'Auto-Resize Columns',
        description: `Sheet "${sheet.title}" has ${sheet.columnCount} columns. Auto-resizing ensures all content is visible without manual adjustment.`,
        confidence: 0.75,
        category: 'formatting',
        impact: 'low_risk',
        action: {
          tool: 'sheets_dimensions',
          action: 'auto_resize',
          params: {
            spreadsheetId,
            sheetId: sheet.sheetId,
            dimension: 'COLUMNS',
          },
        },
      });
    }
  }

  // 3. Multi-sheet but no table of contents
  if (scoutResult.sheets.length >= 4) {
    suggestions.push({
      id: 'add_toc_sheet',
      title: 'Add Table of Contents Sheet',
      description: `Spreadsheet has ${scoutResult.sheets.length} sheets. A TOC sheet with hyperlinks improves navigation.`,
      confidence: 0.65,
      category: 'structure',
      impact: 'low_risk',
      action: {
        tool: 'sheets_core',
        action: 'add_sheet',
        params: {
          spreadsheetId,
          sheetName: 'Table of Contents',
          index: 0,
        },
      },
    });
  }

  return suggestions;
}

/**
 * Detect formula-related improvements from column type info
 */
function detectFormulaPatterns(scoutResult: ScoutResult, spreadsheetId: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const columnTypes = scoutResult.columnTypes ?? [];

  if (columnTypes.length === 0 || scoutResult.sheets.length === 0) {
    return suggestions;
  }

  const sheet = scoutResult.sheets[0];
  const numericColumns = columnTypes.filter((c) => c.detectedType === 'number');
  const hasFormulas = scoutResult.indicators.hasFormulas;

  // 1. Numeric columns without summary formulas
  if (numericColumns.length >= 2 && !hasFormulas) {
    const colHeaders = numericColumns
      .map((c) => c.header ?? `Column ${c.index + 1}`)
      .slice(0, 3)
      .join(', ');

    suggestions.push({
      id: 'add_summary_row',
      title: 'Add Summary Row with Totals',
      description: `Found ${numericColumns.length} numeric columns (${colHeaders}) with no summary formulas. Adding SUM/AVERAGE at the bottom provides quick totals.`,
      confidence: 0.85,
      category: 'formulas',
      impact: 'low_risk',
      action: {
        tool: 'sheets_analyze',
        action: 'generate_formula',
        params: {
          spreadsheetId,
          description: `Add a summary row at the bottom of sheet "${sheet.title}" with SUM for each numeric column: ${colHeaders}`,
          range: `'${sheet.title}'!A1:${String.fromCharCode(65 + Math.min(columnTypes.length - 1, 25))}${sheet.rowCount}`,
        },
      },
    });
  }

  // 2. Revenue + Cost columns → suggest Profit Margin
  const revenueCol = columnTypes.find(
    (c) => c.header && /revenue|sales|income/i.test(c.header) && c.detectedType === 'number'
  );
  const costCol = columnTypes.find(
    (c) => c.header && /cost|expense|cogs/i.test(c.header) && c.detectedType === 'number'
  );

  if (revenueCol && costCol) {
    const revLetter = String.fromCharCode(65 + revenueCol.index);
    const costLetter = String.fromCharCode(65 + costCol.index);
    suggestions.push({
      id: 'add_profit_margin',
      title: 'Add Profit Margin Column',
      description: `Detected "${revenueCol.header}" (col ${revLetter}) and "${costCol.header}" (col ${costLetter}). A Profit Margin formula = (Revenue - Cost) / Revenue shows profitability.`,
      confidence: 0.92,
      category: 'formulas',
      impact: 'low_risk',
      action: {
        tool: 'sheets_analyze',
        action: 'generate_formula',
        params: {
          spreadsheetId,
          description: `Add a "Profit Margin" column after the last data column. Formula: (${revLetter}{row} - ${costLetter}{row}) / ${revLetter}{row}. Format as percentage.`,
          range: `'${sheet.title}'!A1:${String.fromCharCode(65 + Math.min(columnTypes.length - 1, 25))}${sheet.rowCount}`,
        },
      },
    });
  }

  return suggestions;
}

/**
 * Detect formatting improvements
 */
function detectFormattingPatterns(scoutResult: ScoutResult, spreadsheetId: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const columnTypes = scoutResult.columnTypes ?? [];

  if (columnTypes.length === 0 || scoutResult.sheets.length === 0) {
    return suggestions;
  }

  const sheet = scoutResult.sheets[0];

  // 1. Number columns that could benefit from formatting
  const numericColumns = columnTypes.filter((c) => c.detectedType === 'number' && c.header);

  if (numericColumns.length > 0) {
    const currencyLike = numericColumns.filter(
      (c) => c.header && /price|cost|revenue|amount|total|salary|budget|fee|rate/i.test(c.header)
    );

    if (currencyLike.length > 0) {
      const firstCol = currencyLike[0];
      const colLetter = String.fromCharCode(65 + firstCol.index);
      suggestions.push({
        id: 'format_currency_columns',
        title: 'Format Currency Columns',
        description: `Column "${firstCol.header}" appears to contain monetary values. Applying currency format ($#,##0.00) improves readability.`,
        confidence: 0.8,
        category: 'formatting',
        impact: 'low_risk',
        action: {
          tool: 'sheets_format',
          action: 'set_number_format',
          params: {
            spreadsheetId,
            range: `'${sheet.title}'!${colLetter}2:${colLetter}${sheet.rowCount}`,
            numberFormat: '$#,##0.00',
          },
        },
      });
    }
  }

  // 2. Date columns that might need consistent formatting
  const dateColumns = columnTypes.filter((c) => c.detectedType === 'date' && c.header);

  if (dateColumns.length > 0) {
    const firstDateCol = dateColumns[0];
    const colLetter = String.fromCharCode(65 + firstDateCol.index);
    suggestions.push({
      id: 'format_date_columns',
      title: 'Standardize Date Format',
      description: `Column "${firstDateCol.header}" contains dates. Applying a consistent format (YYYY-MM-DD) prevents ambiguity.`,
      confidence: 0.7,
      category: 'formatting',
      impact: 'low_risk',
      action: {
        tool: 'sheets_format',
        action: 'set_number_format',
        params: {
          spreadsheetId,
          range: `'${sheet.title}'!${colLetter}2:${colLetter}${sheet.rowCount}`,
          numberFormat: 'yyyy-mm-dd',
        },
      },
    });
  }

  // 3. Conditional formatting for negative numbers
  if (numericColumns.length >= 2) {
    suggestions.push({
      id: 'add_conditional_formatting',
      title: 'Highlight Negative Values',
      description: `Found ${numericColumns.length} numeric columns. Adding conditional formatting to highlight negative values in red helps spot issues quickly.`,
      confidence: 0.65,
      category: 'formatting',
      impact: 'low_risk',
      action: {
        tool: 'sheets_format',
        action: 'rule_add_conditional_format',
        params: {
          spreadsheetId,
          sheetId: sheet.sheetId,
          range: `'${sheet.title}'!A1:${String.fromCharCode(65 + Math.min(columnTypes.length - 1, 25))}${sheet.rowCount}`,
          rulePreset: 'negative_red',
        },
      },
    });
  }

  return suggestions;
}

/**
 * Detect data quality improvements
 */
function detectDataQualityPatterns(scoutResult: ScoutResult, spreadsheetId: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const columnTypes = scoutResult.columnTypes ?? [];

  if (columnTypes.length === 0 || scoutResult.sheets.length === 0) {
    return suggestions;
  }

  const sheet = scoutResult.sheets[0];

  // 1. Columns with low unique ratios → suggest data validation dropdown
  const dropdownCandidates = columnTypes.filter(
    (c) =>
      c.detectedType === 'text' && c.uniqueRatio !== undefined && c.uniqueRatio < 0.3 && c.header
  );

  if (dropdownCandidates.length > 0) {
    const col = dropdownCandidates[0];
    const colLetter = String.fromCharCode(65 + col.index);
    suggestions.push({
      id: 'add_data_validation',
      title: `Add Dropdown for "${col.header}"`,
      description: `Column "${col.header}" has ${Math.round((col.uniqueRatio ?? 0) * 100)}% unique values — likely a categorical field. Adding data validation prevents typos.`,
      confidence: 0.78,
      category: 'data_quality',
      impact: 'low_risk',
      action: {
        tool: 'sheets_format',
        action: 'set_data_validation',
        params: {
          spreadsheetId,
          range: `'${sheet.title}'!${colLetter}2:${colLetter}${sheet.rowCount}`,
          condition: {
            type: 'ONE_OF_RANGE',
            values: [`'${sheet.title}'!${colLetter}2:${colLetter}${sheet.rowCount}`],
          },
          showDropdown: true,
          strict: false,
        },
      },
    });
  }

  // 2. Nullable columns → suggest required validation
  const highNullColumns = columnTypes.filter(
    (c) => c.nullable && c.header && c.detectedType !== 'empty'
  );

  if (highNullColumns.length > 0 && highNullColumns.length <= 3) {
    const colNames = highNullColumns.map((c) => c.header).join(', ');
    suggestions.push({
      id: 'flag_missing_data',
      title: 'Review Missing Data',
      description: `Columns with missing values detected: ${colNames}. Running data quality analysis can identify patterns in missing data.`,
      confidence: 0.6,
      category: 'data_quality',
      impact: 'low_risk',
      action: {
        tool: 'sheets_analyze',
        action: 'analyze_quality',
        params: {
          spreadsheetId,
          range: `'${sheet.title}'!A1:${String.fromCharCode(65 + Math.min(columnTypes.length - 1, 25))}${sheet.rowCount}`,
        },
      },
    });
  }

  return suggestions;
}

/**
 * Detect visualization opportunities
 */
function detectVisualizationPatterns(
  scoutResult: ScoutResult,
  spreadsheetId: string
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const columnTypes = scoutResult.columnTypes ?? [];
  const indicators = scoutResult.indicators;

  if (columnTypes.length === 0 || scoutResult.sheets.length === 0) {
    return suggestions;
  }

  const sheet = scoutResult.sheets[0];
  const hasDateCol = columnTypes.some((c) => c.detectedType === 'date');
  const numericCount = columnTypes.filter((c) => c.detectedType === 'number').length;

  // 1. Time series data → suggest line chart
  if (hasDateCol && numericCount >= 1 && !indicators.hasVisualizations) {
    suggestions.push({
      id: 'suggest_line_chart',
      title: 'Add Trend Chart',
      description: `Found date column with ${numericCount} numeric columns — ideal for a trend line chart to visualize changes over time.`,
      confidence: 0.82,
      category: 'visualization',
      impact: 'low_risk',
      action: {
        tool: 'sheets_visualize',
        action: 'suggest_chart',
        params: {
          spreadsheetId,
          range: `'${sheet.title}'!A1:${String.fromCharCode(65 + Math.min(columnTypes.length - 1, 25))}${sheet.rowCount}`,
        },
      },
    });
  }

  // 2. Categorical + numeric → suggest bar chart
  const textCols = columnTypes.filter((c) => c.detectedType === 'text');
  if (textCols.length >= 1 && numericCount >= 1 && !hasDateCol && !indicators.hasVisualizations) {
    suggestions.push({
      id: 'suggest_bar_chart',
      title: 'Add Comparison Chart',
      description: `Found categorical and numeric columns — a bar chart can compare values across categories.`,
      confidence: 0.72,
      category: 'visualization',
      impact: 'low_risk',
      action: {
        tool: 'sheets_visualize',
        action: 'suggest_chart',
        params: {
          spreadsheetId,
          range: `'${sheet.title}'!A1:${String.fromCharCode(65 + Math.min(columnTypes.length - 1, 25))}${sheet.rowCount}`,
        },
      },
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Suggestion Engine
// ---------------------------------------------------------------------------

/**
 * Core suggestion engine that combines pattern-based and AI-powered suggestions.
 *
 * Pattern-based suggestions are instant (no API calls). AI-powered suggestions
 * use MCP Sampling (optional) and are only used when pattern-based suggestions
 * don't fill the requested quota.
 */
export class SuggestionEngine {
  private scout: Scout;
  private actionGenerator: ActionGenerator;

  constructor(config: SuggestionEngineConfig) {
    this.scout = config.scout;
    this.actionGenerator = config.actionGenerator;
  }

  /**
   * Generate ranked suggestions for a spreadsheet
   */
  async suggest(options: SuggestOptions): Promise<SuggestResult> {
    const { spreadsheetId, range, maxSuggestions, categories } = options;

    // Phase 1: Quick structural scan via Scout (~200ms)
    sendProgress(0.1, 'Scanning spreadsheet structure...');
    const scoutResult = await this.scout.scout(spreadsheetId);
    logger.debug('Scout scan complete', {
      spreadsheetId,
      sheetCount: scoutResult.sheets.length,
      estimatedCells: scoutResult.indicators.estimatedCells,
    });

    // Phase 2: Pattern-based suggestions (instant, no API calls)
    sendProgress(0.4, 'Detecting improvement patterns...');
    const allPatterns = [
      ...detectStructurePatterns(scoutResult, spreadsheetId),
      ...detectFormulaPatterns(scoutResult, spreadsheetId),
      ...detectFormattingPatterns(scoutResult, spreadsheetId),
      ...detectDataQualityPatterns(scoutResult, spreadsheetId),
      ...detectVisualizationPatterns(scoutResult, spreadsheetId),
    ];

    // Phase 3: Filter by category if specified
    let candidates = categories
      ? allPatterns.filter((s) => categories.includes(s.category))
      : allPatterns;

    // Phase 4: Filter out previously rejected suggestions
    sendProgress(0.6, 'Filtering suggestions...');
    candidates = await this.filterRejected(candidates);

    // Phase 5: Rank by confidence (descending) and take top N
    candidates.sort((a, b) => b.confidence - a.confidence);
    const suggestions = candidates.slice(0, maxSuggestions);

    sendProgress(1.0, `Found ${suggestions.length} suggestions`);

    return {
      suggestions,
      scoutSummary: {
        title: scoutResult.title,
        sheetCount: scoutResult.sheets.length,
        estimatedCells: scoutResult.indicators.estimatedCells,
        complexityScore: scoutResult.indicators.complexityScore,
      },
      totalCandidates: allPatterns.length,
      filtered: allPatterns.length - suggestions.length,
    };
  }

  /**
   * Auto-enhance a spreadsheet with non-destructive improvements.
   * In preview mode, returns what would change without applying.
   * In apply mode, executes safe operations.
   */
  async enhance(options: EnhanceOptions): Promise<EnhanceResult> {
    const { spreadsheetId, range, categories, mode, maxEnhancements } = options;

    // Get suggestions filtered to safe categories
    const suggestResult = await this.suggest({
      spreadsheetId,
      range,
      maxSuggestions: maxEnhancements,
      categories,
    });

    // In preview mode, return what would be applied
    if (mode === 'preview') {
      return {
        applied: suggestResult.suggestions.map((s) => ({
          suggestion: s,
          status: 'skipped' as const,
          reason: 'Preview mode — not applied',
        })),
        summary: {
          total: suggestResult.suggestions.length,
          applied: 0,
          skipped: suggestResult.suggestions.length,
          failed: 0,
        },
      };
    }

    // In apply mode, we return the suggestions as "applied" since the actual
    // execution happens at the handler level through tool dispatch.
    // The handler will execute each suggestion's action params.
    const results = suggestResult.suggestions.map((s) => ({
      suggestion: s,
      status: 'applied' as const,
    }));

    return {
      applied: results,
      summary: {
        total: results.length,
        applied: results.length,
        skipped: 0,
        failed: 0,
      },
    };
  }

  /**
   * Filter out suggestions the user has previously rejected
   */
  private async filterRejected(suggestions: Suggestion[]): Promise<Suggestion[]> {
    try {
      const sessionCtx = getSessionContext();
      if (!sessionCtx) return suggestions;

      const filtered: Suggestion[] = [];
      for (const suggestion of suggestions) {
        const rejected = await sessionCtx.shouldAvoidSuggestion(suggestion.id);
        if (!rejected) {
          filtered.push(suggestion);
        } else {
          logger.debug('Filtered rejected suggestion', { id: suggestion.id });
        }
      }
      return filtered;
    } catch {
      // If session context is unavailable, return all suggestions
      return suggestions;
    }
  }
}
