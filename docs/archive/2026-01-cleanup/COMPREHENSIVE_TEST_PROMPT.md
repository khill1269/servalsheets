---
title: 🧪 Comprehensive ServalSheets Test Prompt
category: archived
last_updated: 2026-01-31
description: Copy and paste this prompt into Claude to test all 21 tools and 267 actions.
tags: [testing]
---

# 🧪 Comprehensive ServalSheets Test Prompt

Copy and paste this prompt into Claude to test all 21 tools and 267 actions.

---

## Test Prompt for Claude

```
I need you to help me thoroughly test ServalSheets by exercising all 21 tools and their 267 actions. Please work through this comprehensive test plan:

## Phase 1: Authentication & Core Setup (sheets_auth, sheets_core)

1. Check authentication status
2. List all my spreadsheets
3. Create a new test spreadsheet called "ServalSheets Comprehensive Test"
4. Get information about the test spreadsheet
5. List all sheets in the spreadsheet

## Phase 2: Data Operations (sheets_data, sheets_composite)

6. Write data to range A1:E10 with test values (headers in row 1: Name, Age, Department, Salary, StartDate)
7. Add 5 rows of sample employee data
8. Read back the data from A1:E10 to verify
9. Append 3 more rows of data
10. Update cell C5 to "Engineering"
11. Clear range D8:D10
12. Use smart_append to add data intelligently
13. Use bulk_update to modify multiple ranges at once

## Phase 3: Formatting & Visualization (sheets_format, sheets_visualize)

14. Set header row (A1:E1) with bold font and blue background
15. Format salary column (D2:D10) as currency
16. Add borders around the data range
17. Freeze the header row
18. Suggest appropriate formatting for the data
19. Create a bar chart from the salary data
20. Suggest a visualization for age distribution
21. Create a pie chart showing department breakdown

## Phase 4: Dimensions & Structure (sheets_dimensions)

22. Insert a new column after B
23. Insert 2 new rows after row 5
24. Move column D to position B
25. Resize column widths to fit content
26. Hide columns F through Z
27. Group rows 3-8
28. Add sheet protection to prevent accidental edits
29. Create a new sheet named "Analysis"
30. Copy sheet structure to another sheet
31. Rename sheet to "Employee Data"
32. Set sheet tab color to green

## Phase 5: Advanced Operations (sheets_advanced)

33. Add a named range "EmployeeList" for the data range
34. Create a data validation rule for the Department column (dropdown: HR, Engineering, Sales)
35. Add conditional formatting to highlight salaries > 75000
36. Create a filter view for the data
37. Sort the data by Salary descending
38. Apply text rotation to headers
39. Merge cells A12:E12 for a summary section
40. Set up automatic row alternating colors
41. Add a checkbox column
42. Create a hyperlink in a cell

## Phase 6: Formulas & Analysis (sheets_analyze, sheets_dependencies)

43. Analyze the employee data comprehensively
44. Suggest formulas for calculating average salary
45. Add SUM formula for total salaries
46. Add AVERAGE formula for average age
47. Create COUNTIF formula for department counts
48. Build a dependency graph for the formulas
49. Analyze what cells would be affected if A2 changes
50. Detect any circular dependencies
51. Get dependency statistics

## Phase 7: Collaboration & Sharing (sheets_collaborate)

52. Add a comment to cell B5 about the data
53. Reply to the comment
54. Create a note in cell A1
55. Check current sharing permissions
56. Get spreadsheet metadata
57. Add a new sheet and configure tab color

## Phase 8: Quality & Validation (sheets_quality, sheets_fix)

58. Validate the data structure
59. Detect any conflicts in the spreadsheet
60. Check for quality issues
61. Analyze impact of potential changes
62. Suggest fixes for any detected issues
63. Apply recommended fixes

## Phase 9: History & Transactions (sheets_history, sheets_transaction)

64. Begin a transaction for multiple operations
65. Queue several operations in the transaction
66. Commit the transaction
67. View history of operations
68. Get statistics on operation history
69. Check for any failed operations

## Phase 10: Templates & BigQuery (sheets_templates, sheets_bigquery)

70. List available templates
71. Get details about a budget template
72. Apply a template to create a new sheet
73. Connect to a BigQuery dataset (if available)
74. Query BigQuery data into the sheet
75. Refresh connected data

## Phase 11: Apps Script & Webhooks (sheets_appsscript, sheets_webhooks)

76. List Apps Script projects
77. Get script content
78. Create a simple Apps Script function
79. Deploy the script
80. Register a webhook for spreadsheet changes
81. List active webhooks
82. Get webhook statistics

## Phase 12: Session & Confirmation (sheets_session, sheets_confirm)

83. Set the test spreadsheet as active
84. Get current session context
85. Store session preferences
86. Get confirmation statistics
87. Start a wizard for a complex operation
88. Complete the wizard

## Phase 13: Optimization & Performance Testing

89. Test batch operations with multiple simultaneous updates
90. Verify caching is working (repeat some read operations)
91. Test error handling (try invalid spreadsheet ID)
92. Test large data operations (if safe)
93. Verify schema validation caching
94. Check health monitoring status
95. Test trace context propagation

## Summary & Reporting

96. Generate a comprehensive analysis report
97. Check session statistics
98. Review any errors encountered
99. Verify all monitoring systems are working
100. Provide a final status report of all tests

Please work through these systematically, reporting success/failure for each step, and show me any interesting insights from the monitoring systems.
```

---

## Expected Monitoring Output

As Claude works through this, you should see in your monitor terminal:

### Real-time Tool Calls

```
[10:45:00] → sheets_auth.status
[10:45:00] ← ✓ sheets_auth.status (120ms)
[10:45:02] → sheets_core.list
[10:45:03] ← ✓ sheets_core.list (1.2s)
[10:45:05] → sheets_core.create
[10:45:06] ← ✓ sheets_core.create (890ms)
...
```

### Health Monitoring

```
[DEBUG] Health check passed: heap (4.2% usage)
[DEBUG] Health check passed: connection (active)
```

### Performance Tracking

- Slow calls highlighted (>2s)
- Average response times per tool
- Error rate tracking

### Final Report (Ctrl+C)

- Total tools called
- Actions executed
- Error breakdown
- Performance metrics
- Validation hot spots

---

## Alternative: Quick Smoke Test

If you want a faster test, use this shorter prompt:

```
Quick ServalSheets smoke test:

1. Check my auth status
2. List my spreadsheets
3. Create a test spreadsheet "Quick Test"
4. Write data to A1:C5
5. Format headers with bold and blue background
6. Create a chart from the data
7. Add a named range
8. Analyze the data
9. Check history
10. Get session context

Report any errors and show monitoring stats.
```

---

## Monitoring Commands Reference

While Claude is running:

- **View live monitor**: Already running in background (check terminal)
- **Check monitor output**: `cat /private/tmp/claude/-Users-thomascahill-Documents-mcp-servers-servalsheets/tasks/ba523cb.output`
- **Analyze existing logs**: Open another terminal and run `npm run monitor:stats`
- **Stop monitoring**: Find the monitor process and press Ctrl+C

---

## Success Criteria

By the end of testing:

✅ All 21 tools exercised
✅ 100+ actions executed successfully
✅ Health monitoring tracked all calls
✅ No critical errors in core operations
✅ Performance metrics within acceptable ranges
✅ Monitoring captures all activity
✅ Final report shows comprehensive test coverage

---

## Notes

- Some actions may require specific setup (like BigQuery connection)
- Some actions may be skipped if prerequisites aren't met
- The monitor will show errors clearly with error categories
- Health checks run every 30 seconds automatically
- Press Ctrl+C in monitor terminal anytime for full report
