# BigQuery Connected Sheets Gap Audit (ISSUE-199)

Date: 2026-02-27
Scope: compare current `sheets_bigquery` surface against Google Sheets `DataSourceTable`-family capabilities.

## Current ServalSheets Coverage

Implemented actions in [`src/schemas/bigquery.ts`](../../src/schemas/bigquery.ts):

- `connect`
- `disconnect`
- `get_connection`
- `query`
- `preview`
- `refresh`
- `list_datasets`
- `list_tables`
- `get_table_schema`
- `export_to_bigquery`
- `import_from_bigquery`
- `list_scheduled_queries`
- `create_scheduled_query`
- `update_scheduled_query`
- `delete_scheduled_query`
- `trigger_scheduled_query`
- `get_scheduled_query_status`

These cover:

- connection lifecycle for BigQuery-backed sheets
- query execution / preview / refresh
- dataset/table discovery
- scheduled query workflows

## DataSourceTable-Specific Gap List

The following Connected Sheets-native objects are not first-class actions yet:

1. `DataSourceTable` create/update/delete primitives (beyond high-level `connect` + `refresh`)
2. `DataSourcePivotTable` lifecycle controls
3. `DataSourceChart` lifecycle controls
4. explicit `DataExecutionStatus` polling as a top-level API (RUNNING/SUCCEEDED/FAILED)
5. datasource formula management surface (`DataSourceFormula`) for advanced query lifecycles

## Risk / Impact

- Current API works for common BigQuery workflows, but advanced Connected Sheets administration still requires manual Google Sheets UI or custom API scripts.
- Gaps are feature-parity gaps, not correctness/security blockers.

## Recommended Remediation Plan

1. Add `datasource_get_status` and `datasource_refresh` detail actions (low-risk read/refresh expansion).
2. Add `datasource_table_create` / `datasource_table_update` behind feature flag.
3. Add pivot/chart datasource actions after schema and response contracts stabilize.
4. Re-run schema alignment + handler tests and add live API validations for new datasource actions.

## Verification Evidence

- Action inventory verified from `src/schemas/bigquery.ts` literals.
- Handler parity confirmed in `src/handlers/bigquery.ts` switch/action handling.
