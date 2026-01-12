/**
 * Tool 11: sheets_sharing
 * Permission and sharing operations (Drive API)
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  PermissionRoleSchema,
  PermissionTypeSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const PermissionSchema = z.object({
  id: z.string(),
  type: PermissionTypeSchema,
  role: PermissionRoleSchema,
  emailAddress: z.string().optional(),
  domain: z.string().optional(),
  displayName: z.string().optional(),
  expirationTime: z.string().optional(),
});

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsSharingInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "share",
        "update_permission",
        "remove_permission",
        "list_permissions",
        "get_permission",
        "transfer_ownership",
        "set_link_sharing",
        "get_sharing_link",
      ])
      .describe("The operation to perform on the sharing/permissions"),

    // Common field
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for all actions)",
    ),

    // Fields for SHARE action
    emailAddress: z
      .string()
      .email()
      .optional()
      .describe(
        "Email address of user to share with (required for: share with type=user)",
      ),
    domain: z
      .string()
      .optional()
      .describe("Domain to share with (required for: share with type=domain)"),
    type: PermissionTypeSchema.optional().describe(
      "Permission type: user, group, domain, or anyone (required for: share)",
    ),
    role: PermissionRoleSchema.optional().describe(
      "Permission role: owner, writer, commenter, or reader (required for: share, update_permission; optional for: set_link_sharing)",
    ),
    sendNotification: z
      .boolean()
      .optional()
      .default(true)
      .describe("Send email notification to user (share only)"),
    emailMessage: z
      .string()
      .optional()
      .describe("Custom message in notification email (share only)"),
    expirationTime: z
      .string()
      .optional()
      .describe("ISO 8601 expiration time (share, update_permission)"),

    // Fields for UPDATE_PERMISSION, REMOVE_PERMISSION, GET_PERMISSION actions
    permissionId: z
      .string()
      .optional()
      .describe(
        "Permission ID to update/remove/get (required for: update_permission, remove_permission, get_permission)",
      ),

    // Fields for TRANSFER_OWNERSHIP action
    newOwnerEmail: z
      .string()
      .email()
      .optional()
      .describe("Email of new owner (required for: transfer_ownership)"),

    // Fields for SET_LINK_SHARING action
    enabled: z
      .boolean()
      .optional()
      .describe(
        "Enable or disable link sharing (required for: set_link_sharing)",
      ),

    // Safety options for mutation operations
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options like dryRun (update_permission, remove_permission, transfer_ownership, set_link_sharing)",
    ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "share":
          return !!data.spreadsheetId && !!data.type && !!data.role;
        case "update_permission":
          return !!data.spreadsheetId && !!data.permissionId && !!data.role;
        case "remove_permission":
          return !!data.spreadsheetId && !!data.permissionId;
        case "list_permissions":
          return !!data.spreadsheetId;
        case "get_permission":
          return !!data.spreadsheetId && !!data.permissionId;
        case "transfer_ownership":
          return !!data.spreadsheetId && !!data.newOwnerEmail;
        case "set_link_sharing":
          return !!data.spreadsheetId && data.enabled !== undefined;
        case "get_sharing_link":
          return !!data.spreadsheetId;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

const SharingResponseSchema = z.discriminatedUnion("success", [
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
  title: "Sharing & Permissions",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsSharingInput = z.infer<typeof SheetsSharingInputSchema>;
export type SheetsSharingOutput = z.infer<typeof SheetsSharingOutputSchema>;

export type SharingResponse = z.infer<typeof SharingResponseSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type SharingShareInput = SheetsSharingInput & {
  action: "share";
  spreadsheetId: string;
  type: string;
  role: string;
};
export type SharingUpdatePermissionInput = SheetsSharingInput & {
  action: "update_permission";
  spreadsheetId: string;
  permissionId: string;
  role: string;
};
export type SharingRemovePermissionInput = SheetsSharingInput & {
  action: "remove_permission";
  spreadsheetId: string;
  permissionId: string;
};
export type SharingListPermissionsInput = SheetsSharingInput & {
  action: "list_permissions";
  spreadsheetId: string;
};
export type SharingGetPermissionInput = SheetsSharingInput & {
  action: "get_permission";
  spreadsheetId: string;
  permissionId: string;
};
export type SharingTransferOwnershipInput = SheetsSharingInput & {
  action: "transfer_ownership";
  spreadsheetId: string;
  newOwnerEmail: string;
};
export type SharingSetLinkSharingInput = SheetsSharingInput & {
  action: "set_link_sharing";
  spreadsheetId: string;
  enabled: boolean;
};
export type SharingGetSharingLinkInput = SheetsSharingInput & {
  action: "get_sharing_link";
  spreadsheetId: string;
};
