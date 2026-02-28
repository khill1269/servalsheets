/**
 * Action Discovery Service
 *
 * Provides keyword-based search across all 342+ ServalSheets actions.
 * Builds an inverted index from action names, tool descriptions,
 * and whenToUse annotations for fast lookup.
 *
 * Usage: Used by discover_action meta-tool in sheets_analyze
 * to help Claude find the right action using natural language.
 */

import { ACTION_ANNOTATIONS } from '../schemas/annotations.js';

interface ActionMatch {
  tool: string;
  action: string;
  confidence: number;
  description: string;
  whenToUse?: string;
}

interface ActionIndex {
  tool: string;
  action: string;
  keywords: string[];
  description: string;
  whenToUse?: string;
  category?: string;
}

/**
 * Category mapping for all 22 tools.
 * Used to filter results by category.
 */
const TOOL_CATEGORIES: Record<string, string> = {
  sheets_data: 'data',
  sheets_core: 'structure',
  sheets_format: 'format',
  sheets_dimensions: 'structure',
  sheets_advanced: 'structure',
  sheets_analyze: 'analysis',
  sheets_visualize: 'analysis',
  sheets_collaborate: 'collaboration',
  sheets_composite: 'data',
  sheets_fix: 'data',
  sheets_history: 'data',
  sheets_dependencies: 'analysis',
  sheets_bigquery: 'data',
  sheets_appsscript: 'automation',
  sheets_webhook: 'automation',
  sheets_federation: 'automation',
  sheets_transaction: 'data',
  sheets_session: 'structure',
  sheets_quality: 'data',
  sheets_templates: 'structure',
  sheets_confirm: 'structure',
  sheets_auth: 'structure',
};

let indexCache: ActionIndex[] | null = null;

/**
 * Build the action index from ACTION_ANNOTATIONS.
 * This runs once and caches the result.
 *
 * Each action gets keywords from:
 * 1. Action name parts (split on underscore)
 * 2. Tool name parts (after removing "sheets_" prefix)
 * 3. Words from whenToUse description (filtered for quality)
 */
function buildIndex(): ActionIndex[] {
  if (indexCache) return indexCache;

  const index: ActionIndex[] = [];

  // Index all actions from ACTION_ANNOTATIONS
  for (const [key, annotation] of Object.entries(ACTION_ANNOTATIONS)) {
    const [tool, action] = key.split('.');
    if (!tool || !action) continue;

    const keywords = new Set<string>();

    // Add action name parts (e.g., "batch_read" → ["batch", "read"])
    action.split('_').forEach((w) => {
      if (w.length > 1) keywords.add(w.toLowerCase());
    });

    // Add tool name parts (e.g., "sheets_data" → ["data"])
    tool
      .replace('sheets_', '')
      .split('_')
      .forEach((w) => {
        if (w.length > 1) keywords.add(w.toLowerCase());
      });

    // Add words from whenToUse description (quality filter)
    if (annotation.whenToUse) {
      annotation.whenToUse.split(/\s+/).forEach((w) => {
        const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Only add substantive words (> 2 chars, not common stopwords)
        if (
          clean.length > 2 &&
          !['the', 'and', 'for', 'use', 'from', 'with', 'when', 'are'].includes(clean)
        ) {
          keywords.add(clean);
        }
      });
    }

    // Build description: prefer whenToUse, fall back to action name
    const description = annotation.whenToUse || `${action.replace(/_/g, ' ')} operation`;

    index.push({
      tool,
      action,
      keywords: [...keywords],
      description,
      whenToUse: annotation.whenToUse,
      category: TOOL_CATEGORIES[tool] || 'other',
    });
  }

  indexCache = index;
  return index;
}

/**
 * Tokenize a search query into lowercase words.
 * Removes special characters and filters out very short tokens.
 */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Search for actions matching a natural language query.
 *
 * @param query - Natural language search query (e.g., "merge cells", "combine data")
 * @param category - Optional category filter (data|format|analysis|structure|collaboration|automation|all)
 * @param maxResults - Maximum results to return (1-10, default 5)
 * @returns Array of matching actions ranked by confidence
 */
export function discoverActions(
  query: string,
  category?: string,
  maxResults: number = 5
): ActionMatch[] {
  const index = buildIndex();
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) return [];

  const scored: { entry: ActionIndex; score: number }[] = [];

  for (const entry of index) {
    // Skip if category filter provided and doesn't match
    if (category && category !== 'all' && entry.category !== category) continue;

    let score = 0;

    for (const token of queryTokens) {
      // Exact keyword match (strongest signal: +3 points)
      if (entry.keywords.includes(token)) {
        score += 3;
      }
      // Partial match in keywords (word contains token or vice versa: +1.5 points)
      else if (entry.keywords.some((k) => k.includes(token) || token.includes(k))) {
        score += 1.5;
      }
      // Direct match in action name (e.g., searching "read" finds "read_*" actions: +2 points)
      else if (entry.action.includes(token)) {
        score += 2;
      }
      // Match in tool name (e.g., "data" matches sheets_data: +0.5 points)
      else if (entry.tool.includes(token)) {
        score += 0.5;
      }
      // Match in description text (+1 point)
      else if (entry.description.toLowerCase().includes(token)) {
        score += 1;
      }
    }

    // Normalize confidence score to 0-1 range
    // Max possible score = queryTokens.length * 3 (all exact matches)
    const confidence = Math.min(1, score / (queryTokens.length * 3));

    // Only include matches with minimum confidence
    if (confidence > 0.1) {
      scored.push({ entry, score: confidence });
    }
  }

  // Sort by score descending (best matches first)
  scored.sort((a, b) => b.score - a.score);

  // Return top N results
  return scored.slice(0, maxResults).map(({ entry, score }) => ({
    tool: entry.tool,
    action: entry.action,
    confidence: Math.round(score * 100) / 100,
    description: entry.description,
    whenToUse: entry.whenToUse,
  }));
}

/**
 * Get all available categories for filtering.
 */
export function getCategories(): string[] {
  return ['data', 'format', 'analysis', 'structure', 'collaboration', 'automation'];
}
