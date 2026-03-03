import type { sheets_v4 } from 'googleapis';
import { ActionGenerator, type AnalysisFinding, type GenerateActionsResult } from '../../analysis/action-generator.js';
import { FlowOrchestrator } from '../../analysis/flow-orchestrator.js';
import { Planner, type AnalysisPlan } from '../../analysis/planner.js';
import { Scout, type ScoutResult } from '../../analysis/scout.js';
import { generateAIInsight, type SamplingServer } from '../../mcp/sampling.js';
import type { AnalyzeResponse } from '../../schemas/analyze.js';
import { getSessionContext } from '../../services/session-context.js';
import { getCacheAdapter } from '../../utils/cache-adapter.js';
import { logger } from '../../utils/logger.js';

type PlanRequest = {
  spreadsheetId: string;
  intent?: ScoutResult['detectedIntent'];
  scoutResult?: unknown;
};

type ExecutePlanRequest = {
  spreadsheetId: string;
  plan: {
    steps: Array<{ type: string }>;
  };
};

type DrillDownTarget =
  | { type: 'issue'; issueId: string }
  | { type: 'sheet'; sheetIndex: number }
  | { type: 'column'; column: string }
  | { type: 'formula'; cell: string }
  | { type: 'pattern'; patternId: string }
  | { type: 'anomaly'; anomalyId: string }
  | { type: 'correlation'; columns: string[] };

type DrillDownRequest = {
  spreadsheetId: string;
  target: DrillDownTarget;
  limit?: number;
};

type GenerateActionsRequest = {
  spreadsheetId: string;
  intent?: string;
  findings?: unknown;
  maxActions?: number;
};

function mapActionToStepType(
  action: string
): 'quality' | 'formulas' | 'patterns' | 'performance' | 'structure' | 'visualizations' {
  const mapping: Record<
    string,
    'quality' | 'formulas' | 'patterns' | 'performance' | 'structure' | 'visualizations'
  > = {
    analyze_quality: 'quality',
    analyze_formulas: 'formulas',
    detect_patterns: 'patterns',
    analyze_performance: 'performance',
    analyze_structure: 'structure',
    suggest_visualization: 'visualizations',
    comprehensive: 'quality',
    analyze_data: 'patterns',
  };
  return mapping[action] ?? 'quality';
}

function mapPriorityToSchema(priority: number): 'critical' | 'high' | 'medium' | 'low' {
  if (priority <= 1) return 'critical';
  if (priority <= 3) return 'high';
  if (priority <= 6) return 'medium';
  return 'low';
}

/**
 * Decomposed action handler for `plan`.
 * Preserves original behavior while moving logic out of the main AnalyzeHandler class.
 */
export async function handlePlanAction(
  input: PlanRequest,
  sheetsApi: sheets_v4.Sheets
): Promise<AnalyzeResponse> {
  logger.info('Plan action - AI-assisted analysis planning', {
    spreadsheetId: input.spreadsheetId,
    intent: input.intent,
  });

  try {
    let scoutResult: ScoutResult;
    if (input.scoutResult) {
      scoutResult = input.scoutResult as ScoutResult;
    } else {
      const cache = getCacheAdapter('analysis');
      const scoutInstance = new Scout({
        cache,
        sheetsApi,
      });
      scoutResult = await scoutInstance.scout(input.spreadsheetId);
    }

    const planner = new Planner({
      maxSteps: 10,
      includeOptional: true,
    });
    const plan: AnalysisPlan = planner.createPlan(scoutResult, undefined, input.intent);

    const mappedSteps = plan.steps.map((step, idx) => ({
      order: idx + 1,
      type: mapActionToStepType(step.action),
      priority: mapPriorityToSchema(step.sequence),
      target: step.params['sheetId']
        ? { sheets: [step.params['sheetId'] as number] }
        : step.params['range']
          ? { range: step.params['range'] as string }
          : undefined,
      estimatedDuration: `${Math.round(step.estimatedLatencyMs / 1000)}s`,
      reason: step.description,
      outputs: [step.title],
    }));

    return {
      success: true,
      action: 'plan',
      plan: {
        id: plan.planId,
        intent: plan.intent,
        steps: mappedSteps,
        estimatedTotalDuration: `${Math.round(plan.totalEstimatedLatencyMs / 1000)}s`,
        estimatedApiCalls: plan.steps.length,
        confidenceScore: Math.round(scoutResult.intentConfidence * 100),
        rationale: plan.description,
        skipped: [],
      },
      duration: Date.now() - plan.metadata.createdAt,
      message: `Analysis plan created: ${plan.steps.length} steps, ~${Math.round(plan.totalEstimatedLatencyMs / 1000)}s estimated`,
    };
  } catch (error) {
    logger.error('Plan creation failed', {
      spreadsheetId: input.spreadsheetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          'Plan creation failed. The AI analysis service may be temporarily unavailable. Please try again.',
        retryable: true,
      },
    };
  }
}

/**
 * Decomposed action handler for `execute_plan`.
 * Preserves original behavior while moving logic out of the main AnalyzeHandler class.
 */
export async function handleExecutePlanAction(input: ExecutePlanRequest): Promise<AnalyzeResponse> {
  logger.info('Execute plan action', {
    spreadsheetId: input.spreadsheetId,
    steps: input.plan.steps.length,
  });

  const planSteps = input.plan.steps || [];
  const stepResults = planSteps.map((step, idx) => ({
    stepIndex: idx,
    type: step.type,
    status: 'completed' as const,
    duration: 0,
    findings: {},
    issuesFound: 0,
  }));

  return {
    success: true,
    action: 'execute_plan',
    stepResults,
    summary: `Plan ready: ${planSteps.length} steps to execute`,
    message: `Plan ready for execution: ${planSteps.length} steps. Execute each step sequentially using sheets_analyze with the specified action.`,
  };
}

/**
 * Decomposed action handler for `drill_down`.
 * Preserves original behavior while moving logic out of the main AnalyzeHandler class.
 */
export async function handleDrillDownAction(
  input: DrillDownRequest,
  samplingServer?: SamplingServer
): Promise<AnalyzeResponse> {
  logger.info('Drill down action', {
    spreadsheetId: input.spreadsheetId,
    targetType: input.target.type,
  });

  try {
    const targetType = input.target.type;
    let targetId = '';

    switch (targetType) {
      case 'issue':
        targetId = input.target.issueId;
        break;
      case 'sheet':
        targetId = String(input.target.sheetIndex);
        break;
      case 'column':
        targetId = input.target.column;
        break;
      case 'formula':
        targetId = input.target.cell;
        break;
      case 'pattern':
        targetId = input.target.patternId;
        break;
      case 'anomaly':
        targetId = input.target.anomalyId;
        break;
      case 'correlation':
        targetId = input.target.columns.join('-');
        break;
    }

    const drillDownContext = {
      targetType,
      targetId,
      spreadsheetId: input.spreadsheetId,
    };
    const aiInsightDrill = await generateAIInsight(
      samplingServer,
      'dataAnalysis',
      'Based on this drill-down analysis, suggest the most promising next direction to explore',
      drillDownContext
    );

    return {
      success: true,
      action: 'drill_down',
      drillDownResult: {
        targetType,
        targetId,
        context: {
          spreadsheetId: input.spreadsheetId,
          ...(input.limit !== undefined ? { limit: input.limit } : {}),
        },
        details: {
          type: targetType,
          id: targetId,
          analysisReady: true,
        },
        relatedItems: [],
        suggestions: [
          `Run sheets_analyze:analyze_${targetType === 'sheet' ? 'structure' : targetType === 'formula' ? 'formulas' : 'quality'} for detailed analysis`,
          'Use sheets_analyze:detect_patterns to find related patterns',
        ],
      },
      aiInsight: aiInsightDrill,
      message: `Drill-down result for ${targetType}: ${targetId}`,
    };
  } catch (drillError) {
    logger.error('Drill-down analysis failed', {
      error: drillError instanceof Error ? drillError.message : String(drillError),
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          'Drill-down analysis failed. The AI analysis service may be temporarily unavailable. Please try again.',
        retryable: true,
      },
    };
  }
}

/**
 * Decomposed action handler for `generate_actions`.
 * Preserves original behavior while moving logic out of the main AnalyzeHandler class.
 */
export async function handleGenerateActionsAction(
  input: GenerateActionsRequest
): Promise<AnalyzeResponse> {
  logger.info('Generate actions', { spreadsheetId: input.spreadsheetId, intent: input.intent });

  try {
    const analysisFindings: AnalysisFinding[] = [];

    if (input.findings) {
      const findingsData = input.findings as Record<string, unknown>;
      if (findingsData['issues'] && Array.isArray(findingsData['issues'])) {
        for (const issue of findingsData['issues']) {
          const issueObj = issue as Record<string, unknown>;
          analysisFindings.push({
            id: `issue_${analysisFindings.length}`,
            type: 'issue',
            severity:
              (issueObj['severity'] as 'info' | 'warning' | 'error' | 'critical') ?? 'warning',
            title: (issueObj['title'] as string) ?? 'Issue',
            description: (issueObj['description'] as string) ?? '',
            location: issueObj['location'] as AnalysisFinding['location'],
            data: issueObj['data'] as Record<string, unknown>,
          });
        }
      }
    }

    const generator = new ActionGenerator();
    const result: GenerateActionsResult = generator.generateActions({
      spreadsheetId: input.spreadsheetId,
      findings: analysisFindings,
      maxActions: input.maxActions ?? 10,
    });

    const response: AnalyzeResponse = {
      success: true,
      action: 'generate_actions',
      actionPlan: {
        totalActions: result.actions.length,
        estimatedTotalImpact: `${result.summary.actionableFindings} issues addressed`,
        actions: result.actions.map((a) => ({
          id: a.id,
          priority: a.priority,
          tool: a.tool,
          action: a.action,
          params: a.params,
          title: a.title,
          description: a.description,
          risk: a.risk,
          reversible: a.reversible,
          requiresConfirmation: a.requiresConfirmation,
          category: a.category,
        })) as unknown as NonNullable<
          NonNullable<Extract<AnalyzeResponse, { success: true }>['actionPlan']>['actions']
        >,
      },
      message: `Generated ${result.actions.length} actions from ${result.summary.totalFindings} findings`,
    };

    try {
      const orchestrator = new FlowOrchestrator();
      const store = getSessionContext().understandingStore;
      const summary = store.getSummary(input.spreadsheetId);
      const suggestions = orchestrator.suggestMultiToolChains(summary, {
        tool: 'sheets_analyze',
        action: 'generate_actions',
      });
      if (suggestions.length > 0) {
        (response as Record<string, unknown>)['suggestedFlows'] = suggestions.map((s) => ({
          title: s.title,
          reason: s.reason,
          steps: s.toolChain.map((t) => `${t.tool}.${t.action}`),
          confidence: s.confidence,
        }));
      }
    } catch (intelligenceErr) {
      logger.warn('Intelligence cluster flow suggestions failed (non-critical)', {
        spreadsheetId: input.spreadsheetId,
        error: intelligenceErr instanceof Error ? intelligenceErr.message : String(intelligenceErr),
      });
    }

    return response;
  } catch (error) {
    logger.error('Generate actions failed', {
      spreadsheetId: input.spreadsheetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          'Action generation failed. The AI analysis service may be temporarily unavailable. Please try again.',
        retryable: true,
      },
    };
  }
}
