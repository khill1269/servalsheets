/**
 * Formula Intelligence Helpers
 *
 * Provides advanced formula analysis capabilities:
 * - Volatile formula detection (NOW, TODAY, RAND)
 * - Full column reference detection (A:A)
 * - Formula complexity scoring
 * - Circular reference detection
 * - INDIRECT/OFFSET usage detection
 * - Array formula analysis
 * - Broken reference detection
 * - Formula optimization suggestions
 *
 * Part of Ultimate Analysis Tool - Formula Intelligence capability
 */
export interface VolatileFormula {
    cell: string;
    formula: string;
    volatileFunctions: string[];
    impact: 'low' | 'medium' | 'high';
    suggestion: string;
}
export interface FullColumnReference {
    cell: string;
    formula: string;
    references: string[];
    impact: 'low' | 'medium' | 'high';
    suggestion: string;
}
export interface FormulaComplexity {
    cell: string;
    formula: string;
    score: number;
    metrics: {
        functionCount: number;
        nestedLevels: number;
        referenceCount: number;
        operators: number;
        length: number;
    };
    category: 'simple' | 'moderate' | 'complex' | 'very_complex';
    suggestions: string[];
}
export interface CircularReference {
    cells: string[];
    chain: string;
    severity: 'warning' | 'error';
}
export interface IndirectUsage {
    cell: string;
    formula: string;
    function: 'INDIRECT' | 'OFFSET';
    impact: 'low' | 'medium' | 'high';
    reasoning: string;
    suggestion: string;
}
export interface ArrayFormula {
    range: string;
    formula: string;
    inputRows: number;
    inputCols: number;
    outputRows: number;
    outputCols: number;
    complexity: 'simple' | 'moderate' | 'complex';
}
export interface BrokenReference {
    cell: string;
    formula: string;
    brokenRefs: string[];
    errorType: '#REF!' | '#NAME?' | '#VALUE!' | 'MISSING_SHEET';
    suggestion: string;
}
export interface OptimizationSuggestion {
    type: 'VLOOKUP_TO_INDEX_MATCH' | 'SUMIF_TO_SUMIFS' | 'REMOVE_VOLATILE' | 'SIMPLIFY_NESTED' | 'USE_NAMED_RANGE' | 'ARRAY_FORMULA';
    priority: 'low' | 'medium' | 'high';
    affectedCells: string[];
    currentFormula: string;
    suggestedFormula: string;
    reasoning: string;
    estimatedSpeedup: string;
}
/**
 * Detect formulas using volatile functions
 *
 * Volatile functions recalculate on every change, even if their inputs haven't changed.
 * Common volatile functions: NOW, TODAY, RAND, RANDBETWEEN, INDIRECT, OFFSET
 */
export declare function findVolatileFormulas(formulas: Array<{
    cell: string;
    formula: string;
}>): VolatileFormula[];
/**
 * Detect formulas using full column references (A:A, B:B, etc.)
 *
 * Full column references can cause performance issues on large sheets.
 */
export declare function findFullColumnRefs(formulas: Array<{
    cell: string;
    formula: string;
}>): FullColumnReference[];
/**
 * Score formula complexity on a scale of 0-100
 *
 * Factors:
 * - Function count
 * - Nesting depth
 * - Number of cell references
 * - Number of operators
 * - Overall length
 */
export declare function scoreFormulaComplexity(formula: string): number;
/**
 * Analyze formula complexity with detailed metrics
 */
export declare function analyzeFormulaComplexity(cell: string, formula: string): FormulaComplexity;
/**
 * Detect circular references in formulas
 *
 * Note: This is a simplified version. Full detection requires dependency graph.
 */
export declare function detectCircularRefs(formulas: Array<{
    cell: string;
    formula: string;
}>): CircularReference[];
/**
 * Detect usage of INDIRECT and OFFSET functions
 */
export declare function findIndirectUsage(formulas: Array<{
    cell: string;
    formula: string;
}>): IndirectUsage[];
/**
 * Analyze array formulas
 */
export declare function findArrayFormulas(formulas: Array<{
    cell: string;
    formula: string;
    isArrayFormula?: boolean;
}>): ArrayFormula[];
/**
 * Detect broken references in formulas
 */
export declare function findOrphanedRefs(formulas: Array<{
    cell: string;
    formula: string;
}>, validSheets: string[]): BrokenReference[];
/**
 * Generate optimization suggestions for formulas
 */
export declare function generateOptimizations(formulas: Array<{
    cell: string;
    formula: string;
}>): OptimizationSuggestion[];
//# sourceMappingURL=formula-helpers.d.ts.map