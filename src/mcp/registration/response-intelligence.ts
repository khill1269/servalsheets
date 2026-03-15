import { getDataAwareSuggestions } from '../../services/action-recommender.js';
import { suggestFix } from '../../services/error-fix-suggester.js';
import { scanResponseQualitySync } from '../../services/lightweight-quality-scanner.js';

type ResponseCellValue = string | number | boolean | null;

type ConfidenceGapHint = {
  question: string;
  options?: string[];
};

type ResponseIntelligenceOptions = {
  toolName?: string;
  hasFailure: boolean;
};

const DATA_QUALITY_ACTIONS = new Set(['read', 'write', 'append', 'batch_read', 'batch_write']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCellValue(value: unknown): value is ResponseCellValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isCellRow(value: unknown): value is ResponseCellValue[] {
  return Array.isArray(value) && value.every((cell) => isCellValue(cell));
}

function isCellGrid(value: unknown): value is ResponseCellValue[][] {
  return Array.isArray(value) && value.every((row) => isCellRow(row));
}

function getOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((option): option is string => typeof option === 'string');
}

function extractResponseValues(
  responseRecord: Record<string, unknown>
): ResponseCellValue[][] | null {
  const directValues = responseRecord['values'];
  if (isCellGrid(directValues)) {
    return directValues;
  }

  const nestedData = responseRecord['data'];
  if (!isRecord(nestedData)) {
    return null;
  }

  const nestedValues = nestedData['values'];
  return isCellGrid(nestedValues) ? nestedValues : null;
}

function normalizeConfidenceGapHint(value: unknown): ConfidenceGapHint | null {
  if (typeof value === 'string') {
    const question = value.trim();
    return question ? { question } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const question =
    getOptionalString(value, 'question') ??
    getOptionalString(value, 'gap') ??
    getOptionalString(value, 'detail');

  if (!question) {
    return null;
  }

  const options = getStringArray(value['options']);
  return options.length > 0 ? { question, options } : { question };
}

function extractConfidenceGapHints(responseRecord: Record<string, unknown>): ConfidenceGapHint[] {
  const hints: ConfidenceGapHint[] = [];
  const confidenceGaps = responseRecord['confidenceGaps'];
  if (Array.isArray(confidenceGaps)) {
    for (const entry of confidenceGaps) {
      const normalized = normalizeConfidenceGapHint(entry);
      if (normalized) {
        hints.push(normalized);
      }
    }
  }

  const confidence = responseRecord['confidence'];
  if (!isRecord(confidence)) {
    return hints;
  }

  for (const key of ['gaps', 'topGaps']) {
    const entries = confidence[key];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      const normalized = normalizeConfidenceGapHint(entry);
      if (normalized) {
        hints.push(normalized);
      }
    }
  }

  return hints;
}

export function applyResponseIntelligence(
  responseRecord: Record<string, unknown>,
  options: ResponseIntelligenceOptions
): void {
  if (options.hasFailure) {
    const error = responseRecord['error'];
    if (!isRecord(error)) {
      return;
    }

    const errorCode = getOptionalString(error, 'code') ?? '';
    const errorMessage = getOptionalString(error, 'message') ?? '';
    const fix = suggestFix(errorCode, errorMessage, options.toolName, undefined, undefined);
    if (fix) {
      error['suggestedFix'] = fix;
    }
    return;
  }

  if (!options.toolName) {
    return;
  }

  const actionName = getOptionalString(responseRecord, 'action');
  if (!actionName) {
    return;
  }

  const responseValues = extractResponseValues(responseRecord);
  const confidenceGaps = extractConfidenceGapHints(responseRecord);
  const recommendations = getDataAwareSuggestions(options.toolName, actionName, responseRecord, {
    ...(responseValues ? { responseValues } : {}),
    ...(confidenceGaps.length > 0 ? { confidenceGaps } : {}),
  });

  if (recommendations.length > 0) {
    responseRecord['suggestedNextActions'] = recommendations.slice(0, 5);
  }

  if (
    options.toolName === 'sheets_data' &&
    DATA_QUALITY_ACTIONS.has(actionName) &&
    responseValues &&
    responseValues.length >= 2 &&
    responseValues.some((row) => row.length >= 2)
  ) {
    const warnings = scanResponseQualitySync(responseValues, {
      tool: options.toolName,
      action: actionName,
      range: getOptionalString(responseRecord, 'range') ?? '',
    });

    if (warnings.length > 0) {
      responseRecord['dataQualityWarnings'] = warnings;
    }
  }
}
