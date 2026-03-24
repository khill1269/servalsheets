/**
 * SERVAL() Formula Installer
 */

import { randomBytes } from 'crypto';
import { logger } from '../../utils/logger.js';
import { ErrorCodes } from '../error-codes.js';
import type { AppsScriptHandlerAccess } from './internal.js';
import type { AppsScriptInstallServalFunctionInput, AppsScriptResponse } from '../../schemas/index.js';

interface CreateProjectResponse {
  scriptId: string;
  title: string;
  parentId?: string;
  createTime?: string;
  updateTime?: string;
}

interface UpdateContentResponse {
  files: Array<{ name: string; type: string; source: string }>;
}

export async function handleInstallServalFunction(
  access: AppsScriptHandlerAccess,
  req: AppsScriptInstallServalFunctionInput
): Promise<AppsScriptResponse> {
  logger.info('Installing SERVAL() function', { spreadsheetId: req.spreadsheetId });

  const hmacSecret = randomBytes(32).toString('hex');
  const defaultModel = req.defaultModel ?? 'claude-sonnet-4-6';
  const callbackBaseUrlRaw =
    req.callbackUrl ?? process.env['SERVAL_CALLBACK_URL'] ?? process.env['SERVALSHEETS_BASE_URL'];
  if (!callbackBaseUrlRaw) {
    return access.error({
      code: ErrorCodes.CONFIG_ERROR,
      message:
        'SERVAL callback URL is required. Provide request.callbackUrl or set SERVAL_CALLBACK_URL.',
      retryable: false,
    });
  }
  const callbackUrl = callbackBaseUrlRaw.replace(/\/+$/, '');

  try {
    const parsedUrl = new URL(callbackUrl);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return access.error({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'callbackUrl must use https:// or http:// protocol',
        retryable: false,
      });
    }
    if (callbackUrl.includes("'") || callbackUrl.includes('`') || callbackUrl.includes('\\')) {
      return access.error({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'callbackUrl contains invalid characters',
        retryable: false,
      });
    }
  } catch {
    return access.error({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'callbackUrl is not a valid URL',
      retryable: false,
    });
  }

  const scriptSource = `
function SERVAL(prompt, range, model) {
  var CALLBACK_URL = '${callbackUrl}/api/serval-formula';
  var HMAC_SECRET = PropertiesService.getScriptProperties().getProperty('SERVAL_HMAC_SECRET');
  if (!HMAC_SECRET) {
    return '#NOT_INITIALIZED: Run serval_setup() in the Apps Script IDE to complete installation.';
  }
  var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var rangeValues = range ? (Array.isArray(range) ? range : [[range]]) : null;
  var body = JSON.stringify({
    requests: [{ prompt: String(prompt), range_values: rangeValues, model: model || '${defaultModel}' }],
    spreadsheetId: spreadsheetId,
    timestamp: Date.now()
  });
  var sig = Utilities.computeHmacSha256Signature(body, HMAC_SECRET);
  var sigHex = sig.map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  var response = UrlFetchApp.fetch(CALLBACK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Serval-Signature': sigHex, 'X-Serval-SpreadsheetId': spreadsheetId },
    payload: body,
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) return '#ERROR!';
  var result = JSON.parse(response.getContentText());
  return result.results && result.results[0] ? (result.results[0].text || result.results[0].values || '#NODATA') : '#NODATA';
}

/**
 * Run this function once from the Apps Script IDE to complete installation.
 * Paste the hmacSecret value from the install_serval_function response when prompted.
 */
function serval_setup() {
  var secret = Browser.inputBox('SERVAL Setup', 'Paste the SERVAL HMAC secret from the installation response:', Browser.Buttons.OK_CANCEL);
  if (secret && secret !== 'cancel') {
    PropertiesService.getScriptProperties().setProperty('SERVAL_HMAC_SECRET', secret);
    Browser.msgBox('SERVAL setup complete. The SERVAL() formula is ready to use.');
  }
}
`.trim();

  const project = await access.apiRequest<CreateProjectResponse>('POST', '/projects', {
    title: 'SERVAL Formula Functions',
    parentId: req.spreadsheetId,
  });

  const scriptId = project.scriptId;

  await access.apiRequest<UpdateContentResponse>('PUT', `/projects/${scriptId}/content`, {
    files: [
      {
        name: 'SERVAL',
        type: 'SERVER_JS',
        source: scriptSource,
      },
    ],
  });

  try {
    const { registerSpreadsheetSecret } = await import('../../services/formula-callback.js');
    registerSpreadsheetSecret(
      req.spreadsheetId,
      hmacSecret,
      req.rateLimit ?? { requestsPerMinute: 100 },
      req.cacheTtlSeconds ?? 300
    );
  } catch {
    logger.warn('Could not register SERVAL HMAC secret in formula-callback service', {
      spreadsheetId: req.spreadsheetId,
    });
  }

  const installedAt = new Date().toISOString();
  logger.info('SERVAL() function installed', { scriptId, spreadsheetId: req.spreadsheetId });

  return access.success('install_serval_function', {
    scriptId,
    functionName: 'SERVAL',
    callbackUrl: `${callbackUrl}/api/serval-formula`,
    hmacSecret,
    setupInstructions:
      'Open the Apps Script IDE for this spreadsheet, run serval_setup(), and paste this hmacSecret when prompted.',
    installedAt,
    project: {
      scriptId,
      title: 'SERVAL Formula Functions',
      parentId: req.spreadsheetId,
      createTime: project.createTime ?? installedAt,
      updateTime: project.updateTime ?? installedAt,
    },
  });
}
