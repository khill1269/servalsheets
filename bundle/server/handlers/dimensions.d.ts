/**
 * ServalSheets - Dimensions Handler
 *
 * Handles sheets_dimensions tool (row/column operations, filtering, and sorting)
 * MCP Protocol: 2025-11-25
 *
 * 35 Actions:
 * - insert_rows, insert_columns
 * - delete_rows, delete_columns
 * - move_rows, move_columns
 * - resize_rows, resize_columns, auto_resize
 * - hide_rows, hide_columns, show_rows, show_columns
 * - freeze_rows, freeze_columns
 * - group_rows, group_columns, ungroup_rows, ungroup_columns
 * - append_rows, append_columns
 * - filter_set_basic_filter, filter_clear_basic_filter, filter_get_basic_filter, filter_update_filter_criteria
 * - filter_sort_range
 * - filter_create_filter_view, filter_update_filter_view, filter_delete_filter_view, filter_list_filter_views, filter_get_filter_view
 * - filter_create_slicer, filter_update_slicer, filter_delete_slicer, filter_list_slicers
 */
import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsDimensionsInput, SheetsDimensionsOutput } from '../schemas/index.js';
export declare class DimensionsHandler extends BaseHandler<SheetsDimensionsInput, SheetsDimensionsOutput> {
    private sheetsApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    handle(input: SheetsDimensionsInput): Promise<SheetsDimensionsOutput>;
    protected createIntents(input: SheetsDimensionsInput): Intent[];
    private handleInsertRows;
    private handleInsertColumns;
    private handleDeleteRows;
    private handleDeleteColumns;
    private handleMoveRows;
    private handleMoveColumns;
    private handleResizeRows;
    private handleResizeColumns;
    private handleAutoResize;
    private handleHideRows;
    private handleHideColumns;
    private handleShowRows;
    private handleShowColumns;
    private handleFreezeRows;
    private handleFreezeColumns;
    private handleGroupRows;
    private handleGroupColumns;
    private handleUngroupRows;
    private handleUngroupColumns;
    private handleAppendRows;
    private handleAppendColumns;
    private handleSetBasicFilter;
    private handleClearBasicFilter;
    private handleGetBasicFilter;
    private handleFilterUpdateFilterCriteria;
    private handleSortRange;
    private handleTrimWhitespace;
    private handleRandomizeRange;
    private handleTextToColumns;
    private handleAutoFill;
    private handleCreateFilterView;
    private handleUpdateFilterView;
    private handleDeleteFilterView;
    private handleListFilterViews;
    private handleGetFilterView;
    private handleCreateSlicer;
    private handleUpdateSlicer;
    private handleDeleteSlicer;
    private handleListSlicers;
    /**
     * Convert Google API GridRange to application format
     */
    private toGridRangeOutput;
    private toGridRange;
    private mapCriteria;
    private mapSingleCriteria;
}
//# sourceMappingURL=dimensions.d.ts.map