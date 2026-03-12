import { ErrorCodes } from '../error-codes.js';
import type { drive_v3 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type {
  CollaborateResponse,
  CollaborateShareAddInput,
  CollaborateShareGetInput,
  CollaborateShareGetLinkInput,
  CollaborateShareListInput,
  CollaborateShareRemoveInput,
  CollaborateShareSetLinkInput,
  CollaborateShareTransferOwnershipInput,
  CollaborateShareUpdateInput,
} from '../../schemas/index.js';
import type { ErrorDetail, MutationSummary } from '../../schemas/shared.js';
import { elicitSharingSettings, confirmDestructiveAction } from '../../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../../utils/safety-helpers.js';
import { driveRateLimiter } from '../../utils/drive-rate-limiter.js';

type CollaborateSuccess = Extract<CollaborateResponse, { success: true }>;

interface SharingDeps {
  driveApi: drive_v3.Drive;
  context: HandlerContext;
  mapPermission: (
    permission: drive_v3.Schema$Permission | undefined
  ) => NonNullable<CollaborateSuccess['permission']>;
  success: (
    action: string,
    data: Record<string, unknown>,
    mutation?: MutationSummary,
    dryRun?: boolean
  ) => CollaborateResponse;
  error: (error: ErrorDetail) => CollaborateResponse;
}

const MAX_PERMISSION_EXPIRATION_MS = 365 * 24 * 60 * 60 * 1000;

function validatePermissionExpiration(
  expirationTime: string,
  permissionType: string | undefined
): ErrorDetail | undefined {
  if (permissionType !== 'user' && permissionType !== 'group') {
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'expirationTime is only supported for user and group permissions.',
      retryable: false,
    };
  }

  const expirationMs = Date.parse(expirationTime);
  if (Number.isNaN(expirationMs)) {
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'expirationTime must be a valid RFC 3339 timestamp.',
      retryable: false,
    };
  }

  const now = Date.now();
  if (expirationMs <= now) {
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'expirationTime must be in the future.',
      retryable: false,
    };
  }

  if (expirationMs - now > MAX_PERMISSION_EXPIRATION_MS) {
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'expirationTime cannot be more than one year in the future.',
      retryable: false,
    };
  }

  return undefined; // OK: no expiry validation needed
}

/**
 * Decomposed action handler for `share_add`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareAddAction(
  input: CollaborateShareAddInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  let resolvedInput = input;
  if (!input.emailAddress && (input.type === 'user' || !input.type) && deps.context.server) {
    try {
      const spreadsheetTitle = input.spreadsheetId ?? 'this spreadsheet';
      const wizardResult = await elicitSharingSettings(deps.context.server, spreadsheetTitle);
      if (wizardResult) {
        resolvedInput = {
          ...input,
          type: input.type ?? 'user',
          emailAddress: wizardResult.email,
          role: wizardResult.role,
          sendNotification: wizardResult.sendNotification,
          emailMessage: wizardResult.message,
        } as CollaborateShareAddInput;
      }
    } catch {
      // non-blocking - proceed with provided input
    }
  }

  await driveRateLimiter.acquire();
  const requestBody: drive_v3.Schema$Permission = {
    type: resolvedInput.type,
    role: resolvedInput.role,
  };
  if (resolvedInput.emailAddress) requestBody.emailAddress = resolvedInput.emailAddress;
  if (resolvedInput.domain) requestBody.domain = resolvedInput.domain;
  if (resolvedInput.expirationTime) {
    const validationError = validatePermissionExpiration(
      resolvedInput.expirationTime,
      resolvedInput.type
    );
    if (validationError) {
      return deps.error(validationError);
    }
    requestBody.expirationTime = resolvedInput.expirationTime;
  }

  const response = await deps.driveApi.permissions.create({
    fileId: resolvedInput.spreadsheetId!,
    sendNotificationEmail: resolvedInput.sendNotification ?? true,
    emailMessage: resolvedInput.emailMessage,
    requestBody,
    fields: 'id,type,role,emailAddress,domain,displayName,expirationTime',
    supportsAllDrives: true,
  });

  return deps.success('share_add', {
    permission: deps.mapPermission(response.data),
  });
}

/**
 * Decomposed action handler for `share_update`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareUpdateAction(
  input: CollaborateShareUpdateInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  await driveRateLimiter.acquire();
  if (input.role === 'owner') {
    return deps.error({
      code: ErrorCodes.VALIDATION_ERROR,
      message:
        'Cannot change role to "owner" via share_update. Use share_transfer_ownership instead, ' +
        'which handles the required transferOwnership flag and pending acceptance flow.',
      retryable: false,
    });
  }

  if (input.safety?.dryRun) {
    return deps.success('share_update', {}, undefined, true);
  }

  if (input.expirationTime) {
    const permissionResponse = await deps.driveApi.permissions.get({
      fileId: input.spreadsheetId!,
      permissionId: input.permissionId!,
      supportsAllDrives: true,
      fields: 'type',
    });

    const validationError = validatePermissionExpiration(
      input.expirationTime,
      permissionResponse.data.type ?? undefined
    );
    if (validationError) {
      return deps.error(validationError);
    }
  }

  const response = await deps.driveApi.permissions.update({
    fileId: input.spreadsheetId!,
    permissionId: input.permissionId!,
    transferOwnership: false,
    requestBody: {
      role: input.role,
      expirationTime: input.expirationTime,
    },
    fields: 'id,type,role,emailAddress,domain,displayName,expirationTime',
    supportsAllDrives: true,
  });

  return deps.success('share_update', {
    permission: deps.mapPermission(response.data),
  });
}

/**
 * Decomposed action handler for `share_remove`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareRemoveAction(
  input: CollaborateShareRemoveInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  await driveRateLimiter.acquire();
  if (input.safety?.dryRun) {
    return deps.success('share_remove', {}, undefined, true);
  }

  if (deps.context.elicitationServer) {
    const confirmation = await confirmDestructiveAction(
      deps.context.elicitationServer,
      'share_remove',
      `Remove permission (ID: ${input.permissionId}) from spreadsheet ${input.spreadsheetId}. This will revoke access for the user. This action cannot be undone.`
    );

    if (!confirmation.confirmed) {
      return deps.error({
        code: ErrorCodes.PRECONDITION_FAILED,
        message: confirmation.reason || 'User cancelled the operation',
        retryable: false,
        suggestedFix: 'Review the operation requirements and try again',
      });
    }
  }

  const snapshot = await createSnapshotIfNeeded(
    deps.context.snapshotService,
    {
      operationType: 'share_remove',
      isDestructive: true,
      spreadsheetId: input.spreadsheetId,
    },
    input.safety
  );

  await deps.driveApi.permissions.delete({
    fileId: input.spreadsheetId!,
    permissionId: input.permissionId!,
    supportsAllDrives: true,
  });

  return deps.success('share_remove', {
    snapshotId: snapshot?.snapshotId,
  });
}

/**
 * Decomposed action handler for `share_list`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareListAction(
  input: CollaborateShareListInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  const response = await deps.driveApi.permissions.list({
    fileId: input.spreadsheetId!,
    supportsAllDrives: true,
    pageSize: 100,
    pageToken: (input as typeof input & { pageToken?: string }).pageToken ?? undefined,
    fields:
      'nextPageToken,permissions(id,type,role,emailAddress,domain,displayName,expirationTime)',
  });

  const permissions = (response.data.permissions ?? []).map((permission) =>
    deps.mapPermission(permission)
  );

  return deps.success('share_list', {
    permissions,
    nextPageToken: response.data.nextPageToken ?? undefined,
  });
}

/**
 * Decomposed action handler for `share_get`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareGetAction(
  input: CollaborateShareGetInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  const response = await deps.driveApi.permissions.get({
    fileId: input.spreadsheetId!,
    permissionId: input.permissionId!,
    supportsAllDrives: true,
    fields: 'id,type,role,emailAddress,domain,displayName,expirationTime',
  });

  return deps.success('share_get', {
    permission: deps.mapPermission(response.data),
  });
}

/**
 * Decomposed action handler for `share_transfer_ownership`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareTransferOwnershipAction(
  input: CollaborateShareTransferOwnershipInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  await driveRateLimiter.acquire();
  if (input.safety?.dryRun) {
    return deps.success('share_transfer_ownership', {}, undefined, true);
  }

  const response = await deps.driveApi.permissions.create({
    fileId: input.spreadsheetId!,
    transferOwnership: true,
    moveToNewOwnersRoot: true,
    sendNotificationEmail: true,
    requestBody: {
      type: 'user',
      role: 'owner',
      emailAddress: input.newOwnerEmail!,
    },
    fields: 'id,type,role,emailAddress,displayName',
    supportsAllDrives: true,
  });

  return deps.success('share_transfer_ownership', {
    permission: deps.mapPermission(response.data),
    pendingAcceptance: (response.data as Record<string, unknown>)['pendingOwner'] === true,
  });
}

/**
 * Decomposed action handler for `share_set_link`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareSetLinkAction(
  input: CollaborateShareSetLinkInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  if (!input.enabled) {
    const allPermissions: drive_v3.Schema$Permission[] = [];
    let pageToken: string | undefined;

    do {
      const list = await deps.driveApi.permissions.list({
        fileId: input.spreadsheetId!,
        supportsAllDrives: true,
        pageSize: 100,
        pageToken,
        fields: 'nextPageToken,permissions(id,type)',
      });
      allPermissions.push(...(list.data.permissions ?? []));
      pageToken = list.data.nextPageToken ?? undefined;
    } while (pageToken);

    const anyone = allPermissions.find((p) => p.type === 'anyone');
    if (anyone?.id && !input.safety?.dryRun) {
      await deps.driveApi.permissions.delete({
        fileId: input.spreadsheetId!,
        permissionId: anyone.id,
        supportsAllDrives: true,
      });
    }
    return deps.success('share_set_link', {}, undefined, input.safety?.dryRun ?? false);
  }

  const response = await deps.driveApi.permissions.create({
    fileId: input.spreadsheetId!,
    supportsAllDrives: true,
    requestBody: {
      type: 'anyone',
      role: input.role ?? 'reader',
      allowFileDiscovery: input.allowFileDiscovery === true,
    },
    fields: 'id,type,role,emailAddress,displayName,allowFileDiscovery',
  });

  return deps.success('share_set_link', {
    permission: deps.mapPermission(response.data),
  });
}

/**
 * Decomposed action handler for `share_get_link`.
 * Preserves original behavior while moving logic out of the main CollaborateHandler class.
 */
export async function handleShareGetLinkAction(
  input: CollaborateShareGetLinkInput,
  deps: SharingDeps
): Promise<CollaborateResponse> {
  const baseUrl = `https://docs.google.com/spreadsheets/d/${input.spreadsheetId}`;
  const sharingLink = `${baseUrl}/edit?usp=sharing`;
  return deps.success('share_get_link', { sharingLink });
}
