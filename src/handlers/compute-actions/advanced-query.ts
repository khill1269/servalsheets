/**
 * Advanced Query Action Handlers
 *
 * Actions: sql_query, sql_join, python_eval, pandas_profile, sklearn_model, matplotlib_chart
 */

import { ErrorCodes } from '../error-codes.js';
import { ServiceError } from '../../core/errors.js';
import { extractRangeA1 } from '../../utils/range-helpers.js';
import { fetchRangeData } from '../../services/compute-engine.js';
import { runPythonSafe } from '../../services/python-engine.js';
import { logger } from '../../utils/logger.js';
import type { SheetsComputeInput, SheetsComputeOutput } from '../../schemas/compute.js';
import type { ComputeHandlerAccess } from './internal.js';

// ============================================================================
// SQL Handlers (DuckDB)
// ============================================================================

export async function handleSqlQuery(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'sql_query' }
): Promise<SheetsComputeOutput> {
  if (!access.duckdbEngine) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'DuckDB engine not available — pass duckdbEngine in ComputeHandler options',
          retryable: false,
        },
      },
    };
  }

  const tableData: Array<{
    name: string;
    range: string;
    hasHeaders: boolean;
    rows: unknown[][];
  }> = [];

  for (const table of req.tables) {
    const rows = await fetchRangeData(
      access.sheetsApi,
      req.spreadsheetId,
      extractRangeA1(table.range)
    );
    tableData.push({
      name: table.name,
      range: extractRangeA1(table.range),
      hasHeaders: table.hasHeaders,
      rows,
    });
  }

  try {
    const result = await access.duckdbEngine.query({
      tables: tableData,
      sql: req.sql,
      timeoutMs: req.timeoutMs,
    });

    return {
      response: {
        success: true as const,
        action: 'sql_query',
        sqlColumns: result.columns,
        sqlRows: result.rows,
        sqlExecutionMs: result.executionMs,
        rowsReturned: result.rows.length,
      },
    };
  } catch (err) {
    const code =
      err instanceof ServiceError && err.code === ErrorCodes.QUERY_REJECTED
        ? ErrorCodes.QUERY_REJECTED
        : ErrorCodes.INTERNAL_ERROR;
    return {
      response: {
        success: false as const,
        error: {
          code,
          message: err instanceof Error ? err.message : 'DuckDB sql_query failed',
          retryable: false,
        },
      },
    };
  }
}

export async function handleSqlJoin(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'sql_join' }
): Promise<SheetsComputeOutput> {
  if (!access.duckdbEngine) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'DuckDB engine not available — pass duckdbEngine in ComputeHandler options',
          retryable: false,
        },
      },
    };
  }

  const leftRows = await fetchRangeData(
    access.sheetsApi,
    req.spreadsheetId,
    extractRangeA1(req.left.range)
  );
  const rightRows = await fetchRangeData(
    access.sheetsApi,
    req.spreadsheetId,
    extractRangeA1(req.right.range)
  );

  const select = req.select ?? '*';
  const sql = `SELECT ${select} FROM "${req.left.alias}" ${req.joinType.toUpperCase()} JOIN "${req.right.alias}" ON ${req.on}`;

  try {
    const result = await access.duckdbEngine.query({
      tables: [
        {
          name: req.left.alias,
          range: extractRangeA1(req.left.range),
          hasHeaders: true,
          rows: leftRows,
        },
        {
          name: req.right.alias,
          range: extractRangeA1(req.right.range),
          hasHeaders: true,
          rows: rightRows,
        },
      ],
      sql,
      timeoutMs: req.timeoutMs,
    });

    return {
      response: {
        success: true as const,
        action: 'sql_join',
        sqlColumns: result.columns,
        sqlRows: result.rows,
        sqlExecutionMs: result.executionMs,
        rowsReturned: result.rows.length,
      },
    };
  } catch (err) {
    const code =
      err instanceof ServiceError && err.code === ErrorCodes.QUERY_REJECTED
        ? ErrorCodes.QUERY_REJECTED
        : ErrorCodes.INTERNAL_ERROR;
    return {
      response: {
        success: false as const,
        error: {
          code,
          message: err instanceof Error ? err.message : 'DuckDB sql_join failed',
          retryable: false,
        },
      },
    };
  }
}

// ============================================================================
// Python Handlers (Pyodide)
// ============================================================================

export async function handlePythonEval(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'python_eval' }
): Promise<SheetsComputeOutput> {
  try {
    const rows = await fetchRangeData(
      access.sheetsApi,
      req.spreadsheetId,
      extractRangeA1(req.range)
    );

    // Make data available as both `data` (raw list-of-lists) and `df` (DataFrame)
    const dfCode =
      req.hasHeaders !== false && rows.length > 1
        ? `
import pandas as pd
_headers = data[0] if data else []
_datarows = data[1:] if data else []
df = pd.DataFrame(_datarows, columns=_headers)
df = df.apply(pd.to_numeric, errors='ignore')
`
        : '';

    const fullCode = dfCode
      ? `${dfCode}
${req.code}`
      : req.code;

    const pyResult = await runPythonSafe(fullCode, { data: rows }, req.timeoutMs ?? 60000);

    return {
      response: {
        success: true as const,
        action: 'python_eval',
        pythonResult: pyResult.result,
        pythonOutput: pyResult.output,
        pythonExecutionMs: pyResult.executionMs,
      },
    };
  } catch (err) {
    logger.error('Python eval error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : 'Python execution failed',
          retryable: false,
        },
      },
    };
  }
}

export async function handlePandasProfile(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'pandas_profile' }
): Promise<SheetsComputeOutput> {
  try {
    const rows = await fetchRangeData(
      access.sheetsApi,
      req.spreadsheetId,
      extractRangeA1(req.range)
    );
    const hasHeaders = req.hasHeaders !== false;
    const includeCorrelations = req.includeCorrelations !== false;

    // BUG-20 fix: Support optional columns filter
    const columnFilter = (req as Record<string, unknown>)['columns'] as string[] | undefined;
    const columnFilterPy = columnFilter ? JSON.stringify(columnFilter) : 'None';

    const code = `
import pandas as pd
import json

rows = data
if len(rows) < 2:
    result = {'stats': {}, 'correlations': {}}
else:
    headers = rows[0] if ${hasHeaders ? 'True' : 'False'} else [f'col{i}' for i in range(len(rows[0]))]
    data_rows = rows[1:] if ${hasHeaders ? 'True' : 'False'} else rows
    df = pd.DataFrame(data_rows, columns=headers)
    df = df.apply(pd.to_numeric, errors='ignore')

    # Filter to requested columns if specified
    _col_filter = ${columnFilterPy}
    if _col_filter is not None:
        _valid_cols = [c for c in _col_filter if c in df.columns]
        if _valid_cols:
            df = df[_valid_cols]

    stats = {}
    for col in df.columns:
        s = df[col]
        if pd.api.types.is_numeric_dtype(s):
            stats[col] = {
                'type': 'numeric',
                'count': int(s.count()),
                'mean': float(s.mean()) if not pd.isna(s.mean()) else None,
                'std': float(s.std()) if not pd.isna(s.std()) else None,
                'min': float(s.min()) if not pd.isna(s.min()) else None,
                'max': float(s.max()) if not pd.isna(s.max()) else None,
                'median': float(s.median()) if not pd.isna(s.median()) else None,
                'null_count': int(s.isna().sum()),
            }
        else:
            vc = s.value_counts()
            stats[col] = {
                'type': 'categorical',
                'count': int(s.count()),
                'unique': int(s.nunique()),
                'top': str(vc.index[0]) if len(vc) > 0 else None,
                'top_freq': int(vc.iloc[0]) if len(vc) > 0 else 0,
                'null_count': int(s.isna().sum()),
            }

    corr = {}
    numeric_cols = df.select_dtypes(include='number')
    if ${includeCorrelations ? 'True' : 'False'} and len(numeric_cols.columns) > 1:
        corr_df = numeric_cols.corr()
        corr = {col: {c: float(v) if not pd.isna(v) else None for c, v in row.items()} for col, row in corr_df.to_dict().items()}

    result = {'stats': stats, 'correlations': corr}

result
`;

    const pyResult = await runPythonSafe(code, { data: rows }, 120000);
    const res = pyResult.result as { stats?: unknown; correlations?: unknown } | null;

    // Filter out non-numeric correlation values (null, strings, etc.)
    const rawCorr = (res?.correlations ?? {}) as Record<string, Record<string, unknown>>;
    const correlations: Record<string, Record<string, number>> = {};
    for (const [row, cols] of Object.entries(rawCorr)) {
      const filteredCols: Record<string, number> = {};
      for (const [col, val] of Object.entries(cols)) {
        if (typeof val === 'number' && Number.isFinite(val)) {
          filteredCols[col] = val;
        }
      }
      if (Object.keys(filteredCols).length > 0) {
        correlations[row] = filteredCols;
      }
    }

    return {
      response: {
        success: true as const,
        action: 'pandas_profile',
        profileStats: (res?.stats ?? {}) as Record<string, unknown>,
        correlations,
        pythonExecutionMs: pyResult.executionMs,
      },
    };
  } catch (err) {
    logger.error('Pandas profile error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : 'Pandas profiling failed',
          retryable: false,
        },
      },
    };
  }
}

export async function handleSklearnModel(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'sklearn_model' }
): Promise<SheetsComputeOutput> {
  try {
    const rows = await fetchRangeData(
      access.sheetsApi,
      req.spreadsheetId,
      extractRangeA1(req.range)
    );

    const targetColumn = req.targetColumn;
    const featureColumns = req.featureColumns ?? null;
    const modelType = req.modelType;
    const testSize = req.testSize ?? 0.2;

    const code = `
import pandas as pd
import numpy as np
import json

rows = data
if len(rows) < 3:
    result = {'error': 'Not enough data for modeling (need at least 3 rows)'}
else:
    headers = rows[0]
    data_rows = rows[1:]
    df = pd.DataFrame(data_rows, columns=headers)
    df = df.apply(pd.to_numeric, errors='ignore')

    target_col = "${targetColumn}"
    if target_col not in df.columns:
        result = {'error': f'Target column "{target_col}" not found. Available: {list(df.columns)}'}
    else:
        feature_cols = ${featureColumns ? JSON.stringify(featureColumns) : 'None'}
        if feature_cols is None:
            feature_cols = [c for c in df.columns if c != target_col]

        feature_cols = [c for c in feature_cols if c in df.columns]
        X = df[feature_cols].select_dtypes(include='number')
        y = df[target_col]

        # Drop rows with NaN
        mask = X.notna().all(axis=1) & y.notna()
        X = X[mask]
        y = y[mask]

        if len(X) < 4:
            result = {'error': 'Not enough complete rows after dropping NaN values'}
        else:
            from sklearn.model_selection import train_test_split

            test_size_val = ${testSize}
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size_val, random_state=42)

            model_type = "${modelType}"
            metrics = {}
            importances = {}

            if model_type == 'linear_regression':
                from sklearn.linear_model import LinearRegression
                from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
                model = LinearRegression()
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                metrics['r2'] = float(r2_score(y_test, y_pred))
                metrics['mse'] = float(mean_squared_error(y_test, y_pred))
                metrics['mae'] = float(mean_absolute_error(y_test, y_pred))
                for col, coef in zip(X.columns, model.coef_):
                    importances[col] = float(abs(coef))

            elif model_type == 'ridge':
                from sklearn.linear_model import Ridge
                from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
                model = Ridge()
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                metrics['r2'] = float(r2_score(y_test, y_pred))
                metrics['mse'] = float(mean_squared_error(y_test, y_pred))
                metrics['mae'] = float(mean_absolute_error(y_test, y_pred))
                for col, coef in zip(X.columns, model.coef_):
                    importances[col] = float(abs(coef))

            elif model_type == 'logistic_regression':
                from sklearn.linear_model import LogisticRegression
                from sklearn.metrics import accuracy_score
                model = LogisticRegression(max_iter=1000)
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                metrics['accuracy'] = float(accuracy_score(y_test, y_pred))

            elif model_type == 'random_forest':
                from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
                from sklearn.metrics import accuracy_score, r2_score
                # Heuristic: use classifier for low-cardinality targets, regressor otherwise
                y_numeric = pd.to_numeric(y, errors='coerce')
                if y_numeric.isna().any() or y.nunique() <= 10:
                    model = RandomForestClassifier(n_estimators=100, random_state=42)
                    model.fit(X_train, y_train)
                    y_pred = model.predict(X_test)
                    metrics['accuracy'] = float(accuracy_score(y_test, y_pred))
                else:
                    model = RandomForestRegressor(n_estimators=100, random_state=42)
                    model.fit(X_train, y_train)
                    y_pred = model.predict(X_test)
                    metrics['r2'] = float(r2_score(y_test, y_pred))
                for col, imp in zip(X.columns, model.feature_importances_):
                    importances[col] = float(imp)

            elif model_type == 'kmeans':
                from sklearn.cluster import KMeans
                k = min(5, len(X) // 2)
                model = KMeans(n_clusters=k, random_state=42, n_init='auto')
                model.fit(X)
                metrics['inertia'] = float(model.inertia_)
                metrics['clusters'] = k

            result = {
                'metrics': metrics,
                'feature_importances': importances,
                'feature_columns': list(X.columns),
                'samples_train': len(X_train),
                'samples_test': len(X_test),
            }

result
`;

    const pyResult = await runPythonSafe(code, { data: rows }, 120000);
    const res = pyResult.result as {
      metrics?: Record<string, number>;
      feature_importances?: Record<string, number>;
      error?: string;
    } | null;

    if (res?.error) {
      return {
        response: {
          success: false as const,
          error: { code: ErrorCodes.INVALID_PARAMS, message: res.error, retryable: false },
        },
      };
    }

    return {
      response: {
        success: true as const,
        action: 'sklearn_model',
        modelMetrics: res?.metrics as {
          accuracy?: number;
          r2?: number;
          mse?: number;
          mae?: number;
        },
        featureImportances: res?.feature_importances,
        pythonExecutionMs: pyResult.executionMs,
      },
    };
  } catch (err) {
    logger.error('Sklearn model error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : 'Model training failed',
          retryable: false,
        },
      },
    };
  }
}

export async function handleMatplotlibChart(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'matplotlib_chart' }
): Promise<SheetsComputeOutput> {
  try {
    const rows = await fetchRangeData(
      access.sheetsApi,
      req.spreadsheetId,
      extractRangeA1(req.range)
    );

    const chartType = req.chartType;
    const xColumn = req.xColumn ?? null;
    const yColumns = req.yColumns ?? null;
    const title = req.title ?? '';
    const width = req.width ?? 800;
    const height = req.height ?? 600;

    const code = `
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # non-interactive backend
import matplotlib.pyplot as plt
import io, base64

rows = data
if len(rows) < 2:
    result = {'error': 'Not enough data'}
else:
    headers = rows[0]
    data_rows = rows[1:]
    df = pd.DataFrame(data_rows, columns=headers)
    df = df.apply(pd.to_numeric, errors='ignore')

    dpi = 96
    fig_w = ${width} / dpi
    fig_h = ${height} / dpi
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=dpi)

    chart_type = "${chartType}"
    x_col = ${xColumn ? `"${xColumn}"` : 'None'}
    y_cols_raw = ${yColumns ? JSON.stringify(yColumns) : 'None'}
    y_cols = [c for c in (y_cols_raw or []) if c in df.columns] or list(df.select_dtypes(include='number').columns)
    title_str = "${title.replace(/"/g, '\\"')}"

    if chart_type == 'line':
        for col in y_cols:
            if x_col and x_col in df.columns:
                ax.plot(df[x_col], df[col], label=col)
            else:
                ax.plot(df[col], label=col)
        if len(y_cols) > 1:
            ax.legend()

    elif chart_type == 'bar':
        if x_col and x_col in df.columns:
            for col in y_cols:
                ax.bar(df[x_col], df[col], label=col, alpha=0.7)
        else:
            for col in y_cols:
                ax.bar(range(len(df)), df[col], label=col, alpha=0.7)
        if len(y_cols) > 1:
            ax.legend()

    elif chart_type == 'scatter':
        if x_col and x_col in df.columns and len(y_cols) > 0:
            ax.scatter(df[x_col], df[y_cols[0]], alpha=0.6)
            ax.set_xlabel(x_col)
            ax.set_ylabel(y_cols[0])
        elif len(y_cols) >= 2:
            ax.scatter(df[y_cols[0]], df[y_cols[1]], alpha=0.6)
            ax.set_xlabel(y_cols[0])
            ax.set_ylabel(y_cols[1])

    elif chart_type == 'histogram':
        col = y_cols[0] if y_cols else df.select_dtypes(include='number').columns[0]
        ax.hist(df[col].dropna(), bins='auto', edgecolor='black', alpha=0.7)
        ax.set_xlabel(col)

    elif chart_type == 'boxplot':
        numeric_df = df[y_cols] if y_cols else df.select_dtypes(include='number')
        numeric_df.boxplot(ax=ax)

    elif chart_type == 'heatmap':
        numeric_df = df[y_cols] if y_cols else df.select_dtypes(include='number')
        corr = numeric_df.corr()
        im = ax.imshow(corr.values, cmap='coolwarm', vmin=-1, vmax=1)
        ax.set_xticks(range(len(corr.columns)))
        ax.set_yticks(range(len(corr.columns)))
        ax.set_xticklabels(corr.columns, rotation=45, ha='right')
        ax.set_yticklabels(corr.columns)
        plt.colorbar(im, ax=ax)

    if title_str:
        ax.set_title(title_str)

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=dpi)
    plt.close(fig)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode('utf-8')
    result = {'image': f'data:image/png;base64,{b64}'}

result
`;

    const pyResult = await runPythonSafe(code, { data: rows }, 120000);
    const res = pyResult.result as { image?: string; error?: string } | null;

    if (res?.error) {
      return {
        response: {
          success: false as const,
          error: { code: ErrorCodes.INVALID_PARAMS, message: res.error, retryable: false },
        },
      };
    }

    return {
      response: {
        success: true as const,
        action: 'matplotlib_chart',
        chartImage: res?.image,
        pythonExecutionMs: pyResult.executionMs,
      },
    };
  } catch (err) {
    logger.error('Matplotlib chart error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : 'Chart generation failed',
          retryable: false,
        },
      },
    };
  }
}
