/**
 * ServalSheets - Agent Execution Engine
 *
 * Autonomous execution of multi-step plans for spreadsheet operations.
 *
 * Converts natural language descriptions into executable plans, manages
 * plan state (DRAFT → EXECUTING → COMPLETED/PAUSED/FAILED), creates
 * checkpoints for observability, and supports resumable execution.
 *
 * Design: Stateless module-level functions with in-memory plan store.
 * Max capacity: 100 plans (evicts oldest when full).
 */

import { randomUUID } from 'crypto';
import { writeFile, readFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { assertSamplingConsent as assertGlobalSamplingConsent } from '../mcp/sampling.js';
import { logger } from '../utils/logger.js';
import { getRequestContext } from '../utils/request-context.js';

interface SamplingTextContent {
  type: 'text';
  text: string;
}

interface SamplingMessage {
  role: 'user' | 'assistant';
  content: SamplingTextContent;
}

interface SamplingCreateMessageResult {
  content:
    | SamplingTextContent
    | SamplingTextContent[]
    | Array<{
        type: string;
        text?: string;
      }>;
}

export interface SamplingServer {
  createMessage(params: {
    messages: SamplingMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    modelPreferences?: { hints?: Array<{ name: string }> };
    temperature?: number;
  }): Promise<SamplingCreateMessageResult>;
}

type ConsentChecker = (() => Promise<void>) | undefined;
let _consentChecker: ConsentChecker;
const SAMPLING_TIMEOUT_MS = parseInt(process.env['SAMPLING_TIMEOUT_MS'] ?? '30000', 10);

function withSamplingTimeout<T>(promise: Promise<T>): Promise<T> {
  const context = getRequestContext();
  const effectiveTimeout = context
    ? Math.min(SAMPLING_TIMEOUT_MS, Math.max(0, context.deadline - Date.now()))
    : SAMPLING_TIMEOUT_MS;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Sampling request timed out after ${effectiveTimeout}ms`)),
      effectiveTimeout
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function assertSamplingConsent(): Promise<void> {
  if (_consentChecker) {
    await _consentChecker();
    return;
  }
  await assertGlobalSamplingConsent();
}

function createUserMessage(text: string): SamplingMessage {
  return {
    role: 'user',
    content: { type: 'text', text },
  };
}

function extractTextFromResult(result: SamplingCreateMessageResult): string {
  const content = Array.isArray(result.content) ? result.content : [result.content];
  return content
    .filter((block): block is { type: string; text?: string } => block?.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim();
}

function getModelHint(operationType: string): {
  hints: Array<{ name: string }>;
  temperature: number;
} {
  if (operationType === 'agentPlanning') {
    return {
      hints: [{ name: 'claude-sonnet-4-latest' }],
      temperature: 0.2,
    };
  }
  return {
    hints: [{ name: 'claude-3-5-haiku-latest' }],
    temperature: 0.3,
  };
}

// ============================================================================
// Types
// ============================================================================

export type PlanStatus = 'draft' | 'executing' | 'completed' | 'paused' | 'failed';

export interface ExecutionStep {
  stepId: string;
  tool: string;
  action: string;
  params: Record<string, unknown>;
  description: string;
  dependsOn?: string[];
}

export interface StepResult {
  stepId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  startedAt: string;
  completedAt: string;
}

export interface Checkpoint {
  checkpointId: string;
  planId: string;
  stepIndex: number;
  context?: string;
  timestamp: string;
  snapshotId?: string;
}

export interface PlanState {
  planId: string;
  description: string;
  steps: ExecutionStep[];
  status: PlanStatus;
  results: StepResult[];
  checkpoints: Checkpoint[];
  createdAt: string;
  updatedAt: string;
  currentStepIndex: number;
  error?: string;
}

export type ExecuteHandlerFn = (
  tool: string,
  action: string,
  params: Record<string, unknown>
) => Promise<unknown>;

// ============================================================================
// Workflow Templates (P2.2)
// ============================================================================

export interface WorkflowTemplate {
  name: string;
  description: string;
  steps: Array<{
    tool: string;
    action: string;
    description: string;
    paramTemplate: Record<string, string>;
  }>;
}

const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  'setup-new-sheet': {
    name: 'Setup New Sheet',
    description: 'Create a professional spreadsheet with headers, formatting, and frozen rows',
    steps: [
      {
        tool: 'sheets_data',
        action: 'write',
        description: 'Write headers',
        paramTemplate: { range: 'A1' },
      },
      {
        tool: 'sheets_format',
        action: 'set_format',
        description: 'Format header row bold',
        paramTemplate: { range: 'A1:Z1' },
      },
      {
        tool: 'sheets_dimensions',
        action: 'freeze',
        description: 'Freeze header row',
        paramTemplate: { position: '1', dimension: 'ROWS' },
      },
      {
        tool: 'sheets_dimensions',
        action: 'auto_resize',
        description: 'Auto-resize columns',
        paramTemplate: { dimension: 'COLUMNS' },
      },
    ],
  },
  'data-quality-check': {
    name: 'Data Quality Check',
    description: 'Run comprehensive data quality analysis and suggest fixes',
    steps: [
      {
        tool: 'sheets_analyze',
        action: 'scout',
        description: 'Quick scan of sheet structure',
        paramTemplate: {},
      },
      {
        tool: 'sheets_fix',
        action: 'suggest_cleaning',
        description: 'Detect data quality issues',
        paramTemplate: {},
      },
      {
        tool: 'sheets_fix',
        action: 'detect_anomalies',
        description: 'Find statistical outliers',
        paramTemplate: {},
      },
      {
        tool: 'sheets_analyze',
        action: 'suggest_next_actions',
        description: 'Recommend improvements',
        paramTemplate: {},
      },
    ],
  },
  'monthly-report': {
    name: 'Monthly Report',
    description: 'Generate a formatted monthly report with charts and summary',
    steps: [
      {
        tool: 'sheets_data',
        action: 'read',
        description: 'Read source data',
        paramTemplate: {},
      },
      {
        tool: 'sheets_compute',
        action: 'aggregate',
        description: 'Compute summary statistics',
        paramTemplate: {},
      },
      {
        tool: 'sheets_visualize',
        action: 'chart_create',
        description: 'Create summary chart',
        paramTemplate: { chartType: 'BAR' },
      },
      {
        tool: 'sheets_format',
        action: 'apply_preset',
        description: 'Apply professional formatting',
        paramTemplate: { preset: 'professional' },
      },
    ],
  },
  'import-and-clean': {
    name: 'Import and Clean',
    description: 'Import CSV data, clean it, and format for analysis',
    steps: [
      {
        tool: 'sheets_composite',
        action: 'import_csv',
        description: 'Import CSV data',
        paramTemplate: {},
      },
      {
        tool: 'sheets_fix',
        action: 'clean',
        description: 'Auto-clean common data issues',
        paramTemplate: {},
      },
      {
        tool: 'sheets_fix',
        action: 'standardize_formats',
        description: 'Standardize date and number formats',
        paramTemplate: {},
      },
      {
        tool: 'sheets_dimensions',
        action: 'auto_resize',
        description: 'Resize columns to fit',
        paramTemplate: { dimension: 'COLUMNS' },
      },
      {
        tool: 'sheets_dimensions',
        action: 'freeze',
        description: 'Freeze header row',
        paramTemplate: { position: '1', dimension: 'ROWS' },
      },
    ],
  },
  'scenario-analysis': {
    name: 'Scenario Analysis',
    description: 'Build dependency graph and model what-if scenarios',
    steps: [
      {
        tool: 'sheets_dependencies',
        action: 'build',
        description: 'Build formula dependency graph',
        paramTemplate: {},
      },
      {
        tool: 'sheets_dependencies',
        action: 'detect_cycles',
        description: 'Check for circular references',
        paramTemplate: {},
      },
      {
        tool: 'sheets_dependencies',
        action: 'model_scenario',
        description: 'Model scenario impact',
        paramTemplate: {},
      },
    ],
  },
  'dedup-and-sort': {
    name: 'Deduplicate and Sort',
    description: 'Remove duplicates, sort data, and apply formatting',
    steps: [
      {
        tool: 'sheets_composite',
        action: 'deduplicate',
        description: 'Remove duplicate rows',
        paramTemplate: {},
      },
      {
        tool: 'sheets_dimensions',
        action: 'sort_range',
        description: 'Sort data by key column',
        paramTemplate: {},
      },
      {
        tool: 'sheets_format',
        action: 'apply_preset',
        description: 'Apply clean formatting',
        paramTemplate: { preset: 'clean' },
      },
    ],
  },
};

// ============================================================================
// Plan Persistence (P2.3)
// ============================================================================

const PLAN_STORAGE_DIR =
  process.env['AGENT_PLAN_DIR'] || path.join(process.cwd(), '.serval', 'plans');

async function ensurePlanDir(): Promise<void> {
  if (!existsSync(PLAN_STORAGE_DIR)) {
    await mkdir(PLAN_STORAGE_DIR, { recursive: true });
  }
}

async function persistPlan(plan: PlanState): Promise<void> {
  try {
    await ensurePlanDir();
    const filePath = path.join(PLAN_STORAGE_DIR, `${plan.planId}.json`);
    await writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8');
  } catch (err) {
    logger.debug('Failed to persist plan', {
      planId: plan.planId,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}

async function loadPersistedPlans(): Promise<void> {
  try {
    await ensurePlanDir();
    const { readdir } = await import('fs/promises');
    const files = await readdir(PLAN_STORAGE_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(path.join(PLAN_STORAGE_DIR, file), 'utf-8');
        const plan = JSON.parse(content) as PlanState;
        if (plan.planId && !planStore.has(plan.planId)) {
          planStore.set(plan.planId, plan);
        }
      } catch {
        // Skip corrupt files
      }
    }
  } catch (err) {
    logger.debug('Failed to load persisted plans', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}

async function deletePersistedPlan(planId: string): Promise<void> {
  try {
    const filePath = path.join(PLAN_STORAGE_DIR, `${planId}.json`);
    await unlink(filePath);
  } catch {
    // File may not exist
  }
}

/**
 * Initialize the plan store by loading previously persisted plans.
 * Call this during server startup.
 */
export async function initializePlanStore(): Promise<void> {
  await loadPersistedPlans();
}

// ============================================================================
// Sampling Server (AI-powered plan generation)
// ============================================================================

let _samplingServer: SamplingServer | undefined;

/**
 * Register the sampling server for AI-powered plan generation.
 * Optional — if not provided, falls back to regex-based planning.
 */
export function setAgentSamplingServer(server: SamplingServer | undefined): void {
  _samplingServer = server;
}

/**
 * Optional consent checker invoked before AI sampling requests.
 * Keeps consent enforcement pluggable without coupling service layer to MCP internals.
 */
export function setAgentSamplingConsentChecker(checker: ConsentChecker): void {
  _consentChecker = checker;
}

// ============================================================================
// Plan Store
// ============================================================================

const planStore = new Map<string, PlanState>();
const MAX_PLANS = 100;

function evictOldestPlan(): void {
  if (planStore.size >= MAX_PLANS) {
    let oldest: { key: string; time: string } | null = null;
    for (const [key, plan] of planStore) {
      if (!oldest || plan.createdAt < oldest.time) {
        oldest = { key, time: plan.createdAt };
      }
    }
    if (oldest) {
      planStore.delete(oldest.key);
    }
  }
}

// ============================================================================
// AI-Powered Plan Generation
// ============================================================================

/**
 * Use MCP Sampling to generate semantically intelligent execution steps.
 * Falls back to undefined if sampling is unavailable or fails.
 */
async function aiParsePlan(
  description: string,
  spreadsheetId?: string,
  context?: string,
  maxSteps?: number
): Promise<ExecutionStep[] | undefined> {
  if (!_samplingServer) return undefined;

  try {
    await assertSamplingConsent();

    const systemPrompt = `You are a task planning expert for spreadsheet operations.
Given a user's description, generate a step-by-step execution plan.
Each step must reference a specific ServalSheets tool and action (e.g., sheets_data.read, sheets_format.set_format).
Include required parameters for each step. Order steps by dependency.
Return a JSON array of plan steps: [{ tool, action, params, description }].

Available tools and their key actions:
- sheets_data: read, write, append, clear, find_replace, cross_read, cross_query, cross_write, cross_compare
- sheets_format: set_format, set_background, set_text_format, set_number_format, apply_preset, set_borders, clear_format, batch_format, set_rich_text
- sheets_dimensions: sort_range, freeze, insert, delete, auto_resize, hide, show, group, ungroup, set_basic_filter, clear_basic_filter
- sheets_visualize: chart_create, chart_update, pivot_create, pivot_update, suggest_chart, suggest_pivot
- sheets_analyze: comprehensive, scout, analyze_data, detect_patterns, suggest_next_actions, auto_enhance, discover_action
- sheets_fix: clean, standardize_formats, fill_missing, detect_anomalies, suggest_cleaning, fix
- sheets_compute: aggregate, statistical, forecast, regression, evaluate
- sheets_composite: import_csv, deduplicate, setup_sheet, generate_sheet, import_xlsx, export_xlsx, bulk_update, data_pipeline
- sheets_history: timeline, diff_revisions, restore_cells, undo, redo
- sheets_dependencies: build, model_scenario, compare_scenarios, analyze_impact
- sheets_core: create, get, add_sheet, delete_sheet, list, update_properties

Return ONLY valid JSON array, no markdown code blocks, no explanation.
Maximum ${maxSteps || 10} steps.`;

    let prompt = `Plan steps for: "${description}"`;
    if (spreadsheetId) prompt += `\nTarget spreadsheet ID: ${spreadsheetId}`;
    if (context) prompt += `\nAdditional context: ${context}`;

    const modelHint = getModelHint('agentPlanning');
    const result = await withSamplingTimeout(
      _samplingServer.createMessage({
        messages: [createUserMessage(prompt)],
        systemPrompt,
        maxTokens: 1500,
        modelPreferences: { hints: modelHint.hints },
        temperature: modelHint.temperature,
      })
    );

    const text = extractTextFromResult(result);
    if (!text) return undefined; // OK: LLM sampling may return empty on failure

    // Parse JSON from response, handling markdown code blocks
    const jsonStr = text
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) return undefined; // OK: Validation guard for LLM output format

    return parsed.slice(0, maxSteps || 10).map(
      (
        step: {
          tool?: string;
          action?: string;
          params?: Record<string, unknown>;
          description?: string;
        },
        i: number
      ) => ({
        stepId: `step-${i + 1}`,
        tool: String(step.tool || 'sheets_analyze'),
        action: String(step.action || 'comprehensive'),
        params: {
          ...(typeof step.params === 'object' && step.params ? step.params : {}),
          ...(spreadsheetId ? { spreadsheetId } : {}),
        },
        description: String(step.description || `Step ${i + 1}`),
        dependsOn: i > 0 ? [`step-${i}`] : undefined,
      })
    );
  } catch (err) {
    logger.debug('AI plan generation failed, falling back to regex', {
      description: description.slice(0, 100),
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return undefined;
  }
}

// ============================================================================
// Plan Compilation
// ============================================================================

/**
 * Parse natural language description into execution steps.
 * Supports common patterns like "read", "write", "format", "sort", etc.
 */
function parseDescription(
  description: string
): Array<{ tool: string; action: string; label: string }> {
  const lower = description.toLowerCase();
  const steps: Array<{ tool: string; action: string; label: string }> = [];

  // Pattern matching for common operations
  const patterns: Array<{
    regex: RegExp;
    tool: string;
    action: string;
    label: string;
  }> = [
    {
      regex: /\b(read|get|fetch)\b/i,
      tool: 'sheets_data',
      action: 'read',
      label: 'Read data',
    },
    {
      regex: /\b(write|update|set|put)\b/i,
      tool: 'sheets_data',
      action: 'write',
      label: 'Write data',
    },
    {
      regex: /\b(format|style|color|bold|italic)\b/i,
      tool: 'sheets_format',
      action: 'set_format',
      label: 'Apply formatting',
    },
    {
      regex: /\b(sort|order|rank)\b/i,
      tool: 'sheets_dimensions',
      action: 'sort_range',
      label: 'Sort data',
    },
    {
      regex: /\b(chart|graph|plot|visualize)\b/i,
      tool: 'sheets_visualize',
      action: 'chart_create',
      label: 'Create chart',
    },
    {
      regex: /\b(delete|remove)\b/i,
      tool: 'sheets_dimensions',
      action: 'delete',
      label: 'Delete rows/columns',
    },
    {
      regex: /\b(freeze|pin)\b/i,
      tool: 'sheets_dimensions',
      action: 'freeze',
      label: 'Freeze rows/columns',
    },
    {
      regex: /\b(merge)\b/i,
      tool: 'sheets_data',
      action: 'merge_cells',
      label: 'Merge cells',
    },
    {
      regex: /\b(filter|filter view)\b/i,
      tool: 'sheets_dimensions',
      action: 'set_basic_filter',
      label: 'Apply filter',
    },
    {
      regex: /\b(analyze|summarize|summary)\b/i,
      tool: 'sheets_analyze',
      action: 'comprehensive',
      label: 'Analyze data',
    },
    {
      regex: /\b(compute|calculate|aggregate)\b/i,
      tool: 'sheets_analyze',
      action: 'analyze_data',
      label: 'Compute metrics',
    },
    {
      regex: /\b(clean|fix|repair|standardize)\b/i,
      tool: 'sheets_fix',
      action: 'clean',
      label: 'Clean data',
    },
  ];

  // Detect multiple operations
  for (const pattern of patterns) {
    if (pattern.regex.test(lower)) {
      steps.push(pattern);
    }
  }

  // Fallback: if no patterns matched, use comprehensive analysis
  if (steps.length === 0) {
    steps.push({
      tool: 'sheets_analyze',
      action: 'comprehensive',
      label: 'Analyze data',
    });
  }

  return steps;
}

/**
 * Compile a natural language description into a plan using AI if available.
 * Tries AI-powered planning first, falls back to regex-based planning if AI unavailable or fails.
 * Returns PlanState in 'draft' status with generated steps.
 */
export async function compilePlanAI(
  description: string,
  maxSteps: number = 10,
  spreadsheetId?: string,
  context?: string
): Promise<PlanState> {
  const planId = randomUUID();
  const now = new Date().toISOString();

  // Try AI-powered planning first
  let steps: ExecutionStep[] | undefined;
  try {
    const aiSteps = await aiParsePlan(description, spreadsheetId, context, maxSteps);
    if (aiSteps && aiSteps.length > 0) {
      steps = aiSteps;
    }
  } catch (err) {
    logger.debug('AI plan compilation error', {
      description: description.slice(0, 100),
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  // Fall back to regex-based planning if AI failed
  if (!steps || steps.length === 0) {
    const parsedSteps = parseDescription(description).slice(0, maxSteps);
    steps = parsedSteps.map((step, idx) => ({
      stepId: `${planId}-step-${idx}`,
      tool: step.tool,
      action: step.action,
      description: step.label,
      params: {
        ...(spreadsheetId && { spreadsheetId }),
        ...(context && { context }),
      },
    }));
  }

  const plan: PlanState = {
    planId,
    description,
    steps,
    status: 'draft',
    results: [],
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
    currentStepIndex: 0,
  };

  evictOldestPlan();
  planStore.set(planId, plan);
  persistPlan(plan).catch(() => {});

  return plan;
}

/**
 * Compile a natural language description into a plan (regex-based only).
 * Returns PlanState in 'draft' status with generated steps.
 * Use compilePlanAI() for AI-powered planning that falls back to regex.
 */
export function compilePlan(
  description: string,
  maxSteps: number = 10,
  spreadsheetId?: string,
  context?: string
): PlanState {
  const planId = randomUUID();
  const now = new Date().toISOString();

  const parsedSteps = parseDescription(description).slice(0, maxSteps);

  const steps: ExecutionStep[] = parsedSteps.map((step, idx) => ({
    stepId: `${planId}-step-${idx}`,
    tool: step.tool,
    action: step.action,
    description: step.label,
    params: {
      ...(spreadsheetId && { spreadsheetId }),
      ...(context && { context }),
    },
  }));

  const plan: PlanState = {
    planId,
    description,
    steps,
    status: 'draft',
    results: [],
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
    currentStepIndex: 0,
  };

  evictOldestPlan();
  planStore.set(planId, plan);
  persistPlan(plan).catch(() => {});

  return plan;
}

/**
 * Compile a plan from a pre-built workflow template.
 * Returns PlanState in 'draft' status with template steps.
 */
export function compileFromTemplate(
  templateName: string,
  spreadsheetId: string,
  overrides?: Record<string, unknown>
): PlanState | undefined {
  const template = WORKFLOW_TEMPLATES[templateName];
  if (!template) return undefined;

  const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const steps: ExecutionStep[] = template.steps.map((step, i) => ({
    stepId: `step-${i + 1}`,
    tool: step.tool,
    action: step.action,
    description: step.description,
    params: { spreadsheetId, ...step.paramTemplate, ...(overrides || {}) },
    dependsOn: i > 0 ? [`step-${i}`] : undefined,
  }));

  const plan: PlanState = {
    planId,
    description: `${template.name}: ${template.description}`,
    steps,
    status: 'draft',
    results: [],
    checkpoints: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStepIndex: 0,
  };

  if (planStore.size >= MAX_PLANS) evictOldestPlan();
  planStore.set(planId, plan);
  persistPlan(plan).catch(() => {});

  return plan;
}

/**
 * List all available workflow templates with their metadata.
 */
export function listTemplates(): Array<{
  name: string;
  description: string;
  stepCount: number;
}> {
  return Object.entries(WORKFLOW_TEMPLATES).map(([_key, t]) => ({
    name: t.name,
    description: t.description,
    stepCount: t.steps.length,
  }));
}

// ============================================================================
// Plan Execution
// ============================================================================

/**
 * Execute all steps in a plan sequentially.
 * Creates checkpoints before each step, records results.
 * On error: pauses execution, records error.
 */
export async function executePlan(
  planId: string,
  dryRun: boolean,
  executeHandler: ExecuteHandlerFn
): Promise<PlanState> {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (dryRun) {
    // Preview execution without actual tool calls
    const now = new Date().toISOString();
    const previewResults: StepResult[] = plan.steps.map((step) => ({
      stepId: step.stepId,
      success: true,
      result: { dryRunPreview: true, action: step.action },
      startedAt: now,
      completedAt: now,
    }));

    plan.status = 'completed';
    plan.results = previewResults;
    plan.updatedAt = now;
    planStore.set(planId, plan);
    return plan;
  }

  // Real execution
  const now = new Date().toISOString();
  plan.status = 'executing';
  plan.updatedAt = now;

  for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step) continue; // Safety: skip if step is undefined
    const startTime = new Date().toISOString();

    // Create checkpoint before step
    createCheckpoint(planId, `Before step: ${step.description}`);

    try {
      const result = await executeHandler(step.tool, step.action, step.params);

      const stepResult: StepResult = {
        stepId: step.stepId,
        success: true,
        result,
        startedAt: startTime,
        completedAt: new Date().toISOString(),
      };

      plan.results.push(stepResult);
      plan.currentStepIndex = i + 1;
      plan.updatedAt = new Date().toISOString();
      planStore.set(planId, plan);
      persistPlan(plan).catch(() => {});
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      const stepResult: StepResult = {
        stepId: step.stepId,
        success: false,
        error,
        startedAt: startTime,
        completedAt: new Date().toISOString(),
      };

      plan.results.push(stepResult);
      plan.status = 'paused';
      plan.error = error;
      plan.updatedAt = new Date().toISOString();
      planStore.set(planId, plan);
      persistPlan(plan).catch(() => {});
      return plan;
    }
  }

  plan.status = 'completed';
  plan.updatedAt = new Date().toISOString();
  planStore.set(planId, plan);
  persistPlan(plan).catch(() => {});
  return plan;
}

/**
 * Execute a single step from an existing plan.
 */
export async function executeStep(
  planId: string,
  stepId: string,
  executeHandler: ExecuteHandlerFn
): Promise<StepResult> {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const step = plan.steps.find((s) => s.stepId === stepId);
  if (!step) {
    throw new Error(`Step ${stepId} not found in plan ${planId}`);
  }

  const startTime = new Date().toISOString();
  createCheckpoint(planId, `Execute step: ${step.description}`);

  try {
    const result = await executeHandler(step.tool, step.action, step.params);

    const stepResult: StepResult = {
      stepId,
      success: true,
      result,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
    };

    // Update plan results
    const existingIdx = plan.results.findIndex((r) => r.stepId === stepId);
    if (existingIdx >= 0) {
      plan.results[existingIdx] = stepResult;
    } else {
      plan.results.push(stepResult);
    }
    plan.updatedAt = new Date().toISOString();
    planStore.set(planId, plan);
    persistPlan(plan).catch(() => {});

    return stepResult;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    const stepResult: StepResult = {
      stepId,
      success: false,
      error,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
    };

    plan.error = error;
    plan.updatedAt = new Date().toISOString();
    planStore.set(planId, plan);
    persistPlan(plan).catch(() => {});

    return stepResult;
  }
}

// ============================================================================
// Checkpoints
// ============================================================================

/**
 * Create an observation checkpoint at current plan state.
 */
export function createCheckpoint(
  planId: string,
  context?: string,
  snapshotId?: string
): Checkpoint {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const checkpoint: Checkpoint = {
    checkpointId: randomUUID(),
    planId,
    stepIndex: plan.currentStepIndex,
    context,
    timestamp: new Date().toISOString(),
    snapshotId,
  };

  plan.checkpoints.push(checkpoint);
  plan.updatedAt = new Date().toISOString();
  planStore.set(planId, plan);
  persistPlan(plan).catch(() => {});

  return checkpoint;
}

/**
 * Revert plan state to a specific checkpoint.
 * Removes results after checkpoint and sets status to 'paused'.
 */
export function rollbackToPlan(planId: string, checkpointId: string): PlanState {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const checkpoint = plan.checkpoints.find((c) => c.checkpointId === checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found in plan ${planId}`);
  }

  // Remove results after checkpoint
  const resultsToKeep = plan.results.filter((r) => {
    const stepIdx = plan.steps.findIndex((s) => s.stepId === r.stepId);
    return stepIdx < checkpoint.stepIndex;
  });

  plan.results = resultsToKeep;
  plan.currentStepIndex = checkpoint.stepIndex;
  plan.status = 'paused';
  plan.error = undefined;
  plan.updatedAt = new Date().toISOString();
  planStore.set(planId, plan);
  persistPlan(plan).catch(() => {});

  return plan;
}

// ============================================================================
// Plan Queries
// ============================================================================

/**
 * Get status of a specific plan.
 */
export function getPlanStatus(planId: string): PlanState | undefined {
  return planStore.get(planId);
}

/**
 * List all plans with optional filtering.
 */
export function listPlans(limit: number = 50, statusFilter?: PlanStatus): PlanState[] {
  const plans = Array.from(planStore.values());

  if (statusFilter) {
    return plans
      .filter((p) => p.status === statusFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  return plans
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/**
 * Resume execution from a paused plan.
 * If fromStepId provided, resume from that step.
 * Otherwise resume from where it paused.
 */
export async function resumePlan(
  planId: string,
  fromStepId: string | undefined,
  executeHandler: ExecuteHandlerFn
): Promise<PlanState> {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (plan.status !== 'paused') {
    throw new Error(`Plan ${planId} is not paused (status: ${plan.status})`);
  }

  // Determine resume position
  if (fromStepId) {
    const stepIdx = plan.steps.findIndex((s) => s.stepId === fromStepId);
    if (stepIdx < 0) {
      throw new Error(`Step ${fromStepId} not found in plan ${planId}`);
    }
    plan.currentStepIndex = stepIdx;
  }

  // Resume execution
  return executePlan(planId, false, executeHandler);
}

// ============================================================================
// Plan Deletion
// ============================================================================

/**
 * Delete a plan from the store.
 */
export function deletePlan(planId: string): boolean {
  const deleted = planStore.delete(planId);
  if (deleted) {
    deletePersistedPlan(planId).catch(() => {});
  }
  return deleted;
}

/**
 * Clear all plans from the store.
 */
export async function clearAllPlans(): Promise<void> {
  planStore.clear();
  try {
    await ensurePlanDir();
    const { readdir } = await import('fs/promises');
    const files = await readdir(PLAN_STORAGE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await unlink(path.join(PLAN_STORAGE_DIR, file)).catch(() => {});
      }
    }
  } catch (err) {
    logger.debug('Failed to clear persisted plans', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
