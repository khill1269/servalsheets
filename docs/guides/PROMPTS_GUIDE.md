# ServalSheets Prompts Guide

ServalSheets includes **7 guided prompts** to help you get started and accomplish common tasks.

## 🎉 Onboarding Prompts

### `welcome`
**Your first introduction to ServalSheets**

Invoke with:
```
/welcome
```

What it shows:
- Overview of 15 tools and 156 actions
- Quick start with test spreadsheet
- What ServalSheets can do
- Safety features
- Tips for best results

Perfect for: First-time users, understanding capabilities

---

### `test_connection`
**Verify your ServalSheets setup**

Invoke with:
```
/test_connection
```

What it does:
- Tests connection with public spreadsheet
- Verifies all authentication is working
- Guides through 3 test operations
- Confirms you're ready to use your own sheets

Perfect for: After initial setup, troubleshooting connection issues

---

### `first_operation`
**Guided walkthrough of your first operation**

Invoke with:
```
/first_operation
```

Or with your own spreadsheet:
```
/first_operation spreadsheetId=YOUR_SPREADSHEET_ID
```

What it covers:
- Reading data
- Analyzing quality
- Getting statistics
- Formatting headers (with dry-run!)
- Safety best practices

Perfect for: Learning the workflow, understanding safety features

---

## 🔬 Analysis Prompts

### `analyze_spreadsheet`
**Comprehensive data quality and structure analysis**

Invoke with:
```
/analyze_spreadsheet spreadsheetId=YOUR_ID
```

What it analyzes:
- Metadata and structure
- Data quality (completeness, duplicates, consistency)
- Column data types
- Formula health
- Provides recommendations

Perfect for: Understanding unfamiliar spreadsheets, data quality audits

---

### `clean_data`
**Systematic data cleaning workflow**

Invoke with:
```
/clean_data spreadsheetId=YOUR_ID range=Sheet1!A1:Z100
```

What it does:
- Analyzes current data quality
- Creates cleaning plan
- Previews changes (dry-run)
- Gets your confirmation
- Executes cleaning with backups
- Validates improvements

Perfect for: Messy data, standardization, preparing data for analysis

---

## 🚀 Quick Start Prompts

### `transform_data`
**Safe data transformation with preview**

Invoke with:
```
/transform_data spreadsheetId=YOUR_ID range=Sheet1!A1:D100 transformation="convert dates to YYYY-MM-DD format"
```

What it does:
- Reads current data
- Plans transformation
- Shows preview (dry-run)
- Waits for your approval
- Executes with safety limits
- Verifies results

Perfect for: Format conversions, calculations, data restructuring

---

### `create_report`
**Generate formatted report from data**

Invoke with:
```
/create_report spreadsheetId=YOUR_ID
```

Or specify report type:
```
/create_report spreadsheetId=YOUR_ID reportType=charts
```

Report types:
- `summary` - Basic summary with statistics (default)
- `detailed` - Comprehensive report with multiple sections
- `charts` - Report with visualizations

What it creates:
- New "Report" sheet
- Summary statistics
- Professional formatting
- Charts (if requested)
- Auto-sized columns
- Frozen headers

Perfect for: Dashboards, presentations, stakeholder reports

---

## 💡 How to Use Prompts

### In Claude Desktop

Prompts appear in the prompt selector. Just type `/` and you'll see:

```
🎉 welcome - Get started with this guided introduction
🔍 test_connection - Test your connection
👶 first_operation - Your first operation walkthrough
🔬 analyze_spreadsheet - Comprehensive analysis
🧹 clean_data - Clean and standardize data
🔄 transform_data - Transform data safely
📈 create_report - Generate formatted report
```

### Example Conversations

**First Time User:**
```
You: /welcome
Claude: [Shows complete introduction to ServalSheets]

You: /test_connection
Claude: [Tests connection with public spreadsheet]

You: /first_operation
Claude: [Walks through first operation step-by-step]
```

**Data Analysis:**
```
You: /analyze_spreadsheet spreadsheetId=abc123
Claude: [Performs comprehensive analysis]

You: /clean_data spreadsheetId=abc123 range=Sheet1!A1:Z100
Claude: [Cleans data systematically with safety checks]
```

**Reporting:**
```
You: /create_report spreadsheetId=abc123 reportType=charts
Claude: [Creates professional report with charts]
```

## 🎯 Prompt Flow Recommendations

### For New Users:
1. `/welcome` - Understand what ServalSheets does
2. `/test_connection` - Verify setup works
3. `/first_operation` - Learn the workflow

### For Data Quality:
1. `/analyze_spreadsheet` - Identify issues
2. `/clean_data` - Fix the issues
3. `/analyze_spreadsheet` - Verify improvements

### For Reporting:
1. `/analyze_spreadsheet` - Understand the data
2. `/create_report` - Generate the report
3. Share or export the result

### For Data Transformation:
1. Read current data
2. `/transform_data` - Apply transformation safely
3. Verify results

## 🛡️ Safety Features in Prompts

All prompts emphasize safety:

- **Dry-run first**: Always preview destructive operations
- **Effect scope limits**: Prevent accidental large-scale changes
- **User confirmation**: Wait for approval before executing
- **Auto-snapshots**: Create backups before changes
- **Expected state validation**: Ensure data hasn't changed

## 📚 Learn More

- **Full Documentation**: `README.md`
- **For Claude**: `SKILL.md` - How Claude should use ServalSheets
- **Setup Guide**: `CLAUDE_DESKTOP_SETUP.md`
- **Local Testing**: `LOCAL_TESTING.md`

## 🆘 Need Help?

If prompts aren't working:

1. **Check connection**: `/test_connection`
2. **View logs**: `~/Library/Logs/Claude/mcp-server-servalsheets.log`
3. **Verify setup**: `CLAUDE_DESKTOP_SETUP.md`
4. **Test manually**: Try a direct tool call

## 🎨 Customizing Prompts

Want to create your own prompts? See:
- `src/mcp/prompts.ts` - Prompt definitions (arguments defined as plain objects)
- `src/mcp/registration.ts` - Prompt registration
- [MCP Prompts Docs](https://modelcontextprotocol.io/docs/prompts)

---

**Quick Reference:**

| Prompt | Purpose | Parameters |
|--------|---------|------------|
| `welcome` | Introduction | None |
| `test_connection` | Verify setup | None |
| `first_operation` | Guided walkthrough | `spreadsheetId` (optional) |
| `analyze_spreadsheet` | Comprehensive analysis | `spreadsheetId` (required) |
| `clean_data` | Data cleaning | `spreadsheetId`, `range` (required) |
| `transform_data` | Data transformation | `spreadsheetId`, `range`, `transformation` (required) |
| `create_report` | Report generation | `spreadsheetId` (required), `reportType` (optional) |

**Test Spreadsheet ID:** `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
