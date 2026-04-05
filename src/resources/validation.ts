import { ResourceContent } from '@modelcontextprotocol/sdk/types';

export function getValidationResources(): { uri: string; contents: ResourceContent }[] {
  return [
    {
      uri: 'validation://builtin-rules',
      contents: {
        mimeType: 'text/plain',
        text: `Built-in Validation Rules

Pre-configured validation rules for common scenarios.

Number validations:
- whole_number: Integer values only
- decimal: Any decimal number
- greater_than: X > threshold
- less_than: X < threshold
- between: min <= X <= max
- not_between: X < min or X > max
- equal_to: X == value
- not_equal_to: X != value

Text validations:
- text_length: String length constraints
- text_contains: Must contain substring
- text_not_contains: Must not contain substring
- text_starts_with: Begins with string
- text_ends_with: Ends with string
- text_is_email: Valid email format
- text_is_url: Valid URL format
- custom_formula: Formula-based validation

Date validations:
- date_is_valid: Valid date value
- date_on_or_after: >= date
- date_on_or_before: <= date
- date_between: date range
- date_is_today: Equals current date

List validations:
- list: Choose from dropdown list
- list_is_valid: Value in list
- list_is_range: Values from range

Checkbox validations:
- checkbox: Boolean true/false
- checkbox_is_checked: Must be true

Error messages:
- Customizable for each rule
- Clear description of requirement
- Suggestions for fix
- Hidden from casual users

Implementation:
- Native Google Sheets data validation
- Applied to cells or ranges
- Evaluated on data entry
- Prevents invalid submissions
- Optional "show warning" mode`
      },
    },
    {
      uri: 'validation://engine-stats',
      contents: {
        mimeType: 'text/plain',
        text: `Validation Engine Statistics

Validation rules in use:

Rule effectiveness:
- Total rules created: Tracked per sheet
- Rules triggered: How often violations occur
- Violations prevented: Estimated
- User frustration: Rules too strict?

Common violations:
- Most frequent rule type
- Most common invalid values
- Patterns in errors
- Seasonality in violations

Performance:
- Validation overhead: <1ms per cell
- Bulk validation time: <100ms per range
- Cache hit rate: 95%+ for common rules
- Memory usage: <1MB per 1000 rules

Compliance:
- Rules matching business requirements
- Updated rule tracking
- Deprecation of unused rules
- Audit trail of changes

Usability:
- Clear error messages
- Helpful suggestions
- Low false-positive rate
- User acceptance rate

Recommendations:
- Review low-compliance rules
- Tighten overly-lenient validation
- Update deprecated rules
- Add validation to new columns
- Test before deploying to production`
      },
    },
    {
      uri: 'validation://comprehensive-docs',
      contents: {
        mimeType: 'text/plain',
        text: `Validation Engine Documentation

Internal validation system.

ValidationEngine class:
- Manages validation rules
- Applies rules to ranges
- Tracks violations
- Provides recommendations

Validation flow:

1. Define rule
   - Rule type (number, text, date, list, etc.)
   - Criteria (bounds, patterns, lists)
   - Error message
   - Severity (error, warning, info)

2. Apply to range
   - Specify cells or ranges
   - Rule scope (single column, range, sheet)
   - Inheritance (cascades to new rows?)

3. Validate data
   - New data entry validated
   - Existing data checked on demand
   - Bulk validation for imports

4. Handle violations
   - Prevent invalid entry (error mode)
   - Warn but allow (warning mode)
   - Info only (suggestion mode)

5. Report
   - Violations per rule
   - Violations per cell
   - User impact
   - Compliance status

Builtin validators:
- NumberValidator: Range, whole, decimal checks
- TextValidator: Length, pattern, email, URL
- DateValidator: Valid date, range, today
- ListValidator: Dropdown, range-based
- CheckboxValidator: Boolean values
- CustomValidator: Formula-based

Custom rules:
- Formula-based validation
- Custom error logic
- Complex business rules
- Script-based validation

Performance:
- Lazy validation (on-demand)
- Cached rules
- Efficient range checking
- Minimal overhead

Audit:
- Rule change history
- Violation logs
- Compliance reports
- User feedback tracking`
      },
    },
  ];
}
