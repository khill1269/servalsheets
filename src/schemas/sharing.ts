/**
 * Tool 11: sheets_sharing
 * Permission and sharing operations (Drive API)
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  PermissionRoleSchema,
  PermissionTypeSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const PermissionSchema = z.object({
  id: z.string(),
  type: PermissionTypeSchema,
  role: PermissionRoleSchema,
  emailAddress: z.string().optional(),
  domain: z.string().optional(),
  displayName: z.string().optional(),
  expirationTime: z.string().optional(),
});

const SharingActionSchema = z.discriminatedUnion('action', [
  // SHARE
  BaseSchema.extend({
    action: z.literal('share'),
    emailAddress: z.string().email().optional(),
    domain: z.string().optional(),
    type: PermissionTypeSchema,
    role: PermissionRoleSchema,
    sendNotification: z.boolean().optional().default(true),
    emailMessage: z.string().optional(),
    expirationTime: z.string().optional(),
  }),

  // UPDATE_PERMISSION
  BaseSchema.extend({
    action: z.literal('update_permission'),
    permissionId: z.string(),
    role: PermissionRoleSchema,
    expirationTime: z.string().optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // REMOVE_PERMISSION
  BaseSchema.extend({
    action: z.literal('remove_permission'),
    permissionId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_PERMISSIONS
  BaseSchema.extend({
    action: z.literal('list_permissions'),
  }),

  // GET_PERMISSION
  BaseSchema.extend({
    action: z.literal('get_permission'),
    permissionId: z.string(),
  }),

  // TRANSFER_OWNERSHIP
  BaseSchema.extend({
    action: z.literal('transfer_ownership'),
    newOwnerEmail: z.string().email(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // SET_LINK_SHARING
  BaseSchema.extend({
    action: z.literal('set_link_sharing'),
    enabled: z.boolean(),
    role: PermissionRoleSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // GET_SHARING_LINK
  BaseSchema.extend({
    action: z.literal('get_sharing_link'),
    role: PermissionRoleSchema.optional(),
  }),
]);

export const SheetsSharingInputSchema = z.object({
  request: SharingActionSchema,
});

const SharingResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    permission: PermissionSchema.optional(),
    permissions: z.array(PermissionSchema).optional(),
    sharingLink: z.string().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsSharingOutputSchema = z.object({
  response: SharingResponseSchema,
});

export const SHEETS_SHARING_ANNOTATIONS: ToolAnnotations = {
  title: 'Sharing & Permissions',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsSharingInput = z.infer<typeof SheetsSharingInputSchema>;
export type SheetsSharingOutput = z.infer<typeof SheetsSharingOutputSchema>;
export type SharingAction = z.infer<typeof SharingActionSchema>;
export type SharingResponse = z.infer<typeof SharingResponseSchema>;
