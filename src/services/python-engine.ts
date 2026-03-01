/**
 * Python Engine — Pyodide WASM bridge for server-side Python compute.
 *
 * Provides a lazy singleton Pyodide instance (loaded once per process)
 * with numpy, pandas, scipy, and scikit-learn pre-installed.
 *
 * First load takes ~10-20 seconds (WASM download + package install).
 * Subsequent calls are fast (re-use the same instance).
 *
 * Usage:
 *   const py = await getPyodide();
 *   const result = await runPythonSafe('1 + 1', {}, 10000);
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Pyodide singleton
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadPromise: Promise<PyodideInterface> | null = null;

/**
 * Return (or lazy-initialize) the shared Pyodide instance.
 *
 * Throws if Pyodide fails to load. Callers should catch and return
 * a graceful NOT_FOUND / INTERNAL_ERROR response.
 */
export async function getPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;

  if (!pyodideLoadPromise) {
    pyodideLoadPromise = (async () => {
      logger.info('Loading Pyodide WASM runtime (first load ~10-20s)...');

      // Dynamic import avoids bundling issues with the WASM binary
      const pyodideModule = (await import('pyodide')) as {
        loadPyodide: (opts?: { indexURL?: string }) => Promise<PyodideInterface>;
      };

      const py: PyodideInterface = await pyodideModule.loadPyodide();

      // Pre-install the packages most useful for spreadsheet analytics.
      // scikit-learn is loaded via micropip (not available as a built-in package).
      await py.loadPackage(['numpy', 'pandas', 'scipy', 'matplotlib']);

      // Install scikit-learn via micropip
      try {
        await py.loadPackage('micropip');
        await py.runPythonAsync(`
import micropip
await micropip.install('scikit-learn')
`);
      } catch (skErr) {
        // scikit-learn install is best-effort — core analytics still work without it
        logger.warn('scikit-learn not available in Pyodide (optional)', {
          error: skErr instanceof Error ? skErr.message : String(skErr),
        });
      }

      logger.info('Pyodide ready (numpy, pandas, scipy, matplotlib loaded)');
      pyodideInstance = py;
      return py;
    })().catch((err: unknown) => {
      // Reset so the next caller can retry
      pyodideLoadPromise = null;
      throw err;
    });
  }

  return pyodideLoadPromise;
}

/**
 * Non-blocking background preload — call from server startup to warm the
 * WASM runtime before the first user request arrives.
 */
export function preloadPyodide(): void {
  getPyodide().catch((err: unknown) => {
    logger.warn('Pyodide preload failed — Python compute will be unavailable', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

// ============================================================================
// Safe execution
// ============================================================================

export interface PythonRunResult {
  output: string;
  result: unknown;
  executionMs: number;
}

/**
 * Run Python code with injected globals, a timeout guard, and stdout capture.
 *
 * @param code - Python source to execute
 * @param globals - Variables to inject into the Python namespace before execution
 * @param timeoutMs - Hard wall-clock timeout (default 60 s)
 */
export async function runPythonSafe(
  code: string,
  globals: Record<string, unknown> = {},
  timeoutMs = 60000
): Promise<PythonRunResult> {
  const py = await getPyodide();

  // Inject caller-provided globals into the Python namespace
  for (const [k, v] of Object.entries(globals)) {
    py.globals.set(k, py.toPy(v));
  }

  const start = Date.now();

  // Redirect sys.stdout to a StringIO buffer so we can capture print() output
  py.runPython(`
import sys as _sys, io as _io
_stdout_capture = _io.StringIO()
_sys.stdout = _stdout_capture
`);

  // Execute user code with a timeout guard
  const result = await Promise.race<unknown>([
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Python execution timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
    Promise.resolve().then(() => py.runPython(code) as unknown),
  ]);

  // Restore stdout and grab captured output
  const captured = py.runPython(`
_sys.stdout = _sys.__stdout__
_stdout_capture.getvalue()
`) as string;

  return {
    output: captured ?? '',
    result: py.toJs(result as object),
    executionMs: Date.now() - start,
  };
}
