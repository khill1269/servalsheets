/**
 * ServalSheets - sheets_discover Handler
 *
 * Wraps the existing action-discovery.ts service as a proper MCP tool
 * that serves as the entry point for flat mode. When the LLM doesn't know
 * which tool to call, it calls sheets_discover with a natural language query
 * and gets back the top matching flat tool names with confidence scores.
 *
 * This replaces the previous sheets_analyze.discover_action approach
 * (which was buried inside a compound tool) with a first-class top-level tool.
 *
 * @module mcp/registration/flat-discover-handler
 */

import { discoverActions, analyzeDiscoveryQuery } from '../../services/action-discovery.js';
import { buildFlatToolName } from './flat-tool-registry.js';
import { logger } from '../../utils/logger.js';

export interface DiscoverInput {
  query: string;
  category?: string;
  maxResults?: number;
}

export interface DiscoverResult {
  success: true;
  action: 'discover';
  matches: Array<{
    /** Flat tool name to call (e.g., sheets_data_read) */
    tool: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** What this tool does */
    description: string;
    /** When to use this tool */
    whenToUse?: string;
    /** Common mistake to avoid */
    commonMistake?: string;
  }>;
  guidance?: {
    needsClarification: boolean;
    clarificationQuestion?: string;
    clarificationOptions?: string[];
  };
  totalAvailable: number;
}

/**
 * Handle a sheets_discover tool call.
 *
 * Delegates to the existing action-discovery inverted index, then maps
 * results to flat tool names for direct invocation.
 */
export function handleDiscover(input: DiscoverInput): DiscoverResult {
  const { query, category, maxResults = 5 } = input;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      success: true,
      action: 'discover',
      matches: [],
      guidance: {
        needsClarification: true,
        clarificationQuestion: 'Please describe what you want to do with the spreadsheet.',
      },
      totalAvailable: 0,
    };
  }

  const matches = discoverActions(query, category, maxResults);
  const guidance = analyzeDiscoveryQuery(query, matches);

  logger.debug('sheets_discover result', {
    query,
    category,
    matchCount: matches.length,
    topConfidence: matches[0]?.confidence,
    needsClarification: guidance.needsClarification,
  });

  return {
    success: true,
    action: 'discover',
    matches: matches.map((m) => ({
      tool: buildFlatToolName(m.tool, m.action),
      confidence: m.confidence,
      description: m.description,
      whenToUse: m.whenToUse,
      commonMistake: m.commonMistake,
    })),
    guidance: guidance.needsClarification
      ? {
          needsClarification: true,
          clarificationQuestion: guidance.clarificationQuestion,
          clarificationOptions: guidance.clarificationOptions,
        }
      : undefined,
    totalAvailable: matches.length,
  };
}
