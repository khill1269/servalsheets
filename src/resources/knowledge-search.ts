/**
 * ServalSheets - Knowledge Search Resource
 *
 * Provides fuzzy search across all knowledge files.
 * URI: knowledge:///search?q={query}
 *
 * @module resources/knowledge-search
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listKnowledgeResources } from './knowledge.js';

/**
 * Search result with relevance scoring
 */
interface SearchResult {
  uri: string;
  name: string;
  description: string;
  category: string;
  score: number;
  matchType: 'name' | 'description' | 'category' | 'keyword';
}

/**
 * Keyword mappings for fuzzy matching
 */
const KEYWORD_MAPPINGS: Record<string, string[]> = {
  // Budget/Finance terms
  budget: ['finance', 'financial', 'money', 'expense', 'income'],
  finance: ['budget', 'financial', 'money', 'accounting'],
  money: ['finance', 'budget', 'financial'],
  accounting: ['finance', 'financial'],

  // Sales/CRM terms
  sales: ['crm', 'customer', 'pipeline', 'deal'],
  crm: ['customer', 'sales', 'contact', 'pipeline'],
  customer: ['crm', 'sales', 'contact'],
  pipeline: ['sales', 'crm', 'deal'],

  // Project terms
  project: ['task', 'milestone', 'gantt', 'schedule'],
  task: ['project', 'todo', 'milestone'],
  gantt: ['project', 'schedule', 'timeline'],

  // Inventory terms
  inventory: ['stock', 'sku', 'warehouse', 'quantity'],
  stock: ['inventory', 'warehouse', 'quantity'],

  // Formula terms
  vlookup: ['lookup', 'index', 'match', 'search'],
  lookup: ['vlookup', 'index', 'match', 'xlookup'],
  formula: ['function', 'calculation', 'expression'],
  arrayformula: ['array', 'formula', 'bulk'],

  // API terms
  api: ['quota', 'rate', 'limit', 'batch'],
  quota: ['api', 'limit', 'rate'],
  batch: ['api', 'bulk', 'multiple', 'performance'],

  // Performance terms
  performance: ['optimization', 'speed', 'fast', 'efficient'],
  optimization: ['performance', 'optimize', 'improve'],

  // Chart/Visualization
  chart: ['graph', 'visualization', 'plot'],
  graph: ['chart', 'visualization'],
  pivot: ['summary', 'aggregate', 'table'],

  // Security terms
  security: ['permission', 'access', 'protection'],
  permission: ['security', 'access', 'share'],
};

/**
 * Normalize a search term for matching
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[-_]/g, ' ').trim();
}

/**
 * Calculate match score between query and text
 */
function calculateScore(query: string, text: string, weight: number): number {
  const normalizedQuery = normalize(query);
  const normalizedText = normalize(text);

  // Exact match
  if (normalizedText === normalizedQuery) {
    return 100 * weight;
  }

  // Contains exact query
  if (normalizedText.includes(normalizedQuery)) {
    return 80 * weight;
  }

  // Word-level matching
  const queryWords = normalizedQuery.split(/\s+/);
  const textWords = normalizedText.split(/\s+/);

  let matchedWords = 0;
  for (const qw of queryWords) {
    if (textWords.some((tw) => tw.includes(qw) || qw.includes(tw))) {
      matchedWords++;
    }
  }

  if (matchedWords > 0) {
    return (matchedWords / queryWords.length) * 60 * weight;
  }

  return 0;
}

/**
 * Check if query matches via keyword expansion
 */
function checkKeywordMatch(query: string, text: string): boolean {
  const normalizedQuery = normalize(query);
  const normalizedText = normalize(text);

  // Get related keywords for the query
  const relatedKeywords = KEYWORD_MAPPINGS[normalizedQuery] || [];

  // Check if text contains any related keywords
  for (const keyword of relatedKeywords) {
    if (normalizedText.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Search knowledge resources
 */
async function searchKnowledge(query: string): Promise<SearchResult[]> {
  const resources = await listKnowledgeResources();
  const results: SearchResult[] = [];

  for (const resource of resources) {
    let maxScore = 0;
    let matchType: 'name' | 'description' | 'category' | 'keyword' = 'name';

    // Score by name (highest weight)
    const nameScore = calculateScore(query, resource.name, 1.0);
    if (nameScore > maxScore) {
      maxScore = nameScore;
      matchType = 'name';
    }

    // Score by category
    const categoryScore = calculateScore(query, resource.category, 0.8);
    if (categoryScore > maxScore) {
      maxScore = categoryScore;
      matchType = 'category';
    }

    // Score by description
    const descScore = calculateScore(query, resource.description, 0.6);
    if (descScore > maxScore) {
      maxScore = descScore;
      matchType = 'description';
    }

    // Check keyword expansion
    if (maxScore < 30) {
      const nameKeyword = checkKeywordMatch(query, resource.name);
      const descKeyword = checkKeywordMatch(query, resource.description);
      const catKeyword = checkKeywordMatch(query, resource.category);

      if (nameKeyword || descKeyword || catKeyword) {
        maxScore = 25;
        matchType = 'keyword';
      }
    }

    if (maxScore > 0) {
      results.push({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        category: resource.category,
        score: Math.round(maxScore * 10) / 10,
        matchType,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Return top 10 results
  return results.slice(0, 10);
}

/**
 * Register knowledge search resource
 */
export function registerKnowledgeSearchResource(server: McpServer): void {
  server.registerResource(
    'Knowledge Search',
    'knowledge:///search',
    {
      description:
        'Fuzzy search across all knowledge files. Append ?q=query to search. Returns top 10 matches ranked by relevance.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const url = new URL(uri.toString(), 'knowledge://localhost');
      const query = url.searchParams.get('q') || '';

      if (!query) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  error: 'Missing query parameter',
                  usage: 'knowledge:///search?q=your+search+term',
                  examples: [
                    'knowledge:///search?q=VLOOKUP',
                    'knowledge:///search?q=budget+template',
                    'knowledge:///search?q=batch+operations',
                    'knowledge:///search?q=api+quota',
                    'knowledge:///search?q=pivot+table',
                  ],
                  supportedKeywords: Object.keys(KEYWORD_MAPPINGS).slice(0, 20),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const results = await searchKnowledge(query);

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                query,
                resultCount: results.length,
                results: results.map((r) => ({
                  uri: r.uri,
                  name: r.name,
                  category: r.category,
                  description: r.description,
                  relevanceScore: r.score,
                  matchType: r.matchType,
                })),
                note:
                  results.length === 0
                    ? 'No matches found. Try different keywords or browse knowledge:///index for all files.'
                    : 'Results sorted by relevance. Use uri to read the full file.',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
