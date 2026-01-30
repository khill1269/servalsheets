/**
 * Tool 19: sheets_appsscript
 * Google Apps Script API integration for script automation
 *
 * 14 Actions:
 * Project Management (4): create, get, get_content, update_content
 * Version Management (3): create_version, list_versions, get_version
 * Deployment Management (4): deploy, list_deployments, get_deployment, undeploy
 * Execution (3): run, list_processes, get_metrics
 *
 * MCP Protocol: 2025-11-25
 *
 * Note: Uses Google Apps Script API (script.googleapis.com)
 * IMPORTANT: Does NOT work with service accounts - requires OAuth user auth
 */

import { z } from 'zod';
import { ErrorDetailSchema, ResponseMetaSchema, type ToolAnnotations } from './shared.js';

// ============================================================================
// Common Schemas
// ============================================================================

const ScriptIdSchema = z
  .string()
  .min(1)
  .describe('Apps Script project ID (from script URL or API)');

const VerbositySchema = z
  .enum(['minimal', 'standard', 'detailed'])
  .optional()
  .default('standard')
  .describe(
    'Response detail level: minimal (essential info only), standard (balanced), detailed (full metadata)'
  );

// Script file representation
const ScriptFileSchema = z.object({
  name: z.string().describe('File name (without extension)'),
  type: z
    .enum(['SERVER_JS', 'HTML', 'JSON'])
    .describe('File type: SERVER_JS (code), HTML (template), JSON (manifest)'),
  source: z.string().describe('File source code content'),
  lastModifyUser: z
    .object({
      email: z.string().optional(),
      name: z.string().optional(),
    })
    .optional()
    .describe('User who last modified the file'),
  createTime: z.string().optional().describe('ISO timestamp when created'),
  updateTime: z.string().optional().describe('ISO timestamp when last updated'),
});

// Script project metadata
const ScriptProjectSchema = z.object({
  scriptId: ScriptIdSchema,
  title: z.string().describe('Project title'),
  parentId: z.string().optional().describe('Parent file ID (container-bound scripts)'),
  createTime: z.string().optional().describe('ISO timestamp when created'),
  updateTime: z.string().optional().describe('ISO timestamp when last updated'),
  creator: z
    .object({
      email: z.string().optional(),
      name: z.string().optional(),
    })
    .optional()
    .describe('User who created the project'),
});

// Version information
const ScriptVersionSchema = z.object({
  versionNumber: z.number().int().describe('Immutable version number'),
  description: z.string().optional().describe('Version description'),
  createTime: z.string().optional().describe('ISO timestamp when created'),
});

// Deployment information
const DeploymentSchema = z.object({
  deploymentId: z.string().describe('Unique deployment ID'),
  versionNumber: z.number().int().optional().describe('Deployed version number'),
  deploymentConfig: z
    .object({
      description: z.string().optional(),
      manifestFileName: z.string().optional(),
      versionNumber: z.number().int().optional(),
      scriptId: z.string().optional(),
    })
    .optional()
    .describe('Deployment configuration'),
  entryPoints: z
    .array(
      z.object({
        entryPointType: z
          .enum(['EXECUTION_API', 'WEB_APP', 'ADD_ON'])
          .optional()
          .describe('Type of entry point'),
        webApp: z
          .object({
            url: z.string().optional(),
            entryPointConfig: z
              .object({
                access: z.enum(['MYSELF', 'DOMAIN', 'ANYONE', 'ANYONE_ANONYMOUS']).optional(),
                executeAs: z.enum(['USER_ACCESSING', 'USER_DEPLOYING']).optional(),
              })
              .optional(),
          })
          .optional(),
        executionApi: z
          .object({
            entryPointConfig: z
              .object({
                access: z.enum(['MYSELF', 'DOMAIN', 'ANYONE', 'ANYONE_ANONYMOUS']).optional(),
              })
              .optional(),
          })
          .optional(),
      })
    )
    .optional()
    .describe('Entry points for this deployment'),
  updateTime: z.string().optional().describe('ISO timestamp when last updated'),
});

// Process (execution) information
const ProcessSchema = z.object({
  processId: z.string().optional().describe('Unique process ID'),
  projectName: z.string().optional().describe('Project name'),
  functionName: z.string().optional().describe('Function that was executed'),
  processType: z
    .enum([
      'EDITOR',
      'SIMPLE_TRIGGER',
      'TRIGGER',
      'WEBAPP',
      'API_EXECUTABLE',
      'ADD_ON',
      'TIME_DRIVEN',
    ])
    .optional()
    .describe('Type of process'),
  processStatus: z
    .enum([
      'COMPLETED',
      'FAILED',
      'RUNNING',
      'CANCELED',
      'TIMED_OUT',
      'UNKNOWN',
      'DELAYED',
      'PENDING',
    ])
    .optional()
    .describe('Execution status'),
  startTime: z.string().optional().describe('ISO timestamp when started'),
  duration: z.string().optional().describe('Duration in seconds (e.g., "3.5s")'),
  userAccessLevel: z
    .enum(['OWNER', 'READ', 'WRITE', 'NONE'])
    .optional()
    .describe('User access level'),
});

// ============================================================================
// Project Management Action Schemas (4 actions)
// ============================================================================

const CreateProjectActionSchema = z.object({
  action: z.literal('create').describe('Create a new Apps Script project'),
  title: z.string().min(1).describe('Title for the new project'),
  parentId: z
    .string()
    .optional()
    .describe('Parent file ID to bind script to (Sheets/Docs/Forms/Slides). Omit for standalone.'),
  verbosity: VerbositySchema,
});

const GetProjectActionSchema = z.object({
  action: z.literal('get').describe('Get Apps Script project metadata'),
  scriptId: ScriptIdSchema,
  verbosity: VerbositySchema,
});

const GetContentActionSchema = z.object({
  action: z.literal('get_content').describe('Get script project files and source code'),
  scriptId: ScriptIdSchema,
  versionNumber: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Specific version to retrieve (omit for HEAD)'),
  verbosity: VerbositySchema,
});

const UpdateContentActionSchema = z.object({
  action: z.literal('update_content').describe('Update script project files (replaces all files)'),
  scriptId: ScriptIdSchema,
  files: z.array(ScriptFileSchema).min(1).describe('Complete set of files for the project'),
  verbosity: VerbositySchema,
});

// ============================================================================
// Version Management Action Schemas (3 actions)
// ============================================================================

const CreateVersionActionSchema = z.object({
  action: z.literal('create_version').describe('Create an immutable version snapshot'),
  scriptId: ScriptIdSchema,
  description: z.string().optional().describe('Description for this version'),
  verbosity: VerbositySchema,
});

const ListVersionsActionSchema = z.object({
  action: z.literal('list_versions').describe('List all versions of a script project'),
  scriptId: ScriptIdSchema,
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe('Maximum versions to return'),
  pageToken: z.string().optional().describe('Page token for pagination'),
  verbosity: VerbositySchema,
});

const GetVersionActionSchema = z.object({
  action: z.literal('get_version').describe('Get details of a specific version'),
  scriptId: ScriptIdSchema,
  versionNumber: z.number().int().positive().describe('Version number to retrieve'),
  verbosity: VerbositySchema,
});

// ============================================================================
// Deployment Management Action Schemas (4 actions)
// ============================================================================

const DeployActionSchema = z.object({
  action: z.literal('deploy').describe('Create a new deployment (web app or API executable)'),
  scriptId: ScriptIdSchema,
  versionNumber: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Version to deploy (creates new version if omitted)'),
  description: z.string().optional().describe('Deployment description'),
  deploymentType: z
    .enum(['WEB_APP', 'EXECUTION_API'])
    .optional()
    .default('EXECUTION_API')
    .describe('Type of deployment'),
  access: z
    .enum(['MYSELF', 'DOMAIN', 'ANYONE', 'ANYONE_ANONYMOUS'])
    .optional()
    .default('MYSELF')
    .describe(
      'Who can access: MYSELF, DOMAIN (Workspace), ANYONE (Google account), ANYONE_ANONYMOUS'
    ),
  executeAs: z
    .enum(['USER_ACCESSING', 'USER_DEPLOYING'])
    .optional()
    .default('USER_DEPLOYING')
    .describe('Execute as: USER_ACCESSING (end user) or USER_DEPLOYING (you)'),
  verbosity: VerbositySchema,
});

const ListDeploymentsActionSchema = z.object({
  action: z.literal('list_deployments').describe('List all deployments for a script project'),
  scriptId: ScriptIdSchema,
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe('Maximum deployments to return'),
  pageToken: z.string().optional().describe('Page token for pagination'),
  verbosity: VerbositySchema,
});

const GetDeploymentActionSchema = z.object({
  action: z.literal('get_deployment').describe('Get details of a specific deployment'),
  scriptId: ScriptIdSchema,
  deploymentId: z.string().min(1).describe('Deployment ID to retrieve'),
  verbosity: VerbositySchema,
});

const UndeployActionSchema = z.object({
  action: z.literal('undeploy').describe('Delete a deployment'),
  scriptId: ScriptIdSchema,
  deploymentId: z.string().min(1).describe('Deployment ID to delete'),
  verbosity: VerbositySchema,
});

// ============================================================================
// Execution Action Schemas (3 actions)
// ============================================================================

const RunActionSchema = z.object({
  action: z.literal('run').describe('Execute a function in an Apps Script project'),
  scriptId: ScriptIdSchema,
  functionName: z.string().min(1).describe('Name of function to execute'),
  parameters: z
    .array(z.unknown())
    .optional()
    .describe(
      'Function parameters (basic types only: strings, numbers, arrays, objects, booleans)'
    ),
  devMode: z
    .boolean()
    .optional()
    .default(false)
    .describe('Run most recently saved version (owner only) vs deployed version'),
  verbosity: VerbositySchema,
});

const ListProcessesActionSchema = z.object({
  action: z.literal('list_processes').describe('List script execution processes (logs)'),
  scriptId: ScriptIdSchema.optional().describe('Filter by script ID (omit for all your scripts)'),
  functionName: z.string().optional().describe('Filter by function name'),
  processType: z
    .enum([
      'EDITOR',
      'SIMPLE_TRIGGER',
      'TRIGGER',
      'WEBAPP',
      'API_EXECUTABLE',
      'ADD_ON',
      'TIME_DRIVEN',
    ])
    .optional()
    .describe('Filter by process type'),
  processStatus: z
    .enum(['COMPLETED', 'FAILED', 'RUNNING', 'CANCELED', 'TIMED_OUT'])
    .optional()
    .describe('Filter by status'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe('Maximum processes to return'),
  pageToken: z.string().optional().describe('Page token for pagination'),
  verbosity: VerbositySchema,
});

const GetMetricsActionSchema = z.object({
  action: z.literal('get_metrics').describe('Get usage metrics for a script project'),
  scriptId: ScriptIdSchema,
  granularity: z
    .enum(['DAILY', 'WEEKLY'])
    .optional()
    .default('WEEKLY')
    .describe('Metrics granularity'),
  deploymentId: z.string().optional().describe('Filter metrics by deployment'),
  verbosity: VerbositySchema,
});

// ============================================================================
// Input Schema (discriminated union wrapped in request)
// ============================================================================

const AppsScriptRequestSchema = z.discriminatedUnion('action', [
  // Project Management
  CreateProjectActionSchema,
  GetProjectActionSchema,
  GetContentActionSchema,
  UpdateContentActionSchema,
  // Version Management
  CreateVersionActionSchema,
  ListVersionsActionSchema,
  GetVersionActionSchema,
  // Deployment Management
  DeployActionSchema,
  ListDeploymentsActionSchema,
  GetDeploymentActionSchema,
  UndeployActionSchema,
  // Execution
  RunActionSchema,
  ListProcessesActionSchema,
  GetMetricsActionSchema,
]);

export const SheetsAppsScriptInputSchema = z.object({
  request: AppsScriptRequestSchema,
});

// ============================================================================
// Output Schema (response union)
// ============================================================================

const AppsScriptResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string().describe('Action that was performed'),
    // Project results
    project: ScriptProjectSchema.optional().describe('Project metadata'),
    // Content results
    files: z.array(ScriptFileSchema).optional().describe('Script files'),
    // Version results
    version: ScriptVersionSchema.optional().describe('Version details'),
    versions: z.array(ScriptVersionSchema).optional().describe('List of versions'),
    // Deployment results
    deployment: DeploymentSchema.optional().describe('Deployment details'),
    deployments: z.array(DeploymentSchema).optional().describe('List of deployments'),
    webAppUrl: z.string().optional().describe('Web app URL (for web app deployments)'),
    // Execution results
    result: z.unknown().optional().describe('Function return value'),
    executionError: z
      .object({
        errorMessage: z.string().optional(),
        errorType: z.string().optional(),
        scriptStackTraceElements: z
          .array(
            z.object({
              function: z.string().optional(),
              lineNumber: z.number().int().optional(),
            })
          )
          .optional(),
      })
      .optional()
      .describe('Script execution error details'),
    // Process results
    processes: z.array(ProcessSchema).optional().describe('List of execution processes'),
    // Metrics results
    metrics: z
      .object({
        activeUsers: z.array(z.object({ value: z.string().optional() })).optional(),
        totalExecutions: z.array(z.object({ value: z.string().optional() })).optional(),
        failedExecutions: z.array(z.object({ value: z.string().optional() })).optional(),
      })
      .optional()
      .describe('Usage metrics'),
    // Pagination
    nextPageToken: z.string().optional().describe('Token for next page of results'),
    // Standard fields
    _meta: ResponseMetaSchema.optional().describe('Response metadata'),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsAppsScriptOutputSchema = z.object({
  response: AppsScriptResponseSchema,
});

// ============================================================================
// Annotations
// ============================================================================

export const SHEETS_APPSSCRIPT_ANNOTATIONS: ToolAnnotations = {
  title: 'Apps Script Automation',
  readOnlyHint: false, // run, update_content, deploy modify state
  destructiveHint: true, // undeploy, run can have side effects
  idempotentHint: false, // run is not idempotent
  openWorldHint: true, // Calls Apps Script API
};

// ============================================================================
// Type Exports
// ============================================================================

export type SheetsAppsScriptInput = z.infer<typeof SheetsAppsScriptInputSchema>;
export type SheetsAppsScriptOutput = z.infer<typeof SheetsAppsScriptOutputSchema>;
export type AppsScriptResponse = z.infer<typeof AppsScriptResponseSchema>;
export type AppsScriptRequest = SheetsAppsScriptInput['request'];

// Type narrowing helpers for each action
export type AppsScriptCreateInput = SheetsAppsScriptInput['request'] & { action: 'create' };
export type AppsScriptGetInput = SheetsAppsScriptInput['request'] & { action: 'get' };
export type AppsScriptGetContentInput = SheetsAppsScriptInput['request'] & {
  action: 'get_content';
};
export type AppsScriptUpdateContentInput = SheetsAppsScriptInput['request'] & {
  action: 'update_content';
};
export type AppsScriptCreateVersionInput = SheetsAppsScriptInput['request'] & {
  action: 'create_version';
};
export type AppsScriptListVersionsInput = SheetsAppsScriptInput['request'] & {
  action: 'list_versions';
};
export type AppsScriptGetVersionInput = SheetsAppsScriptInput['request'] & {
  action: 'get_version';
};
export type AppsScriptDeployInput = SheetsAppsScriptInput['request'] & { action: 'deploy' };
export type AppsScriptListDeploymentsInput = SheetsAppsScriptInput['request'] & {
  action: 'list_deployments';
};
export type AppsScriptGetDeploymentInput = SheetsAppsScriptInput['request'] & {
  action: 'get_deployment';
};
export type AppsScriptUndeployInput = SheetsAppsScriptInput['request'] & { action: 'undeploy' };
export type AppsScriptRunInput = SheetsAppsScriptInput['request'] & { action: 'run' };
export type AppsScriptListProcessesInput = SheetsAppsScriptInput['request'] & {
  action: 'list_processes';
};
export type AppsScriptGetMetricsInput = SheetsAppsScriptInput['request'] & {
  action: 'get_metrics';
};
