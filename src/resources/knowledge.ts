import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getKnowledgeResources(): TextResourceContents[] {
  return [
    {
      uri: 'knowledge://formula-library',
      mimeType: 'text/plain',
      text: `Formula Library

Common formulas for typical tasks.

Math & Statistics:
- SUM(range): Total of values
- AVERAGE(range): Mean value
- MEDIAN(range): Middle value
- STDEV(range): Standard deviation
- MIN/MAX(range): Smallest/largest
- COUNTIF(range, criteria): Conditional count
- SUMIF(range, criteria, sum_range): Conditional sum

Text:
- CONCATENATE(A1, " ", B1): Join text
- LEFT(text, 3): First 3 characters
- RIGHT(text, 3): Last 3 characters
- MID(text, 2, 3): Extract substring
- UPPER/LOWER(text): Change case
- TRIM(text): Remove whitespace
- SUBSTITUTE(text, old, new): Replace text

Date & Time:
- TODAY(): Current date
- NOW(): Current date & time
- DATE(2024, 3, 15): Specific date
- YEAR/MONTH/DAY(date): Extract parts
- DATEDIF(date1, date2, "D"): Days between
- EOMONTH(date, 0): Last day of month

Logic:
- IF(condition, true_val, false_val): Conditional
- AND(cond1, cond2): All must be true
- OR(cond1, cond2): Any can be true
- NOT(condition): Negation
- IFS(cond1, val1, cond2, val2, ...): Multiple conditions

Lookup:
- VLOOKUP(lookup, table, col, FALSE): Vertical lookup
- HLOOKUP(lookup, table, row, FALSE): Horizontal lookup
- INDEX(range, row, col): Get value by position
- MATCH(lookup, range, 0): Find position
- FILTER(range, criteria): Filter rows

Array:
- TRANSPOSE(range): Flip rows/columns
- FLATTEN(range1, range2, ...): Combine ranges
- UNIQUE(range): Remove duplicates
- SORT(range, col, ascending, ...): Sort data

Best practices:
- Use structured references when available
- Avoid volatile functions in large ranges
- Cache expensive calculations
- Use FILTER instead of VLOOKUP when possible
- Test formulas with edge cases`,
    },
    {
      uri: 'knowledge://data-cleaning',
      mimeType: 'text/plain',
      text: `Data Cleaning Patterns

Common data issues and fixes.

Whitespace issues:
- Leading/trailing spaces: TRIM()
- Extra spaces between words: SUBSTITUTE(text, "  ", " ")
- Newlines in cells: SUBSTITUTE(text, CHAR(10), " ")

Format inconsistencies:
- Mixed case text: Use PROPER() or UPPER()/LOWER()
- Phone numbers: Custom format or SUBSTITUTE()
- Dates in different formats: TEXT() function to standardize
- Currency symbols: SUBSTITUTE() to remove, then VALUE()

Type conversions:
- Text to number: VALUE() function
- Number to text: TEXT() function
- Date parsing: DATEVALUE() for text dates

Missing values:
- Identify: COUNTBLANK() to find empty cells
- Fill: Use forward/backward fill patterns
- Replace: IFERROR() with default values
- Analyze: FILTER() to exclude blanks

Duplicates:
- Identify: COUNTIF() for frequency analysis
- Remove: Use UNIQUE() function
- Deduplicate with criteria: Complex formula patterns

Outliers:
- Statistical detection: Z-score or IQR method
- Manual review: Filter to suspicious values
- Remove or flag: Conditional formatting for visibility

Inconsistent categories:
- Map values: SUBSTITUTE() or VLOOKUP() with mapping table
- Standardize: Consistent spelling and casing
- Validate: Data validation rules prevent future issues

Best practices:
- Preview changes with formulas before applying
- Keep original data, use adjacent columns for cleaning
- Document all transformations
- Validate results before committing`,
    },
    {
      uri: 'knowledge://analysis-workflow',
      mimeType: 'text/plain',
      text: `Analysis Workflow

Step-by-step process for understanding data.

1. Quick scan (scout)
   - Column types and names
   - Empty rate per column
   - Unique value counts
   - Overall structure
   - Time: ~200ms

2. Quality assessment (analyze_quality)
   - Data quality score (0-100%)
   - Issue detection (blanks, inconsistencies, outliers)
   - Issue severity ranking
   - Actionable recommendations
   - Time: ~1-2 seconds

3. Comprehensive analysis (comprehensive)
   - 43 feature categories analyzed
   - AI-powered insights
   - Pattern discovery
   - Trend analysis
   - Relationship detection
   - Time: ~10-30 seconds

4. Targeted deep-dive (drill_down)
   - Focus on specific finding
   - Detailed metrics
   - Related findings
   - Actionable suggestions
   - Time: ~5-10 seconds

5. Action generation
   - Convert findings to executable actions
   - Suggested formulas
   - Cleaning rules
   - Visualization recommendations
   - All with executable parameters

When to use each:
- scout: Quick understanding of any sheet
- analyze_quality: Data quality concerns
- comprehensive: Full understanding needed
- drill_down: Deep investigation of one finding
- (automatic): After any action, results tracked

Best practices:
- Start with scout for orientation
- Use comprehensive for unfamiliar data
- Act on quality issues immediately
- Track analysis history for learning
- Validate suggestions before executing`,
    },
    {
      uri: 'knowledge://performance-tuning',
      mimeType: 'text/plain',
      text: `Performance Optimization

Techniques for faster spreadsheets.

Formula optimization:
- Avoid VLOOKUP/HLOOKUP in large ranges
- Use INDEX/MATCH instead (faster)
- Cache expensive calculations in helper columns
- Avoid array formulas on entire columns
- Use FILTER instead of nested IFs when possible

Structural optimization:
- Remove unused columns (reduces API data)
- Archive old data to separate sheet
- Use named ranges for clarity and performance
- Split large sheets into logical sections
- Index important lookup columns

API call reduction:
- Batch reads together (parallel executor)
- Use field masks to fetch only needed data
- Enable caching (5-minute TTL default)
- Request deduplication (50ms window)
- Connection pooling for multiple calls

Recalculation optimization:
- Reduce dependency depth (fewer levels)
- Break circular references
- Use manual calculation mode for large sheets
- Enable adaptive calculation windows

Conditional formatting:
- Limit to frequently-checked ranges
- Use simple rules (better than complex formulas)
- Avoid overlapping conditional formatting rules

Filtering & sorting:
- Use filter views instead of manual sorting
- Index columns used frequently in filters
- Keep filter conditions simple

Monitoring:
- Use analyze_performance to find slow formulas
- Track API quota usage
- Monitor recalculation times
- Profile large operations`,
    },
    {
      uri: 'knowledge://mcp-features',
      mimeType: 'text/plain',
      text: `MCP Features

Model Context Protocol capabilities.

Sampling (AI analysis):
- Automatic data analysis
- Formula generation from description
- Chart recommendations
- Insight generation
- Quality assessment

Elicitation (interactive forms):
- Wizard-guided complex operations
- Chart creation workflow
- Conditional formatting builder
- Confirmation dialogs
- Form validation

Progress reporting:
- Real-time operation progress
- Percentage completion
- Step-by-step tracking
- Cancellation support

Resources (read-only access):
- Formula library
- Data cleaning patterns
- API health status
- Performance metrics
- Analysis statistics

Prompts (guided workflows):
- Data analysis workflows
- Cleaning step-by-step guides
- Formula writing templates
- Sheet organization patterns

Tasks (background operations):
- Long-running exports
- BigQuery operations
- Apps Script execution
- Time-travel operations

Completions:
- Spreadsheet ID autocompletion
- Range suggestion
- Formula hints`,
    },
  ];
}
