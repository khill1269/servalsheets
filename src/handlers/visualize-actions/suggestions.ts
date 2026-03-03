import type { sheets_v4 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type {
  SuggestChartInput,
  SuggestPivotInput,
  VisualizeResponse,
} from '../../schemas/visualize.js';
import type { ErrorDetail, MutationSummary } from '../../schemas/shared.js';
import { checkSamplingSupport } from '../../mcp/sampling.js';
import { isLLMFallbackAvailable, createMessageWithFallback } from '../../services/llm-fallback.js';
import { logger } from '../../utils/logger.js';
import { sendProgress } from '../../utils/request-context.js';

interface SuggestionsDeps {
  sheetsApi: sheets_v4.Sheets;
  context: HandlerContext;
  success: (
    action: string,
    data: Record<string, unknown>,
    mutation?: MutationSummary,
    dryRun?: boolean
  ) => VisualizeResponse;
  error: (error: ErrorDetail) => VisualizeResponse;
}

export async function handleSuggestChartAction(
  input: SuggestChartInput,
  deps: SuggestionsDeps
): Promise<VisualizeResponse> {
  // Check if LLM fallback is available or server supports sampling
  const samplingSupport = deps.context.server
    ? checkSamplingSupport(deps.context.server.getClientCapabilities?.())
    : { supported: false };
  const hasLLMFallback = isLLMFallbackAvailable();

  if (!hasLLMFallback && (!deps.context.server || !samplingSupport.supported)) {
    return deps.error({
      code: 'FEATURE_UNAVAILABLE',
      message:
        'Chart suggestions require MCP Sampling capability (SEP-1577) or LLM API key. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY environment variable.',
      retryable: false,
      suggestedFix:
        'Enable the feature by setting the appropriate environment variable, or contact your administrator',
    });
  }

  if (!input.range) {
    return deps.error({
      code: 'INVALID_PARAMS',
      message: 'Range is required for chart suggestions',
      retryable: false,
      suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
    });
  }

  const startTime = Date.now();

  try {
    await sendProgress(0, 3, 'Analyzing data for chart suggestions...');

    // Convert range to A1 notation string
    const rangeStr =
      typeof input.range === 'string'
        ? input.range
        : 'a1' in input.range
          ? input.range.a1
          : 'Sheet1';

    // Fetch data from the specified range
    const response = await deps.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId!,
      range: rangeStr,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const values = response.data.values || [];
    if (values.length === 0) {
      return deps.error({
        code: 'INVALID_PARAMS',
        message: 'Range contains no data',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Analyze data structure
    const hasHeaders = values.length > 1 && values[0]?.every((v: unknown) => typeof v === 'string');
    const dataRows = hasHeaders ? values.slice(1) : values;
    const headers = hasHeaders ? (values[0] as string[]) : undefined;

    // Build AI sampling request
    const headerInfo = headers ? `\n**Column headers:** ${headers.join(', ')}` : '';
    const sampleData = dataRows.slice(0, 10);

    const prompt = `Analyze this spreadsheet data and suggest the ${input.maxSuggestions || 3} best chart types to visualize it.

**Data range:** ${rangeStr}
**Row count:** ${values.length}
**Column count:** ${values[0]?.length || 0}${headerInfo}

**Sample data (first 10 rows):**
\`\`\`json
${JSON.stringify(sampleData, null, 2)}
\`\`\`

For each chart suggestion, provide:
1. Chart type (LINE, BAR, COLUMN, PIE, SCATTER, AREA, COMBO, etc.)
2. A descriptive title
3. Clear explanation of what insights this chart reveals
4. Confidence score (0-100)
5. Reasoning for why this chart type fits the data
6. Data mapping (which columns to use for series and categories)

Format your response as JSON:
{
  "suggestions": [
    {
      "chartType": "COLUMN",
      "title": "Monthly Sales by Product",
      "explanation": "Shows sales trends across months for each product category",
      "confidence": 95,
      "reasoning": "Time-series data with multiple categories is ideal for column charts",
      "dataMapping": {
        "categoryColumn": 0,
        "seriesColumns": [1, 2, 3]
      }
    }
  ]
}`;

    const systemPrompt = `You are an expert data visualization consultant.
Analyze spreadsheet data and recommend the most effective chart types.
Consider data types, relationships, and visualization best practices.
Always return valid JSON in the exact format requested.`;

    // Use LLM fallback or MCP sampling
    const llmResult = await createMessageWithFallback(
      deps.context.server as Parameters<typeof createMessageWithFallback>[0],
      {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt,
        maxTokens: 2048,
      }
    );
    const duration = Date.now() - startTime;

    // Extract text from response
    const responseText = llmResult.content;

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return deps.error({
        code: 'INTERNAL_ERROR',
        message: 'Could not parse chart suggestions from AI response',
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return deps.success('suggest_chart', {
      suggestions: (parsed.suggestions || []).map((s: Record<string, unknown>) => ({
        type: 'chart' as const,
        ...s,
      })),
      _meta: {
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Chart suggestion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return deps.error({
      code: 'INTERNAL_ERROR',
      message:
        'Chart suggestion failed. The AI analysis service may be temporarily unavailable. Please try again.',
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, check LLM_API_KEY configuration',
    });
  }
}

export async function handleSuggestPivotAction(
  input: SuggestPivotInput,
  deps: SuggestionsDeps
): Promise<VisualizeResponse> {
  // Check if LLM fallback is available or server supports sampling
  const samplingSupport = deps.context.server
    ? checkSamplingSupport(deps.context.server.getClientCapabilities?.())
    : { supported: false };
  const hasLLMFallback = isLLMFallbackAvailable();

  if (!hasLLMFallback && (!deps.context.server || !samplingSupport.supported)) {
    return deps.error({
      code: 'FEATURE_UNAVAILABLE',
      message:
        'Pivot table suggestions require MCP Sampling capability (SEP-1577) or LLM API key. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY environment variable.',
      retryable: false,
      suggestedFix:
        'Enable the feature by setting the appropriate environment variable, or contact your administrator',
    });
  }

  if (!input.range) {
    return deps.error({
      code: 'INVALID_PARAMS',
      message: 'Range is required for pivot table suggestions',
      retryable: false,
      suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
    });
  }

  const startTime = Date.now();

  try {
    await sendProgress(0, 3, 'Analyzing data for pivot suggestions...');

    // Convert range to A1 notation string
    const rangeStr =
      typeof input.range === 'string'
        ? input.range
        : 'a1' in input.range
          ? input.range.a1
          : 'Sheet1';

    // Fetch data from the specified range
    const response = await deps.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId!,
      range: rangeStr,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const values = response.data.values || [];
    if (values.length === 0) {
      return deps.error({
        code: 'INVALID_PARAMS',
        message: 'Range contains no data',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Analyze data structure
    const hasHeaders = values.length > 1 && values[0]?.every((v: unknown) => typeof v === 'string');
    const dataRows = hasHeaders ? values.slice(1) : values;
    const headers = hasHeaders ? (values[0] as string[]) : undefined;

    // Build AI sampling request
    const headerInfo = headers ? `\n**Column headers:** ${headers.join(', ')}` : '';
    const sampleData = dataRows.slice(0, 10);

    const prompt = `Analyze this spreadsheet data and suggest the ${input.maxSuggestions || 3} most useful pivot table configurations.

**Data range:** ${rangeStr}
**Row count:** ${values.length}
**Column count:** ${values[0]?.length || 0}${headerInfo}

**Sample data (first 10 rows):**
\`\`\`json
${JSON.stringify(sampleData, null, 2)}
\`\`\`

For each pivot table suggestion, provide:
1. A descriptive title
2. Clear explanation of what insights this pivot reveals
3. Confidence score (0-100)
4. Reasoning for this configuration
5. Configuration details:
   - Row group columns (column indices to group by rows)
   - Column group columns (column indices to group by columns, optional)
   - Value columns with aggregation functions (SUM, AVERAGE, COUNT, etc.)

Format your response as JSON:
{
  "suggestions": [
    {
      "title": "Sales by Region and Product",
      "explanation": "Shows total sales broken down by region and product category",
      "confidence": 95,
      "reasoning": "Contains categorical dimensions (region, product) and numeric metrics (sales)",
      "configuration": {
        "rowGroupColumns": [0, 1],
        "valueColumns": [
          {"columnIndex": 2, "function": "SUM"}
        ]
      }
    }
  ]
}`;

    const systemPrompt = `You are an expert data analyst specializing in pivot table design.
Analyze spreadsheet data and recommend pivot table configurations that reveal meaningful insights.
Consider data types, cardinality, and business intelligence best practices.
Always return valid JSON in the exact format requested.`;

    // Use LLM fallback or MCP sampling
    const llmResult = await createMessageWithFallback(
      deps.context.server as Parameters<typeof createMessageWithFallback>[0],
      {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt,
        maxTokens: 2048,
      }
    );
    const duration = Date.now() - startTime;

    // Extract text from response
    const responseText = llmResult.content;

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return deps.error({
        code: 'INTERNAL_ERROR',
        message: 'Could not parse pivot table suggestions from AI response',
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return deps.success('suggest_pivot', {
      suggestions: (parsed.suggestions || []).map((s: Record<string, unknown>) => ({
        type: 'pivot' as const,
        ...s,
      })),
      _meta: {
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return deps.error({
      code: 'INTERNAL_ERROR',
      message: `Pivot table suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }
}
