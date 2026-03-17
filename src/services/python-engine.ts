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

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Pyodide singleton
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadPromise: Promise<PyodideInterface> | null = null;

function suppressPyodideOutput(_message?: string): void {
  // Pyodide package progress writes to stdout by default in Node.
  // In STDIO transport that would corrupt the MCP JSON-RPC channel.
}

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
        loadPyodide: (opts?: {
          indexURL?: string;
          stdout?: (msg: string) => void;
          stderr?: (msg: string) => void;
        }) => Promise<PyodideInterface>;
      };

      const py: PyodideInterface = await pyodideModule.loadPyodide({
        stdout: suppressPyodideOutput,
        stderr: suppressPyodideOutput,
      });

      if (typeof py.setStdout === 'function') {
        py.setStdout({ batched: suppressPyodideOutput });
      }
      if (typeof py.setStderr === 'function') {
        py.setStderr({ batched: suppressPyodideOutput });
      }

      // Pre-install the packages most useful for spreadsheet analytics.
      // scikit-learn is loaded via micropip (not available as a built-in package).
      await py.loadPackage(['numpy', 'pandas', 'scipy', 'matplotlib'], {
        messageCallback: suppressPyodideOutput,
        errorCallback: suppressPyodideOutput,
      });

      // Install scikit-learn via micropip
      try {
        await py.loadPackage('micropip', {
          messageCallback: suppressPyodideOutput,
          errorCallback: suppressPyodideOutput,
        });
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
 * Run Python code in an isolated Worker thread with true timeout enforcement.
 *
 * Each call spawns a fresh Pyodide instance in a Worker thread, preventing
 * global state pollution and enabling true timeout via worker.terminate().
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
  const workerPath = join(__dirname, 'python-worker.js');

  return new Promise<PythonRunResult>((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { code, globals, timeoutMs },
    });

    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error(`Python execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.on(
      'message',
      (msg: {
        success: boolean;
        output?: string;
        result?: unknown;
        executionMs?: number;
        error?: string;
      }) => {
        clearTimeout(timer);
        if (msg.success) {
          resolve({
            output: msg.output ?? '',
            result: msg.result,
            executionMs: msg.executionMs ?? 0,
          });
        } else {
          reject(new Error(msg.error ?? 'Python execution failed'));
        }
      }
    );

    worker.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
