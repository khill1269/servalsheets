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
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsAppsScriptInput, SheetsAppsScriptOutput } from '../schemas/index.js';
export declare class SheetsAppsScriptHandler extends BaseHandler<SheetsAppsScriptInput, SheetsAppsScriptOutput> {
    constructor(context: HandlerContext);
    handle(input: SheetsAppsScriptInput): Promise<SheetsAppsScriptOutput>;
    protected createIntents(_input: SheetsAppsScriptInput): Intent[];
    /**
     * Make authenticated request to Apps Script API
     */
    private apiRequest;
    private handleCreate;
    private handleGet;
    private handleGetContent;
    private handleUpdateContent;
    private handleCreateVersion;
    private handleListVersions;
    private handleGetVersion;
    private handleDeploy;
    private handleListDeployments;
    private handleGetDeployment;
    private handleUndeploy;
    private handleRun;
    private handleListProcesses;
    private handleGetMetrics;
}
//# sourceMappingURL=appsscript.d.ts.map