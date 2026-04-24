/**
 * Execution Operations — run, list_processes, get_metrics
 */

import { logger } from '../../utils/logger.js';
import { getRequestAbortSignal, sendProgress } from '../../utils/request-context.js';
import { ErrorCodes } from '../error-codes.js';
import type { AppsScriptHandlerAccess } from './internal.js';
import type {
  AppsScriptRunInput,
  AppsScriptListProcessesInput,
  AppsScriptGetMetricsInput,
  AppsScriptResponse,
} from '../../schemas/index.js';

const SCRIPT_RUN_TIMEOUT_MS = 420_000; // 7 minutes (6 min limit + 60 s buffer)

// Track concurrent run() executions across handler instances
let activeRunExecutions = 0;
let maxConcurrentRuns = 15;

export function setMaxConcurrentRuns(max: number): void {
  maxConcurrentRuns = max;
}

interface RunRequest {
  function: string;
  parameters?: unknown[];
  devMode?: boolean;
}

interface RunResponse {
  done?: boolean;
  response?: {
    '@type'?: string;
    result?: unknown;
  };
  error?: {
    message?: string;
    code?: number;
    details?: Array<{
      '@type'?: string;
      errorMessage?: string;
      errorType?: string;
      scriptStackTraceElements?: Array<{
        function?: string;
        lineNumber?: number;
      }>;
    }>;
  };
}

export async function handleRun(
  access: AppsScriptHandlerAccess,
  req: AppsScriptRunInput
): Promise<AppsScriptResponse> {
  if ((req as Record<string, unknown>)['files'] !== undefined) {
    return access.error({
      code: ErrorCodes.INVALID_PARAMS,
      message:
        'run does not accept files or source code. Call update_content first, then call run with scriptId + functionName.',
      retryable: false,
      suggestedFix:
        '1. Use sheets_appsscript action:"update_content" with { scriptId, files }. 2. Then call action:"run" with { scriptId, functionName, parameters? }.',
    });
  }

  const requestAbortSignal = getRequestAbortSignal();
  if (requestAbortSignal?.aborted) {
    return access.error({
      code: ErrorCodes.CANCELLED,
      message: 'Request cancelled by client.',
      retryable: false,
    });
  }

  if (activeRunExecutions >= maxConcurrentRuns) {
    return access.error({
      code: ErrorCodes.QUOTA_EXCEEDED,
      message:
        `Apps Script concurrent execution limit reached ` +
        `(${activeRunExecutions}/${maxConcurrentRuns} slots in use). ` +
        `Wait for current executions to complete before retrying.`,
      retryable: true,
      retryAfterMs: 30000,
    });
  }

  logger.info(`Running function ${req.functionName} in: ${req.scriptId}`);

  const safety = (
    req as typeof req & { safety?: { dryRun?: boolean; requireConfirmation?: boolean } }
  ).safety;
  if (safety?.dryRun) {
    return access.success('run', {
      dryRun: true,
      message: `[DRY RUN] Would execute function '${req.functionName}' in script ${req.scriptId}. No changes made.`,
    });
  }

  if (!req.devMode && !req.deploymentId) {
    return access.error({
      code: ErrorCodes.FAILED_PRECONDITION,
      message:
        'run requires deploymentId unless devMode:true. Supported workflow: create -> update_content -> create_version -> deploy -> run with deploymentId.',
      retryable: false,
    });
  }

  await sendProgress(0, 2, `Executing Apps Script function '${req.functionName}'...`);

  const googleClient = access.context.googleClient;
  if (googleClient) {
    const tokenStatus = googleClient.getTokenStatus();
    if (tokenStatus.expiryDate) {
      const now = Date.now();
      const secondsRemaining = Math.floor((tokenStatus.expiryDate - now) / 1000);

      if (secondsRemaining < 360) {
        logger.info('Pre-refreshing token before long-running script', {
          secondsRemaining,
          scriptId: req.scriptId,
          functionName: req.functionName,
        });

        try {
          await googleClient.oauth2.getAccessToken();
          logger.info('Token pre-refresh successful', { scriptId: req.scriptId });
        } catch (error) {
          logger.warn('Token pre-refresh failed', { error, scriptId: req.scriptId });
        }
      }
    }
  }

  const body: RunRequest = {
    function: req.functionName,
  };

  if (req.parameters) {
    body.parameters = req.parameters;
  }

  if (req.devMode) {
    body.devMode = req.devMode;
  }

  const runTarget = req.devMode ? req.scriptId : req.deploymentId;
  if (!runTarget) {
    return access.error({
      code: ErrorCodes.INVALID_PARAMS,
      message: 'run requires deploymentId unless devMode:true. When devMode:true, scriptId is used as the run target.',
      retryable: false,
    });
  }

  activeRunExecutions++;

  try {
    let result: RunResponse;
    try {
      result = await access.apiRequest<RunResponse>(
        'POST',
        `/scripts/${runTarget}:run`,
        body,
        SCRIPT_RUN_TIMEOUT_MS
      );
    } catch (error) {
      if (error instanceof Error && error.message?.includes('Authentication') && googleClient) {
        logger.warn('Auth error during script execution, refreshing token and retrying', {
          scriptId: req.scriptId,
          functionName: req.functionName,
        });

        try {
          await googleClient.oauth2.getAccessToken();
          logger.info('Mid-execution token refresh successful, retrying script', {
            scriptId: req.scriptId,
          });

          result = await access.apiRequest<RunResponse>(
            'POST',
            `/scripts/${runTarget}:run`,
            body,
            SCRIPT_RUN_TIMEOUT_MS
          );
        } catch (retryError) {
          logger.error('Retry after token refresh failed', {
            retryError,
            scriptId: req.scriptId,
          });
          throw error;
        }
      } else {
        // AUDIT-2026-04-23 (artifact bug #22): translate a 404 against a
        // caller-supplied deploymentId into a structured error explaining
        // the HEAD-vs-runnable deployment distinction. Google's 404 alone
        // doesn't hint at the required manifest + version + deploy flow.
        const errMsg = error instanceof Error ? error.message : String(error);
        if (!req.devMode && req.deploymentId && /404|NOT_FOUND|not found/i.test(errMsg)) {
          return access.error({
            code: ErrorCodes.NOT_FOUND,
            message:
              `Deployment "${req.deploymentId}" was not found or is not runnable via scripts.run. ` +
              `HEAD deployments (the default entry returned by create/list_deployments when no ` +
              `explicit version has been published) are NOT runnable via the Apps Script API. ` +
              `You must create a real API Executable deployment first.`,
            retryable: false,
            suggestedFix:
              `Workflow to make deploymentId runnable: ` +
              `1) update_content to include an appsscript.json manifest with ` +
              `executionApi.access set to MYSELF (or DOMAIN/ANYONE as needed); ` +
              `2) create_version to freeze a numbered version; ` +
              `3) deploy with deploymentType: 'EXECUTION_API' + versionNumber; ` +
              `4) use the returned deploymentId to run. For ad-hoc testing of the latest ` +
              `code without deploying, use devMode: true (requires scriptId, not deploymentId).`,
          });
        }
        throw error;
      }
    }

    if (result.error) {
      const scriptError = result.error.details?.find((d) => d['@type']?.includes('ScriptError'));

      const rawMessage = scriptError?.errorMessage ?? result.error.message ?? 'Unknown error';

      const isBigQueryServiceMissing =
        /BigQuery\s+is\s+not\s+defined/i.test(rawMessage) ||
        (/BigQuery/i.test(rawMessage) && /not defined|undefined|ReferenceError/i.test(rawMessage));

      const errorMessage = isBigQueryServiceMissing
        ? `${rawMessage}\n\nThe BigQuery Advanced Service is not enabled for this script. ` +
          `To fix: open the script in Apps Script Editor → Services (+) → Add "BigQuery API". ` +
          `Then retry your function call.`
        : rawMessage;

      return access.success('run', {
        executionError: {
          errorMessage,
          errorType: scriptError?.errorType ?? undefined,
          scriptStackTraceElements: scriptError?.scriptStackTraceElements ?? undefined,
        },
      });
    }

    await sendProgress(2, 2, `Function '${req.functionName}' completed`);

    try {
      if (access.context.sessionContext) {
        access.context.sessionContext.recordOperation({
          tool: 'sheets_appsscript',
          action: 'run',
          spreadsheetId: req.scriptId,
          description: `Ran Apps Script function '${req.functionName}' in script ${req.scriptId}`,
          undoable: false,
        });
      }
    } catch {
      // Non-blocking: session context recording is best-effort
    }

    return access.success('run', {
      result: result.response?.result as
        | string
        | number
        | boolean
        | null
        | unknown[]
        | Record<string, unknown>
        | undefined,
    });
  } finally {
    activeRunExecutions--;
  }
}

export async function handleListProcesses(
  access: AppsScriptHandlerAccess,
  req: AppsScriptListProcessesInput
): Promise<AppsScriptResponse> {
  logger.info(`Listing processes${req.scriptId ? ` for: ${req.scriptId}` : ''}`);

  interface ListProcessesResponse {
    processes?: Array<{
      processId?: string;
      projectName?: string;
      functionName?: string;
      processType?: string;
      processStatus?: string;
      startTime?: string;
      duration?: string;
      userAccessLevel?: string;
    }>;
    nextPageToken?: string;
  }

  const params: string[] = [];
  if (req.functionName) {
    params.push(`userProcessFilter.functionName=${encodeURIComponent(req.functionName)}`);
  }
  if (req.processType) {
    params.push(`userProcessFilter.types=${encodeURIComponent(req.processType)}`);
  }
  if (req.processStatus) {
    params.push(`userProcessFilter.statuses=${encodeURIComponent(req.processStatus)}`);
  }
  if (req.pageSize) {
    params.push(`pageSize=${req.pageSize}`);
  }
  if (req.pageToken) {
    params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);
  }

  let path = req.scriptId
    ? `/projects/${encodeURIComponent(req.scriptId)}/processes`
    : '/processes';
  if (params.length > 0) path += `?${params.join('&')}`;

  const result = await access.apiRequest<ListProcessesResponse>('GET', path);

  return access.success('list_processes', {
    processes: (result.processes ?? []).map((p) => ({
      processId: p.processId ?? undefined,
      projectName: p.projectName ?? undefined,
      functionName: p.functionName ?? undefined,
      processType: (p.processType ?? undefined) as
        | 'EDITOR'
        | 'SIMPLE_TRIGGER'
        | 'TRIGGER'
        | 'WEBAPP'
        | 'EXECUTION_API'
        | 'ADD_ON'
        | 'TIME_DRIVEN'
        | 'MENU'
        | 'BATCH_TASK'
        | undefined,
      processStatus: (p.processStatus ?? undefined) as
        | 'COMPLETED'
        | 'FAILED'
        | 'RUNNING'
        | 'CANCELED'
        | 'TIMED_OUT'
        | 'UNKNOWN'
        | 'DELAYED'
        | 'PAUSED'
        | undefined,
      startTime: p.startTime ?? undefined,
      duration: p.duration ?? undefined,
      userAccessLevel: (p.userAccessLevel ?? undefined) as
        | 'OWNER'
        | 'READ'
        | 'WRITE'
        | 'NONE'
        | undefined,
    })),
    nextPageToken: result.nextPageToken ?? undefined,
  });
}

export async function handleGetMetrics(
  access: AppsScriptHandlerAccess,
  req: AppsScriptGetMetricsInput
): Promise<AppsScriptResponse> {
  logger.info(`Getting metrics for: ${req.scriptId}`);

  interface MetricsResponse {
    activeUsers?: Array<{ value?: string }>;
    totalExecutions?: Array<{ value?: string }>;
    failedExecutions?: Array<{ value?: string }>;
  }

  let path = `/projects/${req.scriptId}/metrics`;
  const params: string[] = [];
  if (req.granularity) {
    params.push(`metricsGranularity=${req.granularity}`);
  }
  if (req.deploymentId) {
    params.push(`metricsFilter.deploymentId=${encodeURIComponent(req.deploymentId)}`);
  }
  if (params.length > 0) path += `?${params.join('&')}`;

  const result = await access.apiRequest<MetricsResponse>('GET', path);

  return access.success('get_metrics', {
    metrics: {
      activeUsers: result.activeUsers ?? undefined,
      totalExecutions: result.totalExecutions ?? undefined,
      failedExecutions: result.failedExecutions ?? undefined,
    },
  });
}
