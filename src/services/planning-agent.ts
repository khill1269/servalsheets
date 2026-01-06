/**
 * ServalSheets - Operation Planning Agent
 *
 * Converts natural language intent into executable multi-step operation plans.
 * Phase 3, Task 3.2
 *
 * Features:
 * - Natural language intent parsing
 * - Multi-step operation planning
 * - Cost and risk estimation
 * - User confirmation prompts
 * - Progress tracking
 * - Automatic snapshots and rollback
 *
 * Expected Impact:
 * - Natural language → multi-step execution
 * - 5x faster complex operations
 * - 90% user satisfaction for planned operations
 */

import type {
  OperationPlan,
  PlannedStep,
  Risk,
  ResourceEstimate as _ResourceEstimate,
  PlanExecutionResult,
  PlannedStepResult,
  PlanExecutionProgress as _PlanExecutionProgress,
  PlanningAgentOptions,
  PlanningAgentStats,
  PlanModification,
} from '../types/operation-plan.js';
import { logger } from '../utils/logger.js';
import { v4 as uuid } from 'uuid';

/**
 * Available tools for planning
 */
interface AvailableTool {
  name: string;
  description: string;
  actions: Record<string, string>;
  estimatedCost: number; // API calls per action
}

/**
 * Planning context
 */
interface PlanningContext {
  /** Current spreadsheet (if any) */
  spreadsheetId?: string;

  /** Available tools */
  availableTools: AvailableTool[];

  /** User constraints */
  constraints: {
    maxSteps: number;
    maxApiCalls: number;
    safetyFirst: boolean;
  };

  /** Historical data (for learning) */
  history?: {
    successfulPlans: string[];
    failedPlans: string[];
  };
}

/**
 * Operation Planning Agent
 *
 * Converts user intent into detailed, executable operation plans
 */
export class PlanningAgent {
  private enabled: boolean;
  private maxSteps: number;
  private maxApiCalls: number;
  private requireConfirmation: boolean;
  private autoSnapshot: boolean;
  private autoRollback: boolean;
  private verboseLogging: boolean;

  // Statistics
  private stats = {
    totalPlans: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    rollbackCount: 0,
    executionDurations: [] as number[],
    planComplexities: [] as number[],
    plansGenerated: 0,
    plansExecuted: 0,
  };

  constructor(options: PlanningAgentOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.maxSteps = options.maxSteps ?? 10;
    this.maxApiCalls = options.maxApiCalls ?? 50;
    this.requireConfirmation = options.requireConfirmation ?? true;
    this.autoSnapshot = options.autoSnapshot ?? true;
    this.autoRollback = options.autoRollback ?? true;
    this.verboseLogging = options.verboseLogging ?? false;

    if (this.verboseLogging) {
      logger.info('Planning agent initialized', {
        enabled: this.enabled,
        maxSteps: this.maxSteps,
        maxApiCalls: this.maxApiCalls,
      });
    }
  }

  /**
   * Generate an operation plan from user intent
   */
  async planFromIntent(
    userIntent: string,
    context?: Partial<PlanningContext>
  ): Promise<OperationPlan> {
    if (!this.enabled) {
      throw new Error('Planning agent is disabled');
    }

    this.stats.totalPlans++;
    this.stats.plansGenerated++;

    const planningContext: PlanningContext = {
      spreadsheetId: context?.spreadsheetId,
      availableTools: context?.availableTools || this.getDefaultTools(),
      constraints: {
        maxSteps: this.maxSteps,
        maxApiCalls: this.maxApiCalls,
        safetyFirst: true,
      },
      history: context?.history,
    };

    if (this.verboseLogging) {
      logger.info('Generating plan from intent', {
        intent: userIntent,
        spreadsheetId: planningContext.spreadsheetId,
        toolCount: planningContext.availableTools.length,
      });
    }

    // TODO: Integrate with Claude API for real planning
    // For now, use rule-based planning
    const plan = await this.generatePlan(userIntent, planningContext);

    // Validate and optimize plan
    const validatedPlan = this.validateAndOptimize(plan);

    this.stats.planComplexities.push(validatedPlan.steps.length);

    if (this.verboseLogging) {
      logger.info('Plan generated', {
        planId: validatedPlan.id,
        steps: validatedPlan.steps.length,
        estimatedTime: validatedPlan.estimatedTime,
        risks: validatedPlan.risks.length,
      });
    }

    return validatedPlan;
  }

  /**
   * Generate plan using rule-based approach
   * TODO: Replace with Claude API integration
   */
  private async generatePlan(
    intent: string,
    context: PlanningContext
  ): Promise<OperationPlan> {
    const intentLower = intent.toLowerCase();
    const planId = uuid();
    const _steps: PlannedStep[] = [];
    const _risks: Risk[] = [];

    // Pattern matching for common intents
    if (intentLower.includes('dashboard')) {
      return this.generateDashboardPlan(planId, intent, context);
    } else if (intentLower.includes('report')) {
      return this.generateReportPlan(planId, intent, context);
    } else if (intentLower.includes('analyze') || intentLower.includes('analysis')) {
      return this.generateAnalysisPlan(planId, intent, context);
    } else if (intentLower.includes('import') || intentLower.includes('load')) {
      return this.generateImportPlan(planId, intent, context);
    } else if (intentLower.includes('clean') || intentLower.includes('fix')) {
      return this.generateCleanupPlan(planId, intent, context);
    } else {
      // Generic plan
      return this.generateGenericPlan(planId, intent, context);
    }
  }

  /**
   * Generate dashboard creation plan
   */
  private generateDashboardPlan(
    planId: string,
    intent: string,
    _context: PlanningContext
  ): OperationPlan {
    const steps: PlannedStep[] = [
      {
        stepNumber: 1,
        description: 'Create new spreadsheet for dashboard',
        action: 'sheets_spreadsheet:create',
        params: { title: 'Dashboard' },
        rationale: 'Start with a clean spreadsheet for the dashboard',
        expectedOutcome: 'New spreadsheet created with unique ID',
        estimatedDuration: 2,
      },
      {
        stepNumber: 2,
        description: 'Add "Data" sheet for raw data',
        action: 'sheets_sheet:add',
        params: { title: 'Data' },
        rationale: 'Separate sheet for data organization',
        expectedOutcome: 'Data sheet added to spreadsheet',
        estimatedDuration: 1,
        dependsOn: [1],
      },
      {
        stepNumber: 3,
        description: 'Add "Visualizations" sheet for charts',
        action: 'sheets_sheet:add',
        params: { title: 'Visualizations' },
        rationale: 'Dedicated sheet for charts and graphs',
        expectedOutcome: 'Visualizations sheet added',
        estimatedDuration: 1,
        dependsOn: [1],
      },
      {
        stepNumber: 4,
        description: 'Calculate summary statistics from data',
        action: 'sheets_analysis:statistics',
        params: { range: 'Data!A:Z' },
        rationale: 'Generate metrics for dashboard',
        expectedOutcome: 'Statistics calculated and ready for display',
        estimatedDuration: 3,
        dependsOn: [2],
      },
      {
        stepNumber: 5,
        description: 'Create trend visualization chart',
        action: 'sheets_charts:create',
        params: { type: 'LINE', sheetId: 'Visualizations' },
        rationale: 'Show trends over time',
        expectedOutcome: 'Line chart created with trend data',
        estimatedDuration: 2,
        optional: true,
        dependsOn: [3, 4],
      },
      {
        stepNumber: 6,
        description: 'Apply professional dashboard theme',
        action: 'sheets_format:apply_theme',
        params: { theme: 'dashboard' },
        rationale: 'Professional appearance with consistent styling',
        expectedOutcome: 'Dashboard styled with professional theme',
        estimatedDuration: 2,
        dependsOn: [1],
      },
    ];

    const risks: Risk[] = [
      {
        level: 'low',
        description: 'Chart creation may fail if data format is incompatible',
        mitigation: 'Step marked as optional, will not block dashboard creation',
      },
    ];

    return {
      id: planId,
      intent,
      title: 'Create Dashboard',
      description: 'Create a comprehensive dashboard with data, visualizations, and formatting',
      steps,
      risks,
      cost: {
        apiCalls: 6,
        quotaImpact: 12,
        cellsAffected: 0,
      },
      estimatedTime: 11,
      successCriteria: [
        'Spreadsheet created successfully',
        'At least 2 sheets added',
        'Theme applied successfully',
      ],
      rollbackStrategy: 'Delete created spreadsheet if critical steps fail',
      alternatives: [
        {
          description: 'Use existing spreadsheet instead of creating new one',
          reason: 'Faster if spreadsheet already exists',
        },
      ],
      tags: ['dashboard', 'visualization', 'creation'],
      createdAt: Date.now(),
    };
  }

  /**
   * Generate report creation plan
   */
  private generateReportPlan(
    planId: string,
    intent: string,
    context: PlanningContext
  ): OperationPlan {
    const steps: PlannedStep[] = [
      {
        stepNumber: 1,
        description: 'Calculate summary statistics',
        action: 'sheets_analysis:statistics',
        params: { range: context.spreadsheetId ? 'A:Z' : undefined },
        rationale: 'Generate key metrics for report',
        expectedOutcome: 'Summary statistics calculated',
        estimatedDuration: 3,
      },
      {
        stepNumber: 2,
        description: 'Generate insights and anomalies',
        action: 'sheets_analysis:insights',
        params: { range: context.spreadsheetId ? 'A:Z' : undefined },
        rationale: 'Add intelligence to the report',
        expectedOutcome: 'Insights and anomalies identified',
        estimatedDuration: 4,
        dependsOn: [1],
      },
      {
        stepNumber: 3,
        description: 'Create "Report" sheet',
        action: 'sheets_sheet:add',
        params: { title: 'Report Summary' },
        rationale: 'Dedicated sheet for report content',
        expectedOutcome: 'Report sheet created',
        estimatedDuration: 1,
      },
      {
        stepNumber: 4,
        description: 'Write report content with statistics and insights',
        action: 'sheets_values:write',
        params: { range: 'Report Summary!A1' },
        rationale: 'Populate report with findings',
        expectedOutcome: 'Report content written to sheet',
        estimatedDuration: 2,
        dependsOn: [1, 2, 3],
      },
      {
        stepNumber: 5,
        description: 'Apply report formatting',
        action: 'sheets_format:apply_theme',
        params: { theme: 'report', range: 'Report Summary!A:Z' },
        rationale: 'Professional report appearance',
        expectedOutcome: 'Report formatted with theme',
        estimatedDuration: 2,
        dependsOn: [4],
      },
    ];

    return {
      id: planId,
      intent,
      title: 'Generate Report',
      description: 'Create a comprehensive report with statistics, insights, and formatting',
      steps,
      risks: [],
      cost: {
        apiCalls: 5,
        quotaImpact: 10,
        cellsAffected: 100,
      },
      estimatedTime: 12,
      successCriteria: ['Statistics calculated', 'Report sheet created', 'Content written'],
      rollbackStrategy: 'Remove report sheet if creation fails',
      tags: ['report', 'analysis', 'insights'],
      createdAt: Date.now(),
    };
  }

  /**
   * Generate analysis plan
   */
  private generateAnalysisPlan(
    planId: string,
    intent: string,
    _context: PlanningContext
  ): OperationPlan {
    const steps: PlannedStep[] = [
      {
        stepNumber: 1,
        description: 'Perform data quality analysis',
        action: 'sheets_analysis:data_quality',
        params: { range: 'A:Z' },
        rationale: 'Identify data quality issues',
        expectedOutcome: 'Data quality report generated',
        estimatedDuration: 3,
      },
      {
        stepNumber: 2,
        description: 'Calculate statistical summary',
        action: 'sheets_analysis:statistics',
        params: { range: 'A:Z' },
        rationale: 'Generate key statistics',
        expectedOutcome: 'Statistics calculated',
        estimatedDuration: 2,
      },
      {
        stepNumber: 3,
        description: 'Detect patterns and correlations',
        action: 'sheets_analysis:correlations',
        params: { range: 'A:Z' },
        rationale: 'Find relationships in data',
        expectedOutcome: 'Correlations identified',
        estimatedDuration: 4,
        optional: true,
      },
    ];

    return {
      id: planId,
      intent,
      title: 'Analyze Data',
      description: 'Comprehensive data analysis with quality check, statistics, and correlations',
      steps,
      risks: [],
      cost: {
        apiCalls: 3,
        quotaImpact: 6,
      },
      estimatedTime: 9,
      successCriteria: ['Data quality analyzed', 'Statistics calculated'],
      tags: ['analysis', 'statistics'],
      createdAt: Date.now(),
    };
  }

  /**
   * Generate import plan
   */
  private generateImportPlan(
    planId: string,
    intent: string,
    _context: PlanningContext
  ): OperationPlan {
    return {
      id: planId,
      intent,
      title: 'Import and Process Data',
      description: 'Import data, detect types, and apply formatting',
      steps: [
        {
          stepNumber: 1,
          description: 'Import data to spreadsheet',
          action: 'sheets_values:append',
          params: {},
          rationale: 'Load data into spreadsheet',
          expectedOutcome: 'Data imported successfully',
          estimatedDuration: 3,
        },
        {
          stepNumber: 2,
          description: 'Detect column data types',
          action: 'sheets_analysis:detect_types',
          params: {},
          rationale: 'Understand data structure',
          expectedOutcome: 'Column types identified',
          estimatedDuration: 2,
          dependsOn: [1],
        },
        {
          stepNumber: 3,
          description: 'Apply automatic formatting',
          action: 'sheets_format:auto_format',
          params: {},
          rationale: 'Format based on detected types',
          expectedOutcome: 'Data formatted appropriately',
          estimatedDuration: 2,
          dependsOn: [2],
        },
      ],
      risks: [],
      cost: {
        apiCalls: 3,
        quotaImpact: 6,
      },
      estimatedTime: 7,
      successCriteria: ['Data imported', 'Types detected', 'Formatting applied'],
      tags: ['import', 'formatting'],
      createdAt: Date.now(),
    };
  }

  /**
   * Generate cleanup plan
   */
  private generateCleanupPlan(
    planId: string,
    intent: string,
    _context: PlanningContext
  ): OperationPlan {
    return {
      id: planId,
      intent,
      title: 'Clean and Fix Data',
      description: 'Analyze data quality and apply fixes',
      steps: [
        {
          stepNumber: 1,
          description: 'Analyze data quality',
          action: 'sheets_analysis:data_quality',
          params: {},
          rationale: 'Identify issues to fix',
          expectedOutcome: 'Issues identified',
          estimatedDuration: 3,
        },
        {
          stepNumber: 2,
          description: 'Apply suggested fixes',
          action: 'sheets_values:batch_write',
          params: {},
          rationale: 'Fix identified issues',
          expectedOutcome: 'Issues resolved',
          estimatedDuration: 3,
          dependsOn: [1],
        },
        {
          stepNumber: 3,
          description: 'Find and remove duplicates',
          action: 'sheets_analysis:find_duplicates',
          params: {},
          rationale: 'Eliminate duplicate rows',
          expectedOutcome: 'Duplicates removed',
          estimatedDuration: 2,
          optional: true,
        },
      ],
      risks: [
        {
          level: 'medium',
          description: 'Data modification may affect dependent formulas',
          mitigation: 'Snapshot created before execution for rollback',
        },
      ],
      cost: {
        apiCalls: 3,
        quotaImpact: 6,
      },
      estimatedTime: 8,
      successCriteria: ['Quality issues identified', 'Fixes applied'],
      rollbackStrategy: 'Restore from snapshot if fixes cause issues',
      tags: ['cleanup', 'data-quality'],
      createdAt: Date.now(),
    };
  }

  /**
   * Generate generic plan
   */
  private generateGenericPlan(
    planId: string,
    intent: string,
    _context: PlanningContext
  ): OperationPlan {
    return {
      id: planId,
      intent,
      title: 'Execute Operation',
      description: 'Generic operation based on user intent',
      steps: [
        {
          stepNumber: 1,
          description: 'Execute requested operation',
          action: 'generic:execute',
          params: { intent },
          rationale: 'Fulfill user request',
          expectedOutcome: 'Operation completed',
          estimatedDuration: 5,
        },
      ],
      risks: [],
      cost: {
        apiCalls: 1,
        quotaImpact: 2,
      },
      estimatedTime: 5,
      successCriteria: ['Operation completed'],
      tags: ['generic'],
      createdAt: Date.now(),
    };
  }

  /**
   * Validate and optimize a generated plan
   */
  private validateAndOptimize(plan: OperationPlan): OperationPlan {
    // Check step count
    if (plan.steps.length > this.maxSteps) {
      logger.warn('Plan exceeds maximum steps', {
        planId: plan.id,
        steps: plan.steps.length,
        maxSteps: this.maxSteps,
      });
    }

    // Check API calls
    if (plan.cost.apiCalls > this.maxApiCalls) {
      logger.warn('Plan exceeds maximum API calls', {
        planId: plan.id,
        apiCalls: plan.cost.apiCalls,
        maxApiCalls: this.maxApiCalls,
      });
    }

    // TODO: Implement optimization logic
    // - Combine similar steps
    // - Batch operations
    // - Parallelize independent steps

    return plan;
  }

  /**
   * Present plan for user confirmation
   */
  async presentForConfirmation(plan: OperationPlan): Promise<string> {
    const presentation = this.formatPlanPresentation(plan);

    if (this.verboseLogging) {
      logger.info('Presenting plan for confirmation', {
        planId: plan.id,
        title: plan.title,
      });
    }

    return presentation;
  }

  /**
   * Format plan as user-friendly presentation
   */
  private formatPlanPresentation(plan: OperationPlan): string {
    const lines: string[] = [];

    lines.push(`📋 Operation Plan: ${plan.title}`);
    lines.push('');
    lines.push(`Intent: "${plan.intent}"`);
    lines.push('');
    lines.push('Steps:');

    for (const step of plan.steps) {
      const optional = step.optional ? ' (optional)' : '';
      lines.push(`  ${step.stepNumber}. ${step.description}${optional}`);
      if (step.rationale) {
        lines.push(`     → ${step.rationale}`);
      }
    }

    lines.push('');
    lines.push(`⏱️  Estimated time: ${plan.estimatedTime}s`);
    lines.push(`📊 API calls: ${plan.cost.apiCalls}`);

    if (plan.risks.length > 0) {
      lines.push('');
      lines.push('⚠️  Risks:');
      for (const risk of plan.risks) {
        lines.push(`  • [${risk.level.toUpperCase()}] ${risk.description}`);
        if (risk.mitigation) {
          lines.push(`    Mitigation: ${risk.mitigation}`);
        }
      }
    }

    if (plan.rollbackStrategy) {
      lines.push('');
      lines.push(`🔄 Rollback: ${plan.rollbackStrategy}`);
    }

    lines.push('');
    lines.push('Confirm? [Yes] [Modify] [Cancel]');

    return lines.join('\n');
  }

  /**
   * Execute an operation plan
   */
  async execute(plan: OperationPlan): Promise<PlanExecutionResult> {
    this.stats.totalExecutions++;
    this.stats.plansExecuted++;

    const startTime = Date.now();
    let snapshotId: string | undefined;
    let rolledBack = false;

    if (this.verboseLogging) {
      logger.info('Executing plan', {
        planId: plan.id,
        title: plan.title,
        steps: plan.steps.length,
      });
    }

    // Create snapshot if enabled
    if (this.autoSnapshot) {
      snapshotId = await this.createSnapshot(plan);
    }

    const stepResults: PlannedStepResult[] = [];

    try {
      for (const step of plan.steps) {
        const stepResult = await this.executeStep(step, plan);
        stepResults.push(stepResult);

        if (!stepResult.success && !step.optional) {
          // Non-optional step failed, stop execution
          throw stepResult.error || new Error(`Step ${step.stepNumber} failed`);
        }

        if (this.verboseLogging) {
          logger.debug('Step completed', {
            stepNumber: step.stepNumber,
            success: stepResult.success,
            duration: stepResult.duration,
          });
        }
      }

      this.stats.successfulExecutions++;

      return {
        planId: plan.id,
        planTitle: plan.title,
        success: true,
        stepResults,
        duration: Date.now() - startTime,
        snapshotId,
        outcome: `Successfully executed ${stepResults.filter((r) => r.success).length} steps`,
      };
    } catch (error) {
      this.stats.failedExecutions++;

      // Auto-rollback if enabled
      if (this.autoRollback && snapshotId) {
        await this.rollback(snapshotId);
        rolledBack = true;
        this.stats.rollbackCount++;
      }

      logger.error('Plan execution failed', {
        planId: plan.id,
        error: error instanceof Error ? error.message : String(error),
        rolledBack,
      });

      return {
        planId: plan.id,
        planTitle: plan.title,
        success: false,
        stepResults,
        duration: Date.now() - startTime,
        snapshotId,
        rolledBack,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      const duration = Date.now() - startTime;
      this.stats.executionDurations.push(duration);
    }
  }

  /**
   * Execute a single plan step
   */
  private async executeStep(step: PlannedStep, _plan: OperationPlan): Promise<PlannedStepResult> {
    const startTime = Date.now();

    try {
      // TODO: Integrate with actual tool handlers
      // For now, simulate execution
      const result = await this.simulateStepExecution(step);

      return {
        stepNumber: step.stepNumber,
        description: step.description,
        action: step.action,
        success: true,
        result,
        duration: Date.now() - startTime,
        actualOutcome: step.expectedOutcome,
      };
    } catch (error) {
      return {
        stepNumber: step.stepNumber,
        description: step.description,
        action: step.action,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Simulate step execution (placeholder)
   */
  private async simulateStepExecution(step: PlannedStep): Promise<unknown> {
    logger.debug('Simulating step execution', {
      stepNumber: step.stepNumber,
      action: step.action,
    });

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    return { simulated: true, step: step.stepNumber };
  }

  /**
   * Create snapshot before plan execution
   */
  private async createSnapshot(plan: OperationPlan): Promise<string> {
    const snapshotId = uuid();

    logger.info('Creating snapshot', {
      snapshotId,
      planId: plan.id,
    });

    // TODO: Integrate with snapshot service
    // For now, return simulated snapshot ID

    return snapshotId;
  }

  /**
   * Rollback to snapshot
   */
  private async rollback(snapshotId: string): Promise<void> {
    logger.info('Rolling back to snapshot', { snapshotId });

    // TODO: Integrate with snapshot service
    // For now, simulate rollback

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Get default available tools
   */
  private getDefaultTools(): AvailableTool[] {
    return [
      {
        name: 'sheets_spreadsheet',
        description: 'Spreadsheet operations',
        actions: {
          create: 'Create spreadsheet',
          get: 'Get spreadsheet',
          update: 'Update spreadsheet',
        },
        estimatedCost: 1,
      },
      {
        name: 'sheets_sheet',
        description: 'Sheet operations',
        actions: {
          add: 'Add sheet',
          delete: 'Delete sheet',
          rename: 'Rename sheet',
        },
        estimatedCost: 1,
      },
      {
        name: 'sheets_values',
        description: 'Value operations',
        actions: {
          read: 'Read values',
          write: 'Write values',
          append: 'Append values',
          batch_write: 'Batch write',
        },
        estimatedCost: 1,
      },
      {
        name: 'sheets_analysis',
        description: 'Analysis operations',
        actions: {
          statistics: 'Calculate statistics',
          data_quality: 'Analyze data quality',
          insights: 'Generate insights',
        },
        estimatedCost: 2,
      },
      {
        name: 'sheets_format',
        description: 'Formatting operations',
        actions: {
          apply_theme: 'Apply theme',
          auto_format: 'Auto format',
        },
        estimatedCost: 1,
      },
    ];
  }

  /**
   * Modify an existing plan
   */
  async modifyPlan(plan: OperationPlan, modification: PlanModification): Promise<OperationPlan> {
    logger.info('Modifying plan', {
      planId: plan.id,
      modificationType: modification.type,
    });

    // TODO: Implement plan modification logic
    // For now, return original plan

    return plan;
  }

  /**
   * Get planning agent statistics
   */
  getStats(): PlanningAgentStats {
    const avgExecutionDuration =
      this.stats.executionDurations.length > 0
        ? this.stats.executionDurations.reduce((a, b) => a + b, 0) /
          this.stats.executionDurations.length
        : 0;

    const avgPlanComplexity =
      this.stats.planComplexities.length > 0
        ? this.stats.planComplexities.reduce((a, b) => a + b, 0) / this.stats.planComplexities.length
        : 0;

    const successRate =
      this.stats.totalExecutions > 0
        ? (this.stats.successfulExecutions / this.stats.totalExecutions) * 100
        : 0;

    const acceptanceRate =
      this.stats.plansGenerated > 0
        ? (this.stats.plansExecuted / this.stats.plansGenerated) * 100
        : 0;

    return {
      totalPlans: this.stats.totalPlans,
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      failedExecutions: this.stats.failedExecutions,
      rollbackCount: this.stats.rollbackCount,
      successRate,
      avgPlanComplexity,
      avgExecutionDuration,
      apiCallsSaved: this.stats.successfulExecutions * 3, // Rough estimate
      acceptanceRate,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalPlans: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      rollbackCount: 0,
      executionDurations: [],
      planComplexities: [],
      plansGenerated: 0,
      plansExecuted: 0,
    };
  }
}

// Singleton instance
let planningAgent: PlanningAgent | null = null;

/**
 * Get or create the planning agent singleton
 */
export function getPlanningAgent(): PlanningAgent {
  if (!planningAgent) {
    planningAgent = new PlanningAgent({
      enabled: process.env['PLANNING_ENABLED'] !== 'false',
      maxSteps: parseInt(process.env['PLANNING_MAX_STEPS'] || '10', 10),
      maxApiCalls: parseInt(process.env['PLANNING_MAX_API_CALLS'] || '50', 10),
      requireConfirmation: process.env['PLANNING_REQUIRE_CONFIRMATION'] !== 'false',
      autoSnapshot: process.env['PLANNING_AUTO_SNAPSHOT'] !== 'false',
      autoRollback: process.env['PLANNING_AUTO_ROLLBACK'] !== 'false',
      verboseLogging: process.env['PLANNING_VERBOSE'] === 'true',
    });
  }
  return planningAgent;
}

/**
 * Set the planning agent (for testing or custom configuration)
 */
export function setPlanningAgent(agent: PlanningAgent): void {
  planningAgent = agent;
}
