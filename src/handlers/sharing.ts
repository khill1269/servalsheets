/**
 * ServalSheets - Sharing Handler
 *
 * Handles sheets_sharing tool (Drive permissions)
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsSharingInput,
  SheetsSharingOutput,
  SharingAction,
  SharingResponse,
} from '../schemas/index.js';
import { logger } from '../utils/logger.js';

type SharingSuccess = Extract<SharingResponse, { success: true }>;

export class SharingHandler extends BaseHandler<SheetsSharingInput, SheetsSharingOutput> {
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, driveApi?: drive_v3.Drive) {
    super('sheets_sharing', context);
    this.driveApi = driveApi;
  }

  async handle(input: SheetsSharingInput): Promise<SheetsSharingOutput> {
    if (!this.driveApi) {
      return {
        response: this.error({
          code: 'INTERNAL_ERROR',
          message: 'Drive API not available - required for sharing operations',
          details: {
            action: input.request.action,
            spreadsheetId: input.request.spreadsheetId,
            requiredScope: 'https://www.googleapis.com/auth/drive.file',
          },
          retryable: false,
          resolution: 'Ensure Drive API client is initialized with drive.file scope. Check Google API credentials configuration.',
          resolutionSteps: [
            '1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup',
            '2. Ensure drive.file scope is included in OAuth scopes',
            '3. Re-authenticate if using OAuth',
          ],
        }),
      };
    }
    if (!this.context.auth?.hasElevatedAccess) {
      return {
        response: this.error({
          code: 'PERMISSION_DENIED',
          message: 'Elevated Drive scope required for sharing operations',
          retryable: false,
          suggestedFix: 'Initialize Google API client with elevatedAccess or drive scope.',
        }),
      };
    }

    // Audit log: Elevated scope operation
    const req = input.request;
    logger.info('Elevated scope operation', {
      operation: `sharing:${req.action}`,
      resourceId: req.spreadsheetId,
      scopes: this.context.auth?.scopes,
      category: 'audit',
    });

    try {
      let response: SharingResponse;
      switch (req.action) {
        case 'share':
          response = await this.handleShare(req);
          break;
        case 'update_permission':
          response = await this.handleUpdatePermission(req);
          break;
        case 'remove_permission':
          response = await this.handleRemovePermission(req);
          break;
        case 'list_permissions':
          response = await this.handleListPermissions(req);
          break;
        case 'get_permission':
          response = await this.handleGetPermission(req);
          break;
        case 'transfer_ownership':
          response = await this.handleTransferOwnership(req);
          break;
        case 'set_link_sharing':
          response = await this.handleSetLinkSharing(req);
          break;
        case 'get_sharing_link':
          response = await this.handleGetSharingLink(req);
          break;
        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }
      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(_input: SheetsSharingInput): Intent[] {
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleShare(
    input: Extract<SharingAction, { action: 'share' }>
  ): Promise<SharingResponse> {
    const requestBody: drive_v3.Schema$Permission = {
      type: input.type,
      role: input.role,
    };
    if (input.emailAddress) requestBody.emailAddress = input.emailAddress;
    if (input.domain) requestBody.domain = input.domain;
    if (input.expirationTime) requestBody.expirationTime = input.expirationTime;

    const response = await this.driveApi!.permissions.create({
      fileId: input.spreadsheetId,
      sendNotificationEmail: input.sendNotification ?? true,
      emailMessage: input.emailMessage,
      requestBody,
      supportsAllDrives: true,
    });

    return this.success('share', { permission: this.mapPermission(response.data) });
  }

  private async handleUpdatePermission(
    input: Extract<SharingAction, { action: 'update_permission' }>
  ): Promise<SharingResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_permission', {}, undefined, true);
    }

    const response = await this.driveApi!.permissions.update({
      fileId: input.spreadsheetId,
      permissionId: input.permissionId,
      transferOwnership: input.role === 'owner',
      requestBody: {
        role: input.role,
        expirationTime: input.expirationTime,
      },
      supportsAllDrives: true,
    });

    return this.success('update_permission', { permission: this.mapPermission(response.data) });
  }

  private async handleRemovePermission(
    input: Extract<SharingAction, { action: 'remove_permission' }>
  ): Promise<SharingResponse> {
    if (input.safety?.dryRun) {
      return this.success('remove_permission', {}, undefined, true);
    }

    await this.driveApi!.permissions.delete({
      fileId: input.spreadsheetId,
      permissionId: input.permissionId,
      supportsAllDrives: true,
    });

    return this.success('remove_permission', {});
  }

  private async handleListPermissions(
    input: Extract<SharingAction, { action: 'list_permissions' }>
  ): Promise<SharingResponse> {
    const response = await this.driveApi!.permissions.list({
      fileId: input.spreadsheetId,
      supportsAllDrives: true,
      fields: 'permissions(id,type,role,emailAddress,domain,displayName,expirationTime)',
    });

    const permissions = (response.data.permissions ?? []).map(this.mapPermission);
    return this.success('list_permissions', { permissions });
  }

  private async handleGetPermission(
    input: Extract<SharingAction, { action: 'get_permission' }>
  ): Promise<SharingResponse> {
    const response = await this.driveApi!.permissions.get({
      fileId: input.spreadsheetId,
      permissionId: input.permissionId,
      supportsAllDrives: true,
      fields: 'id,type,role,emailAddress,domain,displayName,expirationTime',
    });

    return this.success('get_permission', { permission: this.mapPermission(response.data) });
  }

  private async handleTransferOwnership(
    input: Extract<SharingAction, { action: 'transfer_ownership' }>
  ): Promise<SharingResponse> {
    if (input.safety?.dryRun) {
      return this.success('transfer_ownership', {}, undefined, true);
    }

    const response = await this.driveApi!.permissions.create({
      fileId: input.spreadsheetId,
      transferOwnership: true,
      sendNotificationEmail: true,
      requestBody: {
        type: 'user',
        role: 'owner',
        emailAddress: input.newOwnerEmail,
      },
      supportsAllDrives: true,
    });

    return this.success('transfer_ownership', { permission: this.mapPermission(response.data) });
  }

  private async handleSetLinkSharing(
    input: Extract<SharingAction, { action: 'set_link_sharing' }>
  ): Promise<SharingResponse> {
    if (!input.enabled) {
      // Disable: delete existing anyone permission if present
      const list = await this.driveApi!.permissions.list({
        fileId: input.spreadsheetId,
        supportsAllDrives: true,
        fields: 'permissions(id,type)',
      });
      const anyone = (list.data.permissions ?? []).find(p => p.type === 'anyone');
      if (anyone && !input.safety?.dryRun) {
        await this.driveApi!.permissions.delete({
          fileId: input.spreadsheetId,
          permissionId: anyone.id!,
          supportsAllDrives: true,
        });
      }
      return this.success('set_link_sharing', {}, undefined, input.safety?.dryRun ?? false);
    }

    const response = await this.driveApi!.permissions.create({
      fileId: input.spreadsheetId,
      supportsAllDrives: true,
      requestBody: {
        type: 'anyone',
        role: input.role ?? 'reader',
      },
    });

    return this.success('set_link_sharing', { permission: this.mapPermission(response.data) });
  }

  private async handleGetSharingLink(
    input: Extract<SharingAction, { action: 'get_sharing_link' }>
  ): Promise<SharingResponse> {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${input.spreadsheetId}`;
    const sharingLink = `${baseUrl}/edit?usp=sharing`;
    return this.success('get_sharing_link', { sharingLink });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private mapPermission = (p: drive_v3.Schema$Permission | undefined): NonNullable<SharingSuccess['permission']> => ({
    id: p?.id ?? '',
    type: (p?.type as NonNullable<SharingSuccess['permission']>['type']) ?? 'user',
    role: (p?.role as NonNullable<SharingSuccess['permission']>['role']) ?? 'reader',
    emailAddress: p?.emailAddress ?? undefined,
    domain: p?.domain ?? undefined,
    displayName: p?.displayName ?? undefined,
    expirationTime: p?.expirationTime ?? undefined,
  });
}
