/**
 * ServalSheets - Visualize Handler
 *
 * Consolidated handler for sheets_visualize tool (chart and pivot table operations)
 * Charts (11 actions) + Pivot tables (7 actions) = 18 actions total
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsVisualizeInput,
  SheetsVisualizeOutput,
  VisualizeResponse,
  VisualizeRequest,
  ChartCreateInput,
  SuggestChartInput,
  ChartUpdateInput,
  ChartDeleteInput,
  ChartListInput,
  ChartGetInput,
  ChartMoveInput,
  ChartResizeInput,
  ChartUpdateDataRangeInput,
  ChartAddTrendlineInput,
  ChartRemoveTrendlineInput,
  PivotCreateInput,
  SuggestPivotInput,
  PivotUpdateInput,
  PivotDeleteInput,
  PivotListInput,
  PivotGetInput,
  PivotRefreshInput,
} from '../schemas/visualize.js';
import type { RangeInput } from '../schemas/shared.js';
import {
  buildGridRangeInput,
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { checkSamplingSupport } from '../mcp/sampling.js';
import { isLLMFallbackAvailable, createMessageWithFallback } from '../services/llm-fallback.js';
import { logger } from '../utils/logger.js';

type VisualizeSuccess = Extract<VisualizeResponse, { success: true }>;

/**
 * Extended BasicChartSeries type that includes trendline and dataLabel properties.
 * These properties exist in the Google Sheets API but are missing from googleapis type definitions.
 */
interface ExtendedBasicChartSeries extends sheets_v4.Schema$BasicChartSeries {
  trendline?: {
    type?: string;
    label?: string;
    showR2?: boolean;
    labeledDataKey?: string;
    polynomialDegree?: number;
    color?: sheets_v4.Schema$Color;
  };
  dataLabel?: {
    type?: string;
    placement?: string;
    textFormat?: sheets_v4.Schema$TextFormat;
  };
}

export class VisualizeHandler extends BaseHandler<SheetsVisualizeInput, SheetsVisualizeOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_visualize', context);
    this.sheetsApi = sheetsApi;
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  async handle(input: SheetsVisualizeInput): Promise<SheetsVisualizeOutput> {
    // Phase 1, Task 1.4: Infer missing parameters from context
    const rawReq = unwrapRequest<SheetsVisualizeInput['request']>(input);
    const req = this.inferRequestParameters(rawReq) as VisualizeRequest;

    try {
      let response: VisualizeResponse;

      // Route to appropriate handler based on action (18 total)
      switch (req.action) {
        // ====================================================================
        // CHART ACTIONS (11)
        // ====================================================================
        case 'chart_create':
          response = await this.handleChartCreate(req as ChartCreateInput);
          break;
        case 'suggest_chart':
          response = await this.handleSuggestChart(req as SuggestChartInput);
          break;
        case 'chart_update':
          response = await this.handleChartUpdate(req as ChartUpdateInput);
          break;
        case 'chart_delete':
          response = await this.handleChartDelete(req as ChartDeleteInput);
          break;
        case 'chart_list':
          response = await this.handleChartList(req as ChartListInput);
          break;
        case 'chart_get':
          response = await this.handleChartGet(req as ChartGetInput);
          break;
        case 'chart_move':
          response = await this.handleChartMove(req as ChartMoveInput);
          break;
        case 'chart_resize':
          response = await this.handleChartResize(req as ChartResizeInput);
          break;
        case 'chart_update_data_range':
          response = await this.handleChartUpdateDataRange(req as ChartUpdateDataRangeInput);
          break;
        case 'chart_add_trendline':
          response = await this.handleChartAddTrendline(req as ChartAddTrendlineInput);
          break;
        case 'chart_remove_trendline':
          response = await this.handleChartRemoveTrendline(req as ChartRemoveTrendlineInput);
          break;

        // ====================================================================
        // PIVOT ACTIONS (7)
        // ====================================================================
        case 'pivot_create':
          response = await this.handlePivotCreate(req as PivotCreateInput);
          break;
        case 'suggest_pivot':
          response = await this.handleSuggestPivot(req as SuggestPivotInput);
          break;
        case 'pivot_update':
          response = await this.handlePivotUpdate(req as PivotUpdateInput);
          break;
        case 'pivot_delete':
          response = await this.handlePivotDelete(req as PivotDeleteInput);
          break;
        case 'pivot_list':
          response = await this.handlePivotList(req as PivotListInput);
          break;
        case 'pivot_get':
          response = await this.handlePivotGet(req as PivotGetInput);
          break;
        case 'pivot_refresh':
          response = await this.handlePivotRefresh(req as PivotRefreshInput);
          break;

        default: {
          const _exhaustiveCheck: never = req;
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
        }
      }

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: 'spreadsheetId' in req ? req.spreadsheetId : undefined,
          sheetId:
            'sheetId' in req
              ? typeof req.sheetId === 'number'
                ? req.sheetId
                : undefined
              : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsVisualizeInput): Intent[] {
    const req = unwrapRequest<SheetsVisualizeInput['request']>(input);
    if ('spreadsheetId' in req && req.spreadsheetId) {
      // Determine intent type and destructiveness
      const destructiveActions = ['chart_delete', 'pivot_delete'] as const;
      const isDestructive = destructiveActions.includes(
        req.action as (typeof destructiveActions)[number]
      );

      let type: Intent['type'];
      if (req.action.startsWith('chart_')) {
        type =
          req.action === 'chart_create'
            ? 'ADD_CHART'
            : req.action === 'chart_delete'
              ? 'DELETE_CHART'
              : 'UPDATE_CHART';
      } else {
        type =
          req.action === 'pivot_create'
            ? 'ADD_PIVOT_TABLE'
            : req.action === 'pivot_delete'
              ? 'DELETE_PIVOT_TABLE'
              : 'UPDATE_PIVOT_TABLE';
      }

      return [
        {
          type,
          target: { spreadsheetId: req.spreadsheetId },
          payload: {},
          metadata: {
            sourceTool: this.toolName,
            sourceAction: req.action,
            priority: 1,
            destructive: isDestructive,
          },
        },
      ];
    }
    return [];
  }

  // ============================================================
  // CHART ACTIONS (10)
  // ============================================================

  private async handleChartCreate(input: ChartCreateInput): Promise<VisualizeResponse> {
    const dataRange = await this.toGridRange(input.spreadsheetId, input.data.sourceRange);
    const position = await this.toOverlayPosition(
      input.spreadsheetId,
      input.position.anchorCell,
      input.position
    );

    // Route to appropriate chart spec builder based on chart type
    const chartSpec = this.buildChartSpec(dataRange, input.chartType, input.data, input.options);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addChart: {
              chart: {
                spec: chartSpec,
                position,
              },
            },
          },
        ],
      },
    });

    const chartId = response.data?.replies?.[0]?.addChart?.chart?.chartId ?? undefined;
    return this.success('chart_create', { chartId });
  }

  private async handleSuggestChart(input: SuggestChartInput): Promise<VisualizeResponse> {
    // Check if LLM fallback is available or server supports sampling
    const samplingSupport = this.context.server
      ? checkSamplingSupport(this.context.server.getClientCapabilities?.())
      : { supported: false };
    const hasLLMFallback = isLLMFallbackAvailable();

    if (!hasLLMFallback && (!this.context.server || !samplingSupport.supported)) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message:
          'Chart suggestions require MCP Sampling capability (SEP-1577) or LLM API key. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY environment variable.',
        retryable: false,
        suggestedFix:
          'Enable the feature by setting the appropriate environment variable, or contact your administrator',
      });
    }

    if (!input.range) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Range is required for chart suggestions',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const startTime = Date.now();

    try {
      // Convert range to A1 notation string
      const rangeStr =
        typeof input.range === 'string'
          ? input.range
          : 'a1' in input.range
            ? input.range.a1
            : 'Sheet1';

      // Fetch data from the specified range
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId!,
        range: rangeStr,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const values = response.data.values || [];
      if (values.length === 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Range contains no data',
          retryable: false,
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
        });
      }

      // Analyze data structure
      const hasHeaders =
        values.length > 1 && values[0]?.every((v: unknown) => typeof v === 'string');
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
        this.context.server as Parameters<typeof createMessageWithFallback>[0],
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
        return this.error({
          code: 'INTERNAL_ERROR',
          message: 'Could not parse chart suggestions from AI response',
          retryable: true,
          suggestedFix: 'Please try again. If the issue persists, contact support',
        });
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return this.success('suggest_chart', {
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
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Chart suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  private async handleChartUpdate(input: ChartUpdateInput): Promise<VisualizeResponse> {
    const requests: sheets_v4.Schema$Request[] = [];

    // If updating chart spec properties (title, chartType), we need to fetch and merge with existing spec
    if (input.chartType || input.options?.title) {
      // Fetch existing chart to get current spec
      const getResponse = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.charts',
      });

      let existingSpec: sheets_v4.Schema$ChartSpec | undefined;
      for (const sheet of getResponse.data.sheets || []) {
        const chart = sheet.charts?.find((c) => c.chartId === input.chartId);
        if (chart?.spec) {
          existingSpec = chart.spec;
          break;
        }
      }

      if (!existingSpec) {
        return this.error({
          code: 'RANGE_NOT_FOUND',
          message: `Chart with ID ${input.chartId} not found`,
          retryable: false,
          suggestedFix: 'Verify the range reference is correct and the sheet exists',
        });
      }

      // Merge updates into existing spec
      const updatedSpec = { ...existingSpec };
      if (input.options?.title) {
        updatedSpec.title = input.options.title;
      }
      if (input.chartType && updatedSpec.basicChart) {
        updatedSpec.basicChart = { ...updatedSpec.basicChart, chartType: input.chartType };
      }

      requests.push({
        updateChartSpec: {
          chartId: input.chartId,
          spec: updatedSpec,
        },
      });
    }

    if (input.position) {
      const position = await this.toOverlayPosition(
        input.spreadsheetId,
        input.position.anchorCell,
        input.position
      );
      requests.push({
        updateEmbeddedObjectPosition: {
          objectId: input.chartId,
          newPosition: position,
          fields: '*',
        },
      });
    }

    if (requests.length === 0) {
      return this.success('chart_update', {});
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('chart_update', {});
  }

  private async handleChartDelete(input: ChartDeleteInput): Promise<VisualizeResponse> {
    if (input.safety?.dryRun) {
      return this.success('chart_delete', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'chart_delete',
        `Delete chart (ID: ${input.chartId}) from spreadsheet ${input.spreadsheetId}. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'chart_delete',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteEmbeddedObject: {
              objectId: input.chartId,
            },
          },
        ],
      },
    });

    return this.success('chart_delete', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleChartList(input: ChartListInput): Promise<VisualizeResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.charts,sheets.properties.sheetId',
    });

    const charts: Array<{
      chartId: number;
      chartType: string;
      sheetId: number;
      title?: string;
      position: {
        anchorCell: string;
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
      };
    }> = [];

    for (const sheet of response.data.sheets ?? []) {
      const sheetId = sheet.properties?.sheetId ?? 0;
      if (input.sheetId !== undefined && sheetId !== input.sheetId) continue;

      for (const chart of sheet.charts ?? []) {
        const overlay = chart.position?.overlayPosition;
        charts.push({
          chartId: chart.chartId ?? 0,
          chartType: chart.spec?.basicChart?.chartType ?? 'UNKNOWN',
          sheetId,
          title: chart.spec?.title ?? undefined,
          position: {
            anchorCell: overlay?.anchorCell
              ? this.formatAnchorCell(overlay.anchorCell)
              : `${this.columnToLetter(0)}1`,
            offsetX: overlay?.offsetXPixels ?? 0,
            offsetY: overlay?.offsetYPixels ?? 0,
            width: overlay?.widthPixels ?? 600,
            height: overlay?.heightPixels ?? 400,
          },
        });
      }
    }

    return this.success('chart_list', { charts });
  }

  private async handleChartGet(input: ChartGetInput): Promise<VisualizeResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.charts',
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const chart of sheet.charts ?? []) {
        if (chart.chartId === input.chartId) {
          const overlay = chart.position?.overlayPosition;
          return this.success('chart_get', {
            charts: [
              {
                chartId: chart.chartId ?? 0,
                chartType: chart.spec?.basicChart?.chartType ?? 'UNKNOWN',
                sheetId: overlay?.anchorCell?.sheetId ?? 0,
                title: chart.spec?.title ?? undefined,
                position: {
                  anchorCell: overlay?.anchorCell
                    ? this.formatAnchorCell(overlay.anchorCell)
                    : `${this.columnToLetter(0)}1`,
                  offsetX: overlay?.offsetXPixels ?? 0,
                  offsetY: overlay?.offsetYPixels ?? 0,
                  width: overlay?.widthPixels ?? 600,
                  height: overlay?.heightPixels ?? 400,
                },
              },
            ],
          });
        }
      }
    }

    return this.notFoundError('Chart', input.chartId);
  }

  private async handleChartMove(input: ChartMoveInput): Promise<VisualizeResponse> {
    const position = await this.toOverlayPosition(
      input.spreadsheetId,
      input.position.anchorCell,
      input.position
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateEmbeddedObjectPosition: {
              objectId: input.chartId,
              newPosition: position,
              fields: '*',
            },
          },
        ],
      },
    });

    return this.success('chart_move', {});
  }

  private async handleChartResize(input: ChartResizeInput): Promise<VisualizeResponse> {
    const currentPosition = await this.fetchChartPosition(input.spreadsheetId, input.chartId);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateEmbeddedObjectPosition: {
              objectId: input.chartId,
              newPosition: {
                overlayPosition: {
                  anchorCell: currentPosition.anchorCell,
                  offsetXPixels: currentPosition.offsetX,
                  offsetYPixels: currentPosition.offsetY,
                  widthPixels: input.width,
                  heightPixels: input.height,
                },
              },
              fields: '*',
            },
          },
        ],
      },
    });

    return this.success('chart_resize', {});
  }

  private async handleChartUpdateDataRange(
    input: ChartUpdateDataRangeInput
  ): Promise<VisualizeResponse> {
    // Fetch existing chart spec to preserve axis configuration
    const getResponse = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.charts',
    });

    let existingChart: sheets_v4.Schema$EmbeddedChart | undefined;
    for (const sheet of getResponse.data.sheets ?? []) {
      const chart = sheet.charts?.find((c) => c.chartId === input.chartId);
      if (chart) {
        existingChart = chart;
        break;
      }
    }

    if (!existingChart?.spec?.basicChart) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Chart with ID ${input.chartId} not found or is not a basic chart type`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const dataRange = await this.toGridRange(input.spreadsheetId, input.data.sourceRange);
    const toGridRangeHelper = toGridRange(dataRange);

    // Update data ranges while preserving existing chart configuration
    const domainColumn = input.data.categories ?? 0;
    const newDomainRange: sheets_v4.Schema$GridRange = {
      ...toGridRangeHelper,
      startColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn,
      endColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn + 1,
    };

    const newSeriesRanges =
      input.data.series && input.data.series.length > 0
        ? input.data.series.map((s) => ({
            ...toGridRangeHelper,
            startColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column,
            endColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column + 1,
          }))
        : [
            {
              ...toGridRangeHelper,
              startColumnIndex: (dataRange.startColumnIndex ?? 0) + 1,
              endColumnIndex: (dataRange.startColumnIndex ?? 0) + 2,
            },
          ];

    // Preserve existing axis titles, labels, and domain/series assignment
    const existingSeries = existingChart.spec.basicChart.series ?? [];
    const updatedSeries = newSeriesRanges.map((range, idx) => {
      const existingSeriesData = existingSeries[idx];
      return {
        ...existingSeriesData,
        series: { sourceRange: { sources: [range] } },
      };
    });

    if (input.safety?.dryRun) {
      return this.success('chart_update_data_range', {}, undefined, true);
    }

    const updatedSpec: sheets_v4.Schema$ChartSpec = {
      ...existingChart.spec,
      basicChart: {
        ...existingChart.spec.basicChart,
        domains: [
          {
            domain: {
              sourceRange: { sources: [newDomainRange] },
            },
          },
        ],
        series: updatedSeries,
      },
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateChartSpec: {
              chartId: input.chartId,
              spec: updatedSpec,
            },
          },
        ],
      },
    });

    return this.success('chart_update_data_range', {});
  }

  private async handleChartAddTrendline(input: ChartAddTrendlineInput): Promise<VisualizeResponse> {
    // Trendlines are only supported on certain chart types
    const compatibleTypes = ['LINE', 'AREA', 'SCATTER', 'STEPPED_AREA', 'COLUMN'];

    // Fetch existing chart spec
    const getResponse = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.charts',
    });

    let existingChart: sheets_v4.Schema$EmbeddedChart | undefined;
    for (const sheet of getResponse.data.sheets ?? []) {
      const chart = sheet.charts?.find((c) => c.chartId === input.chartId);
      if (chart) {
        existingChart = chart;
        break;
      }
    }

    if (!existingChart?.spec?.basicChart) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Chart with ID ${input.chartId} not found or is not a basic chart type`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const chartType = existingChart.spec.basicChart.chartType ?? '';
    if (!compatibleTypes.includes(chartType)) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Trendlines are not supported on ${chartType} charts. Use LINE, AREA, SCATTER, STEPPED_AREA, or COLUMN charts.`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const series = [...(existingChart.spec.basicChart.series ?? [])] as ExtendedBasicChartSeries[];
    if (input.seriesIndex >= series.length) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Series index ${input.seriesIndex} out of range. Chart has ${series.length} series.`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    if (input.safety?.dryRun) {
      return this.success('chart_add_trendline', { chartId: input.chartId }, undefined, true);
    }

    // Build trendline spec (googleapis types don't include trendline, but the API supports it)
    const trendlineSpec: ExtendedBasicChartSeries['trendline'] = {
      type: input.trendline.type,
      label: input.trendline.label,
      showR2: input.trendline.showRSquared,
      labeledDataKey: input.trendline.showEquation ? 'FORMULA' : undefined,
    };

    // Add polynomial degree if applicable
    if (input.trendline.type === 'POLYNOMIAL' && input.trendline.polynomialDegree) {
      trendlineSpec.polynomialDegree = input.trendline.polynomialDegree;
    }

    // Add color if specified
    if (input.trendline.color) {
      trendlineSpec.color = {
        red: input.trendline.color.red,
        green: input.trendline.color.green,
        blue: input.trendline.color.blue,
        alpha: input.trendline.color.alpha,
      };
    }

    // Update series with trendline
    series[input.seriesIndex] = {
      ...series[input.seriesIndex],
      trendline: trendlineSpec,
    };

    // Update the chart spec
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateChartSpec: {
              chartId: input.chartId,
              spec: {
                ...existingChart.spec,
                basicChart: {
                  ...existingChart.spec.basicChart,
                  series,
                },
              },
            },
          },
        ],
      },
    });

    return this.success('chart_add_trendline', { chartId: input.chartId });
  }

  private async handleChartRemoveTrendline(
    input: ChartRemoveTrendlineInput
  ): Promise<VisualizeResponse> {
    // Fetch existing chart spec
    const getResponse = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.charts',
    });

    let existingChart: sheets_v4.Schema$EmbeddedChart | undefined;
    for (const sheet of getResponse.data.sheets ?? []) {
      const chart = sheet.charts?.find((c) => c.chartId === input.chartId);
      if (chart) {
        existingChart = chart;
        break;
      }
    }

    if (!existingChart?.spec?.basicChart) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Chart with ID ${input.chartId} not found or is not a basic chart type`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Cast to extended type (googleapis types don't include trendline, but the API supports it)
    const series = [...(existingChart.spec.basicChart.series ?? [])] as ExtendedBasicChartSeries[];
    if (input.seriesIndex >= series.length) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Series index ${input.seriesIndex} out of range. Chart has ${series.length} series.`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    if (!series[input.seriesIndex]?.trendline) {
      return this.error({
        code: 'NOT_FOUND',
        message: `No trendline found on series ${input.seriesIndex}`,
        retryable: false,
        suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
      });
    }

    if (input.safety?.dryRun) {
      return this.success('chart_remove_trendline', { chartId: input.chartId }, undefined, true);
    }

    // Remove trendline from series
    series[input.seriesIndex] = {
      ...series[input.seriesIndex],
      trendline: undefined,
    };

    // Update the chart spec
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateChartSpec: {
              chartId: input.chartId,
              spec: {
                ...existingChart.spec,
                basicChart: {
                  ...existingChart.spec.basicChart,
                  series,
                },
              },
            },
          },
        ],
      },
    });

    return this.success('chart_remove_trendline', { chartId: input.chartId });
  }

  // ============================================================
  // PIVOT ACTIONS (7)
  // ============================================================

  private async handlePivotCreate(input: PivotCreateInput): Promise<VisualizeResponse> {
    const sourceRange = await this.toGridRange(input.spreadsheetId, input.sourceRange);
    const destination = await this.toDestination(
      input.spreadsheetId,
      input.destinationCell,
      input.destinationSheetId
    );

    const pivot: sheets_v4.Schema$PivotTable = {
      source: toGridRange(sourceRange),
      rows: input.rows?.map(this.mapPivotGroup) ?? [],
      columns: input.columns?.map(this.mapPivotGroup) ?? [],
      values: input.values.map(this.mapPivotValue),
      filterSpecs: input.filters?.map(this.mapPivotFilter),
    };

    const _response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              start: destination,
              fields: 'pivotTable',
              rows: [
                {
                  values: [
                    {
                      pivotTable: pivot,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    const sheetId = destination.sheetId ?? 0;
    return this.success('pivot_create', {
      pivotTable: {
        sheetId,
        sourceRange,
        rowGroups: pivot.rows?.length ?? 0,
        columnGroups: pivot.columns?.length ?? 0,
        values: pivot.values?.length ?? 0,
      },
    });
  }

  private async handleSuggestPivot(input: SuggestPivotInput): Promise<VisualizeResponse> {
    // Check if LLM fallback is available or server supports sampling
    const samplingSupport = this.context.server
      ? checkSamplingSupport(this.context.server.getClientCapabilities?.())
      : { supported: false };
    const hasLLMFallback = isLLMFallbackAvailable();

    if (!hasLLMFallback && (!this.context.server || !samplingSupport.supported)) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message:
          'Pivot table suggestions require MCP Sampling capability (SEP-1577) or LLM API key. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY environment variable.',
        retryable: false,
        suggestedFix:
          'Enable the feature by setting the appropriate environment variable, or contact your administrator',
      });
    }

    if (!input.range) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Range is required for pivot table suggestions',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const _server = this.context.server;
    const startTime = Date.now();

    try {
      // Convert range to A1 notation string
      const rangeStr =
        typeof input.range === 'string'
          ? input.range
          : 'a1' in input.range
            ? input.range.a1
            : 'Sheet1';

      // Fetch data from the specified range
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId!,
        range: rangeStr,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const values = response.data.values || [];
      if (values.length === 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Range contains no data',
          retryable: false,
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
        });
      }

      // Analyze data structure
      const hasHeaders =
        values.length > 1 && values[0]?.every((v: unknown) => typeof v === 'string');
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
        this.context.server as Parameters<typeof createMessageWithFallback>[0],
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
        return this.error({
          code: 'INTERNAL_ERROR',
          message: 'Could not parse pivot table suggestions from AI response',
          retryable: true,
          suggestedFix: 'Please try again. If the issue persists, contact support',
        });
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return this.success('suggest_pivot', {
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
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Pivot table suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  private async handlePivotUpdate(input: PivotUpdateInput): Promise<VisualizeResponse> {
    const sheetId = input.sheetId;
    const pivotRange = await this.findPivotRange(input.spreadsheetId, sheetId);

    if (!pivotRange) {
      return this.notFoundError('Pivot on sheet', sheetId);
    }

    const pivot: sheets_v4.Schema$PivotTable = {
      source: pivotRange,
      rows: input.rows?.map(this.mapPivotGroup),
      columns: input.columns?.map(this.mapPivotGroup),
      values: input.values?.map(this.mapPivotValue),
      filterSpecs: input.filters?.map(this.mapPivotFilter),
    };

    if (input.safety?.dryRun) {
      return this.success('pivot_update', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              start: {
                sheetId,
                rowIndex: pivotRange.startRowIndex ?? 0,
                columnIndex: pivotRange.startColumnIndex ?? 0,
              },
              fields: 'pivotTable',
              rows: [
                {
                  values: [
                    {
                      pivotTable: pivot,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    return this.success('pivot_update', {});
  }

  private async handlePivotDelete(input: PivotDeleteInput): Promise<VisualizeResponse> {
    if (input.safety?.dryRun) {
      return this.success('pivot_delete', {}, undefined, true);
    }

    // Request confirmation if elicitation available (CRITICAL: deletes entire sheet)
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'pivot_delete',
        `Delete pivot table by removing entire sheet (ID: ${input.sheetId}) from spreadsheet ${input.spreadsheetId}. This will delete ALL data on the sheet. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    }

    // Create snapshot if requested (CRITICAL operation)
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'pivot_delete',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: { sheetId: input.sheetId },
          },
        ],
      },
    });

    return this.success('pivot_delete', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handlePivotList(input: PivotListInput): Promise<VisualizeResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties,sheets.data.rowData.values.pivotTable',
    });

    const pivotTables: NonNullable<VisualizeSuccess['pivotTables']> = [];

    for (const sheet of response.data.sheets ?? []) {
      const hasPivot = sheet.data?.some((d) =>
        d.rowData?.some((r) => r.values?.some((v) => v.pivotTable))
      );
      if (hasPivot) {
        pivotTables.push({
          sheetId: sheet.properties?.sheetId ?? 0,
          title: sheet.properties?.title ?? '',
        });
      }
    }

    return this.success('pivot_list', { pivotTables });
  }

  private async handlePivotGet(input: PivotGetInput): Promise<VisualizeResponse> {
    // Validate spreadsheet size before loading full grid data
    const sizeError = await this.validateGridDataSize(
      input.spreadsheetId,
      this.sheetsApi,
      input.sheetId
    );
    if (sizeError) return sizeError as VisualizeResponse;

    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      // Don't use ranges with sheetId - filter from response instead
      includeGridData: true,
      fields:
        'sheets.data.rowData.values.pivotTable,sheets.properties.sheetId,sheets.properties.title',
    });

    for (const sheet of response.data.sheets ?? []) {
      if (sheet.properties?.sheetId !== input.sheetId) continue;
      for (const data of sheet.data ?? []) {
        for (const row of data.rowData ?? []) {
          for (const value of row.values ?? []) {
            if (value.pivotTable) {
              const pt = value.pivotTable;
              const sourceRange = this.normalizeGridRange(pt.source, input.sheetId);
              return this.success('pivot_get', {
                pivotTable: {
                  sheetId: input.sheetId,
                  sourceRange,
                  rowGroups: pt.rows?.length ?? 0,
                  columnGroups: pt.columns?.length ?? 0,
                  values: pt.values?.length ?? 0,
                },
              });
            }
          }
        }
      }
    }

    return this.notFoundError('Pivot on sheet', input.sheetId);
  }

  private async handlePivotRefresh(input: PivotRefreshInput): Promise<VisualizeResponse> {
    // Sheets API does not expose explicit pivot refresh; rewriting pivot triggers refresh.
    const getInput = {
      action: 'pivot_get',
      spreadsheetId: input.spreadsheetId,
      sheetId: input.sheetId,
    } as PivotGetInput;
    const getResult = await this.handlePivotGet(getInput);
    if (!getResult.success || !getResult.pivotTable) {
      return getResult;
    }

    // Rewrite pivot to force refresh
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              start: {
                sheetId: input.sheetId,
                rowIndex: getResult.pivotTable.sourceRange.startRowIndex ?? 0,
                columnIndex: getResult.pivotTable.sourceRange.startColumnIndex ?? 0,
              },
              fields: 'pivotTable',
              rows: [
                {
                  values: [
                    {
                      pivotTable: {
                        source: getResult.pivotTable.sourceRange,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    return this.success('pivot_refresh', {});
  }

  // ============================================================
  // CHART HELPER METHODS
  // ============================================================

  private buildBasicChartSpec(
    dataRange: GridRangeInput,
    chartType: sheets_v4.Schema$BasicChartSpec['chartType'] | undefined,
    data: ChartCreateInput['data'],
    options?: ChartCreateInput['options']
  ): sheets_v4.Schema$ChartSpec {
    const domainColumn = data.categories ?? 0;
    const domainRange: sheets_v4.Schema$GridRange = {
      ...toGridRange(dataRange),
      startColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn,
      endColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn + 1,
    };

    const seriesRanges =
      data.series && data.series.length > 0
        ? data.series.map((s) => ({
            ...toGridRange(dataRange),
            startColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column,
            endColumnIndex: (dataRange.startColumnIndex ?? 0) + s.column + 1,
          }))
        : [
            {
              ...toGridRange(dataRange),
              startColumnIndex: (dataRange.startColumnIndex ?? 0) + 1,
              endColumnIndex: (dataRange.startColumnIndex ?? 0) + 2,
            },
          ];

    return {
      title: options?.title,
      basicChart: {
        chartType: chartType ?? 'BAR',
        headerCount: 1,
        domains: [
          {
            domain: {
              sourceRange: { sources: [domainRange] },
            },
          },
        ],
        // Use extended type to support trendline/dataLabel (googleapis types are incomplete)
        series: seriesRanges.map((range, idx) => {
          const seriesData = data.series?.[idx];
          const result: ExtendedBasicChartSeries = {
            series: { sourceRange: { sources: [range] } },
            // BAR charts require BOTTOM_AXIS, all others use LEFT_AXIS
            targetAxis: chartType === 'BAR' ? 'BOTTOM_AXIS' : 'LEFT_AXIS',
            color: seriesData?.color,
          };

          // Add trendline if configured (only for compatible chart types)
          if (
            seriesData?.trendline &&
            chartType &&
            ['LINE', 'AREA', 'SCATTER', 'STEPPED_AREA', 'COLUMN'].includes(chartType)
          ) {
            result.trendline = {
              type: seriesData.trendline.type,
              label: seriesData.trendline.label,
              showR2: seriesData.trendline.showRSquared,
              labeledDataKey: seriesData.trendline.showEquation ? 'FORMULA' : undefined,
              polynomialDegree:
                seriesData.trendline.type === 'POLYNOMIAL'
                  ? seriesData.trendline.polynomialDegree
                  : undefined,
              color: seriesData.trendline.color,
            };
          }

          // Add data label if configured
          if (seriesData?.dataLabel && seriesData.dataLabel.type !== 'NONE') {
            result.dataLabel = {
              type: seriesData.dataLabel.type,
              placement: seriesData.dataLabel.placement,
              textFormat: seriesData.dataLabel.textFormat,
            };
          }

          return result;
        }),
        legendPosition: options?.legendPosition,
        threeDimensional: options?.is3D,
        // stackedType only supported for BAR, COLUMN, AREA, STEPPED_AREA charts
        ...(chartType && ['BAR', 'COLUMN', 'AREA', 'STEPPED_AREA'].includes(chartType)
          ? { stackedType: options?.stacked ? 'STACKED' : 'NOT_STACKED' }
          : {}),
      },
    };
  }

  /**
   * Route chart creation to appropriate spec builder based on chart type
   * PIE/DOUGHNUT/TREEMAP/HISTOGRAM/SCORECARD/WATERFALL/CANDLESTICK need specific specs
   * BAR/LINE/AREA/COLUMN/SCATTER/COMBO/STEPPED_AREA use BasicChartSpec
   */
  private buildChartSpec(
    dataRange: GridRangeInput,
    chartType: string | undefined,
    data: ChartCreateInput['data'],
    options?: ChartCreateInput['options']
  ): sheets_v4.Schema$ChartSpec {
    const title = options?.title;
    const gridRange = toGridRange(dataRange);

    switch (chartType) {
      case 'PIE':
      case 'DOUGHNUT':
        return {
          title,
          pieChart: {
            domain: {
              sourceRange: {
                sources: [
                  {
                    ...gridRange,
                    startColumnIndex: (dataRange.startColumnIndex ?? 0) + (data.categories ?? 0),
                    endColumnIndex: (dataRange.startColumnIndex ?? 0) + (data.categories ?? 0) + 1,
                  },
                ],
              },
            },
            series: {
              sourceRange: {
                sources: [
                  {
                    ...gridRange,
                    startColumnIndex:
                      (dataRange.startColumnIndex ?? 0) + (data.series?.[0]?.column ?? 1),
                    endColumnIndex:
                      (dataRange.startColumnIndex ?? 0) + (data.series?.[0]?.column ?? 1) + 1,
                  },
                ],
              },
            },
            threeDimensional: options?.is3D,
            pieHole: chartType === 'DOUGHNUT' ? (options?.pieHole ?? 0.5) : 0,
            legendPosition: options?.legendPosition,
          },
        };

      case 'HISTOGRAM':
        return {
          title,
          histogramChart: {
            series: [
              {
                data: { sourceRange: { sources: [gridRange] } },
              },
            ],
            legendPosition: options?.legendPosition,
          },
        };

      case 'SCORECARD':
        return {
          title,
          scorecardChart: {
            keyValueData: {
              sourceRange: { sources: [gridRange] },
            },
            aggregateType: 'SUM',
          },
        };

      // BAR, LINE, AREA, COLUMN, SCATTER, COMBO, STEPPED_AREA, and others use BasicChartSpec
      default:
        return this.buildBasicChartSpec(
          dataRange,
          chartType as sheets_v4.Schema$BasicChartSpec['chartType'],
          data,
          options
        );
    }
  }

  private async toOverlayPosition(
    spreadsheetId: string,
    anchorCell: string,
    position: {
      offsetX?: number;
      offsetY?: number;
      width?: number;
      height?: number;
    }
  ): Promise<sheets_v4.Schema$EmbeddedObjectPosition> {
    const parsed = parseCellReference(anchorCell);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return {
      overlayPosition: {
        anchorCell: {
          sheetId,
          rowIndex: parsed.row,
          columnIndex: parsed.col,
        },
        offsetXPixels: position.offsetX ?? 0,
        offsetYPixels: position.offsetY ?? 0,
        widthPixels: position.width ?? 600,
        heightPixels: position.height ?? 400,
      },
    };
  }

  private async fetchChartPosition(
    spreadsheetId: string,
    chartId: number
  ): Promise<{
    anchorCell: sheets_v4.Schema$GridCoordinate;
    offsetX: number;
    offsetY: number;
  }> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.charts',
    });

    for (const sheet of response.data.sheets ?? []) {
      for (const chart of sheet.charts ?? []) {
        if (chart.chartId === chartId) {
          const overlay = chart.position?.overlayPosition;
          if (overlay?.anchorCell) {
            return {
              anchorCell: overlay.anchorCell,
              offsetX: overlay.offsetXPixels ?? 0,
              offsetY: overlay.offsetYPixels ?? 0,
            };
          }
        }
      }
    }

    // Fallback anchor
    return {
      anchorCell: {
        sheetId: sheetIdFallback(response.data.sheets),
        rowIndex: 0,
        columnIndex: 0,
      },
      offsetX: 0,
      offsetY: 0,
    };
  }

  private formatAnchorCell(anchor: sheets_v4.Schema$GridCoordinate): string {
    const colLetter = this.columnToLetter(anchor.columnIndex ?? 0);
    const rowNumber = (anchor.rowIndex ?? 0) + 1;
    return `${colLetter}${rowNumber}`;
  }

  // ============================================================
  // PIVOT HELPER METHODS
  // ============================================================

  private async toDestination(
    spreadsheetId: string,
    destinationCell?: string,
    destinationSheetId?: number
  ): Promise<sheets_v4.Schema$GridCoordinate> {
    if (destinationCell) {
      const parsed = parseCellReference(destinationCell);
      const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
      return { sheetId, rowIndex: parsed.row, columnIndex: parsed.col };
    }

    if (destinationSheetId !== undefined) {
      return { sheetId: destinationSheetId, rowIndex: 0, columnIndex: 0 };
    }

    // Default: new sheet
    const newSheet = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: { properties: { title: 'Pivot Table' } },
          },
        ],
      },
    });
    const sheetId = newSheet.data?.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    return { sheetId, rowIndex: 0, columnIndex: 0 };
  }

  private mapPivotGroup = (
    group: NonNullable<PivotCreateInput['rows']>[number]
  ): sheets_v4.Schema$PivotGroup => ({
    sourceColumnOffset: group.sourceColumnOffset,
    showTotals: group.showTotals,
    sortOrder: group.sortOrder ?? 'ASCENDING',
    groupRule: group.groupRule
      ? {
          dateTimeRule: group.groupRule.dateTimeRule
            ? { type: group.groupRule.dateTimeRule.type }
            : undefined,
          manualRule: group.groupRule.manualRule
            ? {
                groups: group.groupRule.manualRule.groups.map((ruleGroup) => ({
                  groupName: { stringValue: ruleGroup.groupName },
                  items: ruleGroup.items.map((item) => ({ stringValue: item })),
                })),
              }
            : undefined,
          histogramRule: group.groupRule.histogramRule
            ? {
                interval: group.groupRule.histogramRule.interval,
                start: group.groupRule.histogramRule.start,
                end: group.groupRule.histogramRule.end,
              }
            : undefined,
        }
      : undefined,
  });

  private mapPivotValue = (
    value: NonNullable<PivotCreateInput['values']>[number]
  ): sheets_v4.Schema$PivotValue => ({
    sourceColumnOffset: value.sourceColumnOffset,
    summarizeFunction: value.summarizeFunction,
    name: value.name,
    calculatedDisplayType: value.calculatedDisplayType,
  });

  private mapPivotFilter = (
    filter: NonNullable<PivotCreateInput['filters']>[number]
  ): sheets_v4.Schema$PivotFilterSpec => ({
    columnOffsetIndex: filter.sourceColumnOffset,
    filterCriteria: {
      visibleValues: filter.filterCriteria.visibleValues,
      condition: filter.filterCriteria.condition
        ? {
            type: filter.filterCriteria.condition.type as sheets_v4.Schema$BooleanCondition['type'],
            values: filter.filterCriteria.condition.values?.map((value) => ({
              userEnteredValue: value,
            })),
          }
        : undefined,
    },
  });

  private normalizeGridRange(
    range: sheets_v4.Schema$GridRange | undefined,
    fallbackSheetId: number
  ): GridRangeInput {
    return buildGridRangeInput(
      range?.sheetId ?? fallbackSheetId,
      range?.startRowIndex ?? undefined,
      range?.endRowIndex ?? undefined,
      range?.startColumnIndex ?? undefined,
      range?.endColumnIndex ?? undefined
    );
  }

  private async findPivotRange(
    spreadsheetId: string,
    sheetId: number
  ): Promise<sheets_v4.Schema$GridRange | null> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties,sheets.data.rowData.values.pivotTable',
    });

    for (const sheet of response.data.sheets ?? []) {
      if (sheet.properties?.sheetId !== sheetId) continue;
      for (const data of sheet.data ?? []) {
        for (const row of data.rowData ?? []) {
          for (const value of row.values ?? []) {
            if (value.pivotTable?.source) {
              return value.pivotTable.source;
            }
          }
        }
      }
    }
    return null;
  }

  // ============================================================
  // SHARED HELPER METHODS
  // ============================================================

  private async toGridRange(
    spreadsheetId: string,
    rangeInput: RangeInput
  ): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, rangeInput);

    // Handle comma-separated ranges by parsing each one
    // Charts that need multiple ranges should use the series.column pattern instead
    const ranges = this.splitRangeNotation(a1);
    if (ranges.length > 1) {
      logger.warn(
        `Multiple comma-separated ranges detected: "${a1}". Using first range only. ` +
          `For multi-series charts, use the series[].column pattern instead.`
      );
    }

    const firstRange = ranges[0] || a1;
    const parsed = parseA1Notation(firstRange);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return buildGridRangeInput(
      sheetId,
      parsed.startRow,
      parsed.endRow,
      parsed.startCol,
      parsed.endCol
    );
  }

  /**
   * Split comma-separated A1 notation, respecting quoted sheet names
   * E.g., "'Sheet One'!A1:B2,C1:D2" -> ["'Sheet One'!A1:B2", "C1:D2"]
   */
  private splitRangeNotation(notation: string): string[] {
    if (!notation.includes(',')) {
      return [notation];
    }

    const ranges: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of notation) {
      if (char === "'" && !inQuotes) {
        inQuotes = true;
        current += char;
      } else if (char === "'" && inQuotes) {
        inQuotes = false;
        current += char;
      } else if (char === ',' && !inQuotes) {
        if (current.trim()) {
          ranges.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      ranges.push(current.trim());
    }

    return ranges;
  }
}

function sheetIdFallback(sheets?: sheets_v4.Schema$Sheet[]): number {
  return sheets?.[0]?.properties?.sheetId ?? 0;
}
