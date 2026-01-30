/**
 * ServalSheets - Dependencies Schemas
 *
 * Schemas for formula dependency analysis and impact assessment.
 * Analyzes how formula changes propagate through a spreadsheet.
 *
 * @category Schemas
 */

import { z } from 'zod';
import { ErrorDetailSchema } from './shared.js';

/**
 * Dependency actions
 */
export const DependencyActionsSchema = z.enum([
  'build',
  'analyze_impact',
  'detect_cycles',
  'get_dependencies',
  'get_dependents',
  'get_stats',
  'export_dot',
]);

/**
 * Build dependency graph action
 */
export const DependencyBuildInputSchema = z.object({
  action: z.literal('build'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
  sheetNames: z
    .array(z.string())
    .optional()
    .describe('Sheet names to analyze (default: all sheets)'),
});

/**
 * Analyze impact action
 */
export const DependencyAnalyzeImpactInputSchema = z.object({
  action: z.literal('analyze_impact'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
  cell: z.string().min(1, 'Cell address required').describe('Cell address (e.g., Sheet1!A1)'),
});

/**
 * Detect circular dependencies action
 */
export const DependencyDetectCyclesInputSchema = z.object({
  action: z.literal('detect_cycles'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
});

/**
 * Get dependencies action
 */
export const DependencyGetDependenciesInputSchema = z.object({
  action: z.literal('get_dependencies'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
  cell: z.string().min(1, 'Cell address required').describe('Cell address (e.g., Sheet1!A1)'),
});

/**
 * Get dependents action
 */
export const DependencyGetDependentsInputSchema = z.object({
  action: z.literal('get_dependents'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
  cell: z.string().min(1, 'Cell address required').describe('Cell address (e.g., Sheet1!A1)'),
});

/**
 * Get statistics action
 */
export const DependencyGetStatsInputSchema = z.object({
  action: z.literal('get_stats'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
});

/**
 * Export DOT format action
 */
export const DependencyExportDotInputSchema = z.object({
  action: z.literal('export_dot'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
});

/**
 * Dependencies request (discriminated union)
 */
const DependencyRequestSchema = z.discriminatedUnion('action', [
  DependencyBuildInputSchema,
  DependencyAnalyzeImpactInputSchema,
  DependencyDetectCyclesInputSchema,
  DependencyGetDependenciesInputSchema,
  DependencyGetDependentsInputSchema,
  DependencyGetStatsInputSchema,
  DependencyExportDotInputSchema,
]);

/**
 * Dependencies input (wrapped for MCP compatibility)
 *
 * Uses the standard { request: ... } pattern that other tools use.
 * This ensures the schema matches the MCP SDK's expected input format.
 */
export const SheetsDependenciesInputSchema = z.object({
  request: DependencyRequestSchema,
});

/**
 * Circular dependency
 */
export const CircularDependencySchema = z.object({
  cycle: z.array(z.string()),
  chain: z.string(),
  severity: z.literal('error'),
});

/**
 * Recalculation cost estimate
 */
export const RecalculationCostSchema = z.object({
  cellCount: z.number().int(),
  complexityScore: z.number().int().min(0).max(100),
  timeEstimate: z.enum(['instant', 'fast', 'moderate', 'slow', 'very_slow']),
});

/**
 * Impact analysis result
 */
export const ImpactAnalysisSchema = z.object({
  targetCell: z.string(),
  directDependents: z.array(z.string()),
  allAffectedCells: z.array(z.string()),
  dependencies: z.array(z.string()),
  maxDepth: z.number().int(),
  recalculationCost: RecalculationCostSchema,
  circularDependencies: z.array(CircularDependencySchema),
});

/**
 * Dependency statistics
 */
export const DependencyStatsSchema = z.object({
  totalCells: z.number().int(),
  formulaCells: z.number().int(),
  valueCells: z.number().int(),
  totalDependencies: z.number().int(),
  maxDepth: z.number().int(),
  mostComplexCells: z.array(
    z.object({
      cell: z.string(),
      dependencyCount: z.number().int(),
    })
  ),
  mostInfluentialCells: z.array(
    z.object({
      cell: z.string(),
      dependentCount: z.number().int(),
    })
  ),
});

/**
 * Build result
 */
export const DependencyBuildResultSchema = z.object({
  spreadsheetId: z.string(),
  cellCount: z.number().int(),
  formulaCount: z.number().int(),
  message: z.string(),
});

/**
 * Dependencies output response
 */
const DependenciesResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.union([
      DependencyBuildResultSchema,
      ImpactAnalysisSchema,
      z.object({ circularDependencies: z.array(CircularDependencySchema) }),
      z.object({ dependencies: z.array(z.string()) }),
      z.object({ dependents: z.array(z.string()) }),
      DependencyStatsSchema,
      z.object({ dot: z.string() }),
    ]),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsDependenciesOutputSchema = z.object({
  response: DependenciesResponseSchema,
});

/**
 * Tool annotations for sheets_dependencies
 */
export const SHEETS_DEPENDENCIES_ANNOTATIONS = {
  title: 'Formula Dependencies',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

// Type exports
export type DependencyActions = z.infer<typeof DependencyActionsSchema>;
export type SheetsDependenciesInput = z.infer<typeof SheetsDependenciesInputSchema>;
export type DependencyBuildInput = z.infer<typeof DependencyBuildInputSchema>;
export type DependencyAnalyzeImpactInput = z.infer<typeof DependencyAnalyzeImpactInputSchema>;
export type DependencyDetectCyclesInput = z.infer<typeof DependencyDetectCyclesInputSchema>;
export type DependencyGetDependenciesInput = z.infer<typeof DependencyGetDependenciesInputSchema>;
export type DependencyGetDependentsInput = z.infer<typeof DependencyGetDependentsInputSchema>;
export type DependencyGetStatsInput = z.infer<typeof DependencyGetStatsInputSchema>;
export type DependencyExportDotInput = z.infer<typeof DependencyExportDotInputSchema>;
export type CircularDependency = z.infer<typeof CircularDependencySchema>;
export type RecalculationCost = z.infer<typeof RecalculationCostSchema>;
export type ImpactAnalysis = z.infer<typeof ImpactAnalysisSchema>;
export type DependencyStats = z.infer<typeof DependencyStatsSchema>;
export type DependencyBuildResult = z.infer<typeof DependencyBuildResultSchema>;
export type SheetsDependenciesOutput = z.infer<typeof SheetsDependenciesOutputSchema>;
