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
// Type Definitions
// ============================================================================

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
  references: string[]; // e.g., ["A:A", "B:B"]
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface FormulaComplexity {
  cell: string;
  formula: string;
  score: number; // 0-100
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
  chain: string; // e.g., "A1 -> B1 -> C1 -> A1"
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
  errorType:
    | '#REF!'
    | '#NAME?'
    | '#VALUE!'
    | '#DIV/0!'
    | '#N/A'
    | '#NULL!'
    | '#NUM!'
    | '#ERROR!'
    | 'MISSING_SHEET';
  suggestion: string;
}

/**
 * Formula error detected from cell evaluation
 * This captures errors that appear in cell VALUES, not just formula text
 */
export interface FormulaError {
  cell: string;
  formula: string;
  errorType: '#REF!' | '#NAME?' | '#VALUE!' | '#DIV/0!' | '#N/A' | '#NULL!' | '#NUM!' | '#ERROR!';
  errorValue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string;
  possibleCauses: string[];
}

/**
 * Summary of formula health for a spreadsheet
 */
export interface FormulaHealthSummary {
  totalFormulas: number;
  healthyFormulas: number;
  errorCount: number;
  errorsByType: Record<string, number>;
  criticalErrors: FormulaError[];
  healthScore: number; // 0-100
}

export interface OptimizationSuggestion {
  type:
    | 'VLOOKUP_TO_INDEX_MATCH'
    | 'SUMIF_TO_SUMIFS'
    | 'REMOVE_VOLATILE'
    | 'SIMPLIFY_NESTED'
    | 'USE_NAMED_RANGE'
    | 'ARRAY_FORMULA';
  priority: 'low' | 'medium' | 'high';
  affectedCells: string[];
  currentFormula: string;
  suggestedFormula: string;
  reasoning: string;
  estimatedSpeedup: string;
}

// ============================================================================
// Volatile Formula Detection
// ============================================================================

/**
 * Detect formulas using volatile functions
 *
 * Volatile functions recalculate on every change, even if their inputs haven't changed.
 * Common volatile functions: NOW, TODAY, RAND, RANDBETWEEN, INDIRECT, OFFSET
 */
export function findVolatileFormulas(
  formulas: Array<{ cell: string; formula: string }>
): VolatileFormula[] {
  const volatileFunctions = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'INDIRECT', 'OFFSET', 'INFO'];

  const volatileFormulas: VolatileFormula[] = [];

  for (const { cell, formula } of formulas) {
    const upperFormula = formula.toUpperCase();
    const foundVolatile = volatileFunctions.filter((fn) =>
      new RegExp(`\\b${fn}\\s*\\(`).test(upperFormula)
    );

    if (foundVolatile.length > 0) {
      // Determine impact based on how many volatile functions
      let impact: 'low' | 'medium' | 'high' = 'low';
      if (foundVolatile.length >= 3) impact = 'high';
      else if (foundVolatile.length === 2) impact = 'medium';

      // Generate suggestion
      let suggestion = '';
      if (foundVolatile.includes('NOW') || foundVolatile.includes('TODAY')) {
        suggestion =
          'Consider calculating these once in a helper cell and referencing that cell instead.';
      } else if (foundVolatile.includes('RAND') || foundVolatile.includes('RANDBETWEEN')) {
        suggestion =
          'Random functions are inherently volatile. Use sparingly or calculate once and copy values.';
      } else if (foundVolatile.includes('INDIRECT') || foundVolatile.includes('OFFSET')) {
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
export function findFullColumnRefs(
  formulas: Array<{ cell: string; formula: string }>
): FullColumnReference[] {
  const fullColumnRefs: FullColumnReference[] = [];
  const columnRefPattern = /\b([A-Z]{1,3}):([A-Z]{1,3})\b/g;

  for (const { cell, formula } of formulas) {
    const matches = Array.from(formula.matchAll(columnRefPattern));
    const references = matches
      .filter((m) => m[1] === m[2]) // Same column (A:A, not A:B)
      .map((m) => m[0]);

    if (references.length > 0) {
      // Determine impact
      let impact: 'low' | 'medium' | 'high' = 'low';
      if (references.length >= 3) impact = 'high';
      else if (references.length === 2) impact = 'medium';

      fullColumnRefs.push({
        cell,
        formula,
        references,
        impact,
        suggestion:
          'Replace full column references with specific ranges (e.g., A1:A1000) to improve performance.',
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
export function scoreFormulaComplexity(formula: string): number {
  let score = 0;

  // Count functions
  const functionPattern = /\b[A-Z_]+\s*\(/g;
  const functions = formula.match(functionPattern) || [];
  score += Math.min(functions.length * 5, 30);

  // Count nesting depth
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of formula) {
    if (char === '(') currentDepth++;
    if (char === ')') currentDepth--;
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
export function analyzeFormulaComplexity(cell: string, formula: string): FormulaComplexity {
  const score = scoreFormulaComplexity(formula);

  // Extract metrics
  const functionPattern = /\b[A-Z_]+\s*\(/g;
  const functions = formula.match(functionPattern) || [];
  const functionCount = functions.length;

  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of formula) {
    if (char === '(') currentDepth++;
    if (char === ')') currentDepth--;
    maxDepth = Math.max(maxDepth, currentDepth);
  }

  const cellRefPattern = /\b[A-Z]{1,3}[0-9]{1,7}\b/g;
  const cellRefs = formula.match(cellRefPattern) || [];
  const referenceCount = cellRefs.length;

  const operators = ['+', '-', '*', '/', '^', '&', '<', '>', '='];
  const operatorCount = operators.reduce((count, op) => count + (formula.split(op).length - 1), 0);

  // Categorize
  let category: FormulaComplexity['category'] = 'simple';
  if (score > 70) category = 'very_complex';
  else if (score > 50) category = 'complex';
  else if (score > 30) category = 'moderate';

  // Generate suggestions
  const suggestions: string[] = [];
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
export function detectCircularRefs(
  formulas: Array<{ cell: string; formula: string }>
): CircularReference[] {
  const circularRefs: CircularReference[] = [];
  const cellRefPattern = /\b([A-Z]{1,3}[0-9]{1,7})\b/g;

  // Build dependency graph
  const dependencies = new Map<string, Set<string>>();

  for (const { cell, formula } of formulas) {
    const refs = Array.from(formula.matchAll(cellRefPattern))
      .map((m) => m[1])
      .filter((ref): ref is string => ref !== undefined);
    dependencies.set(cell, new Set(refs));
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(node: string, path: string[]): boolean {
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

    if (visited.has(node)) return false;

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
export function findIndirectUsage(
  formulas: Array<{ cell: string; formula: string }>
): IndirectUsage[] {
  const indirectUsage: IndirectUsage[] = [];

  for (const { cell, formula } of formulas) {
    const upperFormula = formula.toUpperCase();

    // Check for INDIRECT
    if (/\bINDIRECT\s*\(/.test(upperFormula)) {
      const complexity = scoreFormulaComplexity(formula);
      const impact: 'low' | 'medium' | 'high' =
        complexity > 50 ? 'high' : complexity > 30 ? 'medium' : 'low';

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
      const impact: 'low' | 'medium' | 'high' =
        complexity > 50 ? 'high' : complexity > 30 ? 'medium' : 'low';

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
export function findArrayFormulas(
  formulas: Array<{ cell: string; formula: string; isArrayFormula?: boolean }>
): ArrayFormula[] {
  const arrayFormulas: ArrayFormula[] = [];

  for (const { cell, formula, isArrayFormula } of formulas) {
    if (isArrayFormula || (formula.startsWith('{') && formula.endsWith('}'))) {
      // Parse range from cell (e.g., "A1:B10")
      const rangeMatch = cell.match(/([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)/);
      if (rangeMatch && rangeMatch[1] && rangeMatch[2] && rangeMatch[3] && rangeMatch[4]) {
        const [, startCol, startRow, endCol, endRow] = rangeMatch;
        const outputRows = parseInt(endRow) - parseInt(startRow) + 1;
        const outputCols = endCol.charCodeAt(0) - startCol.charCodeAt(0) + 1;

        const complexity = scoreFormulaComplexity(formula);
        const complexityCategory: 'simple' | 'moderate' | 'complex' =
          complexity > 50 ? 'complex' : complexity > 30 ? 'moderate' : 'simple';

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
export function findOrphanedRefs(
  formulas: Array<{ cell: string; formula: string }>,
  validSheets: string[]
): BrokenReference[] {
  const brokenRefs: BrokenReference[] = [];

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
      .filter((sheet): sheet is string => sheet !== undefined && !validSheets.includes(sheet));

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
export function generateOptimizations(
  formulas: Array<{ cell: string; formula: string }>
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

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

// ============================================================================
// Formula Error Detection (from cell VALUES, not just formula text)
// ============================================================================

/**
 * All Google Sheets error types
 */
const SHEET_ERROR_TYPES = [
  '#REF!',
  '#NAME?',
  '#VALUE!',
  '#DIV/0!',
  '#N/A',
  '#NULL!',
  '#NUM!',
  '#ERROR!',
] as const;

type SheetErrorType = (typeof SHEET_ERROR_TYPES)[number];

/**
 * Error metadata for generating helpful suggestions
 */
const ERROR_METADATA: Record<
  SheetErrorType,
  {
    severity: 'critical' | 'high' | 'medium' | 'low';
    suggestion: string;
    possibleCauses: string[];
  }
> = {
  '#REF!': {
    severity: 'critical',
    suggestion:
      'A referenced cell, range, or sheet was deleted. Update the formula with valid references.',
    possibleCauses: [
      'Referenced cell or range was deleted',
      'Referenced sheet was deleted or renamed',
      'Copy/paste operation broke relative references',
      'Row or column containing referenced cells was deleted',
    ],
  },
  '#NAME?': {
    severity: 'high',
    suggestion: 'Check for typos in function names, named ranges, or missing quotes around text.',
    possibleCauses: [
      'Misspelled function name (e.g., SUMM instead of SUM)',
      'Named range does not exist',
      'Text value missing quotes',
      'Add-on function not available',
    ],
  },
  '#VALUE!': {
    severity: 'medium',
    suggestion: 'Check that the data types match what the formula expects (numbers vs text).',
    possibleCauses: [
      'Text value where number expected',
      'Array formula returning wrong dimensions',
      'Date/time format mismatch',
      'Incompatible operand types',
    ],
  },
  '#DIV/0!': {
    severity: 'medium',
    suggestion:
      'The formula is dividing by zero or an empty cell. Add error handling with IFERROR.',
    possibleCauses: [
      'Dividing by zero explicitly',
      'Dividing by empty cell',
      'AVERAGE of empty range',
      'Divisor cell contains text',
    ],
  },
  '#N/A': {
    severity: 'low',
    suggestion: 'Lookup value not found. Verify the lookup value exists in the search range.',
    possibleCauses: [
      'VLOOKUP/HLOOKUP/MATCH value not found',
      'FILTER returned no results',
      'INDEX out of range',
      'Extra spaces or formatting differences',
    ],
  },
  '#NULL!': {
    severity: 'low',
    suggestion: 'Invalid range intersection. Check for missing operators between ranges.',
    possibleCauses: [
      'Missing comma between arguments',
      'Invalid range intersection operator (space)',
      'Typo in range specification',
    ],
  },
  '#NUM!': {
    severity: 'medium',
    suggestion: 'Invalid numeric value or calculation result too large/small.',
    possibleCauses: [
      'Number too large for Google Sheets',
      'Invalid argument for math function (e.g., SQRT of negative)',
      'IRR or RATE cannot converge',
      'Date calculation resulting in invalid date',
    ],
  },
  '#ERROR!': {
    severity: 'high',
    suggestion: 'Google Sheets cannot parse the formula. Check syntax and function arguments.',
    possibleCauses: [
      'Formula syntax error',
      'Unsupported function',
      'Invalid characters in formula',
      'Missing required arguments',
    ],
  },
};

/**
 * Detect formula errors from cell values
 *
 * CRITICAL: This function analyzes cell VALUES (what the user sees),
 * not just formula text. A formula like =VLOOKUP(A1, DeletedSheet!A:B, 2)
 * will show #REF! in the cell value even though the formula text itself
 * might not contain #REF!.
 *
 * @param cells Array of cells with formula and evaluated value
 * @returns Array of detected formula errors
 */
export function detectFormulaErrors(
  cells: Array<{
    cell: string;
    formula: string;
    value?: string | number | boolean | null;
    formattedValue?: string;
  }>
): FormulaError[] {
  const errors: FormulaError[] = [];

  for (const { cell, formula, value, formattedValue } of cells) {
    // Check the displayed/formatted value for errors (what user sees)
    const displayValue = formattedValue ?? String(value ?? '');

    for (const errorType of SHEET_ERROR_TYPES) {
      if (displayValue.includes(errorType) || String(value).includes(errorType)) {
        const metadata = ERROR_METADATA[errorType];
        errors.push({
          cell,
          formula,
          errorType,
          errorValue: displayValue,
          severity: metadata.severity,
          suggestion: metadata.suggestion,
          possibleCauses: metadata.possibleCauses,
        });
        break; // Only report first error per cell
      }
    }

    // Also check if formula text itself contains error (embedded #REF!)
    if (!errors.some((e) => e.cell === cell)) {
      for (const errorType of SHEET_ERROR_TYPES) {
        if (formula.includes(errorType)) {
          const metadata = ERROR_METADATA[errorType];
          errors.push({
            cell,
            formula,
            errorType,
            errorValue: formula,
            severity: metadata.severity,
            suggestion: metadata.suggestion,
            possibleCauses: metadata.possibleCauses,
          });
          break;
        }
      }
    }
  }

  return errors;
}

/**
 * Calculate formula health summary
 *
 * @param totalFormulas Total number of formulas analyzed
 * @param errors Detected formula errors
 * @returns Health summary with score and breakdown
 */
export function calculateFormulaHealth(
  totalFormulas: number,
  errors: FormulaError[]
): FormulaHealthSummary {
  const errorsByType: Record<string, number> = {};

  for (const error of errors) {
    errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
  }

  const criticalErrors = errors.filter((e) => e.severity === 'critical');
  const highErrors = errors.filter((e) => e.severity === 'high');

  // Calculate health score:
  // - Start at 100
  // - Critical errors: -10 points each (max -50)
  // - High errors: -5 points each (max -25)
  // - Medium errors: -2 points each (max -15)
  // - Low errors: -1 point each (max -10)
  let healthScore = 100;
  healthScore -= Math.min(50, criticalErrors.length * 10);
  healthScore -= Math.min(25, highErrors.length * 5);
  healthScore -= Math.min(15, errors.filter((e) => e.severity === 'medium').length * 2);
  healthScore -= Math.min(10, errors.filter((e) => e.severity === 'low').length);
  healthScore = Math.max(0, healthScore);

  return {
    totalFormulas,
    healthyFormulas: totalFormulas - errors.length,
    errorCount: errors.length,
    errorsByType,
    criticalErrors,
    healthScore,
  };
}
