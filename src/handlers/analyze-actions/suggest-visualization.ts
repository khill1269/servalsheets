/**
 * ServalSheets - Suggest Visualization Action Handler
 *
 * Recommends chart types based on data profile.
 */

import type { AnalyzeHandlerAccess } from './internal.js';
import type { SuggestVisualizationInput } from '../../schemas/analyze.js';
import { mapError } from '../helpers/error-mapping.js';

export async function handleSuggestVisualizationAction(
  ha: AnalyzeHandlerAccess,
  req: SuggestVisualizationInput,
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

    // Fetch range data
    const response = await ha.api.spreadsheets.values.get({
      spreadsheetId: req.spreadsheetId,
      range: req.range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const data = response.data.values || [];

    // Analyze data profile
    const numRows = data.length;
    const numCols = Math.max(...data.map((row: unknown[]) => row.length));
    const hasNumericData = data.some((row: unknown[]) => row.some((v: unknown) => typeof v === 'number'));
    const hasDateData = data.some((row: unknown[]) => row.some((v: unknown) => v instanceof Date));
    const hasTextData = data.some((row: unknown[]) => row.some((v: unknown) => typeof v === 'string'));

    // Generate recommendations
    const recommendations = [
      {
        chartType: 'TABLE',
        suitabilityScore: 0.95,
        reasoning: 'Best for structured data display',
        dataRequirements: 'Any tabular data',
      },
    ];

    if (hasNumericData && numCols <= 10) {
      recommendations.push({
        chartType: 'COLUMN',
        suitabilityScore: 0.85,
        reasoning: 'Good for comparing values across categories',
        dataRequirements: 'Numeric columns with categorical headers',
      });
    }

    if (hasDateData && hasNumericData) {
      recommendations.push({
        chartType: 'LINE',
        suitabilityScore: 0.88,
        reasoning: 'Ideal for time series trends',
        dataRequirements: 'Date column and numeric values',
      });
    }

    if (numCols === 2 && hasNumericData) {
      recommendations.push({
        chartType: 'SCATTER',
        suitabilityScore: 0.75,
        reasoning: 'Reveals correlation between two variables',
        dataRequirements: 'Two numeric columns',
      });
    }

    // Sort by suitability score
    recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    return ha.makeSuccess('suggest_visualization', {
      spreadsheetId: req.spreadsheetId,
      range: req.range,
      dataProfile: {
        rows: numRows,
        columns: numCols,
        hasNumeric: hasNumericData,
        hasDate: hasDateData,
        hasText: hasTextData,
      },
      recommendations: recommendations.slice(0, 5),
    });
  } catch (error) {
    return ha.makeError(mapError(error));
  }
}
