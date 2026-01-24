/**
 * ServalSheets - BigQuery Handler
 *
 * Handles sheets_bigquery tool (12 actions):
 * - connect: Create BigQuery Connected Sheets data source
 * - disconnect: Remove BigQuery connection
 * - list_connections: List all BigQuery connections
 * - get_connection: Get connection details
 * - query: Execute BigQuery SQL query
 * - preview: Preview query results
 * - refresh: Refresh data source
 * - list_datasets: List BigQuery datasets
 * - list_tables: List tables in dataset
 * - get_table_schema: Get table schema
 * - export_to_bigquery: Export sheet data to BigQuery
 * - import_from_bigquery: Import BigQuery results to sheet
 *
 * APIs Used:
 * - Google Sheets API (DataSource for Connected Sheets)
 * - Google BigQuery API (jobs.query, datasets, tables)
 *
 * MCP Protocol: 2025-11-25
 */
import { BaseHandler, unwrapRequest } from './base.js';
import { logger } from '../utils/logger.js';
export class SheetsBigQueryHandler extends BaseHandler {
    sheetsApi;
    bigqueryApi;
    constructor(context, sheetsApi, bigqueryApi) {
        super('sheets_bigquery', context);
        this.sheetsApi = sheetsApi;
        this.bigqueryApi = bigqueryApi ?? null;
    }
    async handle(input) {
        // 1. Unwrap request from wrapper
        const rawReq = unwrapRequest(input);
        // 2. Require auth
        this.requireAuth();
        // 3. Track spreadsheet ID if applicable
        const spreadsheetId = 'spreadsheetId' in rawReq ? rawReq.spreadsheetId : undefined;
        this.trackSpreadsheetId(spreadsheetId);
        try {
            // 4. Dispatch to action handler
            const req = rawReq;
            let response;
            switch (req.action) {
                case 'connect':
                    response = await this.handleConnect(req);
                    break;
                case 'disconnect':
                    response = await this.handleDisconnect(req);
                    break;
                case 'list_connections':
                    response = await this.handleListConnections(req);
                    break;
                case 'get_connection':
                    response = await this.handleGetConnection(req);
                    break;
                case 'query':
                    response = await this.handleQuery(req);
                    break;
                case 'preview':
                    response = await this.handlePreview(req);
                    break;
                case 'refresh':
                    response = await this.handleRefresh(req);
                    break;
                case 'list_datasets':
                    response = await this.handleListDatasets(req);
                    break;
                case 'list_tables':
                    response = await this.handleListTables(req);
                    break;
                case 'get_table_schema':
                    response = await this.handleGetTableSchema(req);
                    break;
                case 'export_to_bigquery':
                    response = await this.handleExportToBigQuery(req);
                    break;
                case 'import_from_bigquery':
                    response = await this.handleImportFromBigQuery(req);
                    break;
                default:
                    response = this.error({
                        code: 'INVALID_PARAMS',
                        message: `Unknown action: ${req.action}`,
                        retryable: false,
                    });
            }
            // 5. Track context after successful operation
            if (response.success && spreadsheetId) {
                this.trackContextFromRequest({ spreadsheetId });
            }
            // 6. Return wrapped response
            return { response };
        }
        catch (err) {
            return { response: this.mapError(err) };
        }
    }
    // Required by BaseHandler
    createIntents(_input) {
        return []; // BigQuery doesn't use batch compiler
    }
    /**
     * Ensure BigQuery API is available
     */
    requireBigQuery() {
        if (!this.bigqueryApi) {
            throw this.error({
                code: 'CONFIG_ERROR',
                message: 'BigQuery API is not configured. Enable BigQuery API in your GCP project and ensure proper OAuth scopes.',
                retryable: false,
            });
        }
        return this.bigqueryApi;
    }
    /**
     * Connect: Create a BigQuery Connected Sheets data source
     */
    async handleConnect(req) {
        try {
            // Build data source spec
            const dataSourceSpec = {
                bigQuery: {
                    projectId: req.spec.projectId,
                },
            };
            // Add table or query reference
            if (req.spec.tableId && req.spec.datasetId) {
                dataSourceSpec.bigQuery.tableSpec = {
                    tableProjectId: req.spec.projectId,
                    datasetId: req.spec.datasetId,
                    tableId: req.spec.tableId,
                };
            }
            else if (req.spec.query) {
                dataSourceSpec.bigQuery.querySpec = {
                    rawQuery: req.spec.query,
                };
            }
            // Create data source via batchUpdate
            const response = await this.sheetsApi.spreadsheets.batchUpdate({
                spreadsheetId: req.spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addDataSource: {
                                dataSource: {
                                    spec: dataSourceSpec,
                                },
                            },
                        },
                    ],
                },
            });
            const addedDataSource = response.data.replies?.[0]?.addDataSource?.dataSource;
            logger.info('Created BigQuery connection', {
                spreadsheetId: req.spreadsheetId,
                dataSourceId: addedDataSource?.dataSourceId,
            });
            return this.success('connect', {
                connection: {
                    dataSourceId: addedDataSource?.dataSourceId ?? '',
                    spec: {
                        projectId: req.spec.projectId,
                        datasetId: req.spec.datasetId,
                        tableId: req.spec.tableId,
                        query: req.spec.query,
                    },
                    sheetId: addedDataSource?.sheetId ?? undefined,
                },
            });
        }
        catch (err) {
            logger.error('Failed to create BigQuery connection', { err, req });
            throw err;
        }
    }
    /**
     * Disconnect: Remove a BigQuery data source connection
     */
    async handleDisconnect(req) {
        try {
            await this.sheetsApi.spreadsheets.batchUpdate({
                spreadsheetId: req.spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            deleteDataSource: {
                                dataSourceId: req.dataSourceId,
                            },
                        },
                    ],
                },
            });
            logger.info('Deleted BigQuery connection', {
                spreadsheetId: req.spreadsheetId,
                dataSourceId: req.dataSourceId,
            });
            return this.success('disconnect', {
                mutation: {
                    cellsAffected: 0,
                    sheetsModified: [req.dataSourceId],
                },
            });
        }
        catch (err) {
            logger.error('Failed to delete BigQuery connection', { err, req });
            throw err;
        }
    }
    /**
     * List connections: List all BigQuery connections in the spreadsheet
     */
    async handleListConnections(req) {
        try {
            const spreadsheet = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: req.spreadsheetId,
                includeGridData: false,
                fields: 'dataSources,dataSourceSchedules',
            });
            const dataSources = spreadsheet.data.dataSources ?? [];
            const connections = dataSources
                .filter((ds) => ds.spec?.bigQuery)
                .map((ds) => ({
                dataSourceId: ds.dataSourceId ?? '',
                spec: {
                    projectId: ds.spec?.bigQuery?.projectId ?? '',
                    datasetId: ds.spec?.bigQuery?.tableSpec?.datasetId ?? undefined,
                    tableId: ds.spec?.bigQuery?.tableSpec?.tableId ?? undefined,
                    query: ds.spec?.bigQuery?.querySpec?.rawQuery ?? undefined,
                },
                sheetId: ds.sheetId ?? undefined,
            }));
            return this.success('list_connections', {
                connections,
            });
        }
        catch (err) {
            logger.error('Failed to list BigQuery connections', { err, req });
            throw err;
        }
    }
    /**
     * Get connection: Get details of a specific BigQuery connection
     */
    async handleGetConnection(req) {
        try {
            const spreadsheet = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: req.spreadsheetId,
                includeGridData: false,
                fields: 'dataSources',
            });
            const dataSource = spreadsheet.data.dataSources?.find((ds) => ds.dataSourceId === req.dataSourceId);
            if (!dataSource) {
                return this.error({
                    code: 'NOT_FOUND',
                    message: `Data source not found: ${req.dataSourceId}`,
                    retryable: false,
                });
            }
            return this.success('get_connection', {
                connection: {
                    dataSourceId: dataSource.dataSourceId ?? '',
                    spec: {
                        projectId: dataSource.spec?.bigQuery?.projectId ?? '',
                        datasetId: dataSource.spec?.bigQuery?.tableSpec?.datasetId ?? undefined,
                        tableId: dataSource.spec?.bigQuery?.tableSpec?.tableId ?? undefined,
                        query: dataSource.spec?.bigQuery?.querySpec?.rawQuery ?? undefined,
                    },
                    sheetId: dataSource.sheetId ?? undefined,
                },
            });
        }
        catch (err) {
            logger.error('Failed to get BigQuery connection', { err, req });
            throw err;
        }
    }
    /**
     * Query: Execute a BigQuery SQL query via Connected Sheets
     */
    async handleQuery(req) {
        try {
            // If existing data source, update its query
            if (req.dataSourceId) {
                await this.sheetsApi.spreadsheets.batchUpdate({
                    spreadsheetId: req.spreadsheetId ?? '',
                    requestBody: {
                        requests: [
                            {
                                updateDataSource: {
                                    dataSource: {
                                        dataSourceId: req.dataSourceId,
                                        spec: {
                                            bigQuery: {
                                                projectId: req.projectId,
                                                querySpec: {
                                                    rawQuery: req.query,
                                                },
                                            },
                                        },
                                    },
                                    fields: 'spec.bigQuery.querySpec',
                                },
                            },
                        ],
                    },
                });
                return this.success('query', {
                    connection: {
                        dataSourceId: req.dataSourceId,
                        spec: {
                            projectId: req.projectId,
                            query: req.query,
                        },
                    },
                });
            }
            // Create new data source with query
            const response = await this.sheetsApi.spreadsheets.batchUpdate({
                spreadsheetId: req.spreadsheetId ?? '',
                requestBody: {
                    requests: [
                        {
                            addDataSource: {
                                dataSource: {
                                    spec: {
                                        bigQuery: {
                                            projectId: req.projectId,
                                            querySpec: {
                                                rawQuery: req.query,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    ],
                },
            });
            const addedDataSource = response.data.replies?.[0]?.addDataSource?.dataSource;
            return this.success('query', {
                connection: {
                    dataSourceId: addedDataSource?.dataSourceId ?? '',
                    spec: {
                        projectId: req.projectId,
                        query: req.query,
                    },
                    sheetId: addedDataSource?.sheetId ?? undefined,
                },
                sheetId: addedDataSource?.sheetId ?? undefined,
            });
        }
        catch (err) {
            logger.error('Failed to execute BigQuery query', { err, req });
            throw err;
        }
    }
    /**
     * Preview: Preview query results without full execution
     */
    async handlePreview(req) {
        const bigquery = this.requireBigQuery();
        try {
            // Use BigQuery jobs.query with dryRun for cost estimation, then actual query with maxResults
            const queryResponse = await bigquery.jobs.query({
                projectId: req.projectId,
                requestBody: {
                    query: req.query,
                    maxResults: req.maxRows ?? 10,
                    useLegacySql: false,
                },
            });
            const schema = queryResponse.data.schema?.fields ?? [];
            const columns = schema.map((f) => f.name ?? '');
            const rows = queryResponse.data.rows?.map((row) => row.f?.map((cell) => cell.v) ?? []) ?? [];
            return this.success('preview', {
                rowCount: rows.length,
                columns,
                rows,
                bytesProcessed: parseInt(queryResponse.data.totalBytesProcessed ?? '0', 10),
            });
        }
        catch (err) {
            logger.error('Failed to preview BigQuery query', { err, req });
            throw err;
        }
    }
    /**
     * Refresh: Refresh a Connected Sheets data source
     */
    async handleRefresh(req) {
        try {
            await this.sheetsApi.spreadsheets.batchUpdate({
                spreadsheetId: req.spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            refreshDataSource: {
                                dataSourceId: req.dataSourceId,
                                force: req.force ?? false,
                            },
                        },
                    ],
                },
            });
            logger.info('Refreshed BigQuery data source', {
                spreadsheetId: req.spreadsheetId,
                dataSourceId: req.dataSourceId,
            });
            return this.success('refresh', {
                connection: {
                    dataSourceId: req.dataSourceId,
                    spec: { projectId: '' }, // Minimal spec, details can be fetched via get_connection
                    lastRefreshed: new Date().toISOString(),
                },
            });
        }
        catch (err) {
            logger.error('Failed to refresh BigQuery data source', { err, req });
            throw err;
        }
    }
    /**
     * List datasets: List BigQuery datasets in a project
     */
    async handleListDatasets(req) {
        const bigquery = this.requireBigQuery();
        try {
            const response = await bigquery.datasets.list({
                projectId: req.projectId,
                maxResults: req.maxResults ?? 100,
            });
            const datasets = response.data.datasets?.map((ds) => ({
                datasetId: ds.datasetReference?.datasetId ?? '',
                location: ds.location ?? undefined,
                description: ds.friendlyName ?? undefined,
            })) ?? [];
            return this.success('list_datasets', {
                datasets,
            });
        }
        catch (err) {
            logger.error('Failed to list BigQuery datasets', { err, req });
            throw err;
        }
    }
    /**
     * List tables: List tables in a BigQuery dataset
     */
    async handleListTables(req) {
        const bigquery = this.requireBigQuery();
        try {
            const response = await bigquery.tables.list({
                projectId: req.projectId,
                datasetId: req.datasetId,
                maxResults: req.maxResults ?? 100,
            });
            const tables = response.data.tables?.map((t) => ({
                tableId: t.tableReference?.tableId ?? '',
                type: t.type ?? undefined,
                // Note: rowCount is not available in tables.list response, only in tables.get
                description: t.friendlyName ?? undefined,
            })) ?? [];
            return this.success('list_tables', {
                tables,
            });
        }
        catch (err) {
            logger.error('Failed to list BigQuery tables', { err, req });
            throw err;
        }
    }
    /**
     * Get table schema: Get schema of a BigQuery table
     */
    async handleGetTableSchema(req) {
        const bigquery = this.requireBigQuery();
        try {
            const response = await bigquery.tables.get({
                projectId: req.projectId,
                datasetId: req.datasetId,
                tableId: req.tableId,
            });
            const schema = response.data.schema?.fields?.map((f) => ({
                name: f.name ?? '',
                type: f.type ?? 'STRING',
                mode: f.mode ?? undefined,
                description: f.description ?? undefined,
            })) ?? [];
            return this.success('get_table_schema', {
                schema,
            });
        }
        catch (err) {
            logger.error('Failed to get BigQuery table schema', { err, req });
            throw err;
        }
    }
    /**
     * Export to BigQuery: Export sheet data to a BigQuery table
     */
    async handleExportToBigQuery(req) {
        const bigquery = this.requireBigQuery();
        try {
            // First, read the data from the sheet
            // Extract range string from various formats
            let range;
            if (typeof req.range === 'string') {
                range = req.range;
            }
            else if ('a1' in req.range) {
                range = req.range.a1;
            }
            else if ('namedRange' in req.range) {
                range = req.range.namedRange;
            }
            else {
                return this.error({
                    code: 'INVALID_PARAMS',
                    message: 'Range must be a string, A1 notation object, or named range',
                    retryable: false,
                });
            }
            const sheetData = await this.sheetsApi.spreadsheets.values.get({
                spreadsheetId: req.spreadsheetId,
                range,
            });
            const values = sheetData.data.values ?? [];
            if (values.length === 0) {
                return this.error({
                    code: 'INVALID_PARAMS',
                    message: 'No data found in the specified range',
                    retryable: false,
                });
            }
            // Skip header rows
            const headerRows = req.headerRows ?? 1;
            const headers = headerRows > 0 ? (values[0] ?? []) : [];
            const dataRows = values.slice(headerRows);
            // Convert to BigQuery format
            const rows = dataRows.map((row) => {
                const json = {};
                row.forEach((cell, idx) => {
                    const headerValue = headers[idx];
                    const columnName = typeof headerValue === 'string' ? headerValue : `column_${idx}`;
                    json[columnName] = cell;
                });
                return { json };
            });
            // Use streaming insert for data
            // Note: For full load job support with writeDisposition, use jobs.insert instead
            const insertResponse = await bigquery.tabledata.insertAll({
                projectId: req.destination.projectId,
                datasetId: req.destination.datasetId,
                tableId: req.destination.tableId,
                requestBody: {
                    rows,
                },
            });
            const insertErrors = insertResponse.data.insertErrors ?? [];
            if (insertErrors.length > 0) {
                logger.warn('Some rows failed to insert', { insertErrors });
            }
            return this.success('export_to_bigquery', {
                rowCount: rows.length - insertErrors.length,
                jobId: `streaming_${Date.now()}`,
                mutation: {
                    cellsAffected: rows.length,
                    sheetsModified: [],
                },
            });
        }
        catch (err) {
            logger.error('Failed to export to BigQuery', { err, req });
            throw err;
        }
    }
    /**
     * Import from BigQuery: Import BigQuery query results to a sheet
     */
    async handleImportFromBigQuery(req) {
        const bigquery = this.requireBigQuery();
        try {
            // Run the query
            const queryResponse = await bigquery.jobs.query({
                projectId: req.projectId,
                requestBody: {
                    query: req.query,
                    maxResults: req.maxResults ?? 10000,
                    useLegacySql: false,
                },
            });
            const schema = queryResponse.data.schema?.fields ?? [];
            const columns = schema.map((f) => f.name ?? '');
            const rows = queryResponse.data.rows?.map((row) => row.f?.map((cell) => cell.v) ?? []) ?? [];
            // Prepare values array for sheet
            const values = [];
            if (req.includeHeaders !== false) {
                values.push(columns);
            }
            values.push(...rows);
            // Determine target range
            const startCell = req.startCell ?? 'A1';
            let targetSheetId = req.sheetId;
            let targetSheetName = req.sheetName ?? 'BigQuery Results';
            // If no sheet specified, create a new one
            if (!targetSheetId && !req.sheetId) {
                const addSheetResponse = await this.sheetsApi.spreadsheets.batchUpdate({
                    spreadsheetId: req.spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: {
                                        title: targetSheetName,
                                    },
                                },
                            },
                        ],
                    },
                });
                targetSheetId =
                    addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
                targetSheetName =
                    addSheetResponse.data.replies?.[0]?.addSheet?.properties?.title ?? targetSheetName;
            }
            // Write data to sheet
            const range = `${targetSheetName}!${startCell}`;
            await this.sheetsApi.spreadsheets.values.update({
                spreadsheetId: req.spreadsheetId,
                range,
                valueInputOption: 'RAW',
                requestBody: {
                    values,
                },
            });
            logger.info('Imported BigQuery results to sheet', {
                spreadsheetId: req.spreadsheetId,
                sheetName: targetSheetName,
                rowCount: rows.length,
            });
            return this.success('import_from_bigquery', {
                rowCount: rows.length,
                columns,
                sheetId: targetSheetId ?? undefined,
                sheetName: targetSheetName,
                bytesProcessed: parseInt(queryResponse.data.totalBytesProcessed ?? '0', 10),
                mutation: {
                    cellsAffected: values.length * (columns.length || 1),
                    sheetsModified: [targetSheetName],
                },
            });
        }
        catch (err) {
            logger.error('Failed to import from BigQuery', { err, req });
            throw err;
        }
    }
}
//# sourceMappingURL=bigquery.js.map