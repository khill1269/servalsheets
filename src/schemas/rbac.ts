/**
 * Role-Based Access Control (RBAC)
 *
 * Defines roles and permissions for multi-tenant access to ServalSheets
 */

import { z } from 'zod';

const RoleSchema = z.enum(['admin', 'editor', 'viewer', 'commenter', 'none']);
const PermissionSchema = z.enum([
  'create_spreadsheet',
  'delete_spreadsheet',
  'share_spreadsheet',
  'edit_cells',
  'edit_formulas',
  'edit_formatting',
  'insert_rows_cols',
  'delete_rows_cols',
  'read_data',
  'comment',
  'view_only',
]);

const RolePermissionsSchema = z.object({
  role: RoleSchema,
  permissions: z.array(PermissionSchema),
});

export type Role = z.infer<typeof RoleSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type RolePermissions = z.infer<typeof RolePermissionsSchema>;
