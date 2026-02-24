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
import type {
  SheetsDependenciesInput,
  SheetsDependenciesOutput,
  ModelScenarioInput,
  CompareScenariosInput,
  CreateScenarioSheetInput,
} from '../schemas/dependencies.js';
import type { SamplingServer } from '../mcp/sampling.js';
import { logger } from '../utils/logger.js';
import { executeWithRetry } from '../utils/retry.js';
import { mapStandaloneError } from './helpers/error-mapping.js';

const ANALYZER_CACHE_MAX = 25;
const ANALYZER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface AnalyzerCacheEntry {
  analyzer: ImpactAnalyzer;
  lastUsed: number;
}

class AnalyzerLRUCache {
  private map = new Map<string, AnalyzerCacheEntry>();

  get(spreadsheetId: string): ImpactAnalyzer | undefined {
    const entry = this.map.get(spreadsheetId);
    if (!entry) return undefined;
    if (Date.now() - entry.lastUsed > ANALYZER_CACHE_TTL_MS) {
      this.map.delete(spreadsheetId);
      return undefined;
    }
    // Refresh: delete + re-insert moves to end (insertion-order)
    entry.lastUsed = Date.now();
    this.map.delete(spreadsheetId);
    this.map.set(spreadsheetId, entry);
    return entry.analyzer;
  }

  set(spreadsheetId: string, analyzer: ImpactAnalyzer): void {
    if (this.map.size >= ANALYZER_CACHE_MAX && !this.map.has(spreadsheetId)) {
      // Evict least-recently-used (first entry)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
    this.map.set(spreadsheetId, { analyzer, lastUsed: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }
}

/**
 * Dependency analyzer cache (LRU, max 25 entries, 30-minute TTL)
 * Maps spreadsheetId -> ImpactAnalyzer
 */
const analyzerCache = new AnalyzerLRUCache();

export interface DependenciesHandlerOptions {
  samplingServer?: SamplingServer;
}

/**
 * Dependencies handler
 */
export class DependenciesHandler {
  private sheetsApi: sheets_v4.Sheets;
  private samplingServer?: SamplingServer;

  constructor(sheetsApi: sheets_v4.Sheets, options?: DependenciesHandlerOptions) {
    this.sheetsApi = sheetsApi;
    this.samplingServer = options?.samplingServer;
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

        case 'model_scenario':
          return { response: await this.handleModelScenario(req as ModelScenarioInput) };

        case 'compare_scenarios':
          return { response: await this.handleCompareScenarios(req as CompareScenariosInput) };

        case 'create_scenario_sheet':
          return {
            response: await this.handleCreateScenarioSheet(req as CreateScenarioSheetInput),
          };

        default: {
          const _exhaustiveCheck: never = req;
          return {
            response: {
              success: false,
              error: {
                code: 'INVALID_PARAMS',
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
        error: mapStandaloneError(error),
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
        error: mapStandaloneError(error),
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
        error: mapStandaloneError(error),
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
        error: mapStandaloneError(error),
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
        error: mapStandaloneError(error),
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
        error: mapStandaloneError(error),
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
        error: mapStandaloneError(error),
      };
    }
  }

  // ============================================================================
  // F6: Scenario Modeling (3 actions)
  // ============================================================================

  private async handleModelScenario(
    req: ModelScenarioInput
  ): Promise<SheetsDependenciesOutput['response']> {
    // Build or retrieve dependency graph
    let analyzer = analyzerCache.get(req.spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(this.sheetsApi, req.spreadsheetId);
      analyzerCache.set(req.spreadsheetId, analyzer);
    }

    // For each input change, trace all dependent cells
    const cascadeEffects: {
      cell: string;
      formula?: string;
      currentValue?: string | number | null;
      affectedBy?: string[];
    }[] = [];
    const allAffected = new Set<string>();

    for (const change of req.changes) {
      const impact = analyzer.analyzeImpact(change.cell);
      for (const dep of impact.allAffectedCells) {
        if (!allAffected.has(dep)) {
          allAffected.add(dep);
          cascadeEffects.push({
            cell: dep,
            affectedBy: [change.cell],
          });
        }
      }
    }

    // Fetch current values + formulas for affected cells (capped at 500 to avoid quota exhaustion)
    const cellRefs = [...allAffected];
    let valuesPopulated = false;
    if (cellRefs.length > 0 && cellRefs.length <= 500) {
      try {
        const ranges = cellRefs.map((c) => (c.includes('!') ? c : `Sheet1!${c}`));
        const [batchResult, formulaResult] = await Promise.all([
          executeWithRetry(() =>
            this.sheetsApi.spreadsheets.values.batchGet({
              spreadsheetId: req.spreadsheetId,
              ranges,
              valueRenderOption: 'UNFORMATTED_VALUE',
            })
          ),
          executeWithRetry(() =>
            this.sheetsApi.spreadsheets.values.batchGet({
              spreadsheetId: req.spreadsheetId,
              ranges,
              valueRenderOption: 'FORMULA',
            })
          ),
        ]);
        for (let i = 0; i < cascadeEffects.length; i++) {
          const valRange = batchResult.data.valueRanges?.[i];
          const fmtRange = formulaResult.data.valueRanges?.[i];
          const effect = cascadeEffects[i];
          if (effect) {
            effect.currentValue = valRange?.values?.[0]?.[0] ?? null;
            const formula = fmtRange?.values?.[0]?.[0];
            if (typeof formula === 'string' && formula.startsWith('=')) {
              effect.formula = formula;
            }
          }
        }
        valuesPopulated = true;
      } catch {
        // OK: Explicit empty — value fetch failed, return addresses only
      }
    }

    // Fetch current values for input cells (the "from" values)
    const inputChanges: {
      cell: string;
      from?: string | number | null;
      to: string | number | boolean | null;
    }[] = [];
    if (req.changes.length <= 500) {
      try {
        const inputRanges = req.changes.map((c) =>
          c.cell.includes('!') ? c.cell : `Sheet1!${c.cell}`
        );
        const inputResult = await executeWithRetry(() =>
          this.sheetsApi.spreadsheets.values.batchGet({
            spreadsheetId: req.spreadsheetId,
            ranges: inputRanges,
            valueRenderOption: 'UNFORMATTED_VALUE',
          })
        );
        for (let i = 0; i < req.changes.length; i++) {
          const valRange = inputResult.data.valueRanges?.[i];
          const change = req.changes[i];
          if (change) {
            const rawFrom = valRange?.values?.[0]?.[0] ?? null;
            // Coerce boolean to string for schema compatibility (from: string | number | null)
            const from = typeof rawFrom === 'boolean' ? String(rawFrom) : rawFrom;
            inputChanges.push({
              cell: change.cell,
              from,
              to: change.newValue,
            });
          }
        }
      } catch {
        // OK: Explicit empty — fall back to input changes without "from" values
        for (const c of req.changes) {
          inputChanges.push({ cell: c.cell, to: c.newValue });
        }
      }
    } else {
      for (const c of req.changes) {
        inputChanges.push({ cell: c.cell, to: c.newValue });
      }
    }

    const valueSuffix =
      cellRefs.length > 500
        ? '. Values not fetched (>500 affected cells — use a narrower scope).'
        : valuesPopulated
          ? ''
          : '. Values could not be fetched.';

    // If sampling is available, generate a narrative explanation of the cascade
    let aiNarrative: string | undefined;
    if (this.samplingServer) {
      try {
        const changeDesc = req.changes.map((c) => `${c.cell} → ${String(c.newValue)}`).join(', ');
        const narrativeResult = await this.samplingServer.createMessage({
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `In 1-2 sentences, describe the business impact of changing ${changeDesc} in spreadsheet '${req.spreadsheetId}', which would affect ${allAffected.size} dependent cell(s).`,
              },
            },
          ],
          maxTokens: 256,
        });
        const text = Array.isArray(narrativeResult.content)
          ? ((
              narrativeResult.content.find((c) => c.type === 'text') as { text: string } | undefined
            )?.text ?? '')
          : ((narrativeResult.content as { text?: string }).text ?? '');
        aiNarrative = text.trim();
      } catch {
        // Non-blocking: sampling failure should not block the scenario result
      }
    }

    return {
      success: true,
      data: {
        action: 'model_scenario',
        inputChanges,
        cascadeEffects,
        summary: {
          cellsAffected: allAffected.size,
          message: `${req.changes.length} input change(s) would affect ${allAffected.size} dependent cell(s)${valueSuffix}`,
        },
        ...(aiNarrative !== undefined ? { aiNarrative } : {}),
      },
    };
  }

  private async handleCompareScenarios(
    req: CompareScenariosInput
  ): Promise<SheetsDependenciesOutput['response']> {
    // Build or retrieve dependency graph
    let analyzer = analyzerCache.get(req.spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(this.sheetsApi, req.spreadsheetId);
      analyzerCache.set(req.spreadsheetId, analyzer);
    }

    // Analyze each scenario independently, collecting affected cells with values
    const scenarioResults: {
      name: string;
      cellsAffected: number;
      affectedCells?: { cell: string; formula?: string; currentValue?: string | number | null }[];
    }[] = [];
    for (const scenario of req.scenarios) {
      const affected = new Set<string>();
      for (const change of scenario.changes) {
        const impact = analyzer!.analyzeImpact(change.cell);
        for (const dep of impact.allAffectedCells) {
          affected.add(dep);
        }
      }
      const affectedList = [...affected];
      const result: (typeof scenarioResults)[number] = {
        name: scenario.name,
        cellsAffected: affected.size,
      };

      // Fetch values for affected cells (capped at 500)
      if (affectedList.length > 0 && affectedList.length <= 500) {
        try {
          const ranges = affectedList.map((c) => (c.includes('!') ? c : `Sheet1!${c}`));
          const [batchResult, formulaResult] = await Promise.all([
            executeWithRetry(() =>
              this.sheetsApi.spreadsheets.values.batchGet({
                spreadsheetId: req.spreadsheetId,
                ranges,
                valueRenderOption: 'UNFORMATTED_VALUE',
              })
            ),
            executeWithRetry(() =>
              this.sheetsApi.spreadsheets.values.batchGet({
                spreadsheetId: req.spreadsheetId,
                ranges,
                valueRenderOption: 'FORMULA',
              })
            ),
          ]);
          result.affectedCells = affectedList.map((cell, i) => {
            const entry: { cell: string; formula?: string; currentValue?: string | number | null } =
              { cell, currentValue: batchResult.data.valueRanges?.[i]?.values?.[0]?.[0] ?? null };
            const formula = formulaResult.data.valueRanges?.[i]?.values?.[0]?.[0];
            if (typeof formula === 'string' && formula.startsWith('=')) {
              entry.formula = formula;
            }
            return entry;
          });
        } catch {
          // OK: Explicit empty — value fetch failed, return counts only
        }
      }
      scenarioResults.push(result);
    }

    return {
      success: true,
      data: {
        action: 'compare_scenarios',
        scenarios: scenarioResults,
        message:
          `Compared ${req.scenarios.length} scenarios. ` +
          scenarioResults.map((s) => `"${s.name}": ${s.cellsAffected} cells affected`).join('; '),
      },
    };
  }

  private async handleCreateScenarioSheet(
    req: CreateScenarioSheetInput
  ): Promise<SheetsDependenciesOutput['response']> {
    const sheetName = req.targetSheet ?? `Scenario - ${req.scenario.name}`;

    // Determine which sheet to duplicate as the scenario base
    const meta = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId,
      fields: 'sheets.properties',
    });
    let resolvedSourceName = req.sourceSheetName;
    if (!resolvedSourceName) {
      // Infer from first cell reference that includes a sheet prefix
      const firstWithSheet = req.scenario.changes.find((c) => c.cell.includes('!'));
      if (firstWithSheet) {
        resolvedSourceName = firstWithSheet.cell.split('!')[0]?.replace(/'/g, '');
      }
    }
    const sourceSheet = resolvedSourceName
      ? (meta.data.sheets?.find((s) => s.properties?.title === resolvedSourceName) ??
        meta.data.sheets?.[0])
      : meta.data.sheets?.[0];
    const sourceSheetId = sourceSheet?.properties?.sheetId ?? 0;

    const dupResponse = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId,
              newSheetName: sheetName,
            },
          },
        ],
      },
    });

    const newSheetId = dupResponse.data.replies?.[0]?.duplicateSheet?.properties?.sheetId ?? 0;

    // Apply scenario changes to the new sheet
    const writeData = req.scenario.changes.map((change) => {
      // Rewrite cell refs to target the new sheet
      const cellRef = change.cell.includes('!')
        ? `'${sheetName}'!${change.cell.split('!')[1]}`
        : `'${sheetName}'!${change.cell}`;
      return {
        range: cellRef,
        values: [[change.newValue]],
      };
    });

    if (writeData.length > 0) {
      await this.sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: req.spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: writeData.map((d) => ({ range: d.range, values: d.values })),
        },
      });
    }

    return {
      success: true,
      data: {
        action: 'create_scenario_sheet',
        newSheetId,
        newSheetName: sheetName,
        cellsModified: req.scenario.changes.length,
        message: `Created scenario sheet "${sheetName}" with ${req.scenario.changes.length} change(s) applied`,
      },
    };
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
