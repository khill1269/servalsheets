/**
 * ServalSheets - Visualize Handler
 *
 * Consolidated handler for sheets_visualize tool (chart and pivot table operations)
 * Merges: charts.ts (9 actions) + pivot.ts (7 actions) = 16 actions total
 * MCP Protocol: 2025-11-25
 */
import { BaseHandler, unwrapRequest } from './base.js';
import { parseA1Notation, parseCellReference, toGridRange, } from '../utils/google-sheets-helpers.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { checkSamplingSupport } from '../mcp/sampling.js';
export class VisualizeHandler extends BaseHandler {
    sheetsApi;
    constructor(context, sheetsApi) {
        super('sheets_visualize', context);
        this.sheetsApi = sheetsApi;
    }
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    async handle(input) {
        // Phase 1, Task 1.4: Infer missing parameters from context
        const rawReq = unwrapRequest(input);
        const req = this.inferRequestParameters(rawReq);
        try {
            let response;
            // Route to appropriate handler based on action (17 total)
            switch (req.action) {
                // ====================================================================
                // CHART ACTIONS (10)
                // ====================================================================
                case 'chart_create':
                    response = await this.handleChartCreate(req);
                    break;
                case 'suggest_chart':
                    response = await this.handleSuggestChart(req);
                    break;
                case 'chart_update':
                    response = await this.handleChartUpdate(req);
                    break;
                case 'chart_delete':
                    response = await this.handleChartDelete(req);
                    break;
                case 'chart_list':
                    response = await this.handleChartList(req);
                    break;
                case 'chart_get':
                    response = await this.handleChartGet(req);
                    break;
                case 'chart_move':
                    response = await this.handleChartMove(req);
                    break;
                case 'chart_resize':
                    response = await this.handleChartResize(req);
                    break;
                case 'chart_update_data_range':
                    response = await this.handleChartUpdateDataRange(req);
                    break;
                // ====================================================================
                // PIVOT ACTIONS (7)
                // ====================================================================
                case 'pivot_create':
                    response = await this.handlePivotCreate(req);
                    break;
                case 'suggest_pivot':
                    response = await this.handleSuggestPivot(req);
                    break;
                case 'pivot_update':
                    response = await this.handlePivotUpdate(req);
                    break;
                case 'pivot_delete':
                    response = await this.handlePivotDelete(req);
                    break;
                case 'pivot_list':
                    response = await this.handlePivotList(req);
                    break;
                case 'pivot_get':
                    response = await this.handlePivotGet(req);
                    break;
                case 'pivot_refresh':
                    response = await this.handlePivotRefresh(req);
                    break;
                default: {
                    const _exhaustiveCheck = req;
                    response = this.error({
                        code: 'INVALID_PARAMS',
                        message: `Unknown action: ${_exhaustiveCheck.action}`,
                        retryable: false,
                    });
                }
            }
            // Track context on success
            if (response.success) {
                this.trackContextFromRequest({
                    spreadsheetId: 'spreadsheetId' in req ? req.spreadsheetId : undefined,
                    sheetId: 'sheetId' in req
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
        }
        catch (err) {
            return { response: this.mapError(err) };
        }
    }
    createIntents(input) {
        const req = unwrapRequest(input);
        if ('spreadsheetId' in req && req.spreadsheetId) {
            // Determine intent type and destructiveness
            const destructiveActions = ['chart_delete', 'pivot_delete'];
            const isDestructive = destructiveActions.includes(req.action);
            let type;
            if (req.action.startsWith('chart_')) {
                type =
                    req.action === 'chart_create'
                        ? 'ADD_CHART'
                        : req.action === 'chart_delete'
                            ? 'DELETE_CHART'
                            : 'UPDATE_CHART';
            }
            else {
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
    async handleChartCreate(input) {
        const dataRange = await this.toGridRange(input.spreadsheetId, input.data.sourceRange);
        const position = await this.toOverlayPosition(input.spreadsheetId, input.position.anchorCell, input.position);
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
        const chartId = response.data.replies?.[0]?.addChart?.chart?.chartId ?? undefined;
        return this.success('chart_create', { chartId });
    }
    async handleSuggestChart(input) {
        // Check if server exists and client supports sampling
        const samplingSupport = this.context.server
            ? checkSamplingSupport(this.context.server.getClientCapabilities?.())
            : { supported: false };
        if (!this.context.server || !samplingSupport.supported) {
            return this.error({
                code: 'FEATURE_UNAVAILABLE',
                message: 'Chart suggestions require MCP Sampling capability (SEP-1577). Client does not support sampling.',
                retryable: false,
            });
        }
        if (!input.range) {
            return this.error({
                code: 'INVALID_PARAMS',
                message: 'Range is required for chart suggestions',
                retryable: false,
            });
        }
        const server = this.context.server;
        const startTime = Date.now();
        try {
            // Convert range to A1 notation string
            const rangeStr = typeof input.range === 'string'
                ? input.range
                : 'a1' in input.range
                    ? input.range.a1
                    : 'Sheet1';
            // Fetch data from the specified range
            const response = await this.sheetsApi.spreadsheets.values.get({
                spreadsheetId: input.spreadsheetId,
                range: rangeStr,
                valueRenderOption: 'UNFORMATTED_VALUE',
            });
            const values = response.data.values || [];
            if (values.length === 0) {
                return this.error({
                    code: 'INVALID_PARAMS',
                    message: 'Range contains no data',
                    retryable: false,
                });
            }
            // Analyze data structure
            const hasHeaders = values.length > 1 && values[0]?.every((v) => typeof v === 'string');
            const dataRows = hasHeaders ? values.slice(1) : values;
            const headers = hasHeaders ? values[0] : undefined;
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
            const samplingRequest = {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: prompt,
                        },
                    },
                ],
                systemPrompt: `You are an expert data visualization consultant.
Analyze spreadsheet data and recommend the most effective chart types.
Consider data types, relationships, and visualization best practices.
Always return valid JSON in the exact format requested.`,
                modelPreferences: {
                    hints: [{ name: 'claude-3-5-sonnet-20241022' }],
                    intelligencePriority: 0.8,
                },
                maxTokens: 2048,
            };
            const samplingResult = await server.createMessage(samplingRequest);
            const duration = Date.now() - startTime;
            // Extract JSON from response
            const contentArray = Array.isArray(samplingResult.content)
                ? samplingResult.content
                : [samplingResult.content];
            const textContent = contentArray.find((c) => c.type === 'text');
            if (!textContent || textContent.type !== 'text') {
                return this.error({
                    code: 'INTERNAL_ERROR',
                    message: 'No text content in sampling response',
                    retryable: true,
                });
            }
            const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return this.error({
                    code: 'INTERNAL_ERROR',
                    message: 'Could not parse chart suggestions from AI response',
                    retryable: true,
                });
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return this.success('suggest_chart', {
                suggestions: parsed.suggestions || [],
                _meta: {
                    duration,
                    timestamp: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Chart suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    async handleChartUpdate(input) {
        const requests = [];
        const specUpdates = {};
        if (input.chartType) {
            specUpdates.basicChart = { chartType: input.chartType };
        }
        if (input.options?.title) {
            specUpdates.title = input.options.title;
        }
        if (Object.keys(specUpdates).length > 0) {
            requests.push({
                updateChartSpec: {
                    chartId: input.chartId,
                    spec: specUpdates,
                },
            });
        }
        if (input.position) {
            const position = await this.toOverlayPosition(input.spreadsheetId, input.position.anchorCell, input.position);
            requests.push({
                updateEmbeddedObjectPosition: {
                    objectId: input.chartId,
                    newPosition: position,
                    fields: 'overlayPosition',
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
    async handleChartDelete(input) {
        if (input.safety?.dryRun) {
            return this.success('chart_delete', {}, undefined, true);
        }
        // Request confirmation if elicitation available
        if (this.context.elicitationServer) {
            const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'chart_delete', `Delete chart (ID: ${input.chartId}) from spreadsheet ${input.spreadsheetId}. This action cannot be undone.`);
            if (!confirmation.confirmed) {
                return this.error({
                    code: 'PRECONDITION_FAILED',
                    message: confirmation.reason || 'User cancelled the operation',
                    retryable: false,
                });
            }
        }
        // Create snapshot if requested
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'chart_delete',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
        }, input.safety);
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
    async handleChartList(input) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            fields: 'sheets.charts,sheets.properties.sheetId',
        });
        const charts = [];
        for (const sheet of response.data.sheets ?? []) {
            const sheetId = sheet.properties?.sheetId ?? 0;
            if (input.sheetId !== undefined && sheetId !== input.sheetId)
                continue;
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
    async handleChartGet(input) {
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
    async handleChartMove(input) {
        const position = await this.toOverlayPosition(input.spreadsheetId, input.position.anchorCell, input.position);
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateEmbeddedObjectPosition: {
                            objectId: input.chartId,
                            newPosition: position,
                            fields: 'overlayPosition',
                        },
                    },
                ],
            },
        });
        return this.success('chart_move', {});
    }
    async handleChartResize(input) {
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
                            fields: 'overlayPosition',
                        },
                    },
                ],
            },
        });
        return this.success('chart_resize', {});
    }
    async handleChartUpdateDataRange(input) {
        const dataRange = await this.toGridRange(input.spreadsheetId, input.data.sourceRange);
        const spec = this.buildBasicChartSpec(dataRange, undefined, input.data, undefined);
        if (input.safety?.dryRun) {
            return this.success('chart_update_data_range', {}, undefined, true);
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        updateChartSpec: {
                            chartId: input.chartId,
                            spec,
                        },
                    },
                ],
            },
        });
        return this.success('chart_update_data_range', {});
    }
    // ============================================================
    // PIVOT ACTIONS (7)
    // ============================================================
    async handlePivotCreate(input) {
        const sourceRange = await this.toGridRange(input.spreadsheetId, input.sourceRange);
        const destination = await this.toDestination(input.spreadsheetId, input.destinationCell, input.destinationSheetId);
        const pivot = {
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
    async handleSuggestPivot(input) {
        // Check if server exists and client supports sampling
        const samplingSupport = this.context.server
            ? checkSamplingSupport(this.context.server.getClientCapabilities?.())
            : { supported: false };
        if (!this.context.server || !samplingSupport.supported) {
            return this.error({
                code: 'FEATURE_UNAVAILABLE',
                message: 'Pivot table suggestions require MCP Sampling capability (SEP-1577). Client does not support sampling.',
                retryable: false,
            });
        }
        if (!input.range) {
            return this.error({
                code: 'INVALID_PARAMS',
                message: 'Range is required for pivot table suggestions',
                retryable: false,
            });
        }
        const server = this.context.server;
        const startTime = Date.now();
        try {
            // Convert range to A1 notation string
            const rangeStr = typeof input.range === 'string'
                ? input.range
                : 'a1' in input.range
                    ? input.range.a1
                    : 'Sheet1';
            // Fetch data from the specified range
            const response = await this.sheetsApi.spreadsheets.values.get({
                spreadsheetId: input.spreadsheetId,
                range: rangeStr,
                valueRenderOption: 'UNFORMATTED_VALUE',
            });
            const values = response.data.values || [];
            if (values.length === 0) {
                return this.error({
                    code: 'INVALID_PARAMS',
                    message: 'Range contains no data',
                    retryable: false,
                });
            }
            // Analyze data structure
            const hasHeaders = values.length > 1 && values[0]?.every((v) => typeof v === 'string');
            const dataRows = hasHeaders ? values.slice(1) : values;
            const headers = hasHeaders ? values[0] : undefined;
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
            const samplingRequest = {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: prompt,
                        },
                    },
                ],
                systemPrompt: `You are an expert data analyst specializing in pivot table design.
Analyze spreadsheet data and recommend pivot table configurations that reveal meaningful insights.
Consider data types, cardinality, and business intelligence best practices.
Always return valid JSON in the exact format requested.`,
                modelPreferences: {
                    hints: [{ name: 'claude-3-5-sonnet-20241022' }],
                    intelligencePriority: 0.8,
                },
                maxTokens: 2048,
            };
            const samplingResult = await server.createMessage(samplingRequest);
            const duration = Date.now() - startTime;
            // Extract JSON from response
            const contentArray = Array.isArray(samplingResult.content)
                ? samplingResult.content
                : [samplingResult.content];
            const textContent = contentArray.find((c) => c.type === 'text');
            if (!textContent || textContent.type !== 'text') {
                return this.error({
                    code: 'INTERNAL_ERROR',
                    message: 'No text content in sampling response',
                    retryable: true,
                });
            }
            const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return this.error({
                    code: 'INTERNAL_ERROR',
                    message: 'Could not parse pivot table suggestions from AI response',
                    retryable: true,
                });
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return this.success('suggest_pivot', {
                suggestions: parsed.suggestions || [],
                _meta: {
                    duration,
                    timestamp: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            return this.error({
                code: 'INTERNAL_ERROR',
                message: `Pivot table suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
                retryable: true,
            });
        }
    }
    async handlePivotUpdate(input) {
        const sheetId = input.sheetId;
        const pivotRange = await this.findPivotRange(input.spreadsheetId, sheetId);
        if (!pivotRange) {
            return this.notFoundError('Pivot on sheet', sheetId);
        }
        const pivot = {
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
    async handlePivotDelete(input) {
        if (input.safety?.dryRun) {
            return this.success('pivot_delete', {}, undefined, true);
        }
        // Request confirmation if elicitation available (CRITICAL: deletes entire sheet)
        if (this.context.elicitationServer) {
            const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'pivot_delete', `Delete pivot table by removing entire sheet (ID: ${input.sheetId}) from spreadsheet ${input.spreadsheetId}. This will delete ALL data on the sheet. This action cannot be undone.`);
            if (!confirmation.confirmed) {
                return this.error({
                    code: 'PRECONDITION_FAILED',
                    message: confirmation.reason || 'User cancelled the operation',
                    retryable: false,
                });
            }
        }
        // Create snapshot if requested (CRITICAL operation)
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'pivot_delete',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
        }, input.safety);
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
    async handlePivotList(input) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            fields: 'sheets.properties,sheets.data.rowData.values.pivotTable',
        });
        const pivotTables = [];
        for (const sheet of response.data.sheets ?? []) {
            const hasPivot = sheet.data?.some((d) => d.rowData?.some((r) => r.values?.some((v) => v.pivotTable)));
            if (hasPivot) {
                pivotTables.push({
                    sheetId: sheet.properties?.sheetId ?? 0,
                    title: sheet.properties?.title ?? '',
                });
            }
        }
        return this.success('pivot_list', { pivotTables });
    }
    async handlePivotGet(input) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            ranges: [`'${input.sheetId}'!1:1`],
            includeGridData: true,
            fields: 'sheets.data.rowData.values.pivotTable,sheets.properties.sheetId,sheets.properties.title',
        });
        for (const sheet of response.data.sheets ?? []) {
            if (sheet.properties?.sheetId !== input.sheetId)
                continue;
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
    async handlePivotRefresh(input) {
        // Sheets API does not expose explicit pivot refresh; rewriting pivot triggers refresh.
        const getInput = {
            action: 'pivot_get',
            spreadsheetId: input.spreadsheetId,
            sheetId: input.sheetId,
        };
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
    buildBasicChartSpec(dataRange, chartType, data, options) {
        const domainColumn = data.categories ?? 0;
        const domainRange = {
            ...toGridRange(dataRange),
            startColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn,
            endColumnIndex: (dataRange.startColumnIndex ?? 0) + domainColumn + 1,
        };
        const seriesRanges = data.series && data.series.length > 0
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
                series: seriesRanges.map((range, idx) => ({
                    series: { sourceRange: { sources: [range] } },
                    targetAxis: 'LEFT_AXIS',
                    color: data.series?.[idx]?.color,
                })),
                legendPosition: options?.legendPosition,
                threeDimensional: options?.is3D,
                stackedType: options?.stacked ? 'STACKED' : 'NOT_STACKED',
            },
        };
    }
    /**
     * Route chart creation to appropriate spec builder based on chart type
     * PIE/DOUGHNUT/TREEMAP/HISTOGRAM/SCORECARD/WATERFALL/CANDLESTICK need specific specs
     * BAR/LINE/AREA/COLUMN/SCATTER/COMBO/STEPPED_AREA use BasicChartSpec
     */
    buildChartSpec(dataRange, chartType, data, options) {
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
                                        startColumnIndex: (dataRange.startColumnIndex ?? 0) + (data.series?.[0]?.column ?? 1),
                                        endColumnIndex: (dataRange.startColumnIndex ?? 0) + (data.series?.[0]?.column ?? 1) + 1,
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
                return this.buildBasicChartSpec(dataRange, chartType, data, options);
        }
    }
    async toOverlayPosition(spreadsheetId, anchorCell, position) {
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
    async fetchChartPosition(spreadsheetId, chartId) {
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
    formatAnchorCell(anchor) {
        const colLetter = this.columnToLetter(anchor.columnIndex ?? 0);
        const rowNumber = (anchor.rowIndex ?? 0) + 1;
        return `${colLetter}${rowNumber}`;
    }
    // ============================================================
    // PIVOT HELPER METHODS
    // ============================================================
    async toDestination(spreadsheetId, destinationCell, destinationSheetId) {
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
        const sheetId = newSheet.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
        return { sheetId, rowIndex: 0, columnIndex: 0 };
    }
    mapPivotGroup = (group) => ({
        sourceColumnOffset: group.sourceColumnOffset,
        showTotals: group.showTotals,
        sortOrder: group.sortOrder,
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
    mapPivotValue = (value) => ({
        sourceColumnOffset: value.sourceColumnOffset,
        summarizeFunction: value.summarizeFunction,
        name: value.name,
        calculatedDisplayType: value.calculatedDisplayType,
    });
    mapPivotFilter = (filter) => ({
        columnOffsetIndex: filter.sourceColumnOffset,
        filterCriteria: {
            visibleValues: filter.filterCriteria.visibleValues,
            condition: filter.filterCriteria.condition
                ? {
                    type: filter.filterCriteria.condition.type,
                    values: filter.filterCriteria.condition.values?.map((value) => ({
                        userEnteredValue: value,
                    })),
                }
                : undefined,
        },
    });
    normalizeGridRange(range, fallbackSheetId) {
        return {
            sheetId: range?.sheetId ?? fallbackSheetId,
            startRowIndex: range?.startRowIndex ?? undefined,
            endRowIndex: range?.endRowIndex ?? undefined,
            startColumnIndex: range?.startColumnIndex ?? undefined,
            endColumnIndex: range?.endColumnIndex ?? undefined,
        };
    }
    async findPivotRange(spreadsheetId, sheetId) {
        const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties,sheets.data.rowData.values.pivotTable',
        });
        for (const sheet of response.data.sheets ?? []) {
            if (sheet.properties?.sheetId !== sheetId)
                continue;
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
    async toGridRange(spreadsheetId, rangeInput) {
        const a1 = await this.resolveRange(spreadsheetId, rangeInput);
        const parsed = parseA1Notation(a1);
        const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
        return {
            sheetId,
            startRowIndex: parsed.startRow,
            endRowIndex: parsed.endRow,
            startColumnIndex: parsed.startCol,
            endColumnIndex: parsed.endCol,
        };
    }
}
function sheetIdFallback(sheets) {
    return sheets?.[0]?.properties?.sheetId ?? 0;
}
//# sourceMappingURL=visualize.js.map