/**
 * Version & Deployment Operations — create_version, list_versions, get_version,
 * deploy, list_deployments, get_deployment, undeploy
 */

import { logger } from '../../utils/logger.js';
import type { AppsScriptHandlerAccess } from './internal.js';
import type {
  AppsScriptCreateVersionInput,
  AppsScriptListVersionsInput,
  AppsScriptGetVersionInput,
  AppsScriptDeployInput,
  AppsScriptListDeploymentsInput,
  AppsScriptGetDeploymentInput,
  AppsScriptUndeployInput,
  AppsScriptResponse,
} from '../../schemas/index.js';

interface VersionResponse {
  versionNumber: number;
  description?: string;
  createTime?: string;
}

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

export async function handleCreateVersion(
  access: AppsScriptHandlerAccess,
  req: AppsScriptCreateVersionInput
): Promise<AppsScriptResponse> {
  logger.info(`Creating version for: ${req.scriptId}`);

  const body: { description?: string } = {};
  if (req.description) {
    body.description = req.description;
  }

  const result = await access.apiRequest<VersionResponse>(
    'POST',
    `/projects/${req.scriptId}/versions`,
    body
  );

  return access.success('create_version', {
    version: {
      versionNumber: result.versionNumber,
      description: result.description ?? undefined,
      createTime: result.createTime ?? undefined,
    },
  });
}

export async function handleListVersions(
  access: AppsScriptHandlerAccess,
  req: AppsScriptListVersionsInput
): Promise<AppsScriptResponse> {
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

  const result = await access.apiRequest<ListVersionsResponse>('GET', path);

  return access.success('list_versions', {
    versions: (result.versions ?? []).map((v) => ({
      versionNumber: v.versionNumber,
      description: v.description ?? undefined,
      createTime: v.createTime ?? undefined,
    })),
    nextPageToken: result.nextPageToken ?? undefined,
  });
}

export async function handleGetVersion(
  access: AppsScriptHandlerAccess,
  req: AppsScriptGetVersionInput
): Promise<AppsScriptResponse> {
  logger.info(`Getting version ${req.versionNumber} for: ${req.scriptId}`);

  const result = await access.apiRequest<VersionResponse>(
    'GET',
    `/projects/${req.scriptId}/versions/${req.versionNumber}`
  );

  return access.success('get_version', {
    version: {
      versionNumber: result.versionNumber,
      description: result.description ?? undefined,
      createTime: result.createTime ?? undefined,
    },
  });
}

export async function handleDeploy(
  access: AppsScriptHandlerAccess,
  req: AppsScriptDeployInput
): Promise<AppsScriptResponse> {
  logger.info(`Creating deployment for: ${req.scriptId}`);

  interface DeploymentCreateBody {
    description?: string;
    versionNumber?: number;
  }

  const deploymentBody: DeploymentCreateBody = {};

  if (req.description) {
    deploymentBody.description = req.description;
  }

  if (req.versionNumber) {
    deploymentBody.versionNumber = req.versionNumber;
  }

  if (!deploymentBody.versionNumber) {
    logger.warn(
      'Deploying Apps Script to HEAD version (volatile). Specify versionNumber for a stable, pinned deployment.',
      { scriptId: req.scriptId }
    );
  }

  const result = await access.apiRequest<DeploymentResponse>(
    'POST',
    `/projects/${req.scriptId}/deployments`,
    deploymentBody
  );

  const webAppEntry = result.entryPoints?.find((e) => e.entryPointType === 'WEB_APP');
  const webAppUrl = webAppEntry?.webApp?.url;

  const ignoredParams: string[] = [];
  if ((req as { deploymentType?: string }).deploymentType) ignoredParams.push('deploymentType');
  if ((req as { access?: string }).access) ignoredParams.push('access');
  if ((req as { executeAs?: string }).executeAs) ignoredParams.push('executeAs');

  return access.success('deploy', {
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

export async function handleListDeployments(
  access: AppsScriptHandlerAccess,
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

  const result = await access.apiRequest<ListDeploymentsResponse>('GET', path);

  return access.success('list_deployments', {
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

export async function handleGetDeployment(
  access: AppsScriptHandlerAccess,
  req: AppsScriptGetDeploymentInput
): Promise<AppsScriptResponse> {
  logger.info(`Getting deployment ${req.deploymentId} for: ${req.scriptId}`);

  const result = await access.apiRequest<DeploymentResponse>(
    'GET',
    `/projects/${req.scriptId}/deployments/${req.deploymentId}`
  );

  return access.success('get_deployment', {
    deployment: {
      deploymentId: result.deploymentId,
      versionNumber: result.deploymentConfig?.versionNumber ?? undefined,
      deploymentConfig: result.deploymentConfig ?? undefined,
      entryPoints: result.entryPoints ?? undefined,
      updateTime: result.updateTime ?? undefined,
    },
  });
}

export async function handleUndeploy(
  access: AppsScriptHandlerAccess,
  req: AppsScriptUndeployInput
): Promise<AppsScriptResponse> {
  logger.info(`Deleting deployment ${req.deploymentId} for: ${req.scriptId}`);

  await access.apiRequest<Record<string, never>>(
    'DELETE',
    `/projects/${req.scriptId}/deployments/${req.deploymentId}`
  );

  return access.success('undeploy', {});
}
