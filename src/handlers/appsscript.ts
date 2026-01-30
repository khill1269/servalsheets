/**
 * ServalSheets - Apps Script Handler
 *
 * Handles sheets_appsscript tool (14 actions):
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
} from '../schemas/index.js';
import { logger } from '../utils/logger.js';

// Apps Script API base URL
const APPS_SCRIPT_API_BASE = 'https://script.googleapis.com/v1';

export class SheetsAppsScriptHandler extends BaseHandler<
  SheetsAppsScriptInput,
  SheetsAppsScriptOutput
> {
  constructor(context: HandlerContext) {
    super('sheets_appsscript', context);
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
        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
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
    body?: unknown
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

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    logger.debug(`Apps Script API ${method} ${path}`);

    const response = await fetch(url, options);

    if (!response.ok) {
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
      { deploymentConfig }
    );

    // Extract web app URL if available
    const webAppEntry = result.entryPoints?.find((e) => e.entryPointType === 'WEB_APP');
    const webAppUrl = webAppEntry?.webApp?.url;

    return this.success('deploy', {
      deployment: {
        deploymentId: result.deploymentId,
        versionNumber: result.deploymentConfig?.versionNumber ?? undefined,
        deploymentConfig: result.deploymentConfig ?? undefined,
        entryPoints: result.entryPoints ?? undefined,
        updateTime: result.updateTime ?? undefined,
      },
      webAppUrl: webAppUrl ?? undefined,
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

    const result = await this.apiRequest<RunResponse>('POST', `/scripts/${req.scriptId}:run`, body);

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
    });
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
        processType?:
          | 'EDITOR'
          | 'SIMPLE_TRIGGER'
          | 'TRIGGER'
          | 'WEBAPP'
          | 'API_EXECUTABLE'
          | 'ADD_ON'
          | 'TIME_DRIVEN';
        processStatus?:
          | 'COMPLETED'
          | 'FAILED'
          | 'RUNNING'
          | 'CANCELED'
          | 'TIMED_OUT'
          | 'UNKNOWN'
          | 'DELAYED'
          | 'PENDING';
        startTime?: string;
        duration?: string;
        userAccessLevel?: 'OWNER' | 'READ' | 'WRITE' | 'NONE';
      }>;
      nextPageToken?: string;
    }

    // Build query parameters for filtering
    const params: string[] = [];
    if (req.pageSize) params.push(`pageSize=${req.pageSize}`);
    if (req.pageToken) params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);

    // Build user process filter - each filter is a separate query param
    if (req.scriptId) {
      params.push(`userProcessFilter.scriptId=${req.scriptId}`);
    }
    if (req.functionName) {
      params.push(`userProcessFilter.functionName=${req.functionName}`);
    }
    if (req.processType) {
      params.push(`userProcessFilter.types=${req.processType}`);
    }
    if (req.processStatus) {
      params.push(`userProcessFilter.statuses=${req.processStatus}`);
    }

    let path = '/processes:listScriptProcesses';
    if (params.length > 0) path += `?${params.join('&')}`;

    const result = await this.apiRequest<ListProcessesResponse>('GET', path);

    return this.success('list_processes', {
      processes: (result.processes ?? []).map((p) => ({
        processId: p.processId ?? undefined,
        projectName: p.projectName ?? undefined,
        functionName: p.functionName ?? undefined,
        processType: p.processType ?? undefined,
        processStatus: p.processStatus ?? undefined,
        startTime: p.startTime ?? undefined,
        duration: p.duration ?? undefined,
        userAccessLevel: p.userAccessLevel ?? undefined,
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
      const filter = JSON.stringify({ deploymentId: req.deploymentId });
      params.push(`metricsFilter=${encodeURIComponent(filter)}`);
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
}
