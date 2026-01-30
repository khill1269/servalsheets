/**
 * Schema Optimization Configuration
 *
 * Controls how verbose tool schemas are when sent to Claude.
 * Reducing verbosity saves context window tokens.
 *
 * @example
 * ```bash
 * # Minimal mode (saves ~15,000 tokens)
 * SCHEMA_MODE=minimal npm start
 *
 * # Full mode (default, best for learning)
 * SCHEMA_MODE=full npm start
 * ```
 */

export type SchemaMode = 'full' | 'minimal' | 'compact';

/**
 * Current schema optimization mode
 *
 * - `full`: All descriptions, examples, and hints (default)
 * - `minimal`: Essential descriptions only (~40% smaller)
 * - `compact`: No inline descriptions (~60% smaller)
 */
export const SCHEMA_MODE: SchemaMode = (process.env['SCHEMA_MODE'] as SchemaMode) || 'full';

/**
 * Tools to lazy-load (not included in initial tools/list)
 * These are loaded on first use via tool discovery
 */
export const LAZY_LOAD_TOOLS: string[] = process.env['LAZY_LOAD_TOOLS']?.split(',') || [];

/**
 * Default lazy-load tools (enterprise features)
 * Set LAZY_LOAD_ENTERPRISE=true to enable
 */
export const ENTERPRISE_TOOLS = [
  'sheets_bigquery',
  'sheets_appsscript',
  'sheets_templates',
  'sheets_webhook',
  'sheets_dependencies',
];

/**
 * Whether to lazy-load enterprise tools
 */
export const LAZY_LOAD_ENTERPRISE = process.env['LAZY_LOAD_ENTERPRISE'] === 'true';

/**
 * Get list of tools to exclude from initial registration
 */
export function getLazyLoadTools(): string[] {
  const tools = [...LAZY_LOAD_TOOLS];
  if (LAZY_LOAD_ENTERPRISE) {
    tools.push(...ENTERPRISE_TOOLS);
  }
  return tools;
}

/**
 * Check if a tool should be lazy-loaded
 */
export function isLazyLoadTool(toolName: string): boolean {
  return getLazyLoadTools().includes(toolName);
}

/**
 * Schema optimization statistics
 */
export interface SchemaStats {
  mode: SchemaMode;
  lazyLoadEnabled: boolean;
  lazyLoadTools: string[];
  estimatedTokenSavings: number;
}

/**
 * Get current optimization stats
 */
export function getSchemaStats(): SchemaStats {
  const lazyTools = getLazyLoadTools();
  let tokenSavings = 0;

  // Estimate savings based on mode
  if (SCHEMA_MODE === 'minimal') {
    tokenSavings += 10000; // ~10K from shorter descriptions
  } else if (SCHEMA_MODE === 'compact') {
    tokenSavings += 20000; // ~20K from no inline descriptions
  }

  // Estimate savings from lazy loading
  tokenSavings += lazyTools.length * 2000; // ~2K per lazy tool

  return {
    mode: SCHEMA_MODE,
    lazyLoadEnabled: LAZY_LOAD_ENTERPRISE || LAZY_LOAD_TOOLS.length > 0,
    lazyLoadTools: lazyTools,
    estimatedTokenSavings: tokenSavings,
  };
}
