/**
 * ServalSheets - Quality Handler
 *
 * Enterprise quality assurance combining validation, conflict detection, and impact analysis.
 *
 * Actions (4):
 * - validate: Data validation with built-in validators
 * - detect_conflicts: Detect concurrent modification conflicts
 * - resolve_conflict: Resolve detected conflicts with strategies
 * - analyze_impact: Pre-execution impact analysis with dependency tracking
 *
 * Implementation decomposed into quality-actions/:
 * - custom-rule-compiler.ts: Custom validation rule compilation
 * - validate.ts: Validation action handler
 * - conflicts.ts: Conflict detection and resolution
 * - impact.ts: Impact analysis with dependency tracking
 */

import { ValidationError } from '../core/errors.js';
import { applyVerbosityFilter } from './helpers/verbosity-filter.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { unwrapRequest } from './base.js';
import { logger } from '../utils/logger.js';
import type {
  SheetsQualityInput,
  SheetsQualityOutput,
  QualityResponse,
  QualityValidateInput,
  QualityDetectConflictsInput,
  QualityResolveConflictInput,
  QualityAnalyzeImpactInput,
} from '../schemas/quality.js';
import type { SamplingServer } from '../mcp/sampling.js';
import { handleValidate } from './quality-actions/validate.js';
import { handleDetectConflicts, handleResolveConflict } from './quality-actions/conflicts.js';
import { handleAnalyzeImpact } from './quality-actions/impact.js';

export interface QualityHandlerOptions {
  samplingServer?: SamplingServer;
}

export class QualityHandler {
  private samplingServer?: SamplingServer;

  constructor(options: QualityHandlerOptions = {}) {
    this.samplingServer = options.samplingServer;
  }

  async handle(input: SheetsQualityInput): Promise<SheetsQualityOutput> {
    const req = unwrapRequest<SheetsQualityInput['request']>(input);
    try {
      let response: QualityResponse;

      switch (req.action) {
        case 'validate':
          response = await handleValidate(req as QualityValidateInput, this.samplingServer);
          break;
        case 'detect_conflicts':
          response = await handleDetectConflicts(
            req as QualityDetectConflictsInput,
            this.samplingServer
          );
          break;
        case 'resolve_conflict':
          response = await handleResolveConflict(req as QualityResolveConflictInput);
          break;
        case 'analyze_impact':
          response = await handleAnalyzeImpact(req as QualityAnalyzeImpactInput);
          break;
        default: {
          const _exhaustiveCheck: never = req;
          throw new ValidationError(
            `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            'action',
            'validate | detect_conflicts | resolve_conflict | analyze_impact'
          );
        }
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (error) {
      // Catch-all for unexpected errors
      logger.error('Quality handler error', {
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
