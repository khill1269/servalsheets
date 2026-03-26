/**
 * ServalSheets - Range Parsing Helpers
 *
 * Lightweight cached range parsing utilities for hot loops.
 */

import { LRUCache } from 'lru-cache';
import type { RangeInput } from '../schemas/shared.js';

export interface RangeParts {
  sheetName: string;
  cellRef?: string;
  original: string;
}

const rangeParseCache = new LRUCache<string, RangeParts>({
  max: 500,
  ttl: 5 * 60 * 1000,
});

export function parseRange(range: string): RangeParts {
  const cached = rangeParseCache.get(range);
  if (cached) return cached;
  
  const parsed = parseRangeUncached(range);
  rangeParseCache.set(range, parsed);
  return parsed;
}

function parseRangeUncached(range: string): RangeParts {
  const quotedRegex = /^'((?:[^']|'')+)'(?:!(.+))?$/;
  const quotedMatch = quotedRegex.exec(range);
  if (quotedMatch) {
    return {
      sheetName: quotedMatch[1]!.replaceAll("''", "'"),
      cellRef: quotedMatch[2] && quotedMatch[2] !== '' ? quotedMatch[2] : undefined,
      original: range,
    };
  }

  const unquotedRegex = /^([^!']+)(?:!(.*))?$/;
  const unquotedMatch = unquotedRegex.exec(range);
  if (unquotedMatch) {
    return {
      sheetName: unquotedMatch[1]!,
      cellRef: unquotedMatch[2] && unquotedMatch[2] !== '' ? unquotedMatch[2] : undefined,
      original: range,
    };
  }

  return {
    sheetName: range,
    cellRef: undefined,
    original: range,
  };
}