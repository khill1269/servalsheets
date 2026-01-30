/**
 * Extraction Fields Configuration for Testing Framework
 *
 * Defines 6 extraction tiers optimized for the 43-category testing system.
 * Each tier maps to specific test categories and includes appropriate field masks,
 * TTLs, and caching strategies.
 *
 * @module extraction-fields
 */
import { FIELD_MASKS, combineFieldMasks } from './field-masks.js';
// ============================================================================
// TIER CONFIGURATIONS
// ============================================================================
/**
 * Tier 1: MINIMAL
 * Basic spreadsheet metadata - fastest retrieval
 */
export const TIER_MINIMAL = {
    tier: 'MINIMAL',
    description: 'Basic spreadsheet metadata (ID, title, URL, locale)',
    fieldMask: FIELD_MASKS.SPREADSHEET_BASIC,
    cacheTTL: 600_000, // 10 minutes - stable data
    expectedSize: { min: '1KB', max: '5KB' },
    categories: [],
    domains: [],
    priority: 1,
    requiresGridData: false,
};
/**
 * Tier 2: STRUCTURAL
 * Sheet properties and structural metadata
 */
export const TIER_STRUCTURAL = {
    tier: 'STRUCTURAL',
    description: 'Sheet properties, dimensions, merges, groups, filters',
    fieldMask: combineFieldMasks(FIELD_MASKS.SPREADSHEET_WITH_SHEETS, FIELD_MASKS.NAMED_RANGES, FIELD_MASKS.MERGES, FIELD_MASKS.FILTER_VIEWS, 'sheets(properties,merges,filterViews,basicFilter)', 'sheets(rowMetadata(hiddenByUser,pixelSize),columnMetadata(hiddenByUser,pixelSize))'),
    cacheTTL: 300_000, // 5 minutes
    expectedSize: { min: '10KB', max: '200KB' },
    categories: [
        'sheet_count',
        'sheet_names',
        'sheet_order',
        'hidden_sheets',
        'grid_dimensions',
        'frozen_rows',
        'frozen_columns',
        'merged_cells',
        'row_heights',
        'column_widths',
        'row_groups',
        'column_groups',
        'filter_views',
        'named_ranges',
    ],
    domains: ['structural'],
    priority: 2,
    requiresGridData: false,
};
/**
 * Tier 3: FORMATTING
 * Cell formatting and conditional formatting rules
 */
export const TIER_FORMATTING = {
    tier: 'FORMATTING',
    description: 'Cell formats, styles, conditional formatting, banding',
    fieldMask: combineFieldMasks(FIELD_MASKS.CELL_FORMAT, FIELD_MASKS.CONDITIONAL_FORMATS, 'sheets(bandedRanges)', 'sheets(data(rowData(values(userEnteredFormat,effectiveFormat,textFormatRuns))))'),
    cacheTTL: 180_000, // 3 minutes - formats change less frequently
    expectedSize: { min: '50KB', max: '2MB' },
    categories: [
        'font_styles',
        'cell_colors',
        'borders',
        'number_formats',
        'text_alignment',
        'text_wrapping',
        'conditional_formatting',
        'alternating_colors',
        'cell_padding',
        'text_rotation',
    ],
    domains: ['formatting'],
    priority: 3,
    requiresGridData: true,
};
/**
 * Tier 4: DATA_COMPLETE
 * All cell values, formulas, and data validation
 */
export const TIER_DATA_COMPLETE = {
    tier: 'DATA_COMPLETE',
    description: 'Cell values, formulas, validation, hyperlinks, notes',
    fieldMask: combineFieldMasks(FIELD_MASKS.DATA_VALIDATION, 'sheets(data(rowData(values(userEnteredValue,effectiveValue,formattedValue,hyperlink,note,dataValidation,pivotTable))))', 'sheets(charts)'),
    cacheTTL: 120_000, // 2 minutes - data changes frequently
    expectedSize: { min: '100KB', max: '10MB' },
    categories: [
        'cell_values',
        'cell_formulas',
        'formula_errors',
        'data_types',
        'empty_cells',
        'data_validation',
        'dropdown_lists',
        'hyperlinks',
        'notes',
        'checkboxes',
        'pivot_tables',
        'charts',
    ],
    domains: ['data'],
    priority: 4,
    requiresGridData: true,
};
/**
 * Tier 5: COLLABORATION
 * Sharing, permissions, protection, and history
 */
export const TIER_COLLABORATION = {
    tier: 'COLLABORATION',
    description: 'Protection, sharing permissions, comments, edit history',
    fieldMask: combineFieldMasks(FIELD_MASKS.PROTECTED_RANGES, 'sheets(protectedRanges)', 'sheets(properties(sheetId,title))'),
    cacheTTL: 60_000, // 1 minute - permissions can change
    expectedSize: { min: '5KB', max: '100KB' },
    categories: [
        'sheet_protection',
        'sharing_permissions',
        'edit_history',
        'comments',
        'suggested_edits',
        'protected_ranges',
        'owner_info',
    ],
    domains: ['collaboration'],
    priority: 5,
    requiresGridData: false,
    apiParams: {
        // Drive API needed for sharing/permissions
        requiresDriveApi: true,
    },
};
/**
 * Tier 6: COMPREHENSIVE
 * Everything - full spreadsheet extraction
 */
export const TIER_COMPREHENSIVE = {
    tier: 'COMPREHENSIVE',
    description: 'Complete spreadsheet data including all metadata and grid data',
    fieldMask: '*', // All fields
    cacheTTL: 60_000, // 1 minute - full data snapshot
    expectedSize: { min: '500KB', max: '50MB' },
    categories: [
        // All 43 categories
        'sheet_count',
        'sheet_names',
        'sheet_order',
        'hidden_sheets',
        'sheet_protection',
        'grid_dimensions',
        'frozen_rows',
        'frozen_columns',
        'merged_cells',
        'row_heights',
        'column_widths',
        'row_groups',
        'column_groups',
        'filter_views',
        'named_ranges',
        'cell_values',
        'cell_formulas',
        'formula_errors',
        'data_types',
        'empty_cells',
        'data_validation',
        'dropdown_lists',
        'hyperlinks',
        'notes',
        'checkboxes',
        'pivot_tables',
        'charts',
        'font_styles',
        'cell_colors',
        'borders',
        'number_formats',
        'text_alignment',
        'text_wrapping',
        'conditional_formatting',
        'alternating_colors',
        'cell_padding',
        'text_rotation',
        'sharing_permissions',
        'edit_history',
        'comments',
        'suggested_edits',
        'protected_ranges',
        'owner_info',
    ],
    domains: ['structural', 'data', 'formatting', 'collaboration'],
    priority: 6,
    requiresGridData: true,
    apiParams: {
        requiresDriveApi: true,
        includeGridData: true,
    },
};
// ============================================================================
// TIER REGISTRY AND UTILITIES
// ============================================================================
/**
 * All tier configurations indexed by tier name
 */
export const EXTRACTION_TIERS = {
    MINIMAL: TIER_MINIMAL,
    STRUCTURAL: TIER_STRUCTURAL,
    FORMATTING: TIER_FORMATTING,
    DATA_COMPLETE: TIER_DATA_COMPLETE,
    COLLABORATION: TIER_COLLABORATION,
    COMPREHENSIVE: TIER_COMPREHENSIVE,
};
/**
 * Category to tier mapping for optimal extraction
 */
export const CATEGORY_TO_TIER = {
    // Structural categories -> STRUCTURAL tier
    sheet_count: 'STRUCTURAL',
    sheet_names: 'STRUCTURAL',
    sheet_order: 'STRUCTURAL',
    hidden_sheets: 'STRUCTURAL',
    sheet_protection: 'COLLABORATION', // Needs protection data
    grid_dimensions: 'STRUCTURAL',
    frozen_rows: 'STRUCTURAL',
    frozen_columns: 'STRUCTURAL',
    merged_cells: 'STRUCTURAL',
    row_heights: 'STRUCTURAL',
    column_widths: 'STRUCTURAL',
    row_groups: 'STRUCTURAL',
    column_groups: 'STRUCTURAL',
    filter_views: 'STRUCTURAL',
    named_ranges: 'STRUCTURAL',
    // Data categories -> DATA_COMPLETE tier
    cell_values: 'DATA_COMPLETE',
    cell_formulas: 'DATA_COMPLETE',
    formula_errors: 'DATA_COMPLETE',
    data_types: 'DATA_COMPLETE',
    empty_cells: 'DATA_COMPLETE',
    data_validation: 'DATA_COMPLETE',
    dropdown_lists: 'DATA_COMPLETE',
    hyperlinks: 'DATA_COMPLETE',
    notes: 'DATA_COMPLETE',
    checkboxes: 'DATA_COMPLETE',
    pivot_tables: 'DATA_COMPLETE',
    charts: 'DATA_COMPLETE',
    // Formatting categories -> FORMATTING tier
    font_styles: 'FORMATTING',
    cell_colors: 'FORMATTING',
    borders: 'FORMATTING',
    number_formats: 'FORMATTING',
    text_alignment: 'FORMATTING',
    text_wrapping: 'FORMATTING',
    conditional_formatting: 'FORMATTING',
    alternating_colors: 'FORMATTING',
    cell_padding: 'FORMATTING',
    text_rotation: 'FORMATTING',
    // Collaboration categories -> COLLABORATION tier
    sharing_permissions: 'COLLABORATION',
    edit_history: 'COLLABORATION',
    comments: 'COLLABORATION',
    suggested_edits: 'COLLABORATION',
    protected_ranges: 'COLLABORATION',
    owner_info: 'COLLABORATION',
};
/**
 * Domain to categories mapping
 */
export const DOMAIN_CATEGORIES = {
    structural: [
        'sheet_count',
        'sheet_names',
        'sheet_order',
        'hidden_sheets',
        'sheet_protection',
        'grid_dimensions',
        'frozen_rows',
        'frozen_columns',
        'merged_cells',
        'row_heights',
        'column_widths',
        'row_groups',
        'column_groups',
        'filter_views',
        'named_ranges',
    ],
    data: [
        'cell_values',
        'cell_formulas',
        'formula_errors',
        'data_types',
        'empty_cells',
        'data_validation',
        'dropdown_lists',
        'hyperlinks',
        'notes',
        'checkboxes',
        'pivot_tables',
        'charts',
    ],
    formatting: [
        'font_styles',
        'cell_colors',
        'borders',
        'number_formats',
        'text_alignment',
        'text_wrapping',
        'conditional_formatting',
        'alternating_colors',
        'cell_padding',
        'text_rotation',
    ],
    collaboration: [
        'sharing_permissions',
        'edit_history',
        'comments',
        'suggested_edits',
        'protected_ranges',
        'owner_info',
    ],
};
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Get the optimal tiers needed for a set of test categories
 * Returns tiers in priority order (lowest priority first for efficient fetching)
 */
export function getTiersForCategories(categories) {
    const tiersNeeded = new Set();
    for (const category of categories) {
        tiersNeeded.add(CATEGORY_TO_TIER[category]);
    }
    // Sort by priority
    return Array.from(tiersNeeded).sort((a, b) => EXTRACTION_TIERS[a].priority - EXTRACTION_TIERS[b].priority);
}
/**
 * Get all categories for a domain
 */
export function getCategoriesForDomain(domain) {
    return DOMAIN_CATEGORIES[domain];
}
/**
 * Get all categories for multiple domains
 */
export function getCategoriesForDomains(domains) {
    const categories = [];
    for (const domain of domains) {
        categories.push(...DOMAIN_CATEGORIES[domain]);
    }
    return categories;
}
/**
 * Get tier configuration for a category
 */
export function getTierForCategory(category) {
    const tier = CATEGORY_TO_TIER[category];
    return EXTRACTION_TIERS[tier];
}
/**
 * Merge multiple tier field masks efficiently
 */
export function mergeFieldMasks(tiers) {
    if (tiers.includes('COMPREHENSIVE')) {
        return '*';
    }
    const masks = tiers.map((tier) => EXTRACTION_TIERS[tier].fieldMask);
    return combineFieldMasks(...masks);
}
/**
 * Get minimum TTL across tiers (most aggressive cache expiry)
 */
export function getMinTTL(tiers) {
    return Math.min(...tiers.map((tier) => EXTRACTION_TIERS[tier].cacheTTL));
}
/**
 * Check if any tier requires grid data
 */
export function requiresGridData(tiers) {
    return tiers.some((tier) => EXTRACTION_TIERS[tier].requiresGridData);
}
/**
 * Check if any tier requires Drive API
 */
export function requiresDriveApi(tiers) {
    return tiers.some((tier) => EXTRACTION_TIERS[tier].apiParams?.['requiresDriveApi'] === true);
}
/**
 * Get category count by domain
 */
export function getCategoryCounts() {
    return {
        structural: DOMAIN_CATEGORIES.structural.length,
        data: DOMAIN_CATEGORIES.data.length,
        formatting: DOMAIN_CATEGORIES.formatting.length,
        collaboration: DOMAIN_CATEGORIES.collaboration.length,
    };
}
/**
 * Validate that a category exists
 */
export function isValidCategory(category) {
    return category in CATEGORY_TO_TIER;
}
/**
 * Validate that a domain exists
 */
export function isValidDomain(domain) {
    return domain in DOMAIN_CATEGORIES;
}
/**
 * Get all test categories
 */
export function getAllCategories() {
    return Object.keys(CATEGORY_TO_TIER);
}
/**
 * Get all test domains
 */
export function getAllDomains() {
    return Object.keys(DOMAIN_CATEGORIES);
}
//# sourceMappingURL=extraction-fields.js.map