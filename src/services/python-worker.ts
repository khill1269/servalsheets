/**
 * Python Worker — runs inside a worker_threads Worker.
 *
 * Receives WorkerRequest via workerData, executes Python code
 * in a sandboxed Pyodide instance, and posts the result back via parentPort.
 *
 * Each invocation spawns a fresh worker to prevent global state pollution.
 */

import { workerData, parentPort } from 'worker_threads';

interface WorkerRequest {
  code: string;
  globals: Record<string, unknown>;
  timeoutMs: number;
}

interface WorkerSuccess {
  success: true;
  output: string;
  result: unknown;
  executionMs: number;
}

interface WorkerFailure {
  success: false;
  error: string;
}

// Allowlisted modules — only these can be imported in sandboxed code
const ALLOWED_MODULES = new Set([
  'math',
  'statistics',
  'json',
  're',
  'datetime',
  'collections',
  'itertools',
  'functools',
  'operator',
  'string',
  'io',
  '_io',
  'numbers',
  'decimal',
  'fractions',
  'cmath',
  'copy',
  'typing',
  'enum',
  'dataclasses',
  'abc',
  'contextlib',
  'warnings',
  'pprint',
  'numpy',
  'pandas',
  'scipy',
  'matplotlib',
]);

function buildSandboxCode(userCode: string): string {
  const allowedList = JSON.stringify([...ALLOWED_MODULES]);
  return `
import builtins as _builtins
import sys as _sys
import io as _io

# --- Allowlist-based import restriction ---
_ALLOWED = frozenset(${allowedList})
_orig_import = _builtins.__import__

def _safe_import(name, *args, **kwargs):
    base = name.split('.')[0]
    if base not in _ALLOWED:
        raise ImportError(f"Module '{{name}}' is not permitted in this sandbox")
    return _orig_import(name, *args, **kwargs)

_builtins.__import__ = _safe_import

# --- Remove dangerous builtins ---
for _attr in ('open', 'exec', 'compile'):
    try:
        delattr(_builtins, _attr)
    except AttributeError:
        pass

def _blocked_exec(*args, **kwargs):
    raise RuntimeError("exec() is not permitted in this sandbox")

def _blocked_compile(*args, **kwargs):
    raise RuntimeError("compile() is not permitted in this sandbox")

def _blocked_open(*args, **kwargs):
    raise RuntimeError("open() is not permitted in this sandbox")

_builtins.exec = _blocked_exec
_builtins.compile = _blocked_compile
_builtins.open = _blocked_open

# --- Capture stdout ---
_stdout_capture = _io.StringIO()
_sys.stdout = _stdout_capture

# --- User code ---
${userCode}

_output = _stdout_capture.getvalue()
`;
}

async function runPython(): Promise<void> {
  try {
    const req = workerData as WorkerRequest;

    const pyodideModule = (await import('pyodide')) as {
      loadPyodide: (opts?: { indexURL?: string; packageCacheDir?: string }) => Promise<unknown>;
    };

    // FIX-03: Wire PYODIDE_CACHE_DIR to worker's loadPyodide for faster cold starts
    const cacheDir = process.env['PYODIDE_CACHE_DIR'];
    const loadOptions: { packageCacheDir?: string } = {};
    if (cacheDir) {
      loadOptions.packageCacheDir = cacheDir;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const py: any = await pyodideModule.loadPyodide(loadOptions);

    await py.loadPackage(['numpy', 'pandas', 'scipy', 'matplotlib']);

    // Inject caller globals into the Python namespace
    for (const [k, v] of Object.entries(req.globals)) {
      py.globals.set(k, py.toPy(v));
    }

    const start = Date.now();
    const sandboxCode = buildSandboxCode(req.code);
    py.runPython(sandboxCode);

    const output = (py.globals.get('_output') as string) ?? '';
    const executionMs = Date.now() - start;

    const result: WorkerSuccess = {
      success: true,
      output,
      result: null,
      executionMs,
    };

    parentPort?.postMessage(result);
  } catch (err) {
    const result: WorkerFailure = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort?.postMessage(result);
  }
}

void runPython();
