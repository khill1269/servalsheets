/**
 * Project Operations — create, get, get_content, update_content
 */

import { logger } from '../../utils/logger.js';
import { ErrorCodes } from '../error-codes.js';
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

  const CONTENT_SIZE_LIMIT = 50_000;
  const DENY_PATTERNS = [
    /ScriptApp\.newTrigger/,
    /PropertiesService\.getScriptProperties\(\)\.setProperty\(['"]SERVAL_HMAC_SECRET['"]/,
  ];
  for (const f of req.files) {
    if (f.source.length > CONTENT_SIZE_LIMIT) {
      return access.error({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `File "${f.name}" source exceeds 50KB limit (${f.source.length} bytes)`,
        retryable: false,
      });
    }
    const PATTERN_NAMES = ['ScriptApp.newTrigger', 'PropertiesService.setProperty(SERVAL_HMAC_SECRET)'];
    for (let i = 0; i < DENY_PATTERNS.length; i++) {
      const pattern = DENY_PATTERNS[i];
      if (pattern && pattern.test(f.source)) {
        const patternName = PATTERN_NAMES[i] ?? 'restricted-pattern';
        // AUDIT-2026-04-23 (artifact bug #20): surface the offending line
        // number(s) and a 3-line code snippet so callers can find and fix
        // the call without re-reading the whole file. Previously the error
        // reported only the file + pattern name, leaving callers to grep.
        const lines = f.source.split(/\r?\n/);
        const offendingLineNumbers: number[] = [];
        lines.forEach((line, idx) => {
          if (pattern.test(line)) offendingLineNumbers.push(idx + 1);
        });
        const firstHit = offendingLineNumbers[0] ?? 1;
        const contextStart = Math.max(1, firstHit - 1);
        const contextEnd = Math.min(lines.length, firstHit + 1);
        const snippet = lines
          .slice(contextStart - 1, contextEnd)
          .map((ln, idx) => `${contextStart + idx}: ${ln}`)
          .join('\n');
        return access.error({
          code: ErrorCodes.VALIDATION_ERROR,
          message:
            `File "${f.name}" references a restricted Apps Script API pattern (${patternName}) ` +
            `on line${offendingLineNumbers.length > 1 ? 's' : ''} ${offendingLineNumbers.join(', ')}.`,
          retryable: false,
          details: {
            blockedPattern: patternName,
            matchedRegex: pattern.toString(),
            offendingLines: offendingLineNumbers.join(','),
            offendingSnippet: snippet,
          },
          suggestedFix:
            `Remove or replace the "${patternName}" call at line ${firstHit} in "${f.name}". ` +
            `Trigger registration and HMAC secrets must be managed outside update_content.`,
        });
      }
    }
  }

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
