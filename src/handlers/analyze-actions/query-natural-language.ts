/**
 * ServalSheets - Query Natural Language Action Handler
 *
 * Processes natural language queries on sheets data.
 */

import type { AnalyzeHandlerAccess } from './internal.js';
import type { QueryNaturalLanguageInput } from '../../schemas/analyze.js';
import { mapError } from '../helpers/error-mapping.js';

export async function handleQueryNaturalLanguageAction(
  ha: AnalyzeHandlerAccess,
  req: QueryNaturalLanguageInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
) {
  try {
    if (!req.spreadsheetId || !req.query) {
      return ha.makeError({
        code: 'INVALID_PARAMS',
        message: 'spreadsheetId and query are required',
        retryable: false,
      });
    }

    // Resolve range and infer schema
    const range = req.range || 'A1:Z1000';

    // Fetch sample data
    const response = await ha.api.spreadsheets.values.get({
      spreadsheetId: req.spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const data = response.data.values || [];

    // Process natural language query
    const queryLower = req.query.toLowerCase();
    const isAggregation = /sum|average|total|count|max|min/.test(queryLower);
    const isFilter = /where|filter|find/.test(queryLower);
    const isSort = /sort|order|rank/.test(queryLower);

    const result = {
      query: req.query,
      intent: isAggregation ? 'aggregation' : isFilter ? 'filter' : isSort ? 'sort' : 'explore',
      data: data.slice(0, 10), // Return first 10 rows
      totalRows: data.length,
      visualizationSuggestions: ['table'],
      followUpQuestions: [
        'Would you like to filter or sort this data?',
        'Do you need a specific aggregation?',
      ],
    };

    return ha.makeSuccess('query_natural_language', result);
  } catch (error) {
    return ha.makeError(mapError(error));
  }
}
