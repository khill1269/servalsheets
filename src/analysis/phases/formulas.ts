/**
 * Phase 3: Formula analysis helpers (stateless pure functions)
 */

import type { FormulaInfo } from '../comprehensive.js';

/**
 * Detect volatile functions in a formula string
 */
export function detectVolatileFunctions(formula: string): string[] {
  const volatile = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'INDIRECT', 'OFFSET', 'INFO'];
  return volatile.filter((fn) => formula.toUpperCase().includes(fn + '('));
}

/**
 * Calculate maximum nesting level (parenthesis depth) in a formula
 */
export function calculateNestingLevel(formula: string): number {
  let maxLevel = 0;
  let currentLevel = 0;
  for (const char of formula) {
    if (char === '(') {
      currentLevel++;
      maxLevel = Math.max(maxLevel, currentLevel);
    } else if (char === ')') {
      currentLevel--;
    }
  }
  return maxLevel;
}

/**
 * Classify formula complexity based on function count, nesting depth, and length
 */
export function calculateFormulaComplexity(
  formula: string
): 'simple' | 'moderate' | 'complex' | 'very_complex' {
  const functionCount = (formula.match(/[A-Z]+\(/gi) || []).length;
  const nestedLevel = calculateNestingLevel(formula);
  const length = formula.length;

  if (functionCount > 10 || nestedLevel > 4 || length > 200) return 'very_complex';
  if (functionCount > 5 || nestedLevel > 2 || length > 100) return 'complex';
  if (functionCount > 2 || nestedLevel > 1 || length > 50) return 'moderate';
  return 'simple';
}

/**
 * Identify common formula anti-patterns and issues
 */
export function analyzeFormulaIssues(formula: string): string[] {
  const issues: string[] = [];

  // Check for full column references
  if (/[A-Z]:[A-Z]/i.test(formula)) {
    issues.push('Uses full column reference - may slow calculation');
  }

  // Check for VLOOKUP (suggest INDEX/MATCH)
  if (/VLOOKUP/i.test(formula)) {
    issues.push('VLOOKUP is slower than INDEX/MATCH');
  }

  // Check for hardcoded values
  if (/\d{4,}/.test(formula)) {
    issues.push('Contains hardcoded numbers - consider using named ranges');
  }

  return issues;
}

/**
 * Suggest an optimization for a formula, or undefined if none applies
 */
export function suggestOptimization(formula: string): string | undefined {
  if (/VLOOKUP/i.test(formula)) {
    return 'Consider using INDEX/MATCH for better performance';
  }
  if (/[A-Z]:[A-Z]/i.test(formula)) {
    return 'Use specific range instead of full column reference';
  }
  // OK: Explicit empty - no optimization suggestion for this formula
  return undefined; // OK: Explicit empty
}

/**
 * Extract unique cell and range references from a formula
 */
export function extractDependencies(formula: string): string[] {
  const cellRefs = formula.match(/\$?[A-Z]+\$?\d+/gi) || [];
  const rangeRefs = formula.match(/\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+/gi) || [];
  return [...new Set([...cellRefs, ...rangeRefs])];
}

/**
 * Build a FormulaInfo object for a complex/volatile formula cell
 */
export function buildFormulaInfo(
  cellRef: string,
  formula: string
): FormulaInfo {
  return {
    cell: cellRef,
    formula,
    complexity: calculateFormulaComplexity(formula),
    volatileFunctions: detectVolatileFunctions(formula),
    dependencies: extractDependencies(formula),
    issues: analyzeFormulaIssues(formula),
    optimization: suggestOptimization(formula),
  };
}
