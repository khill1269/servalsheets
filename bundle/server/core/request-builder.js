/**
 * ServalSheets - Request Builder
 *
 * Phase 2.1: Direct Google API Request Builders
 * Replaces the Intent abstraction with direct, type-safe request construction
 *
 * Benefits:
 * - Direct 1:1 mapping to Google Sheets API documentation
 * - Type safety via googleapis TypeScript definitions
 * - No abstraction layer between ServalSheets and Google API
 * - Easier to adopt new Google API features
 *
 * Architecture:
 * OLD: Handler → Intent → BatchCompiler → intentToRequest() → Google API
 * NEW: Handler → RequestBuilder → BatchCompiler → Google API
 */
/**
 * Request builder for Google Sheets API v4
 *
 * Provides type-safe, validated request construction for all Google API request types.
 * Each method returns a WrappedRequest with metadata for safety rails and quota tracking.
 */
export class RequestBuilder {
    /**
     * Create an updateCells request (for setting cell values, formatting, etc.)
     */
    static updateCells(options) {
        const estimatedCells = (options.range
            ? ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
                ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0))
            : options.rows.reduce((sum, row) => sum + (row.values?.length ?? 0), 0)) ?? 0;
        return {
            request: {
                updateCells: {
                    rows: options.rows,
                    range: options.range,
                    fields: options.fields ?? '*',
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a repeatCell request (for formatting ranges efficiently)
     */
    static repeatCell(options) {
        const estimatedCells = ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
            ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0));
        return {
            request: {
                repeatCell: {
                    range: options.range,
                    cell: options.cell,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an addSheet request
     */
    static addSheet(options) {
        return {
            request: {
                addSheet: {
                    properties: options.properties,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create a deleteSheet request
     */
    static deleteSheet(options) {
        return {
            request: {
                deleteSheet: {
                    sheetId: options.sheetId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: true,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.sheetId,
            },
        };
    }
    /**
     * Create an updateSheetProperties request
     */
    static updateSheetProperties(options) {
        return {
            request: {
                updateSheetProperties: {
                    properties: options.properties,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.properties.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a duplicateSheet request
     */
    static duplicateSheet(options) {
        return {
            request: {
                duplicateSheet: {
                    sourceSheetId: options.sourceSheetId,
                    insertSheetIndex: options.insertSheetIndex,
                    newSheetId: options.newSheetId,
                    newSheetName: options.newSheetName,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.sourceSheetId,
            },
        };
    }
    /**
     * Create an insertDimension request
     */
    static insertDimension(options) {
        const estimatedCells = ((options.range.endIndex ?? 1) - (options.range.startIndex ?? 0)) * 1000; // Estimate 1000 cells per row/column
        return {
            request: {
                insertDimension: {
                    range: options.range,
                    inheritFromBefore: options.inheritFromBefore,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a deleteDimension request
     */
    static deleteDimension(options) {
        const estimatedCells = ((options.range.endIndex ?? 1) - (options.range.startIndex ?? 0)) * 1000; // Estimate 1000 cells per row/column
        return {
            request: {
                deleteDimension: {
                    range: options.range,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: true,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a moveDimension request
     */
    static moveDimension(options) {
        return {
            request: {
                moveDimension: {
                    source: options.source,
                    destinationIndex: options.destinationIndex,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.source.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateDimensionProperties request
     */
    static updateDimensionProperties(options) {
        return {
            request: {
                updateDimensionProperties: {
                    range: options.range,
                    properties: options.properties,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an appendDimension request
     */
    static appendDimension(options) {
        return {
            request: {
                appendDimension: {
                    sheetId: options.sheetId,
                    dimension: options.dimension,
                    length: options.length,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells: options.length * 1000, // Estimate 1000 cells per row/column
                spreadsheetId: options.spreadsheetId,
                sheetId: options.sheetId,
            },
        };
    }
    /**
     * Create an autoResizeDimensions request
     */
    static autoResizeDimensions(options) {
        return {
            request: {
                autoResizeDimensions: {
                    dimensions: options.dimensions,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.dimensions.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateBorders request
     */
    static updateBorders(options) {
        const estimatedCells = ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
            ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0));
        return {
            request: {
                updateBorders: {
                    range: options.range,
                    top: options.top,
                    bottom: options.bottom,
                    left: options.left,
                    right: options.right,
                    innerHorizontal: options.innerHorizontal,
                    innerVertical: options.innerVertical,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a mergeCells request
     */
    static mergeCells(options) {
        const estimatedCells = ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
            ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0));
        return {
            request: {
                mergeCells: {
                    range: options.range,
                    mergeType: options.mergeType,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an unmergeCells request
     */
    static unmergeCells(options) {
        const estimatedCells = ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
            ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0));
        return {
            request: {
                unmergeCells: {
                    range: options.range,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a copyPaste request
     */
    static copyPaste(options) {
        const estimatedCells = ((options.destination.endRowIndex ?? 1) - (options.destination.startRowIndex ?? 0)) *
            ((options.destination.endColumnIndex ?? 1) - (options.destination.startColumnIndex ?? 0));
        return {
            request: {
                copyPaste: {
                    source: options.source,
                    destination: options.destination,
                    pasteType: options.pasteType ?? 'PASTE_NORMAL',
                    pasteOrientation: options.pasteOrientation ?? 'NORMAL',
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.destination.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a cutPaste request
     */
    static cutPaste(options) {
        const estimatedCells = ((options.source.endRowIndex ?? 1) - (options.source.startRowIndex ?? 0)) *
            ((options.source.endColumnIndex ?? 1) - (options.source.startColumnIndex ?? 0));
        return {
            request: {
                cutPaste: {
                    source: options.source,
                    destination: options.destination,
                    pasteType: options.pasteType ?? 'PASTE_NORMAL',
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.source.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a findReplace request
     */
    static findReplace(options) {
        const estimatedCells = options.range
            ? ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
                ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0))
            : 10000; // Default estimate for allSheets
        return {
            request: {
                findReplace: {
                    find: options.find,
                    replacement: options.replacement,
                    range: options.range,
                    sheetId: options.sheetId,
                    allSheets: options.allSheets,
                    matchCase: options.matchCase,
                    matchEntireCell: options.matchEntireCell,
                    searchByRegex: options.searchByRegex,
                    includeFormulas: options.includeFormulas,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.sheetId ?? options.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a setDataValidation request
     */
    static setDataValidation(options) {
        const estimatedCells = ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
            ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0));
        return {
            request: {
                setDataValidation: {
                    range: options.range,
                    rule: options.rule,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: !options.rule, // No rule = clear validation
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an addConditionalFormatRule request
     */
    static addConditionalFormatRule(options) {
        const estimatedCells = options.rule.ranges
            ? options.rule.ranges.reduce((sum, range) => {
                return (sum +
                    ((range.endRowIndex ?? 1) - (range.startRowIndex ?? 0)) *
                        ((range.endColumnIndex ?? 1) - (range.startColumnIndex ?? 0)));
            }, 0)
            : 0;
        return {
            request: {
                addConditionalFormatRule: {
                    rule: options.rule,
                    index: options.index,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.rule.ranges?.[0]?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateConditionalFormatRule request
     */
    static updateConditionalFormatRule(options) {
        return {
            request: {
                updateConditionalFormatRule: {
                    index: options.index,
                    sheetId: options.sheetId,
                    rule: options.rule,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.sheetId,
            },
        };
    }
    /**
     * Create a deleteConditionalFormatRule request
     */
    static deleteConditionalFormatRule(options) {
        return {
            request: {
                deleteConditionalFormatRule: {
                    index: options.index,
                    sheetId: options.sheetId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.sheetId,
            },
        };
    }
    /**
     * Create a sortRange request
     */
    static sortRange(options) {
        const estimatedCells = ((options.range.endRowIndex ?? 1) - (options.range.startRowIndex ?? 0)) *
            ((options.range.endColumnIndex ?? 1) - (options.range.startColumnIndex ?? 0));
        return {
            request: {
                sortRange: {
                    range: options.range,
                    sortSpecs: options.sortSpecs,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a setBasicFilter request
     */
    static setBasicFilter(options) {
        return {
            request: {
                setBasicFilter: {
                    filter: options.filter,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.filter.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a clearBasicFilter request
     */
    static clearBasicFilter(options) {
        return {
            request: {
                clearBasicFilter: {
                    sheetId: options.sheetId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.sheetId,
            },
        };
    }
    /**
     * Create an addFilterView request
     */
    static addFilterView(options) {
        return {
            request: {
                addFilterView: {
                    filter: options.filter,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.filter.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateFilterView request
     */
    static updateFilterView(options) {
        return {
            request: {
                updateFilterView: {
                    filter: options.filter,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.filter.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a deleteFilterView request
     */
    static deleteFilterView(options) {
        return {
            request: {
                deleteFilterView: {
                    filterId: options.filterId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create an addChart request
     */
    static addChart(options) {
        return {
            request: {
                addChart: {
                    chart: options.chart,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.chart.position?.overlayPosition?.anchorCell?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateChartSpec request
     */
    static updateChartSpec(options) {
        return {
            request: {
                updateChartSpec: {
                    chartId: options.chartId,
                    spec: options.spec,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create a deleteEmbeddedObject request (for charts, slicers)
     */
    static deleteEmbeddedObject(options) {
        return {
            request: {
                deleteEmbeddedObject: {
                    objectId: options.objectId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create an addSlicer request
     */
    static addSlicer(options) {
        return {
            request: {
                addSlicer: {
                    slicer: options.slicer,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.slicer.position?.overlayPosition?.anchorCell?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateSlicerSpec request
     */
    static updateSlicerSpec(options) {
        return {
            request: {
                updateSlicerSpec: {
                    slicerId: options.slicerId,
                    spec: options.spec,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create an addNamedRange request
     */
    static addNamedRange(options) {
        return {
            request: {
                addNamedRange: {
                    namedRange: options.namedRange,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.namedRange.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateNamedRange request
     */
    static updateNamedRange(options) {
        return {
            request: {
                updateNamedRange: {
                    namedRange: options.namedRange,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.namedRange.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a deleteNamedRange request
     */
    static deleteNamedRange(options) {
        return {
            request: {
                deleteNamedRange: {
                    namedRangeId: options.namedRangeId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create an addProtectedRange request
     */
    static addProtectedRange(options) {
        return {
            request: {
                addProtectedRange: {
                    protectedRange: options.protectedRange,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.protectedRange.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateProtectedRange request
     */
    static updateProtectedRange(options) {
        return {
            request: {
                updateProtectedRange: {
                    protectedRange: options.protectedRange,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.protectedRange.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a deleteProtectedRange request
     */
    static deleteProtectedRange(options) {
        return {
            request: {
                deleteProtectedRange: {
                    protectedRangeId: options.protectedRangeId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create a createDeveloperMetadata request
     */
    static createDeveloperMetadata(options) {
        return {
            request: {
                createDeveloperMetadata: {
                    developerMetadata: options.developerMetadata,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create an updateDeveloperMetadata request
     */
    static updateDeveloperMetadata(options) {
        return {
            request: {
                updateDeveloperMetadata: {
                    dataFilters: options.dataFilters,
                    developerMetadata: options.developerMetadata,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create a deleteDeveloperMetadata request
     */
    static deleteDeveloperMetadata(options) {
        return {
            request: {
                deleteDeveloperMetadata: {
                    dataFilter: options.dataFilter,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create an addBanding request
     */
    static addBanding(options) {
        return {
            request: {
                addBanding: {
                    bandedRange: options.bandedRange,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.bandedRange.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateBanding request
     */
    static updateBanding(options) {
        return {
            request: {
                updateBanding: {
                    bandedRange: options.bandedRange,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.bandedRange.range?.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a deleteBanding request
     */
    static deleteBanding(options) {
        return {
            request: {
                deleteBanding: {
                    bandedRangeId: options.bandedRangeId,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
            },
        };
    }
    /**
     * Create an addDimensionGroup request
     */
    static addDimensionGroup(options) {
        return {
            request: {
                addDimensionGroup: {
                    range: options.range,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a deleteDimensionGroup request
     */
    static deleteDimensionGroup(options) {
        return {
            request: {
                deleteDimensionGroup: {
                    range: options.range,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an updateDimensionGroup request
     */
    static updateDimensionGroup(options) {
        return {
            request: {
                updateDimensionGroup: {
                    dimensionGroup: options.dimensionGroup,
                    fields: options.fields,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.dimensionGroup.range?.sheetId ?? undefined,
            },
        };
    }
    // ============================================================
    // Range Utility Operations (4 new - Google API coverage completion)
    // ============================================================
    /**
     * Create a trimWhitespace request
     */
    static trimWhitespace(options) {
        const estimatedCells = ((options.range.endRowIndex ?? 1000) - (options.range.startRowIndex ?? 0)) *
            ((options.range.endColumnIndex ?? 26) - (options.range.startColumnIndex ?? 0));
        return {
            request: {
                trimWhitespace: {
                    range: options.range,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false,
                highRisk: false,
                estimatedCells,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a randomizeRange request
     */
    static randomizeRange(options) {
        return {
            request: {
                randomizeRange: {
                    range: options.range,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: false, // Reorders but doesn't delete
                highRisk: true, // Can't easily undo
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create a textToColumns request
     */
    static textToColumns(options) {
        return {
            request: {
                textToColumns: {
                    source: options.source,
                    delimiterType: options.delimiterType ?? 'DETECT',
                    delimiter: options.delimiter,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true, // Modifies adjacent columns
                highRisk: true, // Can overwrite data in adjacent columns
                spreadsheetId: options.spreadsheetId,
                sheetId: options.source.sheetId ?? undefined,
            },
        };
    }
    /**
     * Create an autoFill request
     */
    static autoFill(options) {
        return {
            request: {
                autoFill: {
                    range: options.range,
                    sourceAndDestination: options.sourceAndDestination,
                    useAlternateSeries: options.useAlternateSeries,
                },
            },
            metadata: {
                sourceTool: options.sourceTool,
                sourceAction: options.sourceAction,
                transactionId: options.transactionId,
                priority: options.priority,
                destructive: true, // Overwrites cells
                highRisk: false,
                spreadsheetId: options.spreadsheetId,
                sheetId: options.range?.sheetId ?? options.sourceAndDestination?.source?.sheetId ?? undefined,
            },
        };
    }
}
//# sourceMappingURL=request-builder.js.map