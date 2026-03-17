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
import { encryptPlan, decryptPlan } from '../utils/plan-crypto.js';
import { createRequestAbortError, getRequestContext } from '../utils/request-context.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import type { ErrorDetail } from '../schemas/shared.js';
import { TOOL_DEFINITIONS } from '../mcp/registration/tool-definitions.js';
import { getSessionContext } from './session-context.js';

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
type SamplingOperation<T> = Promise<T> | (() => Promise<T>);

function getEffectiveSamplingTimeout(deadline: number | undefined): number {
  if (!Number.isFinite(SAMPLING_TIMEOUT_MS) || SAMPLING_TIMEOUT_MS <= 0) {
    return 30000;
  }
  if (!Number.isFinite(deadline)) {
    return SAMPLING_TIMEOUT_MS;
  }
  return Math.min(SAMPLING_TIMEOUT_MS, Math.max(0, (deadline as number) - Date.now()));
}

function withSamplingTimeout<T>(operation: SamplingOperation<T>): Promise<T> {
  const context = getRequestContext();
  const abortSignal = context?.abortSignal;
  const effectiveTimeout = getEffectiveSamplingTimeout(context?.deadline);
  const execute = typeof operation === 'function' ? operation : () => operation;

  if (abortSignal?.aborted) {
    return Promise.reject(
      createRequestAbortError(abortSignal.reason, 'Sampling request cancelled by client')
    );
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer);
      }
      abortSignal?.removeEventListener('abort', onAbort);
    };
    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = (): void => {
      settle(() =>
        reject(createRequestAbortError(abortSignal?.reason, 'Sampling request cancelled by client'))
      );
    };

    abortSignal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      settle(() => reject(new Error(`Sampling request timed out after ${effectiveTimeout}ms`)));
    }, effectiveTimeout);

    Promise.resolve()
      .then(() => execute())
      .then(
        (value) => {
          settle(() => resolve(value));
        },
        (error) => {
          settle(() => reject(error));
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
  /** Set to 1 after the first auto-retry; prevents infinite retry loops */
  retryCount?: number;
  /** True if this step was auto-inserted as a recovery step */
  autoInserted?: boolean;
  /**
   * Step type override. When set to 'inject_cross_sheet_lookup', the executor
   * handles the step internally rather than delegating to executeHandler.
   */
  type?: 'inject_cross_sheet_lookup';
  /**
   * Typed configuration block for custom step types.
   * For 'inject_cross_sheet_lookup': sourceSheet, lookupCol, returnCol,
   * targetSheet, targetCol, targetKeyCol, startRow.
   */
  config?: Record<string, unknown>;
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
  spreadsheetId?: string;
  planningContextSummary?: string;
  steps: ExecutionStep[];
  status: PlanStatus;
  results: StepResult[];
  checkpoints: Checkpoint[];
  createdAt: string;
  updatedAt: string;
  currentStepIndex: number;
  error?: string;
  /** Structured error detail for the last failure, if available */
  errorDetail?: ErrorDetail;
}

export type ExecuteHandlerFn = (
  tool: string,
  action: string,
  params: Record<string, unknown>
) => Promise<unknown>;

type StepRunStatus = 'success' | 'retry' | 'pause';

type StepRunOutcome = {
  status: StepRunStatus;
  stepResult?: StepResult;
  errorDetail?: ErrorDetail;
  recoveryStep?: ExecutionStep | null;
  retryAfterMs?: number;
};

type ParsedHandlerResponse = {
  success?: boolean;
  action?: string;
  error?: Record<string, unknown>;
  values?: unknown;
  scout?: Record<string, unknown>;
  spreadsheet?: Record<string, unknown>;
};

type StepVerificationIssue = {
  message: string;
  details?: Record<string, unknown>;
};

type RangeVerificationTarget = {
  kind: 'range';
  action: 'write' | 'append' | 'clear';
  spreadsheetId: string;
  range: string;
  expectedValues?: unknown[][];
};

type SheetVerificationTarget = {
  kind: 'sheet';
  action: 'add_sheet' | 'delete_sheet';
  spreadsheetId: string;
  sheetId?: number;
  sheetName?: string;
  shouldExist: boolean;
};

type VerificationTarget = RangeVerificationTarget | SheetVerificationTarget;

const TOOL_INPUT_SCHEMAS = new Map(
  TOOL_DEFINITIONS.map((tool) => [tool.name, tool.inputSchema] as const)
);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getResponsePayload(result: unknown): ParsedHandlerResponse | null {
  if (!isPlainRecord(result)) {
    return null;
  }

  if (isPlainRecord(result['response'])) {
    return result['response'] as ParsedHandlerResponse;
  }

  return result as ParsedHandlerResponse;
}

function extractValuesFromResult(result: unknown): unknown[][] | undefined {
  const payload = getResponsePayload(result);
  if (!payload || !Array.isArray(payload.values)) {
    return undefined;
  }
  return payload.values as unknown[][];
}

function extractScoutSheets(
  result: unknown
): Array<Record<string, unknown> & { sheetId?: number; title?: string; rowCount?: number }> {
  const payload = getResponsePayload(result);
  const scout = payload?.scout;
  if (isPlainRecord(scout) && Array.isArray(scout['sheets'])) {
    return scout['sheets'].filter(isPlainRecord) as Array<
      Record<string, unknown> & { sheetId?: number; title?: string; rowCount?: number }
    >;
  }

  const payloadRecord = payload as Record<string, unknown> | null;
  if (isPlainRecord(payloadRecord) && Array.isArray(payloadRecord['sheets'])) {
    return payloadRecord['sheets'].filter(isPlainRecord) as Array<
      Record<string, unknown> & { sheetId?: number; title?: string; rowCount?: number }
    >;
  }

  return [];
}

function quoteSheetName(sheetName: string): string {
  return /^[A-Za-z0-9_]+$/.test(sheetName) ? sheetName : `'${sheetName.replace(/'/g, "''")}'`;
}

function summarizePlanningContext(context?: string): string | undefined {
  const trimmed = context?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length <= 2000 ? trimmed : `${trimmed.slice(0, 2000)}...`;
}

function buildPlanState(args: {
  planId: string;
  description: string;
  steps: ExecutionStep[];
  now: string;
  spreadsheetId?: string;
  planningContextSummary?: string;
}): PlanState {
  return {
    planId: args.planId,
    description: args.description,
    spreadsheetId: args.spreadsheetId,
    planningContextSummary: args.planningContextSummary,
    steps: args.steps,
    status: 'draft',
    results: [],
    checkpoints: [],
    createdAt: args.now,
    updatedAt: args.now,
    currentStepIndex: 0,
  };
}

function getEffectiveStepParams(
  step: ExecutionStep,
  plan: Pick<PlanState, 'spreadsheetId'>
): Record<string, unknown> {
  return {
    ...(plan.spreadsheetId && step.params['spreadsheetId'] === undefined
      ? { spreadsheetId: plan.spreadsheetId }
      : {}),
    ...step.params,
  };
}

function formatIssuePath(pathSegments: Array<string | number>): string {
  const normalized = pathSegments[0] === 'request' ? pathSegments.slice(1) : pathSegments;
  return normalized.length > 0 ? normalized.join('.') : 'request';
}

function buildStepParamValidationError(
  step: ExecutionStep,
  issues: Array<{ path: Array<string | number>; message: string }>
): ErrorDetail {
  const fieldErrors = issues.slice(0, 5).map((issue) => ({
    field: formatIssuePath(issue.path),
    message: issue.message,
  }));
  const issueSummary = fieldErrors.map((issue) => `${issue.field}: ${issue.message}`).join('; ');

  return {
    code: 'INVALID_PARAMS',
    message: `Step ${step.stepId} has invalid params for ${step.tool}.${step.action}: ${issueSummary}`,
    retryable: false,
    suggestedFix: 'Correct the step parameters so they match the tool input schema.',
    resolutionSteps: [
      `Inspect the params for ${step.tool}.${step.action}`,
      'Fill in required fields and remove incompatible values',
      'Retry the step after the request validates',
    ],
    suggestedTools: [step.tool],
    details: {
      validationIssues: fieldErrors,
    },
  };
}

function buildStepVerificationError(
  step: ExecutionStep,
  issue: StepVerificationIssue
): ErrorDetail {
  return {
    code: 'FAILED_PRECONDITION',
    message: `Post-step verification failed for ${step.tool}.${step.action}: ${issue.message}`,
    retryable: false,
    suggestedFix: 'Inspect the target range or sheet, then correct the step before retrying.',
    resolutionSteps: [
      `Review the target affected by ${step.tool}.${step.action}`,
      'Confirm the intended cells or sheet changed as expected',
      'Retry the step only after the mismatch is understood',
    ],
    suggestedTools: ['sheets_data', 'sheets_analyze', 'sheets_core'],
    details: issue.details,
  };
}

function buildHiddenFailureError(step: ExecutionStep, message: string): ErrorDetail {
  return {
    code: 'FAILED_PRECONDITION',
    message,
    retryable: false,
    suggestedFix: 'Inspect the tool response and correct the step before retrying.',
    resolutionSteps: [
      'Review the returned tool response for embedded error details',
      'Correct the underlying params or sheet state',
      'Retry the step once the hidden failure is resolved',
    ],
    suggestedTools: [step.tool],
  };
}

function validateStepParamsAgainstSchema(
  step: ExecutionStep,
  plan: Pick<PlanState, 'spreadsheetId'>
): { params: Record<string, unknown>; errorDetail?: ErrorDetail } {
  const params = getEffectiveStepParams(step, plan);

  if (step.type === 'inject_cross_sheet_lookup' || step.tool === '__internal__') {
    return { params };
  }

  const inputSchema = TOOL_INPUT_SCHEMAS.get(step.tool);
  if (!inputSchema) {
    return { params };
  }

  const parseResult = inputSchema.safeParse({
    request: {
      action: step.action,
      ...params,
    },
  });

  if (parseResult.success) {
    const parsedData = parseResult.data as Record<string, unknown>;
    const parsedRequest = parsedData['request'];
    if (isPlainRecord(parsedRequest)) {
      const { action: _action, ...normalizedParams } = parsedRequest;
      return {
        params: normalizedParams,
      };
    }
    return {
      params,
    };
  }

  return {
    params,
    errorDetail: buildStepParamValidationError(
      step,
      parseResult.error.issues.map((issue) => ({
        path: issue.path.filter((p): p is string | number => typeof p !== 'symbol'),
        message: issue.message,
      }))
    ),
  };
}

function isCellEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function hasExpectedRows(actualValues: unknown[][], expectedValues: unknown[][]): boolean {
  if (expectedValues.length === 0) {
    return true;
  }

  const serializedExpected = expectedValues.map((row) => JSON.stringify(row));
  const serializedActual = actualValues.map((row) => JSON.stringify(row));

  for (let start = 0; start <= serializedActual.length - serializedExpected.length; start++) {
    const window = serializedActual.slice(start, start + serializedExpected.length);
    if (window.every((row, index) => row === serializedExpected[index])) {
      return true;
    }
  }

  return false;
}

function getA1Range(range: unknown): string | undefined {
  if (typeof range === 'string') {
    return range;
  }

  if (!isPlainRecord(range)) {
    return undefined;
  }

  if (typeof range['a1'] === 'string') {
    return range['a1'] as string;
  }

  if (typeof range['sheetName'] === 'string') {
    const sheetName = quoteSheetName(range['sheetName'] as string);
    const innerRange = typeof range['range'] === 'string' ? (range['range'] as string) : undefined;
    return innerRange ? `${sheetName}!${innerRange}` : sheetName;
  }

  return undefined;
}

function buildVerificationTarget(
  step: ExecutionStep,
  params: Record<string, unknown>
): VerificationTarget | null {
  const spreadsheetId =
    typeof params['spreadsheetId'] === 'string' ? (params['spreadsheetId'] as string) : undefined;
  const a1Range = getA1Range(params['range']);
  if (!spreadsheetId) {
    return null;
  }

  if (step.tool === 'sheets_data' && a1Range) {
    if (step.action === 'write' || step.action === 'append') {
      return {
        kind: 'range',
        action: step.action,
        spreadsheetId,
        range: a1Range,
        expectedValues: Array.isArray(params['values'])
          ? (params['values'] as unknown[][])
          : undefined,
      };
    }

    if (step.action === 'clear') {
      return {
        kind: 'range',
        action: 'clear',
        spreadsheetId,
        range: a1Range,
      };
    }
  }

  if (
    step.tool === 'sheets_core' &&
    step.action === 'add_sheet' &&
    typeof params['title'] === 'string'
  ) {
    return {
      kind: 'sheet',
      action: 'add_sheet',
      spreadsheetId,
      sheetName: params['title'] as string,
      shouldExist: true,
    };
  }

  if (step.tool === 'sheets_core' && step.action === 'delete_sheet') {
    return {
      kind: 'sheet',
      action: 'delete_sheet',
      spreadsheetId,
      sheetId: typeof params['sheetId'] === 'number' ? (params['sheetId'] as number) : undefined,
      shouldExist: false,
    };
  }

  return null;
}

async function verifyStepExecution(
  step: ExecutionStep,
  params: Record<string, unknown>,
  executeHandler: ExecuteHandlerFn
): Promise<StepVerificationIssue | null> {
  const target = buildVerificationTarget(step, params);
  if (!target) {
    return null;
  }

  try {
    if (target.kind === 'range') {
      const readResult = await executeHandler('sheets_data', 'read', {
        spreadsheetId: target.spreadsheetId,
        range: target.range,
        verbosity: 'minimal',
      });
      const actualValues = extractValuesFromResult(readResult) ?? [];

      if (target.action === 'clear') {
        const hasResidualValues = actualValues.some(
          (row) => Array.isArray(row) && row.some((cell) => !isCellEmpty(cell))
        );
        if (hasResidualValues) {
          return {
            message: `Range ${target.range} still contains values after clear`,
            details: {
              range: target.range,
              actualValues,
            },
          };
        }
        return null;
      }

      if (target.expectedValues && !hasExpectedRows(actualValues, target.expectedValues)) {
        return {
          message: `Range ${target.range} did not contain the expected values after ${target.action}`,
          details: {
            range: target.range,
            expectedValues: target.expectedValues,
            actualValues,
          },
        };
      }

      return null;
    }

    const scoutResult = await executeHandler('sheets_analyze', 'scout', {
      spreadsheetId: target.spreadsheetId,
      verbosity: 'minimal',
    });
    const sheets = extractScoutSheets(scoutResult);
    const matchedSheet = sheets.find((sheet) => {
      if (target.sheetId !== undefined && sheet['sheetId'] === target.sheetId) {
        return true;
      }
      if (target.sheetName !== undefined && sheet['title'] === target.sheetName) {
        return true;
      }
      return false;
    });

    if (target.shouldExist && !matchedSheet) {
      return {
        message: `Sheet ${target.sheetName ?? target.sheetId ?? 'unknown'} was not present after ${target.action}`,
        details: {
          sheetName: target.sheetName,
          sheetId: target.sheetId,
          availableSheets: sheets.map((sheet) => ({
            sheetId: sheet['sheetId'],
            title: sheet['title'],
          })),
        },
      };
    }

    if (!target.shouldExist && matchedSheet) {
      return {
        message: `Sheet ${target.sheetName ?? target.sheetId ?? 'unknown'} still exists after ${target.action}`,
        details: {
          sheetName: target.sheetName,
          sheetId: target.sheetId,
          matchedSheet,
        },
      };
    }

    return null;
  } catch (error) {
    return {
      message: `Could not confirm the post-step state for ${step.tool}.${step.action}`,
      details: {
        verificationTarget: target,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function upsertStepResult(plan: PlanState, stepResult: StepResult): void {
  const existingIndex = plan.results.findIndex((result) => result.stepId === stepResult.stepId);
  if (existingIndex >= 0) {
    plan.results[existingIndex] = stepResult;
    return;
  }
  plan.results.push(stepResult);
}

// ============================================================================
// Workflow Templates (P2.2)
// ============================================================================

/** A standard tool-call step in a workflow template. */
export interface WorkflowTemplateToolStep {
  type?: 'tool_call';
  tool: string;
  action: string;
  description: string;
  paramTemplate: Record<string, unknown>;
}

/** An inject_cross_sheet_lookup step in a workflow template. */
export interface WorkflowTemplateLookupStep {
  type: 'inject_cross_sheet_lookup';
  description?: string;
  config: {
    sourceSheet: string;
    lookupCol: string;
    returnCol: string;
    targetSheet: string;
    targetCol: string;
    targetKeyCol: string;
    startRow: number;
  };
}

export type WorkflowTemplateStep = WorkflowTemplateToolStep | WorkflowTemplateLookupStep;

export interface WorkflowTemplate {
  name: string;
  description: string;
  steps: WorkflowTemplateStep[];
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
  'multi-sheet-crm': {
    name: 'Multi-Sheet CRM',
    description: 'Customers + Orders + Products sheets with XLOOKUP cross-references',
    steps: [
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Customers sheet',
        paramTemplate: { title: 'Customers' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Products sheet',
        paramTemplate: { title: 'Products' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Orders sheet',
        paramTemplate: { title: 'Orders' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Customers headers',
        paramTemplate: {
          range: 'Customers!A1:D1',
          values: [['CustomerID', 'Name', 'Email', 'Region']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Products headers',
        paramTemplate: {
          range: 'Products!A1:D1',
          values: [['ProductID', 'Name', 'Price', 'Category']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Orders headers',
        paramTemplate: {
          range: 'Orders!A1:F1',
          values: [
            ['OrderID', 'CustomerID', 'ProductID', 'Quantity', 'CustomerName', 'ProductName'],
          ],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'inject_cross_sheet_lookup' as const,
        config: {
          sourceSheet: 'Customers',
          lookupCol: 'A',
          returnCol: 'B',
          targetSheet: 'Orders',
          targetCol: 'E',
          targetKeyCol: 'B',
          startRow: 2,
        },
      },
      {
        type: 'inject_cross_sheet_lookup' as const,
        config: {
          sourceSheet: 'Products',
          lookupCol: 'A',
          returnCol: 'B',
          targetSheet: 'Orders',
          targetCol: 'F',
          targetKeyCol: 'C',
          startRow: 2,
        },
      },
    ],
  },
  'budget-vs-actuals': {
    name: 'Budget vs Actuals',
    description: 'Budget, Actuals, and auto-computed Variance sheet',
    steps: [
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Budget sheet',
        paramTemplate: { title: 'Budget' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Actuals sheet',
        paramTemplate: { title: 'Actuals' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Variance sheet',
        paramTemplate: { title: 'Variance' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Budget headers',
        paramTemplate: {
          range: 'Budget!A1:E1',
          values: [['Category', 'Q1', 'Q2', 'Q3', 'Q4']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Actuals headers',
        paramTemplate: {
          range: 'Actuals!A1:E1',
          values: [['Category', 'Q1', 'Q2', 'Q3', 'Q4']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Variance headers',
        paramTemplate: {
          range: 'Variance!A1:E1',
          values: [['Category', 'Q1 Variance', 'Q2 Variance', 'Q3 Variance', 'Q4 Variance']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Variance formulas',
        paramTemplate: {
          range: 'Variance!A2:E11',
          values: Array.from({ length: 10 }, (_, i) => [
            `=Budget!A${i + 2}`,
            `=Actuals!B${i + 2}-Budget!B${i + 2}`,
            `=Actuals!C${i + 2}-Budget!C${i + 2}`,
            `=Actuals!D${i + 2}-Budget!D${i + 2}`,
            `=Actuals!E${i + 2}-Budget!E${i + 2}`,
          ]),
          valueInputOption: 'USER_ENTERED',
        },
      },
    ],
  },
  'project-tracker': {
    name: 'Project Tracker',
    description: 'Tasks + Resources + Timeline with XLOOKUP resource assignments',
    steps: [
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Resources sheet',
        paramTemplate: { title: 'Resources' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Tasks sheet',
        paramTemplate: { title: 'Tasks' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Timeline sheet',
        paramTemplate: { title: 'Timeline' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Resources headers',
        paramTemplate: {
          range: 'Resources!A1:C1',
          values: [['ResourceID', 'Name', 'Role']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Tasks headers',
        paramTemplate: {
          range: 'Tasks!A1:F1',
          values: [['TaskID', 'Title', 'ResourceID', 'Start', 'End', 'AssigneeName']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'inject_cross_sheet_lookup' as const,
        config: {
          sourceSheet: 'Resources',
          lookupCol: 'A',
          returnCol: 'B',
          targetSheet: 'Tasks',
          targetCol: 'F',
          targetKeyCol: 'C',
          startRow: 2,
        },
      },
    ],
  },
  'inventory-with-lookups': {
    name: 'Inventory with Lookups',
    description: 'Inventory + Suppliers + Categories with cross-sheet XLOOKUP',
    steps: [
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Categories sheet',
        paramTemplate: { title: 'Categories' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Suppliers sheet',
        paramTemplate: { title: 'Suppliers' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_core',
        action: 'add_sheet',
        description: 'Create Inventory sheet',
        paramTemplate: { title: 'Inventory' },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Categories headers',
        paramTemplate: {
          range: 'Categories!A1:B1',
          values: [['CategoryID', 'Name']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Suppliers headers',
        paramTemplate: {
          range: 'Suppliers!A1:C1',
          values: [['SupplierID', 'Name', 'ContactEmail']],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'tool_call',
        tool: 'sheets_data',
        action: 'write',
        description: 'Write Inventory headers',
        paramTemplate: {
          range: 'Inventory!A1:G1',
          values: [
            ['SKU', 'Name', 'CategoryID', 'SupplierID', 'Stock', 'CategoryName', 'SupplierName'],
          ],
          valueInputOption: 'USER_ENTERED',
        },
      },
      {
        type: 'inject_cross_sheet_lookup' as const,
        config: {
          sourceSheet: 'Categories',
          lookupCol: 'A',
          returnCol: 'B',
          targetSheet: 'Inventory',
          targetCol: 'F',
          targetKeyCol: 'C',
          startRow: 2,
        },
      },
      {
        type: 'inject_cross_sheet_lookup' as const,
        config: {
          sourceSheet: 'Suppliers',
          lookupCol: 'A',
          returnCol: 'B',
          targetSheet: 'Inventory',
          targetCol: 'G',
          targetKeyCol: 'D',
          startRow: 2,
        },
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
    await writeFile(filePath, encryptPlan(JSON.stringify(plan, null, 2)), 'utf-8');
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
        const raw = await readFile(path.join(PLAN_STORAGE_DIR, file), 'utf-8');
        const content = decryptPlan(raw);
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
- sheets_core: create, get, add_sheet, delete_sheet, list, update_properties
- sheets_data: read, write, append, clear, find_replace, cross_read, cross_query, cross_write, cross_compare
- sheets_format: set_format, set_background, set_text_format, set_number_format, apply_preset, set_borders, clear_format, batch_format, set_rich_text
- sheets_dimensions: sort_range, freeze, insert, delete, auto_resize, hide, show, group, ungroup, set_basic_filter, clear_basic_filter
- sheets_visualize: chart_create, chart_update, pivot_create, pivot_update, suggest_chart, suggest_pivot
- sheets_analyze: comprehensive, scout, analyze_data, detect_patterns, suggest_next_actions, auto_enhance, quick_insights
- sheets_fix: clean, standardize_formats, fill_missing, detect_anomalies, suggest_cleaning, fix
- sheets_compute: aggregate, statistical, forecast, regression, evaluate
- sheets_composite: import_csv, deduplicate, setup_sheet, generate_sheet, import_xlsx, export_xlsx, bulk_update, data_pipeline
- sheets_history: undo, redo, revert_to, timeline, restore_cells
- sheets_dependencies: build, model_scenario, compare_scenarios, analyze_impact
- sheets_collaborate: share_add, comment_add, share_list, comment_list, share_remove
- sheets_advanced: add_named_range, list_named_ranges, add_protected_range, create_table, add_banding
- sheets_templates: list, apply, create, import_builtin, delete
- sheets_auth: status, login, logout, refresh, callback
- sheets_webhook: register, list, unregister, watch_changes, update
- sheets_transaction: begin, queue, commit, rollback, status
- sheets_federation: call_remote, list_servers, get_server_tools, validate_connection
- sheets_bigquery: export_to_bigquery, import_from_bigquery, query, connect, list_connections
- sheets_appsscript: run, create, deploy, list, create_trigger
- sheets_session: set_active, get_context, save_checkpoint, restore_checkpoint, record_operation
- sheets_quality: validate, detect_conflicts, resolve_conflict, analyze_impact
- sheets_confirm: request, approve, deny, status, cancel
- sheets_connectors: list, configure, query, subscribe, get_status

EXAMPLE PLAN:

User request: "Create a sales tracker with monthly revenue, import Q1 data, and add a chart"

Generated plan:
[
  {
    "step": 1,
    "tool": "sheets_core",
    "action": "create",
    "params": { "title": "Sales Tracker 2026" },
    "description": "Create new spreadsheet"
  },
  {
    "step": 2,
    "tool": "sheets_composite",
    "action": "import_csv",
    "params": { "source": "q1_data.csv", "createNewSheet": true },
    "description": "Import Q1 data into a new sheet"
  },
  {
    "step": 3,
    "tool": "sheets_dimensions",
    "action": "freeze",
    "params": { "frozenRowCount": 1 },
    "description": "Freeze header row"
  },
  {
    "step": 4,
    "tool": "sheets_visualize",
    "action": "chart_create",
    "params": { "chartType": "LINE", "dataRange": "Sheet1!A:B", "title": "Monthly Revenue" },
    "description": "Create revenue trend chart"
  }
]

Return ONLY valid JSON array, no markdown code blocks, no explanation.
Maximum ${maxSteps || 10} steps.`;

    let prompt = `Plan steps for: "${description}"`;
    if (spreadsheetId) prompt += `\nTarget spreadsheet ID: ${spreadsheetId}`;
    if (context) prompt += `\nAdditional context: ${context}`;

    // Inject spreadsheet context if available from session
    if (spreadsheetId) {
      try {
        const sessionCtx = getSessionContext();
        const activeCtx = sessionCtx.getActiveSpreadsheet();
        if (
          activeCtx &&
          activeCtx.spreadsheetId === spreadsheetId &&
          activeCtx.sheetNames.length > 0
        ) {
          prompt += `\nSpreadsheet context:`;
          prompt += `\n- Sheets: ${activeCtx.sheetNames.join(', ')}`;
          prompt += `\nIMPORTANT: Use these exact sheet names (case-sensitive, including spaces and emoji) in your params.`;
        }
      } catch {
        // OK: Session context may not be initialized — skip enrichment
      }
    }

    const modelHint = getModelHint('agentPlanning');
    const result = await withSamplingTimeout(() =>
      _samplingServer!.createMessage({
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

  const plan = buildPlanState({
    planId,
    description,
    steps,
    now,
    spreadsheetId,
    planningContextSummary: summarizePlanningContext(context),
  });

  evictOldestPlan();
  planStore.set(planId, plan);
  persistPlan(plan).catch((err: unknown) => {
    logger.warn('Failed to persist plan state', { planId: plan.planId, error: err });
  });

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

  const plan = buildPlanState({
    planId,
    description,
    steps,
    now,
    spreadsheetId,
    planningContextSummary: summarizePlanningContext(context),
  });

  evictOldestPlan();
  planStore.set(planId, plan);
  persistPlan(plan).catch((err: unknown) => {
    logger.warn('Failed to persist plan state', { planId: plan.planId, error: err });
  });

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
  const steps: ExecutionStep[] = template.steps.map((step, i) => {
    const base = {
      stepId: `step-${i + 1}`,
      dependsOn: i > 0 ? [`step-${i}`] : undefined,
    };
    if (step.type === 'inject_cross_sheet_lookup') {
      return {
        ...base,
        tool: '__internal__',
        action: 'inject_cross_sheet_lookup',
        type: 'inject_cross_sheet_lookup' as const,
        description: step.description ?? 'Inject cross-sheet XLOOKUP formulas',
        params: { spreadsheetId },
        config: step.config as Record<string, unknown>,
      };
    }
    return {
      ...base,
      tool: step.tool,
      action: step.action,
      description: step.description,
      params: { spreadsheetId, ...step.paramTemplate, ...(overrides || {}) },
    };
  });

  const now = new Date().toISOString();
  const plan = buildPlanState({
    planId,
    description: `${template.name}: ${template.description}`,
    steps,
    now,
    spreadsheetId,
    planningContextSummary: template.description,
  });

  if (planStore.size >= MAX_PLANS) evictOldestPlan();
  planStore.set(planId, plan);
  persistPlan(plan).catch((err: unknown) => {
    logger.warn('Failed to persist plan state', { planId: plan.planId, error: err });
  });

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
// Error Classification Helpers (B1)
// ============================================================================

/**
 * Extract a structured ErrorDetail from an unknown thrown value.
 * Returns null if the error cannot be parsed as a structured error.
 */
function extractErrorDetail(err: unknown): ErrorDetail | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, unknown>;

  // Case 1: error already has an attached errorDetail property
  if (e['errorDetail'] && typeof e['errorDetail'] === 'object') {
    return e['errorDetail'] as ErrorDetail;
  }

  // Case 2: error has toErrorDetail() method
  if (typeof e['toErrorDetail'] === 'function') {
    try {
      return (e['toErrorDetail'] as () => ErrorDetail)();
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Build a recovery ExecutionStep from an error's fixableVia definition.
 */
function buildRecoveryStep(errorDetail: ErrorDetail): ExecutionStep | null {
  if (!errorDetail.fixableVia) return null;
  return {
    stepId: `recovery-${randomUUID().slice(0, 8)}`,
    tool: errorDetail.fixableVia.tool,
    action: errorDetail.fixableVia.action,
    params: (errorDetail.fixableVia.params as Record<string, unknown> | undefined) ?? {},
    description: `Auto-recovery: ${errorDetail.suggestedFix ?? 'Fix error condition'}`,
    autoInserted: true,
  };
}

// ============================================================================
// Plan Execution
// ============================================================================

// ============================================================================
// Custom Step Executors
// ============================================================================

/**
 * Execute an inject_cross_sheet_lookup step.
 *
 * 1. Scouts the target sheet to discover the last occupied row.
 * 2. Builds XLOOKUP formula strings for each data row.
 * 3. Writes all formulas to the target column in a single write call.
 */
async function executeInjectCrossSheetLookup(
  step: ExecutionStep,
  plan: PlanState,
  executeHandler: ExecuteHandlerFn
): Promise<{ success: true; formulasWritten: number }> {
  const cfg = step.config as {
    sourceSheet: string;
    lookupCol: string;
    returnCol: string;
    targetSheet: string;
    targetCol: string;
    targetKeyCol: string;
    startRow: number;
  };
  const spreadsheetId =
    (step.params['spreadsheetId'] as string | undefined) ?? plan.spreadsheetId ?? plan.description;

  // Scout to discover the last occupied row in the target sheet
  const metaResult = await executeHandler('sheets_analyze', 'scout', {
    spreadsheetId,
    verbosity: 'minimal',
  });
  const sheetInfo = extractScoutSheets(metaResult).find(
    (sheet) => sheet['title'] === cfg.targetSheet
  );
  const lastRow = sheetInfo
    ? cfg.startRow + Math.max(0, Number(sheetInfo['rowCount'] ?? 0) - cfg.startRow)
    : cfg.startRow + 99;

  // Build XLOOKUP formula for each row in [startRow, lastRow]
  const formulas: string[][] = [];
  for (let row = cfg.startRow; row <= lastRow; row++) {
    formulas.push([
      `=IFERROR(XLOOKUP(${cfg.targetKeyCol}${row},'${cfg.sourceSheet}'!${cfg.lookupCol}:${cfg.lookupCol},'${cfg.sourceSheet}'!${cfg.returnCol}:${cfg.returnCol},""),"")`,
    ]);
  }

  await executeHandler('sheets_data', 'write', {
    spreadsheetId,
    range: `${quoteSheetName(cfg.targetSheet)}!${cfg.targetCol}${cfg.startRow}:${cfg.targetCol}${lastRow}`,
    values: formulas,
    valueInputOption: 'USER_ENTERED',
  });

  return { success: true, formulasWritten: formulas.length };
}

/**
 * AI reflexion validation for step results (IMP-03).
 * Uses MCP Sampling to check whether a step result looks correct.
 * Fails open — returns valid:true on any error to avoid blocking execution.
 */
export async function aiValidateStepResult(
  step: ExecutionStep,
  result: unknown
): Promise<{ valid: boolean; issue?: string; suggestedFix?: string }> {
  if (!_samplingServer) return { valid: true };

  try {
    await assertSamplingConsent();
    const resultStr = JSON.stringify(result, null, 2).slice(0, 500);
    const prompt = `Step "${step.description}" (${step.tool}.${step.action}) returned:
${resultStr}

Did this step succeed as expected? If the response shows success:false or an unexpected error, report it.
Reply with ONLY JSON (no markdown): { "valid": boolean, "issue"?: string, "suggestedFix"?: string }`;

    const response = await withSamplingTimeout(() =>
      _samplingServer!.createMessage({
        messages: [createUserMessage(prompt)],
        systemPrompt:
          'You are validating spreadsheet operation results. Reply with only valid JSON.',
        maxTokens: 200,
      })
    );

    const text = extractTextFromResult(response);
    if (!text) return { valid: true }; // OK: Empty sampling response — fail open
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(cleaned) as { valid: boolean; issue?: string; suggestedFix?: string };
    return { valid: parsed.valid ?? true, issue: parsed.issue, suggestedFix: parsed.suggestedFix };
  } catch {
    return { valid: true }; // OK: Fail open — don't block execution on validation errors
  }
}

async function runStepWithGuards(
  plan: PlanState,
  step: ExecutionStep,
  executeHandler: ExecuteHandlerFn,
  checkpointContext: string
): Promise<StepRunOutcome> {
  const startedAt = new Date().toISOString();
  createCheckpoint(plan.planId, checkpointContext);

  const validation = validateStepParamsAgainstSchema(step, plan);
  step.params = validation.params;

  if (validation.errorDetail) {
    return {
      status: 'pause',
      errorDetail: validation.errorDetail,
      stepResult: {
        stepId: step.stepId,
        success: false,
        error: validation.errorDetail.message,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  }

  try {
    const result =
      step.type === 'inject_cross_sheet_lookup' || step.action === 'inject_cross_sheet_lookup'
        ? await executeInjectCrossSheetLookup(step, plan, executeHandler)
        : await executeHandler(step.tool, step.action, validation.params);

    const validationIssue = validateStepResult(result, step);
    if (validationIssue) {
      logger.warn('Step result validation failed', {
        planId: plan.planId,
        stepId: step.stepId,
        issue: validationIssue,
      });
      return {
        status: 'pause',
        errorDetail: buildHiddenFailureError(step, validationIssue),
        stepResult: {
          stepId: step.stepId,
          success: false,
          result,
          error: validationIssue,
          startedAt,
          completedAt: new Date().toISOString(),
        },
      };
    }

    if (_samplingServer) {
      const aiValidation = await aiValidateStepResult(step, result);
      if (!aiValidation.valid && aiValidation.issue) {
        logger.warn('AI step validation detected issue', {
          planId: plan.planId,
          stepId: step.stepId,
          issue: aiValidation.issue,
          suggestedFix: aiValidation.suggestedFix,
        });
      }
    }

    const verificationIssue = await verifyStepExecution(step, validation.params, executeHandler);
    if (verificationIssue) {
      const errorDetail = buildStepVerificationError(step, verificationIssue);
      return {
        status: 'pause',
        errorDetail,
        stepResult: {
          stepId: step.stepId,
          success: false,
          result,
          error: errorDetail.message,
          startedAt,
          completedAt: new Date().toISOString(),
        },
      };
    }

    return {
      status: 'success',
      stepResult: {
        stepId: step.stepId,
        success: true,
        result,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const errorDetail = extractErrorDetail(err);
    const errAsObj = err as Record<string, unknown>;
    const isRetryable =
      errorDetail?.retryable === true || (err instanceof Error && errAsObj['isRetryable'] === true);
    const retryAfterMs =
      errorDetail?.retryAfterMs ??
      (typeof errAsObj['retryAfterMs'] === 'number'
        ? (errAsObj['retryAfterMs'] as number)
        : undefined);

    if (isRetryable && retryAfterMs !== undefined && step.retryCount === undefined) {
      step.retryCount = 1;
      logger.debug('Auto-retrying retryable step error', {
        planId: plan.planId,
        stepId: step.stepId,
        retryAfterMs,
        errorCode: errorDetail?.code,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(retryAfterMs, 30000)));
      return {
        status: 'retry',
        retryAfterMs,
      };
    }

    return {
      status: 'pause',
      errorDetail: errorDetail ?? undefined,
      recoveryStep: errorDetail ? buildRecoveryStep(errorDetail) : null,
      stepResult: {
        stepId: step.stepId,
        success: false,
        error,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  }
}

function persistPlanState(plan: PlanState): void {
  plan.updatedAt = new Date().toISOString();
  planStore.set(plan.planId, plan);
  persistPlan(plan).catch((persistErr: unknown) => {
    logger.warn('Failed to persist plan state', { planId: plan.planId, error: persistErr });
  });
}

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
    throw new NotFoundError('plan', planId);
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
    const outcome = await runStepWithGuards(
      plan,
      step,
      executeHandler,
      `Before step: ${step.description}`
    );

    if (outcome.status === 'retry') {
      i--;
      continue;
    }

    if (outcome.stepResult) {
      upsertStepResult(plan, outcome.stepResult);
    }

    if (outcome.status === 'pause') {
      plan.status = 'paused';
      plan.error = outcome.stepResult?.error ?? outcome.errorDetail?.message;
      plan.errorDetail = outcome.errorDetail;

      if (outcome.recoveryStep) {
        plan.steps.splice(i + 1, 0, outcome.recoveryStep);
        logger.debug('Inserted auto-recovery step', {
          planId,
          recoveryStepId: outcome.recoveryStep.stepId,
          tool: outcome.recoveryStep.tool,
          action: outcome.recoveryStep.action,
        });
      }

      persistPlanState(plan);
      return plan;
    }

    plan.currentStepIndex = i + 1;
    plan.error = undefined;
    plan.errorDetail = undefined;
    persistPlanState(plan);
  }

  plan.status = 'completed';
  persistPlanState(plan);
  return plan;
}

/**
 * Validate a step result to detect hidden failures.
 *
 * Some tool responses return success:false buried inside the response object
 * without throwing. This function catches those cases and returns a diagnostic
 * string if the result is invalid, or null if it looks valid.
 */
function validateStepResult(result: unknown, step: ExecutionStep): string | null {
  if (result === null || result === undefined) {
    return `Step ${step.stepId} (${step.tool}.${step.action}) returned null/undefined`;
  }

  // Check for buried error in response.response.success === false
  const resultObj = result as Record<string, unknown>;
  const response = resultObj['response'] as Record<string, unknown> | undefined;
  if (response && response['success'] === false) {
    const error = response['error'] as Record<string, unknown> | undefined;
    const errorMsg = error?.['message'] ?? response['message'] ?? 'unknown error';
    return `Step ${step.stepId} (${step.tool}.${step.action}) returned success:false — ${errorMsg}`;
  }

  // Check for top-level success:false
  if (resultObj['success'] === false) {
    const errorMsg =
      (resultObj['error'] as Record<string, unknown>)?.['message'] ??
      resultObj['message'] ??
      'unknown error';
    return `Step ${step.stepId} (${step.tool}.${step.action}) returned success:false — ${errorMsg}`;
  }

  return null; // OK: Explicit valid result
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
    throw new NotFoundError('plan', planId);
  }

  const step = plan.steps.find((s) => s.stepId === stepId);
  if (!step) {
    throw new NotFoundError('step', `${stepId} in plan ${planId}`);
  }

  const stepIndex = plan.steps.findIndex((candidate) => candidate.stepId === stepId);
  while (true) {
    const outcome = await runStepWithGuards(
      plan,
      step,
      executeHandler,
      `Execute step: ${step.description}`
    );

    if (outcome.status === 'retry') {
      continue;
    }

    const stepResult =
      outcome.stepResult ??
      ({
        stepId,
        success: false,
        error: outcome.errorDetail?.message ?? 'Step execution failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      } satisfies StepResult);

    upsertStepResult(plan, stepResult);

    if (outcome.status === 'pause') {
      plan.status = 'paused';
      plan.error = stepResult.error ?? outcome.errorDetail?.message;
      plan.errorDetail = outcome.errorDetail;

      if (outcome.recoveryStep && stepIndex >= 0) {
        plan.steps.splice(stepIndex + 1, 0, outcome.recoveryStep);
      }

      persistPlanState(plan);
      return stepResult;
    }

    plan.error = undefined;
    plan.errorDetail = undefined;
    plan.currentStepIndex = Math.max(plan.currentStepIndex, stepIndex + 1);
    if (plan.currentStepIndex >= plan.steps.length) {
      plan.status = 'completed';
    }
    persistPlanState(plan);
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
    throw new NotFoundError('plan', planId);
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
  persistPlan(plan).catch((persistErr: unknown) => {
    logger.warn('Failed to persist plan state', { planId, error: persistErr });
  });

  return checkpoint;
}

/**
 * Revert plan state to a specific checkpoint.
 * Removes results after checkpoint and sets status to 'paused'.
 */
export function rollbackToPlan(planId: string, checkpointId: string): PlanState {
  const plan = planStore.get(planId);
  if (!plan) {
    throw new NotFoundError('plan', planId);
  }

  const checkpoint = plan.checkpoints.find((c) => c.checkpointId === checkpointId);
  if (!checkpoint) {
    throw new NotFoundError('checkpoint', `${checkpointId} in plan ${planId}`);
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
  persistPlan(plan).catch((persistErr: unknown) => {
    logger.warn('Failed to persist plan state', { planId, error: persistErr });
  });

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
    throw new NotFoundError('plan', planId);
  }

  if (plan.status !== 'paused') {
    throw new ValidationError(
      `Plan ${planId} is not paused (status: ${plan.status})`,
      'planId',
      'plan in paused status'
    );
  }

  // Determine resume position
  if (fromStepId) {
    const stepIdx = plan.steps.findIndex((s) => s.stepId === fromStepId);
    if (stepIdx < 0) {
      throw new NotFoundError('step', `${fromStepId} in plan ${planId}`);
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
    deletePersistedPlan(planId).catch((err: unknown) => {
      logger.warn('Failed to delete persisted plan', { planId, error: err });
    });
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
        await unlink(path.join(PLAN_STORAGE_DIR, file)).catch((err: unknown) => {
          logger.warn('Failed to delete plan file', { file, error: err });
        });
      }
    }
  } catch (err) {
    logger.debug('Failed to clear persisted plans', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
