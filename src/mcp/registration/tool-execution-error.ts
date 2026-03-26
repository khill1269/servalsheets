import type { ToolExecutionError } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import type { ValidationIssue, ZodValidationError } from '../../utils/validation-error.js';

export function buildToolExecutionErrorPayload(error: unknown): ToolExecutionError {
  if (error instanceof Error && 'isZodError' in error) {
    const zodError = error as ZodValidationError;
    const issues: ValidationIssue[] = zodError.issues ?? [];

    const issuesByCode = issues.reduce(
      (acc, issue) => {
        acc[issue.code] = (acc[issue.code] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const firstIssue = issues[0];
    const issueCode = firstIssue?.code ?? 'UNKNOWN';
    const issuePath = firstIssue?.path?.join('.') ?? '(root)';
    const issueMessage = firstIssue?.message ?? 'Validation error';

    logger.warn('Tool execution validation error', {
      issueCounts: issuesByCode,
      firstIssueCode: issueCode,
      firstIssuePath: issuePath,
      totalIssues: issues.length,
    });

    const toolHintMessage = generateToolDiscoveryHint(issueCode, issuePath);

    return {
      code: 'INVALID_REQUEST',
      message:
        `Validation error at ${issuePath}: ${issueMessage}. ` +
        (toolHintMessage ? toolHintMessage : ''),
    };
  }

  if (error instanceof Error) {
    logger.error('Tool execution error', {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });

    return {
      code: 'INTERNAL_ERROR',
      message: `Tool execution failed: ${error.message}`,
    };
  }

  logger.error('Tool execution unknown error', { error: String(error) });
  return {
    code: 'INTERNAL_ERROR',
    message: `Tool execution failed: ${String(error)}`,
  };
}

function generateToolDiscoveryHint(issueCode: string, issuePath: string): string {
  switch (issueCode) {
    case 'invalid_enum_value':
      return `Check available actions via 'sheets_session.get_context' for the 'action' parameter.`;
    case 'invalid_union':
      return `This tool requires specific action types. Use 'sheets_session.get_context' to discover valid actions.`;
    case 'invalid_type':
      return `Parameter type mismatch. Check MCP completions for parameter types.`;
    case 'missing_keys':
      return `Missing required parameters. Run 'sheets_session.get_context' to see all required parameters.`;
    default:
      return '';
  }
}
