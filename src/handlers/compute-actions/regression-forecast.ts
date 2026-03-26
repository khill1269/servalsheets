/**
 * Regression & Forecast Action Handlers
 *
 * Actions: regression, forecast
 */

import { ErrorCodes } from '../error-codes.js';
import { extractRangeA1 } from '../../utils/range-helpers.js';
import { generateAIInsight } from '../../mcp/sampling.js';
import { fetchRangeData, computeRegression, computeForecast } from '../../services/compute-engine.js';
import type { SheetsComputeInput, SheetsComputeOutput } from '../../schemas/compute.js';
import type { ComputeHandlerAccess } from './internal.js';
import { resolveComputeInputData } from './header-resolution.js';

// ============================================================================
// Forecast Helper Functions
// ============================================================================

export function resolveForecastColumnIndex(headers: string[], columnRef: string): number {
  const trimmed = columnRef.trim();

  if (/^[A-Z]+$/i.test(trimmed)) {
    let index = 0;
    for (let i = 0; i < trimmed.length; i++) {
      index = index * 26 + (trimmed.toUpperCase().charCodeAt(i) - 64);
    }
    const zeroBased = index - 1;
    if (zeroBased >= 0 && zeroBased < headers.length) {
      return zeroBased;
    }
  }

  return headers.findIndex((header) => header.trim().toLowerCase() === trimmed.toLowerCase());
}

export function coerceForecastValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) {
      return undefined; // OK: Explicit empty — empty string after normalization
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined; // OK: Explicit empty — unrecognized value type
}

export function normalizeForecastPeriod(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `serial:${value}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined; // OK: Explicit empty — empty string after trim
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return trimmed;
  }

  return undefined; // OK: Explicit empty — unrecognized value type
}

export function validateForecastDataShape(
  data: unknown[][],
  dateColumn: string,
  valueColumn: string
):
  | {
      ok: true;
      validPointCount: number;
      distinctPeriodCount: number;
    }
  | {
      ok: false;
      error: {
        code: typeof ErrorCodes.INVALID_PARAMS;
        message: string;
        retryable: false;
        suggestedFix?: string;
        details?: Record<string, unknown>;
      };
    } {
  const headers = (data[0] ?? []).map((cell) => String(cell ?? ''));
  const dateIdx = resolveForecastColumnIndex(headers, dateColumn);
  if (dateIdx < 0) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: `Date column "${dateColumn}" was not found in the forecast range.`,
        retryable: false,
        suggestedFix: 'Use a valid column letter or header name for dateColumn.',
      },
    };
  }

  const valueIdx = resolveForecastColumnIndex(headers, valueColumn);
  if (valueIdx < 0) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: `Value column "${valueColumn}" was not found in the forecast range.`,
        retryable: false,
        suggestedFix: 'Use a valid column letter or header name for valueColumn.',
      },
    };
  }

  const periodCounts = new Map<string, number>();
  let validPointCount = 0;
  let invalidDateRows = 0;
  let invalidValueRows = 0;

  for (const row of data.slice(1)) {
    const periodKey = normalizeForecastPeriod(row?.[dateIdx]);
    const numericValue = coerceForecastValue(row?.[valueIdx]);

    if (!periodKey) {
      invalidDateRows += 1;
      continue;
    }
    if (numericValue === undefined) {
      invalidValueRows += 1;
      continue;
    }

    validPointCount += 1;
    periodCounts.set(periodKey, (periodCounts.get(periodKey) ?? 0) + 1);
  }

  if (validPointCount < 3) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message:
          'Forecasting requires at least 3 rows with both a valid date/timestamp and a numeric value.',
        retryable: false,
        suggestedFix:
          'Select a range with a real time column and numeric values, or clean the invalid rows before forecasting.',
        details: {
          validPointCount,
          invalidDateRows,
          invalidValueRows,
        },
      },
    };
  }

  const distinctPeriodCount = periodCounts.size;
  if (distinctPeriodCount < 3) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message: `Forecasting requires at least 3 distinct time periods, but only ${distinctPeriodCount} were found.`,
        retryable: false,
        suggestedFix:
          'Aggregate the data to one row per period first, then rerun forecast on the summarized range.',
        details: {
          validPointCount,
          distinctPeriodCount,
        },
      },
    };
  }

  const duplicatePeriods = Array.from(periodCounts.entries()).filter(([, count]) => count > 1);
  if (duplicatePeriods.length > 0) {
    return {
      ok: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message:
          `Forecast input contains multiple rows for ${duplicatePeriods.length} time period(s). ` +
          'Forecasting expects one numeric value per period.',
        retryable: false,
        suggestedFix:
          'Aggregate repeated dates or timestamps into one value per period before calling forecast.',
        details: {
          distinctPeriodCount,
          duplicatePeriods: duplicatePeriods.slice(0, 5).map(([period, count]) => ({
            period,
            count,
          })),
        },
      },
    };
  }

  return {
    ok: true,
    validPointCount,
    distinctPeriodCount,
  };
}

// ============================================================================
// Action Handlers
// ============================================================================

export async function handleRegression(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'regression' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const resolvedData = await resolveComputeInputData(access.sheetsApi, req.spreadsheetId, req.range, {
    hasHeaders: req.hasHeaders,
    headerRow: req.headerRow,
  });
  if (!resolvedData.ok) {
    return {
      response: {
        success: false,
        error: resolvedData.error,
      },
    };
  }
  const data = resolvedData.data;

  const result = computeRegression(data, {
    xColumn: req.xColumn,
    yColumn: req.yColumn,
    type: req.type,
    degree: req.degree,
    predict: req.predict,
  });

  return {
    response: {
      success: true,
      action: 'regression',
      coefficients: result.coefficients,
      rSquared: result.rSquared,
      equation: result.equation,
      predictions: result.predictions,
      residuals: result.residuals,
      computationTimeMs: Date.now() - startMs,
    },
  };
}

export async function handleForecast(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'forecast' }
): Promise<SheetsComputeOutput> {
  let resolvedReq = req;

  // Wizard: If range is provided but periods is missing, elicit forecast length
  if (resolvedReq.range && !resolvedReq.periods) {
    const elicitFn = access.server?.elicitInput;

    if (elicitFn) {
      try {
        const wizard = await elicitFn({
          message: 'How many periods should I forecast ahead?',
          requestedSchema: {
            type: 'object',
            properties: {
              periods: {
                type: 'number',
                title: 'Forecast periods',
                description: 'How many future periods to predict? (e.g., 3, 6, 12)',
              },
            },
          },
        });
        const wizardContent = wizard?.content as Record<string, unknown> | undefined;
        const periodsRaw = wizardContent?.['periods'];
        const periods =
          typeof periodsRaw === 'number'
            ? periodsRaw
            : typeof periodsRaw === 'string'
              ? Number.parseInt(periodsRaw, 10)
              : undefined;
        if (wizard?.action === 'accept' && periods && Number.isFinite(periods) && periods > 0) {
          resolvedReq = {
            ...resolvedReq,
            periods,
          };
        }
      } catch {
        // Elicitation not available — default to 3 periods
        if (!resolvedReq.periods) {
          resolvedReq = { ...resolvedReq, periods: 3 };
        }
      }
    }
  }

  const startMs = Date.now();
  const data = await fetchRangeData(
    access.sheetsApi,
    resolvedReq.spreadsheetId,
    extractRangeA1(resolvedReq.range)
  );
  const forecastPreflight = validateForecastDataShape(
    data,
    resolvedReq.dateColumn,
    resolvedReq.valueColumn
  );
  if (!forecastPreflight.ok) {
    return {
      response: {
        success: false,
        error: forecastPreflight.error,
      },
    };
  }

  const result = computeForecast(data, {
    dateColumn: resolvedReq.dateColumn,
    valueColumn: resolvedReq.valueColumn,
    periods: resolvedReq.periods ?? 3,
    method: resolvedReq.method,
    seasonality: resolvedReq.seasonality,
  });

  // Generate AI insight explaining forecast confidence and factors
  let aiInsight: string | undefined;
  if (access.samplingServer && result.forecast) {
    const forecastStr = `Method: ${result.methodUsed}, Trend: ${JSON.stringify(result.trend).slice(0, 500)}, Forecast: ${JSON.stringify(result.forecast).slice(0, 500)}`;
    aiInsight = await generateAIInsight(
      access.samplingServer,
      'dataAnalysis',
      'Explain this forecast — how reliable is it and what factors could affect accuracy?',
      forecastStr,
      { maxTokens: 400 }
    );
  }

  return {
    response: {
      success: true,
      action: 'forecast',
      forecast: result.forecast,
      trend: result.trend,
      methodUsed: result.methodUsed,
      computationTimeMs: Date.now() - startMs,
      ...(aiInsight !== undefined ? { aiInsight } : {}),
    },
  };
}
