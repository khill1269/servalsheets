/**
 * ServalSheets - Dependencies Handler
 *
 * Handles sheets_dependencies MCP tool for formula dependency analysis.
 *
 * Actions:
 * - build: Build dependency graph from spreadsheet
 * - analyze_impact: Analyze impact of changing a cell
 * - detect_cycles: Detect circular dependencies
 * - get_dependencies: Get cells a cell depends on
 * - get_dependents: Get cells that depend on a cell
 * - get_stats: Get dependency statistics
 * - export_dot: Export graph as DOT format
 *
 * @category Handlers
 */

import type { sheets_v4 } from 'googleapis';
import { ImpactAnalyzer } from '../analysis/impact-analyzer.js';
import type { SheetsDependenciesInput, SheetsDependenciesOutput } from '../schemas/dependencies.js';
import { logger } from '../utils/logger.js';

/**
 * Dependency analyzer cache
 * Maps spreadsheetId -> ImpactAnalyzer
 */
const analyzerCache = new Map<string, ImpactAnalyzer>();

/**
 * Dependencies handler
 */
export class DependenciesHandler {
  private sheetsApi: sheets_v4.Sheets;

  constructor(sheetsApi: sheets_v4.Sheets) {
    this.sheetsApi = sheetsApi;
  }

  /**
   * Handle sheets_dependencies tool calls
   */
  async handle(input: SheetsDependenciesInput): Promise<SheetsDependenciesOutput> {
    const req = input.request;
    try {
      switch (req.action) {
        case 'build':
          return { response: await this.handleBuild(req) };

        case 'analyze_impact':
          return { response: await this.handleAnalyzeImpact(req) };

        case 'detect_cycles':
          return { response: await this.handleDetectCycles(req) };

        case 'get_dependencies':
          return { response: await this.handleGetDependencies(req) };

        case 'get_dependents':
          return { response: await this.handleGetDependents(req) };

        case 'get_stats':
          return { response: await this.handleGetStats(req) };

        case 'export_dot':
          return { response: await this.handleExportDot(req) };

        default:
          return {
            response: {
              success: false,
              error: {
                code: 'INVALID_PARAMS',
                message: `Unknown action: ${(req as { action: string }).action}`,
                retryable: false,
              },
            },
          };
      }
    } catch (error) {
      logger.error('Dependencies handler error', {
        action: req.action,
        error,
      });

      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: { error: String(error) },
            retryable: false,
          },
        },
      };
    }
  }

  /**
   * Build dependency graph
   */
  private async handleBuild(
    input: Extract<SheetsDependenciesInput['request'], { action: 'build' }>
  ): Promise<SheetsDependenciesOutput['response']> {
    try {
      const { spreadsheetId, sheetNames } = input;

      // Create or reuse analyzer
      let analyzer = analyzerCache.get(spreadsheetId);
      if (!analyzer) {
        analyzer = new ImpactAnalyzer();
        analyzerCache.set(spreadsheetId, analyzer);
      } else {
        // Clear existing graph
        analyzer.clear();
      }

      // Build from spreadsheet
      await analyzer.buildFromSpreadsheet(this.sheetsApi, spreadsheetId, sheetNames);

      const stats = analyzer.getStats();

      return {
        success: true,
        data: {
          spreadsheetId,
          cellCount: stats.totalCells,
          formulaCount: stats.formulaCells,
          message: `Built dependency graph with ${stats.totalCells} cells and ${stats.totalDependencies} dependencies`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to build dependency graph',
          details: { error: String(error) },
          retryable: false,
        },
      };
    }
  }

  /**
   * Analyze impact of changing a cell
   */
  private async handleAnalyzeImpact(
    input: Extract<SheetsDependenciesInput['request'], { action: 'analyze_impact' }>
  ): Promise<SheetsDependenciesOutput['response']> {
    try {
      const { spreadsheetId, cell } = input;

      // Get analyzer (build if not exists)
      let analyzer = analyzerCache.get(spreadsheetId);
      if (!analyzer) {
        analyzer = new ImpactAnalyzer();
        await analyzer.buildFromSpreadsheet(this.sheetsApi, spreadsheetId);
        analyzerCache.set(spreadsheetId, analyzer);
      }

      const impact = analyzer.analyzeImpact(cell);

      return {
        success: true,
        data: impact,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to analyze impact',
          details: { error: String(error) },
          retryable: false,
        },
      };
    }
  }

  /**
   * Detect circular dependencies
   */
  private async handleDetectCycles(
    input: Extract<SheetsDependenciesInput['request'], { action: 'detect_cycles' }>
  ): Promise<SheetsDependenciesOutput['response']> {
    try {
      const { spreadsheetId } = input;

      // Get analyzer (build if not exists)
      let analyzer = analyzerCache.get(spreadsheetId);
      if (!analyzer) {
        analyzer = new ImpactAnalyzer();
        await analyzer.buildFromSpreadsheet(this.sheetsApi, spreadsheetId);
        analyzerCache.set(spreadsheetId, analyzer);
      }

      const circularDependencies = analyzer.detectCircularDependencies();

      return {
        success: true,
        data: { circularDependencies },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to detect cycles',
          details: { error: String(error) },
          retryable: false,
        },
      };
    }
  }

  /**
   * Get dependencies for a cell
   */
  private async handleGetDependencies(
    input: Extract<SheetsDependenciesInput['request'], { action: 'get_dependencies' }>
  ): Promise<SheetsDependenciesOutput['response']> {
    try {
      const { spreadsheetId, cell } = input;

      // Get analyzer (build if not exists)
      let analyzer = analyzerCache.get(spreadsheetId);
      if (!analyzer) {
        analyzer = new ImpactAnalyzer();
        await analyzer.buildFromSpreadsheet(this.sheetsApi, spreadsheetId);
        analyzerCache.set(spreadsheetId, analyzer);
      }

      const impact = analyzer.analyzeImpact(cell);

      return {
        success: true,
        data: { dependencies: impact.dependencies },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get dependencies',
          details: { error: String(error) },
          retryable: false,
        },
      };
    }
  }

  /**
   * Get dependents for a cell
   */
  private async handleGetDependents(
    input: Extract<SheetsDependenciesInput['request'], { action: 'get_dependents' }>
  ): Promise<SheetsDependenciesOutput['response']> {
    try {
      const { spreadsheetId, cell } = input;

      // Get analyzer (build if not exists)
      let analyzer = analyzerCache.get(spreadsheetId);
      if (!analyzer) {
        analyzer = new ImpactAnalyzer();
        await analyzer.buildFromSpreadsheet(this.sheetsApi, spreadsheetId);
        analyzerCache.set(spreadsheetId, analyzer);
      }

      const impact = analyzer.analyzeImpact(cell);

      return {
        success: true,
        data: { dependents: impact.allAffectedCells },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get dependents',
          details: { error: String(error) },
          retryable: false,
        },
      };
    }
  }

  /**
   * Get dependency statistics
   */
  private async handleGetStats(
    input: Extract<SheetsDependenciesInput['request'], { action: 'get_stats' }>
  ): Promise<SheetsDependenciesOutput['response']> {
    try {
      const { spreadsheetId } = input;

      // Get analyzer (build if not exists)
      let analyzer = analyzerCache.get(spreadsheetId);
      if (!analyzer) {
        analyzer = new ImpactAnalyzer();
        await analyzer.buildFromSpreadsheet(this.sheetsApi, spreadsheetId);
        analyzerCache.set(spreadsheetId, analyzer);
      }

      const stats = analyzer.getStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get statistics',
          details: { error: String(error) },
          retryable: false,
        },
      };
    }
  }

  /**
   * Export graph as DOT format
   */
  private async handleExportDot(
    input: Extract<SheetsDependenciesInput['request'], { action: 'export_dot' }>
  ): Promise<SheetsDependenciesOutput['response']> {
    try {
      const { spreadsheetId } = input;

      // Get analyzer (build if not exists)
      let analyzer = analyzerCache.get(spreadsheetId);
      if (!analyzer) {
        analyzer = new ImpactAnalyzer();
        await analyzer.buildFromSpreadsheet(this.sheetsApi, spreadsheetId);
        analyzerCache.set(spreadsheetId, analyzer);
      }

      const dot = analyzer.exportDOT();

      return {
        success: true,
        data: { dot },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to export DOT format',
          details: { error: String(error) },
          retryable: false,
        },
      };
    }
  }
}

/**
 * Create dependencies handler
 */
export function createDependenciesHandler(sheetsApi: sheets_v4.Sheets): DependenciesHandler {
  return new DependenciesHandler(sheetsApi);
}

/**
 * Clear analyzer cache (useful for testing)
 */
export function clearAnalyzerCache(): void {
  analyzerCache.clear();
  logger.debug('Analyzer cache cleared');
}
