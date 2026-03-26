/**
 * Standalone Handler Error Mapping Helper
 */

import { ErrorCodes } from '../error-codes.js';
import type { ErrorDetail } from '../../schemas/shared.js';

export function mapStandaloneError(error: unknown): {
  code: ErrorDetail['code'];
  message: string;
  retryable: boolean;
} {
  if (error instanceof Error) {
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      retryable: false,
    };
  }

  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: error != null ? String(error) : 'An unknown error occurred',
    retryable: false,
  };
}