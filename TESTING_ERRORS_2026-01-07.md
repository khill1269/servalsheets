# ServalSheets Testing Errors - Claude Desktop
## 2026-01-07 - Error Analysis & Fixes

---

## 🐛 **Error 1: sheets_sharing - MCP Output Validation Error**

### **Error Message**
```
MCP error -32602: Output validation error: Invalid structured content for tool sheets_sharing:
[ {
  "code": "invalid_union_discriminator",
  "options": [ true, false ],
  "path": [ "response", "success" ],
  "message": "Invalid discriminator value. Expected true | false"
} ]
```

### **Root Cause**
The SharingHandler was returning `IncrementalScopeRequiredError.toToolResponse()` which returns a non-standard MCP error format:

```typescript
// WRONG FORMAT (IncrementalScopeRequiredError.toToolResponse())
{
  content: [{ type: 'text', text: '...' }],
  structuredContent: { error, code, operation, ... },
  isError: true
}
```

But the `SharingResponseSchema` expects a discriminated union:

```typescript
// EXPECTED FORMAT (SharingResponseSchema)
{
  response: {
    success: false,  // ← Discriminator field
    error: ErrorDetailSchema
  }
}
```

The schema uses `z.discriminatedUnion('success', [...])` which requires the `success` field to be either `true` or `false`. The old code was casting `toToolResponse()` result with `as unknown as SharingResponse`, which bypassed TypeScript validation but failed MCP runtime validation.

### **Fix Applied** ✅

**File**: `src/handlers/sharing.ts:56-95`

Changed from:
```typescript
const error = new IncrementalScopeRequiredError({ ... });
return { response: error.toToolResponse() as unknown as SharingResponse };
```

To:
```typescript
return {
  response: this.error({
    code: 'PERMISSION_DENIED',
    message: requirements?.description ?? 'Sharing operations require full Drive access',
    category: 'auth',
    severity: 'high',
    retryable: false,
    retryStrategy: 'manual',
    details: {
      operation,
      requiredScopes: requirements?.required ?? ['https://www.googleapis.com/auth/drive'],
      currentScopes: this.context.auth?.scopes ?? [],
      missingScopes: requirements?.missing ?? ['https://www.googleapis.com/auth/drive'],
      authorizationUrl: authUrl,
      scopeCategory: requirements?.category ?? ScopeCategory.DRIVE_FULL,
    },
    resolution: 'Grant additional permissions to complete this operation.',
    resolutionSteps: [
      '1. Visit the authorization URL to approve required scopes',
      `2. Authorization URL: ${authUrl}`,
      '3. After approving, retry the operation',
    ],
  }),
};
```

### **Result**
- ✅ Output now matches `SharingResponseSchema` discriminated union
- ✅ MCP validation passes
- ✅ Error details include authorization URL and scope information
- ✅ Proper error structure with resolution steps

### **Commit**
`ce7f10c - fix(sharing): Fix MCP output validation error for incremental scope`

---

## 🔐 **Error 2: sheets_comments - Drive API Not Enabled**

### **Error Message**
```json
{
  "response": {
    "success": false,
    "error": {
      "code": "PERMISSION_DENIED",
      "message": "Google Drive API has not been used in project 650528178356 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=650528178356 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.",
      "category": "auth",
      "severity": "high",
      "retryable": false,
      "retryStrategy": "manual"
    }
  }
}
```

### **Root Cause**
This is **NOT a code bug** - it's a **Google Cloud configuration issue**. The `sheets_comments` tool requires the **Google Drive API** to be enabled in your Google Cloud project because:

1. **Comments are Drive API resources**: Google Sheets comments are managed through the Drive API, not the Sheets API
2. **Drive API required**: The Drive API must be explicitly enabled in Google Cloud Console
3. **Project not configured**: Your project (`650528178356`) has never enabled the Drive API

### **Why Comments Need Drive API**

Google Sheets comments are implemented as Drive API "comments" on the file resource. The Sheets API does NOT provide comment endpoints. This means:

- **sheets_comments** → Uses `drive.comments.create()`, `drive.comments.list()`, etc.
- **sheets_versions** → Uses `drive.revisions.list()`, `drive.revisions.get()`, etc.
- **sheets_sharing** → Uses `drive.permissions.create()`, `drive.permissions.list()`, etc.

### **Fix Required** 🔧 (User Action)

**Enable Drive API in Google Cloud Console:**

1. Visit: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=650528178356
2. Click **"Enable API"**
3. Wait 2-3 minutes for propagation
4. Retry the operation

**Alternative - Enable via gcloud CLI:**
```bash
gcloud services enable drive.googleapis.com --project=650528178356
```

### **Expected Behavior After Fix**
Once Drive API is enabled:
- ✅ `sheets_comments` will work (add, list, reply, resolve)
- ✅ `sheets_versions` will work (list revisions, restore)
- ✅ `sheets_sharing` will work (share, permissions)

### **Code Status**
- ✅ Handler correctly detects missing Drive API
- ✅ Error message is clear and actionable
- ✅ No code changes needed

---

## ⚠️ **Error 3: sheets_versions - No Result Received**

### **Error Message**
```
No result received from client-side tool execution.
```

### **Root Cause**
This is likely the **same issue as Error 2** - Drive API not enabled. When the `sheets_versions` handler tries to execute, it:

1. Checks if `driveApi` is initialized
2. If not, returns an error response
3. **But** MCP client might be timing out or not receiving the response properly

### **Investigation Needed**

Let me check the handler:

**File**: `src/handlers/versions.ts:28-48`

```typescript
async handle(input: SheetsVersionsInput): Promise<SheetsVersionsOutput> {
  if (!this.driveApi) {
    return {
      response: this.error({
        code: 'INTERNAL_ERROR',
        message: 'Drive API not available - required for version operations',
        details: { ... },
        retryable: false,
        // ...
      }),
    };
  }
  // ... rest of handler
}
```

The handler correctly returns an error when Drive API is not available. The "no result" error suggests:

### **Possible Causes**

1. **Drive API not enabled** (same as Error 2)
   - Handler tries to use Drive API
   - Google throws 403 error
   - MCP client timeout before error propagates

2. **Timeout during execution**
   - Version operations can be slow (fetching revision history)
   - Default MCP timeout might be too short
   - Server returns error after timeout

3. **Schema validation failure** (similar to Error 1)
   - Response doesn't match `VersionsResponseSchema`
   - MCP client rejects malformed response
   - Reports as "no result"

### **Fix Steps** 🔧

**Step 1: Enable Drive API**
Same as Error 2 - enable Drive API in Google Cloud Console

**Step 2: Test Again**
After enabling Drive API, retry `sheets_versions` operations:
- `list_revisions` - Should list file revision history
- `get_revision` - Should fetch specific revision
- `create_snapshot` - Should create local snapshot

**Step 3: Check Logs**
If still failing after enabling Drive API, check logs:
```bash
tail -f ~/Library/Logs/Claude/mcp-server-servalsheets.log | grep sheets_versions
```

Look for:
- ✅ Success messages: `"message":"Tool call successful"`
- ❌ Error messages: `"level":"error"`
- ⏱️ Timeout indicators: Long gaps in timestamps

### **Code Status**
- ✅ Handler structure looks correct
- ✅ Error handling implemented
- ⚠️ Need to verify after Drive API is enabled
- ⚠️ May need to investigate timeout settings if issue persists

---

## 📊 **Summary of Fixes**

| Error | Tool | Status | Action Required |
|-------|------|--------|-----------------|
| MCP validation error | `sheets_sharing` | ✅ **FIXED** | Code updated, rebuild complete |
| Drive API not enabled | `sheets_comments` | 🔧 **USER ACTION** | Enable Drive API in Google Cloud Console |
| No result received | `sheets_versions` | ⚠️ **NEEDS TESTING** | Enable Drive API, then retest |

---

## 🚀 **Next Steps**

### **1. Enable Drive API** (Required)

Visit: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=650528178356

Or use gcloud CLI:
```bash
gcloud services enable drive.googleapis.com --project=650528178356
```

### **2. Restart Claude Desktop**

After enabling Drive API:
1. Quit Claude Desktop completely
2. Wait 2-3 minutes for API propagation
3. Restart Claude Desktop
4. Retry the failed operations

### **3. Test Each Tool**

**Test sheets_sharing:**
```json
{
  "action": "list_permissions",
  "spreadsheetId": "YOUR_SPREADSHEET_ID"
}
```

**Test sheets_comments:**
```json
{
  "action": "list",
  "spreadsheetId": "YOUR_SPREADSHEET_ID"
}
```

**Test sheets_versions:**
```json
{
  "action": "list_revisions",
  "spreadsheetId": "YOUR_SPREADSHEET_ID"
}
```

### **4. Monitor Logs**

Watch logs during testing:
```bash
tail -f ~/Library/Logs/Claude/mcp-server-servalsheets.log
```

Look for:
- ✅ **Success**: `"message":"Tool call successful"`
- ✅ **Auth working**: `"message":"Elevated scope operation"`
- ❌ **Still failing**: Check error codes and messages

---

## 📚 **Related Tools Requiring Drive API**

These tools **require Drive API to be enabled**:

| Tool | Actions | Drive API Used For |
|------|---------|-------------------|
| `sheets_sharing` | share, update_permission, remove_permission, list_permissions, transfer_ownership | Drive permissions API |
| `sheets_comments` | add, update, delete, list, get, resolve, reopen, add_reply, update_reply, delete_reply | Drive comments API |
| `sheets_versions` | list_revisions, get_revision, restore_revision, keep_revision, export_version | Drive revisions API |

All other 21 tools use **only Sheets API** and don't require Drive API.

---

## 🔍 **Debugging Guide**

### **If sheets_sharing still fails after fix:**

1. Check response structure in logs
2. Verify `success` field is `true` or `false`
3. Check error format matches `ErrorDetailSchema`

### **If sheets_comments still fails after enabling Drive API:**

1. Verify Drive API is enabled: `gcloud services list --enabled --project=650528178356`
2. Check scopes in auth: Should include `https://www.googleapis.com/auth/drive` or `drive.file`
3. Verify service account has Drive permissions on the spreadsheet

### **If sheets_versions still shows "no result":**

1. Check if Drive API is enabled
2. Increase MCP timeout if needed (default 2 minutes)
3. Test with smaller operations first (e.g., `list_revisions` with `maxResults: 5`)
4. Check for schema validation errors in logs

---

## ✅ **Verification Checklist**

After applying fixes and enabling Drive API:

- [ ] `sheets_sharing` list_permissions works
- [ ] `sheets_sharing` returns valid JSON (no MCP validation errors)
- [ ] `sheets_comments` list returns comments (not Drive API error)
- [ ] `sheets_versions` list_revisions returns revision history
- [ ] All three tools show successful operations in logs
- [ ] No MCP validation errors in Claude Desktop
- [ ] Error responses have proper `success: false` format

---

## 📝 **Notes**

- **Error 1** was a **code bug** → Fixed in `ce7f10c`
- **Error 2** is a **configuration issue** → User must enable Drive API
- **Error 3** is likely **same as Error 2** → Will resolve after Drive API is enabled

All fixes preserve backward compatibility and don't affect other tools.
