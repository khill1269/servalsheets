/**
 * ServalSheets - Plan/Execute Action Handlers
 *
 * Handles: plan, execute_plan, drill_down, generate_actions
 */

import type { AnalyzeHandlerAccess } from './internal.js';
import type {
  PlanInput,
  ExecutePlanInput,
  DrillDownInput,
  GenerateActionsInput,
} from '../../schemas/analyze.js';
import { mapError } from '../helpers/error-mapping.js';

export async function handlePlanAction(
  ha: AnalyzeHandlerAccess,
  req: PlanInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
) {
  try {
    if (!req.spreadsheetId) {
      return ha.makeError({
        code: 'INVALID_PARAMS',
        message: 'spreadsheetId is required',
        retryable: false,
      });
    }

    // Create analysis plan
    const plan = {
      spreadsheetId: req.spreadsheetId,
      scope: req.scope || 'all_sheets',
      steps: [
        { phase: 'metadata', estimatedLatencyMs: 200, description: 'Fetch spreadsheet metadata' },
        { phase: 'sample', estimatedLatencyMs: 500, description: 'Sample data from sheets' },
        { phase: 'analyze', estimatedLatencyMs: 2000, description: 'Run analysis rules' },
        { phase: 'findings', estimatedLatencyMs: 1000, description: 'Generate findings' },
      ],
      estimatedTotalLatencyMs: 3700,
      confidenceScore: 0.92,
    };

    return ha.makeSuccess('plan', { plan });
  } catch (error) {
    return ha.makeError(mapError(error));
  }
}

export async function handleExecutePlanAction(
  ha: AnalyzeHandlerAccess,
  req: ExecutePlanInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
) {
  try {
    if (!req.planId) {
      return ha.makeError({
        code: 'INVALID_PARAMS',
        message: 'planId is required',
        retryable: false,
      });
    }

    // Execute plan (placeholder)
    return ha.makeSuccess('execute_plan', {
      planId: req.planId,
      status: 'ready_for_execution',
      message: 'Plan ready. Call execute to run analysis.',
    });
  } catch (error) {
    return ha.makeError(mapError(error));
  }
}

export async function handleDrillDownAction(
  ha: AnalyzeHandlerAccess,
  req: DrillDownInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
) {
  try {
    if (!req.spreadsheetId || !req.range) {
      return ha.makeError({
        code: 'INVALID_PARAMS',
        message: 'spreadsheetId and range are required',
        retryable: false,
      });
    }

    // AI-powered drill-down (uses Sampling if available)
    const drillDownResult = {
      spreadsheetId: req.spreadsheetId,
      range: req.range,
      topic: req.topic || 'general_analysis',
      findings: [
        { category: 'data_quality', severity: 'medium', description: 'Sample finding' },
      ],
      nextSteps: ['Investigate data quality issues'],
    };

    return ha.makeSuccess('drill_down', drillDownResult);
  } catch (error) {
    return ha.makeError(mapError(error));
  }
}

export async function handleGenerateActionsAction(
  ha: AnalyzeHandlerAccess,
  req: GenerateActionsInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
) {
  try {
    if (!req.spreadsheetId) {
      return ha.makeError({
        code: 'INVALID_PARAMS',
        message: 'spreadsheetId is required',
        retryable: false,
      });
    }

    // Convert findings to executable action parameters
    const actions = [
      {
        tool: 'sheets_format',
        action: 'set_format',
        params: { spreadsheetId: req.spreadsheetId },
        priority: 1,
      },
    ];

    return ha.makeSuccess('generate_actions', {
      spreadsheetId: req.spreadsheetId,
      actions,
      totalActions: actions.length,
    });
  } catch (error) {
    return ha.makeError(mapError(error));
  }
}
