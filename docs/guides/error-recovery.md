---
title: Error Recovery Guide
category: guide
last_updated: 2026-01-31
description: Quick Reference for AI Agents
version: 1.6.0
tags: [sheets]
audience: user
difficulty: intermediate
---

# Error Recovery Guide

**Quick Reference for AI Agents**

Learn how to handle errors gracefully and implement robust recovery strategies with ServalSheets.

> **Comprehensive Guide:** For detailed error handling patterns and production best practices, see [Error Handling Guide](ERROR_HANDLING.md).

## Common Error Types

### Google Sheets API Errors

| Error Code | Meaning             | Typical Cause                   | Recovery Strategy              |
| ---------- | ------------------- | ------------------------------- | ------------------------------ |
| **400**    | Bad Request         | Invalid parameters              | Validate inputs, check ranges  |
| **401**    | Unauthorized        | Invalid/expired token           | Re-authenticate user           |
| **403**    | Forbidden           | Insufficient permissions        | Request proper scopes          |
| **404**    | Not Found           | Spreadsheet/sheet doesn't exist | Verify IDs, check access       |
| **429**    | Rate Limit          | Quota exhausted                 | Wait and retry with backoff    |
| **500**    | Server Error        | Google API issue                | Retry with exponential backoff |
| **503**    | Service Unavailable | Temporary outage                | Retry with backoff             |

### ServalSheets-Specific Errors

| Error Type              | Meaning                  | Recovery Strategy                    |
| ----------------------- | ------------------------ | ------------------------------------ |
| **ValidationError**     | Schema validation failed | Fix input parameters                 |
| **AuthenticationError** | Auth token issue         | Re-authenticate                      |
| **PermissionError**     | Insufficient permissions | Check sharing settings               |
| **NotFoundError**       | Resource not found       | Verify IDs, list available resources |
| **ConflictError**       | Concurrent modification  | Use transactions, retry              |
| **QuotaExceededError**  | API quota exhausted      | Wait, use batching, optimize         |

## Automatic Error Recovery

ServalSheets handles many errors automatically:

### 1. Automatic Retry with Exponential Backoff

**For transient errors** (429, 500, 503):

```typescript
// You call:
await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:B10' });

// ServalSheets internally:
// Attempt 1: fails with 429 → wait 1 second
// Attempt 2: fails with 429 → wait 2 seconds
// Attempt 3: succeeds ✓
// Returns successful result transparently
```

**Default retry config**:

- Max retries: 3
- Initial delay: 1 second
- Backoff multiplier: 2x
- Max delay: 60 seconds

### 2. Automatic Token Refresh

**For 401 Unauthorized errors:**

```typescript
// You call:
await write({ action: 'write', spreadsheetId: 'xxx', range: 'A1', values: [[1]] });

// Token expired (401)
// ServalSheets automatically:
// 1. Detects 401 error
// 2. Refreshes access token using refresh token
// 3. Retries original operation
// 4. Returns success ✓
```

### 3. Automatic Cache Invalidation

**For conflict errors:**

```typescript
// Concurrent modification detected
// ServalSheets automatically:
// 1. Clears stale cache
// 2. Fetches fresh data
// 3. Retries operation with fresh data
```

## Manual Error Handling Patterns

### Pattern 1: Graceful Degradation

**Handle non-critical errors without failing entire operation:**

```typescript
async function analyzeMultipleSheets(spreadsheetId: string, sheetNames: string[]) {
  const results = [];
  const errors = [];

  for (const sheetName of sheetNames) {
    try {
      const analysis = await analyze_data({
        action: 'analyze_data',
        spreadsheetId,
        sheetName,
      });
      results.push({ sheetName, analysis });
    } catch (error) {
      // Log error but continue processing other sheets
      errors.push({ sheetName, error: error.message });
      continue;
    }
  }

  return {
    success: true,
    results,
    partialErrors: errors,
    summary: `Analyzed ${results.length}/${sheetNames.length} sheets successfully`,
  };
}
```

### Pattern 2: Retry with Backoff

**For custom retry logic beyond automatic retries:**

```typescript
async function writeWithRetry(
  data: any,
  maxRetries: number = 5,
  initialDelay: number = 2000
): Promise<void> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await write({
        action: 'write',
        spreadsheetId: 'xxx',
        range: 'A1',
        values: data,
      });
      return; // Success
    } catch (error) {
      lastError = error;

      if (error.code === 429 || error.code >= 500) {
        // Retryable error
        const delay = initialDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      } else {
        // Non-retryable error (400, 403, 404)
        throw error;
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

### Pattern 3: Fallback to Alternative Methods

**Try primary method, fall back to alternative if it fails:**

```typescript
async function getSpreadsheetData(spreadsheetId: string): Promise<any> {
  try {
    // Try fast method: read from cache
    return await read({
      action: 'read',
      spreadsheetId,
      range: 'A1:Z1000',
    });
  } catch (error) {
    if (error.code === 403) {
      // Permission denied on direct read
      // Fallback: try getting via export link
      return await exportAsCSV({
        action: 'export_csv',
        spreadsheetId,
      });
    }
    throw error; // Re-throw if not permission error
  }
}
```

### Pattern 4: Compensating Transaction

**Roll back changes if operation fails partway:**

```typescript
async function safeMultiSheetUpdate(spreadsheetId: string, updates: any[]) {
  const completedUpdates: string[] = [];

  try {
    for (const update of updates) {
      await write({
        action: 'write',
        spreadsheetId,
        range: update.range,
        values: update.values,
      });
      completedUpdates.push(update.range);
    }
    return { success: true };
  } catch (error) {
    // Rollback: undo completed updates
    for (const range of completedUpdates) {
      try {
        await undo({ action: 'undo', spreadsheetId });
      } catch (rollbackError) {
        // Log rollback failure but continue
        console.error(`Failed to rollback ${range}:`, rollbackError);
      }
    }
    throw error;
  }
}
```

**Better Alternative**: Use transactions (automatic rollback)

```typescript
// ✅ BETTER: Use transaction for automatic rollback
await begin_transaction({ action: 'begin', spreadsheetId });
try {
  for (const update of updates) {
    await queue_operation({
      action: 'queue',
      operation: { type: 'write', range: update.range, values: update.values },
    });
  }
  await commit_transaction({ action: 'commit' });
  return { success: true };
} catch (error) {
  await rollback_transaction({ action: 'rollback' });
  throw error;
}
```

## Error-Specific Recovery

### 400 Bad Request

**Causes:**

- Invalid range format (e.g., "A1:B1000000000" exceeds sheet size)
- Invalid parameters (wrong type, missing required field)
- Malformed data (invalid cell values)

**Recovery:**

```typescript
try {
  await write({ action: 'write', spreadsheetId: 'xxx', range: 'InvalidRange!A1', values: [[1]] });
} catch (error) {
  if (error.code === 400) {
    // Validate and fix parameters
    const sheets = await list_sheets({ action: 'list_sheets', spreadsheetId: 'xxx' });
    const validSheetName = sheets[0].properties.title;

    // Retry with valid range
    await write({
      action: 'write',
      spreadsheetId: 'xxx',
      range: `${validSheetName}!A1`,
      values: [[1]],
    });
  }
}
```

### 401 Unauthorized

**Causes:**

- Access token expired
- Invalid token
- Token revoked

**Recovery:**

```typescript
try {
  await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:B10' });
} catch (error) {
  if (error.code === 401) {
    // Automatic token refresh usually handles this
    // If you still get 401, user needs to re-authenticate
    throw new Error('Please re-authenticate: Your session has expired');
  }
}
```

### 403 Forbidden

**Causes:**

- Insufficient OAuth scopes
- Spreadsheet not shared with user
- User lacks edit permission (trying to write to read-only sheet)

**Recovery:**

```typescript
try {
  await write({ action: 'write', spreadsheetId: 'xxx', range: 'A1', values: [[1]] });
} catch (error) {
  if (error.code === 403) {
    // Check current permissions
    const info = await get_info({ action: 'get_info', spreadsheetId: 'xxx' });

    if (info.permissions.canEdit === false) {
      throw new Error('Cannot write: Spreadsheet is read-only for your account');
    } else {
      throw new Error('Insufficient permissions: Please request edit access');
    }
  }
}
```

### 404 Not Found

**Causes:**

- Spreadsheet ID doesn't exist
- Sheet name doesn't exist
- Spreadsheet was deleted

**Recovery:**

```typescript
try {
  await read({ action: 'read', spreadsheetId: 'xxx', range: 'NonexistentSheet!A1' });
} catch (error) {
  if (error.code === 404) {
    // List available sheets
    const sheets = await list_sheets({ action: 'list_sheets', spreadsheetId: 'xxx' });
    const availableNames = sheets.map((s) => s.properties.title);

    throw new Error(`Sheet not found. Available sheets: ${availableNames.join(', ')}`);
  }
}
```

### 429 Rate Limit Exceeded

**Causes:**

- Too many API calls in short period
- Quota exhausted

**Recovery** (automatic + manual):

```typescript
try {
  // Make many API calls
  for (let i = 0; i < 1000; i++) {
    await read({ action: 'read', spreadsheetId: 'xxx', range: `A${i}` });
  }
} catch (error) {
  if (error.code === 429) {
    // ServalSheets already retried 3 times
    // Additional recovery: use batching to reduce API calls
    const ranges = Array.from({ length: 1000 }, (_, i) => `A${i}`);
    const result = await batch_read({
      action: 'batch_read',
      spreadsheetId: 'xxx',
      ranges,
    });
    // 1000 calls → 10 calls (batch size limit: 100)
  }
}
```

### 500/503 Server Errors

**Causes:**

- Temporary Google API outage
- Google server overload

**Recovery** (automatic):

```typescript
// ServalSheets automatically retries with exponential backoff
// You don't need to handle this explicitly

await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:B10' });
// If 500/503 error occurs:
// - Retry 1: wait 1s
// - Retry 2: wait 2s
// - Retry 3: wait 4s
// If still failing after 3 retries, throws error
```

## Error Recovery Best Practices

### Practice 1: Use Transactions for Multi-Step Operations

**✅ GOOD: Atomic operations with automatic rollback:**

```typescript
await begin_transaction({ action: 'begin', spreadsheetId: 'xxx' });
try {
  await queue_operation({
    action: 'queue',
    operation: { type: 'write', range: 'A1', values: [[1]] },
  });
  await queue_operation({
    action: 'queue',
    operation: { type: 'write', range: 'A2', values: [[2]] },
  });
  await queue_operation({
    action: 'queue',
    operation: { type: 'write', range: 'A3', values: [[3]] },
  });
  await commit_transaction({ action: 'commit' });
} catch (error) {
  // Automatic rollback on error
  await rollback_transaction({ action: 'rollback' });
  throw error;
}
```

### Practice 2: Validate Inputs Before API Calls

**✅ GOOD: Catch errors early:**

```typescript
async function safeWrite(spreadsheetId: string, range: string, values: any[][]) {
  // Validate inputs locally (no API call)
  if (!spreadsheetId || !range || !values) {
    throw new Error('Missing required parameters');
  }

  if (values.length === 0) {
    throw new Error('Values array cannot be empty');
  }

  // Validate range format
  if (!/^[A-Z]+\d+:[A-Z]+\d+$/.test(range)) {
    throw new Error(`Invalid range format: ${range}`);
  }

  // Only make API call after validation
  return await write({
    action: 'write',
    spreadsheetId,
    range,
    values,
  });
}
```

### Practice 3: Log Errors for Debugging

**✅ GOOD: Structured error logging:**

```typescript
async function operationWithLogging() {
  try {
    await write({ action: 'write', spreadsheetId: 'xxx', range: 'A1', values: [[1]] });
  } catch (error) {
    // Structured error log
    console.error('Write operation failed', {
      timestamp: new Date().toISOString(),
      spreadsheetId: 'xxx',
      range: 'A1',
      errorCode: error.code,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    throw error;
  }
}
```

### Practice 4: Provide User-Friendly Error Messages

**✅ GOOD: Translate technical errors to user language:**

```typescript
async function userFriendlyRead(spreadsheetId: string, range: string) {
  try {
    return await read({ action: 'read', spreadsheetId, range });
  } catch (error) {
    // Translate error codes to user-friendly messages
    switch (error.code) {
      case 400:
        throw new Error(`Invalid range "${range}". Please check the range format.`);
      case 401:
        throw new Error('Your session has expired. Please log in again.');
      case 403:
        throw new Error("You don't have permission to access this spreadsheet.");
      case 404:
        throw new Error(
          'Spreadsheet not found. It may have been deleted or you may not have access.'
        );
      case 429:
        throw new Error('Too many requests. Please wait a moment and try again.');
      default:
        throw new Error(`An error occurred: ${error.message}`);
    }
  }
}
```

## Circuit Breaker Pattern

**For preventing cascading failures:**

```typescript
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN. Service unavailable.');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

async function protectedOperation() {
  return await breaker.execute(async () => {
    return await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:B10' });
  });
}
```

## Error Recovery Decision Tree

```
Error occurred
  │
  ├─ Is error retryable? (429, 500, 503)
  │   ├─ Yes → Wait with exponential backoff, retry
  │   └─ No → Continue to next check
  │
  ├─ Is error a validation issue? (400)
  │   ├─ Yes → Validate inputs, fix parameters, retry
  │   └─ No → Continue to next check
  │
  ├─ Is error an auth issue? (401, 403)
  │   ├─ 401 → Refresh token, retry
  │   └─ 403 → Check permissions, request access
  │
  ├─ Is error a not-found issue? (404)
  │   ├─ Yes → List available resources, use correct ID
  │   └─ No → Continue to next check
  │
  └─ Unhandled error
      └─ Log error, notify user, fail gracefully
```

## Summary

### Automatic Recovery (Built-in)

- ✅ Exponential backoff for 429, 500, 503
- ✅ Automatic token refresh for 401
- ✅ Cache invalidation for conflict errors

### Manual Recovery Patterns

- **Graceful degradation**: Handle non-critical errors without failing
- **Retry with backoff**: Custom retry logic for specific scenarios
- **Fallback methods**: Try alternative approaches on failure
- **Compensating transactions**: Roll back on failure (use transactions!)

### Error-Specific Strategies

| Error   | Strategy                             |
| ------- | ------------------------------------ |
| 400     | Validate inputs, fix parameters      |
| 401     | Automatic token refresh (built-in)   |
| 403     | Check permissions, request access    |
| 404     | Verify IDs, list available resources |
| 429     | Use batching, reduce API calls       |
| 500/503 | Automatic retry (built-in)           |

### Best Practices

1. Use transactions for multi-step operations
2. Validate inputs before API calls
3. Log errors with structured data
4. Provide user-friendly error messages
5. Implement circuit breaker for cascading failures

## Related Resources

- **Quota Optimization**: `servalsheets://guides/quota-optimization`
- **Transaction Guide**: `servalsheets://decisions/when-to-use-transaction`
- **Troubleshooting**: `docs/guides/TROUBLESHOOTING.md`
