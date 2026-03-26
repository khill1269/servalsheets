/**
 * Project Operations — create, get, get_content, update_content
 */

import { logger } from '../../utils/logger.js';
import { recordScriptId } from '../../mcp/completions.js';
import type { AppsScriptHandlerAccess } from './internal.js';
import type {
  AppsScriptCreateInput,
  AppsScriptGetInput,
  AppsScriptGetContentInput,
  AppsScriptUpdateContentInput,
  AppsScriptResponse,
} from '../../schemas/index.js';

interface ProjectResponse {
  scriptId: string;
  title: string;
  parentId?: string;
  createTime?: string;
  updateTime?: string;
  creator?: { email?: string; name?: string };
}

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

export async function handleCreate(
  access: AppsScriptHandlerAccess,
  req: AppsScriptCreateInput
): Promise<AppsScriptResponse> {
  logger.info(`Creating Apps Script project: ${req.title}`);

  interface CreateProjectRequest {
    title: string;
    parentId?: string;
  }

  const body: CreateProjectRequest = {
    title: req.title,
  };

  if (req.parentId) {
    body.parentId = req.parentId;
  }

  const result = await access.apiRequest<ProjectResponse>('POST', '/projects', body);
  recordScriptId(result.scriptId);

  if (req.parentId) {
    access.rememberBoundScript(req.parentId, result.scriptId);
  }

  return access.success('create', {
    scriptId: result.scriptId,
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

export async function handleGet(
  access: AppsScriptHandlerAccess,
  req: AppsScriptGetInput
): Promise<AppsScriptResponse> {
  logger.info(`Getting Apps Script project: ${req.scriptId}`);

  const result = await access.apiRequest<ProjectResponse>('GET', `/projects/${req.scriptId}`);
  recordScriptId(result.scriptId);

  return access.success('get', {
    scriptId: result.scriptId,
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

export async function handleGetContent(
  access: AppsScriptHandlerAccess,
  req: AppsScriptGetContentInput
): Promise<AppsScriptResponse> {
  logger.info(`Getting Apps Script content: ${req.scriptId}`);

  let path = `/projects/${req.scriptId}/content`;
  if (req.versionNumber) {
    path += `?versionNumber=${req.versionNumber}`;
  }

  const result = await access.apiRequest<ContentResponse>('GET', path);

  return access.success('get_content', {
    scriptId: result.scriptId ?? req.scriptId,
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

export async function handleUpdateContent(
  access: AppsScriptHandlerAccess,
  req: AppsScriptUpdateContentInput
): Promise<AppsScriptResponse> {
  logger.info(`Updating Apps Script content: ${req.scriptId}`);

  const body = {
    files: req.files.map((f) => ({
      name: f.name,
      type: f.type,
      source: f.source,
    })),
  };

  const result = await access.apiRequest<ContentResponse>(
    'PUT',
    `/projects/${req.scriptId}/content`,
    body
  );

  return access.success('update_content', {
    scriptId: result.scriptId ?? req.scriptId,
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
