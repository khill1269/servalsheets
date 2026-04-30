import { ErrorCodes } from '../error-codes.js';
import type { AnalyzeResponse, DataQualityIssue } from '../../schemas/analyze.js';
import { logger } from '../../utils/logger.js';

type AnalyzeQualityRequest = {
  spreadsheetId: string;
  sheetId?: number;
  range: { a1: string } | { namedRange: string } | { semantic: unknown } | { grid: unknown };
};

interface ConvertedRangeInput {
  a1?: string;
  sheetName?: string;
  range?: string;
}

export interface AnalyzeQualityDeps {
  convertRangeInput: (
    range: AnalyzeQualityRequest['range']
  ) => Promise<ConvertedRangeInput | { notImplemented: true; reason: string } | undefined>;
  resolveAnalyzeRange: (range?: ConvertedRangeInput) => string | undefined;
  readData: (spreadsheetId: string, range?: string) => Promise<unknown[][]>;
}

type QualityIssueType = DataQualityIssue['type'];

function inferQualityIssueType(issueMessage: string): QualityIssueType {
  const msg = issueMessage.toLowerCase();
  if (msg.includes('mixed data type')) return 'MIXED_DATA_TYPES';
  if (msg.includes('duplicate')) return 'DUPLICATE_ROW';
  if (msg.includes('missing') || msg.includes('empty')) return 'MISSING_VALUE';
  if (msg.includes('outlier') || msg.includes('statistical')) return 'STATISTICAL_OUTLIER';
  return 'INCONSISTENT_FORMAT';
}

// AUDIT-2026-04-23 (artifact bug #10 refinement): infer issue severity from
// text + type so the quality score reflects the *kind* of issue, not just
// the count. High-severity issues (mixed data types, duplicates) penalize
// more aggressively than low-severity ones (format inconsistency).
function inferQualityIssueSeverity(
  type: QualityIssueType,
  issueMessage: string
): 'critical' | 'high' | 'medium' | 'low' {
  const msg = issueMessage.toLowerCase();
  if (/#ref!|#n\/a|broken/.test(msg)) return 'critical';
  if (type === 'MIXED_DATA_TYPES' || type === 'DUPLICATE_ROW') return 'high';
  if (type === 'MISSING_VALUE' || type === 'STATISTICAL_OUTLIER') return 'medium';
  return 'low';
}

const SEVERITY_PENALTY: Record<'critical' | 'high' | 'medium' | 'low', number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
};

/**
 * Decomposed action handler for `analyze_quality`.
 * Preserves original behavior while moving logic out of the main AnalyzeHandler class.
 */
export async function handleAnalyzeQualityAction(
  input: AnalyzeQualityRequest,
  deps: AnalyzeQualityDeps
): Promise<AnalyzeResponse> {
  const startTime = Date.now();

  try {
    const convertedResult = await deps.convertRangeInput(input.range);
    if (convertedResult && 'notImplemented' in convertedResult) {
      return {
        success: false,
        error: {
          code: ErrorCodes.NOT_IMPLEMENTED,
          message: convertedResult.reason,
          retryable: false,
        },
      };
    }
    const rangeStr = deps.resolveAnalyzeRange(convertedResult);
    const data = await deps.readData(input.spreadsheetId, rangeStr);

    if (data.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCodes.NO_DATA,
          message: 'No data found in the specified range',
          retryable: false,
        },
      };
    }

    const { checkColumnQuality, detectDataType } = await import('../../analysis/helpers.js');

    const headers = data[0]?.map(String) ?? [];
    const dataRows = data.slice(1);

    const columnResults = headers.map((header, colIndex) => {
      const columnData = dataRows.map((row) => row[colIndex]);
      const dataType = detectDataType(columnData);
      const quality = checkColumnQuality(columnData, dataType);

      return {
        column: header,
        dataType,
        completeness: quality.completeness,
        consistency: quality.consistency,
        issues: quality.issues,
      };
    });

    const avgCompleteness =
      columnResults.reduce((sum, col) => sum + col.completeness, 0) / columnResults.length;
    const avgConsistency =
      columnResults.reduce((sum, col) => sum + col.consistency, 0) / columnResults.length;
    const rawScore = (avgCompleteness + avgConsistency) / 2;

    // AUDIT-2026-04-23 (artifact bug #10): replace flat per-issue penalty
    // with severity-weighted penalty. Prior code docked 2pts per issue
    // regardless of severity (capped at -30), which allowed "100% score +
    // 7 issues" inconsistencies. Now each issue contributes by severity:
    //   critical: 20, high: 10, medium: 5, low: 2
    // This aligns the numeric score with the issue list consumers see.
    // DataQualityIssueSchema only permits 'low' | 'medium' | 'high' today
    // (see src/schemas/analyze.ts:77). We compute an internal 4-value
    // severity for the penalty math but clamp the public `severity` field
    // to the declared enum by mapping 'critical' → 'high' on emission.
    // If the output schema is widened to include 'critical', remove this
    // mapping.
    const issuesInternal = columnResults.flatMap((col) =>
      col.issues.map((issue) => {
        const type = inferQualityIssueType(issue);
        const internalSeverity = inferQualityIssueSeverity(type, issue);
        return {
          type,
          internalSeverity,
          publicSeverity: (internalSeverity === 'critical' ? 'high' : internalSeverity) as
            | 'low'
            | 'medium'
            | 'high',
          location: col.column,
          description: issue,
        };
      })
    );
    const issuePenalty = Math.min(
      issuesInternal.reduce((sum, i) => sum + SEVERITY_PENALTY[i.internalSeverity], 0),
      60
    );
    const overallScore = Math.max(0, rawScore - issuePenalty);

    const issues = issuesInternal.map((i) => ({
      type: i.type,
      severity: i.publicSeverity,
      location: i.location,
      description: i.description,
      autoFixable: false,
      fixTool: undefined,
      fixAction: undefined,
    }));

    const duration = Date.now() - startTime;

    return {
      success: true,
      action: 'analyze_quality',
      dataQuality: {
        score: overallScore,
        completeness: avgCompleteness,
        consistency: avgConsistency,
        accuracy: Math.round(avgConsistency),
        issues,
        summary: `Quality score: ${overallScore.toFixed(1)}% (${issues.length} issues found)`,
      },
      duration,
      message: `Quality score: ${overallScore.toFixed(1)}%`,
    };
  } catch (error) {
    logger.error('Failed to analyze quality', {
      component: 'analyze-handler',
      action: 'analyze_quality',
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Failed to analyze quality',
        retryable: true,
      },
    };
  }
}
