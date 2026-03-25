/**
 * DependenciesHandlerAccess — interface used by all dependencies-actions submodule functions.
 *
 * Submodule standalone functions receive a `DependenciesHandlerAccess` object instead of `this`,
 * which exposes handler capabilities through public methods defined on DependenciesHandler.
 */

import type { sheets_v4 } from 'googleapis';
import type { SamplingServer } from '../../mcp/sampling.js';
import type { DependenciesResponse, SheetsDependenciesOutput } from '../../schemas/index.js';
import type { ErrorDetail } from '../../schemas/shared.js';
import type { ImpactAnalyzer } from '../../analysis/impact-analyzer.js';

type DependenciesSuccessData = Extract<DependenciesResponse, { success: true }>['data'];

export type DependenciesHandlerAccess = {
  success: (action: string, data: DependenciesSuccessData) => SheetsDependenciesOutput['response'];
  error: (e: ErrorDetail) => SheetsDependenciesOutput['response'];
  sheetsApi: sheets_v4.Sheets;
  samplingServer?: SamplingServer;
  sendProgress: (current: number, total: number, message?: string) => void;
};

// Cache helpers
export const ANALYZER_CACHE_MAX = 25;
export const ANALYZER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type AnalyzerCacheEntry = {
  analyzer: ImpactAnalyzer;
  lastUsed: number;
};
