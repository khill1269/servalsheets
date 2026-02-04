/**
 * ServalSheets - Prompt Registration
 *
 * Guided workflows and templates for common operations.
 *
 * @module mcp/registration/prompt-registration
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  FirstOperationPromptArgsSchema,
  AnalyzeSpreadsheetPromptArgsSchema,
  TransformDataPromptArgsSchema,
  CreateReportPromptArgsSchema,
  CleanDataPromptArgsSchema,
  MigrateDataPromptArgsSchema,
  SetupBudgetPromptArgsSchema,
  ImportDataPromptArgsSchema,
  SetupCollaborationPromptArgsSchema,
  DiagnoseErrorsPromptArgsSchema,
  SafeOperationPromptArgsSchema,
  BulkImportPromptArgsSchema,
  UndoChangesPromptArgsSchema,
  MasterClassDataQualityPromptArgsSchema,
  MasterClassFormulasPromptArgsSchema,
  MasterClassPerformancePromptArgsSchema,
  ChallengeQualityDetectivePromptArgsSchema,
  ChallengePerformanceProfilerPromptArgsSchema,
  ScenarioMultiUserPromptArgsSchema,
  AutoAnalyzePromptArgsSchema,
  FullSetupPromptArgsSchema,
  AuditSecurityPromptArgsSchema,
  CompareSpreadsheetPromptArgsSchema,
  RecoverFromErrorPromptArgsSchema,
  TroubleshootPerformancePromptArgsSchema,
  FixDataQualityPromptArgsSchema,
  OptimizeFormulasPromptArgsSchema,
  BulkImportDataPromptArgsSchema,
  AdvancedDataMigrationPromptArgsSchema,
  PerformanceAuditPromptArgsSchema,
  BatchOptimizerPromptArgsSchema,
  UltimateAnalysisPromptArgsSchema,
  CreateVisualizationPromptArgsSchema,
  AnalyzeWithHistoryPromptArgsSchema,
} from '../../schemas/prompts.js';

// ============================================================================
// PROMPTS REGISTRATION
// ============================================================================

/**
 * Registers ServalSheets prompts with the MCP server
 *
 * Prompts provide guided workflows and templates for common operations.
 *
 * @param server - McpServer instance
 */
export function registerServalSheetsPrompts(server: McpServer): void {
  // === ONBOARDING PROMPTS ===

  server.registerPrompt(
    'welcome',
    {
      description: '🎉 Welcome to ServalSheets! Get started with this guided introduction.',
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

I'm your Google Sheets assistant with 21 powerful tools and 293 actions.

## 🚀 Quick Start
Test spreadsheet: \`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms\`

## 📊 Capabilities
• Data Operations: Read, write, batch operations
• Analysis: Data quality, statistics, formula audit
• AI Analysis: Pattern detection, anomalies, formula generation (via MCP Sampling)
• Formatting: Colors, fonts, conditional formatting
• Advanced: Charts, pivots, sharing, versions

## 🛡️ Safety Features
• Dry-run mode, effect limits, auto-snapshots
• User confirmation for multi-step operations (via MCP Elicitation)

What would you like to do first?`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'test_connection',
    {
      description: '🔍 Test your ServalSheets connection with a public spreadsheet',
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

Please run these tests in order:
1. sheets_auth action: "status" → Verify authentication
2. sheets_core action: "get", spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" → Get metadata
3. sheets_data action: "read", spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", range: "Sheet1!A1:D10" → Read sample data
4. sheets_analyze action: "analyze_structure", spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" → Analyze structure

If all tests pass, you're ready to use ServalSheets!
If auth fails, follow the authentication flow first.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'first_operation',
    {
      description: '👶 Your first ServalSheets operation - a guided walkthrough',
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

Steps:
1. Read data: sheets_core action "get"
2. Analyze quality: sheets_analyze action "analyze_quality"
3. Get statistics: sheets_analyze action "analyze_data"
4. Format headers: sheets_format (use dryRun first!)

Safety tips: Always read before modify, use dryRun for destructive ops.`,
            },
          },
        ],
      };
    }
  );

  // === ANALYSIS PROMPTS ===

  server.registerPrompt(
    'analyze_spreadsheet',
    {
      description: '🔬 Comprehensive analysis of spreadsheet data quality and structure',
      argsSchema: AnalyzeSpreadsheetPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔬 Analyzing: ${args['spreadsheetId']}

**CONTEXT GATHERING PHASE** (Ask user before proceeding):
- What is this spreadsheet used for? (purpose helps focus analysis)
- Are there specific concerns? (data quality, formulas, performance)
- Which sheets should I prioritize? (or analyze all?)
- Any recent changes that might have caused issues?

**ANALYSIS EXECUTION** (After gathering context):
1. Metadata: sheets_core action "get" - understand structure
2. Data Quality: sheets_analyze action "analyze_quality" - find issues
3. Structure: sheets_analyze action "analyze_structure" - validate schema
4. Formula Audit: sheets_analyze action "analyze_formulas" - check for errors
5. AI Insights: sheets_analyze action "analyze_data" - intelligent patterns

**DELIVER RESULTS**:
- Quality score (0-100)
- Issues found (categorized by severity)
- Recommended fixes (prioritized by impact)
- Next steps based on user's stated purpose`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'transform_data',
    {
      description: '🔄 Transform data in a spreadsheet range with safety checks',
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
      description: '📈 Generate a formatted report from spreadsheet data',
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
      description: '🧹 Clean and standardize data in a spreadsheet range',
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
    'migrate_data',
    {
      description: '📦 Migrate data between spreadsheets with validation',
      argsSchema: MigrateDataPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📦 Data Migration

Source: ${args['sourceSpreadsheetId']} (${args['sourceRange']})
Target: ${args['targetSpreadsheetId']} (${args['targetRange'] || 'auto-detect'})

Migration Workflow:
1. Read source data: sheets_data action "read"
2. Validate data: Check schema, detect issues
3. Check target: Ensure compatibility
4. Plan operation: Present migration plan
5. Confirm: Use sheets_confirm for user approval
6. Execute: Copy data with transaction safety
7. Validate: Compare row counts, checksums

Safety: Creates snapshots of both sheets before migration.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'setup_budget',
    {
      description: '💰 Create a budget tracking spreadsheet with formulas and formatting',
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
      description: '📥 Import external data into Google Sheets with transformation',
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
      description: '👥 Configure sharing and permissions for team collaboration',
      argsSchema: SetupCollaborationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const role = args['role'] || 'writer';
      const collaborators = args['collaborators'] as string[];

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
   - sheets_collaborate action "add"

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
      description: '🔧 Troubleshoot and diagnose spreadsheet issues',
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
        '🔧 Recover from ServalSheets errors - AI-powered troubleshooting and self-healing',
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

  // Performance Troubleshooting Prompt
  server.registerPrompt(
    'troubleshoot_performance',
    {
      description: '⚡ Diagnose and fix slow spreadsheet operations',
      argsSchema: TroubleshootPerformancePromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const operation = (args['operation'] as string) || 'unknown';
      const responseTime = (args['responseTime'] as number) || 0;

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `⚡ Performance Troubleshooting for ${spreadsheetId}

Operation: ${operation}
${responseTime > 0 ? `Response Time: ${responseTime}ms` : ''}

Common Performance Issues:

1. **Large Range Reads** (>10K cells)
   • Problem: Reading entire sheets instead of specific ranges
   • Fix: Use precise ranges like "A1:D100" instead of "A:Z"
   • Tool: sheets_data with exact range
   • Improvement: 80-90% faster

2. **Multiple Individual Operations**
   • Problem: 50 separate read calls instead of 1 batch
   • Fix: Use batch_read with multiple ranges
   • Tool: sheets_data action="batch_read" ranges=["A1:B10","D1:E10"]
   • Improvement: Saves 80% API quota, 3-5x faster

3. **Formula Recalculation**
   • Problem: Complex formulas with circular references
   • Fix: Use optimize_formulas prompt
   • Check: sheets_analyze action="analyze_formulas"
   • Improvement: 50-70% faster calculations

4. **Network Latency**
   • Problem: Too many round trips to Google API
   • Fix: Bundle operations in sheets_transaction
   • Improvement: Single API call instead of N calls

5. **Unoptimized Queries**
   • Problem: Reading full sheet to find one value
   • Fix: Use sheets_data action="find_replace" with criteria
   • Improvement: 95% faster than scanning

Diagnostic Steps:

1. Check range size:
   • sheets_core action="get" → See total rows/columns
   • If >10K cells, reduce range

2. Enable profiling:
   • Add timing: const start = Date.now()
   • Measure each operation
   • Identify slowest step

3. Review recent operations:
   • sheets_history action="list" limit=10
   • Look for repeated calls

4. Analyze data structure:
   • sheets_analyze action="analyze_performance"
   • Get optimization suggestions

Quick Fixes by Operation Type:

• sheets_data read → Use batch_read, exact ranges
• sheets_format → Batch in sheets_transaction
• sheets_analyze → Limit to <10K cells
• sheets_visualize → Reduce source range size
• sheets_visualize → Limit data points to <1000

Apply fixes and retest!`,
            },
          },
        ],
      };
    }
  );

  // Data Quality Fix Prompt
  server.registerPrompt(
    'fix_data_quality',
    {
      description: '🔍 Identify and fix data quality issues',
      argsSchema: FixDataQualityPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const range = args['range'] as string;
      const issues = (args['issues'] as string) || 'auto-detect';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔍 Data Quality Analysis for ${spreadsheetId}
Range: ${range}
${issues !== 'auto-detect' ? `Known Issues: ${issues}` : ''}

Step 1: Detect Issues
Run: sheets_analyze action="analyze_data" spreadsheetId="${spreadsheetId}" range="${range}"

Common Data Quality Problems:

1. **Empty Cells in Required Columns**
   • Detection: Check for null/empty values
   • Fix: sheets_data action="find_replace" find="" → Fill or remove rows
   • Prevention: Add validation rules

2. **Duplicate Headers**
   • Detection: Count unique values in row 1
   • Fix: sheets_core action="update_sheet" → Rename duplicates
   • Prevention: Validate on import

3. **Inconsistent Formats**
   • Detection: Mixed date formats, number formats
   • Fix: sheets_format action="set_number_format" format="YYYY-MM-DD"
   • Prevention: Apply format before data entry

4. **Invalid Values**
   • Detection: Negative ages, future dates, out-of-range numbers
   • Fix: sheets_data action="find_replace" with valid values
   • Prevention: sheets_format action="set_data_validation"

5. **Extra Whitespace**
   • Detection: Leading/trailing spaces
   • Fix: Use TRIM formula or sheets_data action="find_replace"
   • Prevention: Input validation

Cleanup Workflow:

1. Analyze:
   sheets_analyze action="analyze_data" range="${range}"

2. Fix empty cells:
   • Delete: sheets_dimensions action="delete_rows"
   • Fill: sheets_data action="write" with default values

3. Standardize formats:
   • Dates: sheets_format format="yyyy-mm-dd"
   • Currency: sheets_format format="$#,##0.00"
   • Percentages: sheets_format format="0.00%"

4. Remove duplicates:
   • Find: sheets_data action="find_replace"
   • Mark or delete duplicates

5. Add validation:
   • sheets_format action="set_data_validation" type="LIST"
   • Prevent future bad data

6. Verify:
   • Re-run sheets_analyze
   • Check quality score improved

After cleanup, consider:
• Create snapshot: sheets_collaborate action="version_create_snapshot"
• Document changes: sheets_collaborate action="comment_add"`,
            },
          },
        ],
      };
    }
  );

  // Formula Optimization Prompt
  server.registerPrompt(
    'optimize_formulas',
    {
      description: '📊 Optimize slow or inefficient formulas',
      argsSchema: OptimizeFormulasPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const spreadsheetId = args['spreadsheetId'] as string;
      const range = (args['range'] as string) || 'entire sheet';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📊 Formula Optimization for ${spreadsheetId}
${range !== 'entire sheet' ? `Range: ${range}` : ''}

Step 1: Audit Formulas
Run: sheets_analyze action="analyze_formulas" spreadsheetId="${spreadsheetId}"

Common Formula Performance Issues:

1. **VLOOKUP** (Slow for large datasets)
   • Problem: O(n) lookup, scans entire column
   • Fix: Replace with INDEX/MATCH
   • Before: =VLOOKUP(A2,Data!A:D,3,FALSE)
   • After: =INDEX(Data!C:C,MATCH(A2,Data!A:A,0))
   • Improvement: 60% faster

2. **Array Formulas** (Resource intensive)
   • Problem: Recalculates entire array on every change
   • Fix: Split into individual cell formulas
   • Or: Use FILTER() with specific criteria
   • Improvement: 70% faster

3. **Volatile Functions** (Recalculate constantly)
   • Problem: NOW(), RAND(), INDIRECT() recalc on every edit
   • Fix: Replace with static values or manual triggers
   • NOW() → Use timestamp in cell, update manually
   • INDIRECT() → Use direct cell references
   • Improvement: 80% less recalculation

4. **Circular References**
   • Problem: Formulas referencing themselves
   • Detection: sheets_analyze shows circular_refs
   • Fix: Break cycle by moving calculation to different cell
   • Improvement: Prevents infinite loops

5. **Nested IFs** (Hard to read and slow)
   • Problem: =IF(A1>10,IF(A1>20,"High","Medium"),"Low")
   • Fix: Use IFS() or lookup table
   • After: =IFS(A1>20,"High",A1>10,"Medium",TRUE,"Low")
   • Improvement: More readable, 30% faster

Optimization Workflow:

1. Find slow formulas:
   • sheets_analyze action="analyze_formulas"
   • Look for: VLOOKUP, array formulas, volatile functions

2. Test performance:
   • Time recalculation (Ctrl+Alt+Shift+F9 in Sheets)
   • Identify slowest formulas

3. Replace VLOOKUP:
   • Find all: sheets_data action="find_replace" find="VLOOKUP"
   • Replace manually with INDEX/MATCH pattern

4. Simplify array formulas:
   • Convert to individual formulas
   • Or use more efficient array operations

5. Remove volatile functions:
   • Replace NOW() with manual timestamp
   • Replace INDIRECT() with direct references

6. Verify improvements:
   • Re-run formula audit
   • Test recalculation speed

Formula Best Practices:

• Use named ranges (easier to read and maintain)
• Avoid full column references (A:A) when possible
• Cache lookup results instead of repeated calculations
• Use FILTER() instead of complex IF arrays
• Break complex formulas into intermediate cells

After optimization:
• Document changes in comments
• Create version snapshot
• Monitor performance over time`,
            },
          },
        ],
      };
    }
  );

  // Bulk Import Workflow Prompt
  server.registerPrompt(
    'bulk_import_data',
    {
      description: '📥 Efficiently import large datasets',
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
   • Freeze: sheets_dimensions action="freeze_rows" count=1

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
    sheets_transaction action="add_operation" operation=write
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
        '🛡️ Execute destructive operations safely with dry-run → confirm → execute workflow',
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
    'bulk_import',
    {
      description: '📦 Import large datasets efficiently using transactions (80% quota savings)',
      argsSchema: BulkImportPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const rowCount = (args['rowCount'] as number) || 0;
      const targetSheet = (args['targetSheet'] as string) || 'new sheet';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📦 Bulk Import Workflow
Spreadsheet: ${args['spreadsheetId']}
Data: ${args['dataDescription']}
Target: ${targetSheet}
${rowCount > 0 ? `Rows: ~${rowCount}` : ''}

🚀 TRANSACTION WORKFLOW (Required for efficiency):

Step 1: BEGIN Transaction
┌────────────────────────────────────┐
│ sheets_transaction action="begin" │
│ spreadsheetId="${args['spreadsheetId']}"   │
│ autoRollback=true                 │
└────────────────────────────────────┘
→ Returns: transactionId="tx_..."

Step 2: QUEUE Operations
┌────────────────────────────────────┐
│ For each data chunk (1000 rows):  │
│                                    │
│ sheets_transaction action="queue" │
│ transactionId="tx_..."            │
│ operation={                        │
│   tool: "sheets_data",          │
│   action: "write",                │
│   params: {                       │
│     range: "A2:Z1001",           │
│     values: [[...]]              │
│   }                              │
│ }                                 │
│                                    │
│ Repeat for each chunk...          │
└────────────────────────────────────┘

Step 3: COMMIT All Operations
┌────────────────────────────────────┐
│ sheets_transaction action="commit"│
│ transactionId="tx_..."            │
└────────────────────────────────────┘
→ Executes ALL operations in 1 API call!

Performance Benefits:
✅ 1 API call instead of ${rowCount > 0 ? Math.ceil(rowCount / 1000) : 'N'} calls
✅ 80-95% quota savings
✅ 10x faster execution
✅ Atomic execution (all-or-nothing)
✅ Auto-rollback on failure

Optimal Strategy by Size:

${rowCount < 1000 ? '📘 SMALL (<1000 rows): Single transaction, all data at once' : ''}
${rowCount >= 1000 && rowCount < 10000 ? '📗 MEDIUM (1K-10K): Single transaction, chunked into 1000-row writes' : ''}
${rowCount >= 10000 ? '📕 LARGE (>10K): Multiple transactions, 5000 rows each, 2s pause between' : ''}

Complete Example:
\`\`\`
# 1. Begin
sheets_transaction begin → tx_123

# 2. Queue writes (repeat for each chunk)
sheets_transaction queue tx_123 operation=write range=A2:Z1001
sheets_transaction queue tx_123 operation=write range=A1002:Z2001
sheets_transaction queue tx_123 operation=write range=A2002:Z3001

# 3. Commit (1 API call executes all)
sheets_transaction commit tx_123
→ 3 operations, 1 API call, 66% quota saved!
\`\`\`

Error Recovery:
• If commit fails → Auto-rollback (no partial writes)
• If need to abort → sheets_transaction rollback tx_123
• Spreadsheet stays consistent (atomic guarantee)

After Import:
1. sheets_dimensions action="auto_resize" (columns)
2. sheets_format (apply formatting)
3. sheets_collaborate action="version_create_snapshot" (checkpoint)
4. sheets_analyze action="analyze_quality" (verify)

Transaction = Speed + Safety + Atomicity`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'undo_changes',
    {
      description: '⏪ Undo recent changes using version history or operation history',
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

  // === CONFIRMATION GUIDE PROMPTS ===

  server.registerPrompt(
    'when_to_confirm',
    {
      description: '🛡️ Learn when and how to request user confirmation before operations',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🛡️ When to Request User Confirmation

This guide tells you EXACTLY when to use sheets_confirm.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 ALWAYS CONFIRM (No exceptions):

1. DELETING SHEETS
   • Any sheets_core action="delete_sheet" call
   • Say: "This will permanently delete the sheet and all its data."

2. DELETING ROWS (>10)
   • sheets_dimensions action="delete_rows" with count > 10
   • Say: "I found {N} rows to delete. Want to see which ones first?"

3. DELETING COLUMNS (>3)
   • sheets_dimensions action="delete_columns" with count > 3
   • Say: "Deleting {N} columns may affect formulas. Proceed?"

4. CLEARING DATA (>100 cells)
   • sheets_data action="clear" on large ranges
   • Say: "This will erase {N} cells of data. Continue?"

5. LARGE WRITES (>500 cells)
   • sheets_data action="write" with >500 cells
   • Say: "I'll update {N} cells. Create a backup first?"

6. MULTI-STEP OPERATIONS (3+ steps)
   • When your plan has 3 or more operations
   • Use sheets_confirm to show the plan

7. SHARING/PERMISSIONS
   • Any sheets_collaborate call
   • Say: "This will give {email} access to your data."

8. ANYTHING USER DIDN'T EXPLICITLY REQUEST
   • If you're doing something as a side effect
   • Always ask first

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟡 SUGGEST CONFIRMATION (Offer, don't require):

• 50-500 cell modifications
• Formatting large ranges
• Adding formulas to existing data
• Sorting/filtering operations
• Import operations

How to offer: "I'll update {N} cells. Want me to show a preview first?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ NO CONFIRMATION NEEDED:

• All read operations (read, get, list, find)
• Single cell updates user explicitly asked for
• Small writes (<50 cells) user requested
• Analysis operations
• Getting statistics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 HOW TO USE sheets_confirm:

Step 1: Build a plan
\`\`\`json
{
  "action": "request",
  "plan": {
    "title": "Delete Empty Rows",
    "description": "Remove 47 rows with no data",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Delete 47 empty rows",
        "tool": "sheets_dimensions",
        "action": "delete_rows",
        "risk": "high",
        "isDestructive": true,
        "canUndo": true
      }
    ],
    "willCreateSnapshot": true,
    "additionalWarnings": ["Cannot be undone without snapshot"]
  }
}
\`\`\`

Step 2: Call sheets_confirm

Step 3: Check response
• If approved → Execute the plan
• If declined → Abort and explain what was avoided
• If modified → Adjust plan per user feedback

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 CONVERSATIONAL ALTERNATIVES:

Instead of formal sheets_confirm, you can also ask naturally:

• "Before I delete these 15 rows, want to see which ones?"
• "This will clear 200 cells. Should I create a backup first?"
• "I found 3 duplicates. Remove them?"

But for ANYTHING destructive or large, sheets_confirm is preferred
because it shows a proper UI and creates an audit trail.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 GOLDEN RULES:

1. Deletion = ALWAYS confirm
2. >100 cells = ALWAYS confirm
3. Sharing = ALWAYS confirm
4. Multi-step = ALWAYS show plan
5. Small explicit requests = No confirmation
6. When uncertain = ASK
7. Offer snapshots for destructive ops
8. Offer dryRun when user seems unsure`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'confirmation_examples',
    {
      description: '📝 Examples of good vs bad confirmation behavior',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `📝 Confirmation Examples: Good vs Bad

Learn from these examples of proper confirmation behavior.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 1: Delete rows with empty status

User: "Delete all rows where status is empty"

❌ BAD (Don't do this):
"Done! I deleted 23 rows."

✅ GOOD:
"I found 23 rows with empty status. Before I delete them:
1. Want to see which rows they are?
2. I'll create a snapshot so you can undo if needed.

Ready to proceed?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 2: Clear a column

User: "Clear column D"

❌ BAD:
"Cleared column D."

✅ GOOD:
"Column D has 847 cells with data. Clearing them all will:
• Erase all values in D2:D848
• Break any formulas referencing this column

Should I:
a) Show you what's in column D first?
b) Create a snapshot then clear?
c) Clear just empty rows?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 3: Simple cell update

User: "Change cell A1 to 'Hello'"

❌ BAD (Over-confirming):
"Are you absolutely sure you want to change A1? This will 
overwrite the existing value. Please confirm..."

✅ GOOD:
"Done! Changed A1 to 'Hello'."

(No confirmation needed for small, explicit requests)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 4: Create a CRM (multi-step)

User: "Set up a CRM for me"

❌ BAD:
"Creating CRM... done! I made 6 sheets and added formulas."

✅ GOOD:
"I'll create a CRM with:
• 📊 Dashboard - Overview and metrics
• 👥 Contacts - Your contact list
• 🏢 Companies - Business accounts
• 💰 Deals - Sales pipeline
• 📝 Activities - Task tracking
• ⚙️ Settings - Dropdown values

This involves about 15 operations. Here's my plan:
[Shows plan via sheets_confirm]

Ready to create it?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 5: Share spreadsheet

User: "Share this with john@example.com"

❌ BAD:
"Shared with john@example.com as editor."

✅ GOOD:
"I'll share with john@example.com. What permission level?
• 👁️ Viewer - Can only view
• 💬 Commenter - Can view and comment
• ✏️ Editor - Can make changes

Also, should I send them a notification email?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 6: User says "just do it"

User: "Just format all the headers, don't ask me"

✅ CORRECT BEHAVIOR:
"Got it! Formatting headers now..."
(Respect user's preference for less confirmation)

But then track this preference for future operations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY TAKEAWAYS:

1. Big operations → Always confirm with details
2. Small explicit requests → Just do it
3. Destructive operations → Offer snapshot + confirm
4. Multi-step → Show the plan first
5. Respect "just do it" preferences
6. When in doubt → Ask nicely`,
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
        '🚀 Advanced multi-sheet, multi-spreadsheet data migration with transformation and validation',
      argsSchema: AdvancedDataMigrationPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      const migrationType = (args['migrationType'] as string) || 'full';
      const hasTransformations = Boolean(args['transformations']);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🚀 Advanced Data Migration Workflow

Source: ${args['sourceSpreadsheetId']}
Target: ${args['targetSpreadsheetId']}
Type: ${migrationType}
${hasTransformations ? `Transformations: ${args['transformations']}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PHASE 1: DISCOVERY & PLANNING

1. Analyze Source Structure:
   sheets_core action="list_sheets" → Get all sheets
   For each sheet:
     sheets_data action="read" range="{sheet}!A1:Z1" → Get headers
     sheets_analyze action="analyze_structure" → Understand data types
     sheets_analyze action="analyze_quality" → Check quality issues

2. Analyze Target Structure:
   sheets_core action="get" spreadsheetId=target
   Identify: Matching sheets, conflicts, missing sheets

3. Build Migration Plan:
   • Sheet mapping (source → target)
   • Column mapping (handle renames/reordering)
   • Data type conversions needed
   • Validation rules to preserve
   • Formulas to update (cell references)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  PHASE 2: PRE-MIGRATION VALIDATION

1. Compatibility Check:
   • Verify target has capacity (row/column limits)
   • Check for naming conflicts
   • Validate data type compatibility
   • Identify potential data loss scenarios

2. Impact Analysis:
   sheets_quality action="analyze_impact" operation="migrate"
   • Find dependent sheets/formulas
   • Identify broken references after migration
   • Calculate migration complexity

3. Create Safety Net:
   sheets_collaborate action="version_create_snapshot" spreadsheetId=target
   description="Before ${migrationType} migration from ${args['sourceSpreadsheetId']}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 PHASE 3: DATA MIGRATION (Choose Strategy)

${
  migrationType === 'full'
    ? `
**FULL MIGRATION Strategy:**

For each source sheet:

  Step 1: Prepare Target Sheet
  ┌────────────────────────────────────┐
  │ Create or clear target sheet:     │
  │ sheets_core action="add_sheet"         │
  │   OR                              │
  │ sheets_data action="clear"      │
  └────────────────────────────────────┘

  Step 2: Migrate Data with Transaction
  ┌────────────────────────────────────┐
  │ sheets_transaction action="begin" │
  │                                    │
  │ Queue operations:                  │
  │ 1. Write headers (transformed)    │
  │ 2. Write data in 1000-row chunks  │
  │ 3. Copy formatting rules          │
  │ 4. Recreate data validation       │
  │ 5. Update formulas (refs)         │
  │                                    │
  │ sheets_transaction action="commit"│
  └────────────────────────────────────┘

  Step 3: Verify Migration
  ┌────────────────────────────────────┐
  │ • Row count match                  │
  │ • Column count match              │
  │ • Spot-check sample data          │
  │ • Verify formulas work            │
  └────────────────────────────────────┘
`
    : migrationType === 'incremental'
      ? `
**INCREMENTAL MIGRATION Strategy:**

Migrate only NEW or CHANGED data:

Step 1: Find Delta
┌────────────────────────────────────┐
│ Identify changes since last sync: │
│ • Compare row counts              │
│ • Check modification timestamps   │
│ • Hash data for change detection  │
└────────────────────────────────────┘

Step 2: Sync Changes
┌────────────────────────────────────┐
│ For NEW rows:                      │
│   sheets_data action="append"   │
│                                    │
│ For MODIFIED rows:                │
│   sheets_composite action="bulk_update"│
│   keyColumn="ID"                  │
│                                    │
│ For DELETED rows:                 │
│   sheets_dimensions action="delete_rows"│
└────────────────────────────────────┘
`
      : `
**SELECTIVE MIGRATION Strategy:**

Migrate specific ranges or conditions:

Step 1: Define Selection Criteria
┌────────────────────────────────────┐
│ • Specific ranges                  │
│ • Filter conditions               │
│ • Date ranges                     │
│ • Data quality thresholds         │
└────────────────────────────────────┘

Step 2: Extract and Transform
┌────────────────────────────────────┐
│ For each selection:               │
│   sheets_data action="read"     │
│   Apply transformations           │
│   Validate data                   │
│   sheets_data action="write" target│
└────────────────────────────────────┘
`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 PHASE 4: POST-MIGRATION VALIDATION

1. Data Integrity Checks:
   ✓ Row counts match (source vs target)
   ✓ No data loss (spot-check samples)
   ✓ Formulas working (no #REF! errors)
   ✓ Data types preserved
   ✓ Formatting preserved (if needed)

2. Quality Analysis:
   sheets_analyze action="analyze_quality" spreadsheetId=target
   • Check for: empty cells, duplicates, outliers
   • Compare quality scores: source vs target

3. Formula Verification:
   sheets_analyze action="analyze_formulas"
   • Verify no broken references
   • Check formula complexity unchanged
   • Test key calculations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 PHASE 5: RECONCILIATION & REPORTING

1. Generate Migration Report:
   {
     "summary": {
       "sheetsProcessed": N,
       "rowsMigrated": N,
       "formulasUpdated": N,
       "dataQuality": "PASS/FAIL",
       "duration": "MM:SS"
     },
     "issues": [
       {"type": "WARNING", "sheet": "Sheet1", "description": "..."}
     ],
     "recommendations": [...]
   }

2. Create Verification Sheet:
   sheets_core action="add_sheet" title="Migration_Verification"
   Add summary table with:
   • Sheet-by-sheet comparison
   • Row count deltas
   • Quality scores
   • Issues found

3. Final Snapshot:
   sheets_collaborate action="version_create_snapshot"
   description="After ${migrationType} migration - SUCCESS"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 SUCCESS CRITERIA

✅ All sheets migrated without data loss
✅ Formula references updated correctly
✅ Data quality maintained or improved
✅ No broken validations or formatting
✅ Verification report generated
✅ Snapshots created for rollback

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  ROLLBACK PROCEDURE (If Issues Found)

1. sheets_collaborate action="version_restore_revision" revisionId="pre-migration"
2. Review migration report for root cause
3. Fix issues in migration logic
4. Re-run migration with corrections

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 PRO TIPS

• Use transactions for atomicity (all-or-nothing)
• Migrate during low-usage hours
• Test migration on copy first
• Keep source spreadsheet until verified
• Document column mappings for future reference
• Monitor API quota usage during large migrations
• Use batch operations (80% faster than individual)

Ready to execute migration! 🚀`,
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
        '⚡ Comprehensive spreadsheet performance audit with optimization recommendations',
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
              text: `⚡ Performance Audit for ${args['spreadsheetId']}
Focus: ${focusAreas.join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 PHASE 1: BASELINE ASSESSMENT

1. Spreadsheet Structure:
   sheets_core action="get"

   Analyze:
   • Total sheets: N
   • Total cells: rows × columns × sheets
   • File size estimate: (cells × 100 bytes)
   • Sheets with >10K rows (performance risk)
   • Sheets with >26 columns (Z+) (complexity indicator)

2. Formula Complexity Analysis:
   sheets_analyze action="analyze_formulas"

   Identify:
   • Total formulas: N
   • Volatile functions: NOW(), RAND(), INDIRECT() (expensive!)
   • Array formulas: {...} (recalc intensive)
   • VLOOKUP usage: (suggest INDEX/MATCH)
   • Circular references: (performance killer)
   • Nested IF depth: >3 levels (hard to maintain)
   • External references: OtherSheet!A1 (cross-sheet dependencies)

3. Data Quality Check:
   sheets_analyze action="analyze_quality"

   Find:
   • Empty rows/columns: (wasted space)
   • Duplicate data: (use sheets_composite deduplicate)
   • Inconsistent data types: (causes formula errors)
   • Large text fields: >1000 chars (slow rendering)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 PHASE 2: PERFORMANCE BOTTLENECK DETECTION

**Formula Performance Issues:**

🔴 CRITICAL (Fix Immediately):
┌────────────────────────────────────────────────────┐
│ • Volatile functions in large ranges              │
│   Problem: NOW() in 10,000 cells = 10K recalcs   │
│   Fix: Replace with static timestamp             │
│                                                    │
│ • Circular references                             │
│   Problem: Infinite calculation loops            │
│   Fix: Break cycle by moving calc to new cell    │
│                                                    │
│ • Array formulas on full columns (A:A)           │
│   Problem: Evaluates all 1M rows                 │
│   Fix: Use specific range A1:A1000               │
└────────────────────────────────────────────────────┘

🟡 HIGH PRIORITY (Fix Soon):
┌────────────────────────────────────────────────────┐
│ • VLOOKUP on large datasets                       │
│   Before: =VLOOKUP(A2,Data!A:D,3,FALSE)         │
│   After:  =INDEX(Data!C:C,MATCH(A2,Data!A:A,0)) │
│   Gain: 60% faster                               │
│                                                    │
│ • Nested IF statements (>3 levels)               │
│   Before: =IF(A1>10,IF(A1>20,"H","M"),"L")      │
│   After:  =IFS(A1>20,"H",A1>10,"M",TRUE,"L")    │
│   Gain: More readable, 30% faster               │
│                                                    │
│ • INDIRECT for dynamic references                │
│   Problem: Recalculates on every change         │
│   Fix: Use direct cell references or named ranges│
└────────────────────────────────────────────────────┘

**Data Structure Issues:**

🔴 CRITICAL:
┌────────────────────────────────────────────────────┐
│ • Sheets with >100K cells                         │
│   Solution: Split into multiple sheets           │
│             Use pivot tables for summaries       │
│                                                    │
│ • Excessive empty rows (trailing data)           │
│   Solution: sheets_dimensions action="delete_rows"│
│             Clean up data range                  │
└────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  PHASE 3: API USAGE OPTIMIZATION

Check Current Efficiency:
┌────────────────────────────────────────────────────┐
│ Resource: cache://stats                           │
│                                                    │
│ Current Stats:                                    │
│ • API calls: N                                    │
│ • Cache hit rate: X%                              │
│ • Efficiency gain: Y%                             │
│                                                    │
│ Target: >50% efficiency gain                      │
└────────────────────────────────────────────────────┘

Optimization Recommendations:

1️⃣  BATCHING (20-40% savings)
┌────────────────────────────────────────────────────┐
│ ❌ DON'T: Multiple individual reads                │
│    sheets_data action="read" range="A1:B10"     │
│    sheets_data action="read" range="D1:E10"     │
│    sheets_data action="read" range="G1:H10"     │
│    Result: 3 API calls                            │
│                                                    │
│ ✅ DO: Single batch read                          │
│    sheets_data action="batch_read" ranges=[    │
│      "A1:B10", "D1:E10", "G1:H10"               │
│    ]                                              │
│    Result: 1 API call (66% savings!)             │
└────────────────────────────────────────────────────┘

2️⃣  TRANSACTIONS (80-95% savings for bulk)
┌────────────────────────────────────────────────────┐
│ ❌ DON'T: Individual write operations              │
│    For 100 rows: 100 API calls                   │
│                                                    │
│ ✅ DO: Transaction-wrapped bulk operation         │
│    sheets_transaction action="begin"             │
│    For chunks: queue write operations            │
│    sheets_transaction action="commit"            │
│    Result: 1 API call (99% savings!)             │
└────────────────────────────────────────────────────┘

3️⃣  CACHING (15-30% savings)
┌────────────────────────────────────────────────────┐
│ • Metadata (sheet list, properties) cached       │
│ • Frequently-read ranges cached                  │
│ • Cache auto-invalidates on writes               │
│                                                    │
│ Tip: Don't repeatedly call sheets_core get│
│      Results cached automatically                │
└────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 PHASE 4: STRUCTURE OPTIMIZATION

Run Full Analysis:
sheets_analyze action="analyze_structure"

Common Issues & Fixes:

1. Duplicate Headers:
   Problem: Multiple columns named "Date"
   Fix: sheets_core action="update_sheet" → Rename to unique names

2. Mixed Data Types in Columns:
   Problem: "Age" column has numbers and text
   Fix: sheets_analyze → Find inconsistencies → Clean data

3. Unnecessary Sheets:
   Problem: 20 sheets, only 5 used
   Fix: Archive or delete unused sheets

4. Inefficient Layouts:
   Problem: Wide sheets (50+ columns)
   Fix: Consider pivot tables or transposed layout

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PHASE 5: GENERATE AUDIT REPORT

Create Audit Report Sheet:
sheets_core action="add_sheet" title="Performance_Audit_Report"

Report Sections:

1. EXECUTIVE SUMMARY
   • Overall Performance Score: X/100
   • Critical Issues: N
   • Est. Speed Improvement: Y%
   • Est. API Savings: Z%

2. FORMULA ANALYSIS
   • Total Formulas: N
   • Volatile Functions: N (replace with static)
   • VLOOKUPs to Optimize: N (convert to INDEX/MATCH)
   • Circular References: N (fix immediately)

3. STRUCTURE RECOMMENDATIONS
   • Sheets to Split: [List]
   • Empty Rows to Remove: N
   • Duplicate Columns: [List]

4. API EFFICIENCY
   • Current: X% efficiency
   • Potential: Y% efficiency (+Z% improvement)
   • Recommendation: Use batching + transactions

5. ACTION PLAN (Prioritized)
   Priority 1 (Critical):
     • Fix circular references
     • Remove volatile functions from large ranges
     • Split sheets >100K cells

   Priority 2 (High):
     • Convert VLOOKUP to INDEX/MATCH
     • Implement batching for repeated operations
     • Clean up empty rows

   Priority 3 (Medium):
     • Optimize data structure
     • Add named ranges
     • Implement caching strategy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 QUICK WINS (Implement These First)

1. Enable Batching: Use batch_read instead of individual reads
   Impact: 20-40% API savings immediately

2. Fix Volatile Functions: Replace NOW() with manual timestamps
   Impact: 80% recalculation reduction

3. Delete Empty Rows: sheets_dimensions action="delete_rows"
   Impact: Faster load times, cleaner data

4. Use Transactions: Wrap bulk operations
   Impact: 80-95% API savings for bulk ops

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Audit complete! Review findings and implement recommendations. 🎯`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'batch_optimizer',
    {
      description: '🔄 Convert inefficient individual operations to optimized batch operations',
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
              text: `🔄 Batch Operation Optimizer

Spreadsheet: ${args['spreadsheetId']}
Operation Type: ${operationType}
Current: ${operationCount} individual operations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 CURRENT INEFFICIENCY ANALYSIS

${
  operationType === 'read'
    ? `
**READING ${operationCount} RANGES INDIVIDUALLY**

❌ Current Approach (INEFFICIENT):
\`\`\`
For each of ${operationCount} ranges:
  sheets_data action="read" range="..."
  Wait for response
  Process data
\`\`\`

Cost Analysis:
• API Calls: ${operationCount}
• Time: ~${operationCount * 0.3}s (${operationCount}× 300ms average)
• Quota Usage: ${operationCount} read requests
• Failure Risk: ${operationCount} opportunities for errors

✅ Optimized Approach (BATCH READ):
\`\`\`
sheets_data action="batch_read" ranges=[
  "Sheet1!A1:B10",
  "Sheet1!D1:E10",
  ...${operationCount} ranges
]
\`\`\`

Savings Analysis:
• API Calls: 1 (${operationCount - 1} saved!)
• Time: ~0.5s (${(operationCount * 0.3 - 0.5).toFixed(1)}s faster)
• Quota Savings: ${(((operationCount - 1) / operationCount) * 100).toFixed(0)}%
• Failure Risk: 1 call to monitor

🎯 IMPROVEMENT: ${(((operationCount - 1) / operationCount) * 100).toFixed(0)}% fewer API calls
`
    : operationType === 'write'
      ? `
**WRITING ${operationCount} RANGES INDIVIDUALLY**

❌ Current Approach (INEFFICIENT):
\`\`\`
For each of ${operationCount} ranges:
  sheets_data action="write"
    range="..."
    values=[...]
\`\`\`

Cost: ${operationCount} API calls

✅ Option 1: Batch Write (Moderate Improvement)
\`\`\`
sheets_data action="batch_write" data=[
  {range: "A1:B10", values: [...]},
  {range: "D1:E10", values: [...]},
  ...${operationCount} writes
]
\`\`\`
Savings: ${(((operationCount - 1) / operationCount) * 100).toFixed(0)}% fewer API calls

✅ Option 2: Transaction (BEST - Atomic)
\`\`\`
sheets_transaction action="begin"
  → transactionId

For each write:
  sheets_transaction action="queue"
    transactionId=...
    operation={write details}

sheets_transaction action="commit"
  transactionId=...
\`\`\`

Benefits:
• API Calls: 3 total (begin + queue×N + commit = 1 actual API call)
• **Atomicity**: All succeed or all fail (no partial writes)
• **Rollback**: Auto-rollback on error
• **Performance**: 80-95% faster
• **Quota Savings**: ${Math.floor(((operationCount - 3) / operationCount) * 100)}%

🎯 IMPROVEMENT: ${Math.floor(((operationCount - 3) / operationCount) * 100)}% fewer API calls + atomicity guarantee
`
      : operationType === 'update'
        ? `
**UPDATING ${operationCount} CELLS/RANGES**

❌ Current Approach:
Multiple individual update calls

✅ Optimized: Use sheets_composite bulk_update

sheets_composite action="bulk_update"
  spreadsheetId="${args['spreadsheetId']}"
  sheet="Sheet1"
  keyColumn="ID"
  updates=[
    {ID: 1, Name: "New Name", Status: "Active"},
    {ID: 2, Price: 99.99},
    ...${operationCount} updates
  ]

Features:
• Updates by key column (like SQL UPDATE WHERE)
• Only modifies specified fields
• Preserves other columns
• Single API call
• Automatic row matching

🎯 IMPROVEMENT: ${operationCount} operations → 1 API call
`
        : operationType === 'format'
          ? `
**FORMATTING ${operationCount} RANGES**

❌ Current Approach:
Multiple sheets_format calls

✅ Optimized: Transaction-wrapped formatting

sheets_transaction action="begin"

Queue all format operations:
  sheets_transaction action="queue" operation={
    tool: "sheets_format",
    action: "set_background_color",
    params: {range: "A1:B10", color: {red: 1}}
  }
  ...${operationCount} format operations

sheets_transaction action="commit"

Result: All ${operationCount} formats applied in 1 API call!

🎯 IMPROVEMENT: 80-95% faster, atomic formatting
`
          : `
**MIXED OPERATIONS (${operationCount} TOTAL)**

For mixed operation types, use Transaction Manager:

✅ Optimized Workflow:

Step 1: Begin Transaction
\`\`\`
sheets_transaction action="begin"
  spreadsheetId="${args['spreadsheetId']}"
  autoRollback=true
→ Returns: transactionId="tx_..."
\`\`\`

Step 2: Queue All Operations
\`\`\`
// Read operation
sheets_transaction action="queue"
  transactionId="tx_..."
  operation={
    tool: "sheets_data",
    action: "read",
    params: {range: "A1:B10"}
  }

// Write operation
sheets_transaction action="queue"
  transactionId="tx_..."
  operation={
    tool: "sheets_data",
    action: "write",
    params: {range: "D1:E10", values: [...]}
  }

// Format operation
sheets_transaction action="queue"
  transactionId="tx_..."
  operation={
    tool: "sheets_format",
    action: "set_bold",
    params: {range: "A1:B1", bold: true}
  }

...repeat for all ${operationCount} operations
\`\`\`

Step 3: Commit Transaction
\`\`\`
sheets_transaction action="commit"
  transactionId="tx_..."
\`\`\`

Result: All ${operationCount} operations execute in single API call!

Benefits:
• ${operationCount} → 1 API call (${Math.floor(((operationCount - 1) / operationCount) * 100)}% reduction)
• Atomic execution (all-or-nothing)
• Auto-rollback on failure
• Preserves operation order
• ${Math.floor(((operationCount - 1) / operationCount) * 100)}% quota savings

🎯 IMPROVEMENT: ${Math.floor(((operationCount - 1) / operationCount) * 100)}% API reduction + atomicity
`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 IMPLEMENTATION GUIDE

${
  operationType === 'read'
    ? `
**Step-by-Step: Convert to Batch Read**

1. Collect all ranges to read:
   ranges = ["Sheet1!A1:B10", "Sheet1!D1:E10", ...]

2. Single batch read call:
   sheets_data action="batch_read"
     spreadsheetId="${args['spreadsheetId']}"
     ranges=ranges

3. Process results:
   Response includes all range data in one object
   Access via response.valueRanges[i]

Example:
\`\`\`json
{
  "action": "batch_read",
  "spreadsheetId": "${args['spreadsheetId']}",
  "ranges": [
    "Sheet1!A1:B10",
    "Sheet1!D1:E10",
    "Sheet2!A1:Z100"
  ]
}
\`\`\`

Result: 1 API call instead of ${operationCount}!
`
    : operationType === 'write'
      ? `
**Step-by-Step: Convert to Transaction**

1. Begin Transaction:
\`\`\`json
{
  "tool": "sheets_transaction",
  "action": "begin",
  "spreadsheetId": "${args['spreadsheetId']}",
  "autoRollback": true
}
\`\`\`
→ Save transactionId from response

2. Queue Each Write:
\`\`\`json
{
  "tool": "sheets_transaction",
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_data",
    "action": "write",
    "params": {
      "spreadsheetId": "${args['spreadsheetId']}",
      "range": "A1:B10",
      "values": [[1, 2], [3, 4], ...]
    }
  }
}
\`\`\`
Repeat for all ${operationCount} writes

3. Commit Transaction:
\`\`\`json
{
  "tool": "sheets_transaction",
  "action": "commit",
  "transactionId": "tx_..."
}
\`\`\`

Done! All ${operationCount} writes in 1 API call with atomicity.
`
      : `
**Step-by-Step: Transaction for Mixed Operations**

1. Plan operations:
   • Group by dependency (reads before writes that use read data)
   • List all operations

2. Begin transaction:
   sheets_transaction action="begin"

3. Queue in order:
   For each operation:
     sheets_transaction action="queue" operation={...}

4. Commit:
   sheets_transaction action="commit"

5. Verify:
   Check response for success
   All operations executed atomically
`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 BEST PRACTICES

1. **Batch Size**: Aim for 10-100 operations per batch
   • Too small: Less efficiency gain
   • Too large: Longer request timeout risk

2. **Error Handling**: Transactions auto-rollback on failure
   • No partial state
   • Retry entire transaction

3. **Progress Tracking**: For large batches (>100 ops)
   • Break into multiple transactions
   • Commit after each batch
   • Track progress externally

4. **Testing**: Always test with small batch first
   • Verify operation ordering
   • Check data correctness
   • Then scale to full batch size

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 EXPECTED RESULTS

Before Optimization:
• API Calls: ${operationCount}
• Time: ~${(operationCount * 0.3).toFixed(1)}s
• Failure Risk: ${operationCount} points
• Quota Usage: ${operationCount} requests

After Optimization:
• API Calls: ${operationType === 'write' || operationType === 'mixed' ? '3 (1 effective)' : '1'}
• Time: ~0.5-1s
• Failure Risk: 1 point
• Quota Saved: ${Math.floor(((operationCount - (operationType === 'write' || operationType === 'mixed' ? 3 : 1)) / operationCount) * 100)}%

**Performance Gain: ${Math.floor(((operationCount - (operationType === 'write' || operationType === 'mixed' ? 3 : 1)) / operationCount) * 100)}% fewer API calls** ⚡

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to optimize! Convert your operations now. 🚀`,
            },
          },
        ],
      };
    }
  );

  // === ULTIMATE ANALYSIS TOOL PROMPTS (P2) ===

  server.registerPrompt(
    'ultimate_analysis',
    {
      description: '🧠 Ultimate Analysis Tool - Intelligent routing for data analysis',
      argsSchema: UltimateAnalysisPromptArgsSchema,
    },
    async (args: Record<string, unknown>) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🧠 Ultimate Analysis Tool

Spreadsheet: ${args['spreadsheetId']}

## 🎯 INTELLIGENT ROUTING

The analysis tool automatically selects the optimal execution path:

**Fast Path** (<10K cells)
• Traditional statistics
• Completes in <2s
• Best for: Quick summaries, small datasets

**AI Path** (10K-50K cells)
• LLM-powered insights via MCP Sampling
• Completes in <15s
• Best for: Deep insights, pattern detection, recommendations

**Streaming Path** (>50K cells)
• Task-based chunked processing
• Async execution with progress tracking
• Best for: Large datasets, comprehensive analysis

## 📊 USAGE

Basic Analysis:
\`\`\`json
{
  "tool": "sheets_analyze",
  "action": "analyze_data",
  "spreadsheetId": "${args['spreadsheetId']}",
  "analysisTypes": ["summary", "quality", "patterns"]
}
\`\`\`

The router will:
1. Fetch metadata (tier 1, ~0.3s)
2. Determine dataset size
3. Select optimal path (fast/AI/streaming)
4. Execute analysis
5. Store result as \`analyze://results/{id}\`

## 🔍 ANALYSIS TYPES

• **summary**: Overall data summary
• **patterns**: Pattern recognition
• **anomalies**: Outlier detection
• **trends**: Trend analysis
• **quality**: Data quality assessment
• **correlations**: Relationship discovery
• **recommendations**: Actionable suggestions

## 💡 TIPS

1. **Small datasets (<10K)**: Fast path is sufficient
2. **Medium datasets (10K-50K)**: AI path provides best insights
3. **Large datasets (>50K)**: Streaming path handles without timeout
4. **Follow-up analysis**: Reference previous results via \`analyze://results/{id}\`

Ready to analyze! What insights do you need? 🚀`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'create_visualization',
    {
      description: '📊 Create charts/pivots with AI recommendations and user confirmation',
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
  "tool": "sheets_analyze",
  "action": "create_recommended_chart",
  "spreadsheetId": "${args['spreadsheetId']}",
  "chartType": "LINE",
  "range": { "a1": "Sheet1!A1:D100" }
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
  "tool": "sheets_analyze",
  "action": "create_recommended_pivot",
  "spreadsheetId": "${args['spreadsheetId']}",
  "range": { "a1": "Data!A1:F1000" }
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
      description: '🔗 Reference previous analysis results via MCP Resources',
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
      description: '📊 Interactive data quality analysis tutorial',
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
              text: `# 📊 Data Quality Master Class - ${selectedLevel.toUpperCase()} Level

${
  selectedLevel === 'beginner'
    ? `
## Module 1: Understanding Quality Scores

### What is Data Quality?
Data quality measures how reliable and usable your spreadsheet data is. ServalSheets analyzes 15 different quality dimensions:

- **Completeness**: Are there missing values?
- **Consistency**: Do similar cells have similar formats?
- **Accuracy**: Are formulas error-free?
- **Validity**: Do values make sense in context?

### Quality Score Scale
- **90-100%**: Excellent (production-ready)
- **70-89%**: Good (minor issues)
- **50-69%**: Fair (needs attention)
- **Below 50%**: Poor (critical issues)

## Your First Analysis

**Step 1: Run a Scout Analysis**
\`\`\`
sheets_analyze action:"scout" spreadsheetId:"YOUR_ID"
\`\`\`

Scout mode is fast (~200ms) and gives you:
- Overall quality score
- Top 3 issues
- Recommended next steps

**Step 2: Interpret Results**
If quality < 80%, run:
\`\`\`
sheets_analyze action:"comprehensive" spreadsheetId:"YOUR_ID"
\`\`\`

This reveals:
- Detailed breakdown by issue type
- Cell-level examples
- Actionable fix suggestions
`
    : ''
}${
                selectedLevel === 'intermediate'
                  ? `
## Module 2: Advanced Quality Patterns

### Pattern Detection
Learn to identify common quality problems:

**Pattern 1: Mixed Data Types**
\`\`\`
Column A: [123, "456", 789, "N/A"]
Issue: Numbers mixed with text
Impact: SUM() fails, charts break
Fix: sheets_fix action:"fix_types"
\`\`\`

**Pattern 2: Inconsistent Formats**
\`\`\`
Date column: ["01/15/2024", "2024-01-16", "Jan 17, 2024"]
Issue: Multiple date formats
Impact: Sorting breaks, comparisons fail
Fix: sheets_fix action:"standardize_formats"
\`\`\`

**Pattern 3: Formula Errors**
\`\`\`
#REF! errors: Broken cell references
#DIV/0! errors: Division by zero
#N/A errors: VLOOKUP failures
\`\`\`

## Your Challenge

Run a comprehensive analysis and:
1. Identify the TOP issue by impact
2. Estimate fix time (use sheets_quality analyze_impact)
3. Create a fix plan with preview mode
4. Execute fixes
5. Re-analyze to verify improvement
`
                  : ''
              }${
                selectedLevel === 'advanced'
                  ? `
## Module 3: Quality Monitoring & Automation

### Building Quality Gates
Prevent quality degradation with automated checks:

**Strategy 1: Pre-write Validation**
\`\`\`
Before: sheets_data write
Run: sheets_quality validate
If quality drop > 15%: Alert user, cancel write
\`\`\`

**Strategy 2: Periodic Scout**
\`\`\`
sheets_session set_pending type:"quality_monitoring"
Every 10 operations: sheets_analyze scout
If quality < threshold: Trigger alert
\`\`\`

**Strategy 3: Historical Tracking**
\`\`\`
Store quality scores in sheets_session
Track quality trends over time
Alert if 3 consecutive drops
\`\`\`

## Production Pattern

Implement this workflow:
1. Baseline: Run comprehensive analysis at start
2. Monitor: Scout every 10-15 operations
3. Alert: Quality drop > 15% triggers warning
4. Fix: Auto-suggest fixes with preview
5. Verify: Re-analyze after fixes
6. Learn: Track patterns in quality changes

Try implementing this pattern on your spreadsheet!
`
                  : ''
              }${spreadsheetContext}

## 🎯 Common Mistakes to Avoid

1. **Ignoring low-impact issues**: Fix high-impact issues first
2. **Skipping preview mode**: Always preview fixes before applying
3. **Not re-analyzing**: Verify quality improved after fixes
4. **Treating all issues equally**: Prioritize by impact score

## 📚 Next Steps

- ${selectedLevel === 'beginner' ? 'Try Module 2 (intermediate level) when ready' : ''}
- ${selectedLevel === 'intermediate' ? 'Try Module 3 (advanced level) when ready' : ''}
- ${selectedLevel === 'advanced' ? 'Build a quality monitoring workflow' : ''}
- Practice on real spreadsheets
- Try challenge_quality_detective for a hands-on mystery

Ready to analyze some data! 🔍`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'masterclass_formulas',
    {
      description: '📐 Formula optimization workshop',
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
              text: `# 📐 Formula Optimization Workshop: ${selectedTopic.replace(/_/g, ' ').toUpperCase()}

${
  selectedTopic === 'performance'
    ? `
## Formula Performance Hierarchy

**Fastest → Slowest:**
1. ⚡ Static values (instant)
2. ⚡ Simple arithmetic (+, -, *, /)
3. ✅ Basic functions (SUM, AVERAGE, COUNT)
4. ✅ Lookup functions (VLOOKUP, INDEX/MATCH)
5. ⚠️ Array formulas (FILTER, SORT, UNIQUE)
6. 🐌 Volatile functions (NOW, TODAY, RAND)
7. 🐌 External data (IMPORTRANGE, GOOGLEFINANCE)
8. 🐌 Apps Script custom functions

## Example: Slow vs Fast

**Slow (500ms):**
\`\`\`
=ARRAYFORMULA(IF(A2:A1000<>"", VLOOKUP(A2:A1000, Sheet2!A:B, 2, FALSE), ""))
\`\`\`
Problem: ARRAYFORMULA evaluates row-by-row

**Fast (50ms):**
\`\`\`
=QUERY(Sheet2!A:B, "SELECT B WHERE A = '"&A2&"'")
\`\`\`
Why: QUERY is optimized by Google

## Your Challenge

Find a slow formula in your spreadsheet:
1. Use sheets_analyze analyze_performance
2. Identify formulas taking >100ms
3. Rewrite using QUERY or INDEX/MATCH
4. Measure improvement
`
    : ''
}${
                selectedTopic === 'array_formulas'
                  ? `
## Array Formula Best Practices

**When to Use Array Formulas:**
- ✅ Data changes frequently (auto-updates)
- ✅ Multiple conditions needed
- ✅ Result needs to expand dynamically
- ✅ Working with <10K rows

**When to Avoid:**
- ❌ >50K rows (use helper columns)
- ❌ Volatile functions inside (NOW, RAND)
- ❌ Complex nested logic (hard to debug)

## Optimization Examples

**Example 1: Conditional Formatting**
Slow:
\`\`\`
=ARRAYFORMULA(IF(B2:B>100, "High", IF(B2:B>50, "Medium", "Low")))
\`\`\`

Fast:
\`\`\`
=ARRAYFORMULA(IFS(B2:B>100, "High", B2:B>50, "Medium", B2:B>0, "Low", TRUE, ""))
\`\`\`
IFS is faster than nested IF

**Example 2: Lookup with Default**
Slow:
\`\`\`
=ARRAYFORMULA(IF(A2:A<>"", IFERROR(VLOOKUP(A2:A, Sheet2!A:B, 2, FALSE), "Not Found"), ""))
\`\`\`

Fast:
\`\`\`
=ARRAYFORMULA(IFNA(VLOOKUP(A2:A, Sheet2!A:B, 2, FALSE), "Not Found"))
\`\`\`
IFNA is faster than IFERROR for VLOOKUP
`
                  : ''
              }${
                selectedTopic === 'volatile_functions'
                  ? `
## Volatile Function Management

### The Problem
Volatile functions recalculate on EVERY sheet edit:
- NOW() - Current date/time
- TODAY() - Current date
- RAND() / RANDBETWEEN() - Random numbers
- INDIRECT() - Dynamic cell references

**Impact:** Slows down the ENTIRE sheet for ALL users

### The Solution

**Pattern 1: Centralize Volatility**
Bad:
\`\`\`
A1: =NOW()
A2: =NOW()
A3: =NOW()
\`\`\`
(Recalculates 3 times per edit)

Good:
\`\`\`
A1: =NOW()
A2: =A1
A3: =A1
\`\`\`
(Recalculates once per edit)

**Pattern 2: Named Range**
1. Create named range "CurrentDate" pointing to A1
2. Put =NOW() in A1
3. Use =CurrentDate everywhere else

**Pattern 3: Apps Script Alternative**
For time-based updates:
\`\`\`
sheets_appsscript action:"time_trigger"
  script: "Update timestamp cell every 5 minutes"
\`\`\`

## Your Task

Audit your spreadsheet:
1. sheets_analyze analyze_performance checkVolatility:true
2. Count volatile functions
3. Refactor if count >10
4. Measure before/after performance
`
                  : ''
              }${
                selectedTopic === 'lookup_optimization'
                  ? `
## Lookup Formula Optimization

### VLOOKUP vs INDEX/MATCH vs XLOOKUP

**VLOOKUP:**
- ✅ Simple syntax
- ✅ Fast for small data (<1K rows)
- ❌ Only searches left-to-right
- ❌ Breaks if columns change

**INDEX/MATCH:**
- ✅ Searches any direction
- ✅ Faster on large data (>10K rows)
- ✅ Flexible (doesn't break on column changes)
- ❌ More complex syntax

**XLOOKUP (newer):**
- ✅ Most powerful
- ✅ Best syntax
- ❌ Not available in all sheets

### Performance Comparison

**10K rows benchmark:**
- VLOOKUP: ~200ms
- INDEX/MATCH: ~50ms
- QUERY: ~30ms

## Examples

**VLOOKUP:**
\`\`\`
=VLOOKUP(A2, Sheet2!A:B, 2, FALSE)
\`\`\`

**INDEX/MATCH (4x faster):**
\`\`\`
=INDEX(Sheet2!B:B, MATCH(A2, Sheet2!A:A, 0))
\`\`\`

**QUERY (6x faster):**
\`\`\`
=QUERY(Sheet2!A:B, "SELECT B WHERE A = '"&A2&"'", 0)
\`\`\`

## Your Challenge

Convert VLOOKUPs to INDEX/MATCH:
1. Find VLOOKUPs: sheets_analyze audit_formulas
2. Rewrite top 5 slowest ones
3. Benchmark improvement
`
                  : ''
              }${
                selectedTopic === 'error_handling'
                  ? `
## Formula Error Handling

### Common Errors
- #REF! - Broken cell reference
- #DIV/0! - Division by zero
- #N/A - VLOOKUP/MATCH not found
- #VALUE! - Wrong data type
- #NAME? - Unknown function name

### Error Handling Strategies

**Strategy 1: IFERROR (Universal)**
\`\`\`
=IFERROR(formula, "fallback_value")
\`\`\`
Catches all errors, returns fallback

**Strategy 2: IFNA (Lookup-Specific)**
\`\`\`
=IFNA(VLOOKUP(...), "Not Found")
\`\`\`
Only catches #N/A, faster than IFERROR

**Strategy 3: IF + ISERROR (Conditional)**
\`\`\`
=IF(ISERROR(formula), "handle_error", formula)
\`\`\`
Different handling for error vs success

**Strategy 4: Defensive Formulas**
\`\`\`
=IF(B2=0, 0, A2/B2)  // Prevent #DIV/0!
=IF(ISBLANK(A2), "", VLOOKUP(...))  // Prevent #N/A
\`\`\`

## Best Practices

1. **Production formulas**: Always use error handling
2. **Debugging**: Remove error handling temporarily
3. **Performance**: Use IFNA for lookups (faster than IFERROR)
4. **User experience**: Return meaningful error messages

## Your Task

1. sheets_analyze audit_formulas
2. Find formulas without error handling
3. Add appropriate error handling
4. Test edge cases
`
                  : ''
              }

## 🎓 Pro Tips

- Use sheets_dependencies analyze_impact before changing formulas
- Test formulas on small data first
- Document complex formulas with comments
- Version control via sheets_collaborate snapshots

## 📚 Next Topics

${topic ? '- Try a different topic: performance, array_formulas, volatile_functions, lookup_optimization, error_handling' : '- Specify a topic to dive deeper'}

Ready to optimize! ⚡`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'masterclass_performance',
    {
      description: '⚡ Performance tuning lab',
      argsSchema: MasterClassPerformancePromptArgsSchema,
    },
    async ({ spreadsheetId, focusArea }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `# ⚡ Performance Tuning Lab

**Target Spreadsheet:** ${spreadsheetId}

## Step 1: Baseline Measurement

Let's measure current performance:

\`\`\`
sheets_analyze action:"analyze_performance"
  spreadsheetId:"${spreadsheetId}"
  checkFormulas:true
  checkVolatility:true
\`\`\`

This will report:
- Volatile function count
- Formula complexity scores
- Circular references
- Recommended optimizations

${
  focusArea === 'read_ops'
    ? `
## Focus: Read Operation Performance

### Symptoms
- Reads taking >2 seconds
- Timeout errors
- High latency on large ranges

### Diagnosis Tree

**Check 1: Range Size**
Reading >1K rows? → Use batch_read instead of multiple reads

**Check 2: Value Rendering**
Reading formatted values? → Use valueRenderOption: UNFORMATTED_VALUE (3x faster)

**Check 3: Multiple Sheets**
Reading from multiple sheets? → Use batch_get (parallel fetching)

**Check 4: Column Selection**
Need only specific columns? → Use column ranges (A:A, C:C) not full rows

### Optimization Examples

**Before (Slow - 5 API calls, ~2.5s):**
\`\`\`
for (let i = 0; i < 5; i++) {
  await sheets_data.read(range: \`Sheet\${i}!A1:Z100\`)
}
\`\`\`

**After (Fast - 1 API call, ~500ms):**
\`\`\`
sheets_data action:"batch_read"
  ranges:["Sheet0!A1:Z100", "Sheet1!A1:Z100", ..., "Sheet4!A1:Z100"]
\`\`\`

**Even Faster (1 API call, ~300ms):**
\`\`\`
sheets_data action:"batch_read"
  ranges:[...]
  valueRenderOption:"UNFORMATTED_VALUE"
\`\`\`

### Your Task
1. Identify slow reads in your usage
2. Convert to batch_read
3. Benchmark improvement
`
    : ''
}${
                focusArea === 'write_ops'
                  ? `
## Focus: Write Operation Performance

### Symptoms
- Writes taking >5 seconds
- Rate limit errors (429)
- High quota usage

### Diagnosis Tree

**Check 1: Write Count**
Writing <100 cells? → Direct sheets_data write (optimal)
Writing 100-1000 cells? → Use batch_write (70% faster)
Writing >1000 cells? → Use sheets_transaction (80% quota savings)

**Check 2: Formula Handling**
Writing formulas? → Set formulas separately (faster than mixed values)

### Quota Impact Comparison

**Naive Approach (500 individual writes):**
- API calls: 500
- Quota used: ~500 units
- Time: ~250 seconds (30 req/min rate limit)

**Transaction Approach:**
- API calls: 3 (begin, commit with 500 operations, end)
- Quota used: ~100 units (80% savings)
- Time: ~3 seconds

**Recommendation:** Use sheets_transaction for ANY sequential write >50 cells

### Your Task
1. Estimate your typical write volume
2. If >50 cells, switch to transactions
3. Measure quota and time savings
`
                  : ''
              }${
                focusArea === 'formulas'
                  ? `
## Focus: Formula Performance

### Symptoms
- Sheet freezes on edit
- "Calculating..." appears frequently
- Lag when typing

### Diagnosis Tree

**Check 1: Volatile Functions**
Count volatile functions (NOW, TODAY, RAND)
- If >10: Consolidate to 1 cell, reference elsewhere

**Check 2: Array Formulas**
ARRAYFORMULA on >10K rows?
- Replace with helper columns
- Or use QUERY instead

**Check 3: Circular References**
Check iterative calculation settings
- sheets_dependencies detect_cycles

**Check 4: External Data**
IMPORTRANGE or GOOGLEFINANCE?
- Cache results, refresh periodically
- Use sheets_appsscript for scheduled updates

**Check 5: Complex Nesting**
Formulas with >5 levels of nesting?
- Break into intermediate steps
- Use helper columns

### Detection Command

\`\`\`
sheets_analyze action:"analyze_performance"
  spreadsheetId:"${spreadsheetId}"
  checkFormulas:true
  checkVolatility:true
\`\`\`

Returns:
- volatileFunctionCount: (red flag if >10)
- circularReferences: []
- formulaComplexity: "high"
- recommendations: [...]

### Your Task
1. Run analysis command
2. Address top 3 recommendations
3. Re-analyze to verify improvement
`
                  : ''
              }${
                focusArea === 'concurrent_users'
                  ? `
## Focus: Concurrent User Performance

### Symptoms
- Multiple users editing causes lag
- Formula recalculation delays
- Save conflicts

### Diagnosis Tree

**Check 1: User Count**
>10 simultaneous editors? → Expect natural lag (Google limitation)

**Check 2: Protected Ranges**
Protected range count >50? → Reduce protection granularity

**Check 3: Real-time Formulas**
IMPORTRANGE or GOOGLEFINANCE in many cells?
- Replace with periodic refreshes (sheets_appsscript triggers)

**Check 4: Conditional Formatting**
Rules covering >100K cells? → Simplify rule scope

### Mitigation Pattern

**Instead of: Real-time IMPORTRANGE**
\`\`\`
=IMPORTRANGE("other-sheet", "A1:Z1000")
\`\`\`
(Recalculates on every edit)

**Use: Periodic refresh**
\`\`\`
sheets_appsscript action:"time_trigger"
  interval:"5 minutes"
  operation:"refresh_external_data"
\`\`\`
(Updates every 5 minutes)

### Your Task
1. Identify concurrent usage patterns
2. Implement periodic refresh for external data
3. Optimize protected ranges
4. Test with multiple users
`
                  : ''
              }

## Step 2: Apply Optimizations

Based on the analysis results, I'll guide you through each optimization with:
- Expected improvement (e.g., "40% faster", "70% quota savings")
- Implementation steps
- Before/after measurements

## Step 3: Verify Improvements

After optimizations:

\`\`\`
sheets_analyze action:"analyze_performance"
  spreadsheetId:"${spreadsheetId}"
  checkFormulas:true
  checkVolatility:true
\`\`\`

Compare:
- Operation times (should be 30-50% faster)
- Volatile function count (should be <10)
- Formula complexity (should be "low" or "medium")

## 🎯 Performance Targets

- Read operations: <500ms
- Write operations: <2s for <1000 cells
- Formula recalculation: <1s
- Volatile functions: <5 per sheet

## 📚 Next Steps

${focusArea ? '- Try another focus area: read_ops, write_ops, formulas, concurrent_users' : '- Specify a focus area for targeted optimization'}
- Implement monitoring (sheets_session alerts)
- Set up performance regression tests

Ready to optimize! Let me know which area you'd like to focus on first. ⚡`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'challenge_quality_detective',
    {
      description: '🔍 Diagnose data quality issues from symptoms',
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
sheets_fix action:"preview"
  spreadsheetId:"${spreadsheetId}"
  issueType:"mixed_types"
\`\`\`

See exact changes before applying

**Step 6: Execute Fixes**
\`\`\`
sheets_fix action:"fix_all"
  spreadsheetId:"${spreadsheetId}"
  preview:false
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
    'challenge_performance_profiler',
    {
      description: '⚡ Identify and fix performance bottlenecks',
      argsSchema: ChallengePerformanceProfilerPromptArgsSchema,
    },
    async ({ spreadsheetId }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `# ⚡ Performance Profiler Challenge

**Target Spreadsheet:** ${spreadsheetId}

## The Situation

Users are complaining that the spreadsheet is slow:
- Operations take >5 seconds
- Typing has noticeable lag
- Multiple users experience freezes

Your job: Profile, diagnose, and fix performance issues.

## Challenge Goal

**Target Improvements:**
- Reduce operation time by >40%
- Reduce formula recalculation time by >50%
- Achieve quality score >80%

**Time Limit:** 15 minutes

## Profiling Checklist

**⬜ Step 1: Baseline Measurement**
\`\`\`
sheets_analyze action:"analyze_performance"
  spreadsheetId:"${spreadsheetId}"
  checkFormulas:true
  checkVolatility:true
\`\`\`

Record:
- Current operation time: ___ms
- Volatile function count: ___
- Formula complexity: ___
- Quality score: ___%

**⬜ Step 2: Identify Top 3 Bottlenecks**

Analyze results and rank:
1. Bottleneck #1: ___ (estimated impact: __%)
2. Bottleneck #2: ___ (estimated impact: __%)
3. Bottleneck #3: ___ (estimated impact: __%)

Common bottlenecks:
- Too many volatile functions (NOW, RAND)
- Slow array formulas on large data
- IMPORTRANGE in many cells
- >50 protected ranges
- Complex nested formulas (>5 levels)

**⬜ Step 3: Propose Optimization Strategy**

For each bottleneck, propose:
- Specific optimization approach
- Expected improvement (%)
- Implementation complexity (low/medium/high)
- Tools needed (sheets_fix, sheets_advanced, sheets_appsscript)

**⬜ Step 4: Implement Optimizations**

Execute your strategy:
- Always preview before applying
- Implement highest-impact optimizations first
- Test after each change

**⬜ Step 5: Measure Improvements**

Re-run performance analysis:
\`\`\`
sheets_analyze action:"analyze_performance"
  spreadsheetId:"${spreadsheetId}"
  checkFormulas:true
  checkVolatility:true
\`\`\`

Calculate improvements:
- Operation time improvement: ___%
- Formula recalc improvement: ___%
- Quality improvement: ___pts

## Optimization Techniques

**Technique 1: Consolidate Volatile Functions**
Before: =NOW() in 50 cells
After: =NOW() in 1 cell, reference elsewhere
Improvement: ~98% reduction in recalculations

**Technique 2: Replace ARRAYFORMULA with QUERY**
Before: =ARRAYFORMULA(VLOOKUP(...))
After: =QUERY(...)
Improvement: ~6x faster

**Technique 3: Add Named Ranges**
Before: Direct cell references (break on column insert)
After: Named ranges (stable, faster lookup)
Improvement: ~20% faster formula evaluation

**Technique 4: Batch Operations**
Before: Multiple individual writes
After: sheets_transaction
Improvement: ~80% quota savings, ~90% time savings

**Technique 5: Helper Columns**
Before: Complex nested formulas
After: Intermediate calculations in helper columns
Improvement: ~50% faster, easier to debug

## Scoring

**Bonus Points:**
- >60% improvement across all metrics: +20 pts
- <3 operations to achieve goal: +10 pts
- Zero quality degradation: +5 pts

## 🎯 Profiler Tips

1. Use analyze_performance first (don't guess)
2. Focus on high-impact optimizations
3. Measure after EACH change (track progress)
4. Don't over-optimize (diminishing returns)
5. Balance performance vs maintainability

## 🚨 Common Pitfalls

- ❌ Optimizing low-impact areas
- ❌ Breaking formulas while optimizing
- ❌ Not testing after each change
- ❌ Over-complicating solutions

## Ready to Profile?

Run your baseline measurement and tell me what you find. I'll track your progress and reveal optimization opportunities.

Timer starts now! ⏱️`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'scenario_multi_user',
    {
      description: '👥 Resolve concurrent editing conflicts',
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
sheets_collaborate action:"create_snapshot"
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
sheets_confirm action:"require_confirmation"
  operation:"delete_rows"
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
sheets_appsscript action:"time_trigger"
  interval:"4 hours"
  operation:"create_snapshot"
  spreadsheetId:"${spreadsheetId}"
\`\`\`

**Pattern 2: Pre-Change Snapshot**
\`\`\`
# Before any major operation
sheets_collaborate action:"create_snapshot"
  description:"Before data import - \${new Date()}"

# Perform operation
sheets_data action:"write" ...

# Verify
sheets_analyze action:"scout"

# Rollback if needed
if (quality_dropped) {
  sheets_collaborate action:"restore_snapshot"
  snapshotId:"latest"
}
\`\`\`

**Pattern 3: Version Comparison**
\`\`\`
sheets_collaborate action:"compare_versions"
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
sheets_confirm action:"require_approval"
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
        '🔮 Auto-detect spreadsheet type and suggest best workflows, resources, and prompts',
      argsSchema: AutoAnalyzePromptArgsSchema,
    },
    async ({ spreadsheetId }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔮 Auto-Analyzing spreadsheet: ${spreadsheetId}

## Analysis Workflow

1. **Get Metadata**
   - sheets_core action "get" to retrieve spreadsheet metadata
   - Examine sheet names and structure

2. **Analyze Structure**
   - sheets_analyze action "analyze_structure" for detailed analysis
   - Identify column headers and data patterns

3. **Detect Spreadsheet Type**
   Based on detected patterns, classify as one of:
   - **Budget**: Has "income", "expense", "balance", "category" columns
   - **CRM**: Has "name", "email", "phone", "company", "deal" columns
   - **Inventory**: Has "SKU", "quantity", "price", "stock", "reorder" columns
   - **Project**: Has "task", "status", "due date", "assignee", "milestone" columns
   - **Sales**: Has "customer", "product", "amount", "date", "stage" columns
   - **Marketing**: Has "campaign", "channel", "spend", "impressions", "conversions" columns

## After Detection, Recommend

### Knowledge Resources
Based on the detected type, suggest the 3 most relevant:
- knowledge:// resources (templates, formulas, schemas)

### Best Prompts
Suggest prompts that match the spreadsheet type:
- For Budget: setup_budget, performance_audit
- For CRM: setup_collaboration, diagnose_errors
- For Inventory: bulk_import, transform_data
- For Project: create_report, setup_collaboration
- For Sales: create_visualization, performance_audit
- For Marketing: create_report, clean_data

### Optimal Tool Sequences
Provide a recommended workflow based on common patterns:
- Read → Analyze → Recommend → Apply

## Output Format

Provide your findings in this format:
1. **Detected Type**: [Type with confidence %]
2. **Key Columns**: [List of detected headers]
3. **Recommended Knowledge**: [3 resource URIs]
4. **Suggested Prompts**: [3 prompt names]
5. **Next Steps**: [Recommended action sequence]`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'full_setup',
    {
      description: '🚀 Complete spreadsheet setup: create, format, populate, and share',
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
              text: `🚀 Full Setup: Creating ${type.toUpperCase()} spreadsheet "${name}"

## 5-Step Workflow

### Step 1: Create Spreadsheet
- Use sheets_core action "create" with title "${name}"
- Remember the spreadsheetId for subsequent steps

### Step 2: Apply Template
- Read template from knowledge:///${knowledgePath}.json
- Use sheets_composite action "setup_sheet" with the schema
- This creates all necessary sheets and headers

### Step 3: Add Formulas
- Read formulas from knowledge:///${formulasPath}.json
- Apply relevant formulas to calculation columns
- Focus on:
  - Summary calculations
  - Conditional aggregations
  - Cross-reference lookups

### Step 4: Format
- Use sheets_format action "apply_preset" for headers
- Add conditional formatting for key metrics:
  - Green for positive values
  - Red for negative values
  - Yellow for warnings
- Auto-fit columns using sheets_dimensions

### Step 5: Share
- Collaborators: ${collaboratorList}
${
  collaborators?.length
    ? `- Use sheets_collaborate action "share_add" for each collaborator
- Set appropriate permissions based on role`
    : '- Skip sharing (no collaborators specified)'
}

## Safety Measures
- Use sheets_confirm before any destructive operations
- Create snapshot after setup complete using sheets_history action "create_snapshot"
- Verify all formulas work correctly

## Resources to Reference
- Template: knowledge:///${knowledgePath}.json
- Formulas: knowledge:///${formulasPath}.json
- Guide: servalsheets://guides/batching-strategies

Ready to execute this setup workflow? I'll guide you through each step.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'audit_security',
    {
      description: '🔒 Security and permissions audit for a spreadsheet',
      argsSchema: AuditSecurityPromptArgsSchema,
    },
    async ({ spreadsheetId }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔒 Security Audit for Spreadsheet: ${spreadsheetId}

## Audit Checklist

### 1. Permissions Review
- Use sheets_collaborate action "share_list" to get current permissions
- Analyze:
  - [ ] Who has Owner access?
  - [ ] Who has Editor access?
  - [ ] Who has Viewer access?
  - [ ] Are there any link-shared permissions?
  - [ ] Are there any domain-wide permissions?

### 2. Protection Analysis
- Use sheets_advanced action "protection_list" to check protections
- Review:
  - [ ] Which sheets are protected?
  - [ ] Which ranges are protected?
  - [ ] Who can edit protected areas?
  - [ ] Are there any unprotected sensitive areas?

### 3. Data Sensitivity Check
- Use sheets_analyze action "analyze_structure" for content analysis
- Flag potential PII:
  - [ ] Email addresses
  - [ ] Phone numbers
  - [ ] Social security numbers
  - [ ] Financial account numbers
  - [ ] Addresses

### 4. History and Audit Trail
- Use sheets_collaborate action "version_list" to check revision history
- Verify:
  - [ ] Is revision history enabled?
  - [ ] Who made recent changes?
  - [ ] Are there any suspicious modifications?

## Security Recommendations

Based on findings, suggest:
1. **Permission adjustments** (who should have access)
2. **Protection additions** (what should be protected)
3. **Data handling** (PII masking or removal)
4. **Audit improvements** (notification setup)

## Reference
- Guide: knowledge:///masterclass/security-compliance-master.json
- Patterns: servalsheets://decisions/tool-selection

Please proceed with this security audit and provide a comprehensive report.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'compare_spreadsheets',
    {
      description: '🔍 Compare and diff two spreadsheets',
      argsSchema: CompareSpreadsheetPromptArgsSchema,
    },
    async ({ spreadsheetId1, spreadsheetId2 }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `🔍 Comparing Spreadsheets

**Spreadsheet A:** ${spreadsheetId1}
**Spreadsheet B:** ${spreadsheetId2}

## Comparison Workflow

### Step 1: Get Metadata
- Use sheets_core action "get" on both spreadsheets
- Compare:
  - [ ] Spreadsheet titles
  - [ ] Sheet names and count
  - [ ] Last modified dates

### Step 2: Compare Structure
- Use sheets_analyze action "analyze_structure" on both
- Compare:
  - [ ] Column headers
  - [ ] Data types per column
  - [ ] Row counts
  - [ ] Named ranges

### Step 3: Compare Data
For each matching sheet:
- Use sheets_data action "batch_read" to get data ranges
- Compare:
  - [ ] Cell values (identify differences)
  - [ ] Formulas (identify formula changes)
  - [ ] Formatting differences (if visible)

### Step 4: Identify Differences

Output a comparison report:

\`\`\`
COMPARISON REPORT
=================

Structural Differences:
- Sheets only in A: [list]
- Sheets only in B: [list]
- Column differences: [details]

Data Differences:
- Modified cells: [count]
- Added rows: [count in A] vs [count in B]
- Deleted rows: [comparison]

Formula Changes:
- [Cell]: [Old Formula] → [New Formula]

Summary:
- Overall similarity: [percentage]
- Key changes: [summary]
\`\`\`

## Use Cases
- Version comparison (before/after changes)
- Template vs instance comparison
- Data migration validation
- Parallel edit reconciliation

Please proceed with this comparison and provide a detailed diff report.`,
            },
          },
        ],
      };
    }
  );
}
