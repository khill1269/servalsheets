/**
 * ServalSheets - Sharing Handler
 *
 * Handles sheets_sharing tool (Drive permissions)
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsSharingInput, SheetsSharingOutput } from '../schemas/sharing.js';

type SharingSuccess = Extract<SheetsSharingOutput, { success: true }>;

export class SharingHandler extends BaseHandler<SheetsSharingInput, SheetsSharingOutput> {
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, driveApi?: drive_v3.Drive) {
    super('sheets_sharing', context);
    this.driveApi = driveApi;
  }

  async handle(input: SheetsSharingInput): Promise<SheetsSharingOutput> {
    if (!this.driveApi) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Drive API not available',
        retryable: false,
        suggestedFix: 'Initialize Drive API client with drive.file scope.',
      });
    }
    if (!this.context.auth?.hasElevatedAccess) {
      return this.error({
        code: 'PERMISSION_DENIED',
        message: 'Elevated Drive scope required for sharing operations',
        retryable: false,
        suggestedFix: 'Initialize Google API client with elevatedAccess or drive scope.',
      });
    }

    try {
      switch (input.action) {
        case 'share':
          return await this.handleShare(input);
        case 'update_permission':
          return await this.handleUpdatePermission(input);
        case 'remove_permission':
          return await this.handleRemovePermission(input);
        case 'list_permissions':
          return await this.handleListPermissions(input);
        case 'get_permission':
          return await this.handleGetPermission(input);
        case 'transfer_ownership':
          return await this.handleTransferOwnership(input);
        case 'set_link_sharing':
          return await this.handleSetLinkSharing(input);
        case 'get_sharing_link':
          return await this.handleGetSharingLink(input);
        default:
          return this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(input as { action: string }).action}`,
            retryable: false,
          });
      }
    } catch (err) {
      return this.mapError(err);
    }
  }

  protected createIntents(input: SheetsSharingInput): Intent[] {
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleShare(
    input: Extract<SheetsSharingInput, { action: 'share' }>
  ): Promise<SheetsSharingOutput> {
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
    input: Extract<SheetsSharingInput, { action: 'update_permission' }>
  ): Promise<SheetsSharingOutput> {
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
    input: Extract<SheetsSharingInput, { action: 'remove_permission' }>
  ): Promise<SheetsSharingOutput> {
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
    input: Extract<SheetsSharingInput, { action: 'list_permissions' }>
  ): Promise<SheetsSharingOutput> {
    const response = await this.driveApi!.permissions.list({
      fileId: input.spreadsheetId,
      supportsAllDrives: true,
      fields: 'permissions(id,type,role,emailAddress,domain,displayName,expirationTime)',
    });

    const permissions = (response.data.permissions ?? []).map(this.mapPermission);
    return this.success('list_permissions', { permissions });
  }

  private async handleGetPermission(
    input: Extract<SheetsSharingInput, { action: 'get_permission' }>
  ): Promise<SheetsSharingOutput> {
    const response = await this.driveApi!.permissions.get({
      fileId: input.spreadsheetId,
      permissionId: input.permissionId,
      supportsAllDrives: true,
      fields: 'id,type,role,emailAddress,domain,displayName,expirationTime',
    });

    return this.success('get_permission', { permission: this.mapPermission(response.data) });
  }

  private async handleTransferOwnership(
    input: Extract<SheetsSharingInput, { action: 'transfer_ownership' }>
  ): Promise<SheetsSharingOutput> {
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
    input: Extract<SheetsSharingInput, { action: 'set_link_sharing' }>
  ): Promise<SheetsSharingOutput> {
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
    input: Extract<SheetsSharingInput, { action: 'get_sharing_link' }>
  ): Promise<SheetsSharingOutput> {
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
