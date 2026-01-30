/**
 * Tool 18: sheets_bigquery
 * BigQuery integration via Connected Sheets
 *
 * 12 Actions:
 * Connection Management (4): connect, disconnect, list_connections, get_connection
 * Query Operations (3): query, preview, refresh
 * Schema Discovery (3): list_datasets, list_tables, get_table_schema
 * Data Transfer (2): export_to_bigquery, import_from_bigquery
 *
 * MCP Protocol: 2025-11-25
 *
 * Note: Uses Google Sheets API for Connected Sheets features (DataSource objects)
 * and BigQuery API for direct query/schema operations.
 */
import { z } from 'zod';
import { SpreadsheetIdSchema, SheetIdSchema, RangeInputSchema, ErrorDetailSchema, SafetyOptionsSchema, MutationSummarySchema, ResponseMetaSchema, } from './shared.js';
// ============================================================================
// Common Schemas
// ============================================================================
const CommonFieldsSchema = z.object({
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level: minimal (essential info only), standard (balanced), detailed (full metadata)'),
    safety: SafetyOptionsSchema.optional().describe('Safety options (dryRun, createSnapshot, etc.)'),
});
// BigQuery project/dataset/table reference
const BigQueryTableRefSchema = z.object({
    projectId: z.string().min(1).describe('GCP project ID'),
    datasetId: z.string().min(1).describe('BigQuery dataset ID'),
    tableId: z.string().min(1).describe('BigQuery table ID'),
});
// Data source specification for Connected Sheets
const DataSourceSpecSchema = z.object({
    projectId: z.string().min(1).describe('GCP project ID containing the BigQuery dataset'),
    datasetId: z.string().min(1).optional().describe('BigQuery dataset ID (for table connections)'),
    tableId: z.string().min(1).optional().describe('BigQuery table ID (for table connections)'),
    query: z.string().optional().describe('Custom SQL query (for query-based connections)'),
});
// BigQuery column schema
const BigQueryColumnSchema = z.object({
    name: z.string().describe('Column name'),
    type: z
        .string()
        .describe('BigQuery data type (STRING, INTEGER, FLOAT, BOOLEAN, TIMESTAMP, etc.)'),
    mode: z.enum(['NULLABLE', 'REQUIRED', 'REPEATED']).optional().describe('Column mode'),
    description: z.string().optional().describe('Column description'),
});
// Data source connection summary
const DataSourceConnectionSchema = z.object({
    dataSourceId: z.string().describe('Unique ID for this data source'),
    spec: DataSourceSpecSchema.describe('Data source specification'),
    sheetId: SheetIdSchema.optional().describe('Sheet ID if connected to a sheet'),
    createdAt: z.string().optional().describe('ISO timestamp when connection was created'),
    lastRefreshed: z.string().optional().describe('ISO timestamp of last refresh'),
});
// ============================================================================
// Connection Management Action Schemas (4 actions)
// ============================================================================
const ConnectActionSchema = CommonFieldsSchema.extend({
    action: z.literal('connect').describe('Create a BigQuery Connected Sheets data source'),
    spec: DataSourceSpecSchema.describe('Data source specification (table or query)'),
    sheetId: SheetIdSchema.optional().describe('Target sheet ID (creates new sheet if omitted)'),
    sheetName: z.string().optional().describe('Name for the new sheet (if creating)'),
});
const DisconnectActionSchema = CommonFieldsSchema.extend({
    action: z.literal('disconnect').describe('Remove a BigQuery data source connection'),
    dataSourceId: z.string().min(1).describe('Data source ID to disconnect'),
});
const ListConnectionsActionSchema = CommonFieldsSchema.extend({
    action: z
        .literal('list_connections')
        .describe('List all BigQuery connections in the spreadsheet'),
});
const GetConnectionActionSchema = CommonFieldsSchema.extend({
    action: z.literal('get_connection').describe('Get details of a specific BigQuery connection'),
    dataSourceId: z.string().min(1).describe('Data source ID'),
});
// ============================================================================
// Query Operations Action Schemas (3 actions)
// ============================================================================
const QueryActionSchema = CommonFieldsSchema.extend({
    action: z.literal('query').describe('Execute a BigQuery SQL query via Connected Sheets'),
    dataSourceId: z.string().optional().describe('Existing data source ID (if updating query)'),
    projectId: z.string().min(1).describe('GCP project ID for billing'),
    query: z.string().min(1).describe('SQL query to execute'),
    sheetId: SheetIdSchema.optional().describe('Target sheet for results (creates new if omitted)'),
    sheetName: z.string().optional().describe('Name for results sheet'),
    maxResults: z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .optional()
        .default(10000)
        .describe('Maximum rows to return'),
});
const PreviewActionSchema = z.object({
    action: z.literal('preview').describe('Preview BigQuery query results without full execution'),
    projectId: z.string().min(1).describe('GCP project ID for billing'),
    query: z.string().min(1).describe('SQL query to preview'),
    maxRows: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(10)
        .describe('Maximum preview rows'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
});
const RefreshActionSchema = CommonFieldsSchema.extend({
    action: z.literal('refresh').describe('Refresh a Connected Sheets data source'),
    dataSourceId: z.string().min(1).describe('Data source ID to refresh'),
    force: z.boolean().optional().default(false).describe('Force refresh even if recently refreshed'),
});
// ============================================================================
// Schema Discovery Action Schemas (3 actions)
// ============================================================================
const ListDatasetsActionSchema = z.object({
    action: z.literal('list_datasets').describe('List available BigQuery datasets in a project'),
    projectId: z.string().min(1).describe('GCP project ID'),
    maxResults: z.coerce
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .default(100)
        .describe('Maximum datasets to return'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
});
const ListTablesActionSchema = z.object({
    action: z.literal('list_tables').describe('List tables in a BigQuery dataset'),
    projectId: z.string().min(1).describe('GCP project ID'),
    datasetId: z.string().min(1).describe('Dataset ID'),
    maxResults: z.coerce
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .default(100)
        .describe('Maximum tables to return'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
});
const GetTableSchemaActionSchema = z.object({
    action: z.literal('get_table_schema').describe('Get schema of a BigQuery table'),
    projectId: z.string().min(1).describe('GCP project ID'),
    datasetId: z.string().min(1).describe('Dataset ID'),
    tableId: z.string().min(1).describe('Table ID'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
});
// ============================================================================
// Data Transfer Action Schemas (2 actions)
// ============================================================================
const ExportToBigQueryActionSchema = CommonFieldsSchema.extend({
    action: z.literal('export_to_bigquery').describe('Export sheet data to a BigQuery table'),
    range: RangeInputSchema.describe('Source range to export'),
    destination: BigQueryTableRefSchema.describe('Destination BigQuery table'),
    writeDisposition: z
        .enum(['WRITE_TRUNCATE', 'WRITE_APPEND', 'WRITE_EMPTY'])
        .optional()
        .default('WRITE_TRUNCATE')
        .describe('How to handle existing data: TRUNCATE (overwrite), APPEND (add rows), EMPTY (fail if exists)'),
    headerRows: z.coerce
        .number()
        .int()
        .min(0)
        .max(10)
        .optional()
        .default(1)
        .describe('Number of header rows to skip'),
    autoDetectSchema: z.boolean().optional().default(true).describe('Auto-detect schema from data'),
});
const ImportFromBigQueryActionSchema = CommonFieldsSchema.extend({
    action: z.literal('import_from_bigquery').describe('Import BigQuery query results to a sheet'),
    projectId: z.string().min(1).describe('GCP project ID for billing'),
    query: z.string().min(1).describe('SQL query to execute'),
    sheetId: SheetIdSchema.optional().describe('Target sheet (creates new if omitted)'),
    sheetName: z.string().optional().describe('Name for target sheet'),
    startCell: z.string().optional().default('A1').describe('Starting cell for data (e.g., "A1")'),
    includeHeaders: z.boolean().optional().default(true).describe('Include column headers'),
    maxResults: z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .optional()
        .default(10000)
        .describe('Maximum rows'),
});
// ============================================================================
// Input Schema (discriminated union wrapped in request)
// ============================================================================
const BigQueryRequestSchema = z.discriminatedUnion('action', [
    // Connection Management
    ConnectActionSchema,
    DisconnectActionSchema,
    ListConnectionsActionSchema,
    GetConnectionActionSchema,
    // Query Operations
    QueryActionSchema,
    PreviewActionSchema,
    RefreshActionSchema,
    // Schema Discovery
    ListDatasetsActionSchema,
    ListTablesActionSchema,
    GetTableSchemaActionSchema,
    // Data Transfer
    ExportToBigQueryActionSchema,
    ImportFromBigQueryActionSchema,
]);
export const SheetsBigQueryInputSchema = z.object({
    request: BigQueryRequestSchema,
});
// ============================================================================
// Output Schema (response union)
// ============================================================================
const BigQueryResponseSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        action: z.string().describe('Action that was performed'),
        // Connection results
        connection: DataSourceConnectionSchema.optional().describe('Connection details'),
        connections: z.array(DataSourceConnectionSchema).optional().describe('List of connections'),
        // Query results
        rowCount: z.coerce.number().int().optional().describe('Number of rows returned'),
        columns: z.array(z.string()).optional().describe('Column names'),
        rows: z.array(z.array(z.unknown())).optional().describe('Result rows (for preview)'),
        bytesProcessed: z.coerce.number().optional().describe('Bytes processed by query'),
        // Schema discovery results
        datasets: z
            .array(z.object({
            datasetId: z.string(),
            location: z.string().optional(),
            description: z.string().optional(),
        }))
            .optional()
            .describe('List of datasets'),
        tables: z
            .array(z.object({
            tableId: z.string(),
            type: z.string().optional(),
            rowCount: z.coerce.number().optional(),
            description: z.string().optional(),
        }))
            .optional()
            .describe('List of tables'),
        schema: z.array(BigQueryColumnSchema).optional().describe('Table schema'),
        // Export results
        jobId: z.string().optional().describe('BigQuery job ID'),
        // Common fields
        sheetId: SheetIdSchema.optional().describe('Sheet ID affected'),
        sheetName: z.string().optional().describe('Sheet name'),
        dryRun: z.boolean().optional().describe('Whether this was a dry run'),
        mutation: MutationSummarySchema.optional().describe('Mutation summary'),
        _meta: ResponseMetaSchema.optional().describe('Response metadata'),
    }),
    z.object({
        success: z.literal(false),
        error: ErrorDetailSchema,
    }),
]);
export const SheetsBigQueryOutputSchema = z.object({
    response: BigQueryResponseSchema,
});
// ============================================================================
// Annotations
// ============================================================================
export const SHEETS_BIGQUERY_ANNOTATIONS = {
    title: 'BigQuery Integration',
    readOnlyHint: false,
    destructiveHint: true, // Can delete connections, overwrite data
    idempotentHint: false, // Queries consume quota
    openWorldHint: true, // Calls BigQuery and Sheets APIs
};
//# sourceMappingURL=bigquery.js.map