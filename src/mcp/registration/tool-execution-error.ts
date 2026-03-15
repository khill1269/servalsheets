import { z } from 'zod';
import { createZodValidationError } from '../../utils/error-factory.js';
import { getIssueCode, normalizeIssuePath } from './tool-arg-normalization.js';

type PlainRecord = Record<string, unknown>;

export interface ToolExecutionErrorPayload {
  errorCode: string;
  errorMessage: string;
  errorPayload: PlainRecord;
}

function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getThrownErrorCode(error: unknown): string | undefined {
  if (!isPlainRecord(error)) {
    return undefined;
  }

  return typeof error['code'] === 'string' ? error['code'] : undefined;
}

export function buildToolExecutionErrorPayload(
  error: unknown,
  toolName: string
): ToolExecutionErrorPayload {
  const errorMessage = error instanceof Error ? error.message : String(error);
  let errorCode = getThrownErrorCode(error) ?? 'INTERNAL_ERROR';
  const errorPayload: PlainRecord = {
    code: errorCode,
    message: errorMessage,
    retryable: false,
  };

  if (error instanceof z.ZodError) {
    const validationError = createZodValidationError(
      error.issues.map((issue) => {
        const issueRecord = issue as unknown as PlainRecord;
        const options = issueRecord['options'];
        const expected = issueRecord['expected'];
        const received = issueRecord['received'];

        return {
          code: getIssueCode(issue),
          path: normalizeIssuePath(issue.path),
          message: issue.message,
          options: Array.isArray(options) ? options : undefined,
          expected: typeof expected === 'string' ? expected : undefined,
          received: typeof received === 'string' ? received : undefined,
        };
      }),
      toolName
    );

    errorCode = 'INVALID_PARAMS';
    errorPayload['code'] = 'INVALID_PARAMS';
    errorPayload['message'] = validationError.message;
    errorPayload['retryable'] = validationError.retryable;
    errorPayload['suggestedFix'] =
      `Read schema://tools/${toolName} to see the correct parameter format and required fields.`;
    if (validationError.category) {
      errorPayload['category'] = validationError.category;
    }
    if (validationError.severity) {
      errorPayload['severity'] = validationError.severity;
    }
    if (validationError.resolution) {
      errorPayload['resolution'] = validationError.resolution;
    }
    if (validationError.resolutionSteps) {
      errorPayload['resolutionSteps'] = validationError.resolutionSteps;
    }
  }

  return {
    errorCode,
    errorMessage,
    errorPayload,
  };
}
