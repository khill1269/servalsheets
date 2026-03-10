---
title: Welcome to ServalSheets! 🎉
category: guide
last_updated: 2026-01-31
description: You've successfully installed ServalSheets. Here's how to get started in Claude Desktop.
version: 1.6.0
audience: user
difficulty: intermediate
---

# Welcome to ServalSheets! 🎉

You've successfully installed ServalSheets. Here's how to get started in Claude Desktop.

## Your First 5 Minutes

### Step 1: Restart Claude Desktop

1. Quit Claude Desktop completely (⌘+Q)
2. Reopen Claude Desktop
3. Look for the 🔨 icon in the bottom-right corner (custom ServalSheets icon may not appear yet)

### Step 2: Say Hello

Type this in Claude Desktop:

```
/welcome
```

This will give you an interactive introduction to ServalSheets showing you:

- What ServalSheets can do
- How to use it safely
- Tips for best results

### Step 3: Test Your Setup

Type:

```
/test_connection
```

This will verify your Google authentication is working by testing with a public spreadsheet.

### Step 4: Try Your First Operation

Type:

```
/first_operation
```

Claude will guide you through:

- Reading data from a spreadsheet
- Analyzing data quality
- Getting statistics
- Formatting cells (with safety preview!)

## What Are These `/` Commands?

These are called **prompts** - they're pre-built conversation starters that guide you through common tasks.

**Available prompts:**

- `/welcome` - Introduction and overview
- `/test_connection` - Verify setup works
- `/first_operation` - Guided first operation
- `/analyze_spreadsheet` - Analyze data quality
- `/clean_data` - Clean and standardize data
- `/transform_data` - Transform data safely
- `/create_report` - Generate formatted report

## Quick Examples

### Example 1: Read Data

```
Read cells A1:D10 from spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

### Example 2: Analyze Quality

```
Analyze the data quality in spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

### Example 3: Create a Chart

```
Create a bar chart from the data in spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
Show monthly sales from range A1:B12
```

## Safety Features 🛡️

ServalSheets is built with safety in mind:

- **Dry-run mode**: Preview changes before executing
- **Effect limits**: Prevent accidental large-scale changes
- **Auto-snapshots**: Automatic backups before destructive operations
- **Confirmation prompts**: Claude will ask before major changes

## Using Your Own Spreadsheets

### With Service Account

1. Open your Google Sheet
2. Click "Share"
3. Add your service account email (from your JSON file)
4. Grant "Editor" permission

### With OAuth Token

You automatically have access to your own spreadsheets!

## What Can ServalSheets Do?

### 📊 Data Operations

- Read and write cell values
- Batch operations for efficiency
- Find columns by header name (semantic ranges)

### 🔍 Analysis

- Data quality checks
- Statistics and correlations
- Formula auditing
- Duplicate detection

### 🎨 Formatting

- Cell formatting (colors, fonts, numbers)
- Conditional formatting rules
- Charts and visualizations

### 🚀 Advanced

- Version history and restore
- Sharing and permissions
- Comments and notes
- Named ranges and protection

## Need Help?

- **Stuck?** Type `/test_connection` to verify setup
- **Learning?** Type `/welcome` for overview
- **First time?** Type `/first_operation` for walkthrough
- **Logs:** `~/Library/Logs/Claude/mcp-server-servalsheets.log`

## Documentation

- `PROMPTS_GUIDE.md` - All available prompts
- `CLAUDE_DESKTOP_SETUP.md` - Detailed setup guide
- `README.md` - Full documentation
- `SKILL.md` - How Claude uses ServalSheets

## Test Spreadsheet

For testing, use this public spreadsheet:

- **ID**: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
- **URL**: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

## Pro Tips

1. **Start with prompts**: Use `/welcome`, `/test_connection`, and `/first_operation` to learn
2. **Be specific**: Include spreadsheet IDs and cell ranges
3. **Use dry-run**: Always preview destructive operations first
4. **Batch operations**: Ask Claude to do multiple things at once for efficiency
5. **Ask questions**: Claude will guide you through complex tasks

---

**Ready to start?**

Type `/welcome` in Claude Desktop to begin your ServalSheets journey! 🚀
