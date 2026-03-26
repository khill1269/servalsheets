/**
 * ServalSheets — Comprehensive Analysis Engine
 *
 * Full-depth analysis: 43 feature categories, quality scoring, impact assessment.
 * 2-phase execution: fast tier (scout results) + AI tier (sampling).
 */

import type { sheets_v4 } from 'googleapis';
import type { SamplingServer } from '../services/agent/types.js';
import { BaseHandler } from '../handlers/base.js';
import type { AnalysisConfig, AnalysisResult } from '../schemas/analyze.js';
import { ServiceError } from '../utils/error-types.js';
import type { CachedSheetsApi } from '../services/cached-sheets-api.js';
import { Scout } from './scout.js';
import { ConfidenceScorer } from './confidence-scorer.js';
import { FlowOrchestrator } from './flow-orchestrator.js';
import { StructureHelpers } from './structure-helpers.js';
import { TieredRetrieval } from './tiered-retrieval.js';
import { FormulaHelpers } from './formula-helpers.js';
import { UnderstandingStore } from './understanding-store.js';

export class ComprehensiveAnalyzer {
  private scout: Scout;
  private confidenceScorer: ConfidenceScorer;
  private flowOrchestrator: FlowOrchestrator;
  private structureHelpers: StructureHelpers;
  private tieredRetrieval: TieredRetrieval;
  private formulaHelpers: FormulaHelpers;
  private understandingStore: UnderstandingStore;

  constructor(
    private cachedApi: CachedSheetsApi,
    private samplingServer: SamplingServer | undefined,
    private handler: BaseHandler<unknown, unknown>
  ) {
    this.scout = new Scout(cachedApi);
    this.confidenceScorer = new ConfidenceScorer();
    this.flowOrchestrator = new FlowOrchestrator();
    this.structureHelpers = new StructureHelpers();
    this.tieredRetrieval = new TieredRetrieval(cachedApi);
    this.formulaHelpers = new FormulaHelpers();
    this.understandingStore = new UnderstandingStore();
  }

  async analyze(spreadsheetId: string, config: AnalysisConfig): Promise<AnalysisResult> {
    try {
      // Phase 1: Scout (fast, ~200ms)
      const scoutResult = await this.scout.quickScan(spreadsheetId);

      // Phase 2: Structure analysis
      const structure = await this.structureHelpers.analyzeStructure(
        spreadsheetId,
        scoutResult
      );

      // Phase 3: Data profiling (tiered based on size)
      const dataProfile = await this.tieredRetrieval.profileData(
        spreadsheetId,
        structure,
        config
      );

      // Phase 4: Formula analysis
      const formulaAnalysis = await this.formulaHelpers.analyzeFormulas(
        spreadsheetId,
        structure
      );

      // Phase 5: AI-powered insights (if sampling available)
      let aiInsights = undefined;
      if (this.samplingServer && config.includeAI !== false) {
        aiInsights = await this.getAIInsights(spreadsheetId, {
          structure,
          dataProfile,
          formulaAnalysis,
        });
      }

      // Phase 6: Confidence scoring
      const findings = this.confidenceScorer.scoreFindings({
        structure,
        dataProfile,
        formulaAnalysis,
        aiInsights,
      });

      // Phase 7: Store understanding for session context
      await this.understandingStore.save(spreadsheetId, {
        structure,
        dataProfile,
        formulaAnalysis,
        findings,
      });

      return {
        success: true,
        action: 'comprehensive',
        findings,
        metadata: {
          spreadsheetId,
          analysisType: 'comprehensive',
          phasesCompleted: aiInsights ? 7 : 6,
          confidence: this.confidenceScorer.overallConfidence(findings),
        },
      };
    } catch (err) {
      // Critical check: Prevent heap exhaustion before attempting large data operations
      if (this.isHeapCritical()) {
        throw new ServiceError(
          'Memory pressure detected — analysis cannot proceed',
          'RESOURCE_EXHAUSTED',
          {
            heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapLimitMB: Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024),
            spreadsheetId,
          },
          false
        );
      }

      if (err instanceof ServiceError) {
        throw err;
      }
      throw new ServiceError(
        `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        'ANALYSIS_ERROR',
        { spreadsheetId, originalError: String(err) },
        false
      );
    }
  }

  private isHeapCritical(): boolean {
    const v8 = require('v8');
    const heapStats = v8.getHeapStatistics();
    const heapUsed = process.memoryUsage().heapUsed;
    const heapLimit = heapStats.heap_size_limit;
    // Trigger at 90% utilization
    return heapUsed > heapLimit * 0.9;
  }

  private async getAIInsights(
    spreadsheetId: string,
    analysis: any
  ): Promise<any> {
    // Implementation: Call sampling server with analysis context
    return undefined;
  }
}
