# Role-Based Access Control (RBAC) Guide

**ServalSheets RBAC Implementation**  
Version: 2.0.0  
MCP: 2025-11-25

## Overview

ServalSheets implements a flexible role-based access control system with:
- 5 built-in roles (Admin, Editor, Viewer, Analyst, Collaborator)
- Custom role support (via OAuth scopes or API key permissions)
- Per-spreadsheet permission enforcement
- Action-level permission checks (mutation vs read-only)

## Built-In Roles

### 1. Admin

**Permissions:** All actions (409/409)

- Can perform all operations
- Can manage users and permissions
- Can delete spreadsheets and data
- Can configure webhooks and integrations
- Can export/backup entire spreadsheets

**Use Case:** Spreadsheet owner, team lead

### 2. Editor

**Permissions:** 380/409 actions (all mutations + reads)

**Excluded Actions:**
- Sharing: share_add, share_remove, share_transfer_ownership
- User Management: All session/confirm actions
- Webhooks: All webhook configuration
- Federation: Remote server calls

**Use Case:** Regular team members who can edit but not share

### 3. Viewer

**Permissions:** 150/409 actions (read-only)

**Allowed:**
- sheets_core: get, list, get_sheet, get_url
- sheets_data: read, batch_read, cross_read
- sheets_analyze: All (read-only analysis)
- sheets_history: All (view revision history)

**Excluded:** All mutations (write, format, delete, etc.)

**Use Case:** External stakeholders, auditors, read-only access

### 4. Analyst

**Permissions:** 200/409 actions (reads + analysis)

**Allowed:**
- sheets_data: read, batch_read, cross_read, cross_query
- sheets_analyze: All 26 actions
- sheets_dependencies: All 10 actions (impact analysis)
- sheets_visualize: chart_create, suggest_chart, pivot_create, suggest_pivot (no delete)
- sheets_quality: All 4 actions

**Excluded:** Data mutations (write, format, etc.), sharing

**Use Case:** Data analysts who need deep insights but no mutation access

### 5. Collaborator

**Permissions:** 280/409 actions (reads + limited mutations + sharing)

**Allowed:**
- All Analyst permissions (reads + analysis)
- sheets_data: write, append, clear, find_replace (with confirmation)
- sheets_format: All 25 actions
- sheets_collaborate: comment_add, comment_reply, share_set_link (read-only link)

**Excluded:** Ownership transfer, user removal, deletion

**Use Case:** Team members who share and collaborate but can't change permissions

## Permission Model

### Permission Hierarchy

```
Admin
├── Editor
├── Viewer
├── Analyst
└── Collaborator
```

**NOT a strict hierarchy** — each role has distinct allowed actions.

### Action Classification

All 409 actions classified as:

- **Read** (150 actions): Retrieve data without modification
- **Mutation** (150 actions): Modify data (write, delete, format)
- **Meta** (59 actions): Manage metadata (sharing, versions, webhooks)
- **Analysis** (50 actions): Analyze data (no modification)

### Enforced at Three Levels

1. **Schema Level** — Action present in tool schema
2. **Handler Level** — Permission check before execution
3. **Service Level** — Google API call respects OAuth scopes

## Custom Roles via API Key Scopes

### Default Scopes

```json
{
  "default": ["spreadsheets.read", "spreadsheets.write"],
  "full": ["spreadsheets", "drive", "forms"],
  "readonly": ["spreadsheets.read"]
}
```

### Scope → Permission Mapping

| Scope                | Allowed Actions          |
| -------------------- | ------------------------ |
| spreadsheets.read    | All reads (150 actions)  |
| spreadsheets.write   | All mutations (150)      |
| drive                | Sharing, federation      |
| forms                | Forms read/write         |
| analytics            | Analytics connector      |

### Custom Scope Definition

```json
{
  "roleId": "custom_analyst",
  "description": "Data analyst with no write access",
  "scopes": ["spreadsheets.read", "analytics"],
  "allowedActions": [
    "sheets_data.read",
    "sheets_data.batch_read",
    "sheets_analyze.*",
    "sheets_dependencies.*",
    "sheets_quality.*"
  ],
  "deniedActions": ["sheets_data.write", "sheets_data.delete"]
}
```

## Implementation Details

### Permission Check Pattern

```typescript
// In handler before action execution:
private async handleMutationAction(req: MutationInput): Promise<Output> {
  // 1. Check permission
  const allowed = this.context.rbac.can(this.context.userId, 'sheets_data.write');
  if (!allowed) {
    return { response: {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'User does not have write permission for this spreadsheet',
      },
    }};
  }

  // 2. Proceed with action
  // ...
}
```

### Role Assignment

```typescript
// Assign role to user on spreadsheet
await rbac.assignRole({
  userId: 'user@example.com',
  spreadsheetId: '1abc123',
  role: 'Editor',
});
```

### OAuth Integration

When user authenticates via OAuth:

1. Google returns user scopes (e.g., ["spreadsheets", "drive"])
2. ServalSheets maps scopes → default role (e.g., "Editor")
3. User can only perform actions in that role
4. Custom roles created via API key management

## Enforcement Points

### Sheet-Level Access

- User must have access to spreadsheetId
- Enforced in `validateSheetAccess()` middleware
- Returns 403 Forbidden if denied

### Action-Level Access

- User must have permission for specific action
- Enforced in handler method (before Google API call)
- Returns 403 Permission Denied if denied

### Field-Level Access (Optional)

Can restrict access to specific columns/rows:

```typescript
const allowed = await rbac.canAccessRange({
  userId: 'user@example.com',
  spreadsheetId: '1abc123',
  range: 'A1:Z100', // Specific range
  action: 'write',
});
```

## Audit Logging

All permission checks logged with:
- Timestamp
- User ID
- Action attempted
- Permission result (allowed/denied)
- Reason (if denied)

```json
{
  "timestamp": "2026-04-05T10:30:00Z",
  "userId": "user@example.com",
  "action": "sheets_data.write",
  "spreadsheetId": "1abc123",
  "result": "denied",
  "reason": "User has Viewer role, which does not allow write actions"
}
```

## Examples

### Example 1: Invite Colleague as Viewer

```typescript
await handler.share_add({
  spreadsheetId: '1abc123',
  emailAddress: 'colleague@example.com',
  role: 'Viewer',
});
// colleague@example.com can now:
// - Read all data
// - View analysis
// - See version history
// Cannot: Modify, delete, or share
```

### Example 2: Grant Data Analyst Access

```typescript
await rbac.assignRole({
  userId: 'analyst@company.com',
  spreadsheetId: '1abc123',
  role: 'Analyst',
});
// analyst@company.com can now:
// - Perform all analysis (scout, comprehensive, etc.)
// - View dependencies and impact
// - Create charts (no mutations)
// Cannot: Modify data, share spreadsheet
```

### Example 3: Create Custom Role (Finance Team)

```typescript
await rbac.createCustomRole({
  roleId: 'finance_editor',
  description: 'Finance team with audit trail requirements',
  baseRole: 'Editor',
  restrictions: {
    denyActions: [
      'sheets_data.delete_duplicates', // Preserve audit trail
      'sheets_history.clear', // Keep history
    ],
    auditLevel: 'strict', // Log all reads + writes
  },
});
```

## Testing RBAC

### Test Cases

1. **Admin can do everything** — Test all 409 actions with Admin role
2. **Viewer blocked from mutations** — Try sheets_data.write with Viewer → expect 403
3. **Analyst blocked from sharing** — Try sheets_collaborate.share_add with Analyst → expect 403
4. **Custom role honored** — Test custom scope restrictions
5. **Cross-spreadsheet isolation** — User has Editor on sheet A, Viewer on sheet B → verify correct permissions per sheet

### Integration Test

```typescript
test('RBAC: Viewer cannot modify data', async () => {
  // User has Viewer role
  const result = await handler.write({
    spreadsheetId: '1abc123',
    range: 'A1',
    values: [['test']],
  });

  // Should be denied
  expect(result.response.success).toBe(false);
  expect(result.response.error.code).toBe('PERMISSION_DENIED');
});
```

## Troubleshooting

### Problem: "Permission Denied" when expecting access

**Diagnosis:**
1. Check user role: `rbac.getRole(userId, spreadsheetId)`
2. Check action in role: `rbac.canPerformAction(role, action)`
3. Check audit log: Filter by userId + action

**Solutions:**
- Upgrade user role: `rbac.assignRole(userId, spreadsheetId, 'Editor')`
- Grant specific action via custom role

### Problem: Sharing not working

**Diagnosis:**
1. Check if user has share permission: `rbac.can(userId, 'sheets_collaborate.share_add')`
2. Check drive.write scope in OAuth

**Solutions:**
- Upgrade to Editor or higher
- Collaborator role can share (read-only links only)

## Security Best Practices

1. **Never skip permission checks** — Always validate before Google API call
2. **Log all mutations** — Audit trail for compliance
3. **Restrict by default** — New roles start Viewer, escalate as needed
4. **Rotate API keys** — If key is exposed, revoke and regenerate
5. **Use OAuth for interactive** — OAuth enforces Google's permissions
6. **Use API keys for service accounts** — Service accounts use custom scopes
7. **Audit quarterly** — Review user permissions quarterly

## FAQ

**Q: Can a user have multiple roles on the same spreadsheet?**
A: No, one role per user per spreadsheet. Assign the highest role needed.

**Q: Can I grant row-level or column-level access?**
A: Not built-in, but possible via custom roles + field-level filtering.

**Q: Are permissions checked at the Google API level too?**
A: Yes, Google enforces OAuth scopes. ServalSheets adds an additional layer of role-based checks.

**Q: How are inherited permissions handled (spreadsheet owner vs shared)?**
A: Owner has Admin role; shared users get assigned specific roles.

**Q: Can I revoke access retroactively?**
A: Yes. Remove role assignment and user loses access immediately. Audit trail preserved.
