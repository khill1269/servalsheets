/**
 * ServalSheets - Apps Script Handler
 *
 * Handles sheets_appsscript tool (19 actions):
 * - create: Create new Apps Script project
 * - get: Get project metadata
 * - get_content: Get script files and code
 * - update_content: Update script files
 * - create_version: Create immutable version
 * - list_versions: List all versions
 * - get_version: Get specific version
 * - deploy: Create deployment (web app/API)
 * - list_deployments: List all deployments
 * - get_deployment: Get deployment details
 * - undeploy: Delete deployment
 * - run: Execute script function
 * - list_processes: Get execution logs
 * - get_metrics: Get usage metrics
 * - create_trigger: Create time/event trigger (NOT_IMPLEMENTED)
 * - list_triggers: List all triggers (NOT_IMPLEMENTED)
 * - delete_trigger: Delete a trigger (NOT_IMPLEMENTED)
 * - update_trigger: Update trigger settings (NOT_IMPLEMENTED)
 * - install_serval_function: Install SERVAL() formula
 *
 * APIs Used:
 * - Google Apps Script API (script.googleapis.com)
 *
 * IMPORTANT: Does NOT work with service accounts - requires OAuth user auth
 *
 * MCP Protocol: 2025-11-25
 *
 * Action implementations decomposed into appsscript-actions/ submodules.
 */

import { ErrorCodes } from './error-codes.js';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import { AuthenticationError, ServiceError } from '../core/errors.js';
import type { Intent } from '../core/intent.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { executeWithRetry } from '../utils/retry.js';
import { getRequestAbortSignal, sendProgress } from '../utils/request-context.js';
import { getApiSpecificCircuitBreakerConfig, getEnv } from '../config/env.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import type {
  SheetsAppsScriptInput,
  SheetsAppsScriptOutput,
  AppsScriptResponse,
  AppsScriptRequest,
  AppsScriptCreateInput,
  AppsScriptGetInput,
  AppsScriptGetContentInput,
  AppsScriptUpdateContentInput,
  AppsScriptCreateVersionInput,
  AppsScriptListVersionsInput,
  AppsScriptGetVersionInput,
  AppsScriptDeployInput,
  AppsScriptListDeploymentsInput,
  AppsScriptGetDeploymentInput,
  AppsScriptUndeployInput,
  AppsScriptRunInput,
  AppsScriptListProcessesInput,
  AppsScriptGetMetricsInput,
  AppsScriptCreateTriggerInput,
  AppsScriptListTriggersInput,
  AppsScriptDeleteTriggerInput,
  AppsScriptUpdateTriggerInput,
  AppsScriptInstallServalFunctionInput,
} from '../schemas/index.js';
import { logger } from '../utils/logger.js';

// Submodule imports
import {
  handleCreate,
  handleGet,
  handleGetContent,
  handleUpdateContent,
} from './appsscript-actions/project-operations.js';
import {
  handleCreateVersion,
  handleListVersions,
  handleGetVersion,
  handleDeploy,
  handleListDeployments,
  handleGetDeployment,
  handleUndeploy,
} from './appsscript-actions/version-deploy-operations.js';
import {
  handleRun,
  handleListProcesses,
  handleGetMetrics,
  setMaxConcurrentRuns,
} from './appsscript-actions/execution-operations.js';
import {
  handleCreateTrigger,
  handleListTriggers,
  handleDeleteTrigger,
  handleUpdateTrigger,
} from './appsscript-actions/trigger-operations.js';
import { handleInstallServalFunction } from './appsscript-actions/serval-installer.js';
import type { AppsScriptHandlerAccess } from './appsscript-actions/internal.js';

// Apps Script API base URL
const APPS_SCRIPT_API_BASE = 'https://script.googleapis.com/v1';

/**
 * Timeout constants per Google Apps Script API documentation
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 *
 * Apps Script executions are limited to 6 minutes per run.
 * Keep the client timeout slightly above that documented limit so run() calls
 * are not cut off before Apps Script itself aborts the execution.
 */
const SCRIPT_ADMIN_TIMEOUT_MS = 30_000; // 30 seconds (metadata operations)

export class SheetsAppsScriptHandler extends BaseHandler<
  SheetsAppsScriptInput,
  SheetsAppsScriptOutput
> {
  private static readonly BOUND_SCRIPT_CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly boundScriptCache = new Map<
    string,
    { scriptId: string; cachedAt: number }
  >();

  private static rememberBoundScript(spreadsheetId: string, scriptId: string): void {
    SheetsAppsScriptHandler.boundScriptCache.set(spreadsheetId, {
      scriptId,
      cachedAt: Date.now(),
    });
  }

  private static getRememberedBoundScript(spreadsheetId: string): string | undefined {
    const cached = SheetsAppsScriptHandler.boundScriptCache.get(spreadsheetId);
    if (!cached) {
      return undefined;
    }

    if (Date.now() - cached.cachedAt > SheetsAppsScriptHandler.BOUND_SCRIPT_CACHE_TTL_MS) {
      SheetsAppsScriptHandler.boundScriptCache.delete(spreadsheetId);
      return undefined;
    }

    return cached.scriptId;
  }

  private circuitBreaker: CircuitBreaker;
  private handlerAccess: AppsScriptHandlerAccess;

  constructor(context: HandlerContext) {
    super('sheets_appsscript', context);

    // Initialize circuit breaker for Apps Script API
    const appsscriptConfig = getApiSpecificCircuitBreakerConfig('appsscript');
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: appsscriptConfig.failureThreshold,
      successThreshold: appsscriptConfig.successThreshold,
      timeout: appsscriptConfig.timeout,
      name: 'appsscript-api',
    });

    // Register fallback strategy for circuit breaker
    this.circuitBreaker.registerFallback({
      name: 'appsscript-unavailable-fallback',
      priority: 1,
      shouldUse: () => true,
      execute: async () => {
        throw new ServiceError(
          'Apps Script API temporarily unavailable due to repeated failures. Check quota limits and try again in 60 seconds.',
          'UNAVAILABLE',
          'appsscript-api',
          true,
          { circuitBreaker: 'appsscript-api', retryAfterSeconds: 60 }
        );
      },
    });

    // Register with global registry
    circuitBreakerRegistry.register(
      'appsscript-api',
      this.circuitBreaker,
      'Apps Script API circuit breaker'
    );

    // Initialize max concurrent runs for execution operations
    setMaxConcurrentRuns(getEnv().APPSSCRIPT_MAX_CONCURRENT_RUNS);

    // Build handler access object for submodules
    this.handlerAccess = {
      success: (action, data) => this.success(action, data),
      error: (e) => this.error(e),
      context,
      apiRequest: <T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        body?: unknown,
        timeoutMs?: number
      ) => this.apiRequest<T>(method, path, body, timeoutMs),
      resolveScriptIdFromSpreadsheet: (spreadsheetId) =>
        this.resolveScriptIdFromSpreadsheet(spreadsheetId),
      rememberBoundScript: (spreadsheetId, scriptId) =>
        SheetsAppsScriptHandler.rememberBoundScript(spreadsheetId, scriptId),
    };
  }

  async handle(input: SheetsAppsScriptInput): Promise<SheetsAppsScriptOutput> {
    // 1. Unwrap request from wrapper
    const rawReq = unwrapRequest<SheetsAppsScriptInput['request']>(input);

    // 2. Require auth
    this.requireAuth();

    try {
      // 3. Dispatch to action handler
      const req = rawReq as AppsScriptRequest;
      let response: AppsScriptResponse;

      switch (req.action) {
        case 'create':
          response = await handleCreate(this.handlerAccess, req as AppsScriptCreateInput);
          break;
        case 'get': {
          const getReq = await this.ensureScriptId(req as AppsScriptGetInput);
          response = await handleGet(this.handlerAccess, getReq);
          break;
        }
        case 'get_content': {
          const getContentReq = await this.ensureScriptId(req as AppsScriptGetContentInput);
          response = await handleGetContent(this.handlerAccess, getContentReq);
          break;
        }
        case 'update_content': {
          const updateContentReq = await this.ensureScriptId(req as AppsScriptUpdateContentInput);
          response = await handleUpdateContent(this.handlerAccess, updateContentReq);
          break;
        }
        case 'create_version':
          response = await handleCreateVersion(this.handlerAccess, req as AppsScriptCreateVersionInput);
          break;
        case 'list_versions':
          response = await handleListVersions(this.handlerAccess, req as AppsScriptListVersionsInput);
          break;
        case 'get_version':
          response = await handleGetVersion(this.handlerAccess, req as AppsScriptGetVersionInput);
          break;
        case 'deploy':
          response = await handleDeploy(this.handlerAccess, req as AppsScriptDeployInput);
          break;
        case 'list_deployments':
          response = await handleListDeployments(
            this.handlerAccess,
            req as AppsScriptListDeploymentsInput
          );
          break;
        case 'get_deployment':
          response = await handleGetDeployment(this.handlerAccess, req as AppsScriptGetDeploymentInput);
          break;
        case 'undeploy':
          response = await handleUndeploy(this.handlerAccess, req as AppsScriptUndeployInput);
          break;
        case 'run':
          response = await handleRun(this.handlerAccess, req as AppsScriptRunInput);
          break;
        case 'list_processes':
          response = await handleListProcesses(
            this.handlerAccess,
            req as AppsScriptListProcessesInput
          );
          break;
        case 'get_metrics':
          response = await handleGetMetrics(this.handlerAccess, req as AppsScriptGetMetricsInput);
          break;
        case 'create_trigger': {
          const createTriggerReq = await this.ensureScriptId(req as AppsScriptCreateTriggerInput);
          response = handleCreateTrigger(this.handlerAccess, createTriggerReq);
          break;
        }
        case 'list_triggers': {
          const listTriggersReq = await this.ensureScriptId(req as AppsScriptListTriggersInput);
          response = handleListTriggers(this.handlerAccess, listTriggersReq);
          break;
        }
        case 'delete_trigger': {
          const deleteTriggerReq = await this.ensureScriptId(req as AppsScriptDeleteTriggerInput);
          response = handleDeleteTrigger(this.handlerAccess, deleteTriggerReq);
          break;
        }
        case 'update_trigger': {
          const updateTriggerReq = await this.ensureScriptId(req as AppsScriptUpdateTriggerInput);
          response = handleUpdateTrigger(this.handlerAccess, updateTriggerReq);
          break;
        }
        case 'install_serval_function':
          response = await handleInstallServalFunction(
            this.handlerAccess,
            req as AppsScriptInstallServalFunctionInput
          );
          break;
        default: {
          const _exhaustiveCheck: never = req;
          response = this.error({
            code: ErrorCodes.INVALID_PARAMS,
            message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
        }
      }

      // 4. Apply verbosity filtering if needed
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      // 5. Return wrapped response
      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  // Required by BaseHandler
  protected createIntents(_input: SheetsAppsScriptInput): Intent[] {
    return []; // Apps Script doesn't use batch operations
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Resolve scriptId from spreadsheetId via Drive API.
   * Looks for bound Apps Script projects (mimeType: application/vnd.google-apps.script)
   * that are children of the given spreadsheet.
   *
   * FIX P1-1: LLMs often only have the spreadsheetId, not the scriptId.
   * This method bridges the gap by querying the Drive API.
   */
  private async resolveScriptIdFromSpreadsheet(spreadsheetId: string): Promise<string> {
    const googleClient = this.context.googleClient;
    if (!googleClient) {
      throw new AuthenticationError(
        'No Google client available - authentication required',
        'AUTH_ERROR',
        false,
        { service: 'AppsScript' }
      );
    }

    logger.debug(`Resolving scriptId from spreadsheetId: ${spreadsheetId}`);
    await sendProgress(0, 1, `Resolving Apps Script project for spreadsheet ${spreadsheetId}...`);

    const cachedScriptId = SheetsAppsScriptHandler.getRememberedBoundScript(spreadsheetId);
    if (cachedScriptId) {
      logger.debug(`Resolved scriptId from in-memory cache: ${cachedScriptId}`);
      return cachedScriptId;
    }

    try {
      const drive = googleClient.drive;
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const listBoundScripts = async () =>
        await drive.files.list({
          q: `'${spreadsheetId}' in parents and mimeType = 'application/vnd.google-apps.script' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 5,
        });

      let files = (await listBoundScripts()).data.files;
      if (!files || files.length === 0) {
        const retryDelaysMs = [300, 700];
        for (const delayMs of retryDelaysMs) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          files = (await listBoundScripts()).data.files;
          if (files && files.length > 0) {
            break;
          }
        }
      }

      if (!files || files.length === 0) {
        throw new ServiceError(
          `No bound Apps Script project found for spreadsheet ${spreadsheetId}. ` +
            `The spreadsheet may not have a bound script. Use action "create" with parentId to create one.`,
          ErrorCodes.NOT_FOUND,
          'drive-api',
          false,
          {
            spreadsheetId,
            hint: 'Use sheets_appsscript action "create" with parentId set to the spreadsheetId',
          }
        );
      }

      const firstFile = files[0];
      const scriptId = firstFile?.id;
      if (!scriptId) {
        throw new ServiceError(
          `Drive API returned a file without an ID for spreadsheet ${spreadsheetId}`,
          ErrorCodes.INTERNAL_ERROR,
          'drive-api',
          true,
          { spreadsheetId }
        );
      }
      logger.info(
        `Resolved scriptId: ${scriptId} (from spreadsheet: ${spreadsheetId}, script name: ${firstFile?.name ?? 'unknown'})`
      );
      SheetsAppsScriptHandler.rememberBoundScript(spreadsheetId, scriptId);
      return scriptId;
    } catch (err) {
      if (err instanceof ServiceError) throw err;
      throw new ServiceError(
        `Failed to resolve Apps Script project from spreadsheet: ${(err as Error).message}`,
        ErrorCodes.INTERNAL_ERROR,
        'drive-api',
        true,
        { spreadsheetId }
      );
    }
  }

  /**
   * Ensure scriptId is present on the request. If only spreadsheetId is provided,
   * auto-resolve scriptId via Drive API lookup.
   *
   * FIX P1-1: Allows callers to pass spreadsheetId instead of scriptId for
   * metadata, content, and trigger-management actions.
   */
  private async ensureScriptId<T extends { scriptId?: string; spreadsheetId?: string }>(
    req: T
  ): Promise<T & { scriptId: string }> {
    if (req.scriptId) {
      return req as T & { scriptId: string };
    }
    if (req.spreadsheetId) {
      const scriptId = await this.resolveScriptIdFromSpreadsheet(req.spreadsheetId);
      return { ...req, scriptId };
    }
    throw new ServiceError(
      'Either scriptId or spreadsheetId must be provided',
      ErrorCodes.INVALID_PARAMS,
      'appsscript',
      false,
      { hint: 'Provide scriptId (from script URL) or spreadsheetId (to auto-resolve bound script)' }
    );
  }

  /**
   * Make authenticated request to Apps Script API
   */
  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    timeoutMs: number = SCRIPT_ADMIN_TIMEOUT_MS
  ): Promise<T> {
    // Get access token from the Google client
    const googleClient = this.context.googleClient;
    if (!googleClient) {
      throw new AuthenticationError(
        'No Google client available - authentication required',
        'AUTH_ERROR',
        false,
        { service: 'AppsScript' }
      );
    }

    // Access token is available via the oauth2 credentials
    const credentials = googleClient.oauth2.credentials;
    const token = credentials.access_token;
    if (!token) {
      throw new AuthenticationError(
        'No access token available - authentication required',
        'AUTH_ERROR',
        true, // Retryable - user can re-authenticate
        { service: 'AppsScript' }
      );
    }

    const url = `${APPS_SCRIPT_API_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const requestBody =
      body && (method === 'POST' || method === 'PUT') ? JSON.stringify(body) : undefined;

    logger.debug(`Apps Script API ${method} ${path} (timeout: ${timeoutMs}ms)`);

    const RETRYABLE_NETWORK_CODES = new Set([
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EAI_AGAIN',
      'ENOTFOUND',
      'ENETUNREACH',
      'ECONNABORTED',
      'ERR_HTTP2_GOAWAY_SESSION',
      'ERR_HTTP2_SESSION_ERROR',
      'ERR_HTTP2_STREAM_CANCEL',
    ]);

    // Run retries inside the circuit breaker operation so transient 429/5xx retries
    // do not each count as separate breaker failures.
    return await this.circuitBreaker.execute(async () =>
      executeWithRetry(
        async (signal) => {
          // Merge retry signal + manual timeout signal + MCP cancellation signal (ISSUE-119)
          const fetchController = new AbortController();
          const requestAbortSignal = getRequestAbortSignal() ?? this.context.abortSignal;
          const timeoutId = setTimeout(() => fetchController.abort('request timeout'), timeoutMs);
          const cleanupFns: Array<() => void> = [];

          const forwardAbort = (source: AbortSignal | undefined, fallbackReason: string): void => {
            if (!source) {
              return;
            }

            const onAbort = (): void => {
              fetchController.abort(source.reason ?? fallbackReason);
            };
            if (source.aborted) {
              onAbort();
              return;
            }

            source.addEventListener('abort', onAbort, { once: true });
            cleanupFns.push(() => source.removeEventListener('abort', onAbort));
          };

          forwardAbort(signal, 'retry timeout');
          // ISSUE-119: Wire context abortSignal so client cancellation (notifications/cancelled)
          // terminates the long-running Apps Script HTTP request immediately.
          forwardAbort(requestAbortSignal, 'MCP request cancelled by client');

          try {
            const fetchOptions: RequestInit = {
              method,
              headers,
              body: requestBody,
              signal: fetchController.signal,
            };
            const response = await fetch(url, fetchOptions);
            return await this.handleApiResponse<T>(response, path);
          } catch (error) {
            // Handle timeout/abort
            if (error instanceof Error && error.name === 'AbortError') {
              throw new ServiceError(
                `Apps Script API request timed out after ${timeoutMs}ms`,
                'DEADLINE_EXCEEDED',
                'AppsScript',
                true,
                { method, path, timeoutMs }
              );
            }

            throw error;
          } finally {
            clearTimeout(timeoutId);
            cleanupFns.forEach((cleanup) => cleanup());
          }
        },
        {
          timeoutMs,
          retryable: (error) => {
            if (error instanceof ServiceError) {
              return error.retryable;
            }
            const code =
              typeof (error as { code?: unknown }).code === 'string'
                ? (error as { code: string }).code
                : '';
            return RETRYABLE_NETWORK_CODES.has(code);
          },
        }
      )
    );
  }

  private async handleApiResponse<T>(response: Response, path: string): Promise<T> {
    if (!response.ok) {
      // Handle 429 rate limiting before other error processing
      if (response.status === 429) {
        const retryAfter = response.headers?.get('retry-after');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
        throw new ServiceError(
          'Apps Script API rate limit exceeded. Try again later.',
          'UNAVAILABLE',
          'AppsScript',
          true,
          { statusCode: 429, path, retryAfterMs, code: ErrorCodes.RATE_LIMITED }
        );
      }

      const errorBody = await response.text();
      let errorMessage = `Apps Script API error: ${response.status} ${response.statusText}`;
      let errorCode:
        | 'UNAVAILABLE'
        | 'SERVICE_NOT_ENABLED'
        | 'PERMISSION_DENIED'
        | 'INVALID_PARAMS'
        | 'NOT_FOUND'
        | 'AUTH_ERROR' = 'UNAVAILABLE';
      let retryable = response.status >= 500; // Retryable for server errors
      let resolution: string | undefined;

      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }

      // BUG FIX 0.9: Enhance error handling with prerequisite guidance
      if (response.status === 403) {
        // Forbidden - likely API not enabled or missing scopes
        if (errorMessage.includes('has not been used')) {
          // API not enabled
          errorCode = 'SERVICE_NOT_ENABLED';
          errorMessage = `Google Apps Script API is not enabled. ${errorMessage}`;
          resolution =
            'Enable the Apps Script API in your Google Cloud Console: ' +
            '1. Go to https://console.cloud.google.com/apis/library/script.googleapis.com ' +
            '2. Click "Enable" ' +
            '3. Wait a few minutes for the change to propagate ' +
            '4. Retry your request';
          retryable = false;
        } else if (
          errorMessage.includes('Insufficient Permission') ||
          errorMessage.includes('permission')
        ) {
          // Missing OAuth scopes
          errorCode = 'PERMISSION_DENIED';
          errorMessage = `Insufficient OAuth permissions for Apps Script API. ${errorMessage}`;
          resolution =
            'Required OAuth scopes: ' +
            'https://www.googleapis.com/auth/script.projects (manage projects), ' +
            'https://www.googleapis.com/auth/script.deployments (manage deployments), ' +
            'https://www.googleapis.com/auth/script.processes (view execution logs). ' +
            'Re-authenticate with sheets_auth to grant these scopes.';
          retryable = true; // User can re-authenticate
        }
      } else if (response.status === 400) {
        // Bad Request - invalid parameters
        errorCode = 'INVALID_PARAMS';
        retryable = false;
      } else if (response.status === 404) {
        // Not Found
        errorCode = 'NOT_FOUND';
        errorMessage = `Apps Script resource not found. ${errorMessage}`;
        retryable = false;
      } else if (response.status === 401) {
        // Unauthorized - token expired
        errorCode = 'AUTH_ERROR';
        errorMessage = `Authentication failed for Apps Script API. ${errorMessage}`;
        resolution = 'Re-authenticate using sheets_auth tool.';
        retryable = true;
      }

      throw new ServiceError(errorMessage, errorCode, 'AppsScript', retryable, {
        statusCode: response.status,
        path,
        resolution,
      });
    }

    // Handle empty responses (e.g., DELETE operations return no body)
    const text = await response.text();
    if (!text) {
      logger.debug('Empty response body - OK for DELETE/void operations');
      return {} as unknown as T; // OK: Explicit empty for void operations (DELETE returns no body)
    }

    return JSON.parse(text) as T;
  }

}
