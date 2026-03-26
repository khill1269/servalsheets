/**
 * ServalSheets - Prompt Registration
 *
 * Guided workflows and templates for common operations.
 *
 * @module mcp/registration/prompt-registration
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_COUNT, ACTION_COUNT } from '../../schemas/action-counts.js';
import {
  FirstOperationPromptArgsSchema,
  TransformDataPromptArgsSchema,
  CreateReportPromptArgsSchema,
  CleanDataPromptArgsSchema,
  SetupBudgetPromptArgsSchema,
  ImportDataPromptArgsSchema,
  SetupCollaborationPromptArgsSchema,
  DiagnoseErrorsPromptArgsSchema,
  SafeOperationPromptArgsSchema,
  UndoChangesPromptArgsSchema,
  MasterClassDataQualityPromptArgsSchema,
  MasterClassFormulasPromptArgsSchema,
  MasterClassPerformancePromptArgsSchema,
  ChallengeQualityDetectivePromptArgsSchema,
  ScenarioMultiUserPromptArgsSchema,
  AutoAnalyzePromptArgsSchema,
  FullSetupPromptArgsSchema,
  AuditSecurityPromptArgsSchema,
  CompareSpreadsheetPromptArgsSchema,
  RecoverFromErrorPromptArgsSchema,
  BulkImportDataPromptArgsSchema,
  PerformanceAuditPromptArgsSchema,
  BatchOptimizerPromptArgsSchema,
  AdvancedDataMigrationPromptArgsSchema,
  CreateVisualizationPromptArgsSchema,
  AnalyzeWithHistoryPromptArgsSchema,
  GenerateSheetPromptArgsSchema,
  CleanDataAutomatedPromptArgsSchema,
  ScenarioModelingPromptArgsSchema,
  SmartSuggestionsPromptArgsSchema,
  CrossSheetFederationPromptArgsSchema,
  AuditSheetPromptArgsSchema,
  PublishReportPromptArgsSchema,
  DataPipelinePromptArgsSchema,
  InstantiateTemplatePromptArgsSchema,
  MigrateSpreadsheetPromptArgsSchema,
  ConnectorSetupPromptArgsSchema,
  ConnectorDataPipelinePromptArgsSchema,
} from '../../schemas/prompts.js';

// ============================================================================
// PROMPTS REGISTRATION
// ============================================================================

/**
 * Registers ServalSheets prompts with the MCP server
 *
 * Prompts provide guided workflows and templates for common operations.
 * Note: prompts/list uses SDK's built-in handler which returns all prompts
 * in a single page. With ~40 prompts, cursor pagination is not needed per
 * MCP 2025-11-25 spec. If prompt count grows significantly, consider
 * implementing a custom ListPromptsRequestSchema handler with cursor support.
 *
 * @param server - McpServer instance
 */
export function registerServalSheetsPrompts(server: McpServer): void {
  // === ONBOARDING PROMPTS ===

  server.registerPrompt(
    'welcome',
    {
      description:
        '🎉 Welcome to ServalSheets! Start with readiness, then connection, then your first real task.',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🎉 Welcome to ServalSheets!

I'm your Google Sheets assistant with ${TOOL_COUNT} tools and ${ACTION_COUNT} actions.

## Default First-Run Funnel
1. Run \`sheets_auth action:"status"\`
2. Read \`readiness\`, \`blockingIssues\`, \`recommendedNextAction\`, and \`recommendedPrompt\`
3. If blocked, use \`sheets_auth action:"login"\` or \`sheets_auth action:"setup_feature"\`
4. Run \`/test_connection\`
5. Move to \`/first_operation\` or \`/full_setup\`

## Test spreadsheet
Test spreadsheet: \`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms\`

## What status should tell you
- Whether Google auth is actually ready
- Whether elicitation/forms are supported
- Whether AI fallback is configured
- Whether connectors and webhooks are already configured
- The single next best action to take

## Canonical setup paths
- \`/test_connection\` → verify the whole stack on a public sheet
- \`/first_operation\` → complete one useful guided task
- \`/full_setup\` → create and wire a new workbook from scratch
- \`sheets_auth action:"setup_feature"\` → configure connectors, AI fallback, webhooks, or federation

Start by running \`sheets_auth action:"status"\`. Do not skip the readiness check.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'test_connection',
    {
      description:
        '🔍 Verify readiness, authentication, and a real public-sheet read before doing custom work',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔍 Testing ServalSheets connection!

Test spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

Run this exact ladder:
1. \`sheets_auth action:"status"\`
   - Read \`readiness\`, \`blockingIssues\`, and \`recommendedNextAction\`
   - If blocked on auth, use \`sheets_auth action:"login"\`
   - If blocked on optional setup, use \`sheets_auth action:"setup_feature"\`
2. \`sheets_core action:"get"\` on the public spreadsheet → verify metadata access
3. \`sheets_data action:"read"\` range \`Sheet1!A1:D10\` → verify values access
4. \`sheets_session action:"set_active"\` with the same spreadsheet → verify context wiring
5. \`sheets_analyze action:"scout"\` → verify analysis entrypoint

If all five steps succeed, move directly to \`/first_operation\`.
If any step fails, report the failing step, the exact error code, and the next recommended recovery action.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'first_operation',
    {
      description: '👶 Complete your first useful task after readiness is verified',
      argsSchema: FirstOperationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `👶 First ServalSheets operation!

Spreadsheet: ${spreadsheetId}

Use this order:
1. \`sheets_auth action:"status"\` if readiness has not already been checked in this conversation
2. \`sheets_session action:"set_active"\` for spreadsheet \`${spreadsheetId}\`
3. \`sheets_core action:"get"\` to understand sheet structure
4. \`sheets_data action:"read"\` on a small representative range
5. \`sheets_analyze action:"scout"\` to pick the right next operation
6. Execute one useful task that matches the user goal:
   - read/reporting request → summarize the current data
   - analysis request → run targeted analysis
   - formatting request → preview first, then apply one safe formatting change

Close with:
- what was verified
- what changed (if anything)
- the single next best action

If the user actually wants a brand-new workbook, switch to \`/full_setup\` instead of improvising.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'transform_data',
    {
      description: 'Transform data in a spreadsheet range with safety checks',
      argsSchema: TransformDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔄 Transform data

Spreadsheet: ${args['spreadsheetId']}
Range: ${args['range']}
Transform: ${args['transformation']}

Workflow:
1. Read current data
2. Plan transformation
3. Confirm with user (sheets_confirm via Elicitation)
4. Execute with safety limits
5. Verify results`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'create_report',
    {
      description: 'Generate a formatted report from spreadsheet data',
      argsSchema: CreateReportPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const reportType = args['reportType'] || 'summary';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📈 Creating ${reportType} report from ${args['spreadsheetId']}

Steps:
1. Read source data
2. Create "Report" sheet
3. Add summary statistics
4. Apply formatting
${reportType === 'charts' ? '5. Add charts (use sheets_analyze to suggest best chart types)\n' : ''}
Final: Auto-resize, freeze header, add timestamp`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'clean_data',
    {
      description: 'Clean and standardize data in a spreadsheet range',
      argsSchema: CleanDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🧹 Cleaning data: ${args['spreadsheetId']}, range ${args['range']}

**CONTEXT GATHERING PHASE** (Ask user before proceeding):
- What type of data is this? (contacts, sales, inventory, etc.)
- What cleaning operations are most important?
  □ Remove duplicates
  □ Fix empty cells (delete, fill, or flag?)
  □ Standardize formats (dates, phone numbers, currencies)
  □ Trim whitespace
  □ Fix capitalization
- Should I preserve the original data? (create backup sheet?)
- Any values that should NOT be modified?

**CLEANING EXECUTION** (After gathering context):
1. Analyze: Run data quality check (sheets_analyze action "analyze_quality")
2. Plan: Identify issues based on user's priorities
3. Preview: Show sample changes before applying
4. Confirm: Request approval via sheets_confirm
5. Execute: Apply changes with auto-snapshot for undo
6. Validate: Report changes made with before/after comparison

**SAFETY NOTE**: All destructive operations require confirmation.
Original data preserved via snapshot for easy rollback.`,
            },
          },
        ],
      };
    }
  );

  // === NEW WORKFLOW PROMPTS ===

  server.registerPrompt(
    'setup_budget',
    {
      description: 'Create a budget tracking spreadsheet with formulas and formatting',
      argsSchema: SetupBudgetPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const budgetType = args['budgetType'] || 'personal';
      const spreadsheetId = args['spreadsheetId'];

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `💰 Setting up ${budgetType} budget tracker
${spreadsheetId ? `Spreadsheet: ${spreadsheetId}` : 'Creating new spreadsheet'}

**CONTEXT GATHERING PHASE** (Ask user before creating):
- What currency should I use? (USD, EUR, GBP, etc.)
- What time period? (monthly, yearly, both?)
- What income categories do you need?
  □ Salary □ Investments □ Side income □ Other (specify)
- What expense categories do you want?
  □ Housing □ Utilities □ Food □ Transport □ Entertainment □ Savings □ Other (specify)
- Do you want to track by date or just totals?
- Should I include goal tracking? (savings targets, debt payoff)
- Do you need multi-person support? (family budget)

**BUDGET SETUP** (After gathering preferences):
1. Create structure:
   - Income sheet: User's categories, amounts, dates
   - Expenses sheet: User's categories, amounts, dates
   - Summary sheet: Totals, remaining, visualizations

2. Add formulas (customized to user's needs):
   - SUMIF for category totals
   - Date filters for selected time period
   - Budget vs actual calculations
   - Goals progress tracking (if requested)

3. Format cells:
   - Currency format (user's selected currency)
   - Conditional formatting: red for overspent, green for under
   - Freeze headers, alternating row colors

4. Add charts:
   - Pie chart: Expense breakdown by category
   - Line chart: Monthly trends over time
   - Progress bar: Goal tracking (if requested)

5. Setup validation:
   - Dropdowns for user's categories
   - Date validation
   - Positive number validation

Final: Professional formatting + instructions sheet with examples.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'import_data',
    {
      description: 'Import external data into Google Sheets with transformation',
      argsSchema: ImportDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📥 Data Import Workflow

Spreadsheet: ${args['spreadsheetId']}
Data source: ${args['dataSource']}
Target: ${args['targetSheet'] || 'new sheet'}

Import Steps:
1. Prepare data:
   - Parse source format (CSV, JSON, API response)
   - Validate structure
   - Clean special characters

2. Create target sheet:
   - sheets_core action "add_sheet"
   - Name appropriately

3. Import data:
   - Use sheets_data action "write" or "append"
   - Handle large datasets (batch if > 10k rows)

4. Post-import:
   - Auto-format headers
   - Freeze top row
   - Auto-resize columns
   - Add data validation

5. Quality check:
   - Run sheets_analyze "analyze_quality"
   - Verify row counts
   - Check for import errors

Pro tip: Use sheets_transaction to batch all operations into 1 API call.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'setup_collaboration',
    {
      description: 'Configure sharing and permissions for team collaboration',
      argsSchema: SetupCollaborationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const role = args['role'] || 'writer';
      const collaboratorsValue = args['collaborators'];
      const collaborators = Array.isArray(collaboratorsValue)
        ? collaboratorsValue.filter((value): value is string => typeof value === 'string')
        : String(collaboratorsValue ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `👥 Setting up collaboration

Spreadsheet: ${args['spreadsheetId']}
Adding ${collaborators.length} collaborator(s) as "${role}"

Collaboration Setup:
1. Share spreadsheet:
   ${collaborators.map((email, i) => `   ${i + 1}. sheets_collaborate action "share_add", email: "${email}", role: "${role}"`).join('\n')}

2. Setup protected ranges:
   - Lock critical formulas/headers
   - sheets_advanced action "add_protected_range"
   - Allow editors to only edit data cells

3. Add version control:
   - Create initial snapshot
   - sheets_collaborate action "version_create_snapshot"

4. Setup comments:
   - Add collaboration guidelines comment
   - sheets_collaborate action "comment_add"

5. Configure notifications:
   - Enable edit notifications
   - Setup comment alerts

Best practices:
- Use "commenter" role for stakeholders
- Use "writer" role for team members
- Reserve "owner" role transfers for handoffs`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'diagnose_errors',
    {
      description: 'Troubleshoot and diagnose spreadsheet issues',
      argsSchema: DiagnoseErrorsPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const errorDesc = args['errorDescription'] || 'general diagnostics';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔧 Diagnosing: ${errorDesc}

Spreadsheet: ${args['spreadsheetId']}

Diagnostic Workflow:
1. Basic checks:
   - sheets_core "get": Verify access
   - Check sheet count, total cells

2. Data quality:
   - sheets_analyze "analyze_quality": Find data issues
   - sheets_analyze "analyze_formulas": Check formula errors

3. AI analysis:
   - sheets_analyze "analyze": Deep pattern analysis
   - Detect anomalies, inconsistencies

4. Performance check:
   - Check formula complexity
   - Identify slow formulas (nested VLOOKUPs)
   - Recommend ARRAYFORMULA or INDEX/MATCH

5. Structure analysis:
   - sheets_analyze "analyze_structure"
   - Check for duplicate headers
   - Verify data types per column

Common Issues:
- #REF! errors: Deleted referenced cells
- #DIV/0!: Division by zero
- #N/A: VLOOKUP not found
- Circular references: Formula refers to itself
- Performance: Too many volatile functions (NOW, RAND)

Report:
- Issue summary
- Affected ranges
- Recommended fixes
- Preventive measures`,
            },
          },
        ],
      };
    }
  );

  // Error Recovery Prompt - AI-powered troubleshooting
  server.registerPrompt(
    'recover_from_error',
    {
      description:
        'Recover from ServalSheets errors - AI-powered troubleshooting and self-healing',
      argsSchema: RecoverFromErrorPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const errorCode = (args['errorCode'] as string) || 'UNKNOWN_ERROR';
      const errorMessage = (args['errorMessage'] as string) || '';
      const toolName = (args['toolName'] as string) || '';
      const context = (args['context'] as string) || '';

      const recoveryGuide: Record<string, string> = {
        INTERNAL_ERROR: `🔴 INTERNAL_ERROR - Likely Fixed in v1.3.0-hotfix.1

This was the "taskStore.isTaskCancelled is not a function" bug.

✅ Fix Applied:
- Task cancellation bug fixed
- Rebuild: npm run build
- Restart Claude Desktop completely (Cmd+Q then relaunch)

Verification:
1. node dist/cli.js --version (should show v1.3.0)
2. Check if error persists after restart
3. Logs: ~/Library/Logs/Claude/mcp*.log

If still occurring after restart:
• Verify dist/server.js contains "this.taskStore.isTaskCancelled"
• Check Claude Desktop config path is correct
• Try: rm -rf dist && npm run build`,

        QUOTA_EXCEEDED: `⚠️ QUOTA_EXCEEDED - Google API Rate Limit

Immediate Actions:
1. Wait 60 seconds before retry
2. Switch to batch operations (saves 80% quota):
   sheets_data action="batch_read" ranges=["A1:B2","D1:E2"]
   Instead of: Multiple individual "read" calls

Prevention:
• Check quota: sheets_auth action="status"
• Use semantic ranges: {"semantic":{"column":"Revenue"}}
• Batch operations: batch_read, batch_write, batch_update

Recovery Time: 60 seconds per 100 requests`,

        RANGE_NOT_FOUND: `❌ RANGE_NOT_FOUND - Sheet or Range Doesn't Exist

Diagnosis:
1. List all sheets: sheets_core action="list_sheets"
2. Check exact spelling (case-sensitive!)
3. Verify format: "SheetName!A1:D10"

Common Fixes:
• "Sheet1" not "sheet1" (case matters!)
• Include sheet name: "Data!A1:D10" not just "A1:D10"
• Check sheet wasn't deleted/renamed

Try semantic ranges: {"semantic":{"sheet":"Sales","column":"Total"}}`,

        PERMISSION_DENIED: `🔒 PERMISSION_DENIED - Authentication or Access Issue

Recovery Steps:
1. Check auth: sheets_auth action="status"
2. Re-authenticate: sheets_auth action="login"
3. Complete OAuth in browser
4. Retry operation

Access Check:
• Verify spreadsheet is shared with your account
• sheets_collaborate action="share_list" to see current access
• Request owner to share if needed

OAuth Scopes Needed:
https://www.googleapis.com/auth/spreadsheets`,

        INVALID_RANGE: `📏 INVALID_RANGE - Range Format Incorrect

Valid Formats:
✅ "A1:D10"
✅ "Sheet1!A1:D10"
✅ "Sheet1!A:A" (entire column)
✅ "Sheet1!1:1" (entire row)

Invalid Formats:
❌ "A1-D10" (use : not -)
❌ "A1..D10"
❌ "SheetName A1:D10" (missing !)

Alternative: Use semantic ranges
{"semantic":{"sheet":"Data","column":"Revenue","includeHeader":false}}`,

        RATE_LIMIT_EXCEEDED: `🚦 RATE_LIMIT_EXCEEDED - Too Many Requests

Built-in Circuit Breaker Active:
• Automatic exponential backoff
• Request spacing (1-2 seconds)
• Auto-retry with delays

Your Action:
• Wait 10 seconds
• Use batch operations next time
• Let circuit breaker handle retries

Prevention: Batch operations reduce rate limit usage by 80%`,

        AUTH_EXPIRED: `🔑 AUTH_EXPIRED - Token Expired

Auto-Recovery (Usually Works):
• Server auto-refreshes tokens
• Just retry your operation
• Token refresh happens automatically

Manual Recovery:
1. sheets_auth action="logout"
2. sheets_auth action="login"
3. Complete OAuth flow
4. Retry operation

Token Details:
• Expire after 1 hour
• Auto-refresh when possible
• Encrypted storage: GOOGLE_TOKEN_STORE_PATH`,

        NOT_FOUND: `🔍 NOT_FOUND - Spreadsheet Doesn't Exist

Verify ID:
• Format: 44 chars, alphanumeric plus - and _
• Get from URL: docs.google.com/spreadsheets/d/{ID}/...
• Check for typos

Find Spreadsheets:
1. List all: sheets_core action="list"
2. Create new: sheets_core action="create" title="My Sheet"

Common Issues:
• Spreadsheet deleted
• Wrong ID copied
• No access permission`,
      };

      const recovery =
        recoveryGuide[errorCode] ||
        `🔧 ${errorCode} Recovery

Tool: ${toolName || 'unknown'}
Message: ${errorMessage || 'No message provided'}
Context: ${context || 'No context provided'}

General Recovery:
1. Check tool description for correct format (see Quick Examples)
2. Verify spreadsheet ID and permissions
3. Check auth: sheets_auth action="status"
4. Review history: sheets_history
5. Try dry-run: {"safety":{"dryRun":true}}

Common Fixes:
• Auth: sheets_auth action="login"
• Quota: Wait 60s, use batch_read/batch_write
• Range: Verify with sheets_core action="get"
• Format: See tool description Quick Examples

Still Stuck?
• Logs: ~/Library/Logs/Claude/mcp*.log
• Version: node dist/cli.js --version
• Restart: Quit Claude Desktop (Cmd+Q), wait 5s, relaunch`;

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: recovery,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'bulk_import_data',
    {
      description: 'Efficiently import large datasets',
      argsSchema: BulkImportDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const dataSize = (args['dataSize'] as number) || 0;
      const dataSource = (args['dataSource'] as string) || 'external source';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📥 Bulk Data Import Workflow for ${spreadsheetId}
Source: ${dataSource}
${dataSize > 0 ? `Estimated Rows: ${dataSize}` : ''}

Optimal Import Strategy:

${
  dataSize > 10000
    ? `⚠️ LARGE DATASET (${dataSize} rows)
Use chunked imports with transactions`
    : ''
}

Step 1: Prepare Target Sheet
1. Create or clear target sheet:
   sheets_core action="add_sheet" title="Import_${new Date().toISOString().split('T')[0]}"

2. Setup structure:
   • Headers: sheets_data action="write" range="A1:Z1" values=[["Col1","Col2",...]]
   • Format headers: sheets_format range="A1:Z1" bold=true backgroundColor="#4285F4"
   • Freeze: sheets_dimensions action="freeze" count=1

Step 2: Validate Source Data
1. Check data quality before import
2. Remove: Empty rows, invalid characters, duplicates
3. Standardize: Date formats, number formats, text encoding

Step 3: Import Data (Choose Strategy)

**Strategy A: Small Dataset (<1000 rows)**
• Single batch write:
  sheets_data action="batch_write" ranges=["A2:Z1001"] values=[...]

**Strategy B: Medium Dataset (1K-10K rows)**
• Transaction with chunks:
  sheets_transaction action="begin"
  For each chunk of 1000 rows:
    sheets_transaction action="queue" operation=write
  sheets_transaction action="commit"

**Strategy C: Large Dataset (>10K rows)**
• Multiple transactions:
  For every 5000 rows:
    Begin transaction → Write 5 chunks of 1000 → Commit
    Wait 2 seconds between transactions

Step 4: Post-Import Processing

1. Auto-resize columns:
   sheets_dimensions action="auto_resize" dimension="COLUMNS"

2. Apply formatting:
   • Currency columns: sheets_format format="$#,##0.00"
   • Date columns: sheets_format format="yyyy-mm-dd"
   • Conditional formatting: sheets_format for visual cues

3. Add validation rules:
   • Dropdowns: sheets_format action="set_data_validation" type="LIST"
   • Range validation: For numeric columns

4. Create summary:
   • Row count, column count
   • Add to first sheet or separate "Summary" sheet

Step 5: Verification

1. Data quality check:
   sheets_analyze action="analyze_data" range="A1:Z${dataSize || 10000}"

2. Spot check:
   • First 10 rows: sheets_data range="A2:Z11"
   • Last 10 rows: Check end of data
   • Random sample: Middle rows

3. Create checkpoint:
   sheets_collaborate action="version_create_snapshot" description="After ${dataSource} import"

Performance Tips:

• Batch size: 1000 rows optimal for balance of speed/reliability
• Use batch_write not individual writes (80% faster)
• Wait 2s between large transactions (avoid rate limits)
• Format after data import (faster than formatting during)
• Create indexes with named ranges for quick access

Error Recovery:

• If import fails mid-way:
  1. sheets_history action="list" - Find last successful operation
  2. sheets_transaction action="rollback" - Undo partial import
  3. Resume from last checkpoint

• If data quality issues found:
  Use fix_data_quality prompt for cleanup

Import complete! ✅`,
            },
          },
        ],
      };
    }
  );

  // ===Safety Workflow Prompts ===

  server.registerPrompt(
    'safe_operation',
    {
      description:
        'Execute destructive operations safely with dry-run → confirm → execute workflow',
      argsSchema: SafeOperationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const operationType = args['operationType'] as string;
      const affectedRange = (args['affectedRange'] as string) || 'auto-detect';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🛡️ Safe ${operationType} Workflow
Spreadsheet: ${args['spreadsheetId']}
${affectedRange !== 'auto-detect' ? `Range: ${affectedRange}` : ''}

⚠️ CRITICAL: ${operationType} operations are PERMANENT. Follow this workflow:

Phase 1: DRY-RUN (Preview)
┌────────────────────────────────────┐
│ 1. Preview what will happen:      │
│    {"safety":{"dryRun":true}}     │
│                                    │
│ 2. Review the preview output      │
│ 3. Verify affected ranges         │
│ 4. Check estimated impact         │
└────────────────────────────────────┘

Phase 2: IMPACT ANALYSIS
┌────────────────────────────────────┐
│ 1. Check dependencies:            │
│    sheets_quality action="analyze_impact" │
│                                    │
│ 2. Find affected formulas         │
│ 3. List dependent charts          │
│ 4. Identify broken references     │
└────────────────────────────────────┘

Phase 3: USER CONFIRMATION ${affectedRange.includes(':') && affectedRange.split(':').length > 1 ? '(REQUIRED)' : ''}
┌────────────────────────────────────┐
│ MUST use sheets_confirm for:      │
│ • ${operationType === 'delete' ? 'Deleting >10 rows/columns' : ''}${operationType === 'bulk_update' ? 'Updating >100 cells' : ''}${operationType === 'format' ? 'Formatting >100 cells' : ''}${operationType === 'formula' ? 'Changing complex formulas' : ''}  │
│                                    │
│ Build confirmation plan:          │
│ {                                 │
│   "action": "request",            │
│   "plan": {                       │
│     "title": "${operationType} operation",│
│     "steps": [                    │
│       {                          │
│         "description": "...",    │
│         "risk": "high",          │
│         "isDestructive": true,   │
│         "canUndo": true          │
│       }                          │
│     ]                            │
│   }                              │
│ }                                │
└────────────────────────────────────┘

Phase 4: SNAPSHOT (Undo Capability)
┌────────────────────────────────────┐
│ Create restore point:             │
│ {"safety":{"createSnapshot":true}}│
│                                    │
│ OR use sheets_collaborate:           │
│ sheets_collaborate action="version_create_snapshot"│
│ description="Before ${operationType}" │
└────────────────────────────────────┘

Phase 5: EXECUTE SAFELY
┌────────────────────────────────────┐
│ 1. Remove dryRun flag             │
│ 2. Keep createSnapshot:true       │
│ 3. Execute operation              │
│ 4. Verify results immediately     │
└────────────────────────────────────┘

Phase 6: VERIFY
┌────────────────────────────────────┐
│ 1. Run sheets_analyze to verify  │
│ 2. Spot-check affected ranges     │
│ 3. Test dependent formulas        │
│ 4. Confirm no broken references   │
└────────────────────────────────────┘

UNDO if needed:
• sheets_history action="undo"
• sheets_collaborate action="version_restore_revision" revisionId="..."
• sheets_transaction action="rollback" (if in transaction)

Remember: DRY-RUN → IMPACT → CONFIRM → SNAPSHOT → EXECUTE → VERIFY`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'undo_changes',
    {
      description: 'Undo recent changes using version history or operation history',
      argsSchema: UndoChangesPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const changeDesc = (args['changeDescription'] as string) || 'recent changes';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `⏪ Undo: ${changeDesc}
Spreadsheet: ${args['spreadsheetId']}

🔍 Step 1: Identify What to Undo

Option A: Recent Operations (Last 100 ops)
┌────────────────────────────────────┐
│ sheets_history action="list"      │
│ spreadsheetId="${args['spreadsheetId']}"   │
│ limit=20                          │
└────────────────────────────────────┘
→ Shows recent operations with IDs

Option B: Version History (Google's snapshots)
┌────────────────────────────────────┐
│ sheets_collaborate action="version_list_revisions"│
│ spreadsheetId="${args['spreadsheetId']}"   │
│ limit=10                          │
└────────────────────────────────────┘
→ Shows saved snapshots

⏪ Step 2: Choose Undo Method

Method 1: HISTORY ROLLBACK (Precise)
┌────────────────────────────────────┐
│ Best for: Specific operation undo  │
│                                    │
│ sheets_history action="undo"      │
│ spreadsheetId="${args['spreadsheetId']}"   │
│ operationId="op_12345"            │
│                                    │
│ OR revert to specific point:      │
│ sheets_history action="revert_to" │
│ operationId="op_12345"            │
│ (undoes everything after this)    │
└────────────────────────────────────┘

Method 2: VERSION RESTORE (Full restore)
┌────────────────────────────────────┐
│ Best for: Major undo, "go back"   │
│                                    │
│ sheets_collaborate action="version_restore_revision"  │
│ spreadsheetId="${args['spreadsheetId']}"   │
│ revisionId="rev_abc123"           │
│                                    │
│ Restores ENTIRE spreadsheet to    │
│ that point in time                │
└────────────────────────────────────┘

Method 3: TRANSACTION ROLLBACK (In-progress)
┌────────────────────────────────────┐
│ Best for: Active transaction       │
│                                    │
│ sheets_transaction action="rollback"│
│ transactionId="tx_123"            │
│                                    │
│ Undoes uncommitted operations     │
│ (only works before commit)        │
└────────────────────────────────────┘

🔍 Decision Tree:

Q: Is the change from the last few operations?
  ✅ Use sheets_history action="undo"

Q: Do you need to go back >100 operations?
  ✅ Use sheets_collaborate action="version_restore_revision"

Q: Is a transaction still in progress?
  ✅ Use sheets_transaction action="rollback"

Q: Want to undo specific cells only?
  ✅ Manually write old values back:
     1. Get old values from history/version
     2. sheets_data action="write" with old values

📋 Verification After Undo:

1. Check the change was undone:
   sheets_core action="get"
   sheets_data action="read" range="affected_range"

2. Verify no broken references:
   sheets_analyze action="analyze_formulas"

3. Check data quality:
   sheets_analyze action="analyze_quality"

⚠️ Important Notes:

• History: Keeps last 100 operations (~24 hours typical)
• Versions: Google saves automatically (~every 30 min when editing)
• Manual snapshots: Created with createSnapshot:true in safety params
• Transaction rollback: Only before commit

🛡️ Prevent Need for Undo:

ALWAYS use safety workflow for destructive ops:
1. {"safety":{"dryRun":true}} → Preview
2. sheets_confirm → User approval
3. {"safety":{"createSnapshot":true}} → Backup
4. Execute → With safety guards
5. Verify → Check results

Then you'll always have an easy undo path!`,
            },
          },
        ],
      };
    }
  );

  // === ADVANCED WORKFLOW PROMPTS ===

  server.registerPrompt(
    'advanced_data_migration',
    {
      description:
        'Advanced multi-sheet, multi-spreadsheet data migration with transformation and validation',
      argsSchema: AdvancedDataMigrationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const migrationType = (args['migrationType'] as string) || 'full';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Advanced Data Migration

Source: ${args['sourceSpreadsheetId']}
Target: ${args['targetSpreadsheetId']}
Type: ${migrationType}

## Phase 1: Discovery
1. List source sheets: sheets_core action="list_sheets"
2. Analyze structure: sheets_analyze action="analyze_structure"
3. Analyze target: sheets_core action="get" spreadsheetId=target
4. Build mapping: source sheets → target sheets, columns, data types

## Phase 2: Validation
1. Verify target capacity (row/column limits)
2. Check naming conflicts
3. Analyze dependencies: sheets_quality action="analyze_impact"
4. Snapshot target before migration

## Phase 3: Migrate

**Full Strategy:** For each sheet:
- Create/clear target sheet
- Begin transaction
- Write headers + data in 1000-row chunks
- Copy formatting & validation rules
- Update formula references
- Commit transaction

**Incremental Strategy:** Only sync changes:
- NEW rows: sheets_data action="append"
- MODIFIED rows: sheets_composite action="bulk_update" keyColumn="ID"
- DELETED rows: sheets_dimensions action="delete"

**Selective Strategy:** Migrate by criteria:
- Define selection (ranges, filters, date ranges, quality)
- Extract, transform, validate, write

## Phase 4: Post-Migration Validation
- Row counts match (source vs target)
- No data loss (spot check)
- Formulas working (no #REF! errors)
- Data types preserved
- Quality analysis: sheets_analyze action="analyze_quality"

## Phase 5: Report
- Create "Migration_Verification" sheet with: sheet comparison, row deltas, quality scores, issues
- Final snapshot for rollback
- Document any issues found

Success: All sheets migrated without loss, references updated, quality maintained, rollback ready.

Pro tips: Use transactions (atomic), migrate during low-usage hours, test on copy first, keep source until verified, batch operations 80% faster.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'performance_audit',
    {
      description:
        'Comprehensive spreadsheet performance audit with optimization recommendations',
      argsSchema: PerformanceAuditPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const focusAreas = (args['focusAreas'] as string[]) || ['all'];

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Performance Audit for ${args['spreadsheetId']}
Focus: ${focusAreas.join(', ')}

## Phase 1: Baseline Assessment
1. Structure: sheets_core action="get" - total sheets/cells, >10K rows, >26 columns
2. Formulas: sheets_analyze action="analyze_formulas" - volatile, circular refs, nested IFs, external refs
3. Quality: sheets_analyze action="analyze_quality" - empty cells, duplicates, mixed types, large text

## Phase 2: Bottleneck Detection
**Critical (Fix Now):**
- Volatile functions in large ranges (NOW() in 10K cells = 10K recalcs)
- Circular references (infinite loops)
- Array formulas on full columns (evaluates 1M rows)
- Sheets >100K cells (split needed)

**High Priority:**
- VLOOKUP on large datasets (convert to INDEX/MATCH: 60% faster)
- Nested IF >3 levels (use IFS: 30% faster)
- INDIRECT overuse (replace with direct refs or named ranges)
- Empty row cleanup

## Phase 3: API Optimization
- Batching: Use batch_read instead of individual reads (66% savings)
- Transactions: Wrap bulk operations (80-95% savings)
- Caching: Metadata auto-cached, use batch_get for multi-sheets

## Phase 4: Structure Optimization
Run sheets_analyze action="analyze_structure"
- Duplicate headers → Rename uniquely
- Mixed data types → Standardize
- Unnecessary sheets → Archive/delete
- Wide layouts (50+ cols) → Use pivots

## Phase 5: Generate Report
Create "Performance_Audit_Report" sheet with:
1. Executive Summary: Score, critical issues, est. improvements
2. Formula Analysis: Total formulas, volatile count, VLOOKUP count
3. Structure Issues: Sheets to split, empty rows, duplicate columns
4. API Efficiency: Current vs potential
5. Action Plan: Priority 1 (critical), Priority 2 (high), Priority 3 (medium)

Quick Wins: Enable batching (20-40%), fix volatile (80% reduction), delete empty rows, wrap bulk ops (80-95%).`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'batch_optimizer',
    {
      description: 'Convert inefficient individual operations to optimized batch operations',
      argsSchema: BatchOptimizerPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const operationType = args['operationType'] as string;
      const operationCount = (args['operationCount'] as number) || 10;

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Batch Operation Optimizer

Spreadsheet: ${args['spreadsheetId']} | Type: ${operationType} | Current: ${operationCount} ops

## Current Approach (INEFFICIENT): ${operationCount} individual operations
## Optimized Approach: Batch + Transaction (${Math.floor(((operationCount - (operationType === 'write' || operationType === 'mixed' ? 3 : 1)) / operationCount) * 100)}% fewer API calls)

${
  operationType === 'read'
    ? `Use batch_read: sheets_data action="batch_read" ranges=[...all ${operationCount} ranges...]
Result: 1 API call instead of ${operationCount} (${(((operationCount - 1) / operationCount) * 100).toFixed(0)}% savings)`
    : operationType === 'write'
      ? `Use transaction:
1. sheets_transaction action="begin"
2. Queue all ${operationCount} writes
3. sheets_transaction action="commit"
Result: 1 effective API call (${Math.floor(((operationCount - 3) / operationCount) * 100)}% savings) + atomicity`
      : operationType === 'update'
        ? `Use sheets_composite action="bulk_update" with key column
Result: ${operationCount} updates → 1 API call`
        : operationType === 'format'
          ? `Use transaction for all ${operationCount} format operations
Result: 1 API call (80-95% faster)`
          : `Use transaction manager for mixed ops
Result: ${operationCount} ops → 1 effective API call + atomicity`
}

## Implementation

1. Collect operations
2. Begin transaction (if write/format/mixed)
3. Queue each operation or use batch variant
4. Commit and verify

## Best Practices
- Batch 10-100 operations per call
- Transactions auto-rollback on failure
- Test small batches before scaling
- Monitor quota usage for large migrations

Performance target: <1s for ${operationCount} operations. Ready to optimize!`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'create_visualization',
    {
      description: 'Create charts/pivots with AI recommendations and user confirmation',
      argsSchema: CreateVisualizationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📊 Create Visualization with AI

Spreadsheet: ${args['spreadsheetId']}

## 🎨 WORKFLOW (3 Steps)

**Step 1: Get Recommendations**
\`\`\`json
{
  "tool": "sheets_analyze",
  "action": "suggest_visualization",
  "spreadsheetId": "${args['spreadsheetId']}",
  "range": { "a1": "Sheet1!A1:D100" }
}
\`\`\`

AI will analyze your data and suggest:
• Best chart types (LINE, BAR, PIE, SCATTER, etc.)
• Optimal data ranges
• Axis configurations
• Pivot table dimensions

**Step 2: User Confirmation (Automatic)**

When you create a chart/pivot, MCP Elicitation will prompt:
\`\`\`
⚠️ Create Chart

You are about to create a LINE chart in spreadsheet ${args['spreadsheetId']}.

The chart will use data from range A1:D100.

This will modify the spreadsheet by adding a new chart object.

[ Confirm ] [ Cancel ]
\`\`\`

**Step 3: Create**
\`\`\`json
{
  "tool": "sheets_visualize",
  "action": "suggest_chart",
  "spreadsheetId": "${args['spreadsheetId']}",
  "range": "Sheet1!A1:D100"
}
\`\`\`

## 📈 CHART TYPES AVAILABLE

• LINE: Time series, trends
• BAR: Comparisons, rankings
• COLUMN: Category comparisons
• PIE: Part-to-whole relationships
• SCATTER: Correlation analysis
• AREA: Volume over time
• COMBO: Multiple metrics
• STEPPED_AREA: Staged progress

## 🔄 PIVOT TABLES

For pivot tables:
\`\`\`json
{
  "tool": "sheets_visualize",
  "action": "suggest_pivot",
  "spreadsheetId": "${args['spreadsheetId']}",
  "range": "Data!A1:F1000"
}
\`\`\`

Creates a new sheet with pivot table automatically!

## 🛡️ SAFETY FEATURES

• User confirmation via MCP Elicitation (SEP-1036)
• Rollback support if creation fails
• Validation before modification
• Clear error messages

Ready to visualize your data! 🎨`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'analyze_with_history',
    {
      description: 'Reference previous analysis results via MCP Resources',
      argsSchema: AnalyzeWithHistoryPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔗 Analysis History via MCP Resources

Spreadsheet: ${args['spreadsheetId']}

## 📚 STORED ANALYSIS RESULTS

Every successful \`analyze_data\` is automatically stored as an MCP Resource:
\`analyze://results/{id}\`

## 🔍 AVAILABLE RESOURCES

**List all recent analyses:**
\`\`\`
Resource: analyze://results
\`\`\`

Returns:
\`\`\`json
{
  "count": 5,
  "results": [
    {
      "id": "analysis-1",
      "spreadsheetId": "${args['spreadsheetId']}",
      "timestamp": "2026-01-12T10:30:00Z",
      "summary": "Fast statistical analysis complete...",
      "uri": "analyze://results/analysis-1"
    }
  ]
}
\`\`\`

**Get specific analysis:**
\`\`\`
Resource: analyze://results/analysis-1
\`\`\`

Returns full analysis result with all findings.

## 💬 CONVERSATIONAL WORKFLOWS

**Pattern 1: Compare with Previous**
\`\`\`
User: "Analyze Sheet1"
Assistant: [Runs analyze_data, stores as analysis-1]
          "...completed (stored as analyze://results/analysis-1)"

User: "How does this compare to last week?"
Assistant: [Reads analyze://results/analysis-1]
           "Last week's quality score was 85, now it's 92..."
\`\`\`

**Pattern 2: Explain Previous Analysis**
\`\`\`json
{
  "tool": "sheets_analyze",
  "action": "explain_analysis",
  "analysisResult": { /* from analyze://results/analysis-1 */ },
  "question": "Why did quality improve?"
}
\`\`\`

**Pattern 3: Track Quality Over Time**
\`\`\`
1. List: analyze://results
2. Filter: analyses for same spreadsheet
3. Compare: quality scores over time
4. Report: "Quality improving by 5% per week"
\`\`\`

## 📊 OTHER ANALYSIS RESOURCES

• \`analyze://stats\` - Service statistics (success rate, avg time)
• \`analyze://help\` - Full analysis documentation

## 🎯 BENEFITS

✅ No need to re-run analyses
✅ Reference previous results in follow-up questions
✅ Track data quality over time
✅ Compare before/after cleanup
✅ MCP-native (standard resource protocol)

## 💾 STORAGE

• Last 100 analyses kept in memory
• Automatic cleanup of old results
• No manual storage required
• Access via standard MCP resource URIs

Ready to leverage analysis history! 🔗`,
            },
          },
        ],
      };
    }
  );

  // === INTERACTIVE LEARNING PROMPTS (Phase 4: Optional Enhancements) ===

  server.registerPrompt(
    'masterclass_data_quality',
    {
      description: 'Interactive data quality analysis tutorial',
      argsSchema: MasterClassDataQualityPromptArgsSchema,
    },
    async ({ spreadsheetId, level }) => {
      const selectedLevel = level || 'beginner';
      const spreadsheetContext = spreadsheetId
        ? `\n\nPractice spreadsheet: ${spreadsheetId}`
        : '\n\nCreate a test spreadsheet to practice';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Data Quality Master Class - ${selectedLevel.toUpperCase()} Level${spreadsheetContext}

${
  selectedLevel === 'beginner'
    ? `Beginner: Data quality (completeness, consistency, accuracy, validity) scored 90-100% (excellent), 70-89% (good), 50-69% (fair), <50% (poor).
Step 1: sheets_analyze action:"scout" (fast ~200ms) - score + top 3 issues.
Step 2: If <80%, sheets_analyze action:"comprehensive" (detailed) - breakdown + examples + fixes.`
    : selectedLevel === 'intermediate'
      ? `Intermediate: Identify patterns:
- Mixed types: [123, "456"] breaks SUM/charts. Fix: standardize_formats.
- Inconsistent formats: ["01/15/2024", "2024-01-16", "Jan 17"] breaks sort. Fix: standardize_formats.
- Formula errors: #REF!, #DIV/0!, #N/A need fixing.
Task: comprehensive analysis -> identify TOP issue by impact -> preview fixes -> execute -> re-analyze.`
      : `Advanced: Build quality gates:
1. Pre-write validation: sheets_quality validate before write, alert if drop >15%.
2. Periodic scout: Every 10 ops run scout, alert if <threshold.
3. Historical tracking: Track quality trends, alert on 3 consecutive drops.
Workflow: baseline -> monitor -> alert -> fix (preview first) -> verify -> learn patterns.`
}

Pro tips: Fix high-impact issues first, always preview before applying, re-analyze after fixes, prioritize by impact score. Try challenge_quality_detective for practice!`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'masterclass_formulas',
    {
      description: 'Formula optimization workshop',
      argsSchema: MasterClassFormulasPromptArgsSchema,
    },
    async ({ topic }) => {
      const selectedTopic = topic || 'performance';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Formula Optimization: ${selectedTopic.replace(/_/g, ' ').toUpperCase()}

${
  selectedTopic === 'performance'
    ? `Performance: static (instant) < arithmetic < SUM/AVG < VLOOKUP < arrays < volatiles < external data
Slow (500ms): ARRAYFORMULA(IF(A2:A1000, VLOOKUP...)) evaluates row-by-row
Fast (50ms): QUERY(Sheet2, "SELECT B WHERE...") - optimized by Google
Task: Find >100ms formulas, rewrite with QUERY or INDEX/MATCH, benchmark.`
    : selectedTopic === 'array_formulas'
      ? `Use when: data changes frequently, multiple conditions, dynamic expansion, <10K rows
Avoid: >50K rows (use helpers), volatile inside, complex nesting
Slow: IF nested deeply. Fast: IFS (30% faster)
Slow: IFERROR(VLOOKUP...). Fast: IFNA(VLOOKUP...) (faster for lookups)`
      : selectedTopic === 'volatile_functions'
        ? `Problem: NOW/TODAY/RAND/INDIRECT recalc EVERY edit, slowing entire sheet
Solution 1 - Centralize: A1=NOW(), A2=A1, A3=A1 (1 recalc not 3)
Solution 2 - Named range: Create "CurrentDate" -> A1, use =CurrentDate elsewhere
Solution 3 - Apps Script: Periodic refresh via ScriptApp triggers
Task: Audit (sheets_analyze checkVolatility), consolidate if >10`
      : selectedTopic === 'lookup_optimization'
        ? `VLOOKUP (200ms, <1K rows) vs INDEX/MATCH (50ms, >10K rows) vs QUERY (30ms, optimized)
Perf: VLOOKUP slow on large data. INDEX/MATCH 4x faster. QUERY 6x faster.
Examples: =VLOOKUP vs =INDEX(B:B,MATCH(A2,A:A,0)) vs =QUERY(A:B,"SELECT B WHERE...")
Task: Find VLOOKUPs (sheets_analyze), convert top 5 to INDEX/MATCH, benchmark.`
        : `Common errors: #REF! (broken ref), #DIV/0! (divide by zero), #N/A (lookup miss), #VALUE! (type), #NAME? (unknown func)
Strategies: IFERROR (catches all), IFNA (lookup-specific, faster), IF+ISERROR (conditional), Defensive (IF B2=0, 0, A2/B2)
Best practice: Always use error handling in production
Task: Audit formulas (sheets_analyze), add error handling, test edge cases.`
}

Pro tips: Use sheets_dependencies before changes, test small data first, document complexity, snapshot changes.`
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'masterclass_performance',
    {
      description: 'Performance tuning lab',
      argsSchema: MasterClassPerformancePromptArgsSchema,
    },
    async ({ spreadsheetId, focusArea }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Performance Tuning Lab - ${spreadsheetId}

## Baseline: sheets_analyze action:"analyze_performance" checkFormulas:true checkVolatility:true

${
  focusArea === 'read_ops'
    ? `## Read Ops Focus
Slow reads? Check: range size (>1K rows use batch_read), value rendering (UNFORMATTED_VALUE is 3x faster), multiple sheets (use batch_get), column selection (A:A faster than full rows).
Before: 5 individual reads ~2.5s. After: 1 batch_read ~300ms.
Task: Convert slow reads to batch_read and benchmark.`
    : focusArea === 'write_ops'
      ? `## Write Ops Focus
<100 cells: direct write. 100-1K cells: batch_write (70% faster). >1K cells: transaction (80% quota savings, atomic).
Before: 500 individual writes = 500 API calls. After: 1 transaction = 3 calls.
Task: Switch to transactions for bulk writes and measure quota savings.`
      : focusArea === 'formulas'
        ? `## Formula Performance Focus
Symptoms: freezes, lag on edit, "Calculating..." appears.
Checks: volatile functions (NOW, TODAY, RAND - if >10 consolidate), array formulas on 10K+ rows (replace with QUERY), circular refs (detect_cycles), external data (cache + periodic refresh), deep nesting (use helpers).
Command: sheets_analyze action:"analyze_performance" returns volatileFunctionCount, complexity.
Task: Fix top 3 recommendations and re-analyze.`
        : focusArea === 'concurrent_users'
          ? `## Concurrent Users Focus
Symptoms: lag with multiple editors, recalc delays, save conflicts.
Checks: >10 simultaneous users (expect lag), >50 protected ranges (reduce granularity), IMPORTRANGE/GOOGLEFINANCE (replace with periodic refreshes via ScriptApp), >100K cells conditional formatting (simplify).
Mitigation: Use periodic refresh instead of real-time formulas (every 5 minutes vs every edit).
Task: Identify usage patterns and implement periodic refresh.`
          : `## Focus Areas
- read_ops: Batch reading optimization
- write_ops: Transaction-wrapped writes (80% savings)
- formulas: Volatile functions, circular refs, array formulas
- concurrent_users: Protection scope, periodic refreshes`
}

## After Optimization
Re-run: sheets_analyze action:"analyze_performance" checkFormulas:true checkVolatility:true

Target metrics:
- Reads <500ms
- Writes <2s for <1K cells
- Formula recalc <1s
- Volatile functions <5 per sheet`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'challenge_quality_detective',
    {
      description: 'Diagnose data quality issues from symptoms',
      argsSchema: ChallengeQualityDetectivePromptArgsSchema,
    },
    async ({ spreadsheetId }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `# 🔍 Quality Detective Challenge

**Case File:** ${spreadsheetId}

## Your Mission

You've been called in to diagnose a spreadsheet with quality issues. Users are reporting problems, but don't know the root causes.

## Investigation Process

**Step 1: Gather Evidence**
\`\`\`
sheets_analyze action:"scout"
  spreadsheetId:"${spreadsheetId}"
\`\`\`

Quick overview (~200ms):
- Overall quality score
- Top 3 issues by impact
- Recommended next steps

**Step 2: Deep Dive**
If quality <80%, run comprehensive analysis:
\`\`\`
sheets_analyze action:"comprehensive"
  spreadsheetId:"${spreadsheetId}"
\`\`\`

Detailed breakdown:
- All 15 quality dimensions
- Cell-level examples
- Root cause identification

**Step 3: Diagnose Root Causes**

Common quality patterns:
- **Mixed data types**: Numbers stored as text
- **Inconsistent formats**: Multiple date formats
- **Formula errors**: #REF!, #DIV/0!, #N/A
- **Duplicate rows**: Exact or fuzzy duplicates
- **Outliers**: Values outside normal range
- **Missing values**: Empty cells in critical columns

**Step 4: Prioritize Fixes**

Use impact score to prioritize:
\`\`\`
sheets_quality action:"analyze_impact"
  spreadsheetId:"${spreadsheetId}"
\`\`\`

Returns:
- Estimated fix time
- Quality improvement projection
- Dependency analysis

**Step 5: Preview Solutions**
\`\`\`
sheets_fix action:"clean"
  spreadsheetId:"${spreadsheetId}"
  mode:"preview"
\`\`\`

See exact changes before applying

**Step 6: Execute Fixes**
\`\`\`
sheets_fix action:"clean"
  spreadsheetId:"${spreadsheetId}"
  mode:"apply"
\`\`\`

Apply all high-impact fixes

**Step 7: Verify Improvement**
\`\`\`
sheets_analyze action:"scout"
  spreadsheetId:"${spreadsheetId}"
\`\`\`

Confirm quality score improved

## Scoring Rubric

- **30 points**: Correct root cause diagnosis
- **30 points**: Optimal tool selection for fixes
- **30 points**: Complete resolution (quality >80%)
- **10 points**: Efficient approach (<5 operations)

## 🎯 Detective Tips

1. Start with scout for quick triage
2. Use comprehensive only if needed (slower)
3. Check analyze_impact before fixing (prioritize high-impact)
4. Always preview fixes first (avoid surprises)
5. Re-analyze after fixes (verify improvement)

## 🚨 Common Mistakes

- ❌ Fixing low-impact issues first
- ❌ Skipping preview mode
- ❌ Not re-analyzing after fixes
- ❌ Treating all issues equally

## Ready to Investigate?

Run your first command and tell me what you find. I'll guide you through the diagnosis process and reveal the actual issues after you've made your assessment.

Good luck, detective! 🕵️`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'scenario_multi_user',
    {
      description: 'Resolve concurrent editing conflicts',
      argsSchema: ScenarioMultiUserPromptArgsSchema,
    },
    async ({ spreadsheetId, scenario }) => {
      const selectedScenario = scenario || 'conflict_resolution';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `# 👥 Multi-User Collaboration Scenario

**Spreadsheet:** ${spreadsheetId}
**Scenario:** ${selectedScenario.replace(/_/g, ' ').toUpperCase()}

${
  selectedScenario === 'conflict_resolution'
    ? `
## Situation

You manage a sales tracking spreadsheet used by 12 team members simultaneously. Recent issues:

1. Sales reps accidentally overwriting each other's data
2. Manager-only summary formulas being deleted
3. No way to see who changed what
4. Can't revert incorrect changes

## Stakeholders

**Sales Reps (10 users)**
- Need: Add their own sales data
- Problem: Can't tell if they're overwriting someone else's entry
- Frustration: "I spent 30 minutes entering data and someone deleted it"

**Sales Manager (1 user)**
- Need: Protected summary section with formulas
- Problem: Reps accidentally edit summary formulas
- Frustration: "I have to fix broken formulas every day"

**Admin (1 user)**
- Need: Full control + audit trail
- Problem: No visibility into who changed what
- Frustration: "I can't find who deleted important data"

## Your Task

Design a solution that:
1. Prevents accidental overwrites
2. Protects manager formulas
3. Maintains audit trail
4. Allows easy rollback

## Available Tools

**Option 1: Protected Ranges**
\`\`\`
sheets_advanced action:"add_protected_range"
  spreadsheetId:"${spreadsheetId}"
  range:"Summary!A1:Z100"
  editors:["manager@company.com"]
\`\`\`

**Option 2: Version Snapshots**
\`\`\`
sheets_collaborate action:"version_create_snapshot"
  spreadsheetId:"${spreadsheetId}"
  description:"Before daily edit session"
\`\`\`

**Option 3: Change Notifications**
\`\`\`
sheets_webhook action:"register"
  spreadsheetId:"${spreadsheetId}"
  events:["SHEET_MODIFIED"]
  handler:"notify_admin"
\`\`\`

**Option 4: Confirmation Workflows**
\`\`\`
sheets_confirm action:"request"
  operation:"delete" dimension:"ROWS"
  minimumRows:5
\`\`\`

## Solution Requirements

**Must have:**
- Row-level protection (each rep owns their rows)
- Summary section fully protected
- Automatic daily snapshots
- Change notification to admin

**Nice to have:**
- Visual indicators of protected cells
- Undo history (last 10 changes)
- Conflict detection warnings

## Your Deliverable

1. **Architecture Diagram** (text format showing layers)
2. **Implementation Plan** (step-by-step with tool calls)
3. **Trade-offs** (pros/cons of your approach)
4. **Rollback Strategy** (how to revert if issues arise)

## Example Architecture

\`\`\`
Layer 1: Base Protection
├─ Protect Summary!A1:Z100 (Manager only)
├─ Protect Headers Row 1 (Admin only)
└─ Sales Data Rows 2-1000 (Any authenticated user)

Layer 2: Row Ownership
├─ Each rep assigned specific rows
├─ Can edit only their rows
└─ Read-only access to others' rows

Layer 3: Audit & Rollback
├─ Daily snapshots (keep 30 days)
├─ Webhook notifications on delete >5 rows
└─ Version history tracking

Layer 4: User Experience
├─ Color-code rows by owner
├─ Add "Owner" column
└─ Confirmation on bulk delete
\`\`\`

Start designing your solution!
`
    : ''
}${
                selectedScenario === 'protection_strategy'
                  ? `
## Situation

A financial planning spreadsheet contains:
- Public sections (everyone can edit)
- Team sections (specific teams only)
- Executive sections (C-suite only)
- Formula sections (read-only for all)

Currently: No protection, frequent accidental edits, formulas broken weekly.

## Requirements

**Public Sections:**
- Input forms (rows 5-100)
- Anyone can add data
- Cannot delete others' data

**Team Sections:**
- Marketing data (rows 200-300, marketing team only)
- Sales data (rows 400-500, sales team only)
- Engineering data (rows 600-700, engineering team only)

**Executive Sections:**
- Budget summary (rows 900-950, C-suite only)
- Financial projections (rows 1000-1050, CFO only)

**Formula Sections:**
- Summary calculations (columns Z-AE, read-only)
- Validation formulas (column AZ, read-only)

## Your Task

Design granular protection strategy:
1. Map all protection zones
2. Assign editor groups
3. Implement protection rules
4. Test access levels

## Implementation Pattern

\`\`\`
# Step 1: Public Input Protection
sheets_advanced action:"add_protected_range"
  range:"A5:Y100"
  warningOnly:true
  description:"Public input area"

# Step 2: Team-Specific Protection
sheets_advanced action:"add_protected_range"
  range:"A200:Y300"
  editors:["marketing@company.com", "marketing-team@company.com"]
  description:"Marketing team data"

# Step 3: Executive Protection
sheets_advanced action:"add_protected_range"
  range:"A900:Y950"
  editors:["ceo@company.com", "cfo@company.com", "coo@company.com"]
  description:"Executive summary"

# Step 4: Formula Protection
sheets_advanced action:"add_protected_range"
  range:"Z:AE"
  description:"Calculation formulas - READ ONLY"
\`\`\`

Design your comprehensive protection strategy!
`
                  : ''
              }${
                selectedScenario === 'version_control'
                  ? `
## Situation

A project tracking spreadsheet is updated by multiple team members throughout the day:

**Current Problems:**
1. No way to see what changed between morning and evening
2. Can't revert to "last known good state"
3. No approval process for major changes
4. Lost data from accidental bulk deletes

**Requirements:**
1. Automatic snapshots every 4 hours
2. Manual snapshots before major changes
3. Easy comparison between versions
4. One-click rollback to any snapshot
5. Approval workflow for changes affecting >100 cells

## Your Task

Implement version control system:
1. Snapshot schedule
2. Comparison mechanism
3. Rollback procedure
4. Approval workflow

## Implementation Pattern

**Pattern 1: Scheduled Snapshots**
\`\`\`
sheets_appsscript action:"update_content"
  files:[{ name:"Code.gs", source:"function createSnapshot() { /* snapshot logic + ScriptApp schedule managed in code */ }" }]
  spreadsheetId:"${spreadsheetId}"
\`\`\`

**Pattern 2: Pre-Change Snapshot**
\`\`\`
# Before any major operation
sheets_collaborate action:"version_create_snapshot"
  description:"Before data import - \${new Date()}"

# Perform operation
sheets_data action:"write" ...

# Verify
sheets_analyze action:"scout"

# Rollback if needed
if (quality_dropped) {
  sheets_collaborate action:"version_restore_snapshot"
  snapshotId:"latest"
}
\`\`\`

**Pattern 3: Version Comparison**
\`\`\`
sheets_collaborate action:"version_compare"
  baseSnapshot:"morning-snapshot"
  targetSnapshot:"current"

Returns:
- Cells changed: 247
- Rows added: 12
- Rows deleted: 3
- Formulas modified: 8
\`\`\`

**Pattern 4: Approval Workflow**
\`\`\`
sheets_confirm action:"request"
  threshold:100
  approvers:["manager@company.com"]
  message:"Change affects \${cellCount} cells. Manager approval required."
\`\`\`

Build your version control workflow!
`
                  : ''
              }

## 🎯 Success Criteria

Your solution should:
✅ Solve the stated problem completely
✅ Be implementable with available tools
✅ Consider all stakeholder needs
✅ Include rollback/recovery plan
✅ Be maintainable long-term

## 📊 Evaluation

I'll assess your solution on:
- **Completeness**: Addresses all requirements (40pts)
- **Feasibility**: Can be implemented with ServalSheets (30pts)
- **Trade-offs**: Acknowledges pros/cons (20pts)
- **Rollback**: Clear recovery strategy (10pts)

## 💡 Collaboration Tips

1. Start with stakeholder analysis (who needs what)
2. Map protection zones before implementing
3. Test with sample users (different roles)
4. Document for future maintainers
5. Plan for edge cases (what if...)

Present your solution and I'll provide feedback on feasibility and improvements! 👥`,
            },
          },
        ],
      };
    }
  );

  // === CONTEXT-AWARE AND CHAINED WORKFLOW PROMPTS (Phase 3: Improvement Plan) ===

  server.registerPrompt(
    'auto_analyze',
    {
      description:
        'Auto-detect spreadsheet type and suggest best workflows, resources, and prompts',
      argsSchema: AutoAnalyzePromptArgsSchema,
    },
    async ({ spreadsheetId }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Auto-Analyzing spreadsheet: ${spreadsheetId}

Workflow: 1. sheets_core action:"get" (metadata) 2. sheets_analyze action:"analyze_structure" (headers, patterns) 3. Detect type

Types: Budget (income/expense/balance), CRM (name/email/phone/company), Inventory (SKU/qty/price), Project (task/status/due), Sales (customer/product/amount), Marketing (campaign/channel/spend)

Output: Detected Type % | Key Columns | Recommended Knowledge (3 URIs) | Suggested Prompts (3) | Next Steps`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'full_setup',
    {
      description:
        'Complete workspace setup using the canonical readiness → create → verify flow',
      argsSchema: FullSetupPromptArgsSchema,
    },
    async ({ type, name, collaborators }) => {
      const typeTemplates: Record<string, { knowledge: string; formulas: string }> = {
        budget: { knowledge: 'templates/finance', formulas: 'formulas/financial' },
        crm: { knowledge: 'templates/crm', formulas: 'formulas/lookup' },
        inventory: { knowledge: 'templates/inventory', formulas: 'formulas/lookup' },
        project: { knowledge: 'templates/project', formulas: 'formulas/datetime' },
        sales: { knowledge: 'templates/sales', formulas: 'formulas/financial' },
        marketing: { knowledge: 'templates/marketing', formulas: 'formulas/advanced' },
      };

      const defaultTemplate = { knowledge: 'templates/finance', formulas: 'formulas/financial' };
      const template = typeTemplates[type as keyof typeof typeTemplates] ?? defaultTemplate;
      const knowledgePath = template.knowledge;
      const formulasPath = template.formulas;
      const collaboratorList = collaborators?.length
        ? collaborators.join(', ')
        : '(none specified)';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Full Setup: ${type.toUpperCase()} "${name}"

Ladder: 1. sheets_auth action:"status" (readiness) 2. sheets_core action:"create" title:"${name}" 3. sheets_composite action:"setup_sheet" template:${knowledgePath} 4. Add formulas from ${formulasPath} 5. Format with presets + conditional formatting + auto-fit 6. sheets_session action:"set_active" + read test 7. ${collaboratorList ? `sheets_collaborate action:"share_add" for ${collaboratorList}` : 'Skip sharing'} 8. sheets_collaborate action:"version_create_snapshot"

Safety: Use sheets_confirm before destructive ops, snapshot after setup complete, verify formulas work before handoff.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'audit_security',
    {
      description: 'Security and permissions audit for a spreadsheet',
      argsSchema: AuditSecurityPromptArgsSchema,
    },
    async ({ spreadsheetId }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Security Audit: ${spreadsheetId}

1. Permissions: sheets_collaborate action:"share_list" - check Owner/Editor/Viewer/link-shared/domain-wide
2. Protection: sheets_advanced action:"list_protected_ranges" - which sheets/ranges protected, who can edit, unprotected sensitive areas
3. Data sensitivity: sheets_analyze action:"analyze_structure" - flag PII (emails, phones, SSN, accounts, addresses)
4. History: sheets_collaborate action:"version_list_revisions" - enabled, recent changes, suspicious mods

Report: Permission adjustments needed | Protection additions | PII masking/removal | Audit improvements`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'compare_spreadsheets',
    {
      description: 'Compare and diff two spreadsheets',
      argsSchema: CompareSpreadsheetPromptArgsSchema,
    },
    async ({ spreadsheetId1, spreadsheetId2 }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Comparing Spreadsheets A (${spreadsheetId1}) vs B (${spreadsheetId2})

**Step 1:** sheets_core action "get" on both → compare titles, sheet names, modified dates
**Step 2:** sheets_analyze action "analyze_structure" on both → compare columns, data types, row counts
**Step 3:** sheets_data action "batch_read" on matching sheets → identify cell value/formula/format differences
**Step 4:** Provide diff report: structural changes (sheets only in A/B, column diffs), data changes (modified cells, added/deleted rows), formula changes, similarity percentage

Use cases: version comparison, template validation, migration testing, parallel edit reconciliation`,
            },
          },
        ],
      };
    }
  );

  // === P4-P14 FEATURE PROMPTS (ISSUE-236) ===

  server.registerPrompt(
    'generate_sheet_from_description',
    {
      description: 'Generate a complete spreadsheet from a natural language description',
      argsSchema: GenerateSheetPromptArgsSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ description, style }: any) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🪄 Sheet Generation Workflow

**Goal:** Create a spreadsheet from this description: "${description}"
**Style:** ${style ?? 'professional'}

## Step 1: Preview (Dry Run)
Use sheets_composite action "preview_generation" to see proposed structure without creating:
\`\`\`json
{"action":"preview_generation","description":"${description}"}
\`\`\`

## Step 2: Review proposed structure
- Review the columns, formulas, formatting, and sample data
- Confirm it matches your intent before creating

## Step 3: Generate
Use sheets_composite action "generate_sheet" to create the spreadsheet:
\`\`\`json
{"action":"generate_sheet","description":"${description}","style":"${style ?? 'professional'}"}
\`\`\`

## Step 4: Enhance (optional)
After creation, use sheets_analyze action "suggest_next_actions" to get improvement recommendations:
\`\`\`json
{"action":"suggest_next_actions","spreadsheetId":"<from step 3>"}
\`\`\`

The generator uses AI (MCP Sampling) to design structure and formulas. For complex sheets, describe the columns, data types, and calculations you need.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'automated_data_cleaning',
    {
      description: 'Auto-detect and fix data quality issues in a range',
      argsSchema: CleanDataAutomatedPromptArgsSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ spreadsheetId, range }: any) => {
      const rangeStr = range ?? 'full sheet';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🧹 Automated Data Cleaning Workflow

**Spreadsheet:** ${spreadsheetId}
**Range:** ${rangeStr}

## Step 1: Get AI Recommendations
Use sheets_fix action "suggest_cleaning" to identify issues:
\`\`\`json
{"action":"suggest_cleaning","spreadsheetId":"${spreadsheetId}"${range ? `,"range":"${range}"` : ''}}
\`\`\`

## Step 2: Preview Changes
Use sheets_fix action "clean" in preview mode to see what will change:
\`\`\`json
{"action":"clean","spreadsheetId":"${spreadsheetId}"${range ? `,"range":"${range}"` : ''},"mode":"preview"}
\`\`\`

## Step 3: Review & Apply
If the preview looks good, apply the fixes:
\`\`\`json
{"action":"clean","spreadsheetId":"${spreadsheetId}"${range ? `,"range":"${range}"` : ''},"mode":"apply"}
\`\`\`

## Step 4: Standardize Formats (optional)
For date/currency/phone inconsistencies, use:
\`\`\`json
{"action":"standardize_formats","spreadsheetId":"${spreadsheetId}"${range ? `,"range":"${range}"` : ''},"columns":[{"column":"A","targetFormat":"iso_date"}]}
\`\`\`

**Built-in rules:** trim_whitespace, normalize_case, fix_dates, fix_numbers, fix_booleans, remove_duplicates, fix_emails, fix_phones, fix_urls, fix_currency`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'what_if_scenario_modeling',
    {
      description: 'Model a what-if scenario and trace cascading formula effects',
      argsSchema: ScenarioModelingPromptArgsSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ spreadsheetId, scenario }: any) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📊 What-If Scenario Modeling Workflow

**Spreadsheet:** ${spreadsheetId}
**Scenario:** "${scenario}"

## Step 1: Understand Dependencies
Use sheets_dependencies action "build" to map formula relationships:
\`\`\`json
{"action":"build","spreadsheetId":"${spreadsheetId}"}
\`\`\`

## Step 2: Identify Input Cells
Determine which cells to change for this scenario. Example for "revenue drops 20%":
- Find the revenue input cell (e.g., B2)
- New value = current value × 0.8

## Step 3: Model the Scenario
Use sheets_dependencies action "model_scenario" to trace all cascading effects:
\`\`\`json
{"action":"model_scenario","spreadsheetId":"${spreadsheetId}","changes":[{"cell":"Sheet1!B2","newValue":80000}]}
\`\`\`

## Step 4: Compare Multiple Scenarios (optional)
\`\`\`json
{"action":"compare_scenarios","spreadsheetId":"${spreadsheetId}","scenarios":[{"name":"Base Case","changes":[]},{"name":"${scenario}","changes":[{"cell":"Sheet1!B2","newValue":80000}]}]}
\`\`\`

## Step 5: Materialize as Sheet (optional)
Create a side-by-side comparison sheet without modifying the original:
\`\`\`json
{"action":"create_scenario_sheet","spreadsheetId":"${spreadsheetId}","scenario":{"name":"${scenario}","changes":[{"cell":"Sheet1!B2","newValue":80000}]}}
\`\`\``,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'smart_suggestions_copilot',
    {
      description: 'Get proactive AI suggestions for improving a spreadsheet',
      argsSchema: SmartSuggestionsPromptArgsSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ spreadsheetId }: any) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `💡 Smart Suggestions (Copilot) Workflow

**Spreadsheet:** ${spreadsheetId}

## Step 1: Quick Scan
Use sheets_analyze action "scout" to understand structure (fast, 1 API call):
\`\`\`json
{"action":"scout","spreadsheetId":"${spreadsheetId}"}
\`\`\`

## Step 2: Get Ranked Suggestions
Use sheets_analyze action "suggest_next_actions" for AI-powered recommendations:
\`\`\`json
{"action":"suggest_next_actions","spreadsheetId":"${spreadsheetId}","maxSuggestions":5}
\`\`\`

Each suggestion includes:
- Title and description
- Confidence score (0-1)
- Category (formulas, formatting, structure, data_quality, visualization)
- Ready-to-execute params — copy them directly into the next tool call

## Step 3: Apply Safe Improvements Automatically (optional)
Use sheets_analyze action "auto_enhance" in preview mode first:
\`\`\`json
{"action":"auto_enhance","spreadsheetId":"${spreadsheetId}","mode":"preview"}
\`\`\`
Then apply:
\`\`\`json
{"action":"auto_enhance","spreadsheetId":"${spreadsheetId}","mode":"apply"}
\`\`\`

## Step 4: Reject Unwanted Suggestions
If a suggestion doesn't apply, reject it so it won't repeat:
\`\`\`json
{"action":"reject_suggestion","spreadsheetId":"${spreadsheetId}","suggestionId":"<id from step 2>"}
\`\`\``,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'cross_spreadsheet_federation',
    {
      description: 'Query and join data across multiple spreadsheets',
      argsSchema: CrossSheetFederationPromptArgsSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async ({ spreadsheetIds }: any) => {
      const ids = spreadsheetIds.split(',').map((s: string) => s.trim());
      const sourcesJson = JSON.stringify(
        ids.map((id: string) => ({ spreadsheetId: id, range: 'Sheet1!A1:Z1000' }))
      );
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔗 Cross-Spreadsheet Federation Workflow

**Sources:** ${spreadsheetIds}

## Step 1: Read from Multiple Spreadsheets
Use sheets_data action "cross_read" to fetch and merge data:
\`\`\`json
{"action":"cross_read","sources":${sourcesJson}}
\`\`\`

To join on a common key (e.g., customer ID in column A):
\`\`\`json
{"action":"cross_read","sources":${sourcesJson},"joinKey":"A","joinType":"inner"}
\`\`\`

## Step 2: Natural Language Query (optional)
Use sheets_data action "cross_query" for plain-language questions:
\`\`\`json
{"action":"cross_query","sources":${sourcesJson},"query":"Show total revenue by month from the Sales sheet joined with region from the CRM sheet"}
\`\`\`

## Step 3: Compare Two Spreadsheets
Use sheets_data action "cross_compare" to diff two sources:
\`\`\`json
{"action":"cross_compare","source1":{"spreadsheetId":"${ids[0] ?? 'ID_A'}","range":"Sheet1!A1:Z1000"},"source2":{"spreadsheetId":"${ids[1] ?? 'ID_B'}","range":"Sheet1!A1:Z1000"},"compareColumns":["A"]}
\`\`\`

## Step 4: Write Results to a New Spreadsheet (optional)
Use sheets_data action "cross_write" to copy merged data:
\`\`\`json
{"action":"cross_write","source":{"spreadsheetId":"${ids[0] ?? 'SOURCE_ID'}","range":"Sheet1!A1:Z1000"},"destination":{"spreadsheetId":"DEST_ID","range":"Sheet1!A1"}}
\`\`\`

**Tip:** All cross-spreadsheet operations use parallel fetching for speed and ETag caching to avoid redundant API calls.`,
            },
          },
        ],
      };
    }
  );

  // === P14 COMPOSITE WORKFLOW PROMPTS ===

  server.registerPrompt(
    'audit_sheet',
    {
      description:
        'Run a full quality audit on a spreadsheet (formulas, structure, data, performance)',
      argsSchema: AuditSheetPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const focus = args['focusAreas'] ? ` (focus: ${args['focusAreas']})` : '';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔍 Spreadsheet Audit${focus}: ${args['spreadsheetId']}

## Step 1: Run Full Audit
\`\`\`json
{"action":"audit_sheet","spreadsheetId":"${args['spreadsheetId']}"${
                args['focusAreas']
                  ? `,"focusAreas":["${String(args['focusAreas'])
                      .split(',')
                      .map((s: string) => s.trim())
                      .join('","')}"]`
                  : ''
              }}
\`\`\`

## Step 2: Review Findings
The audit returns issues grouped by severity (critical, high, medium, low). Review each category.

## Step 3: Fix Critical Issues First
For formula errors: use \`sheets_fix action:"fix"\` or \`sheets_analyze action:"explain_analysis"\`
For data quality: use \`sheets_fix action:"clean"\` or \`sheets_fix action:"standardize_formats"\`
For structure: use \`sheets_dimensions\` or \`sheets_advanced\` as appropriate

## Step 4: Publish Results (optional)
\`\`\`json
{"action":"publish_report","spreadsheetId":"${args['spreadsheetId']}","reportType":"detailed"}
\`\`\`

**Tip:** Use \`focusAreas\` to limit the audit scope: "quality,formulas" for data-heavy sheets, "performance,structure" for large workbooks.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'publish_report',
    {
      description: 'Publish a formatted summary report to a new sheet or spreadsheet',
      argsSchema: PublishReportPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const reportType = args['reportType'] || 'summary';
      const target = args['targetSheet'] || 'Report';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📤 Publishing ${reportType} report from ${args['spreadsheetId']} → "${target}"

## Step 1: Analyze Source Data
\`\`\`json
{"action":"scout","spreadsheetId":"${args['spreadsheetId']}"}
\`\`\`

## Step 2: Publish Report
\`\`\`json
{"action":"publish_report","spreadsheetId":"${args['spreadsheetId']}","reportType":"${reportType}","targetSheet":"${target}"}
\`\`\`

The action creates a formatted sheet with:
- Executive summary table (key metrics, date range, data quality score)
- Section headers with formatting
- Charts for numeric columns (if reportType is "detailed")
- Timestamp and source attribution footer

## Step 3: Share (optional)
\`\`\`json
{"action":"share_set_link","spreadsheetId":"${args['spreadsheetId']}","access":"reader"}
\`\`\`

**Tip:** Use \`reportType:"executive"\` for a 1-page overview, \`"detailed"\` for full findings with charts.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'data_pipeline',
    {
      description:
        'Build a recurring ETL pipeline (fetch → transform → write) for a spreadsheet',
      argsSchema: DataPipelinePromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const sourceType = args['sourceType'] || 'csv';
      const frequency = args['frequency'] || 'daily';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔄 Data Pipeline: ${sourceType} → ${args['spreadsheetId']} (${frequency})

## Step 1: Configure Data Source
${sourceType === 'other_sheet' ? `Use \`sheets_data action:"cross_read"\` to pull from another spreadsheet.` : `Use \`sheets_connectors action:"configure"\` to connect to your ${sourceType} source.`}

## Step 2: Define the Pipeline
\`\`\`json
{
  "action": "data_pipeline",
  "spreadsheetId": "${args['spreadsheetId']}",
  "source": {"type": "${sourceType}"},
  "transformations": ${args['transformations'] ? `"${args['transformations']}"` : '"clean,deduplicate,standardize_formats"'},
  "outputRange": "Sheet1!A1",
  "mode": "preview"
}
\`\`\`

## Step 3: Preview Then Apply
Run in preview mode first to verify the output, then remove \`"mode":"preview"\` to apply.

## Step 4: Schedule (optional)
\`\`\`json
{"action":"schedule_create","spreadsheetId":"${args['spreadsheetId']}","cronExpression":"0 9 * * *","description":"Daily ${sourceType} pipeline","actionName":"data_pipeline"}
\`\`\`

**Tip:** Always preview before applying. Use \`sheets_session action:"save_checkpoint"\` before running for safe rollback.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'instantiate_template',
    {
      description: 'Create a new spreadsheet from a saved template with custom values',
      argsSchema: InstantiateTemplatePromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📋 Instantiating Template${args['templateName'] ? `: ${args['templateName']}` : ''}

## Step 1: Browse Available Templates (if needed)
\`\`\`json
{"action":"list","spreadsheetId":"any"}
\`\`\`

## Step 2: Preview Template
\`\`\`json
{"action":"preview","templateId":"${args['templateId'] || '<template-id>'}"}
\`\`\`

## Step 3: Instantiate with Custom Values
\`\`\`json
{
  "action": "instantiate_template",
  ${args['templateId'] ? `"templateId": "${args['templateId']}",` : ''}
  ${args['templateName'] ? `"templateName": "${args['templateName']}",` : ''}
  "values": ${args['values'] || '{"company":"Acme Corp","quarter":"Q1 2026","currency":"USD"}'},
  ${args['targetSpreadsheetId'] ? `"targetSpreadsheetId": "${args['targetSpreadsheetId']}"` : '"createNew": true'}
}
\`\`\`

The action replaces all \`{{placeholder}}\` tokens in the template with your provided values.

**Tip:** Use \`sheets_templates action:"list"\` to see all saved templates. Use \`"createNew":true\` to create a fresh spreadsheet.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'migrate_spreadsheet',
    {
      description: "Move or copy a spreadsheet's data and structure to a new destination",
      argsSchema: MigrateSpreadsheetPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const migrationType = args['migrationType'] || 'full';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📦 Spreadsheet Migration: ${args['sourceSpreadsheetId']} → ${args['targetSpreadsheetId'] || 'new spreadsheet'} (${migrationType})

## Step 1: Scout the Source
\`\`\`json
{"action":"scout","spreadsheetId":"${args['sourceSpreadsheetId']}"}
\`\`\`

## Step 2: Migrate
\`\`\`json
{
  "action": "migrate_spreadsheet",
  "spreadsheetId": "${args['sourceSpreadsheetId']}",
  ${args['targetSpreadsheetId'] ? `"targetSpreadsheetId": "${args['targetSpreadsheetId']}",` : '"createNew": true,'}
  "migrationType": "${migrationType}",
  "preserveFormatting": ${args['preserveFormatting'] !== false}
}
\`\`\`

## Step 3: Verify Destination
\`\`\`json
{"action":"scout","spreadsheetId":"${args['targetSpreadsheetId'] || '<new-spreadsheet-id>'}"}
\`\`\`
Compare row/column counts and spot-check formula references.

**Tip:** Use \`"migrationType":"structure_only"\` to copy headers and formatting without data — useful for creating blank templates. \`"selective"\` mode prompts for which sheets to include.`,
            },
          },
        ],
      };
    }
  );

  // === CONNECTOR WORKFLOW PROMPTS ===

  server.registerPrompt(
    'connector_setup',
    {
      description: 'Discover and configure an external data connector',
      argsSchema: ConnectorSetupPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const connectorId = args['connectorId'] as string | undefined;
      const useCase = args['useCase'] as string | undefined;
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Connector Setup${connectorId ? ` (${connectorId})` : ''}${useCase ? `\nUse case: ${useCase}` : ''}

Workflow:
1. Discover: \`sheets_connectors action:"discover"\` — browse available connectors
2. Select: Pick connector matching your use case
3. Configure: \`sheets_connectors action:"configure" connectorId:"..." credentials:{...}\`
4. Test: \`sheets_connectors action:"query" connectorId:"..." query:"test"\`
5. Verify: \`sheets_connectors action:"status" connectorId:"..."\`

After setup, use the connector_data_pipeline prompt to fetch and write data.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'connector_data_pipeline',
    {
      description: 'Fetch data from a connector, transform it, and write to a spreadsheet',
      argsSchema: ConnectorDataPipelinePromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const connectorId = args['connectorId'] as string;
      const query = args['query'] as string | undefined;
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Connector Data Pipeline
Connector: ${connectorId} → Spreadsheet: ${spreadsheetId}
${query ? `Query: ${query}` : ''}

Pipeline:
1. Query: \`sheets_connectors action:"query" connectorId:"${connectorId}" query:"..."\`
2. Preview: Review returned data shape and row count
3. Transform (optional): \`sheets_connectors action:"transform" connectorId:"${connectorId}" transformSpec:{filter/sort/limit}\`
4. Write: \`sheets_data action:"write" spreadsheetId:"${spreadsheetId}" range:"Sheet1!A1" values:[...]\`
5. Format: \`sheets_format action:"batch_format"\` — headers, number formats
6. Subscribe (optional): \`sheets_connectors action:"subscribe"\` for recurring refresh`,
            },
          },
        ],
      };
    }
  );
}
