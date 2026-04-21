/**
 * Background Analysis Service
 *
 * Automatically triggers quality analysis after destructive operations
 * Uses fire-and-forget pattern for non-blocking operation
 *
 * Phase 4: Optional Enhancements - Background Analysis Integration
 */

import type { sheets_v4 } from 'googleapis';
import { logger } from '../utils/logger.js';
import { getSessionContext } from './session-context.js';

interface AnalysisConfig {
  qualityThreshold: number; // Trigger alert if quality drops below this
  minCellsChanged: number; // Only analyze if >= this many cells changed
  debounceMs: number; // Wait this long before analyzing
}

interface BackgroundAnalysisResult {
  qualityScore: number;
  qualityChange: number;
  issuesDetected: number;
  alertTriggered: boolean;
}

export class BackgroundAnalyzer {
  private pendingAnalyses = new Map<string, NodeJS.Timeout>();
  private analysisHistory = new Map<string, number[]>(); // spreadsheetId → quality scores

  private readonly defaultConfig: AnalysisConfig = {
    qualityThreshold: 70,
    minCellsChanged: 10,
    debounceMs: 2000, // Wait 2s to batch multiple writes
  };

  /**
   * Schedule background analysis after a write operation
   * Uses fire-and-forget pattern - doesn't block the write response
   */
  analyzeInBackground(
    spreadsheetId: string,
    range: string,
    cellsAffected: number,
    sheetsApi: sheets_v4.Sheets,
    config: Partial<AnalysisConfig> = {}
  ): void {
    const finalConfig = { ...this.defaultConfig, ...config };

    // Skip if change too small
    if (cellsAffected < finalConfig.minCellsChanged) {
      logger.debug('Skipping background analysis (change too small)', {
        spreadsheetId,
        cellsAffected,
      });
      return;
    }

    // Debounce: cancel pending analysis for this spreadsheet
    const pending = this.pendingAnalyses.get(spreadsheetId);
    if (pending) {
      clearTimeout(pending);
    }

    // Schedule analysis
    const timeout = setTimeout(() => {
      this.performAnalysis(spreadsheetId, range, sheetsApi, finalConfig).catch((err) => {
        logger.warn('Background analysis failed', {
          spreadsheetId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, finalConfig.debounceMs);

    this.pendingAnalyses.set(spreadsheetId, timeout);
  }

  /**
   * Perform the actual analysis (called by timer)
   */
  private async performAnalysis(
    spreadsheetId: string,
    range: string,
    sheetsApi: sheets_v4.Sheets,
    config: AnalysisConfig
  ): Promise<BackgroundAnalysisResult> {
    const startTime = Date.now();
    logger.info('Starting background quality analysis', { spreadsheetId, range });

    try {
      // Lightweight quality check for background monitoring
      // Full comprehensive analysis integration available in sheets_analyze tool
      const qualityScore = await this.performQuickQualityCheck(sheetsApi, spreadsheetId, range);

      // Track history
      const history = this.analysisHistory.get(spreadsheetId) || [];
      const previousScore = history[history.length - 1] || qualityScore;
      history.push(qualityScore);
      if (history.length > 10) history.shift(); // Keep last 10 scores
      this.analysisHistory.set(spreadsheetId, history);

      // Calculate change
      const qualityChange = qualityScore - previousScore;

      // Trigger alert if quality dropped below threshold
      let alertTriggered = false;
      const qualityDropThreshold = 100 - config.qualityThreshold;
      if (qualityScore < config.qualityThreshold || qualityChange < -qualityDropThreshold) {
        const session = getSessionContext();
        session.addAlert({
          severity: qualityChange < -30 ? 'critical' : 'high',
          message: `Data quality dropped from ${previousScore}% to ${qualityScore}% after write to ${range}`,
          spreadsheetId,
          actionable: {
            tool: 'sheets_fix',
            action: 'fix_all',
            params: { spreadsheetId, range, preview: true },
          },
        });
        alertTriggered = true;
        logger.warn('Quality drop alert triggered', {
          spreadsheetId,
          qualityChange,
          range,
        });
      }

      // Store findings for suggestion engine boosting
      const session = getSessionContext();
      session.setRecentAnalysis(spreadsheetId, {
        qualityScore,
        qualityChange,
        range,
        alertTriggered,
      });

      const duration = Date.now() - startTime;
      logger.info('Background analysis complete', {
        spreadsheetId,
        qualityScore,
        qualityChange,
        duration,
      });

      return {
        qualityScore,
        qualityChange,
        issuesDetected: 0, // Lightweight monitoring - full issue detection via sheets_analyze
        alertTriggered,
      };
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Background analysis error', {
        spreadsheetId,
        error: error.message,
      });
      throw error;
    } finally {
      // Cleanup
      this.pendingAnalyses.delete(spreadsheetId);
    }
  }

  /**
   * Perform quick quality check for background monitoring.
   * Reads the affected range with FORMULA render option to detect error cells (#REF!, #N/A, etc.)
   * and computes a quality score based on error cell ratio.
   */
  private async performQuickQualityCheck(
    sheetsApi: sheets_v4.Sheets,
    spreadsheetId: string,
    range: string
  ): Promise<number> {
    logger.debug('Quick quality check for background monitoring', { spreadsheetId, range });

    try {
      const response = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'FORMULA',
        fields: 'values',
      });

      const values = response.data.values;
      if (!values || values.length === 0) {
        return 100; // Empty range — no quality issues
      }

      const errorPatterns = /^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!)/;
      let totalCells = 0;
      let errorCells = 0;
      let emptyCells = 0;

      for (const row of values) {
        for (const cell of row) {
          totalCells++;
          const cellStr = String(cell ?? '');
          if (cellStr === '' || cellStr === null) {
            emptyCells++;
          } else if (errorPatterns.test(cellStr)) {
            errorCells++;
          }
        }
      }

      if (totalCells === 0) return 100;

      // Score: start at 100, deduct 3pts per error cell (max -60), 0.5pt per empty cell (max -20)
      const errorPenalty = Math.min(60, errorCells * 3);
      const emptyPenalty = Math.min(20, emptyCells * 0.5);
      const score = Math.max(0, 100 - errorPenalty - emptyPenalty);

      logger.debug('Quick quality check result', {
        spreadsheetId,
        range,
        totalCells,
        errorCells,
        emptyCells,
        score,
      });

      return Math.round(score);
    } catch (err) {
      logger.debug('Quick quality check failed — returning baseline', {
        spreadsheetId,
        range,
        error: err instanceof Error ? err.message : String(err),
      });
      return 85; // Fallback baseline
    }
  }

  /**
   * Get analysis history for a spreadsheet
   */
  getHistory(spreadsheetId: string): number[] {
    return this.analysisHistory.get(spreadsheetId) || [];
  }

  /**
   * Clear history (for testing)
   */
  clearHistory(spreadsheetId?: string): void {
    if (spreadsheetId) {
      this.analysisHistory.delete(spreadsheetId);
    } else {
      this.analysisHistory.clear();
    }
  }
}

// Singleton instance
let backgroundAnalyzer: BackgroundAnalyzer | undefined;

export function getBackgroundAnalyzer(): BackgroundAnalyzer {
  if (!backgroundAnalyzer) {
    backgroundAnalyzer = new BackgroundAnalyzer();
  }
  return backgroundAnalyzer;
}
