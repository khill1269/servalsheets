/**
 * ServalSheets - Tiered Retrieval System
 *
 * 4-level progressive data fetching strategy to optimize API usage and latency:
 *
 * Level 1: Metadata    - Basic spreadsheet info (0.2-0.5s, ~2KB, TTL: 5min)
 * Level 2: Structure   - Sheet structure without data (0.5-1s, ~20KB, TTL: 3min)
 * Level 3: Sample      - Representative data sample (1-3s, ~100KB, TTL: 1min)
 * Level 4: Full        - Complete sheet data (3-30s, 1MB-50MB, TTL: 30sec)
 *
 * Benefits:
 * - 95%+ accuracy for most analyses using Level 3 (sample)
 * - Reduces API quota usage by fetching only necessary fields
 * - Progressive enhancement: fail fast with metadata, upgrade as needed
 * - Cache-friendly: different TTLs per tier
 */
import type { sheets_v4 } from 'googleapis';
import type { HotCache } from '../utils/hot-cache.js';
/**
 * Level 1: Metadata
 * Minimal spreadsheet information for routing decisions
 */
export interface SheetMetadata {
    spreadsheetId: string;
    title: string;
    sheets: Array<{
        sheetId: number;
        title: string;
        rowCount: number;
        columnCount: number;
        index: number;
    }>;
    retrievedAt: number;
    tier: 1;
}
/**
 * Level 2: Structure
 * Includes metadata + structural elements (no cell data)
 */
export interface SheetStructure extends Omit<SheetMetadata, 'tier'> {
    tier: 2;
    structure: {
        merges: number;
        conditionalFormats: number;
        protectedRanges: number;
        charts: number;
        pivots: number;
        filters: number;
        namedRanges: Array<{
            name: string;
            range: string;
        }>;
        frozenRows: number;
        frozenColumns: number;
    };
}
/**
 * Level 3: Sample
 * Includes structure + representative data sample
 */
export interface SheetSample extends Omit<SheetStructure, 'tier'> {
    tier: 3;
    sampleData: {
        headers: unknown[];
        rows: unknown[][];
        sampleSize: number;
        totalRows: number;
        samplingMethod: 'top' | 'random' | 'stratified';
    };
}
/**
 * Level 4: Full
 * Complete sheet data (use sparingly)
 */
export interface SheetFull extends Omit<SheetSample, 'tier'> {
    tier: 4;
    fullData: {
        values: unknown[][];
        rowCount: number;
        columnCount: number;
    };
}
/**
 * Union type for all tiers
 */
export type SheetData = SheetMetadata | SheetStructure | SheetSample | SheetFull;
/**
 * Tiered Retrieval Configuration
 */
export interface TieredRetrievalConfig {
    cache: HotCache;
    sheetsApi: sheets_v4.Sheets;
    defaultSampleSize?: number;
    maxSampleSize?: number;
}
/**
 * Tiered Retrieval System
 *
 * Provides progressive data fetching with caching and field optimization
 */
export declare class TieredRetrieval {
    private cache;
    private sheetsApi;
    private defaultSampleSize;
    private maxSampleSize;
    constructor(config: TieredRetrievalConfig);
    /**
     * Level 1: Get metadata only
     * Fast routing decision without fetching any actual data
     */
    getMetadata(spreadsheetId: string): Promise<SheetMetadata>;
    /**
     * Level 2: Get structure
     * Includes all structural elements without cell data
     */
    getStructure(spreadsheetId: string): Promise<SheetStructure>;
    /**
     * Level 3: Get sample
     * Representative data sample for 95%+ accurate analysis
     */
    getSample(spreadsheetId: string, sheetId?: number, sampleSize?: number): Promise<SheetSample>;
    /**
     * Level 4: Get full data
     * Complete sheet data (use sparingly due to size)
     */
    getFull(spreadsheetId: string, sheetId?: number): Promise<SheetFull>;
    /**
     * Convert column index to A1 notation letter (0 = A, 25 = Z, 26 = AA)
     */
    private columnIndexToLetter;
}
/**
 * Create tiered retrieval instance
 */
export declare function createTieredRetrieval(config: TieredRetrievalConfig): TieredRetrieval;
//# sourceMappingURL=tiered-retrieval.d.ts.map