// Re-export from generated location for backward compatibility
export * from '../generated/completions.js';

// ────────────────────────────────────────────────────────────────────────────
// Context-aware completions (augments generated base with session context)
// ────────────────────────────────────────────────────────────────────────────

import { completeSheetName } from '../generated/completions.js';

/**
 * Range completion cache — records recently-used ranges so the LLM gets
 * context-specific suggestions (e.g. "Sheet1!A1:D50" from a prior read)
 * instead of generic defaults ("Sheet1!A1:Z100").
 */
class RangeCache {
  private recent: Map<string, number> = new Map(); // range → lastAccess timestamp
  private maxSize = 50;

  add(range: string): void {
    if (!range || typeof range !== 'string') return;
    this.recent.set(range, Date.now());
    if (this.recent.size > this.maxSize) {
      const sorted = Array.from(this.recent.entries()).sort((a, b) => b[1] - a[1]);
      this.recent = new Map(sorted.slice(0, this.maxSize));
    }
  }

  getCompletions(partial: string): string[] {
    if (!partial || typeof partial !== 'string') {
      // Return most recent ranges when no partial is given
      return Array.from(this.recent.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([v]) => v)
        .slice(0, 10);
    }
    const lower = partial.toLowerCase();
    return Array.from(this.recent.entries())
      .filter(([v]) => v.toLowerCase().includes(lower))
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v)
      .slice(0, 20);
  }

  get size(): number {
    return this.recent.size;
  }
}

const rangeCache = new RangeCache();

/**
 * Record a range used in a tool call (read, write, format, etc.)
 * Called from the tool-call pipeline after successful execution.
 */
export function recordRange(range: string): void {
  rangeCache.add(range);
}

/**
 * Context-aware range completions: returns recently-used ranges first,
 * then falls back to sheet-name-based patterns, then static defaults.
 */
export function completeRangeContextAware(partial: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  function addIfNew(value: string): void {
    if (!seen.has(value)) {
      seen.add(value);
      results.push(value);
    }
  }

  // 1. Recently-used ranges (highest priority — user's actual working context)
  for (const r of rangeCache.getCompletions(partial)) {
    addIfNew(r);
  }

  // 2. Build ranges from known sheet names + common patterns
  const sheetNames = completeSheetName(partial || '');
  const COMMON_SUFFIXES = ['!A1:Z100', '!A1:Z1000', '!A:Z'];
  for (const name of sheetNames.slice(0, 5)) {
    for (const suffix of COMMON_SUFFIXES) {
      const candidate = `${name}${suffix}`;
      if (!partial || candidate.toLowerCase().includes(partial.toLowerCase())) {
        addIfNew(candidate);
      }
    }
  }

  // 3. Static defaults as final fallback
  const DEFAULTS = ['Sheet1!A1:Z100', 'Sheet1!A1:Z1000', 'A1:Z100'];
  for (const d of DEFAULTS) {
    if (!partial || d.toLowerCase().includes(partial.toLowerCase())) {
      addIfNew(d);
    }
  }

  return results.slice(0, 20);
}
