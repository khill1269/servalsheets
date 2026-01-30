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
import type { sheets_v4 } from 'googleapis';
import type { bigquery_v2 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsBigQueryInput, SheetsBigQueryOutput } from '../schemas/index.js';
export declare class SheetsBigQueryHandler extends BaseHandler<SheetsBigQueryInput, SheetsBigQueryOutput> {
    private sheetsApi;
    private bigqueryApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, bigqueryApi?: bigquery_v2.Bigquery);
    handle(input: SheetsBigQueryInput): Promise<SheetsBigQueryOutput>;
    protected createIntents(_input: SheetsBigQueryInput): Intent[];
    /**
     * Ensure BigQuery API is available
     */
    private requireBigQuery;
    /**
     * Connect: Create a BigQuery Connected Sheets data source
     */
    private handleConnect;
    /**
     * Disconnect: Remove a BigQuery data source connection
     */
    private handleDisconnect;
    /**
     * List connections: List all BigQuery connections in the spreadsheet
     */
    private handleListConnections;
    /**
     * Get connection: Get details of a specific BigQuery connection
     */
    private handleGetConnection;
    /**
     * Query: Execute a BigQuery SQL query via Connected Sheets
     */
    private handleQuery;
    /**
     * Preview: Preview query results without full execution
     */
    private handlePreview;
    /**
     * Refresh: Refresh a Connected Sheets data source
     */
    private handleRefresh;
    /**
     * List datasets: List BigQuery datasets in a project
     */
    private handleListDatasets;
    /**
     * List tables: List tables in a BigQuery dataset
     */
    private handleListTables;
    /**
     * Get table schema: Get schema of a BigQuery table
     */
    private handleGetTableSchema;
    /**
     * Export to BigQuery: Export sheet data to a BigQuery table
     */
    private handleExportToBigQuery;
    /**
     * Import from BigQuery: Import BigQuery query results to a sheet
     */
    private handleImportFromBigQuery;
}
//# sourceMappingURL=bigquery.d.ts.map