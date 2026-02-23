/**
 * ServalSheets - Apps Script Handler
 *
 * Handles sheets_appsscript tool (18 actions):
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
 * - create_trigger: Create time/event trigger
 * - list_triggers: List all triggers
 * - delete_trigger: Delete a trigger
 * - update_trigger: Update trigger settings
 *
 * APIs Used:
 * - Google Apps Script API (script.googleapis.com)
 *
 * IMPORTANT: Does NOT work with service accounts - requires OAuth user auth
 *
 * MCP Protocol: 2025-11-25
 */

import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import { AuthenticationError, ServiceError } from '../core/errors.js';
import type { Intent } from '../core/intent.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { executeWithRetry } from '../utils/retry.js';
import { getCircuitBreakerConfig } from '../config/env.js';
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
} from '../schemas/index.js';
import { logger } from '../utils/logger.js';

// Apps Script API base URL
const APPS_SCRIPT_API_BASE = 'https://script.googleapis.com/v1';

/**
 * Timeout constants per Google Apps Script API documentation
 * @see https://developers.google.com/apps-script/api/how-tos/execute
 *
 * Execution limits (Google docs):
 *   - Consumer accounts:  6 minutes  (360 seconds)
 *   - Workspace accounts: 30 minutes (1800 seconds)
 *
 * SCRIPT_RUN_TIMEOUT is the HTTP request timeout — must be >= script execution limit.
 * Using the Workspace limit (30 min + 60 s buffer) so long-running Workspace scripts
 * are not cut off prematurely. Consumer scripts complete well within this window.
 */
const SCRIPT_RUN_TIMEOUT_MS = 1_860_000; // 31 minutes (30 min Workspace limit + 60 s buffer)
const SCRIPT_ADMIN_TIMEOUT_MS = 30_000; // 30 seconds (metadata operations)

export class SheetsAppsScriptHandler extends BaseHandler<
  SheetsAppsScriptInput,
  SheetsAppsScriptOutput
> {
  private circuitBreaker: CircuitBreaker;

  constructor(context: HandlerContext) {
    super('sheets_appsscript', context);

    // Initialize circuit breaker for Apps Script API
    // Lower failure threshold (3 vs 5) due to lower quotas
    const circuitConfig = getCircuitBreakerConfig();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: circuitConfig.successThreshold,
      timeout: 60000, // 60 seconds (longer due to script execution time)
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
          response = await this.handleCreate(req as AppsScriptCreateInput);
          break;
        case 'get':
          response = await this.handleGet(req as AppsScriptGetInput);
          break;
        case 'get_content':
          response = await this.handleGetContent(req as AppsScriptGetContentInput);
          break;
        case 'update_content':
          response = await this.handleUpdateContent(req as AppsScriptUpdateContentInput);
          break;
        case 'create_version':
          response = await this.handleCreateVersion(req as AppsScriptCreateVersionInput);
          break;
        case 'list_versions':
          response = await this.handleListVersions(req as AppsScriptListVersionsInput);
          break;
        case 'get_version':
          response = await this.handleGetVersion(req as AppsScriptGetVersionInput);
          break;
        case 'deploy':
          response = await this.handleDeploy(req as AppsScriptDeployInput);
          break;
        case 'list_deployments':
          response = await this.handleListDeployments(req as AppsScriptListDeploymentsInput);
          break;
        case 'get_deployment':
          response = await this.handleGetDeployment(req as AppsScriptGetDeploymentInput);
          break;
        case 'undeploy':
          response = await this.handleUndeploy(req as AppsScriptUndeployInput);
          break;
        case 'run':
          response = await this.handleRun(req as AppsScriptRunInput);
          break;
        case 'list_processes':
          response = await this.handleListProcesses(req as AppsScriptListProcessesInput);
          break;
        case 'get_metrics':
          response = await this.handleGetMetrics(req as AppsScriptGetMetricsInput);
          break;
        case 'create_trigger':
          response = await this.handleCreateTrigger(req as AppsScriptCreateTriggerInput);
          break;
        case 'list_triggers':
          response = await this.handleListTriggers(req as AppsScriptListTriggersInput);
          break;
        case 'delete_trigger':
          response = await this.handleDeleteTrigger(req as AppsScriptDeleteTriggerInput);
          break;
        case 'update_trigger':
          response = await this.handleUpdateTrigger(req as AppsScriptUpdateTriggerInput);
          break;
        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
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

    // Set up abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    const options: RequestInit = {
      method,
      headers,
      signal: abortController.signal,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    logger.debug(`Apps Script API ${method} ${path} (timeout: ${timeoutMs}ms)`);

    // Wrap API call with retry + circuit breaker
    // Only retry network-level transport errors (not API-level ServiceErrors like 429/403
    // which are surfaced to the client with their original error codes)
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

    return await executeWithRetry(
      async (signal) => {
        return await this.circuitBreaker.execute(async () => {
          // Merge retry signal with our manual timeout signal
          const fetchController = new AbortController();
          signal.addEventListener('abort', () => fetchController.abort(signal.reason));

          try {
            const fetchOptions: RequestInit = { ...options, signal: fetchController.signal };
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            return await this.handleApiResponse<T>(response, path);
          } catch (error) {
            clearTimeout(timeoutId);

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
          }
        });
      },
      {
        timeoutMs,
        retryable: (error) => {
          // Don't retry API-level ServiceErrors — circuit breaker handles those
          if (error instanceof ServiceError) return false;
          const code =
            typeof (error as { code?: unknown }).code === 'string'
              ? (error as { code: string }).code
              : '';
          return RETRYABLE_NETWORK_CODES.has(code);
        },
      }
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
          { statusCode: 429, path, retryAfterMs, code: 'RATE_LIMIT' }
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
      return {} as T; // OK: Explicit empty for void operations
    }

    return JSON.parse(text) as T;
  }

  // ============================================================================
  // Project Management Actions
  // ============================================================================

  private async handleCreate(req: AppsScriptCreateInput): Promise<AppsScriptResponse> {
    logger.info(`Creating Apps Script project: ${req.title}`);

    interface CreateProjectRequest {
      title: string;
      parentId?: string;
    }

    interface ProjectResponse {
      scriptId: string;
      title: string;
      parentId?: string;
      createTime?: string;
      updateTime?: string;
      creator?: { email?: string; name?: string };
    }

    const body: CreateProjectRequest = {
      title: req.title,
    };

    if (req.parentId) {
      body.parentId = req.parentId;
    }

    const result = await this.apiRequest<ProjectResponse>('POST', '/projects', body);

    return this.success('create', {
      project: {
        scriptId: result.scriptId,
        title: result.title,
        parentId: result.parentId ?? undefined,
        createTime: result.createTime ?? undefined,
        updateTime: result.updateTime ?? undefined,
        creator: result.creator ?? undefined,
      },
    });
  }

  private async handleGet(req: AppsScriptGetInput): Promise<AppsScriptResponse> {
    logger.info(`Getting Apps Script project: ${req.scriptId}`);

    interface ProjectResponse {
      scriptId: string;
      title: string;
      parentId?: string;
      createTime?: string;
      updateTime?: string;
      creator?: { email?: string; name?: string };
    }

    const result = await this.apiRequest<ProjectResponse>('GET', `/projects/${req.scriptId}`);

    return this.success('get', {
      project: {
        scriptId: result.scriptId,
        title: result.title,
        parentId: result.parentId ?? undefined,
        createTime: result.createTime ?? undefined,
        updateTime: result.updateTime ?? undefined,
        creator: result.creator ?? undefined,
      },
    });
  }

  private async handleGetContent(req: AppsScriptGetContentInput): Promise<AppsScriptResponse> {
    logger.info(`Getting Apps Script content: ${req.scriptId}`);

    interface ContentResponse {
      scriptId: string;
      files: Array<{
        name: string;
        type: 'SERVER_JS' | 'HTML' | 'JSON';
        source: string;
        lastModifyUser?: { email?: string; name?: string };
        createTime?: string;
        updateTime?: string;
      }>;
    }

    let path = `/projects/${req.scriptId}/content`;
    if (req.versionNumber) {
      path += `?versionNumber=${req.versionNumber}`;
    }

    const result = await this.apiRequest<ContentResponse>('GET', path);

    return this.success('get_content', {
      files: result.files.map((f) => ({
        name: f.name,
        type: f.type,
        source: f.source,
        lastModifyUser: f.lastModifyUser ?? undefined,
        createTime: f.createTime ?? undefined,
        updateTime: f.updateTime ?? undefined,
      })),
    });
  }

  private async handleUpdateContent(
    req: AppsScriptUpdateContentInput
  ): Promise<AppsScriptResponse> {
    logger.info(`Updating Apps Script content: ${req.scriptId}`);

    interface ContentResponse {
      scriptId: string;
      files: Array<{
        name: string;
        type: 'SERVER_JS' | 'HTML' | 'JSON';
        source: string;
        lastModifyUser?: { email?: string; name?: string };
        createTime?: string;
        updateTime?: string;
      }>;
    }

    const body = {
      files: req.files.map((f) => ({
        name: f.name,
        type: f.type,
        source: f.source,
      })),
    };

    const result = await this.apiRequest<ContentResponse>(
      'PUT',
      `/projects/${req.scriptId}/content`,
      body
    );

    return this.success('update_content', {
      files: result.files.map((f) => ({
        name: f.name,
        type: f.type,
        source: f.source,
        lastModifyUser: f.lastModifyUser ?? undefined,
        createTime: f.createTime ?? undefined,
        updateTime: f.updateTime ?? undefined,
      })),
    });
  }

  // ============================================================================
  // Version Management Actions
  // ============================================================================

  private async handleCreateVersion(
    req: AppsScriptCreateVersionInput
  ): Promise<AppsScriptResponse> {
    logger.info(`Creating version for: ${req.scriptId}`);

    interface VersionResponse {
      versionNumber: number;
      description?: string;
      createTime?: string;
    }

    const body: { description?: string } = {};
    if (req.description) {
      body.description = req.description;
    }

    const result = await this.apiRequest<VersionResponse>(
      'POST',
      `/projects/${req.scriptId}/versions`,
      body
    );

    return this.success('create_version', {
      version: {
        versionNumber: result.versionNumber,
        description: result.description ?? undefined,
        createTime: result.createTime ?? undefined,
      },
    });
  }

  private async handleListVersions(req: AppsScriptListVersionsInput): Promise<AppsScriptResponse> {
    logger.info(`Listing versions for: ${req.scriptId}`);

    interface ListVersionsResponse {
      versions?: Array<{
        versionNumber: number;
        description?: string;
        createTime?: string;
      }>;
      nextPageToken?: string;
    }

    let path = `/projects/${req.scriptId}/versions`;
    const params: string[] = [];
    if (req.pageSize) params.push(`pageSize=${req.pageSize}`);
    if (req.pageToken) params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const result = await this.apiRequest<ListVersionsResponse>('GET', path);

    return this.success('list_versions', {
      versions: (result.versions ?? []).map((v) => ({
        versionNumber: v.versionNumber,
        description: v.description ?? undefined,
        createTime: v.createTime ?? undefined,
      })),
      nextPageToken: result.nextPageToken ?? undefined,
    });
  }

  private async handleGetVersion(req: AppsScriptGetVersionInput): Promise<AppsScriptResponse> {
    logger.info(`Getting version ${req.versionNumber} for: ${req.scriptId}`);

    interface VersionResponse {
      versionNumber: number;
      description?: string;
      createTime?: string;
    }

    const result = await this.apiRequest<VersionResponse>(
      'GET',
      `/projects/${req.scriptId}/versions/${req.versionNumber}`
    );

    return this.success('get_version', {
      version: {
        versionNumber: result.versionNumber,
        description: result.description ?? undefined,
        createTime: result.createTime ?? undefined,
      },
    });
  }

  // ============================================================================
  // Deployment Management Actions
  // ============================================================================

  private async handleDeploy(req: AppsScriptDeployInput): Promise<AppsScriptResponse> {
    logger.info(`Creating deployment for: ${req.scriptId}`);

    interface DeploymentResponse {
      deploymentId: string;
      deploymentConfig?: {
        description?: string;
        manifestFileName?: string;
        versionNumber?: number;
        scriptId?: string;
      };
      entryPoints?: Array<{
        entryPointType?: 'EXECUTION_API' | 'WEB_APP' | 'ADD_ON';
        webApp?: {
          url?: string;
          entryPointConfig?: {
            access?: 'MYSELF' | 'DOMAIN' | 'ANYONE' | 'ANYONE_ANONYMOUS';
            executeAs?: 'USER_ACCESSING' | 'USER_DEPLOYING';
          };
        };
        executionApi?: {
          entryPointConfig?: {
            access?: 'MYSELF' | 'DOMAIN' | 'ANYONE' | 'ANYONE_ANONYMOUS';
          };
        };
      }>;
      updateTime?: string;
    }

    interface DeploymentConfig {
      scriptId: string;
      description?: string;
      versionNumber?: number;
    }

    const deploymentConfig: DeploymentConfig = {
      scriptId: req.scriptId,
    };

    if (req.description) {
      deploymentConfig.description = req.description;
    }

    if (req.versionNumber) {
      deploymentConfig.versionNumber = req.versionNumber;
    }

    const result = await this.apiRequest<DeploymentResponse>(
      'POST',
      `/projects/${req.scriptId}/deployments`,
      deploymentConfig
    );

    // Extract web app URL if available
    const webAppEntry = result.entryPoints?.find((e) => e.entryPointType === 'WEB_APP');
    const webAppUrl = webAppEntry?.webApp?.url;

    // Warn if ignored params were provided
    const ignoredParams: string[] = [];
    if ((req as { deploymentType?: string }).deploymentType) ignoredParams.push('deploymentType');
    if ((req as { access?: string }).access) ignoredParams.push('access');
    if ((req as { executeAs?: string }).executeAs) ignoredParams.push('executeAs');

    return this.success('deploy', {
      deployment: {
        deploymentId: result.deploymentId,
        versionNumber: result.deploymentConfig?.versionNumber ?? undefined,
        deploymentConfig: result.deploymentConfig ?? undefined,
        entryPoints: result.entryPoints ?? undefined,
        updateTime: result.updateTime ?? undefined,
      },
      webAppUrl: webAppUrl ?? undefined,
      ...(ignoredParams.length > 0 && {
        warning: `The following parameters are not supported by the Deployments API and were ignored: ${ignoredParams.join(', ')}. To configure these settings, update appsscript.json via the update_content action before deploying.`,
      }),
    });
  }

  private async handleListDeployments(
    req: AppsScriptListDeploymentsInput
  ): Promise<AppsScriptResponse> {
    logger.info(`Listing deployments for: ${req.scriptId}`);

    interface ListDeploymentsResponse {
      deployments?: Array<{
        deploymentId: string;
        deploymentConfig?: {
          description?: string;
          manifestFileName?: string;
          versionNumber?: number;
          scriptId?: string;
        };
        entryPoints?: Array<{
          entryPointType?: 'EXECUTION_API' | 'WEB_APP' | 'ADD_ON';
          webApp?: {
            url?: string;
            entryPointConfig?: {
              access?: 'MYSELF' | 'DOMAIN' | 'ANYONE' | 'ANYONE_ANONYMOUS';
              executeAs?: 'USER_ACCESSING' | 'USER_DEPLOYING';
            };
          };
          executionApi?: {
            entryPointConfig?: {
              access?: 'MYSELF' | 'DOMAIN' | 'ANYONE' | 'ANYONE_ANONYMOUS';
            };
          };
        }>;
        updateTime?: string;
      }>;
      nextPageToken?: string;
    }

    let path = `/projects/${req.scriptId}/deployments`;
    const params: string[] = [];
    if (req.pageSize) params.push(`pageSize=${req.pageSize}`);
    if (req.pageToken) params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const result = await this.apiRequest<ListDeploymentsResponse>('GET', path);

    return this.success('list_deployments', {
      deployments: (result.deployments ?? []).map((d) => ({
        deploymentId: d.deploymentId,
        versionNumber: d.deploymentConfig?.versionNumber ?? undefined,
        deploymentConfig: d.deploymentConfig ?? undefined,
        entryPoints: d.entryPoints ?? undefined,
        updateTime: d.updateTime ?? undefined,
      })),
      nextPageToken: result.nextPageToken ?? undefined,
    });
  }

  private async handleGetDeployment(
    req: AppsScriptGetDeploymentInput
  ): Promise<AppsScriptResponse> {
    logger.info(`Getting deployment ${req.deploymentId} for: ${req.scriptId}`);

    interface DeploymentResponse {
      deploymentId: string;
      deploymentConfig?: {
        description?: string;
        manifestFileName?: string;
        versionNumber?: number;
        scriptId?: string;
      };
      entryPoints?: Array<{
        entryPointType?: 'EXECUTION_API' | 'WEB_APP' | 'ADD_ON';
        webApp?: {
          url?: string;
          entryPointConfig?: {
            access?: 'MYSELF' | 'DOMAIN' | 'ANYONE' | 'ANYONE_ANONYMOUS';
            executeAs?: 'USER_ACCESSING' | 'USER_DEPLOYING';
          };
        };
        executionApi?: {
          entryPointConfig?: {
            access?: 'MYSELF' | 'DOMAIN' | 'ANYONE' | 'ANYONE_ANONYMOUS';
          };
        };
      }>;
      updateTime?: string;
    }

    const result = await this.apiRequest<DeploymentResponse>(
      'GET',
      `/projects/${req.scriptId}/deployments/${req.deploymentId}`
    );

    return this.success('get_deployment', {
      deployment: {
        deploymentId: result.deploymentId,
        versionNumber: result.deploymentConfig?.versionNumber ?? undefined,
        deploymentConfig: result.deploymentConfig ?? undefined,
        entryPoints: result.entryPoints ?? undefined,
        updateTime: result.updateTime ?? undefined,
      },
    });
  }

  private async handleUndeploy(req: AppsScriptUndeployInput): Promise<AppsScriptResponse> {
    logger.info(`Deleting deployment ${req.deploymentId} for: ${req.scriptId}`);

    await this.apiRequest<Record<string, never>>(
      'DELETE',
      `/projects/${req.scriptId}/deployments/${req.deploymentId}`
    );

    return this.success('undeploy', {});
  }

  // ============================================================================
  // Execution Actions
  // ============================================================================

  private async handleRun(req: AppsScriptRunInput): Promise<AppsScriptResponse> {
    logger.info(`Running function ${req.functionName} in: ${req.scriptId}`);

    // Safety gate: dryRun returns early without executing
    const safety = (
      req as typeof req & { safety?: { dryRun?: boolean; requireConfirmation?: boolean } }
    ).safety;
    if (safety?.dryRun) {
      return this.success('run', {
        dryRun: true,
        message: `[DRY RUN] Would execute function '${req.functionName}' in script ${req.scriptId}. No changes made.`,
      });
    }

    // Safety gate: requireConfirmation asks user before executing
    if (safety?.requireConfirmation) {
      const confirmed = await this.confirmOperation(
        `Execute Apps Script function '${req.functionName}'`,
        `Script ID: ${req.scriptId}. This will run code with side effects.`,
        { isDestructive: true, operationType: 'apps_script_run' },
        { skipIfElicitationUnavailable: false }
      );
      if (!confirmed) {
        return this.error({
          code: 'OPERATION_CANCELLED',
          message: 'Execution cancelled by user.',
          retryable: false,
        });
      }
    }

    // Pre-flight token check: Refresh if expiring within 360 seconds (6 minutes)
    // This prevents mid-execution auth failures for long-running scripts
    const googleClient = this.context.googleClient;
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

          // Force token refresh by calling getAccessToken()
          try {
            await googleClient.oauth2.getAccessToken();
            logger.info('Token pre-refresh successful', { scriptId: req.scriptId });
          } catch (error) {
            logger.warn('Token pre-refresh failed', { error, scriptId: req.scriptId });
            // Continue anyway - the refresh might happen during the request
          }
        }
      }
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

    const body: RunRequest = {
      function: req.functionName,
    };

    if (req.parameters) {
      body.parameters = req.parameters;
    }

    if (req.devMode) {
      body.devMode = req.devMode;
    }

    // Use 380s timeout for script execution (6 min max + overhead)
    let result: RunResponse;
    try {
      result = await this.apiRequest<RunResponse>(
        'POST',
        `/scripts/${req.scriptId}:run`,
        body,
        SCRIPT_RUN_TIMEOUT_MS
      );
    } catch (error) {
      // Retry once on 401 auth error (token may have expired during execution)
      if (
        error instanceof ServiceError &&
        error.code === 'AUTH_ERROR' &&
        error.message.includes('Authentication')
      ) {
        logger.warn('Auth error during script execution, refreshing token and retrying', {
          scriptId: req.scriptId,
          functionName: req.functionName,
        });

        // Force token refresh
        if (googleClient) {
          try {
            await googleClient.oauth2.getAccessToken();
            logger.info('Mid-execution token refresh successful, retrying script', {
              scriptId: req.scriptId,
            });

            // Retry the request with fresh token
            result = await this.apiRequest<RunResponse>(
              'POST',
              `/scripts/${req.scriptId}:run`,
              body,
              SCRIPT_RUN_TIMEOUT_MS
            );
          } catch (retryError) {
            logger.error('Retry after token refresh failed', {
              retryError,
              scriptId: req.scriptId,
            });
            throw error; // Throw original error
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Check for execution error
    if (result.error) {
      const scriptError = result.error.details?.find((d) => d['@type']?.includes('ScriptError'));

      return this.success('run', {
        executionError: {
          errorMessage: scriptError?.errorMessage ?? result.error.message ?? 'Unknown error',
          errorType: scriptError?.errorType ?? undefined,
          scriptStackTraceElements: scriptError?.scriptStackTraceElements ?? undefined,
        },
      });
    }

    return this.success('run', {
      result: result.response?.result,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  private async handleListProcesses(
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

    // Build query parameters for GET request (per Google Apps Script API spec)
    const params: string[] = [];
    if (req.scriptId) {
      params.push(`scriptProcessFilter.scriptId=${encodeURIComponent(req.scriptId)}`);
    }
    if (req.functionName) {
      params.push(`scriptProcessFilter.functionName=${encodeURIComponent(req.functionName)}`);
    }
    if (req.processType) {
      params.push(`scriptProcessFilter.types=${encodeURIComponent(req.processType)}`);
    }
    if (req.processStatus) {
      params.push(`scriptProcessFilter.statuses=${encodeURIComponent(req.processStatus)}`);
    }
    if (req.pageSize) {
      params.push(`pageSize=${req.pageSize}`);
    }
    if (req.pageToken) {
      params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);
    }

    let path = '/processes:listScriptProcesses';
    if (params.length > 0) path += `?${params.join('&')}`;

    const result = await this.apiRequest<ListProcessesResponse>(
      'GET',
      path
    );

    return this.success('list_processes', {
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

  private async handleGetMetrics(req: AppsScriptGetMetricsInput): Promise<AppsScriptResponse> {
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

    const result = await this.apiRequest<MetricsResponse>('GET', path);

    return this.success('get_metrics', {
      metrics: {
        activeUsers: result.activeUsers ?? undefined,
        totalExecutions: result.totalExecutions ?? undefined,
        failedExecutions: result.failedExecutions ?? undefined,
      },
    });
  }

  // ============================================================================
  // Trigger Management (4 actions)
  // ============================================================================

  /**
   * Create a time-driven or event-driven trigger.
   * Uses the Apps Script API triggers endpoint.
   */
  private async handleCreateTrigger(
    _req: AppsScriptCreateTriggerInput
  ): Promise<AppsScriptResponse> {
    return this.error({
      code: 'NOT_IMPLEMENTED',
      message:
        'Trigger management requires in-script ScriptApp.newTrigger(). ' +
        'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
        'Use update_content to add trigger code to your script, then deploy it.',
      retryable: false,
    });
  }

  /**
   * List all triggers for a script project.
   */
  private async handleListTriggers(_req: AppsScriptListTriggersInput): Promise<AppsScriptResponse> {
    return this.error({
      code: 'NOT_IMPLEMENTED',
      message:
        'Trigger management requires in-script ScriptApp APIs. ' +
        'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
        'Use get_content to inspect trigger setup code in the script project.',
      retryable: false,
    });
  }

  /**
   * Delete a specific trigger by ID.
   */
  private async handleDeleteTrigger(
    _req: AppsScriptDeleteTriggerInput
  ): Promise<AppsScriptResponse> {
    return this.error({
      code: 'NOT_IMPLEMENTED',
      message:
        'Trigger management requires in-script ScriptApp APIs. ' +
        'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
        'Use update_content to modify trigger code in the script project.',
      retryable: false,
    });
  }

  /**
   * Update a trigger by deleting and recreating it.
   * Apps Script API doesn't support PATCH on triggers, so we delete + create.
   */
  private async handleUpdateTrigger(
    _req: AppsScriptUpdateTriggerInput
  ): Promise<AppsScriptResponse> {
    return this.error({
      code: 'NOT_IMPLEMENTED',
      message:
        'Trigger management requires in-script ScriptApp APIs. ' +
        'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
        'Use update_content to modify trigger code in the script project.',
      retryable: false,
    });
  }
}
