import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getQualityResources(): TextResourceContents[] {
  return [
    {
      uri: 'quality://analysis',
      mimeType: 'text/plain',
      text: `Data Quality Analysis

Assesses data completeness, consistency, and accuracy.

Quality dimensions:

Completeness:
- Blank cells (count and percentage)
- Null values by column
- Required fields missing
- Score: 100% - (blanks / total)

Consistency:
- Format inconsistencies (dates, numbers, text)
- Type mismatches (text in number column)
- Case variations (same value, different cases)
- Whitespace inconsistencies (leading/trailing spaces)

Accuracy:
- Outliers (statistical anomalies)
- Invalid formats (email, phone, URL)
- Range violations (values outside expected)
- Logic errors (contradictions in data)

Uniqueness:
- Duplicate rows
- Duplicate within column
- Primary key violations
- Referential integrity issues

Validity:
- Email format validation
- Phone number format
- Date format and range
- Numeric range checks
- Custom validation rules

Quality score calculation:
- Weighted average of all dimensions
- 0-100% scale
- >90%: Excellent
- 70-90%: Good
- 50-70%: Needs work
- <50%: Critical issues

Recommendations:
- Specific issues identified
- Severity ranking (critical, high, medium, low)
- Actionable fixes provided
- Preview of fixes before applying`,
    },
  ];
}
