/**
 * Dependencies Analysis Actions
 *
 * Handles 7 graph analysis and diagnostic actions:
 * - build: Build dependency graph
 * - analyze_impact: Analyze impact of changing a cell
 * - detect_cycles: Detect circular dependencies
 * - get_dependencies: Get cells a cell depends on
 * - get_dependents: Get cells that depend on a cell
 * - get_stats: Get dependency statistics
 * - export_dot: Export graph as DOT format
 */

import { ImpactAnalyzer } from '../../analysis/impact-analyzer.js';
import type { SheetsDependenciesOutput } from '../../schemas/index.js';
import { withSamplingTimeout, assertSamplingConsent, generateAIInsight } from '../../mcp/sampling.js';
import { logger } from '../../utils/logger.js';
import { mapStandaloneError } from '../helpers/error-mapping.js';
import type { DependenciesHandlerAccess, AnalyzerCacheEntry } from './internal.js';

/**
 * Analyzer LRU cache (max 25 entries, 30-minute TTL)
 */
export class AnalyzerLRUCache {
  private map = new Map<string, AnalyzerCacheEntry>();

  get(spreadsheetId: string): ImpactAnalyzer | undefined {
    const entry = this.map.get(spreadsheetId);
    if (!entry) return undefined;
    if (Date.now() - entry.lastUsed > 30 * 60 * 1000) {
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
    if (this.map.size >= 25 && !this.map.has(spreadsheetId)) {
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
 * Build dependency graph
 */
export async function handleBuild(
  access: DependenciesHandlerAccess,
  cache: AnalyzerLRUCache,
  input: { spreadsheetId: string; sheetNames?: string[] }
): Promise<SheetsDependenciesOutput['response']> {
  try {
    const { spreadsheetId, sheetNames } = input;

    // Create or reuse analyzer
    let analyzer = cache.get(spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      cache.set(spreadsheetId, analyzer);
    } else {
      // Clear existing graph
      analyzer.clear();
    }

    // Build from spreadsheet
    await analyzer.buildFromSpreadsheet(access.sheetsApi, spreadsheetId, sheetNames);

    const stats = analyzer.getStats();

    return access.success('build', {
      spreadsheetId,
      cellCount: stats.totalCells,
      formulaCount: stats.formulaCells,
      message: `Built dependency graph with ${stats.totalCells} cells and ${stats.totalDependencies} dependencies`,
    });
  } catch (error) {
    return access.error(mapStandaloneError(error));
  }
}

/**
 * Analyze impact of changing a cell
 */
export async function handleAnalyzeImpact(
  access: DependenciesHandlerAccess,
  cache: AnalyzerLRUCache,
  input: { spreadsheetId: string; cell: string }
): Promise<SheetsDependenciesOutput['response']> {
  try {
    const { spreadsheetId, cell } = input;

    // Get analyzer (build if not exists)
    let analyzer = cache.get(spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(access.sheetsApi, spreadsheetId);
      cache.set(spreadsheetId, analyzer);
    }

    const impact = analyzer.analyzeImpact(cell);

    return access.success('analyze_impact', impact);
  } catch (error) {
    return access.error(mapStandaloneError(error));
  }
}

/**
 * Detect circular dependencies
 */
export async function handleDetectCycles(
  access: DependenciesHandlerAccess,
  cache: AnalyzerLRUCache,
  input: { spreadsheetId: string }
): Promise<SheetsDependenciesOutput['response']> {
  try {
    const { spreadsheetId } = input;

    // Get analyzer (build if not exists)
    let analyzer = cache.get(spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(access.sheetsApi, spreadsheetId);
      cache.set(spreadsheetId, analyzer);
    }

    const circularDependencies = analyzer.detectCircularDependencies();

    // Generate AI insight explaining impact of circular references
    let aiInsight: string | undefined;
    if (access.samplingServer && circularDependencies.length > 0) {
      const cycleDesc = circularDependencies
        .slice(0, 5)
        .map((c) => `Cycle: ${c.chain}`)
        .join('; ');
      aiInsight = await generateAIInsight(
        access.samplingServer,
        'dataAnalysis',
        'Explain the impact of these circular references and how to break them',
        cycleDesc,
        { maxTokens: 400 }
      );
    }

    return access.success('detect_cycles', {
      circularDependencies,
      ...(aiInsight !== undefined ? { aiInsight } : {}),
    });
  } catch (error) {
    return access.error(mapStandaloneError(error));
  }
}

/**
 * Get dependencies for a cell
 */
export async function handleGetDependencies(
  access: DependenciesHandlerAccess,
  cache: AnalyzerLRUCache,
  input: { spreadsheetId: string; cell: string }
): Promise<SheetsDependenciesOutput['response']> {
  try {
    const { spreadsheetId, cell } = input;

    // Get analyzer (build if not exists)
    let analyzer = cache.get(spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(access.sheetsApi, spreadsheetId);
      cache.set(spreadsheetId, analyzer);
    }

    const impact = analyzer.analyzeImpact(cell);

    return access.success('get_dependencies', { dependencies: impact.dependencies });
  } catch (error) {
    return access.error(mapStandaloneError(error));
  }
}

/**
 * Get dependents for a cell
 */
export async function handleGetDependents(
  access: DependenciesHandlerAccess,
  cache: AnalyzerLRUCache,
  input: { spreadsheetId: string; cell: string }
): Promise<SheetsDependenciesOutput['response']> {
  try {
    const { spreadsheetId, cell } = input;

    // Get analyzer (build if not exists)
    let analyzer = cache.get(spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(access.sheetsApi, spreadsheetId);
      cache.set(spreadsheetId, analyzer);
    }

    const impact = analyzer.analyzeImpact(cell);

    return access.success('get_dependents', { dependents: impact.allAffectedCells });
  } catch (error) {
    return access.error(mapStandaloneError(error));
  }
}

/**
 * Get dependency statistics
 */
export async function handleGetStats(
  access: DependenciesHandlerAccess,
  cache: AnalyzerLRUCache,
  input: { spreadsheetId: string }
): Promise<SheetsDependenciesOutput['response']> {
  try {
    const { spreadsheetId } = input;

    // Get analyzer (build if not exists)
    let analyzer = cache.get(spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(access.sheetsApi, spreadsheetId);
      cache.set(spreadsheetId, analyzer);
    }

    const stats = analyzer.getStats();

    // Generate AI insight summarizing dependency health
    let aiInsight: string | undefined;
    if (access.samplingServer) {
      const statsStr = `Total cells: ${stats.totalCells}, Formula cells: ${stats.formulaCells}, Dependencies: ${stats.totalDependencies}, Max depth: ${stats.maxDepth}`;
      aiInsight = await generateAIInsight(
        access.samplingServer,
        'dataAnalysis',
        'Summarize the health of this dependency graph — are there concerning patterns?',
        statsStr,
        { maxTokens: 300 }
      );
    }

    return access.success('get_stats', {
      ...stats,
      ...(aiInsight !== undefined ? { aiInsight } : {}),
    });
  } catch (error) {
    return access.error(mapStandaloneError(error));
  }
}

/**
 * Export graph as DOT format
 */
export async function handleExportDot(
  access: DependenciesHandlerAccess,
  cache: AnalyzerLRUCache,
  input: { spreadsheetId: string }
): Promise<SheetsDependenciesOutput['response']> {
  try {
    const { spreadsheetId } = input;

    // Get analyzer (build if not exists)
    let analyzer = cache.get(spreadsheetId);
    if (!analyzer) {
      analyzer = new ImpactAnalyzer();
      await analyzer.buildFromSpreadsheet(access.sheetsApi, spreadsheetId);
      cache.set(spreadsheetId, analyzer);
    }

    const dot = analyzer.exportDOT();

    return access.success('export_dot', { dot });
  } catch (error) {
    return access.error(mapStandaloneError(error));
  }
}
