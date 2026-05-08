/**
 * ServalSheets — Scenario Catalog Meta-Tests
 *
 * Validates that the scenario catalog is well-formed, deterministic,
 * and covers all required categories.
 */

import { describe, it, expect } from 'vitest';
import { generateScenarioCatalog, generateTestData } from '../stress/scenario-catalog.js';

describe('Scenario Catalog Meta-Tests', () => {
  it('catalog generates at least 50 scenarios', () => {
    const catalog = generateScenarioCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(50);
  });

  it('all scenario IDs are unique', () => {
    const catalog = generateScenarioCatalog();
    const ids = catalog.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('generateTestData is deterministic', () => {
    const run1 = generateTestData('small');
    const run2 = generateTestData('small');
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('generateTestData small has 101 rows (header + 100)', () => {
    expect(generateTestData('small').length).toBe(101);
  });

  it('generateTestData tiny has 11 rows (header + 10)', () => {
    expect(generateTestData('tiny').length).toBe(11);
  });

  it('generateTestData medium has 1001 rows (header + 1000)', () => {
    expect(generateTestData('medium').length).toBe(1001);
  });

  it('generateTestData large has 5001 rows (header + 5000)', () => {
    expect(generateTestData('large').length).toBe(5001);
  });

  it('all scenarios have valid successCriteria', () => {
    for (const s of generateScenarioCatalog()) {
      expect(s.successCriteria.minSuccessRate).toBeGreaterThan(0);
      expect(s.successCriteria.maxP95LatencyMs).toBeGreaterThan(0);
      expect(s.successCriteria.maxMemoryGrowthMB).toBeGreaterThan(0);
    }
  });

  it('catalog covers all 8 category types', () => {
    const catalog = generateScenarioCatalog();
    const categories = new Set(catalog.map(s => s.category));
    expect(categories.size).toBe(8);
  });

  it('every scenario has a non-empty name', () => {
    for (const s of generateScenarioCatalog()) {
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it('every scenario has at least one step', () => {
    for (const s of generateScenarioCatalog()) {
      expect(s.steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every step has tool, action, and params function', () => {
    for (const s of generateScenarioCatalog()) {
      for (const step of s.steps) {
        expect(typeof step.tool).toBe('string');
        expect(typeof step.action).toBe('string');
        expect(typeof step.params).toBe('function');
      }
    }
  });

  it('step params function produces a record given spreadsheetId, sheetName, rowCount', () => {
    const catalog = generateScenarioCatalog();
    for (const s of catalog.slice(0, 5)) {
      for (const step of s.steps) {
        const result = step.params('spreadsheet-id', 'Sheet1', 100);
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      }
    }
  });

  it('generateTestData header row has 7 columns', () => {
    const data = generateTestData('tiny');
    expect(data[0]).toEqual(['Date', 'Product', 'Revenue', 'Cost', 'Units', 'Region', 'Status']);
  });

  it('generateTestData produces no Math.random() values (deterministic check)', () => {
    const run1 = generateTestData('small');
    const run2 = generateTestData('small');
    // Values must be byte-identical across two runs
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i]).toEqual(run2[i]);
    }
  });

  it('all scenario concurrentUsers values are from the allowed set', () => {
    const allowed = new Set([1, 5, 10, 25, 50]);
    for (const s of generateScenarioCatalog()) {
      expect(allowed.has(s.concurrentUsers)).toBe(true);
    }
  });

  it('all scenario dataScale values are from the allowed set', () => {
    const allowed = new Set(['tiny', 'small', 'medium', 'large']);
    for (const s of generateScenarioCatalog()) {
      expect(allowed.has(s.dataScale)).toBe(true);
    }
  });

  it('error-recovery scenarios have faults defined', () => {
    const catalog = generateScenarioCatalog();
    const errorRecovery = catalog.filter(s => s.category === 'error-recovery');
    expect(errorRecovery.length).toBeGreaterThan(0);
    for (const s of errorRecovery) {
      expect(s.faults).toBeDefined();
      expect(s.faults!.length).toBeGreaterThan(0);
    }
  });
});
