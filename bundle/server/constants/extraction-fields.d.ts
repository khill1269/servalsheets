/**
 * Extraction Fields Configuration for Testing Framework
 *
 * Defines 6 extraction tiers optimized for the 43-category testing system.
 * Each tier maps to specific test categories and includes appropriate field masks,
 * TTLs, and caching strategies.
 *
 * @module extraction-fields
 */
/**
 * Extraction tier identifiers ordered by data volume
 */
export type ExtractionTier = 'MINIMAL' | 'STRUCTURAL' | 'FORMATTING' | 'DATA_COMPLETE' | 'COLLABORATION' | 'COMPREHENSIVE';
/**
 * Test category domain identifiers
 */
export type TestDomain = 'structural' | 'data' | 'formatting' | 'collaboration';
/**
 * Individual test category identifiers (43 total)
 */
export type TestCategory = 'sheet_count' | 'sheet_names' | 'sheet_order' | 'hidden_sheets' | 'sheet_protection' | 'grid_dimensions' | 'frozen_rows' | 'frozen_columns' | 'merged_cells' | 'row_heights' | 'column_widths' | 'row_groups' | 'column_groups' | 'filter_views' | 'named_ranges' | 'cell_values' | 'cell_formulas' | 'formula_errors' | 'data_types' | 'empty_cells' | 'data_validation' | 'dropdown_lists' | 'hyperlinks' | 'notes' | 'checkboxes' | 'pivot_tables' | 'charts' | 'font_styles' | 'cell_colors' | 'borders' | 'number_formats' | 'text_alignment' | 'text_wrapping' | 'conditional_formatting' | 'alternating_colors' | 'cell_padding' | 'text_rotation' | 'sharing_permissions' | 'edit_history' | 'comments' | 'suggested_edits' | 'protected_ranges' | 'owner_info';
/**
 * Configuration for a single extraction tier
 */
export interface TierConfig {
    /** Tier identifier */
    tier: ExtractionTier;
    /** Human-readable description */
    description: string;
    /** Google Sheets API field mask for this tier */
    fieldMask: string;
    /** Cache TTL in milliseconds */
    cacheTTL: number;
    /** Expected response size range */
    expectedSize: {
        min: string;
        max: string;
    };
    /** Test categories this tier supports */
    categories: TestCategory[];
    /** Test domains this tier covers */
    domains: TestDomain[];
    /** Priority for extraction (lower = higher priority) */
    priority: number;
    /** Whether this tier requires includeGridData */
    requiresGridData: boolean;
    /** Additional API parameters */
    apiParams?: Record<string, unknown>;
}
/**
 * Tier 1: MINIMAL
 * Basic spreadsheet metadata - fastest retrieval
 */
export declare const TIER_MINIMAL: TierConfig;
/**
 * Tier 2: STRUCTURAL
 * Sheet properties and structural metadata
 */
export declare const TIER_STRUCTURAL: TierConfig;
/**
 * Tier 3: FORMATTING
 * Cell formatting and conditional formatting rules
 */
export declare const TIER_FORMATTING: TierConfig;
/**
 * Tier 4: DATA_COMPLETE
 * All cell values, formulas, and data validation
 */
export declare const TIER_DATA_COMPLETE: TierConfig;
/**
 * Tier 5: COLLABORATION
 * Sharing, permissions, protection, and history
 */
export declare const TIER_COLLABORATION: TierConfig;
/**
 * Tier 6: COMPREHENSIVE
 * Everything - full spreadsheet extraction
 */
export declare const TIER_COMPREHENSIVE: TierConfig;
/**
 * All tier configurations indexed by tier name
 */
export declare const EXTRACTION_TIERS: Record<ExtractionTier, TierConfig>;
/**
 * Category to tier mapping for optimal extraction
 */
export declare const CATEGORY_TO_TIER: Record<TestCategory, ExtractionTier>;
/**
 * Domain to categories mapping
 */
export declare const DOMAIN_CATEGORIES: Record<TestDomain, TestCategory[]>;
/**
 * Get the optimal tiers needed for a set of test categories
 * Returns tiers in priority order (lowest priority first for efficient fetching)
 */
export declare function getTiersForCategories(categories: TestCategory[]): ExtractionTier[];
/**
 * Get all categories for a domain
 */
export declare function getCategoriesForDomain(domain: TestDomain): TestCategory[];
/**
 * Get all categories for multiple domains
 */
export declare function getCategoriesForDomains(domains: TestDomain[]): TestCategory[];
/**
 * Get tier configuration for a category
 */
export declare function getTierForCategory(category: TestCategory): TierConfig;
/**
 * Merge multiple tier field masks efficiently
 */
export declare function mergeFieldMasks(tiers: ExtractionTier[]): string;
/**
 * Get minimum TTL across tiers (most aggressive cache expiry)
 */
export declare function getMinTTL(tiers: ExtractionTier[]): number;
/**
 * Check if any tier requires grid data
 */
export declare function requiresGridData(tiers: ExtractionTier[]): boolean;
/**
 * Check if any tier requires Drive API
 */
export declare function requiresDriveApi(tiers: ExtractionTier[]): boolean;
/**
 * Get category count by domain
 */
export declare function getCategoryCounts(): Record<TestDomain, number>;
/**
 * Validate that a category exists
 */
export declare function isValidCategory(category: string): category is TestCategory;
/**
 * Validate that a domain exists
 */
export declare function isValidDomain(domain: string): domain is TestDomain;
/**
 * Get all test categories
 */
export declare function getAllCategories(): TestCategory[];
/**
 * Get all test domains
 */
export declare function getAllDomains(): TestDomain[];
//# sourceMappingURL=extraction-fields.d.ts.map