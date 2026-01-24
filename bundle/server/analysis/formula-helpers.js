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
// ============================================================================
// Volatile Formula Detection
// ============================================================================
/**
 * Detect formulas using volatile functions
 *
 * Volatile functions recalculate on every change, even if their inputs haven't changed.
 * Common volatile functions: NOW, TODAY, RAND, RANDBETWEEN, INDIRECT, OFFSET
 */
export function findVolatileFormulas(formulas) {
    const volatileFunctions = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'INDIRECT', 'OFFSET', 'INFO'];
    const volatileFormulas = [];
    for (const { cell, formula } of formulas) {
        const upperFormula = formula.toUpperCase();
        const foundVolatile = volatileFunctions.filter((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(upperFormula));
        if (foundVolatile.length > 0) {
            // Determine impact based on how many volatile functions
            let impact = 'low';
            if (foundVolatile.length >= 3)
                impact = 'high';
            else if (foundVolatile.length === 2)
                impact = 'medium';
            // Generate suggestion
            let suggestion = '';
            if (foundVolatile.includes('NOW') || foundVolatile.includes('TODAY')) {
                suggestion =
                    'Consider calculating these once in a helper cell and referencing that cell instead.';
            }
            else if (foundVolatile.includes('RAND') || foundVolatile.includes('RANDBETWEEN')) {
                suggestion =
                    'Random functions are inherently volatile. Use sparingly or calculate once and copy values.';
            }
            else if (foundVolatile.includes('INDIRECT') || foundVolatile.includes('OFFSET')) {
                suggestion =
                    'INDIRECT and OFFSET are volatile. Consider using INDEX/MATCH or direct references when possible.';
            }
            volatileFormulas.push({
                cell,
                formula,
                volatileFunctions: foundVolatile,
                impact,
                suggestion,
            });
        }
    }
    return volatileFormulas;
}
// ============================================================================
// Full Column Reference Detection
// ============================================================================
/**
 * Detect formulas using full column references (A:A, B:B, etc.)
 *
 * Full column references can cause performance issues on large sheets.
 */
export function findFullColumnRefs(formulas) {
    const fullColumnRefs = [];
    const columnRefPattern = /\b([A-Z]{1,3}):([A-Z]{1,3})\b/g;
    for (const { cell, formula } of formulas) {
        const matches = Array.from(formula.matchAll(columnRefPattern));
        const references = matches
            .filter((m) => m[1] === m[2]) // Same column (A:A, not A:B)
            .map((m) => m[0]);
        if (references.length > 0) {
            // Determine impact
            let impact = 'low';
            if (references.length >= 3)
                impact = 'high';
            else if (references.length === 2)
                impact = 'medium';
            fullColumnRefs.push({
                cell,
                formula,
                references,
                impact,
                suggestion: 'Replace full column references with specific ranges (e.g., A1:A1000) to improve performance.',
            });
        }
    }
    return fullColumnRefs;
}
// ============================================================================
// Formula Complexity Scoring
// ============================================================================
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
export function scoreFormulaComplexity(formula) {
    let score = 0;
    // Count functions
    const functionPattern = /\b[A-Z_]+\s*\(/g;
    const functions = formula.match(functionPattern) || [];
    score += Math.min(functions.length * 5, 30);
    // Count nesting depth
    let maxDepth = 0;
    let currentDepth = 0;
    for (const char of formula) {
        if (char === '(')
            currentDepth++;
        if (char === ')')
            currentDepth--;
        maxDepth = Math.max(maxDepth, currentDepth);
    }
    score += Math.min(maxDepth * 10, 30);
    // Count cell references
    const cellRefPattern = /\b[A-Z]{1,3}[0-9]{1,7}\b/g;
    const cellRefs = formula.match(cellRefPattern) || [];
    score += Math.min(cellRefs.length * 2, 20);
    // Count operators
    const operators = ['+', '-', '*', '/', '^', '&', '<', '>', '='];
    const operatorCount = operators.reduce((count, op) => count + (formula.split(op).length - 1), 0);
    score += Math.min(operatorCount * 2, 10);
    // Length
    score += Math.min(formula.length / 10, 10);
    return Math.min(score, 100);
}
/**
 * Analyze formula complexity with detailed metrics
 */
export function analyzeFormulaComplexity(cell, formula) {
    const score = scoreFormulaComplexity(formula);
    // Extract metrics
    const functionPattern = /\b[A-Z_]+\s*\(/g;
    const functions = formula.match(functionPattern) || [];
    const functionCount = functions.length;
    let maxDepth = 0;
    let currentDepth = 0;
    for (const char of formula) {
        if (char === '(')
            currentDepth++;
        if (char === ')')
            currentDepth--;
        maxDepth = Math.max(maxDepth, currentDepth);
    }
    const cellRefPattern = /\b[A-Z]{1,3}[0-9]{1,7}\b/g;
    const cellRefs = formula.match(cellRefPattern) || [];
    const referenceCount = cellRefs.length;
    const operators = ['+', '-', '*', '/', '^', '&', '<', '>', '='];
    const operatorCount = operators.reduce((count, op) => count + (formula.split(op).length - 1), 0);
    // Categorize
    let category = 'simple';
    if (score > 70)
        category = 'very_complex';
    else if (score > 50)
        category = 'complex';
    else if (score > 30)
        category = 'moderate';
    // Generate suggestions
    const suggestions = [];
    if (functionCount > 5) {
        suggestions.push('Consider breaking down into multiple helper cells');
    }
    if (maxDepth > 4) {
        suggestions.push('High nesting depth - simplify logic where possible');
    }
    if (referenceCount > 10) {
        suggestions.push('Many cell references - consider using named ranges');
    }
    if (formula.length > 200) {
        suggestions.push('Very long formula - break into intermediate calculations');
    }
    return {
        cell,
        formula,
        score: Math.round(score),
        metrics: {
            functionCount,
            nestedLevels: maxDepth,
            referenceCount,
            operators: operatorCount,
            length: formula.length,
        },
        category,
        suggestions,
    };
}
// ============================================================================
// Circular Reference Detection
// ============================================================================
/**
 * Detect circular references in formulas
 *
 * Note: This is a simplified version. Full detection requires dependency graph.
 */
export function detectCircularRefs(formulas) {
    const circularRefs = [];
    const cellRefPattern = /\b([A-Z]{1,3}[0-9]{1,7})\b/g;
    // Build dependency graph
    const dependencies = new Map();
    for (const { cell, formula } of formulas) {
        const refs = Array.from(formula.matchAll(cellRefPattern))
            .map((m) => m[1])
            .filter((ref) => ref !== undefined);
        dependencies.set(cell, new Set(refs));
    }
    // Detect cycles using DFS
    const visited = new Set();
    const recStack = new Set();
    function hasCycle(node, path) {
        if (recStack.has(node)) {
            // Found cycle
            const cycleStart = path.indexOf(node);
            const cyclePath = path.slice(cycleStart).concat(node);
            circularRefs.push({
                cells: cyclePath,
                chain: cyclePath.join(' -> '),
                severity: 'error',
            });
            return true;
        }
        if (visited.has(node))
            return false;
        visited.add(node);
        recStack.add(node);
        path.push(node);
        const deps = dependencies.get(node);
        if (deps) {
            for (const dep of deps) {
                if (hasCycle(dep, [...path])) {
                    // Continue to find all cycles
                }
            }
        }
        recStack.delete(node);
        return false;
    }
    for (const cell of dependencies.keys()) {
        if (!visited.has(cell)) {
            hasCycle(cell, []);
        }
    }
    return circularRefs;
}
// ============================================================================
// INDIRECT/OFFSET Detection
// ============================================================================
/**
 * Detect usage of INDIRECT and OFFSET functions
 */
export function findIndirectUsage(formulas) {
    const indirectUsage = [];
    for (const { cell, formula } of formulas) {
        const upperFormula = formula.toUpperCase();
        // Check for INDIRECT
        if (/\bINDIRECT\s*\(/.test(upperFormula)) {
            const complexity = scoreFormulaComplexity(formula);
            const impact = complexity > 50 ? 'high' : complexity > 30 ? 'medium' : 'low';
            indirectUsage.push({
                cell,
                formula,
                function: 'INDIRECT',
                impact,
                reasoning: 'INDIRECT is volatile and cannot be optimized by the calculation engine',
                suggestion: 'Consider using INDEX/MATCH or direct cell references when possible',
            });
        }
        // Check for OFFSET
        if (/\bOFFSET\s*\(/.test(upperFormula)) {
            const complexity = scoreFormulaComplexity(formula);
            const impact = complexity > 50 ? 'high' : complexity > 30 ? 'medium' : 'low';
            indirectUsage.push({
                cell,
                formula,
                function: 'OFFSET',
                impact,
                reasoning: 'OFFSET is volatile and recalculates on every change',
                suggestion: 'Consider using INDEX with dynamic ranges or named ranges',
            });
        }
    }
    return indirectUsage;
}
// ============================================================================
// Array Formula Analysis
// ============================================================================
/**
 * Analyze array formulas
 */
export function findArrayFormulas(formulas) {
    const arrayFormulas = [];
    for (const { cell, formula, isArrayFormula } of formulas) {
        if (isArrayFormula || (formula.startsWith('{') && formula.endsWith('}'))) {
            // Parse range from cell (e.g., "A1:B10")
            const rangeMatch = cell.match(/([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)/);
            if (rangeMatch && rangeMatch[1] && rangeMatch[2] && rangeMatch[3] && rangeMatch[4]) {
                const [, startCol, startRow, endCol, endRow] = rangeMatch;
                const outputRows = parseInt(endRow) - parseInt(startRow) + 1;
                const outputCols = endCol.charCodeAt(0) - startCol.charCodeAt(0) + 1;
                const complexity = scoreFormulaComplexity(formula);
                const complexityCategory = complexity > 50 ? 'complex' : complexity > 30 ? 'moderate' : 'simple';
                arrayFormulas.push({
                    range: cell,
                    formula,
                    inputRows: 0, // Would need more context
                    inputCols: 0,
                    outputRows,
                    outputCols,
                    complexity: complexityCategory,
                });
            }
        }
    }
    return arrayFormulas;
}
// ============================================================================
// Broken Reference Detection
// ============================================================================
/**
 * Detect broken references in formulas
 */
export function findOrphanedRefs(formulas, validSheets) {
    const brokenRefs = [];
    const sheetRefPattern = /\b([A-Za-z0-9\s_]+)![A-Z]{1,3}[0-9]{1,7}\b/g;
    for (const { cell, formula } of formulas) {
        // Check for #REF! errors
        if (formula.includes('#REF!')) {
            brokenRefs.push({
                cell,
                formula,
                brokenRefs: ['#REF!'],
                errorType: '#REF!',
                suggestion: 'Cell or range was deleted. Update formula with correct reference.',
            });
            continue;
        }
        // Check for missing sheets
        const sheetRefs = Array.from(formula.matchAll(sheetRefPattern));
        const missingSheets = sheetRefs
            .map((m) => m[1])
            .filter((sheet) => sheet !== undefined && !validSheets.includes(sheet));
        if (missingSheets.length > 0) {
            brokenRefs.push({
                cell,
                formula,
                brokenRefs: missingSheets,
                errorType: 'MISSING_SHEET',
                suggestion: `Referenced sheets not found: ${missingSheets.join(', ')}. Check sheet names.`,
            });
        }
    }
    return brokenRefs;
}
// ============================================================================
// Optimization Suggestions
// ============================================================================
/**
 * Generate optimization suggestions for formulas
 */
export function generateOptimizations(formulas) {
    const suggestions = [];
    for (const { cell, formula } of formulas) {
        const upperFormula = formula.toUpperCase();
        // VLOOKUP to INDEX/MATCH
        if (/\bVLOOKUP\s*\(/.test(upperFormula)) {
            suggestions.push({
                type: 'VLOOKUP_TO_INDEX_MATCH',
                priority: 'medium',
                affectedCells: [cell],
                currentFormula: formula,
                suggestedFormula: 'INDEX(return_range, MATCH(lookup_value, lookup_range, 0))',
                reasoning: 'INDEX/MATCH is more flexible and faster than VLOOKUP for large datasets',
                estimatedSpeedup: '20-50% faster',
            });
        }
        // SUMIF to SUMIFS (when multiple conditions detected)
        if (/\bSUMIF\s*\(/.test(upperFormula) && formula.split('IF').length > 2) {
            suggestions.push({
                type: 'SUMIF_TO_SUMIFS',
                priority: 'low',
                affectedCells: [cell],
                currentFormula: formula,
                suggestedFormula: 'SUMIFS(sum_range, criteria_range1, criterion1, ...)',
                reasoning: 'SUMIFS is designed for multiple criteria and is more readable',
                estimatedSpeedup: 'Slightly faster, more maintainable',
            });
        }
    }
    return suggestions;
}
//# sourceMappingURL=formula-helpers.js.map