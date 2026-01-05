# Quick Wins Implementation Examples

This document shows how to use the quick win features implemented in ServalSheets.

## Quick Win #1: Response Metadata with Suggestions

Every tool response can now include intelligent suggestions, cost estimates, and related tools.

### Example 1: Basic Usage

```typescript
// In your handler method
async handleRead(input: SheetsValuesInput): Promise<SheetsValuesOutput> {
  const startTime = Date.now();

  // Execute the operation
  const response = await this.sheetsApi.spreadsheets.values.get({
    spreadsheetId: input.spreadsheetId,
    range: input.range,
  });

  const values = response.data.values || [];
  const duration = Date.now() - startTime;

  // Generate intelligent metadata
  const meta = this.generateMeta(
    'read',
    input,
    { values },
    {
      cellsAffected: values.reduce((sum, row) => sum + row.length, 0),
      apiCallsMade: 1,
      duration,
    }
  );

  // Return with metadata
  return this.success(
    'read',
    {
      values,
      range: input.range,
      rowCount: values.length,
    },
    undefined, // no mutation for reads
    undefined, // not a dry run
    meta       // include the metadata
  );
}
```

### Example Response with Metadata

```json
{
  "success": true,
  "action": "read",
  "values": [["Name", "Age"], ["Alice", 30], ["Bob", 25]],
  "range": "Sheet1!A1:B3",
  "rowCount": 3,
  "_meta": {
    "suggestions": [
      {
        "type": "optimization",
        "message": "For multiple reads, use batch_read to reduce API calls",
        "tool": "sheets_values",
        "action": "batch_read",
        "reason": "Batch operations are ~80% faster and use fewer API calls",
        "priority": "medium"
      },
      {
        "type": "follow_up",
        "message": "Large dataset read. Consider using analysis tools for insights",
        "tool": "sheets_analysis",
        "action": "profile",
        "reason": "Get statistical insights, detect patterns, and validate data quality",
        "priority": "low"
      }
    ],
    "costEstimate": {
      "apiCalls": 1,
      "estimatedLatencyMs": 342,
      "cellsAffected": 6,
      "quotaImpact": {
        "current": 0,
        "limit": 60,
        "remaining": 59
      }
    },
    "relatedTools": [
      "sheets_values:batch_read",
      "sheets_analysis:scout",
      "sheets_analysis:profile"
    ],
    "nextSteps": [
      "Analyze data with sheets_analysis:profile for statistical insights",
      "Format the range with sheets_format:apply for better readability"
    ]
  }
}
```

## Quick Win #2: Dry-Run Mode

All write operations support dry-run mode to preview changes before executing them.

### Example 2: Write with Dry-Run

```typescript
async handleWrite(input: SheetsValuesInput): Promise<SheetsValuesOutput> {
  const { spreadsheetId, range, values, safety } = input;

  // Check if this is a dry-run
  if (safety?.dryRun) {
    // Optionally fetch current values for comparison
    const currentResponse = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const currentValues = currentResponse.data.values;

    // Simulate the operation
    const dryRunResult = simulateWrite({
      spreadsheetId,
      range,
      values,
      currentValues,
    });

    // Generate metadata for dry-run
    const meta = this.generateMeta(
      'write',
      input,
      { dryRunResult },
      {
        cellsAffected: dryRunResult.impact.cellsAffected,
        apiCallsMade: 0, // No actual API calls in dry-run
        duration: 0,
      }
    );

    // Add special warning suggestion for dry-run
    meta.suggestions = meta.suggestions || [];
    meta.suggestions.unshift({
      type: 'warning',
      message: 'This is a DRY RUN - no changes were made',
      reason: 'Remove safety.dryRun to execute the operation',
      priority: 'high',
    });

    // Return dry-run response
    return this.success(
      'write',
      {
        dryRunResult,
        preview: formatDryRunResult(dryRunResult),
        message: 'Dry run completed - no changes were made',
      },
      undefined,
      true, // Mark as dry-run
      meta
    );
  }

  // Normal execution
  const intents = this.createIntents(input);
  const results = await this.executeIntents(intents, safety);

  const meta = this.generateMeta(
    'write',
    input,
    { cellsWritten: values.reduce((s, r) => s + r.length, 0) },
    {
      cellsAffected: values.reduce((s, r) => s + r.length, 0),
      apiCallsMade: 1,
    }
  );

  return this.success(
    'write',
    {
      range,
      updatedCells: values.reduce((s, r) => s + r.length, 0),
      updatedRows: values.length,
    },
    this.createMutationSummary(results),
    false,
    meta
  );
}
```

### Example Dry-Run Request

```json
{
  "tool": "sheets_values",
  "action": "write",
  "spreadsheetId": "1ABC...",
  "range": "Sheet1!A1:B3",
  "values": [
    ["Name", "Age"],
    ["Alice", 30],
    ["Bob", 25]
  ],
  "safety": {
    "dryRun": true
  }
}
```

### Example Dry-Run Response

```json
{
  "success": true,
  "action": "write",
  "dryRun": true,
  "message": "Dry run completed - no changes were made",
  "dryRunResult": {
    "wouldSucceed": true,
    "preview": {
      "operation": "write",
      "target": "1ABC...!Sheet1!A1:B3",
      "changes": [
        {
          "type": "update",
          "location": "Sheet1!A1:B3!A1",
          "before": "Old Name",
          "after": "Name",
          "description": "Update from \"Old Name\" to \"Name\""
        }
      ],
      "summary": "Write 6 cells (3 rows × 2 cols) to Sheet1!A1:B3"
    },
    "impact": {
      "cellsAffected": 6,
      "rowsAffected": 3,
      "columnsAffected": 2,
      "estimatedDuration": 500
    },
    "warnings": [],
    "risks": [
      {
        "level": "medium",
        "message": "Overwriting existing data",
        "mitigation": "Create a snapshot before proceeding"
      }
    ],
    "rollback": {
      "possible": true,
      "method": "snapshot",
      "steps": [
        "A snapshot will be created automatically",
        "Revert with sheets_versions:revert if needed",
        "Original data: 3 rows"
      ]
    }
  },
  "preview": "=== DRY RUN PREVIEW ===\n\nOperation: write\nTarget: 1ABC...!Sheet1!A1:B3\n...",
  "_meta": {
    "suggestions": [
      {
        "type": "warning",
        "message": "This is a DRY RUN - no changes were made",
        "reason": "Remove safety.dryRun to execute the operation",
        "priority": "high"
      },
      {
        "type": "follow_up",
        "message": "Data written successfully. Consider formatting the range",
        "tool": "sheets_format",
        "action": "apply",
        "reason": "Formatting improves readability and data consistency",
        "priority": "low"
      }
    ],
    "costEstimate": {
      "apiCalls": 0,
      "estimatedLatencyMs": 0,
      "cellsAffected": 6,
      "quotaImpact": {
        "current": 0,
        "limit": 60,
        "remaining": 60
      }
    }
  }
}
```

## Quick Win #3: Enhanced Error Messages

Error messages now include resolution steps and suggested tools (already implemented in error-factory.ts).

### Example 3: Permission Error with Recovery Steps

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Permission denied: Cannot write to sheet. Current access: view, required: edit",
    "category": "auth",
    "severity": "high",
    "retryable": false,
    "retryStrategy": "manual",
    "resolution": "Request edit access from the spreadsheet owner or use read-only operations",
    "resolutionSteps": [
      "1. Check current permission level: Use 'sheets_permission_list' tool to verify access",
      "2. Request edit access from the spreadsheet owner",
      "3. Alternative: Use read-only operations (sheets_values_get with readOnly=true)",
      "4. If you're the owner: Use 'sheets_permission_grant' to give yourself edit access"
    ],
    "suggestedTools": [
      "sheets_permission_list",
      "sheets_permission_grant",
      "sheets_values_get",
      "sheets_spreadsheet_get"
    ],
    "details": {
      "operation": "write to sheet",
      "resourceType": "spreadsheet",
      "currentPermission": "view",
      "requiredPermission": "edit"
    }
  }
}
```

## Combining All Features

Here's a complete handler that uses all quick wins:

```typescript
async handleBatchWrite(input: SheetsValuesInput): Promise<SheetsValuesOutput> {
  const startTime = Date.now();
  const { spreadsheetId, updates, safety } = input;

  try {
    // Quick Win #2: Dry-run mode
    if (safety?.dryRun) {
      const dryRunResult = simulateBatchWrite({
        spreadsheetId,
        updates: updates!,
      });

      const meta = this.generateMeta(
        'batch_write',
        input,
        { dryRunResult },
        {
          cellsAffected: dryRunResult.impact.cellsAffected,
          apiCallsMade: 0,
          duration: 0,
        }
      );

      meta.suggestions?.unshift({
        type: 'warning',
        message: 'DRY RUN: No changes were made',
        reason: 'Set safety.dryRun=false to execute',
        priority: 'high',
      });

      return this.success(
        'batch_write',
        {
          dryRunResult,
          preview: formatDryRunResult(dryRunResult),
        },
        undefined,
        true,
        meta
      );
    }

    // Execute the batch write
    const intents = this.createIntents(input);
    const results = await this.executeIntents(intents, safety);

    const duration = Date.now() - startTime;
    const totalCells = updates!.reduce(
      (sum, u) => sum + u.values.reduce((s, r) => s + r.length, 0),
      0
    );

    // Quick Win #1: Generate intelligent metadata
    const meta = this.generateMeta(
      'batch_write',
      input,
      { rangesUpdated: updates!.length, totalCells },
      {
        cellsAffected: totalCells,
        apiCallsMade: Math.ceil(updates!.length / 100),
        duration,
      }
    );

    return this.success(
      'batch_write',
      {
        rangesUpdated: updates!.length,
        totalCells,
        duration,
      },
      this.createMutationSummary(results),
      false,
      meta
    );

  } catch (err) {
    // Quick Win #3: Enhanced error messages (already in error-factory.ts)
    return this.mapError(err);
  }
}
```

## Benefits for Claude

These quick wins help Claude (the LLM) make better decisions:

1. **Suggestions** - Claude learns optimal patterns (e.g., use batch operations)
2. **Cost Estimates** - Claude can decide whether an operation is worth the cost
3. **Dry-Run** - Claude can preview dangerous operations before executing
4. **Error Recovery** - Claude gets actionable steps to fix problems
5. **Related Tools** - Claude discovers relevant tools for follow-up actions

This makes ServalSheets more intelligent and easier for LLMs to use effectively!
