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
import { BaseHandler, unwrapRequest } from './base.js';
import { AuthenticationError, ServiceError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
// Apps Script API base URL
const APPS_SCRIPT_API_BASE = 'https://script.googleapis.com/v1';
export class SheetsAppsScriptHandler extends BaseHandler {
    constructor(context) {
        super('sheets_appsscript', context);
    }
    async handle(input) {
        // 1. Unwrap request from wrapper
        const rawReq = unwrapRequest(input);
        // 2. Require auth
        this.requireAuth();
        try {
            // 3. Dispatch to action handler
            const req = rawReq;
            let response;
            switch (req.action) {
                case 'create':
                    response = await this.handleCreate(req);
                    break;
                case 'get':
                    response = await this.handleGet(req);
                    break;
                case 'get_content':
                    response = await this.handleGetContent(req);
                    break;
                case 'update_content':
                    response = await this.handleUpdateContent(req);
                    break;
                case 'create_version':
                    response = await this.handleCreateVersion(req);
                    break;
                case 'list_versions':
                    response = await this.handleListVersions(req);
                    break;
                case 'get_version':
                    response = await this.handleGetVersion(req);
                    break;
                case 'deploy':
                    response = await this.handleDeploy(req);
                    break;
                case 'list_deployments':
                    response = await this.handleListDeployments(req);
                    break;
                case 'get_deployment':
                    response = await this.handleGetDeployment(req);
                    break;
                case 'undeploy':
                    response = await this.handleUndeploy(req);
                    break;
                case 'run':
                    response = await this.handleRun(req);
                    break;
                case 'list_processes':
                    response = await this.handleListProcesses(req);
                    break;
                case 'get_metrics':
                    response = await this.handleGetMetrics(req);
                    break;
                default:
                    response = this.error({
                        code: 'INVALID_PARAMS',
                        message: `Unknown action: ${req.action}`,
                        retryable: false,
                    });
            }
            // 4. Apply verbosity filtering if needed
            const verbosity = req.verbosity ?? 'standard';
            const filteredResponse = this.applyVerbosityFilter(response, verbosity);
            // 5. Return wrapped response
            return { response: filteredResponse };
        }
        catch (err) {
            return { response: this.mapError(err) };
        }
    }
    // Required by BaseHandler
    createIntents(_input) {
        return []; // Apps Script doesn't use batch operations
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Make authenticated request to Apps Script API
     */
    async apiRequest(method, path, body) {
        // Get access token from the Google client
        const googleClient = this.context.googleClient;
        if (!googleClient) {
            throw new AuthenticationError('No Google client available - authentication required', 'AUTH_ERROR', false, { service: 'AppsScript' });
        }
        // Access token is available via the oauth2 credentials
        const credentials = googleClient.oauth2.credentials;
        const token = credentials.access_token;
        if (!token) {
            throw new AuthenticationError('No access token available - authentication required', 'AUTH_ERROR', true, // Retryable - user can re-authenticate
            { service: 'AppsScript' });
        }
        const url = `${APPS_SCRIPT_API_BASE}${path}`;
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        const options = {
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
            try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson.error?.message) {
                    errorMessage = errorJson.error.message;
                }
            }
            catch {
                // Use default error message
            }
            throw new ServiceError(errorMessage, 'UNAVAILABLE', 'AppsScript', response.status >= 500, // Retryable for server errors
            { statusCode: response.status, path });
        }
        // Handle empty responses (e.g., DELETE operations return no body)
        const text = await response.text();
        if (!text) {
            logger.debug('Empty response body - OK for DELETE/void operations');
            return {}; // OK: Explicit empty for void operations
        }
        return JSON.parse(text);
    }
    // ============================================================================
    // Project Management Actions
    // ============================================================================
    async handleCreate(req) {
        logger.info(`Creating Apps Script project: ${req.title}`);
        const body = {
            title: req.title,
        };
        if (req.parentId) {
            body.parentId = req.parentId;
        }
        const result = await this.apiRequest('POST', '/projects', body);
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
    async handleGet(req) {
        logger.info(`Getting Apps Script project: ${req.scriptId}`);
        const result = await this.apiRequest('GET', `/projects/${req.scriptId}`);
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
    async handleGetContent(req) {
        logger.info(`Getting Apps Script content: ${req.scriptId}`);
        let path = `/projects/${req.scriptId}/content`;
        if (req.versionNumber) {
            path += `?versionNumber=${req.versionNumber}`;
        }
        const result = await this.apiRequest('GET', path);
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
    async handleUpdateContent(req) {
        logger.info(`Updating Apps Script content: ${req.scriptId}`);
        const body = {
            files: req.files.map((f) => ({
                name: f.name,
                type: f.type,
                source: f.source,
            })),
        };
        const result = await this.apiRequest('PUT', `/projects/${req.scriptId}/content`, body);
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
    async handleCreateVersion(req) {
        logger.info(`Creating version for: ${req.scriptId}`);
        const body = {};
        if (req.description) {
            body.description = req.description;
        }
        const result = await this.apiRequest('POST', `/projects/${req.scriptId}/versions`, body);
        return this.success('create_version', {
            version: {
                versionNumber: result.versionNumber,
                description: result.description ?? undefined,
                createTime: result.createTime ?? undefined,
            },
        });
    }
    async handleListVersions(req) {
        logger.info(`Listing versions for: ${req.scriptId}`);
        let path = `/projects/${req.scriptId}/versions`;
        const params = [];
        if (req.pageSize)
            params.push(`pageSize=${req.pageSize}`);
        if (req.pageToken)
            params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);
        if (params.length > 0)
            path += `?${params.join('&')}`;
        const result = await this.apiRequest('GET', path);
        return this.success('list_versions', {
            versions: (result.versions ?? []).map((v) => ({
                versionNumber: v.versionNumber,
                description: v.description ?? undefined,
                createTime: v.createTime ?? undefined,
            })),
            nextPageToken: result.nextPageToken ?? undefined,
        });
    }
    async handleGetVersion(req) {
        logger.info(`Getting version ${req.versionNumber} for: ${req.scriptId}`);
        const result = await this.apiRequest('GET', `/projects/${req.scriptId}/versions/${req.versionNumber}`);
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
    async handleDeploy(req) {
        logger.info(`Creating deployment for: ${req.scriptId}`);
        const deploymentConfig = {
            scriptId: req.scriptId,
        };
        if (req.description) {
            deploymentConfig.description = req.description;
        }
        if (req.versionNumber) {
            deploymentConfig.versionNumber = req.versionNumber;
        }
        const result = await this.apiRequest('POST', `/projects/${req.scriptId}/deployments`, { deploymentConfig });
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
    async handleListDeployments(req) {
        logger.info(`Listing deployments for: ${req.scriptId}`);
        let path = `/projects/${req.scriptId}/deployments`;
        const params = [];
        if (req.pageSize)
            params.push(`pageSize=${req.pageSize}`);
        if (req.pageToken)
            params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);
        if (params.length > 0)
            path += `?${params.join('&')}`;
        const result = await this.apiRequest('GET', path);
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
    async handleGetDeployment(req) {
        logger.info(`Getting deployment ${req.deploymentId} for: ${req.scriptId}`);
        const result = await this.apiRequest('GET', `/projects/${req.scriptId}/deployments/${req.deploymentId}`);
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
    async handleUndeploy(req) {
        logger.info(`Deleting deployment ${req.deploymentId} for: ${req.scriptId}`);
        await this.apiRequest('DELETE', `/projects/${req.scriptId}/deployments/${req.deploymentId}`);
        return this.success('undeploy', {});
    }
    // ============================================================================
    // Execution Actions
    // ============================================================================
    async handleRun(req) {
        logger.info(`Running function ${req.functionName} in: ${req.scriptId}`);
        const body = {
            function: req.functionName,
        };
        if (req.parameters) {
            body.parameters = req.parameters;
        }
        if (req.devMode) {
            body.devMode = req.devMode;
        }
        const result = await this.apiRequest('POST', `/scripts/${req.scriptId}:run`, body);
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
    async handleListProcesses(req) {
        logger.info(`Listing processes${req.scriptId ? ` for: ${req.scriptId}` : ''}`);
        // Build query parameters for filtering
        const params = [];
        if (req.pageSize)
            params.push(`pageSize=${req.pageSize}`);
        if (req.pageToken)
            params.push(`pageToken=${encodeURIComponent(req.pageToken)}`);
        // Build user process filter
        const filters = [];
        if (req.scriptId) {
            filters.push(`scriptId=${req.scriptId}`);
        }
        if (req.functionName) {
            filters.push(`functionName=${req.functionName}`);
        }
        if (req.processType) {
            filters.push(`processType=${req.processType}`);
        }
        if (req.processStatus) {
            filters.push(`processStatuses=${req.processStatus}`);
        }
        if (filters.length > 0) {
            params.push(`userProcessFilter.${filters.join('&userProcessFilter.')}`);
        }
        let path = '/processes:listScriptProcesses';
        if (params.length > 0)
            path += `?${params.join('&')}`;
        const result = await this.apiRequest('GET', path);
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
    async handleGetMetrics(req) {
        logger.info(`Getting metrics for: ${req.scriptId}`);
        let path = `/projects/${req.scriptId}/metrics`;
        const params = [];
        if (req.granularity) {
            params.push(`metricsGranularity=${req.granularity}`);
        }
        if (req.deploymentId) {
            const filter = JSON.stringify({ deploymentId: req.deploymentId });
            params.push(`metricsFilter=${encodeURIComponent(filter)}`);
        }
        if (params.length > 0)
            path += `?${params.join('&')}`;
        const result = await this.apiRequest('GET', path);
        return this.success('get_metrics', {
            metrics: {
                activeUsers: result.activeUsers ?? undefined,
                totalExecutions: result.totalExecutions ?? undefined,
                failedExecutions: result.failedExecutions ?? undefined,
            },
        });
    }
}
//# sourceMappingURL=appsscript.js.map