/**
 * Formula Library Service
 *
 * Tracks successful formula patterns and suggests them based on user history
 * Phase 4: Optional Enhancements - Formula Library
 */

import { logger } from '../utils/logger.js';
import type { UserProfile } from './user-profile-manager.js';

interface FormulaPattern {
  formula: string;
  category: 'lookup' | 'aggregation' | 'text' | 'date' | 'array' | 'financial';
  useCase: string;
  successCount: number;
  lastUsed: number;
  performance: 'fast' | 'medium' | 'slow';
  complexity: 'simple' | 'intermediate' | 'complex';
  tags: string[];
}

interface FormulaSuggestion {
  formula: string;
  confidence: number;
  reason: string;
  alternatives: string[];
}

export class FormulaLibrary {
  /**
   * Record a successful formula usage
   */
  recordSuccess(
    profile: UserProfile,
    formula: string,
    useCase: string,
    category: FormulaPattern['category']
  ): void {
    // Normalize formula (remove specific cell references for pattern matching)
    const normalizedFormula = this.normalizeFormula(formula);

    // Find existing pattern
    const existing = profile.history.successfulFormulas.find(
      (f) => this.normalizeFormula(f.formula) === normalizedFormula
    );

    if (existing) {
      existing.successCount++;
      const asPattern = existing as unknown as FormulaPattern;
      asPattern.lastUsed = Date.now();
    } else {
      const newPattern: FormulaPattern = {
        formula: normalizedFormula,
        useCase,
        successCount: 1,
        category,
        performance: this.estimatePerformance(formula),
        complexity: this.estimateComplexity(formula),
        tags: this.extractTags(formula, useCase),
        lastUsed: Date.now(),
      };
      profile.history.successfulFormulas.push(newPattern as never);
    }

    logger.info('Recorded formula success', { formula: normalizedFormula, useCase });
  }

  /**
   * Suggest formulas based on context
   */
  suggestFormulas(
    profile: UserProfile,
    context: {
      dataType?: 'numeric' | 'text' | 'date' | 'mixed';
      goal?: 'lookup' | 'aggregate' | 'transform' | 'validate';
      dataSize?: 'small' | 'medium' | 'large';
    }
  ): FormulaSuggestion[] {
    const { successfulFormulas } = profile.history;

    // Filter by context
    let candidates = (successfulFormulas as unknown as FormulaPattern[]).filter((f) => {
      if (context.goal && f.category !== context.goal) return false;
      if (context.dataSize === 'large' && f.performance === 'slow') return false;
      return true;
    });

    // Sort by success count and recency
    candidates.sort((a, b) => {
      const scoreA = a.successCount * 0.7 + ((Date.now() - a.lastUsed) / 86400000) * 0.3;
      const scoreB = b.successCount * 0.7 + ((Date.now() - b.lastUsed) / 86400000) * 0.3;
      return scoreB - scoreA;
    });

    // Generate suggestions
    return candidates.slice(0, 5).map((pattern) => ({
      formula: pattern.formula,
      confidence: this.calculateConfidence(pattern, context),
      reason: this.generateReason(pattern, context),
      alternatives: this.findAlternatives(
        pattern,
        successfulFormulas as unknown as FormulaPattern[]
      ),
    }));
  }

  /**
   * Normalize formula by removing specific cell references
   */
  private normalizeFormula(formula: string): string {
    return formula
      .replace(/[A-Z]+\d+/g, 'CELL') // A1 → CELL
      .replace(/[A-Z]+:\d+/g, 'RANGE') // A:A → RANGE
      .replace(/\d+:\d+/g, 'RANGE') // 1:10 → RANGE
      .toUpperCase();
  }

  /**
   * Estimate formula performance
   */
  private estimatePerformance(formula: string): 'fast' | 'medium' | 'slow' {
    const slow = ['IMPORTRANGE', 'GOOGLEFINANCE', 'QUERY'];
    const medium = ['ARRAYFORMULA', 'FILTER', 'SORT', 'UNIQUE'];

    if (slow.some((fn) => formula.includes(fn))) return 'slow';
    if (medium.some((fn) => formula.includes(fn))) return 'medium';
    return 'fast';
  }

  /**
   * Estimate formula complexity
   */
  private estimateComplexity(formula: string): 'simple' | 'intermediate' | 'complex' {
    const nestingLevel = (formula.match(/\(/g) || []).length;
    if (nestingLevel > 5) return 'complex';
    if (nestingLevel > 2) return 'intermediate';
    return 'simple';
  }

  /**
   * Extract tags from formula and use case
   */
  private extractTags(formula: string, useCase: string): string[] {
    const tags: string[] = [];

    // Function-based tags
    if (formula.includes('VLOOKUP')) tags.push('vlookup', 'lookup');
    if (formula.includes('INDEX') && formula.includes('MATCH')) tags.push('index-match', 'lookup');
    if (formula.includes('SUMIF')) tags.push('conditional-sum', 'aggregation');
    if (formula.includes('ARRAYFORMULA')) tags.push('array', 'dynamic');

    // Use case tags
    const ucLower = useCase.toLowerCase();
    if (ucLower.includes('sales')) tags.push('sales', 'business');
    if (ucLower.includes('date')) tags.push('date', 'time');
    if (ucLower.includes('financial')) tags.push('financial', 'money');

    return [...new Set(tags)]; // Deduplicate
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(pattern: FormulaPattern, context: Record<string, unknown>): number {
    let confidence = 0.5;

    // Boost for high success count
    confidence += Math.min(pattern.successCount * 0.05, 0.3);

    // Boost for recent usage
    const daysSinceUse = (Date.now() - pattern.lastUsed) / 86400000;
    if (daysSinceUse < 7) confidence += 0.1;

    // Reduce for complexity mismatch
    if (context['dataSize'] === 'small' && pattern.complexity === 'complex') {
      confidence -= 0.2;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Generate explanation for suggestion
   */
  private generateReason(pattern: FormulaPattern, context: Record<string, unknown>): string {
    const reasons: string[] = [];

    reasons.push(`You've successfully used this ${pattern.successCount} times`);

    if (pattern.performance === 'fast') {
      reasons.push('Fast performance');
    }

    if (context['dataSize'] === 'large' && pattern.performance === 'fast') {
      reasons.push('Optimized for large datasets');
    }

    return reasons.join('. ');
  }

  /**
   * Find alternative formulas
   */
  private findAlternatives(pattern: FormulaPattern, allPatterns: FormulaPattern[]): string[] {
    return allPatterns
      .filter((p) => p.category === pattern.category && p.formula !== pattern.formula)
      .slice(0, 2)
      .map((p) => p.formula);
  }
}

// Singleton
let formulaLibrary: FormulaLibrary | undefined;

export function getFormulaLibrary(): FormulaLibrary {
  if (!formulaLibrary) {
    formulaLibrary = new FormulaLibrary();
  }
  return formulaLibrary;
}
