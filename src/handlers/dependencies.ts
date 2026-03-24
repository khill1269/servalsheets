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
 * - model_scenario: Simulate "what if" changes
 * - compare_scenarios: Compare multiple scenarios
 * - create_scenario_sheet: Materialize scenario as new sheet
 *
 * MCP Protocol: 2025-11-25
 */

import { ErrorCodes } from './error-codes.js';
import type { sheets_v4 } from 'googleapis';
import type {
  SheetsDependenciesInput,
  SheetsDependenciesOutput,
  ModelScenarioInput,
  CompareScenariosInput,
  CreateScenarioSheetInput,
  DependenciesResponse,
  DependenciesRequest,
} from '../schemas/index.js';
import type { SamplingServer } from '../mcp/sampling.js';
import { logger } from '../utils/logger.js';
import { sendProgress } from '../utils/request-context.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import {
  AnalyzerLRUCache,
  handleBuild,
  handleAnalyzeImpact,
  handleDetectCycles,
  handleGetDependencies,
  handleGetDependents,
  handleGetStats,
  handleExportDot,
} from './dependencies-actions/analysis.js';
import {
  handleModelScenario,
  handleCompareScenarios,
  handleCreateScenarioSheet,
} from './dependencies-actions/scenario.js';
import type { DependenciesHandlerAccess } from './dependencies-actions/internal.js';

export interface DependenciesHandlerOptions {
  samplingServer?: SamplingServer;
}

/**
 * Dependencies handler — thin dispatcher
 */
export class DependenciesHandler {
  private sheetsApi: sheets_v4.Sheets;
  private samplingServer?: SamplingServer;
  private cache: AnalyzerLRUCache;

  constructor(sheetsApi: sheets_v4.Sheets, options?: DependenciesHandlerOptions) {
    this.sheetsApi = sheetsApi;
    this.samplingServer = options?.samplingServer;
    this.cache = new AnalyzerLRUCache();
  }

  /**
   * Build DependenciesHandlerAccess for submodules
   */
  private buildAccess(): DependenciesHandlerAccess {
    return {
      success: (action: string, data: Record<string, unknown>): DependenciesResponse => ({
        response: {
          success: true,
          action,
          data: {
            action,
            ...data,
          },
        },
      }),
      error: (e): DependenciesResponse => ({
        response: {
          success: false,
          error: e,
        },
      }),
      sheetsApi: this.sheetsApi,
      samplingServer: this.samplingServer,
      sendProgress,
    };
  }

  /**
   * Handle sheets_dependencies tool calls
   */
  async handle(input: SheetsDependenciesInput): Promise<SheetsDependenciesOutput> {
    const req = input.request as DependenciesRequest;
    const access = this.buildAccess();

    try {
      switch (req.action) {
        case 'build':
          return await handleBuild(
            access,
            this.cache,
            req as Extract<DependenciesRequest, { action: 'build' }>
          );

        case 'analyze_impact':
          return await handleAnalyzeImpact(
            access,
            this.cache,
            req as Extract<DependenciesRequest, { action: 'analyze_impact' }>
          );

        case 'detect_cycles':
          return await handleDetectCycles(
            access,
            this.cache,
            req as Extract<DependenciesRequest, { action: 'detect_cycles' }>
          );

        case 'get_dependencies':
          return await handleGetDependencies(
            access,
            this.cache,
            req as Extract<DependenciesRequest, { action: 'get_dependencies' }>
          );

        case 'get_dependents':
          return await handleGetDependents(
            access,
            this.cache,
            req as Extract<DependenciesRequest, { action: 'get_dependents' }>
          );

        case 'get_stats':
          return await handleGetStats(
            access,
            this.cache,
            req as Extract<DependenciesRequest, { action: 'get_stats' }>
          );

        case 'export_dot':
          return await handleExportDot(
            access,
            this.cache,
            req as Extract<DependenciesRequest, { action: 'export_dot' }>
          );

        case 'model_scenario':
          return await handleModelScenario(access, this.cache, req as ModelScenarioInput);

        case 'compare_scenarios':
          return await handleCompareScenarios(access, this.cache, req as CompareScenariosInput);

        case 'create_scenario_sheet':
          return await handleCreateScenarioSheet(access, req as CreateScenarioSheetInput);

        default: {
          const _exhaustiveCheck: never = req;
          return {
            response: {
              success: false,
              error: {
                code: ErrorCodes.INVALID_PARAMS,
                message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
                retryable: false,
                suggestedFix:
                  "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
              },
            },
          };
        }
      }
    } catch (error) {
      logger.error('Dependencies handler error', {
        action: req.action,
        error,
      });

      return {
        response: {
          success: false,
          error: mapStandaloneError(error),
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
  // Cache is instance-scoped, but provide this for backwards compatibility
  logger.debug('Analyzer cache cleared (instance-scoped)');
}
