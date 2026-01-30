/**
 * ServalSheets - Prompt Registration
 *
 * Guided workflows and templates for common operations.
 *
 * @module mcp/registration/prompt-registration
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
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

I'm your Google Sheets assistant with 21 powerful tools and 272 actions.

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

Run comprehensive analysis:
1. Metadata: sheets_core action "get"
2. Data Quality: sheets_analyze action "analyze_quality"
3. Structure: sheets_analyze action "analyze_structure"
4. Formula Audit: sheets_analyze action "analyze_formulas"
5. AI Insights: sheets_analyze action "analyze_data" (uses MCP Sampling)

Provide: quality score, issues found, recommended fixes.`,
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

Phases:
1. Analysis: Run data quality check + AI analysis (sheets_analyze)
2. Plan: Identify duplicates, empty cells, format issues
3. Confirm: Present plan to user (sheets_confirm via Elicitation)
4. Execute: Apply with auto-snapshot
5. Validate: Compare before/after`,
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

Budget Setup:
1. Create structure:
   - Income sheet: Categories, amounts, dates
   - Expenses sheet: Categories, amounts, dates
   - Summary sheet: Totals, remaining, charts

2. Add formulas:
   - SUMIF for category totals
   - Date filters for monthly/yearly views
   - Remaining budget calculations

3. Format cells:
   - Currency format for amounts
   - Conditional formatting: red for overspent
   - Freeze headers

4. Add charts:
   - Pie chart: Expense breakdown
   - Line chart: Monthly trends
   - Use sheets_analyze to suggest optimal chart types

5. Setup validation:
   - Dropdowns for categories
   - Date validation
   - Positive number validation for income

Final: Apply professional formatting, add instructions sheet.`,
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
      argsSchema: {
        errorCode: z.string().describe('The error code from the failed operation'),
        errorMessage: z.string().optional().describe('The full error message'),
        toolName: z.string().optional().describe('The tool that failed (e.g., sheets_data)'),
        context: z.string().optional().describe('What you were trying to do'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('The spreadsheet ID'),
        operation: z.string().optional().describe('What operation was slow'),
        responseTime: z.number().optional().describe('How long it took (ms)'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('The spreadsheet ID'),
        range: z.string().describe('Range to analyze'),
        issues: z.string().optional().describe('Known issues'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('The spreadsheet ID'),
        range: z.string().optional().describe('Range with slow formulas'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('Target spreadsheet ID'),
        dataSize: z.number().optional().describe('Approximate row count'),
        dataSource: z.string().optional().describe('Source description'),
      },
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
      argsSchema: {
        sourceSpreadsheetId: z.string().describe('Source spreadsheet ID'),
        targetSpreadsheetId: z.string().describe('Target spreadsheet ID'),
        migrationType: z
          .enum(['full', 'incremental', 'selective'])
          .optional()
          .describe('Migration type: full, incremental, or selective'),
        transformations: z.string().optional().describe('Data transformations to apply'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('Spreadsheet ID to audit'),
        focusAreas: z
          .array(z.string())
          .optional()
          .describe('Focus areas: formulas, data_size, api_usage, caching, structure'),
      },
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
      argsSchema: {
        operationType: z
          .enum(['read', 'write', 'update', 'format', 'mixed'])
          .describe('Type of operations to optimize'),
        operationCount: z.number().optional().describe('Number of individual operations'),
        spreadsheetId: z.string().describe('Spreadsheet ID'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('Spreadsheet ID from URL (required)'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('Spreadsheet ID from URL (required)'),
      },
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
      argsSchema: {
        spreadsheetId: z.string().describe('Spreadsheet ID from URL (required)'),
      },
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
}
