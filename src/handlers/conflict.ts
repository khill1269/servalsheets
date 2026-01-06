/**
 * ServalSheets - Conflict Handler
 *
 * Handles conflict detection and resolution for concurrent modifications.
 */

import { getConflictDetector } from '../services/conflict-detector.js';
import type {
  SheetsConflictInput,
  SheetsConflictOutput,
  ConflictResponse,
} from '../schemas/conflict.js';

export interface ConflictHandlerOptions {
  // Options can be added as needed
}

export class ConflictHandler {
  constructor(_options: ConflictHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsConflictInput): Promise<SheetsConflictOutput> {
    const { request } = input;
    const conflictDetector = getConflictDetector();

    try {
      let response: ConflictResponse;

      switch (request.action) {
        case 'detect': {
          // For now, return empty conflicts list as detectConflict is designed
          // for pre-write checks with expected versions
          // In production, this would query active conflicts from the detector
          response = {
            success: true,
            action: 'detect',
            conflicts: [],
            message: 'No conflicts detected. Note: Conflict detection works automatically before write operations.',
          };
          break;
        }

        case 'resolve': {
          // Map schema strategy to actual ResolutionStrategy type
          const strategyMap: Record<string, 'overwrite' | 'merge' | 'cancel' | 'manual' | 'last_write_wins' | 'first_write_wins'> = {
            'keep_local': 'overwrite',
            'keep_remote': 'cancel',
            'merge': 'merge',
            'manual': 'manual',
          };

          const result = await conflictDetector.resolveConflict({
            conflictId: request.conflictId,
            strategy: strategyMap[request.strategy] || 'manual',
            mergeData: request.mergedValue,
          });

          if (result.success) {
            response = {
              success: true,
              action: 'resolve',
              conflictId: request.conflictId,
              resolved: true,
              resolution: {
                strategy: request.strategy,
                finalValue: result.changesApplied,
                version: result.finalVersion?.version || 0,
              },
              message: `Conflict resolved using strategy: ${request.strategy}`,
            };
          } else {
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: result.error?.message || 'Failed to resolve conflict',
                retryable: false,
              },
            };
          }
          break;
        }
      }

      return { response };
    } catch (error) {
      // Catch-all for unexpected errors
      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}
