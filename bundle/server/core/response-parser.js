/**
 * ServalSheets - Response Parser
 *
 * Phase 2.2: Parse Google Sheets API Response Metadata
 * Extracts structured metadata from Google API responses to eliminate
 * the compensatory diff pattern (before/after state captures).
 *
 * Key Benefit:
 * - OLD: 3 API calls per mutation (before capture, mutate, after capture)
 * - NEW: 1 API call per mutation (mutate with metadata extraction)
 *
 * Google Sheets API Response Structure:
 * {
 *   spreadsheetId: string;
 *   replies: [
 *     { addSheet: { properties: {...} } },
 *     { findReplace: { occurrencesChanged: 42 } },
 *     {} // Empty object for operations without specific response data
 *   ];
 *   updatedSpreadsheet: { ... } // Optional, controlled by fields mask
 * }
 *
 * IMPORTANT: Many batchUpdate operations don't return specific response data.
 * The googleapis Schema$Response interface only includes properties for operations
 * that return meaningful data. Operations without response properties return
 * empty objects in the replies array.
 */
import { logger } from '../utils/logger.js';
/**
 * Response Parser
 *
 * Parses Google Sheets API v4 batchUpdate responses to extract structured metadata.
 * This enables elimination of the compensatory diff pattern by providing enough
 * information about what changed without needing before/after state captures.
 *
 * Only parses operations that have specific response types in Schema$Response.
 * Operations without specific responses (e.g., updateSheetProperties, updateCells)
 * return generic success metadata.
 */
export class ResponseParser {
    /**
     * Parse a batchUpdate response and extract aggregated metadata
     */
    static parseBatchUpdateResponse(response) {
        const replies = response.replies ?? [];
        const parsedReplies = replies.map((reply, index) => this.parseReply(reply, index));
        const totalCellsAffected = parsedReplies.reduce((sum, r) => sum + (r.cellsAffected ?? 0), 0);
        const totalRowsAffected = parsedReplies.reduce((sum, r) => sum + (r.rowsAffected ?? 0), 0);
        const totalColumnsAffected = parsedReplies.reduce((sum, r) => sum + (r.columnsAffected ?? 0), 0);
        return {
            spreadsheetId: response.spreadsheetId ?? '',
            totalCellsAffected,
            totalRowsAffected,
            totalColumnsAffected,
            replies: parsedReplies,
            summary: this.generateSummary(parsedReplies),
        };
    }
    /**
     * Parse a single reply and extract metadata
     *
     * Only handles operations that have specific response properties in Schema$Response.
     * All other operations are treated as generic successful operations.
     */
    static parseReply(reply, index) {
        const requestType = this.getRequestType(reply);
        try {
            // Only handle operations with specific response types in Schema$Response
            if (reply.addSheet) {
                return this.parseAddSheetReply(reply.addSheet);
            }
            if (reply.duplicateSheet) {
                return this.parseDuplicateSheetReply(reply.duplicateSheet);
            }
            if (reply.findReplace) {
                return this.parseFindReplaceReply(reply.findReplace);
            }
            // Note: addConditionalFormatRule doesn't return a specific response in current API
            if (reply.updateConditionalFormatRule) {
                return this.parseUpdateConditionalFormatRuleReply(reply.updateConditionalFormatRule);
            }
            if (reply.deleteConditionalFormatRule) {
                return this.parseDeleteConditionalFormatRuleReply(reply.deleteConditionalFormatRule);
            }
            if (reply.addFilterView) {
                return this.parseAddFilterViewReply(reply.addFilterView);
            }
            if (reply.duplicateFilterView) {
                return this.parseDuplicateFilterViewReply(reply.duplicateFilterView);
            }
            if (reply.addChart) {
                return this.parseAddChartReply(reply.addChart);
            }
            if (reply.addSlicer) {
                return this.parseAddSlicerReply(reply.addSlicer);
            }
            if (reply.addNamedRange) {
                return this.parseAddNamedRangeReply(reply.addNamedRange);
            }
            if (reply.addProtectedRange) {
                return this.parseAddProtectedRangeReply(reply.addProtectedRange);
            }
            if (reply.createDeveloperMetadata) {
                return this.parseCreateDeveloperMetadataReply(reply.createDeveloperMetadata);
            }
            if (reply.updateDeveloperMetadata) {
                return this.parseUpdateDeveloperMetadataReply(reply.updateDeveloperMetadata);
            }
            if (reply.deleteDeveloperMetadata) {
                return this.parseDeleteDeveloperMetadataReply(reply.deleteDeveloperMetadata);
            }
            if (reply.addBanding) {
                return this.parseAddBandingReply(reply.addBanding);
            }
            if (reply.addDimensionGroup) {
                return this.parseAddDimensionGroupReply(reply.addDimensionGroup);
            }
            if (reply.deleteDimensionGroup) {
                return this.parseDeleteDimensionGroupReply(reply.deleteDimensionGroup);
            }
            if (reply.trimWhitespace) {
                return this.parseTrimWhitespaceReply(reply.trimWhitespace);
            }
            if (reply.deleteDuplicates) {
                return this.parseDeleteDuplicatesReply(reply.deleteDuplicates);
            }
            // Generic response for operations without specific response data
            // This includes: updateSheetProperties, updateCells, appendCells, insertDimension,
            // deleteDimension, updateDimensionProperties, autoResizeDimensions, mergeCells,
            // unmergeCells, copyPaste, cutPaste, setDataValidation, sortRange, setBasicFilter,
            // clearBasicFilter, deleteSheet, deleteFilterView, updateChartSpec, updateSlicerSpec,
            // updateNamedRange, deleteNamedRange, updateProtectedRange, deleteProtectedRange,
            // updateBanding, deleteBanding, updateDimensionGroup, and many others.
            return {
                requestType: requestType || `unknownRequest${index}`,
                success: true,
                summary: `Executed ${requestType || 'operation'} successfully`,
            };
        }
        catch (error) {
            logger.error('Error parsing reply', { requestType, error, reply });
            return {
                requestType: requestType || `failedRequest${index}`,
                success: false,
                summary: `Error parsing ${requestType || 'operation'} reply: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    /**
     * Determine request type from reply structure
     *
     * Note: Only properties with actual response data appear in Schema$Response.
     * Empty replies (for operations without response data) will return 'unknown'.
     */
    static getRequestType(reply) {
        const key = Object.keys(reply).find((key) => reply[key] != null);
        return key ?? 'unknown';
    }
    /**
     * Generate a human-readable summary of all changes
     */
    static generateSummary(replies) {
        if (replies.length === 0) {
            return 'No operations performed';
        }
        if (replies.length === 1) {
            return replies[0]?.summary ?? 'Operation completed successfully';
        }
        const successful = replies.filter((r) => r.success).length;
        const failed = replies.length - successful;
        const parts = [`${successful} operation(s) completed`];
        if (failed > 0) {
            parts.push(`${failed} failed`);
        }
        const totalCells = replies.reduce((sum, r) => sum + (r.cellsAffected ?? 0), 0);
        if (totalCells > 0) {
            parts.push(`${totalCells} cell(s) affected`);
        }
        return parts.join(', ');
    }
    // ============================================================================
    // Sheet Operations
    // ============================================================================
    static parseAddSheetReply(reply) {
        const sheetId = reply.properties?.sheetId ?? undefined;
        const title = reply.properties?.title ?? 'Untitled';
        const rowCount = reply.properties?.gridProperties?.rowCount ?? 0;
        const columnCount = reply.properties?.gridProperties?.columnCount ?? 0;
        const cellsAffected = rowCount * columnCount;
        return {
            requestType: 'addSheet',
            success: true,
            cellsAffected,
            rowsAffected: rowCount,
            columnsAffected: columnCount,
            objectIds: { sheetId },
            summary: `Created sheet "${title}" (${rowCount}x${columnCount} cells, ID: ${sheetId ?? 'unknown'})`,
        };
    }
    static parseDuplicateSheetReply(reply) {
        const sheetId = reply.properties?.sheetId ?? undefined;
        const title = reply.properties?.title ?? 'Untitled';
        const rowCount = reply.properties?.gridProperties?.rowCount ?? 0;
        const columnCount = reply.properties?.gridProperties?.columnCount ?? 0;
        const cellsAffected = rowCount * columnCount;
        return {
            requestType: 'duplicateSheet',
            success: true,
            cellsAffected,
            rowsAffected: rowCount,
            columnsAffected: columnCount,
            objectIds: { sheetId },
            summary: `Duplicated sheet as "${title}" (${rowCount}x${columnCount} cells, ID: ${sheetId ?? 'unknown'})`,
        };
    }
    // ============================================================================
    // Data Operations
    // ============================================================================
    static parseFindReplaceReply(reply) {
        const occurrencesChanged = reply.occurrencesChanged ?? 0;
        const rowsChanged = reply.rowsChanged ?? 0;
        const sheetsChanged = reply.sheetsChanged ?? 0;
        const valuesChanged = reply.valuesChanged ?? 0;
        const formulasChanged = reply.formulasChanged ?? 0;
        return {
            requestType: 'findReplace',
            success: true,
            cellsAffected: occurrencesChanged,
            rowsAffected: rowsChanged,
            summary: `Find/Replace: ${occurrencesChanged} occurrence(s) in ${rowsChanged} row(s) across ${sheetsChanged} sheet(s) (${valuesChanged} values, ${formulasChanged} formulas)`,
        };
    }
    static parseTrimWhitespaceReply(reply) {
        const cellsChanged = reply.cellsChangedCount ?? 0;
        return {
            requestType: 'trimWhitespace',
            success: true,
            cellsAffected: cellsChanged,
            summary: `Trimmed whitespace from ${cellsChanged} cell(s)`,
        };
    }
    static parseDeleteDuplicatesReply(reply) {
        const duplicatesRemoved = reply.duplicatesRemovedCount ?? 0;
        return {
            requestType: 'deleteDuplicates',
            success: true,
            rowsAffected: duplicatesRemoved,
            summary: `Removed ${duplicatesRemoved} duplicate row(s)`,
        };
    }
    // ============================================================================
    // Conditional Formatting
    // ============================================================================
    static parseUpdateConditionalFormatRuleReply(reply) {
        const newIndex = reply.newIndex ?? reply.oldIndex ?? 0;
        const newRule = reply.newRule;
        const oldRule = reply.oldRule;
        let summary;
        if (newRule && !oldRule) {
            summary = `Added conditional format rule at index ${newIndex}`;
        }
        else if (!newRule && oldRule) {
            summary = `Removed conditional format rule at index ${newIndex}`;
        }
        else {
            summary = `Updated conditional format rule at index ${newIndex}`;
        }
        return {
            requestType: 'updateConditionalFormatRule',
            success: true,
            summary,
        };
    }
    static parseDeleteConditionalFormatRuleReply(_reply) {
        return {
            requestType: 'deleteConditionalFormatRule',
            success: true,
            summary: 'Deleted conditional format rule',
        };
    }
    // Note: parseAddConditionalFormatRuleReply removed - API no longer returns specific response
    // ============================================================================
    // Filter Views
    // ============================================================================
    static parseAddFilterViewReply(reply) {
        const filterViewId = reply.filter?.filterViewId ?? undefined;
        const title = reply.filter?.title ?? 'Untitled';
        return {
            requestType: 'addFilterView',
            success: true,
            objectIds: { filterViewId },
            summary: `Created filter view "${title}" (ID: ${filterViewId ?? 'unknown'})`,
        };
    }
    static parseDuplicateFilterViewReply(reply) {
        const filterViewId = reply.filter?.filterViewId ?? undefined;
        const title = reply.filter?.title ?? 'Untitled';
        return {
            requestType: 'duplicateFilterView',
            success: true,
            objectIds: { filterViewId },
            summary: `Duplicated filter view as "${title}" (ID: ${filterViewId ?? 'unknown'})`,
        };
    }
    // ============================================================================
    // Charts
    // ============================================================================
    static parseAddChartReply(reply) {
        const chartId = reply.chart?.chartId ?? undefined;
        const chartType = reply.chart?.spec?.basicChart?.chartType ?? 'unknown';
        return {
            requestType: 'addChart',
            success: true,
            objectIds: { chartId },
            summary: `Created ${chartType} chart (ID: ${chartId ?? 'unknown'})`,
        };
    }
    // ============================================================================
    // Slicers
    // ============================================================================
    static parseAddSlicerReply(reply) {
        const slicerId = reply.slicer?.slicerId ?? undefined;
        return {
            requestType: 'addSlicer',
            success: true,
            objectIds: { slicerId },
            summary: `Created slicer (ID: ${slicerId ?? 'unknown'})`,
        };
    }
    // ============================================================================
    // Named Ranges
    // ============================================================================
    static parseAddNamedRangeReply(reply) {
        const namedRangeId = reply.namedRange?.namedRangeId ?? undefined;
        const name = reply.namedRange?.name ?? 'unnamed';
        return {
            requestType: 'addNamedRange',
            success: true,
            objectIds: { namedRangeId },
            summary: `Created named range "${name}" (ID: ${namedRangeId ?? 'unknown'})`,
        };
    }
    // ============================================================================
    // Protected Ranges
    // ============================================================================
    static parseAddProtectedRangeReply(reply) {
        const protectedRangeId = reply.protectedRange?.protectedRangeId ?? undefined;
        const description = reply.protectedRange?.description ?? 'No description';
        return {
            requestType: 'addProtectedRange',
            success: true,
            objectIds: { protectedRangeId },
            summary: `Created protected range: "${description}" (ID: ${protectedRangeId ?? 'unknown'})`,
        };
    }
    // ============================================================================
    // Developer Metadata
    // ============================================================================
    static parseCreateDeveloperMetadataReply(reply) {
        const metadataId = reply.developerMetadata?.metadataId ?? undefined;
        const key = reply.developerMetadata?.metadataKey ?? 'unknown';
        return {
            requestType: 'createDeveloperMetadata',
            success: true,
            summary: `Created developer metadata "${key}" (ID: ${metadataId ?? 'unknown'})`,
        };
    }
    static parseUpdateDeveloperMetadataReply(reply) {
        const fields = reply.developerMetadata?.map((m) => m.metadataKey ?? 'unknown').join(', ');
        return {
            requestType: 'updateDeveloperMetadata',
            success: true,
            summary: `Updated developer metadata: ${fields}`,
        };
    }
    static parseDeleteDeveloperMetadataReply(reply) {
        const deletedCount = reply.deletedDeveloperMetadata?.length ?? 0;
        return {
            requestType: 'deleteDeveloperMetadata',
            success: true,
            summary: `Deleted ${deletedCount} developer metadata entr${deletedCount === 1 ? 'y' : 'ies'}`,
        };
    }
    // ============================================================================
    // Banding
    // ============================================================================
    static parseAddBandingReply(reply) {
        const bandingId = reply.bandedRange?.bandedRangeId ?? undefined;
        return {
            requestType: 'addBanding',
            success: true,
            objectIds: { bandingId },
            summary: `Created banded range (ID: ${bandingId ?? 'unknown'})`,
        };
    }
    // ============================================================================
    // Dimension Groups
    // ============================================================================
    static parseAddDimensionGroupReply(reply) {
        const groups = reply.dimensionGroups ?? [];
        const depth = groups.length;
        return {
            requestType: 'addDimensionGroup',
            success: true,
            objectIds: { dimensionGroupDepth: depth },
            summary: `Created dimension group (depth: ${depth})`,
        };
    }
    static parseDeleteDimensionGroupReply(reply) {
        const groups = reply.dimensionGroups ?? [];
        const depth = groups.length;
        return {
            requestType: 'deleteDimensionGroup',
            success: true,
            objectIds: { dimensionGroupDepth: depth },
            summary: `Deleted dimension group (remaining depth: ${depth})`,
        };
    }
}
//# sourceMappingURL=response-parser.js.map