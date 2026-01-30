/**
 * ServalSheets - Action Examples Library
 *
 * Provides concrete code examples for common ServalSheets patterns:
 * - Basic CRUD operations
 * - Batch operations
 * - Transaction patterns
 * - Composite workflows
 * - Error handling
 *
 * These examples help AI agents understand practical usage
 * patterns and best practices for ServalSheets actions.
 */
/**
 * Register examples library resources
 */
export function registerExamplesResources(server) {
    // Basic operations examples
    server.registerResource('Basic Operations Examples', 'servalsheets://examples/basic-operations', {
        description: 'Examples for basic CRUD operations: create spreadsheet, read/write data, format cells, manage sheets.',
        mimeType: 'application/json',
    }, async (uri) => readExamplesResource(typeof uri === 'string' ? uri : uri.toString()));
    // Batch operations examples
    server.registerResource('Batch Operations Examples', 'servalsheets://examples/batch-operations', {
        description: 'Examples for batch operations: batch_read, batch_write, bulk updates, and quota optimization patterns.',
        mimeType: 'application/json',
    }, async (uri) => readExamplesResource(typeof uri === 'string' ? uri : uri.toString()));
    // Transaction examples
    server.registerResource('Transaction Examples', 'servalsheets://examples/transactions', {
        description: 'Examples for using transactions: atomicity, rollback, quota optimization, and multi-step operations.',
        mimeType: 'application/json',
    }, async (uri) => readExamplesResource(typeof uri === 'string' ? uri : uri.toString()));
    // Composite workflow examples
    server.registerResource('Composite Workflow Examples', 'servalsheets://examples/composite-workflows', {
        description: 'Examples for composite operations: import_csv, smart_append, bulk_update, deduplicate, and optimized workflows.',
        mimeType: 'application/json',
    }, async (uri) => readExamplesResource(typeof uri === 'string' ? uri : uri.toString()));
    // Analysis and visualization examples
    server.registerResource('Analysis and Visualization Examples', 'servalsheets://examples/analysis-visualization', {
        description: 'Examples for data analysis and visualization: comprehensive analysis, chart creation, pivot tables, data quality checks.',
        mimeType: 'application/json',
    }, async (uri) => readExamplesResource(typeof uri === 'string' ? uri : uri.toString()));
}
/**
 * Read examples resource content
 */
export async function readExamplesResource(uri) {
    const resourceId = uri.replace('servalsheets://examples/', '');
    const examples = {
        'basic-operations': {
            title: 'Basic Operations Examples',
            description: 'Common patterns for everyday spreadsheet operations',
            examples: [
                {
                    name: 'Create a new spreadsheet',
                    tool: 'sheets_core',
                    action: 'create',
                    code: {
                        action: 'create',
                        title: 'Sales Data 2026',
                        sheets: [{ title: 'Q1 Sales' }, { title: 'Q2 Sales' }],
                    },
                    result: {
                        spreadsheetId: '1abc...',
                        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1abc...',
                        sheets: [
                            { sheetId: 0, title: 'Q1 Sales' },
                            { sheetId: 1, title: 'Q2 Sales' },
                        ],
                    },
                    notes: 'Creates a new spreadsheet with two sheets. Returns spreadsheet ID for subsequent operations.',
                },
                {
                    name: 'Read data from a range',
                    tool: 'sheets_data',
                    action: 'read',
                    code: {
                        action: 'read',
                        spreadsheetId: '1abc...',
                        range: 'Q1 Sales!A1:D10',
                    },
                    result: {
                        values: [
                            ['Date', 'Product', 'Quantity', 'Revenue'],
                            ['2026-01-01', 'Widget A', 10, 100],
                            ['2026-01-02', 'Widget B', 15, 225],
                        ],
                        range: 'Q1 Sales!A1:D10',
                    },
                    notes: 'Reads cell values from specified range. Returns 2D array of values.',
                },
                {
                    name: 'Write data to cells',
                    tool: 'sheets_data',
                    action: 'write',
                    code: {
                        action: 'write',
                        spreadsheetId: '1abc...',
                        range: 'Q1 Sales!A1:C2',
                        values: [
                            ['Name', 'Email', 'Status'],
                            ['John Doe', 'john@example.com', 'Active'],
                        ],
                    },
                    result: {
                        updatedRange: 'Q1 Sales!A1:C2',
                        updatedRows: 2,
                        updatedColumns: 3,
                        updatedCells: 6,
                    },
                    notes: 'Writes values to specified range. Overwrites existing data.',
                },
                {
                    name: 'Format cells with bold and color',
                    tool: 'sheets_format',
                    action: 'format_cells',
                    code: {
                        action: 'format_cells',
                        spreadsheetId: '1abc...',
                        range: 'Q1 Sales!A1:D1',
                        format: {
                            textFormat: { bold: true, fontSize: 12 },
                            backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
                        },
                    },
                    result: {
                        success: true,
                        updatedCells: 4,
                    },
                    notes: 'Applies formatting to header row. Use RGB values 0-1 (not 0-255).',
                },
                {
                    name: 'Add a new sheet',
                    tool: 'sheets_core',
                    action: 'add_sheet',
                    code: {
                        action: 'add_sheet',
                        spreadsheetId: '1abc...',
                        title: 'Q3 Sales',
                        index: 2,
                    },
                    result: {
                        sheetId: 123456,
                        title: 'Q3 Sales',
                        index: 2,
                    },
                    notes: 'Adds new sheet at specified index. Returns sheet ID for subsequent operations.',
                },
            ],
        },
        'batch-operations': {
            title: 'Batch Operations Examples',
            description: 'Quota-optimized patterns for multiple operations',
            examples: [
                {
                    name: 'Batch read from multiple ranges',
                    tool: 'sheets_data',
                    action: 'batch_read',
                    code: {
                        action: 'batch_read',
                        spreadsheetId: '1abc...',
                        ranges: ['Sheet1!A1:B10', 'Sheet2!C5:D15', 'Sheet3!E1:F100'],
                    },
                    result: {
                        valueRanges: [
                            {
                                range: 'Sheet1!A1:B10',
                                values: [
                                    [1, 2],
                                    [3, 4],
                                ],
                            },
                            {
                                range: 'Sheet2!C5:D15',
                                values: [
                                    [5, 6],
                                    [7, 8],
                                ],
                            },
                            { range: 'Sheet3!E1:F100', values: [[9, 10]] },
                        ],
                    },
                    quotaSavings: '3 API calls → 1 API call (66% reduction)',
                    notes: 'Reads multiple non-contiguous ranges in a single API call.',
                },
                {
                    name: 'Batch write to multiple ranges',
                    tool: 'sheets_data',
                    action: 'batch_write',
                    code: {
                        action: 'batch_write',
                        spreadsheetId: '1abc...',
                        data: [
                            { range: 'Sheet1!A1', values: [['Header 1']] },
                            { range: 'Sheet1!B1', values: [['Header 2']] },
                            { range: 'Sheet1!C1', values: [['Header 3']] },
                        ],
                    },
                    result: {
                        totalUpdatedCells: 3,
                        totalUpdatedRows: 1,
                        responses: [
                            { range: 'Sheet1!A1', updatedCells: 1 },
                            { range: 'Sheet1!B1', updatedCells: 1 },
                            { range: 'Sheet1!C1', updatedCells: 1 },
                        ],
                    },
                    quotaSavings: '3 write calls → 1 batch write (66% reduction)',
                    notes: 'Writes to multiple ranges in a single API call.',
                },
                {
                    name: 'Read and process with batch',
                    tool: 'sheets_data',
                    action: 'batch_read + local processing',
                    workflow: [
                        {
                            step: 1,
                            description: 'Batch read data from multiple sheets',
                            code: {
                                action: 'batch_read',
                                spreadsheetId: '1abc...',
                                ranges: ['Sales!A:A', 'Costs!A:A', 'Profit!A:A'],
                            },
                        },
                        {
                            step: 2,
                            description: 'Process data locally (0 API calls)',
                            pseudocode: 'const totals = ranges.map(r => sum(r.values))',
                        },
                        {
                            step: 3,
                            description: 'Write summary with single write',
                            code: {
                                action: 'write',
                                spreadsheetId: '1abc...',
                                range: 'Summary!A1:C1',
                                values: '[[salesTotal, costsTotal, profitTotal]]',
                            },
                        },
                    ],
                    totalAPICalls: 2,
                    naiveAPICalls: '300+ (read all rows individually)',
                    quotaSavings: '99% reduction',
                    notes: 'Process data locally between batch read and write for maximum efficiency.',
                },
            ],
        },
        transactions: {
            title: 'Transaction Examples',
            description: 'Atomic multi-operation patterns with automatic rollback',
            examples: [
                {
                    name: 'Simple transaction with rollback',
                    tool: 'sheets_transaction',
                    workflow: [
                        {
                            step: 1,
                            action: 'begin',
                            code: {
                                action: 'begin',
                                spreadsheetId: '1abc...',
                            },
                            result: { transactionId: 'txn_123', status: 'active' },
                        },
                        {
                            step: 2,
                            action: 'queue',
                            code: {
                                action: 'queue',
                                operation: {
                                    type: 'write',
                                    range: 'Sheet1!A1',
                                    values: [[100]],
                                },
                            },
                        },
                        {
                            step: 3,
                            action: 'queue',
                            code: {
                                action: 'queue',
                                operation: {
                                    type: 'write',
                                    range: 'Sheet1!B1',
                                    values: [[200]],
                                },
                            },
                        },
                        {
                            step: 4,
                            action: 'commit',
                            code: {
                                action: 'commit',
                            },
                            result: { success: true, operationsExecuted: 2 },
                        },
                    ],
                    quotaCost: '2 API calls (begin + commit)',
                    atomicity: 'If any operation fails, all are rolled back automatically',
                    notes: 'Use transactions for related operations that must succeed or fail together.',
                },
                {
                    name: 'Transaction with error and rollback',
                    tool: 'sheets_transaction',
                    workflow: [
                        {
                            step: 1,
                            description: 'Begin transaction',
                            code: { action: 'begin', spreadsheetId: '1abc...' },
                        },
                        {
                            step: 2,
                            description: 'Queue valid operation',
                            code: {
                                action: 'queue',
                                operation: { type: 'write', range: 'A1', values: [[1]] },
                            },
                        },
                        {
                            step: 3,
                            description: 'Queue invalid operation (triggers error)',
                            code: {
                                action: 'queue',
                                operation: { type: 'write', range: 'InvalidSheet!A1', values: [[2]] },
                            },
                        },
                        {
                            step: 4,
                            description: 'Commit fails, automatic rollback',
                            code: { action: 'commit' },
                            result: {
                                success: false,
                                error: 'Sheet "InvalidSheet" not found',
                                rollbackExecuted: true,
                            },
                        },
                    ],
                    outcome: 'No changes applied - transaction rolled back',
                    notes: 'Transactions automatically rollback on any error, maintaining data consistency.',
                },
                {
                    name: 'Multi-sheet update with transaction',
                    tool: 'sheets_transaction',
                    scenario: 'Update inventory, pricing, and totals atomically',
                    workflow: [
                        {
                            step: 1,
                            code: { action: 'begin', spreadsheetId: '1abc...' },
                        },
                        {
                            step: 2,
                            description: 'Update inventory',
                            code: {
                                action: 'queue',
                                operation: {
                                    type: 'write',
                                    range: 'Inventory!B2',
                                    values: [[50]],
                                },
                            },
                        },
                        {
                            step: 3,
                            description: 'Update pricing',
                            code: {
                                action: 'queue',
                                operation: {
                                    type: 'write',
                                    range: 'Pricing!C3',
                                    values: [[29.99]],
                                },
                            },
                        },
                        {
                            step: 4,
                            description: 'Update totals with formula',
                            code: {
                                action: 'queue',
                                operation: {
                                    type: 'write',
                                    range: 'Summary!D4',
                                    values: [['=Inventory!B2 * Pricing!C3']],
                                },
                            },
                        },
                        {
                            step: 5,
                            code: { action: 'commit' },
                            result: { success: true, operationsExecuted: 3 },
                        },
                    ],
                    benefits: [
                        'Atomicity: All updates succeed or none do',
                        'Quota optimization: 3 writes → 1 API call (66% savings)',
                        'Data consistency: Related values stay synchronized',
                    ],
                },
            ],
        },
        'composite-workflows': {
            title: 'Composite Workflow Examples',
            description: 'Pre-optimized patterns for common workflows',
            examples: [
                {
                    name: 'Import CSV file',
                    tool: 'sheets_composite',
                    action: 'import_csv',
                    code: {
                        action: 'import_csv',
                        spreadsheetId: '1abc...',
                        sheetName: 'Data',
                        csvData: 'Name,Email,Status\nJohn Doe,john@example.com,Active\nJane Smith,jane@example.com,Inactive',
                        mode: 'append',
                        hasHeaders: true,
                    },
                    result: {
                        success: true,
                        rowsImported: 2,
                        startRow: 5,
                        endRow: 6,
                    },
                    internalOptimizations: [
                        'Parses CSV locally (0 API calls)',
                        'Finds last row with cached metadata (0-1 API call)',
                        'Batch writes all rows (1 API call)',
                    ],
                    totalAPICalls: '1-2 API calls',
                    naiveAPICalls: '100+ API calls (row-by-row append)',
                    quotaSavings: '98% reduction',
                    notes: 'Automatically handles CSV parsing, header detection, and optimized insertion.',
                },
                {
                    name: 'Smart append with auto-detection',
                    tool: 'sheets_composite',
                    action: 'smart_append',
                    code: {
                        action: 'smart_append',
                        spreadsheetId: '1abc...',
                        sheetName: 'Logs',
                        values: [
                            ['2026-01-15T10:30:00Z', 'User login', 'john@example.com'],
                            ['2026-01-15T10:31:00Z', 'Page view', '/dashboard'],
                        ],
                    },
                    result: {
                        success: true,
                        appendedRange: 'Logs!A147:C148',
                        rowsAdded: 2,
                    },
                    internalOptimizations: [
                        'Finds last row (1 API call, cached for 60s)',
                        'Appends data (1 API call)',
                    ],
                    totalAPICalls: '1-2 API calls',
                    notes: 'Automatically finds last row and appends data. Cache reduces API calls on repeated appends.',
                },
                {
                    name: 'Bulk conditional update',
                    tool: 'sheets_composite',
                    action: 'bulk_update',
                    code: {
                        action: 'bulk_update',
                        spreadsheetId: '1abc...',
                        sheetName: 'Orders',
                        updates: [
                            { column: 'Status', oldValue: 'Pending', newValue: 'Processing' },
                            { column: 'Priority', oldValue: 'Low', newValue: 'Medium' },
                        ],
                    },
                    result: {
                        success: true,
                        matchesFound: 45,
                        cellsUpdated: 45,
                        affectedRows: [2, 5, 7, 10, 15],
                    },
                    internalOptimizations: [
                        'Reads data once (1 API call)',
                        'Finds matches locally (0 API calls)',
                        'Batch writes all updates (1 API call)',
                    ],
                    totalAPICalls: 2,
                    naiveAPICalls: '45+ API calls (individual updates)',
                    quotaSavings: '95% reduction',
                    notes: 'Efficiently finds and updates multiple cells matching conditions.',
                },
                {
                    name: 'Deduplicate data',
                    tool: 'sheets_composite',
                    action: 'deduplicate',
                    code: {
                        action: 'deduplicate',
                        spreadsheetId: '1abc...',
                        sheetName: 'Contacts',
                        keyColumns: ['Email'],
                        keepFirst: true,
                    },
                    result: {
                        success: true,
                        totalRows: 500,
                        duplicatesFound: 47,
                        duplicatesRemoved: 47,
                        uniqueRowsRemaining: 453,
                    },
                    internalOptimizations: [
                        'Reads all data (1 API call)',
                        'Identifies duplicates locally (0 API calls)',
                        'Deletes duplicate rows in batch (1 API call)',
                    ],
                    totalAPICalls: 2,
                    notes: 'Removes duplicate rows based on key columns. Preserves first or last occurrence.',
                },
            ],
        },
        'analysis-visualization': {
            title: 'Analysis and Visualization Examples',
            description: 'Data analysis and chart creation patterns',
            examples: [
                {
                    name: 'Comprehensive data analysis',
                    tool: 'sheets_analyze',
                    action: 'comprehensive',
                    code: {
                        action: 'comprehensive',
                        spreadsheetId: '1abc...',
                        sheetName: 'Sales Data',
                    },
                    result: {
                        schema: {
                            columns: [
                                { name: 'Date', type: 'date', nullCount: 0 },
                                { name: 'Revenue', type: 'number', nullCount: 2 },
                                { name: 'Product', type: 'string', nullCount: 0 },
                            ],
                        },
                        statistics: {
                            Revenue: { min: 10, max: 1000, mean: 450, median: 400 },
                        },
                        dataQuality: {
                            completeness: 0.98,
                            issues: [{ type: 'missing_values', column: 'Revenue', count: 2 }],
                        },
                        insights: ['Revenue shows strong upward trend', '2 missing values in Revenue column'],
                    },
                    notes: 'Provides comprehensive analysis including schema, statistics, quality checks, and insights.',
                },
                {
                    name: 'Create a chart',
                    tool: 'sheets_visualize',
                    action: 'chart_create',
                    code: {
                        action: 'chart_create',
                        spreadsheetId: '1abc...',
                        sheetId: 0,
                        chartType: 'LINE',
                        title: 'Revenue Trend',
                        sourceRanges: ['A1:B100'],
                        position: { row: 2, column: 5 },
                    },
                    result: {
                        chartId: 987654,
                        success: true,
                    },
                    notes: 'Creates a line chart at specified position. Supports multiple chart types (LINE, BAR, PIE, SCATTER, etc.).',
                },
                {
                    name: 'Create a pivot table',
                    tool: 'sheets_visualize',
                    action: 'pivot_create',
                    code: {
                        action: 'pivot_create',
                        spreadsheetId: '1abc...',
                        sourceSheetId: 0,
                        sourceRange: 'A1:D100',
                        rows: [{ sourceColumnIndex: 0, showTotals: true }],
                        values: [
                            {
                                sourceColumnIndex: 3,
                                summarizeFunction: 'SUM',
                                name: 'Total Revenue',
                            },
                        ],
                        targetSheetId: 1,
                    },
                    result: {
                        success: true,
                        pivotTableId: 456789,
                    },
                    notes: 'Creates pivot table with aggregations. Useful for summarizing large datasets.',
                },
                {
                    name: 'Detect data quality issues',
                    tool: 'sheets_quality',
                    action: 'detect_missing',
                    code: {
                        action: 'detect_missing',
                        spreadsheetId: '1abc...',
                        sheetName: 'Customer Data',
                    },
                    result: {
                        missingValues: {
                            Email: { count: 5, rows: [10, 25, 37, 42, 91] },
                            Phone: { count: 12, rows: [3, 7, 15] },
                        },
                        totalCells: 1000,
                        completeness: 0.983,
                    },
                    notes: 'Identifies missing values by column with row numbers for easy fixing.',
                },
            ],
        },
    };
    const exampleSet = examples[resourceId];
    if (!exampleSet) {
        throw new Error(`Unknown examples resource: ${resourceId}`);
    }
    return {
        contents: [
            {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(exampleSet, null, 2),
            },
        ],
    };
}
//# sourceMappingURL=examples.js.map